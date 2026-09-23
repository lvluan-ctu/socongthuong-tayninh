import { count, desc, eq, inArray, not, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyOutagePlans, energyOutageSourceRecords } from '@/db/schema';
import { db } from '@/lib/db';
import { outagePlanSchema } from '@/lib/safety-schemas';
import { paginatedResponse, parsePagination } from '@/lib/pagination';
import { readOutagePlan, serializeOutagePlan } from '@/server/safety/outage-readers';

export const dynamic = 'force-dynamic';

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}


function validateTimeRange(startAt: Date | null, endAt: Date | null) {
  if (!startAt || !endAt) {
    return { message: 'Outage start and end times must be valid.', issues: [{ path: ['startAt'], message: 'Invalid outage time.' }] };
  }
  if (endAt <= startAt) {
    return { message: 'Outage end time must be after start time.', issues: [{ path: ['endAt'], message: 'End time must be after start time.' }] };
  }
  return null;
}

function validateRadius(payload: { centerLatitude?: number | null; centerLongitude?: number | null; affectedRadiusM?: number | null }) {
  const supplied = [payload.centerLatitude, payload.centerLongitude, payload.affectedRadiusM].filter((value) => value != null).length;
  if (supplied === 0 || supplied === 3) return null;
  return {
    message: 'Radius geometry requires latitude, longitude and radius together.',
    issues: [{ path: ['affectedRadiusM'], message: 'Provide all three radius fields or leave them empty.' }],
  };
}

