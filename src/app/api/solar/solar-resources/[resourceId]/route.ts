import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { solarResourceZonePatchSchema } from '@/lib/solar-schemas';
import { db } from '@/lib/db';
import { parseDate } from '@/server/solar/geo';
import { readSolarResourceZone } from '@/lib/solar-resource-api';

export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ resourceId: z.string().uuid() });
const patchSchema = solarResourceZonePatchSchema;

export async function GET(_request: Request, context: { params: Promise<{ resourceId: string }> }) {
  try {
    const params = paramsSchema.parse(await context.params);
    const item = await readSolarResourceZone(params.resourceId);
    if (!item) return NextResponse.json({ message: 'Không tìm thấy vùng tài nguyên bức xạ.' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'ID vùng tài nguyên không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải vùng tài nguyên.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ resourceId: string }> }) {
  try {
    const params = paramsSchema.parse(await context.params);
    const payload = patchSchema.parse(await request.json());
    const existing = await db.execute(sql`SELECT id FROM energy_solar_resource_zones WHERE id = ${params.resourceId}::uuid LIMIT 1`);
    if (!existing.rows.length) return NextResponse.json({ message: 'Không tìm thấy vùng tài nguyên bức xạ.' }, { status: 404 });

    const updates = [sql`updated_at = now()`];
    if (payload.code !== undefined) updates.push(sql`code = ${payload.code}`);
    if (payload.name !== undefined) updates.push(sql`name = ${payload.name}`);
    if (Object.prototype.hasOwnProperty.call(payload, 'boundary')) {
      const boundaryJson = payload.boundary ? JSON.stringify(payload.boundary) : null;
      updates.push(sql`boundary = CASE WHEN ${boundaryJson}::text IS NULL THEN NULL ELSE ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${boundaryJson}), 4326)), 3)) END`);
    }
    if (payload.annualGhiKwhM2 !== undefined) updates.push(sql`annual_ghi_kwh_m2 = ${String(payload.annualGhiKwhM2)}`);
    if (payload.annualDniKwhM2 !== undefined) updates.push(sql`annual_dni_kwh_m2 = ${payload.annualDniKwhM2 == null ? null : String(payload.annualDniKwhM2)}`);
    if (payload.annualDhiKwhM2 !== undefined) updates.push(sql`annual_dhi_kwh_m2 = ${payload.annualDhiKwhM2 == null ? null : String(payload.annualDhiKwhM2)}`);
    if (payload.referenceTiltDeg !== undefined) updates.push(sql`reference_tilt_deg = ${payload.referenceTiltDeg == null ? null : String(payload.referenceTiltDeg)}`);
    if (payload.referenceAzimuthDeg !== undefined) updates.push(sql`reference_azimuth_deg = ${payload.referenceAzimuthDeg == null ? null : String(payload.referenceAzimuthDeg)}`);
    if (payload.source !== undefined) updates.push(sql`source = ${payload.source}`);
    if (payload.sourceVersion !== undefined) updates.push(sql`source_version = ${payload.sourceVersion}`);
    if (payload.sourceRef !== undefined) updates.push(sql`source_ref = ${payload.sourceRef?.trim() || null}`);
    if (payload.measuredFrom !== undefined) updates.push(sql`measured_from = ${parseDate(payload.measuredFrom)}`);
    if (payload.measuredTo !== undefined) updates.push(sql`measured_to = ${parseDate(payload.measuredTo)}`);
    if (payload.quality !== undefined) updates.push(sql`quality = ${payload.quality}`);
    if (payload.confidence !== undefined) updates.push(sql`confidence = ${payload.confidence == null ? null : String(payload.confidence)}`);
    if (payload.status !== undefined) updates.push(sql`status = ${payload.status}`);

    await db.execute(sql`UPDATE energy_solar_resource_zones SET ${sql.join(updates, sql`, `)} WHERE id = ${params.resourceId}::uuid`);
    return NextResponse.json({ item: await readSolarResourceZone(params.resourceId) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin vùng tài nguyên không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật vùng tài nguyên.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ resourceId: string }> }) {
  try {
    const params = paramsSchema.parse(await context.params);
    const result = await db.execute(sql`
      UPDATE energy_solar_resource_zones
      SET status = 'ARCHIVED', updated_at = now()
      WHERE id = ${params.resourceId}::uuid AND status <> 'ARCHIVED'
      RETURNING id
    `);
    if (!result.rows.length) return NextResponse.json({ message: 'Không tìm thấy vùng tài nguyên đang hoạt động.' }, { status: 404 });
    return NextResponse.json({ ok: true, id: params.resourceId, archived: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'ID vùng tài nguyên không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể archive vùng tài nguyên.' }, { status: 400 });
  }
}
