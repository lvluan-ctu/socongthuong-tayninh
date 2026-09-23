import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyAiVisionDetections, energyAiVisionReviews, energyAiVisionRuns, energyCorridorViolations, energyProtectionCorridors, energySafetyInspectionMedia, energySafetyInspectionViolations, energyViolationStatusHistory } from '@/db/schema';
import { db } from '@/lib/db';
import { aiVisionReviewSchema } from '@/lib/safety-schemas';
import { canonicalizeLabel, violationTypeForLabel } from '@/server/safety/ai-vision';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ detectionId: string }> };
const paramsSchema = z.object({ detectionId: z.string().uuid() });

function parseGeoJson(value: unknown) {
  if (typeof value !== 'string') return value ?? null;
  try { return JSON.parse(value) as unknown; } catch { return null; }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { detectionId } = paramsSchema.parse(await context.params);
    const payload = aiVisionReviewSchema.parse(await request.json());
    const [detection] = await db.select({
      id: energyAiVisionDetections.id,
      runId: energyAiVisionDetections.runId,
      label: energyAiVisionDetections.label,
      confidence: energyAiVisionDetections.confidence,
      suggestedSeverity: energyAiVisionDetections.suggestedSeverity,
      suggestedViolationType: energyAiVisionDetections.suggestedViolationType,
      reviewStatus: energyAiVisionDetections.reviewStatus,
      createdViolationId: energyAiVisionDetections.createdViolationId,
      mediaId: energyAiVisionRuns.mediaId,
      modelProvider: energyAiVisionRuns.modelProvider,
      modelName: energyAiVisionRuns.modelName,
      modelVersion: energyAiVisionRuns.modelVersion,
      inputHash: energyAiVisionRuns.inputHash,
      matchedAssetId: energyAiVisionRuns.matchedAssetId,
      matchedAssetMethod: energyAiVisionRuns.matchedAssetMethod,
      matchedDistanceM: energyAiVisionRuns.matchedDistanceM,
      inspectionId: energySafetyInspectionMedia.inspectionId,
      fileRef: energySafetyInspectionMedia.fileRef,
      sourceUrl: energySafetyInspectionMedia.sourceUrl,
      capturedAt: energySafetyInspectionMedia.capturedAt,
      mediaGeometry: sql<string | null>`CASE WHEN ${energySafetyInspectionMedia.location} IS NULL THEN NULL ELSE ST_AsGeoJSON(${energySafetyInspectionMedia.location}::geometry) END`,
    }).from(energyAiVisionDetections)
      .innerJoin(energyAiVisionRuns, eq(energyAiVisionRuns.id, energyAiVisionDetections.runId))
      .innerJoin(energySafetyInspectionMedia, eq(energySafetyInspectionMedia.id, energyAiVisionRuns.mediaId))
      .where(eq(energyAiVisionDetections.id, detectionId)).limit(1);
    if (!detection) return NextResponse.json({ message: 'AI detection not found.' }, { status: 404 });
    if (detection.reviewStatus !== 'PENDING_HUMAN_REVIEW') return NextResponse.json({ message: 'This AI detection has already been reviewed.', issues: [{ path: ['decision'], message: 'Review each detection only once.' }] }, { status: 409 });
    const coordinateCount = [payload.latitude, payload.longitude].filter((value) => value != null).length;
    if (coordinateCount === 1) return NextResponse.json({ message: 'Violation location needs latitude and longitude together.', issues: [{ path: ['longitude'], message: 'Provide both coordinates.' }] }, { status: 400 });
    const label = payload.finalLabel ?? canonicalizeLabel(detection.label);
    const violationType = payload.finalViolationType ?? violationTypeForLabel(label);
    const severity = payload.finalSeverity ?? (detection.suggestedSeverity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null) ?? 'MEDIUM';
    const shouldCreateViolation = payload.decision !== 'REJECT' && payload.createViolation;
    if (payload.decision === 'ADJUST' && (!payload.finalLabel || !payload.finalSeverity || !payload.finalViolationType)) return NextResponse.json({ message: 'Adjusted review needs final label, severity and violation type.', issues: [{ path: ['finalLabel'], message: 'Provide the human-adjusted fields.' }] }, { status: 400 });
    let corridorId = payload.corridorId ?? null;
    if (shouldCreateViolation && !corridorId && detection.matchedAssetId) {
      const [corridor] = await db.select({ id: energyProtectionCorridors.id }).from(energyProtectionCorridors).where(eq(energyProtectionCorridors.assetId, detection.matchedAssetId)).limit(1);
      corridorId = corridor?.id ?? null;
    }
    if (shouldCreateViolation && !corridorId) return NextResponse.json({ message: 'A protection corridor is required to create a violation.', issues: [{ path: ['corridorId'], message: 'Choose a corridor or provide an asset match with a corridor.' }] }, { status: 400 });
    const mediaGeometry = parseGeoJson(detection.mediaGeometry) as { coordinates?: unknown } | null;
    const geometryCoordinates = mediaGeometry && Array.isArray(mediaGeometry.coordinates) ? mediaGeometry.coordinates : [];
    const longitude = payload.longitude ?? (typeof geometryCoordinates[0] === 'number' ? geometryCoordinates[0] : null);
    const latitude = payload.latitude ?? (typeof geometryCoordinates[1] === 'number' ? geometryCoordinates[1] : null);
    const now = new Date();
    const refs = [detection.fileRef, detection.sourceUrl, `ai-run:${detection.runId}`, `ai-detection:${detection.id}`].filter((value): value is string => Boolean(value));
    const evidence = { refs, source: 'AI_VISION', ai: { label, confidencePct: Number(detection.confidence) * 100, modelProvider: detection.modelProvider, modelName: detection.modelName, modelVersion: detection.modelVersion, inputHash: detection.inputHash, matchedAssetMethod: detection.matchedAssetMethod }, review: { decision: payload.decision, reviewer: payload.reviewer, note: payload.note ?? null, reviewedAt: now.toISOString() } };
    const result = await db.transaction(async (tx) => {
      let violationId: string | null = null;
      if (shouldCreateViolation && corridorId) {
        const code = payload.violationCode || `AI-${detection.id.slice(0, 8)}-${Date.now().toString(36)}`;
        const [createdViolation] = await tx.insert(energyCorridorViolations).values({
          corridorId,
          code,
          violationType,
          severity,
          location: latitude != null && longitude != null ? `SRID=4326;POINT(${longitude} ${latitude})` : null,
          detectedAt: detection.capturedAt ?? now,
          status: 'CONFIRMED',
          distanceM: payload.distanceM == null ? (detection.matchedDistanceM == null ? null : String(detection.matchedDistanceM)) : String(payload.distanceM),
          evidence,
          aiRunId: detection.runId,
          aiDetectionId: detection.id,
          humanReviewRequired: false,
          reviewDecision: payload.decision,
          reviewedBy: payload.reviewer,
          reviewedAt: now,
          updatedAt: now,
        }).returning({ id: energyCorridorViolations.id });
        if (!createdViolation) throw new Error('Confirmed violation was not created.');
        violationId = createdViolation.id;
        await tx.insert(energyViolationStatusHistory).values({ violationId, fromStatus: null, toStatus: 'CONFIRMED', changedBy: payload.reviewer, reason: 'AI_HUMAN_CONFIRMATION' });
        await tx.insert(energySafetyInspectionViolations).values({ inspectionId: detection.inspectionId, violationId, detectionRef: detection.id });
      }
      await tx.insert(energyAiVisionReviews).values({ detectionId, decision: payload.decision, reviewer: payload.reviewer, finalLabel: label, finalSeverity: severity, finalViolationType: violationType, note: payload.note ?? null, violationId, reviewedAt: now });
      await tx.update(energyAiVisionDetections).set({ reviewStatus: payload.decision === 'REJECT' ? 'REJECTED' : 'CONFIRMED', reviewedBy: payload.reviewer, reviewedAt: now, createdViolationId: violationId, updatedAt: now }).where(eq(energyAiVisionDetections.id, detectionId));
      const pending = await tx.execute(sql`SELECT COUNT(*) AS count FROM energy_ai_vision_detections WHERE run_id = ${detection.runId}::uuid AND review_status = 'PENDING_HUMAN_REVIEW'`);
      if (Number((pending.rows[0] as { count?: string }).count ?? 0) === 0) await tx.update(energyAiVisionRuns).set({ status: 'REVIEWED', updatedAt: now }).where(eq(energyAiVisionRuns.id, detection.runId));
      return { violationId };
    });
    return NextResponse.json({ item: { detectionId, decision: payload.decision, violationId: result.violationId }, violationId: result.violationId });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'AI review is invalid.', issues: error.issues }, { status: 400 });
    const message = error instanceof Error ? error.message : 'Could not review AI detection.';
    return NextResponse.json({ message }, { status: message.includes('energy_') ? 409 : 400 });
  }
}