function geometryMethod(sourceType: string, hasGeometry: boolean, hasRadius: boolean) {
  if (hasGeometry) return sourceType === 'MANUAL' ? 'MANUAL_POLYGON' : 'EVN_PROVIDED_POLYGON';
  if (hasRadius) return 'RADIUS_ESTIMATE';
  return 'NOT_CALCULATED';
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const includeArchived = params.get('includeArchived') === 'true';
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const where = includeArchived ? undefined : not(eq(energyOutagePlans.status, 'ARCHIVED'));
    const listQuery = db.select({
      id: energyOutagePlans.id,
      code: energyOutagePlans.code,
      source: energyOutagePlans.source,
      sourceType: energyOutagePlans.sourceType,
      sourceRecordId: energyOutagePlans.sourceRecordId,
      sourceUrl: energyOutagePlans.sourceUrl,
      announcedAt: energyOutagePlans.announcedAt,
      title: energyOutagePlans.title,
      startAt: energyOutagePlans.startAt,
      endAt: energyOutagePlans.endAt,
      affectedCustomers: energyOutagePlans.affectedCustomers,
      reason: energyOutagePlans.reason,
      status: energyOutagePlans.status,
      impactMethod: energyOutagePlans.impactMethod,
      impactCalculatedAt: energyOutagePlans.impactCalculatedAt,
      createdAt: energyOutagePlans.createdAt,
      updatedAt: energyOutagePlans.updatedAt,
      affectedGeometry: sql<string | null>`CASE WHEN ${energyOutagePlans.affectedGeometry} IS NULL THEN NULL ELSE ST_AsGeoJSON(${energyOutagePlans.affectedGeometry}) END`,
      }).from(energyOutagePlans)
      .where(where)
      .orderBy(desc(energyOutagePlans.startAt));
    const rows = wantsPagination
      ? await listQuery.limit(pagination.pageSize).offset(pagination.offset)
      : await listQuery.limit(1000);
    const totalRows = wantsPagination
      ? await db.select({ value: count() }).from(energyOutagePlans).where(where)
      : [];
    const summaryRows = wantsPagination
      ? await db.select({
        topology: sql<number>`COUNT(*) FILTER (WHERE ${energyOutagePlans.impactMethod} = 'TOPOLOGY_IMPACT_V1')`,
        withRawSource: sql<number>`COUNT(*) FILTER (WHERE ${energyOutagePlans.sourceRecordId} IS NOT NULL)`,
        upcoming: sql<number>`COUNT(*) FILTER (WHERE ${energyOutagePlans.endAt} > NOW() AND ${energyOutagePlans.status} NOT IN ('COMPLETED', 'CANCELLED'))`,
      }).from(energyOutagePlans).where(where)
      : [];
    const ids = rows.map((row) => row.id);
    const counts = ids.length
      ? await db.select({ outageId: energyOutageSourceRecords.outageId, count: sql<number>`COUNT(*)` })
        .from(energyOutageSourceRecords).where(inArray(energyOutageSourceRecords.outageId, ids)).groupBy(energyOutageSourceRecords.outageId)
      : [];
    const countByOutage = new Map(counts.map((row) => [row.outageId, Number(row.count)]));
    const items = rows.map((row) => serializeOutagePlan({ ...(row as Record<string, unknown>), sourceRecordCount: countByOutage.get(row.id) ?? 0 }));
    const summary = summaryRows[0]
      ? { topology: Number(summaryRows[0].topology ?? 0), withRawSource: Number(summaryRows[0].withRawSource ?? 0), upcoming: Number(summaryRows[0].upcoming ?? 0) }
      : undefined;
    return wantsPagination ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0), { summary }) : NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load outage plans.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = outagePlanSchema.parse(await request.json());
    if (payload.sourceType !== 'MANUAL' && !payload.sourceRecordId) {
      return NextResponse.json({ message: 'A non-manual outage must reference an EVN source record.', issues: [{ path: ['sourceRecordId'], message: 'Source record ID is required.' }] }, { status: 400 });
    }
    const startAt = parseDate(payload.startAt);
    const endAt = parseDate(payload.endAt);
    const rangeError = validateTimeRange(startAt, endAt);
    if (rangeError) return NextResponse.json(rangeError, { status: 400 });
    const radiusError = validateRadius(payload);
    if (radiusError) return NextResponse.json(radiusError, { status: 400 });
    const hasRadius = payload.centerLatitude != null && payload.centerLongitude != null && payload.affectedRadiusM != null;
    const hasGeometry = payload.affectedGeometry != null;
    const method = geometryMethod(payload.sourceType, hasGeometry, hasRadius);
    const geometryJson = hasGeometry ? JSON.stringify(payload.affectedGeometry) : null;
    const announcedAt = parseDate(payload.announcedAt);

    const created = await db.transaction(async (tx) => {
      const [item] = await tx.insert(energyOutagePlans).values({
        code: payload.code,
        source: payload.source,
        sourceType: payload.sourceType,
        sourceRecordId: payload.sourceRecordId ?? null,
        sourceUrl: payload.sourceUrl ?? null,
        announcedAt,
        title: payload.title,
        startAt: startAt as Date,
        endAt: endAt as Date,
        affectedCustomers: payload.affectedCustomers == null ? null : String(payload.affectedCustomers),
        reason: payload.reason ?? null,
        status: payload.status,
        impactMethod: method,
        affectedGeometry: null,
        impactCalculatedAt: null,
        updatedAt: new Date(),
      }).returning({ id: energyOutagePlans.id });
      if (!item) throw new Error('Outage plan was not created.');
      if (hasGeometry) {
        await tx.execute(sql`
          UPDATE energy_outage_plans
          SET affected_geometry = ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${geometryJson}::text), 4326)), 3))
          WHERE id = ${item.id}::uuid
        `);
      } else if (hasRadius) {
        await tx.execute(sql`
          UPDATE energy_outage_plans
          SET affected_geometry = ST_Buffer(
            ST_SetSRID(ST_Point(${payload.centerLongitude}, ${payload.centerLatitude}), 4326)::geography,
            ${payload.affectedRadiusM}
          )::geometry
          WHERE id = ${item.id}::uuid
        `);
      }
      return item;
    });
    const item = await readOutagePlan(created.id);
    return NextResponse.json({ item, warnings: hasRadius ? ['Radius geometry is only a fallback estimate; run topology impact after importing EVN asset/customer references.'] : [] }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Outage plan is invalid.', issues: error.issues }, { status: 400 });
    const message = error instanceof Error ? error.message : 'Could not create outage plan.';
    return NextResponse.json({ message }, { status: message.includes('energy_outage_plans_code_uq') ? 409 : 400 });
  }
}
