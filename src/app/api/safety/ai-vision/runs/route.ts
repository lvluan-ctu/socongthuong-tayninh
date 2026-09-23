import { count, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { energyAiVisionRuns, energySafetyInspectionMedia, energySafetyInspections } from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const includeCancelled = params.get('includeCancelled') === 'true';
    const wantsPagination = params.has('page') || params.has('pageSize');
    const pagination = parsePagination(params);
    const where = includeCancelled ? undefined : sql`${energyAiVisionRuns.status} <> 'CANCELLED'`;
    const listQuery = db.select({
      id: energyAiVisionRuns.id,
      mediaId: energyAiVisionRuns.mediaId,
      mediaTitle: energySafetyInspectionMedia.title,
      inspectionId: energySafetyInspectionMedia.inspectionId,
      modelProvider: energyAiVisionRuns.modelProvider,
      modelName: energyAiVisionRuns.modelName,
      modelVersion: energyAiVisionRuns.modelVersion,
      configVersion: energyAiVisionRuns.configVersion,
      inputHash: energyAiVisionRuns.inputHash,
      startedAt: energyAiVisionRuns.startedAt,
      completedAt: energyAiVisionRuns.completedAt,
      status: energyAiVisionRuns.status,
      errorMessage: energyAiVisionRuns.errorMessage,
      matchedAssetId: energyAiVisionRuns.matchedAssetId,
      matchedAssetMethod: energyAiVisionRuns.matchedAssetMethod,
      matchedDistanceM: energyAiVisionRuns.matchedDistanceM,
      createdBy: energyAiVisionRuns.createdBy,
      detectionCount: sql<number>`(SELECT COUNT(*) FROM energy_ai_vision_detections d WHERE d.run_id = ${energyAiVisionRuns.id})`,
      pendingDetectionCount: sql<number>`(SELECT COUNT(*) FROM energy_ai_vision_detections d WHERE d.run_id = ${energyAiVisionRuns.id} AND d.review_status = 'PENDING_HUMAN_REVIEW')`,
    }).from(energyAiVisionRuns)
      .innerJoin(energySafetyInspectionMedia, eq(energySafetyInspectionMedia.id, energyAiVisionRuns.mediaId))
      .innerJoin(energySafetyInspections, eq(energySafetyInspections.id, energySafetyInspectionMedia.inspectionId))
      .where(where)
      .orderBy(desc(energyAiVisionRuns.startedAt));
    const rows = wantsPagination
      ? await listQuery.limit(pagination.pageSize).offset(pagination.offset)
      : await listQuery.limit(1000);
    const [totalRows, summaryRows] = wantsPagination
      ? await Promise.all([
        db.select({ value: count() }).from(energyAiVisionRuns).where(where),
        db.select({
          reviewed: sql<number>`COUNT(*) FILTER (WHERE ${energyAiVisionRuns.status} = 'REVIEWED')`,
          pendingDetections: sql<number>`COALESCE(SUM((SELECT COUNT(*) FROM energy_ai_vision_detections d WHERE d.run_id = ${energyAiVisionRuns.id} AND d.review_status = 'PENDING_HUMAN_REVIEW')), 0)`,
        }).from(energyAiVisionRuns).where(where),
      ])
      : [[], []];
    const items = rows.map((row) => ({ ...row, detectionCount: Number(row.detectionCount ?? 0), pendingDetectionCount: Number(row.pendingDetectionCount ?? 0), matchedDistanceM: row.matchedDistanceM == null ? null : Number(row.matchedDistanceM) }));
    const summary = summaryRows[0] ? { reviewed: Number(summaryRows[0].reviewed ?? 0), pendingDetections: Number(summaryRows[0].pendingDetections ?? 0) } : undefined;
    const runtime = { endpointConfigured: Boolean(process.env.AI_VISION_ENDPOINT?.trim()) };
    return wantsPagination
      ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0), { summary, runtime })
      : NextResponse.json({ items, runtime });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load AI vision runs.' }, { status: 500 });
  }
}
