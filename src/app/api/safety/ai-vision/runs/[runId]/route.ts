import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyAiVisionDetections, energyAiVisionReviews, energyAiVisionRuns, energySafetyInspectionMedia, energySafetyInspections } from '@/db/schema';
import { db } from '@/lib/db';
import { aiVisionRunPatchSchema } from '@/lib/safety-schemas';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ runId: string }> };
const paramsSchema = z.object({ runId: z.string().uuid() });

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { runId } = paramsSchema.parse(await context.params);
    const [run] = await db.select({
      id: energyAiVisionRuns.id,
      mediaId: energyAiVisionRuns.mediaId,
      mediaTitle: energySafetyInspectionMedia.title,
      mediaFileRef: energySafetyInspectionMedia.fileRef,
      mediaSourceUrl: energySafetyInspectionMedia.sourceUrl,
      mediaChecksum: energySafetyInspectionMedia.checksum,
      capturedAt: energySafetyInspectionMedia.capturedAt,
      inspectionId: energySafetyInspectionMedia.inspectionId,
      inspectionCode: energySafetyInspections.inspectionCode,
      modelProvider: energyAiVisionRuns.modelProvider,
      modelName: energyAiVisionRuns.modelName,
      modelVersion: energyAiVisionRuns.modelVersion,
      configVersion: energyAiVisionRuns.configVersion,
      inputHash: energyAiVisionRuns.inputHash,
      startedAt: energyAiVisionRuns.startedAt,
      completedAt: energyAiVisionRuns.completedAt,
      status: energyAiVisionRuns.status,
      rawOutput: energyAiVisionRuns.rawOutput,
      errorMessage: energyAiVisionRuns.errorMessage,
      matchedAssetId: energyAiVisionRuns.matchedAssetId,
      matchedAssetMethod: energyAiVisionRuns.matchedAssetMethod,
      matchedDistanceM: energyAiVisionRuns.matchedDistanceM,
      matchedAt: energyAiVisionRuns.matchedAt,
      createdBy: energyAiVisionRuns.createdBy,
      updatedAt: energyAiVisionRuns.updatedAt,
    }).from(energyAiVisionRuns)
      .innerJoin(energySafetyInspectionMedia, eq(energySafetyInspectionMedia.id, energyAiVisionRuns.mediaId))
      .innerJoin(energySafetyInspections, eq(energySafetyInspections.id, energySafetyInspectionMedia.inspectionId))
      .where(eq(energyAiVisionRuns.id, runId)).limit(1);
    if (!run) return NextResponse.json({ message: 'AI vision run not found.' }, { status: 404 });
    const detections = await db.select().from(energyAiVisionDetections).where(eq(energyAiVisionDetections.runId, runId)).orderBy(energyAiVisionDetections.createdAt);
    const reviews = await db.select().from(energyAiVisionReviews).where(sql`${energyAiVisionReviews.detectionId} IN (SELECT id FROM energy_ai_vision_detections WHERE run_id = ${runId}::uuid)`).orderBy(energyAiVisionReviews.reviewedAt);
    return NextResponse.json({ item: { ...run, matchedDistanceM: run.matchedDistanceM == null ? null : Number(run.matchedDistanceM) }, detections: detections.map((item) => ({ ...item, confidence: Number(item.confidence), riskScore: item.riskScore == null ? null : Number(item.riskScore) })), reviews });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Run ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load AI vision run.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { runId } = paramsSchema.parse(await context.params);
    const payload = aiVisionRunPatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) return NextResponse.json({ message: 'No fields to update.' }, { status: 400 });
    const [existing] = await db.select({ id: energyAiVisionRuns.id, rawOutput: energyAiVisionRuns.rawOutput }).from(energyAiVisionRuns).where(eq(energyAiVisionRuns.id, runId)).limit(1);
    if (!existing) return NextResponse.json({ message: 'AI vision run not found.' }, { status: 404 });
    const rawOutput = payload.note === undefined ? existing.rawOutput : { ...existing.rawOutput, _operatorNote: payload.note ?? null };
    const [updated] = await db.update(energyAiVisionRuns).set({ ...(payload.status !== undefined ? { status: payload.status } : {}), rawOutput, updatedAt: new Date() }).where(eq(energyAiVisionRuns.id, runId)).returning({ id: energyAiVisionRuns.id, status: energyAiVisionRuns.status });
    return NextResponse.json({ item: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'AI vision run is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not update AI vision run.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { runId } = paramsSchema.parse(await context.params);
    const [updated] = await db.update(energyAiVisionRuns).set({ status: 'CANCELLED', updatedAt: new Date() }).where(eq(energyAiVisionRuns.id, runId)).returning({ id: energyAiVisionRuns.id });
    if (!updated) return NextResponse.json({ message: 'AI vision run not found.' }, { status: 404 });
    return NextResponse.json({ deleted: true, cancelled: true, runId });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Run ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not cancel AI vision run.' }, { status: 400 });
  }
}
