import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyAiVisionDetections, energyAiVisionRuns, energySafetyInspectionMedia } from '@/db/schema';
import { db } from '@/lib/db';
import { aiVisionAnalyzeSchema } from '@/lib/safety-schemas';
import { inputHashForMedia, matchMediaAsset, normalizeAiDetections } from '@/server/safety/ai-vision';

export const dynamic = 'force-dynamic';

const remoteOutputSchema = z.object({
  inspection_id: z.string().optional(),
  recommendation: z.string().optional(),
  status: z.string().optional(),
  detections: z.array(z.object({
    type: z.string().optional(),
    label: z.string().optional(),
    confidence: z.number().min(0).max(100),
    risk_level: z.string().optional(),
    bounding_box: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    }).passthrough().optional(),
  }).passthrough()).optional().default([]),
  location: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
}).passthrough();

const DEMO_IMAGE_REFERENCE = /^\/images\/safety\/inspection_00[1-7]\.jpg$/i;

function mediaMimeType(reference: string) {
  const extension = path.extname(new URL(reference, 'http://local').pathname).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  return 'image/jpeg';
}

async function loadMediaBlob(media: { fileRef: string | null; sourceUrl: string | null }) {
  const reference = media.fileRef ?? media.sourceUrl;
  if (!reference) throw new Error('Inspection media has no file reference or source URL.');
  const normalizedReference = reference.trim().replaceAll('\\', '/');
  if (!DEMO_IMAGE_REFERENCE.test(normalizedReference)) throw new Error('Only demo images inspection_001.jpg through inspection_007.jpg can be analyzed.');
  const publicRoot = path.resolve(process.cwd(), 'public');
  const localPath = path.resolve(publicRoot, normalizedReference.replace(/^[/\\]+/, ''));
  const relative = path.relative(publicRoot, localPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Inspection media reference is outside the public asset directory.');
  const bytes = await readFile(localPath);
  return { blob: new Blob([new Uint8Array(bytes)], { type: mediaMimeType(normalizedReference) }), filename: path.basename(localPath) };
}

export async function POST(request: Request) {
  let runId: string | null = null;
  try {
    const payload = aiVisionAnalyzeSchema.parse(await request.json());
    const [media] = await db.select({
      id: energySafetyInspectionMedia.id,
      status: energySafetyInspectionMedia.status,
      title: energySafetyInspectionMedia.title,
      fileRef: energySafetyInspectionMedia.fileRef,
      sourceUrl: energySafetyInspectionMedia.sourceUrl,
      checksum: energySafetyInspectionMedia.checksum,
      capturedAt: energySafetyInspectionMedia.capturedAt,
      metadata: energySafetyInspectionMedia.metadata,
      latitude: sql<number | null>`CASE WHEN ${energySafetyInspectionMedia.location} IS NULL THEN NULL ELSE ST_Y(${energySafetyInspectionMedia.location}::geometry) END`,
      longitude: sql<number | null>`CASE WHEN ${energySafetyInspectionMedia.location} IS NULL THEN NULL ELSE ST_X(${energySafetyInspectionMedia.location}::geometry) END`,
    }).from(energySafetyInspectionMedia).where(eq(energySafetyInspectionMedia.id, payload.mediaId)).limit(1);
    if (!media) return NextResponse.json({ message: 'Inspection media not found.', issues: [{ path: ['mediaId'], message: 'Choose an existing media record.' }] }, { status: 404 });
    if (media.status === 'ARCHIVED') return NextResponse.json({ message: 'Archived media cannot be analyzed.', issues: [{ path: ['mediaId'], message: 'Restore or choose active media.' }] }, { status: 400 });
    const sourceHash = payload.inputHash ?? inputHashForMedia(media);
    const [created] = await db.insert(energyAiVisionRuns).values({
      mediaId: payload.mediaId,
      modelProvider: payload.modelProvider,
      modelName: payload.modelName,
      modelVersion: payload.modelVersion,
      configVersion: payload.configVersion,
      inputHash: sourceHash,
      startedAt: new Date(),
      status: 'RUNNING',
      rawOutput: payload.rawOutput,
      createdBy: payload.createdBy ?? null,
      updatedAt: new Date(),
    }).returning({ id: energyAiVisionRuns.id });
    if (!created) throw new Error('AI vision run was not created.');
    runId = created.id;

    let rawOutput = payload.rawOutput;
    let rawDetections: Array<Record<string, unknown>> = (payload.detections ?? []) as Array<Record<string, unknown>>;
    if (payload.executionMode === 'HTTP_ENDPOINT') {
      const endpoint = process.env.AI_VISION_ENDPOINT;
      if (!endpoint) throw new Error('AI_VISION_ENDPOINT is not configured; provide a real model adapter or import a model output.');
      const { blob, filename } = await loadMediaBlob(media);
      const coordinates = media.metadata?.coordinates && typeof media.metadata.coordinates === 'object'
        ? media.metadata.coordinates as Record<string, unknown>
        : {};
      const latitude = Number(media.latitude ?? coordinates.latitude ?? 10.541155935);
      const longitude = Number(media.longitude ?? coordinates.longitude ?? 106.413588316);
      const form = new FormData();
      form.set('image', blob, filename);
      form.set('latitude', String(Number.isFinite(latitude) ? latitude : 10.541155935));
      form.set('longitude', String(Number.isFinite(longitude) ? longitude : 106.413588316));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.max(1_000, Number(process.env.AI_SERVICE_TIMEOUT_MS ?? 60_000)));
      let response: Response;
      try {
        const headers: Record<string, string> = { Accept: 'application/json', 'X-Client-App': 'energy-app-v2' };
        const apiKey = process.env.AI_SERVICE_API_KEY?.trim();
        if (apiKey) headers[process.env.AI_SERVICE_AUTH_TYPE === 'x-api-key' ? 'X-API-Key' : 'Authorization'] = process.env.AI_SERVICE_AUTH_TYPE === 'x-api-key' ? apiKey : `Bearer ${apiKey}`;
        response = await fetch(endpoint, { method: 'POST', headers, body: form, signal: controller.signal, cache: 'no-store' });
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) throw new Error(`AI model endpoint returned HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
      const remote = await response.json() as unknown;
      const parsed = remoteOutputSchema.safeParse(remote);
      if (!parsed.success) throw new Error('AI model endpoint returned an invalid response contract.');
      rawOutput = parsed.data;
      rawDetections = parsed.data.detections.map((detection) => ({
        ...detection,
        // Mission 5 returns a provider type such as VEGETATION_ENCROACHMENT;
        // keep the human label in the explanation while normalizing the type
        // to the application's canonical safety labels.
        label: detection.type ?? detection.label ?? 'OTHER',
        explanation: {
          providerType: detection.type ?? null,
          providerLabel: detection.label ?? null,
          riskLevel: detection.risk_level ?? null,
          recommendation: parsed.data.recommendation ?? null,
        },
      }));
    }
    const detections = normalizeAiDetections(rawDetections);
    const match = await matchMediaAsset(payload.mediaId, payload.assetId);
    const completedAt = new Date();
    await db.transaction(async (tx) => {
      await tx.update(energyAiVisionRuns).set({ status: 'SUCCEEDED', completedAt, rawOutput, matchedAssetId: match.assetId, matchedAssetMethod: match.method, matchedDistanceM: match.distanceM == null ? null : String(match.distanceM), matchedAt: match.assetId ? completedAt : null, updatedAt: completedAt }).where(eq(energyAiVisionRuns.id, runId as string));
      if (detections.length) await tx.insert(energyAiVisionDetections).values(detections.map((detection) => ({ runId: runId as string, label: detection.label, confidence: String(detection.confidence), bbox: detection.bbox, segmentation: detection.segmentation, riskScore: detection.riskScore == null ? null : String(detection.riskScore), suggestedSeverity: detection.suggestedSeverity, suggestedViolationType: detection.suggestedViolationType, explanation: detection.explanation, reviewStatus: 'PENDING_HUMAN_REVIEW', updatedAt: completedAt })));
    });
    const run = await db.execute(sql`SELECT id, media_id AS "mediaId", model_provider AS "modelProvider", model_name AS "modelName", model_version AS "modelVersion", config_version AS "configVersion", input_hash AS "inputHash", started_at AS "startedAt", completed_at AS "completedAt", status, matched_asset_id AS "matchedAssetId", matched_asset_method AS "matchedAssetMethod", matched_distance_m AS "matchedDistanceM", raw_output AS "rawOutput" FROM energy_ai_vision_runs WHERE id = ${runId}::uuid LIMIT 1`);
    const runRow = run.rows[0] as Record<string, unknown> | undefined;
    const providerRecommendation = rawOutput.recommendation === 'No action required'
      ? 'AI chưa đề xuất hành động xử lý.'
      : typeof rawOutput.recommendation === 'string' ? rawOutput.recommendation : null;
    const cleanResult = detections.length === 0 ? 'AI không phát hiện nguy cơ trong ảnh; kết quả vẫn cần cán bộ xác nhận.' : null;
    return NextResponse.json({ item: runRow ? { ...runRow, matchedDistanceM: runRow.matchedDistanceM == null ? null : Number(runRow.matchedDistanceM) } : null, detections, warnings: [providerRecommendation, cleanResult, match.warning].filter(Boolean) }, { status: 201 });
  } catch (error) {
    if (runId) await db.update(energyAiVisionRuns).set({ status: 'FAILED', errorMessage: error instanceof Error ? error.message : 'AI vision analysis failed.', completedAt: new Date(), updatedAt: new Date() }).where(eq(energyAiVisionRuns.id, runId));
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'AI vision request is invalid.', issues: error.issues }, { status: 400 });
    const message = error instanceof Error ? error.message : 'Could not analyze inspection media.';
    return NextResponse.json({ message, runId }, { status: message.includes('not configured') ? 503 : 400 });
  }
}
