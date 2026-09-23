import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { numeric, serializeGeometry } from '@/server/solar/geo';

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

export async function readRoofSurface(roofSurfaceId: string) {
  const result = await db.execute(sql`
    SELECT rs.id, rs.building_asset_id AS "buildingAssetId", rs.code,
           ST_AsGeoJSON(rs.geometry) AS geometry,
           rs.solar_resource_zone_id AS "solarResourceZoneId", rs.area_m2 AS "areaM2",
           rs.usable_area_m2 AS "usableAreaM2", rs.tilt_deg AS "tiltDeg", rs.azimuth_deg AS "azimuthDeg",
           rs.material, rs.shading_factor AS "shadingFactor", rs.source,
           rs.source_captured_at AS "sourceCapturedAt", rs.source_resolution_m AS "sourceResolutionM",
           rs.confidence, rs.obstruction_ratio_pct AS "obstructionRatioPct",
           rs.structural_suitability_status AS "structuralSuitabilityStatus", rs.orientation_quality AS "orientationQuality",
           rs.source_ref AS "sourceRef", rs.status, rs.last_verified_at AS "lastVerifiedAt",
           a.code AS "buildingCode", a.name AS "buildingName", b.site_id AS "siteId",
           s.code AS "siteCode", s.name AS "siteName", rz.code AS "solarResourceCode",
           rz.name AS "solarResourceName", rz.source AS "solarResourceSource", rz.source_version AS "solarResourceVersion"
    FROM energy_roof_surfaces rs
    JOIN energy_buildings b ON b.asset_id = rs.building_asset_id
    JOIN energy_assets a ON a.id = b.asset_id
    LEFT JOIN energy_sites s ON s.id = b.site_id
    LEFT JOIN energy_solar_resource_zones rz ON rz.id = rs.solar_resource_zone_id
    WHERE rs.id = ${roofSurfaceId}::uuid LIMIT 1
  `);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? serializeRoof(row) : null;
}
