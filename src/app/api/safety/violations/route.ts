import { count, desc, eq, not } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  energyAssets,
  energyCorridorViolations,
  energyProtectionCorridors,
  energySafetyInspectionViolations,
  energySafetyInspections,
  energyViolationStatusHistory,
} from '@/db/schema';
import { db } from '@/lib/db';
import { safetyViolationSchema } from '@/lib/safety-schemas';
import { paginatedResponse, parsePagination } from '@/lib/pagination';
import { readViolation } from '@/server/safety/violation-readers';

export const dynamic = 'force-dynamic';

function parseDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}


export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const includeArchived = params.get('includeArchived') === 'true';
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const where = includeArchived ? undefined : not(eq(energyCorridorViolations.status, 'ARCHIVED'));
    const listQuery = db.select({
      id: energyCorridorViolations.id,
      corridorId: energyCorridorViolations.corridorId,
      corridorAssetId: energyProtectionCorridors.assetId,
      assetCode: energyAssets.code,
      assetName: energyAssets.name,
      code: energyCorridorViolations.code,
      violationType: energyCorridorViolations.violationType,
      severity: energyCorridorViolations.severity,
      detectedAt: energyCorridorViolations.detectedAt,
      status: energyCorridorViolations.status,
      distanceM: energyCorridorViolations.distanceM,
      evidence: energyCorridorViolations.evidence,
      aiRunId: energyCorridorViolations.aiRunId,
      humanReviewRequired: energyCorridorViolations.humanReviewRequired,
      reviewDecision: energyCorridorViolations.reviewDecision,
      reviewedBy: energyCorridorViolations.reviewedBy,
      reviewedAt: energyCorridorViolations.reviewedAt,
      verifiedBy: energyCorridorViolations.verifiedBy,
      verifiedAt: energyCorridorViolations.verifiedAt,
      closedAt: energyCorridorViolations.closedAt,
      updatedAt: energyCorridorViolations.updatedAt,
    }).from(energyCorridorViolations)
      .innerJoin(energyProtectionCorridors, eq(energyProtectionCorridors.id, energyCorridorViolations.corridorId))
      .innerJoin(energyAssets, eq(energyAssets.id, energyProtectionCorridors.assetId))
      .where(where)
      .orderBy(desc(energyCorridorViolations.detectedAt));
    const rows = wantsPagination
      ? await listQuery.limit(pagination.pageSize).offset(pagination.offset)
      : await listQuery.limit(1000);
    const totalRows = wantsPagination
      ? await db.select({ value: count() }).from(energyCorridorViolations).where(where)
      : [];
    const items = rows.map((row) => ({ ...row, distanceM: row.distanceM == null ? null : Number(row.distanceM) }));
    return wantsPagination ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0)) : NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load corridor violations.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = safetyViolationSchema.parse(await request.json());
    const [corridor] = await db.select({ id: energyProtectionCorridors.id }).from(energyProtectionCorridors).where(eq(energyProtectionCorridors.id, payload.corridorId)).limit(1);
    if (!corridor) return NextResponse.json({ message: 'Corridor not found.', issues: [{ path: ['corridorId'], message: 'Choose an existing corridor.' }] }, { status: 404 });
    if (payload.inspectionId) {
      const [inspection] = await db.select({ id: energySafetyInspections.id }).from(energySafetyInspections).where(eq(energySafetyInspections.id, payload.inspectionId)).limit(1);
      if (!inspection) return NextResponse.json({ message: 'Inspection not found.', issues: [{ path: ['inspectionId'], message: 'Choose an existing inspection.' }] }, { status: 404 });
    }
    const detectedAt = parseDate(payload.detectedAt);
    if (!detectedAt) return NextResponse.json({ message: 'Detected time is invalid.', issues: [{ path: ['detectedAt'], message: 'Invalid date.' }] }, { status: 400 });
    if (payload.source === 'AI_VISION' && !['DETECTED', 'PENDING_REVIEW'].includes(payload.status)) {
      return NextResponse.json({ message: 'AI detections must remain pending human review.', issues: [{ path: ['status'], message: 'Use DETECTED or PENDING_REVIEW until a human reviews it.' }] }, { status: 400 });
    }
    const status = payload.source === 'AI_VISION' ? 'PENDING_REVIEW' : payload.status;
    const [created] = await db.transaction(async (tx) => {
      const [item] = await tx.insert(energyCorridorViolations).values({
        corridorId: payload.corridorId,
        code: payload.code,
        violationType: payload.violationType,
        severity: payload.severity,
        location: payload.latitude != null && payload.longitude != null ? `SRID=4326;POINT(${payload.longitude} ${payload.latitude})` : null,
        detectedAt,
        status,
        distanceM: payload.distanceM == null ? null : String(payload.distanceM),
        evidence: { refs: payload.evidenceRefs, source: payload.source, ai: payload.source === 'AI_VISION' ? { label: payload.aiLabel ?? null, confidencePct: payload.aiConfidencePct ?? null } : null, notes: payload.notes ?? null },
        aiRunId: null,
        humanReviewRequired: payload.humanReviewRequired || payload.source === 'AI_VISION',
        reviewDecision: null,
        updatedAt: new Date(),
      }).returning();
      if (!item) throw new Error('Violation was not created.');
      await tx.insert(energyViolationStatusHistory).values({ violationId: item.id, fromStatus: null, toStatus: status, changedBy: null, reason: 'VIOLATION_CREATED' });
      if (payload.inspectionId) await tx.insert(energySafetyInspectionViolations).values({ inspectionId: payload.inspectionId, violationId: item.id, detectionRef: null });
      return [item];
    });
    return NextResponse.json({ item: await readViolation(created.id) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Violation is invalid.', issues: error.issues }, { status: 400 });
    const message = error instanceof Error ? error.message : 'Could not create violation.';
    return NextResponse.json({ message }, { status: message.includes('energy_corridor_violations_code_uq') ? 409 : 400 });
  }
}
