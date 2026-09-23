import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { evGisFilterSchema } from '@/lib/ev-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

function statusFilter(status: string) {
  if (status === 'SUBMITTED') return sql`AND app.status IN ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFO', 'PRELIMINARY_OK', 'APPROVED', 'CONVERTED')`;
  if (status === 'APPROVED') return sql`AND app.status IN ('APPROVED', 'CONVERTED')`;
  if (status === 'OPERATING') return sql`AND app.status = 'CONVERTED'`;
  return sql``;
}

export async function GET(request: Request) {
  try {
    const filters = evGisFilterSchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    const areaFilter = filters.adminAreaCode ? sql`AND COALESCE(site.admin_area_code, party.admin_area_code) = ${filters.adminAreaCode}` : sql``;
    const stationAreaFilter = filters.adminAreaCode ? sql`AND site.admin_area_code = ${filters.adminAreaCode}` : sql``;
    const appStatusFilter = statusFilter(filters.status);
    const [applicationsResult, stationsResult, gridResult, areasResult, qualityResult] = await Promise.all([
      db.execute(sql`
        SELECT app.id::text AS id,
               ST_AsGeoJSON(COALESCE(app.location::geometry, site.location::geometry, site.boundary))::json AS geometry,
               jsonb_build_object('layer', 'application', 'applicationId', app.id, 'code', app.code, 'applicantName', party.name, 'status', app.status, 'address', app.address,
                                  'requestedPowerKw', app.requested_power_kw, 'approvedPowerKw', app.approved_power_kw, 'connectionCapacityKw', app.connection_capacity_kw,
                                  'gridAssetId', app.grid_asset_id, 'availableGridCapacityKw', app.available_grid_capacity_kw, 'adminAreaCode', site.admin_area_code) AS properties
        FROM energy_ev_station_applications app
        JOIN energy_parties party ON party.id = app.applicant_party_id
        LEFT JOIN energy_sites site ON site.id = app.site_id
        WHERE COALESCE(app.location::geometry, site.location::geometry, site.boundary) IS NOT NULL ${appStatusFilter} ${areaFilter}
      `),
      db.execute(sql`
        SELECT station.asset_id::text AS id,
               ST_AsGeoJSON(COALESCE(asset.location::geometry, site.location::geometry, site.boundary))::json AS geometry,
               jsonb_build_object('layer', 'station', 'assetId', station.asset_id, 'code', asset.code, 'name', asset.name, 'operationStatus', station.operation_status,
                                  'installedPowerKw', COALESCE(station.installed_power_kw, station.total_power_kw), 'connectionCapacityKw', station.connection_capacity_kw,
                                  'actualPeakPowerKw', station.actual_peak_power_kw, 'connectorCount', station.connector_count, 'availableCount', station.available_count,
                                  'occupiedCount', station.occupied_count, 'faultedCount', station.faulted_count, 'utilizationPct', station.utilization_pct,
                                  'gridAssetId', station.grid_asset_id, 'adminAreaCode', site.admin_area_code) AS properties
        FROM energy_ev_stations station
        JOIN energy_assets asset ON asset.id = station.asset_id
        LEFT JOIN energy_sites site ON site.id = station.site_id
        WHERE station.operation_status <> 'DECOMMISSIONED' AND COALESCE(asset.location::geometry, site.location::geometry, site.boundary) IS NOT NULL ${stationAreaFilter}
      `),
      db.execute(sql`
        SELECT asset.id::text AS id,
               ST_AsGeoJSON(asset.location::geometry)::json AS geometry,
               jsonb_build_object('layer', CASE WHEN asset.asset_type = 'FEEDER' THEN 'feeder' ELSE 'substation' END, 'assetId', asset.id, 'code', asset.code, 'name', asset.name,
                                  'assetType', asset.asset_type, 'status', asset.status, 'availableCapacityKw', COALESCE(gca.available_capacity_mw, substation.available_capacity_mva) * 1000,
                                  'loadFactorPct', substation.load_factor_pct) AS properties
        FROM energy_assets asset
        LEFT JOIN energy_substations substation ON substation.asset_id = asset.id
        LEFT JOIN LATERAL (
          SELECT available_capacity_mw FROM energy_grid_capacity_assessments assessment WHERE assessment.asset_id = asset.id ORDER BY assessment.assessed_at DESC LIMIT 1
        ) gca ON TRUE
        WHERE asset.asset_type IN ('SUBSTATION', 'FEEDER') AND asset.location IS NOT NULL
      `),
      db.execute(sql`
        SELECT id::text AS id, ST_AsGeoJSON(boundary)::json AS geometry,
               jsonb_build_object('layer', 'adminArea', 'code', code, 'name', name, 'level', level, 'parentCode', parent_code) AS properties
        FROM energy_admin_areas
        WHERE boundary IS NOT NULL ${filters.adminAreaCode ? sql`AND code = ${filters.adminAreaCode}` : sql``}
      `),
      db.execute(sql`
        SELECT
          (SELECT COUNT(*)::int
           FROM energy_ev_station_applications app
           LEFT JOIN energy_sites site ON site.id = app.site_id
           WHERE COALESCE(app.location::geometry, site.location::geometry, site.boundary) IS NULL) AS "missingApplicationGeometry",
          (SELECT COUNT(*)::int
           FROM energy_ev_stations station
           JOIN energy_assets asset ON asset.id = station.asset_id
           LEFT JOIN energy_sites site ON site.id = station.site_id
           WHERE station.operation_status <> 'DECOMMISSIONED'
             AND COALESCE(asset.location::geometry, site.location::geometry, site.boundary) IS NULL) AS "missingStationGeometry"
      `),
    ]);
    const mapRows = (rows: unknown[]) => rows.map((row) => {
      const value = row as { id: string; geometry: unknown; properties: Record<string, unknown> };
      return { type: 'Feature' as const, id: value.id, geometry: value.geometry, properties: value.properties };
    });
    const applications = mapRows(applicationsResult.rows);
    const stations = mapRows(stationsResult.rows);
    const grid = mapRows(gridResult.rows);
    const adminAreas = mapRows(areasResult.rows);
    const features = [...adminAreas, ...grid, ...applications, ...stations];
    const quality = (qualityResult.rows[0] ?? {}) as Record<string, number | string | null>;
    const warnings: string[] = [];
    if (!features.length) warnings.push('EV_GIS_EMPTY: chưa có geometry PostGIS thật cho application, station, grid hoặc admin area; không geocode/tạo điểm thay thế.');
    if (Number(quality.missingApplicationGeometry ?? 0) > 0) warnings.push(`MISSING_APPLICATION_GEOMETRY: ${Number(quality.missingApplicationGeometry)} hồ sơ bị bỏ qua vì thiếu location/boundary.`);
    if (Number(quality.missingStationGeometry ?? 0) > 0) warnings.push(`MISSING_STATION_GEOMETRY: ${Number(quality.missingStationGeometry)} trạm bị bỏ qua vì thiếu geometry.`);
    warnings.push('NEAREST_GRID_IS_PRELIMINARY: TBA/feeder gần nhất chỉ là screening; điểm đấu nối chính thức phải đến từ confirmed grid assessment.');
    return NextResponse.json({
      filters,
      layers: {
        applications: { type: 'FeatureCollection', features: applications },
        stations: { type: 'FeatureCollection', features: stations },
        grid: { type: 'FeatureCollection', features: grid },
        adminAreas: { type: 'FeatureCollection', features: adminAreas },
      },
      features: { type: 'FeatureCollection', features },
      stats: { applications: applications.length, stations: stations.length, grid: grid.length, adminAreas: adminAreas.length, total: features.length },
      warnings,
      method: { geometry: 'ST_AsGeoJSON(COALESCE(location::geometry, site.location::geometry, boundary))', source: 'hệ thống GIS energy EV + grid + admin area tables', headroom: 'latest grid capacity assessment per asset' },
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Bộ lọc EV GIS không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải EV GIS.' }, { status: 500 });
  }
}
