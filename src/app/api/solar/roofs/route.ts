import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { roofSurfaceSchema } from '@/lib/solar-schemas';
import { db } from '@/lib/db';
import { numeric, parseDate, serializeGeometry } from '@/server/solar/geo';
import { readRoofSurface } from '@/lib/solar-roof-api';

export const dynamic = 'force-dynamic';

const idSchema = z.string().uuid();

function serializeRoof(row: Record<string, unknown>) {
  return {
    ...row,
    geometry: serializeGeometry(row.geometry),
    areaM2: numeric(row.areaM2),
    usableAreaM2: numeric(row.usableAreaM2),
    tiltDeg: numeric(row.tiltDeg),
    azimuthDeg: numeric(row.azimuthDeg),
    shadingFactor: numeric(row.shadingFactor),
    sourceResolutionM: numeric(row.sourceResolutionM),
    confidence: numeric(row.confidence),
    obstructionRatioPct: numeric(row.obstructionRatioPct),
  };
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const buildingAssetId = params.get('buildingAssetId')?.trim() || null;
    const customerAccountId = params.get('customerAccountId')?.trim() || null;
    const siteId = params.get('siteId')?.trim() || null;
    const includeArchived = params.get('includeArchived') === 'true';
    const rawLimit = Number(params.get('limit') ?? 500);
    const limit = Math.min(1000, Math.max(1, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 500));

    for (const value of [buildingAssetId, customerAccountId, siteId].filter(Boolean)) {
      if (!idSchema.safeParse(value).success) return NextResponse.json({ message: 'Bộ lọc ID không đúng UUID.' }, { status: 400 });
    }

    const conditions = [includeArchived ? sql`TRUE` : sql`rs.status = 'ACTIVE'`];
    if (buildingAssetId) conditions.push(sql`rs.building_asset_id = ${buildingAssetId}::uuid`);
    if (customerAccountId) conditions.push(sql`ca.id = ${customerAccountId}::uuid`);
    if (siteId) conditions.push(sql`b.site_id = ${siteId}::uuid`);
    const where = sql.join(conditions, sql` AND `);
    const result = await db.execute(sql`
      SELECT rs.id,
             rs.building_asset_id AS "buildingAssetId",
             rs.code,
             ST_AsGeoJSON(rs.geometry) AS geometry,
             rs.solar_resource_zone_id AS "solarResourceZoneId",
             rs.area_m2 AS "areaM2",
             rs.usable_area_m2 AS "usableAreaM2",
             rs.tilt_deg AS "tiltDeg",
             rs.azimuth_deg AS "azimuthDeg",
             rs.material,
             rs.shading_factor AS "shadingFactor",
             rs.source,
             rs.source_captured_at AS "sourceCapturedAt",
             rs.source_resolution_m AS "sourceResolutionM",
             rs.confidence,
             rs.obstruction_ratio_pct AS "obstructionRatioPct",
             rs.structural_suitability_status AS "structuralSuitabilityStatus",
             rs.orientation_quality AS "orientationQuality",
             rs.source_ref AS "sourceRef",
             rs.status,
             rs.last_verified_at AS "lastVerifiedAt",
             a.code AS "buildingCode",
             a.name AS "buildingName",
             b.site_id AS "siteId",
             s.code AS "siteCode",
             s.name AS "siteName",
             rz.code AS "solarResourceCode",
             rz.name AS "solarResourceName",
             rz.source AS "solarResourceSource",
             rz.source_version AS "solarResourceVersion"
      FROM energy_roof_surfaces rs
      JOIN energy_buildings b ON b.asset_id = rs.building_asset_id
      JOIN energy_assets a ON a.id = b.asset_id
      LEFT JOIN energy_sites s ON s.id = b.site_id
      LEFT JOIN energy_customer_accounts ca ON ca.site_id = b.site_id
      LEFT JOIN energy_solar_resource_zones rz ON rz.id = rs.solar_resource_zone_id
      WHERE ${where}
      ORDER BY a.name, rs.code
      LIMIT ${limit}
    `);
    return NextResponse.json({ items: result.rows.map((row) => serializeRoof(row as Record<string, unknown>)) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải danh sách bề mặt mái.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = roofSurfaceSchema.parse(await request.json());
    const building = await db.execute(sql`
      SELECT b.asset_id AS id
      FROM energy_buildings b
      JOIN energy_assets a ON a.id = b.asset_id
      WHERE b.asset_id = ${payload.buildingAssetId}::uuid
      LIMIT 1
    `);
    if (!building.rows.length) return NextResponse.json({ message: 'Công trình không tồn tại trong Asset Registry.' }, { status: 404 });
    if (payload.solarResourceZoneId) {
      const resource = await db.execute(sql`SELECT id FROM energy_solar_resource_zones WHERE id = ${payload.solarResourceZoneId}::uuid AND status = 'ACTIVE' LIMIT 1`);
      if (!resource.rows.length) return NextResponse.json({ message: 'Vùng tài nguyên bức xạ không tồn tại hoặc đã archive.' }, { status: 422 });
    }

    const geometryJson = payload.geometry ? JSON.stringify(payload.geometry) : null;
    const result = await db.execute(sql`
      INSERT INTO energy_roof_surfaces (
        building_asset_id, code, geometry, solar_resource_zone_id, area_m2, usable_area_m2,
        tilt_deg, azimuth_deg, material, shading_factor, source, source_captured_at,
        source_resolution_m, confidence, obstruction_ratio_pct, structural_suitability_status,
        orientation_quality, source_ref, status, last_verified_at
      ) VALUES (
        ${payload.buildingAssetId}::uuid,
        ${payload.code},
        CASE WHEN ${geometryJson}::text IS NULL THEN NULL ELSE ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${geometryJson}), 4326)), 3)) END,
        ${payload.solarResourceZoneId ?? null}::uuid,
        ${String(payload.areaM2)},
        ${payload.usableAreaM2 == null ? null : String(payload.usableAreaM2)},
        ${payload.tiltDeg == null ? null : String(payload.tiltDeg)},
        ${payload.azimuthDeg == null ? null : String(payload.azimuthDeg)},
        ${payload.material ?? null},
        ${payload.shadingFactor == null ? null : String(payload.shadingFactor)},
        ${payload.source},
        ${parseDate(payload.sourceCapturedAt)},
        ${payload.sourceResolutionM == null ? null : String(payload.sourceResolutionM)},
        ${payload.confidence == null ? null : String(payload.confidence)},
        ${payload.obstructionRatioPct == null ? null : String(payload.obstructionRatioPct)},
        ${payload.structuralSuitabilityStatus ?? null},
        ${payload.orientationQuality ?? null},
        ${payload.sourceRef?.trim() || null},
        ${payload.status},
        ${parseDate(payload.lastVerifiedAt)}
      )
      RETURNING id
    `);
    const id = String((result.rows[0] as { id: string }).id);
    return NextResponse.json({ item: await readRoofSurface(id) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin bề mặt mái không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tạo bề mặt mái.' }, { status: 400 });
  }
}
