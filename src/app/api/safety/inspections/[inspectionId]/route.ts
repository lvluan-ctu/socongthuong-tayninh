import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyAssets, energyProtectionCorridors, energySafetyInspections } from '@/db/schema';
import { db } from '@/lib/db';
import { safetyInspectionPatchSchema } from '@/lib/safety-schemas';
import { readInspection } from '@/server/safety/inspection-readers';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ inspectionId: string }> };
const paramsSchema = z.object({ inspectionId: z.string().uuid() });

function parseDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseGeoJson(value: unknown) {
  if (typeof value !== 'string') return value ?? null;
  try { return JSON.parse(value) as unknown; } catch { return null; }
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { inspectionId } = paramsSchema.parse(await context.params);
    const item = await readInspection(inspectionId);
    if (!item) return NextResponse.json({ message: 'Inspection not found.' }, { status: 404 });
    const [media, violations] = await Promise.all([
      db.execute(sql`
        SELECT m.id, m.inspection_id AS "inspectionId", m.media_type AS "mediaType", m.title, m.file_ref AS "fileRef",
               m.source_url AS "sourceUrl", m.checksum, m.status, m.captured_at AS "capturedAt", m.bearing_deg AS "bearingDeg", m.asset_hint AS "assetHint", m.notes, m.metadata,
               CASE WHEN m.location IS NULL THEN NULL ELSE ST_AsGeoJSON(m.location::geometry) END AS geometry
        FROM energy_safety_inspection_media m
        WHERE m.inspection_id = ${inspectionId}::uuid
        ORDER BY m.created_at DESC
      `),
      db.execute(sql`
        SELECT v.id, v.code, v.violation_type AS "violationType", v.severity, v.status, v.detected_at AS "detectedAt",
               v.human_review_required AS "humanReviewRequired", v.reviewed_by AS "reviewedBy", v.review_decision AS "reviewDecision",
               v.verified_by AS "verifiedBy", v.verified_at AS "verifiedAt", v.closed_at AS "closedAt", v.ai_run_id AS "aiRunId",
               a.code AS "assetCode", a.name AS "assetName", iv.detection_ref AS "detectionRef"
        FROM energy_safety_inspection_violations iv
        JOIN energy_corridor_violations v ON v.id = iv.violation_id
        JOIN energy_protection_corridors c ON c.id = v.corridor_id
        JOIN energy_assets a ON a.id = c.asset_id
        WHERE iv.inspection_id = ${inspectionId}::uuid
        ORDER BY v.detected_at DESC
      `),
    ]);
    return NextResponse.json({ item, media: (media.rows as Array<Record<string, unknown>>).map((row) => ({ ...row, geometry: parseGeoJson(row.geometry) })), violations: violations.rows });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Inspection ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load inspection.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { inspectionId } = paramsSchema.parse(await context.params);
    const payload = safetyInspectionPatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) return NextResponse.json({ message: 'No fields to update.' }, { status: 400 });
    const [existing] = await db.select().from(energySafetyInspections).where(eq(energySafetyInspections.id, inspectionId)).limit(1);
    if (!existing) return NextResponse.json({ message: 'Inspection not found.' }, { status: 404 });
    const startedAt = parseDate(payload.startedAt ?? existing.startedAt);
    const completedAt = Object.prototype.hasOwnProperty.call(payload, 'completedAt') ? parseDate(payload.completedAt) : existing.completedAt;
    if (!startedAt || (payload.completedAt && !completedAt) || (completedAt && completedAt < startedAt)) {
      return NextResponse.json({ message: 'Inspection time range is invalid.', issues: [{ path: ['completedAt'], message: 'Completion must be after start.' }] }, { status: 400 });
    }
    if (payload.corridorId) {
      const [corridor] = await db.select({ id: energyProtectionCorridors.id }).from(energyProtectionCorridors).where(eq(energyProtectionCorridors.id, payload.corridorId)).limit(1);
      if (!corridor) return NextResponse.json({ message: 'Corridor not found.', issues: [{ path: ['corridorId'], message: 'Choose an existing corridor.' }] }, { status: 404 });
    }
    if (payload.assetId) {
      const [asset] = await db.select({ id: energyAssets.id }).from(energyAssets).where(eq(energyAssets.id, payload.assetId)).limit(1);
      if (!asset) return NextResponse.json({ message: 'Grid asset not found.', issues: [{ path: ['assetId'], message: 'Choose an existing asset.' }] }, { status: 404 });
    }
    const geometryProvided = Object.prototype.hasOwnProperty.call(payload, 'geometry');
    await db.transaction(async (tx) => {
      await tx.update(energySafetyInspections).set({
        ...(payload.inspectionCode !== undefined ? { inspectionCode: payload.inspectionCode } : {}),
        ...(payload.inspectionType !== undefined ? { inspectionType: payload.inspectionType } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'corridorId') ? { corridorId: payload.corridorId ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'assetId') ? { assetId: payload.assetId ?? null } : {}),
        ...(payload.inspector !== undefined ? { inspector: payload.inspector } : {}),
        ...(payload.startedAt !== undefined ? { startedAt } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'completedAt') ? { completedAt } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(payload.source !== undefined ? { source: payload.source } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'sourceRef') ? { sourceRef: payload.sourceRef ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'notes') ? { notes: payload.notes ?? null } : {}),
        updatedAt: new Date(),
      }).where(eq(energySafetyInspections.id, inspectionId));
      if (geometryProvided) {
        await tx.execute(sql`UPDATE energy_safety_inspections SET geometry = CASE WHEN ${payload.geometry ? JSON.stringify(payload.geometry) : null}::text IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON(${payload.geometry ? JSON.stringify(payload.geometry) : null}::text), 4326) END, updated_at = CURRENT_TIMESTAMP WHERE id = ${inspectionId}::uuid`);
      }
    });
    return NextResponse.json({ item: await readInspection(inspectionId) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Inspection is invalid.', issues: error.issues }, { status: 400 });
    const message = error instanceof Error ? error.message : 'Could not update inspection.';
    return NextResponse.json({ message }, { status: message.includes('energy_safety_inspections_code_uq') ? 409 : 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { inspectionId } = paramsSchema.parse(await context.params);
    const [updated] = await db.update(energySafetyInspections).set({ status: 'ARCHIVED', updatedAt: new Date() }).where(eq(energySafetyInspections.id, inspectionId)).returning({ id: energySafetyInspections.id });
    if (!updated) return NextResponse.json({ message: 'Inspection not found.' }, { status: 404 });
    return NextResponse.json({ deleted: true, archived: true, inspectionId });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Inspection ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not archive inspection.' }, { status: 400 });
  }
}
