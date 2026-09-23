import { createHash } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyOutagePlans, energyOutageSourceRecords } from '@/db/schema';
import { db } from '@/lib/db';
import { outageImportSchema } from '@/lib/safety-schemas';
import { rebuildOutageImpact } from '@/server/safety/outage-impact';
import { readOutagePlan } from '@/server/safety/outage-readers';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function validateRadius(payload: { centerLatitude?: number | null; centerLongitude?: number | null; affectedRadiusM?: number | null }) {
  const supplied = [payload.centerLatitude, payload.centerLongitude, payload.affectedRadiusM].filter((value) => value != null).length;
  if (supplied === 0 || supplied === 3) return null;
  return { message: 'Radius geometry requires latitude, longitude and radius together.', issues: [{ path: ['affectedRadiusM'], message: 'Provide all three radius fields or leave them empty.' }] };
}

function checksum(rawPayload: Record<string, unknown>, rawText: string | null | undefined, provided: string | null | undefined) {
  if (provided) return provided;
  return createHash('sha256').update(JSON.stringify(rawPayload)).update(rawText ?? '').digest('hex');
}

export async function POST(request: Request) {
  try {
    const payload = outageImportSchema.parse(await request.json());
    const startAt = parseDate(payload.startAt);
    const endAt = parseDate(payload.endAt);
    if (!startAt || !endAt || endAt <= startAt) {
      return NextResponse.json({ message: 'Outage end time must be after start time.', issues: [{ path: ['endAt'], message: 'End time must be after start time.' }] }, { status: 400 });
    }
    const radiusError = validateRadius(payload);
    if (radiusError) return NextResponse.json(radiusError, { status: 400 });
    const hasRadius = payload.centerLatitude != null && payload.centerLongitude != null && payload.affectedRadiusM != null;
    const sourceType = payload.sourceType === 'MANUAL' ? 'IMPORT' : payload.sourceType;
    const announcedAt = parseDate(payload.announcedAt ?? payload.sourceRecord.announcedAt);
    const sourceUrl = payload.sourceUrl ?? payload.sourceRecord.sourceUrl ?? null;
    const geometryJson = payload.affectedGeometry ? JSON.stringify(payload.affectedGeometry) : null;
    const impactMethod = payload.affectedGeometry ? 'EVN_PROVIDED_POLYGON' : hasRadius ? 'RADIUS_ESTIMATE' : 'NOT_CALCULATED';
    const recordChecksum = checksum(payload.sourceRecord.rawPayload, payload.sourceRecord.rawText, payload.sourceRecord.checksum);

    const result = await db.transaction(async (tx) => {
      const [existingSource] = await tx.select().from(energyOutageSourceRecords)
        .where(and(eq(energyOutageSourceRecords.provider, payload.sourceRecord.provider), eq(energyOutageSourceRecords.sourceRecordId, payload.sourceRecord.sourceRecordId)))
        .orderBy(desc(energyOutageSourceRecords.fetchedAt)).limit(1);
      let outageId = existingSource?.outageId ?? null;
      if (outageId) {
        const [existingOutage] = await tx.select({ id: energyOutagePlans.id }).from(energyOutagePlans).where(eq(energyOutagePlans.id, outageId)).limit(1);
        if (!existingOutage) outageId = null;
      }
      if (!outageId) {
        const [created] = await tx.insert(energyOutagePlans).values({
          code: payload.code,
          source: payload.source,
          sourceType,
          sourceRecordId: payload.sourceRecord.sourceRecordId,
          sourceUrl,
          announcedAt,
          title: payload.title,
          startAt,
          endAt,
          affectedCustomers: payload.affectedCustomers == null ? null : String(payload.affectedCustomers),
          reason: payload.reason ?? null,
          status: payload.status,
          impactMethod,
          affectedGeometry: null,
          updatedAt: new Date(),
        }).returning({ id: energyOutagePlans.id });
        if (!created) throw new Error('Outage plan was not created.');
        outageId = created.id;
      } else {
        await tx.update(energyOutagePlans).set({
          code: payload.code,
          source: payload.source,
          sourceType,
          sourceRecordId: payload.sourceRecord.sourceRecordId,
          sourceUrl,
          announcedAt,
          title: payload.title,
          startAt,
          endAt,
          affectedCustomers: payload.affectedCustomers == null ? null : String(payload.affectedCustomers),
          reason: payload.reason ?? null,
          status: payload.status,
          impactMethod,
          impactCalculatedAt: null,
          updatedAt: new Date(),
        }).where(eq(energyOutagePlans.id, outageId));
      }

      if (payload.affectedGeometry) {
        await tx.execute(sql`
          UPDATE energy_outage_plans
          SET affected_geometry = ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${geometryJson}::text), 4326)), 3))
          WHERE id = ${outageId}::uuid
        `);
      } else if (hasRadius) {
        await tx.execute(sql`
          UPDATE energy_outage_plans
          SET affected_geometry = ST_Buffer(
            ST_SetSRID(ST_Point(${payload.centerLongitude}, ${payload.centerLatitude}), 4326)::geography,
            ${payload.affectedRadiusM}
          )::geometry
          WHERE id = ${outageId}::uuid
        `);
      } else {
        await tx.execute(sql`UPDATE energy_outage_plans SET affected_geometry = NULL WHERE id = ${outageId}::uuid`);
      }

      const sourceValues = {
        outageId,
        provider: payload.sourceRecord.provider,
        sourceRecordId: payload.sourceRecord.sourceRecordId,
        sourceUrl,
        announcedAt,
        rawPayload: payload.sourceRecord.rawPayload,
        rawText: payload.sourceRecord.rawText ?? null,
        checksum: recordChecksum,
        parserVersion: payload.sourceRecord.parserVersion,
        mappingVersion: payload.sourceRecord.mappingVersion,
        status: 'NORMALIZED',
      };
      if (existingSource) {
        await tx.update(energyOutageSourceRecords).set(sourceValues).where(eq(energyOutageSourceRecords.id, existingSource.id));
      } else {
        await tx.insert(energyOutageSourceRecords).values(sourceValues);
      }
      return { outageId, sourceId: existingSource?.id ?? null };
    });

    const impact = await rebuildOutageImpact(result.outageId);
    return NextResponse.json({ item: await readOutagePlan(result.outageId), impact, idempotent: Boolean(result.sourceId) }, { status: result.sourceId ? 200 : 201 });
  } catch (error) {
    console.error('Outage import failed', error);
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'EVN outage import is invalid.', issues: error.issues }, { status: 400 });
    const message = error instanceof Error ? error.message : 'Could not import EVN outage.';
    return NextResponse.json({ message }, { status: message.includes('energy_outage_plans_code_uq') ? 409 : 400 });
  }
}
