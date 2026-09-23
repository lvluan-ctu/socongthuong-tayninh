import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { feature, numeric, parseGeoJson } from '@/server/solar/geo';

export const dynamic = 'force-dynamic';

function parseBbox(value: string | null) {
  if (!value) return null;
  const values = value.split(',').map(Number);
  if (values.length !== 4 || !values.every(Number.isFinite)) return null;
  const [minX, minY, maxX, maxY] = values;
  if (minX < -180 || maxX > 180 || minY < -90 || maxY > 90 || minX >= maxX || minY >= maxY) return null;
  return values as [number, number, number, number];
}

export async function GET(request: Request) {
  try {
    const bbox = parseBbox(new URL(request.url).searchParams.get('bbox'));
    if (!bbox) return NextResponse.json({ message: 'bbox phải có dạng minLng,minLat,maxLng,maxLat và nằm trong WGS84.' }, { status: 400 });
    const [minX, minY, maxX, maxY] = bbox;
    const envelope = sql`ST_MakeEnvelope(${minX}, ${minY}, ${maxX}, ${maxY}, 4326)`;

    const [roofResult, resourceResult, systemResult, gridResult, lineResult] = await Promise.all([
      db.execute(sql`
        SELECT rs.id, rs.code, rs.area_m2 AS "areaM2", rs.usable_area_m2 AS "usableAreaM2", rs.source, rs.confidence,
               a.code AS "buildingCode", a.name AS "buildingName", ST_AsGeoJSON(rs.geometry) AS geometry
        FROM energy_roof_surfaces rs
        JOIN energy_assets a ON a.id = rs.building_asset_id
        WHERE rs.status = 'ACTIVE' AND rs.geometry IS NOT NULL AND ST_Intersects(rs.geometry, ${envelope})
        ORDER BY rs.code
        LIMIT 2000
      `),
      db.execute(sql`
        SELECT rz.id, rz.code, rz.name, rz.annual_ghi_kwh_m2 AS "annualGhiKwhM2", rz.source, rz.source_version AS "sourceVersion", rz.quality, rz.confidence,
               ST_AsGeoJSON(rz.boundary) AS geometry
        FROM energy_solar_resource_zones rz
        WHERE rz.status = 'ACTIVE' AND rz.boundary IS NOT NULL AND ST_Intersects(rz.boundary, ${envelope})
        ORDER BY rz.code
        LIMIT 500
      `),
      db.execute(sql`
        SELECT a.id, a.code, a.name, rs.operation_status AS "operationStatus", rs.installed_capacity_kwp AS "installedCapacityKwp", rs.source,
               rs.confidence, ST_AsGeoJSON(a.location::geometry) AS geometry
        FROM energy_rooftop_systems rs
        JOIN energy_assets a ON a.id = rs.asset_id
        WHERE rs.operation_status <> 'DELETED' AND a.status <> 'DELETED' AND a.location IS NOT NULL
          AND ST_Intersects(a.location::geometry, ${envelope})
        ORDER BY a.name
        LIMIT 2000
      `),
      db.execute(sql`
        SELECT a.id, a.code, a.name, a.asset_type AS "assetType", ST_AsGeoJSON(a.location::geometry) AS geometry
        FROM energy_assets a
        WHERE a.asset_type IN ('SUBSTATION', 'FEEDER', 'BAY', 'TRANSFORMER')
          AND a.location IS NOT NULL AND ST_Intersects(a.location::geometry, ${envelope})
        ORDER BY a.asset_type, a.code
        LIMIT 2000
      `),
      db.execute(sql`
        SELECT a.id, a.code, pl.voltage_level_kv AS "voltageLevelKv", pl.line_type AS "lineType", pl.length_m AS "lengthM",
               ST_AsGeoJSON(pl.geometry) AS geometry
        FROM energy_power_lines pl
        JOIN energy_assets a ON a.id = pl.asset_id
        WHERE pl.geometry IS NOT NULL AND ST_Intersects(pl.geometry, ${envelope})
        ORDER BY a.code
        LIMIT 2000
      `),
    ]);

    const features = [
      ...roofResult.rows.map((row) => feature(`roof-${String(row.id)}`, parseGeoJson(row.geometry), {
        layer: 'roof', code: row.code, areaM2: numeric(row.areaM2), usableAreaM2: numeric(row.usableAreaM2), buildingCode: row.buildingCode, buildingName: row.buildingName, source: row.source, confidence: numeric(row.confidence),
      })),
      ...resourceResult.rows.map((row) => feature(`resource-${String(row.id)}`, parseGeoJson(row.geometry), {
        layer: 'solar-resource', code: row.code, name: row.name, annualGhiKwhM2: numeric(row.annualGhiKwhM2), source: row.source, sourceVersion: row.sourceVersion, quality: row.quality, confidence: numeric(row.confidence),
      })),
      ...systemResult.rows.map((row) => feature(`system-${String(row.id)}`, parseGeoJson(row.geometry), {
        layer: 'rooftop-system', code: row.code, name: row.name, operationStatus: row.operationStatus, installedCapacityKwp: numeric(row.installedCapacityKwp), source: row.source, confidence: numeric(row.confidence),
      })),
      ...gridResult.rows.map((row) => feature(`grid-${String(row.id)}`, parseGeoJson(row.geometry), {
        layer: 'grid-asset', code: row.code, name: row.name, assetType: row.assetType,
      })),
      ...lineResult.rows.map((row) => feature(`line-${String(row.id)}`, parseGeoJson(row.geometry), {
        layer: 'power-line', code: row.code, voltageLevelKv: numeric(row.voltageLevelKv), lineType: row.lineType, lengthM: numeric(row.lengthM),
      })),
    ];

    return NextResponse.json({
      type: 'FeatureCollection',
      features,
      bbox,
      generatedAt: new Date().toISOString(),
      layerCounts: {
        roofs: roofResult.rows.length,
        solarResources: resourceResult.rows.length,
        rooftopSystems: systemResult.rows.length,
        gridAssets: gridResult.rows.length,
        powerLines: lineResult.rows.length,
      },
      source: 'PostGIS energy database',
    });
  } catch (error) {
    console.error('Solar GIS layers failed', error);
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải các lớp GIS Solar.' }, { status: 500 });
  }
}
