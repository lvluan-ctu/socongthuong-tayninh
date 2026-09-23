import { count, desc, eq, not, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  energyAssets,
  energyProtectionCorridors,
  energySafetyInspections,
} from '@/db/schema';
import { db } from '@/lib/db';
import { safetyInspectionSchema } from '@/lib/safety-schemas';
import { paginatedResponse, parsePagination } from '@/lib/pagination';
import { readInspection, serializeInspection } from '@/server/safety/inspection-readers';

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
    const where = includeArchived ? undefined : not(eq(energySafetyInspections.status, 'ARCHIVED'));
    const listQuery = db.select({
      id: energySafetyInspections.id,
      inspectionCode: energySafetyInspections.inspectionCode,
      inspectionType: energySafetyInspections.inspectionType,
      corridorId: energySafetyInspections.corridorId,
      corridorCode: energyAssets.code,
      corridorName: energyAssets.name,
      assetId: energySafetyInspections.assetId,
      inspector: energySafetyInspections.inspector,
      startedAt: energySafetyInspections.startedAt,
      completedAt: energySafetyInspections.completedAt,
      status: energySafetyInspections.status,
      source: energySafetyInspections.source,
      sourceRef: energySafetyInspections.sourceRef,
      notes: energySafetyInspections.notes,
      createdAt: energySafetyInspections.createdAt,
      updatedAt: energySafetyInspections.updatedAt,
      geometry: sql<string | null>`CASE WHEN ${energySafetyInspections.geometry} IS NULL THEN NULL ELSE ST_AsGeoJSON(${energySafetyInspections.geometry}) END`,
      mediaCount: sql<number>`(SELECT COUNT(*) FROM energy_safety_inspection_media m WHERE m.inspection_id = ${energySafetyInspections.id} AND m.status <> 'ARCHIVED')`,
      violationCount: sql<number>`(SELECT COUNT(*) FROM energy_safety_inspection_violations iv WHERE iv.inspection_id = ${energySafetyInspections.id})`,
    }).from(energySafetyInspections)
      .leftJoin(energyProtectionCorridors, eq(energyProtectionCorridors.id, energySafetyInspections.corridorId))
      .leftJoin(energyAssets, eq(energyAssets.id, energyProtectionCorridors.assetId))
      .where(where)
      .orderBy(desc(energySafetyInspections.startedAt));
    const rows = wantsPagination
      ? await listQuery.limit(pagination.pageSize).offset(pagination.offset)
      : await listQuery.limit(1000);
    const totalRows = wantsPagination
      ? await db.select({ value: count() }).from(energySafetyInspections).where(where)
      : [];
    const items = rows.map((row) => serializeInspection(row as Record<string, unknown>));
    return wantsPagination
      ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0))
      : NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load inspections.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = safetyInspectionSchema.parse(await request.json());
    const startedAt = parseDate(payload.startedAt);
    const completedAt = parseDate(payload.completedAt);
    if (!startedAt) return NextResponse.json({ message: 'Inspection start time is invalid.', issues: [{ path: ['startedAt'], message: 'Invalid date.' }] }, { status: 400 });
    if (payload.completedAt && !completedAt) return NextResponse.json({ message: 'Inspection completion time is invalid.', issues: [{ path: ['completedAt'], message: 'Invalid date.' }] }, { status: 400 });
    if (completedAt && completedAt < startedAt) return NextResponse.json({ message: 'Completion time must be after start time.', issues: [{ path: ['completedAt'], message: 'Invalid inspection interval.' }] }, { status: 400 });
    if (payload.corridorId) {
      const [corridor] = await db.select({ id: energyProtectionCorridors.id }).from(energyProtectionCorridors).where(eq(energyProtectionCorridors.id, payload.corridorId)).limit(1);
      if (!corridor) return NextResponse.json({ message: 'Corridor not found.', issues: [{ path: ['corridorId'], message: 'Choose an existing corridor.' }] }, { status: 404 });
    }
    if (payload.assetId) {
      const [asset] = await db.select({ id: energyAssets.id }).from(energyAssets).where(eq(energyAssets.id, payload.assetId)).limit(1);
      if (!asset) return NextResponse.json({ message: 'Grid asset not found.', issues: [{ path: ['assetId'], message: 'Choose an existing grid asset.' }] }, { status: 404 });
    }
    const [created] = await db.insert(energySafetyInspections).values({
      inspectionCode: payload.inspectionCode,
      inspectionType: payload.inspectionType,
      corridorId: payload.corridorId ?? null,
      assetId: payload.assetId ?? null,
      inspector: payload.inspector,
      startedAt,
      completedAt,
      status: payload.status,
      source: payload.source,
      sourceRef: payload.sourceRef ?? null,
      geometry: null,
      notes: payload.notes ?? null,
      updatedAt: new Date(),
    }).returning({ id: energySafetyInspections.id });
    if (!created) throw new Error('Inspection was not created.');
    if (payload.geometry) {
      await db.execute(sql`UPDATE energy_safety_inspections SET geometry = ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(payload.geometry)}::text), 4326), updated_at = CURRENT_TIMESTAMP WHERE id = ${created.id}::uuid`);
    }
    return NextResponse.json({ item: await readInspection(created.id) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Inspection is invalid.', issues: error.issues }, { status: 400 });
    const message = error instanceof Error ? error.message : 'Could not create inspection.';
    return NextResponse.json({ message }, { status: message.includes('energy_safety_inspections_code_uq') ? 409 : 400 });
  }
}
