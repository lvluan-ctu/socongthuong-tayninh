import { and, isNotNull, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import {
  energyAssets,
  energyLinePositions,
  energyPowerLines,
  energySubstations,
} from '@/db/schema';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type JsonGeometry = { type: string; coordinates: unknown };
type JsonFeature = {
  type: 'Feature';
  id?: string | number;
  geometry: JsonGeometry;
  properties: Record<string, unknown>;
};

function parseBbox(value: string | null) {
  if (!value) return null;
  const numbers = value.split(',').map(Number);
  if (numbers.length !== 4 || numbers.some((number) => !Number.isFinite(number))) return null;
  const [minLng, minLat, maxLng, maxLat] = numbers;
  if (minLng >= maxLng || minLat >= maxLat) return null;
  return { minLng, minLat, maxLng, maxLat };
}

function parseGeoJson(value: string | null): JsonGeometry | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (typeof parsed.type !== 'string' || !('coordinates' in parsed)) return null;
    return parsed as JsonGeometry;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const bbox = parseBbox(url.searchParams.get('bbox'));
    const includePositions = url.searchParams.get('includePositions') === '1';
    const envelope = bbox
      ? sql`ST_MakeEnvelope(${bbox.minLng}, ${bbox.minLat}, ${bbox.maxLng}, ${bbox.maxLat}, 4326)`
      : null;

    const substationWhere = bbox && envelope
      ? and(isNotNull(energyAssets.location), sql`ST_Intersects(${energyAssets.location}::geometry, ${envelope})`)
      : isNotNull(energyAssets.location);

    const lineWhere = bbox && envelope
      ? and(isNotNull(energyPowerLines.geometry), sql`ST_Intersects(${energyPowerLines.geometry}, ${envelope})`)
      : isNotNull(energyPowerLines.geometry);

    const [substationRows, lineRows] = await Promise.all([
      db.select({
        id: energyAssets.id,
        code: energyAssets.code,
        name: energyAssets.name,
        status: energyAssets.status,
        voltageLevelKv: energySubstations.voltageLevelKv,
        substationType: energySubstations.substationType,
        installedCapacityMva: energySubstations.installedCapacityMva,
        currentLoadMva: energySubstations.currentLoadMva,
        loadFactorPct: energySubstations.loadFactorPct,
        overloadStatus: energySubstations.overloadStatus,
        geometry: sql<string | null>`ST_AsGeoJSON(${energyAssets.location}::geometry)`,
      })
        .from(energySubstations)
        .innerJoin(energyAssets, sql`${energyAssets.id} = ${energySubstations.assetId}`)
        .where(substationWhere)
        .limit(2500),
      db.select({
        id: energyAssets.id,
        code: energyAssets.code,
        name: energyAssets.name,
        status: energyAssets.status,
        voltageLevelKv: energyPowerLines.voltageLevelKv,
        lineType: energyPowerLines.lineType,
        conductorType: energyPowerLines.conductorType,
        circuitCount: energyPowerLines.circuitCount,
        lengthM: energyPowerLines.lengthM,
        ratedCapacityMw: energyPowerLines.ratedCapacityMw,
        currentLoadMw: energyPowerLines.currentLoadMw,
        geometry: sql<string | null>`ST_AsGeoJSON(${energyPowerLines.geometry})`,
      })
        .from(energyPowerLines)
        .innerJoin(energyAssets, sql`${energyAssets.id} = ${energyPowerLines.assetId}`)
        .where(lineWhere)
        .limit(10000),
    ]);

    const stationFeatures: JsonFeature[] = substationRows.flatMap((row) => {
      const geometry = parseGeoJson(row.geometry);
      if (!geometry) return [];
      return [{
        type: 'Feature' as const,
        id: row.id,
        geometry,
        properties: {
          layer: 'substations',
          assetId: row.id,
          code: row.code,
          name: row.name,
          status: row.status,
          voltageLevelKv: row.voltageLevelKv == null ? null : Number(row.voltageLevelKv),
          substationType: row.substationType,
          installedCapacityMva: row.installedCapacityMva == null ? null : Number(row.installedCapacityMva),
          currentLoadMva: row.currentLoadMva == null ? null : Number(row.currentLoadMva),
          loadFactorPct: row.loadFactorPct == null ? null : Number(row.loadFactorPct),
          overloadStatus: row.overloadStatus,
        },
      }];
    });

    const lineFeatures: JsonFeature[] = lineRows.flatMap((row) => {
      const geometry = parseGeoJson(row.geometry);
      if (!geometry) return [];
      return [{
        type: 'Feature' as const,
        id: row.id,
        geometry,
        properties: {
          layer: 'power-lines',
          assetId: row.id,
          code: row.code,
          name: row.name,
          status: row.status,
          voltageLevelKv: Number(row.voltageLevelKv),
          lineType: row.lineType,
          conductorType: row.conductorType,
          circuitCount: row.circuitCount,
          lengthM: row.lengthM == null ? null : Number(row.lengthM),
          ratedCapacityMw: row.ratedCapacityMw == null ? null : Number(row.ratedCapacityMw),
          currentLoadMw: row.currentLoadMw == null ? null : Number(row.currentLoadMw),
        },
      }];
    });

    let positionFeatures: JsonFeature[] = [];
    if (includePositions) {
      const positionWhere = bbox && envelope
        ? sql`ST_Intersects(${energyLinePositions.location}::geometry, ${envelope})`
        : sql`true`;
      const rows = await db.select({
        id: energyLinePositions.id,
        lineAssetId: energyLinePositions.lineAssetId,
        positionCode: energyLinePositions.positionCode,
        sequenceNo: energyLinePositions.sequenceNo,
        distanceFromPreviousM: energyLinePositions.distanceFromPreviousM,
        turnAngleDeg: energyLinePositions.turnAngleDeg,
        groundingResistanceOhm: energyLinePositions.groundingResistanceOhm,
        geometry: sql<string | null>`ST_AsGeoJSON(${energyLinePositions.location}::geometry)`,
      }).from(energyLinePositions).where(positionWhere).limit(20000);

      positionFeatures = rows.flatMap((row) => {
        const geometry = parseGeoJson(row.geometry);
        if (!geometry) return [];
        return [{
          type: 'Feature' as const,
          id: row.id,
          geometry,
          properties: {
            layer: 'line-positions',
            id: row.id,
            lineAssetId: row.lineAssetId,
            positionCode: row.positionCode,
            sequenceNo: row.sequenceNo,
            distanceFromPreviousM: row.distanceFromPreviousM == null ? null : Number(row.distanceFromPreviousM),
            turnAngleDeg: row.turnAngleDeg == null ? null : Number(row.turnAngleDeg),
            groundingResistanceOhm: row.groundingResistanceOhm == null ? null : Number(row.groundingResistanceOhm),
          },
        }];
      });
    }

    return NextResponse.json({
      type: 'FeatureCollection',
      features: [...lineFeatures, ...stationFeatures, ...positionFeatures],
      meta: {
        substations: stationFeatures.length,
        powerLines: lineFeatures.length,
        linePositions: positionFeatures.length,
        bbox,
        generatedAt: new Date().toISOString(),
        source: 'hệ thống GIS',
      },
    });
  } catch (error) {
    console.error('Grid GIS GeoJSON failed', error);
    return NextResponse.json({ message: 'Không thể tải lớp dữ liệu lưới điện từ PostGIS.' }, { status: 500 });
  }
}
