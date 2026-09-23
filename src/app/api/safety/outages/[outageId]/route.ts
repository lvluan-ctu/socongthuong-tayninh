import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyOutageAffectedAreas, energyOutageAffectedAssets, energyOutageAffectedCustomers, energyOutagePlans } from '@/db/schema';
import { db } from '@/lib/db';
import { outagePlanPatchSchema } from '@/lib/safety-schemas';
import { readOutagePlan } from '@/server/safety/outage-readers';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ outageId: string }> };
const paramsSchema = z.object({ outageId: z.string().uuid() });

function parseDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function validateRadius(payload: { centerLatitude?: number | null; centerLongitude?: number | null; affectedRadiusM?: number | null }) {
  const supplied = [payload.centerLatitude, payload.centerLongitude, payload.affectedRadiusM].filter((value) => value != null).length;
  if (supplied === 0 || supplied === 3) return null;
  return { message: 'Radius geometry requires latitude, longitude and radius together.', issues: [{ path: ['affectedRadiusM'], message: 'Provide all three radius fields or leave them empty.' }] };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { outageId } = paramsSchema.parse(await context.params);
    const item = await readOutagePlan(outageId);
    if (!item) return NextResponse.json({ message: 'Outage plan not found.' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Outage ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load outage plan.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { outageId } = paramsSchema.parse(await context.params);
    const payload = outagePlanPatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) return NextResponse.json({ message: 'No fields to update.' }, { status: 400 });
    const [existing] = await db.select().from(energyOutagePlans).where(eq(energyOutagePlans.id, outageId)).limit(1);
    if (!existing) return NextResponse.json({ message: 'Outage plan not found.' }, { status: 404 });
    if (payload.sourceType && payload.sourceType !== 'MANUAL' && !(payload.sourceRecordId ?? existing.sourceRecordId)) {
      return NextResponse.json({ message: 'A non-manual outage must reference an EVN source record.', issues: [{ path: ['sourceRecordId'], message: 'Source record ID is required.' }] }, { status: 400 });
    }
    const radiusError = validateRadius(payload);
    if (radiusError) return NextResponse.json(radiusError, { status: 400 });

    const startAt = parseDate(payload.startAt ?? existing.startAt);
    const endAt = parseDate(payload.endAt ?? existing.endAt);
    if (!startAt || !endAt || endAt <= startAt) {
      return NextResponse.json({ message: 'Outage end time must be after start time.', issues: [{ path: ['endAt'], message: 'End time must be after start time.' }] }, { status: 400 });
    }
    const geometryProvided = Object.prototype.hasOwnProperty.call(payload, 'affectedGeometry');
    const radiusProvided = ['centerLatitude', 'centerLongitude', 'affectedRadiusM'].some((key) => Object.prototype.hasOwnProperty.call(payload, key));
    const hasRadius = payload.centerLatitude != null && payload.centerLongitude != null && payload.affectedRadiusM != null;
    const impactInvalidated = geometryProvided || radiusProvided || payload.startAt !== undefined || payload.endAt !== undefined || payload.sourceType !== undefined || payload.sourceRecordId !== undefined;
    const geometryJson = geometryProvided && payload.affectedGeometry ? JSON.stringify(payload.affectedGeometry) : null;
    const announcedAt = Object.prototype.hasOwnProperty.call(payload, 'announcedAt') ? parseDate(payload.announcedAt) : existing.announcedAt;

    await db.transaction(async (tx) => {
      if (impactInvalidated) {
        await tx.delete(energyOutageAffectedCustomers).where(eq(energyOutageAffectedCustomers.outageId, outageId));
        await tx.delete(energyOutageAffectedAssets).where(eq(energyOutageAffectedAssets.outageId, outageId));
        await tx.delete(energyOutageAffectedAreas).where(eq(energyOutageAffectedAreas.outageId, outageId));
      }
      await tx.update(energyOutagePlans).set({
        ...(payload.code !== undefined ? { code: payload.code } : {}),
        ...(payload.source !== undefined ? { source: payload.source } : {}),
        ...(payload.sourceType !== undefined ? { sourceType: payload.sourceType } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'sourceRecordId') ? { sourceRecordId: payload.sourceRecordId ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'sourceUrl') ? { sourceUrl: payload.sourceUrl ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'announcedAt') ? { announcedAt } : {}),
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.startAt !== undefined ? { startAt } : {}),
        ...(payload.endAt !== undefined ? { endAt } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'affectedCustomers') ? { affectedCustomers: payload.affectedCustomers == null ? null : String(payload.affectedCustomers) } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'reason') ? { reason: payload.reason ?? null } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(impactInvalidated ? { impactMethod: hasRadius ? 'RADIUS_ESTIMATE' : geometryProvided ? (payload.sourceType ?? existing.sourceType) === 'MANUAL' ? 'MANUAL_POLYGON' : 'EVN_PROVIDED_POLYGON' : 'NOT_CALCULATED', impactCalculatedAt: null, affectedCustomers: geometryProvided || radiusProvided ? null : undefined } : {}),
        updatedAt: new Date(),
      }).where(eq(energyOutagePlans.id, outageId));
      if (geometryProvided) {
        await tx.execute(sql`
          UPDATE energy_outage_plans
          SET affected_geometry = CASE WHEN ${geometryJson}::text IS NULL THEN NULL ELSE ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${geometryJson}::text), 4326)), 3)) END
          WHERE id = ${outageId}::uuid
        `);
      } else if (radiusProvided && hasRadius) {
        await tx.execute(sql`
          UPDATE energy_outage_plans
          SET affected_geometry = ST_Buffer(
            ST_SetSRID(ST_Point(${payload.centerLongitude}, ${payload.centerLatitude}), 4326)::geography,
            ${payload.affectedRadiusM}
          )::geometry
          WHERE id = ${outageId}::uuid
        `);
      } else if (impactInvalidated) {
        await tx.execute(sql`UPDATE energy_outage_plans SET affected_geometry = NULL WHERE id = ${outageId}::uuid`);
      }
    });
    return NextResponse.json({ item: await readOutagePlan(outageId) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Outage plan is invalid.', issues: error.issues }, { status: 400 });
    const message = error instanceof Error ? error.message : 'Could not update outage plan.';
    return NextResponse.json({ message }, { status: message.includes('energy_outage_plans_code_uq') ? 409 : 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { outageId } = paramsSchema.parse(await context.params);
    const [updated] = await db.update(energyOutagePlans).set({ status: 'ARCHIVED', updatedAt: new Date() })
      .where(eq(energyOutagePlans.id, outageId)).returning({ id: energyOutagePlans.id });
    if (!updated) return NextResponse.json({ message: 'Outage plan not found.' }, { status: 404 });
    return NextResponse.json({ deleted: true, archived: true, outageId });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Outage ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not archive outage plan.' }, { status: 400 });
  }
}
