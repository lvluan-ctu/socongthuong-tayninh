import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { roofSurfacePatchSchema } from '@/lib/solar-schemas';
import { db } from '@/lib/db';
import { parseDate } from '@/server/solar/geo';
import { readRoofSurface } from '@/lib/solar-roof-api';

export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ roofSurfaceId: z.string().uuid() });
const patchSchema = roofSurfacePatchSchema;

async function validateReferences(payload: z.infer<typeof roofSurfacePatchSchema>) {
  if (payload.buildingAssetId) {
    const building = await db.execute(sql`SELECT asset_id FROM energy_buildings WHERE asset_id = ${payload.buildingAssetId}::uuid LIMIT 1`);
    if (!building.rows.length) return 'Công trình không tồn tại trong Asset Registry.';
  }
  if (payload.solarResourceZoneId) {
    const resource = await db.execute(sql`SELECT id FROM energy_solar_resource_zones WHERE id = ${payload.solarResourceZoneId}::uuid AND status = 'ACTIVE' LIMIT 1`);
    if (!resource.rows.length) return 'Vùng tài nguyên bức xạ không tồn tại hoặc đã archive.';
  }
  return null;
}

export async function GET(_request: Request, context: { params: Promise<{ roofSurfaceId: string }> }) {
  try {
    const params = paramsSchema.parse(await context.params);
    const item = await readRoofSurface(params.roofSurfaceId);
    if (!item) return NextResponse.json({ message: 'Không tìm thấy bề mặt mái.' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'ID bề mặt mái không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải bề mặt mái.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ roofSurfaceId: string }> }) {
  try {
    const params = paramsSchema.parse(await context.params);
    const payload = patchSchema.parse(await request.json());
    const currentResult = await db.execute(sql`
      SELECT building_asset_id AS "buildingAssetId", area_m2 AS "areaM2", usable_area_m2 AS "usableAreaM2"
      FROM energy_roof_surfaces WHERE id = ${params.roofSurfaceId}::uuid LIMIT 1
    `);
    const current = currentResult.rows[0] as { buildingAssetId: string; areaM2: string; usableAreaM2: string | null } | undefined;
    if (!current) return NextResponse.json({ message: 'Không tìm thấy bề mặt mái.' }, { status: 404 });
    const referenceError = await validateReferences(payload);
    if (referenceError) return NextResponse.json({ message: referenceError }, { status: 422 });

    const area = payload.areaM2 ?? Number(current.areaM2);
    if (payload.usableAreaM2 != null && payload.usableAreaM2 > area) {
      return NextResponse.json({ message: 'Diện tích khả dụng không thể lớn hơn diện tích bề mặt mái.', issues: [{ path: ['usableAreaM2'], message: 'Phải nhỏ hơn hoặc bằng areaM2.' }] }, { status: 400 });
    }
    const updates = [sql`updated_at = now()`];
    if (payload.buildingAssetId !== undefined) updates.push(sql`building_asset_id = ${payload.buildingAssetId}::uuid`);
    if (payload.code !== undefined) updates.push(sql`code = ${payload.code}`);
    if (Object.prototype.hasOwnProperty.call(payload, 'geometry')) {
      const geometryJson = payload.geometry ? JSON.stringify(payload.geometry) : null;
      updates.push(sql`geometry = CASE WHEN ${geometryJson}::text IS NULL THEN NULL ELSE ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${geometryJson}), 4326)), 3)) END`);
    }
    if (payload.solarResourceZoneId !== undefined) updates.push(sql`solar_resource_zone_id = ${payload.solarResourceZoneId ?? null}::uuid`);
    if (payload.areaM2 !== undefined) updates.push(sql`area_m2 = ${String(payload.areaM2)}`);
    if (payload.usableAreaM2 !== undefined) updates.push(sql`usable_area_m2 = ${payload.usableAreaM2 == null ? null : String(payload.usableAreaM2)}`);
    if (payload.tiltDeg !== undefined) updates.push(sql`tilt_deg = ${payload.tiltDeg == null ? null : String(payload.tiltDeg)}`);
    if (payload.azimuthDeg !== undefined) updates.push(sql`azimuth_deg = ${payload.azimuthDeg == null ? null : String(payload.azimuthDeg)}`);
    if (payload.material !== undefined) updates.push(sql`material = ${payload.material ?? null}`);
    if (payload.shadingFactor !== undefined) updates.push(sql`shading_factor = ${payload.shadingFactor == null ? null : String(payload.shadingFactor)}`);
    if (payload.source !== undefined) updates.push(sql`source = ${payload.source}`);
    if (payload.sourceCapturedAt !== undefined) updates.push(sql`source_captured_at = ${parseDate(payload.sourceCapturedAt)}`);
    if (payload.sourceResolutionM !== undefined) updates.push(sql`source_resolution_m = ${payload.sourceResolutionM == null ? null : String(payload.sourceResolutionM)}`);
    if (payload.confidence !== undefined) updates.push(sql`confidence = ${payload.confidence == null ? null : String(payload.confidence)}`);
    if (payload.obstructionRatioPct !== undefined) updates.push(sql`obstruction_ratio_pct = ${payload.obstructionRatioPct == null ? null : String(payload.obstructionRatioPct)}`);
    if (payload.structuralSuitabilityStatus !== undefined) updates.push(sql`structural_suitability_status = ${payload.structuralSuitabilityStatus ?? null}`);
    if (payload.orientationQuality !== undefined) updates.push(sql`orientation_quality = ${payload.orientationQuality ?? null}`);
    if (payload.sourceRef !== undefined) updates.push(sql`source_ref = ${payload.sourceRef?.trim() || null}`);
    if (payload.status !== undefined) updates.push(sql`status = ${payload.status}`);
    if (payload.lastVerifiedAt !== undefined) updates.push(sql`last_verified_at = ${parseDate(payload.lastVerifiedAt)}`);

    await db.execute(sql`UPDATE energy_roof_surfaces SET ${sql.join(updates, sql`, `)} WHERE id = ${params.roofSurfaceId}::uuid`);
    return NextResponse.json({ item: await readRoofSurface(params.roofSurfaceId) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin bề mặt mái không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật bề mặt mái.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ roofSurfaceId: string }> }) {
  try {
    const params = paramsSchema.parse(await context.params);
    const result = await db.execute(sql`
      UPDATE energy_roof_surfaces
      SET status = 'ARCHIVED', updated_at = now()
      WHERE id = ${params.roofSurfaceId}::uuid AND status <> 'ARCHIVED'
      RETURNING id
    `);
    if (!result.rows.length) return NextResponse.json({ message: 'Không tìm thấy bề mặt mái đang hoạt động.' }, { status: 404 });
    return NextResponse.json({ ok: true, id: params.roofSurfaceId, archived: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'ID bề mặt mái không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể archive bề mặt mái.' }, { status: 400 });
  }
}
