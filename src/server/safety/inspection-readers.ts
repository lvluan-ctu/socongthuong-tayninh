import { aliasedTable, eq, sql } from 'drizzle-orm';
import {
  energyAssets,
  energyProtectionCorridors,
  energySafetyInspections,
} from '@/db/schema';
import { db } from '@/lib/db';

type Row = Record<string, unknown>;
const assetRef = aliasedTable(energyAssets, 'inspection_asset_ref');

function parseGeoJson(value: unknown) {
  if (typeof value !== 'string') return value ?? null;
  try { return JSON.parse(value) as unknown; } catch { return null; }
}

export function serializeInspection(row: Row | undefined) {
  if (!row) return null;
  return {
    ...row,
    geometry: parseGeoJson(row.geometry),
    mediaCount: Number(row.mediaCount ?? 0),
    violationCount: Number(row.violationCount ?? 0),
  };
}

export async function readInspection(inspectionId: string) {
  const [row] = await db.select({
    id: energySafetyInspections.id,
    inspectionCode: energySafetyInspections.inspectionCode,
    inspectionType: energySafetyInspections.inspectionType,
    corridorId: energySafetyInspections.corridorId,
    corridorCode: energyAssets.code,
    corridorName: energyAssets.name,
    assetId: energySafetyInspections.assetId,
    assetCode: assetRef.code,
    assetName: assetRef.name,
    inspector: energySafetyInspections.inspector,
    startedAt: energySafetyInspections.startedAt,
    completedAt: energySafetyInspections.completedAt,
    status: energySafetyInspections.status,
    source: energySafetyInspections.source,
    sourceRef: energySafetyInspections.sourceRef,
    notes: energySafetyInspections.notes,
    createdAt: energySafetyInspections.createdAt,
    updatedAt: energySafetyInspections.updatedAt,
    geometry: sql<string | null>`CASE WHEN ${energySafetyInspections.geometry} IS NULL THEN NULL ELSE ST_AsGeoJSON(${energySafetyInspections.geometry}) END`,
    mediaCount: sql<number>`(SELECT COUNT(*) FROM energy_safety_inspection_media m WHERE m.inspection_id = ${energySafetyInspections.id} AND m.status <> 'ARCHIVED')`,
    violationCount: sql<number>`(SELECT COUNT(*) FROM energy_safety_inspection_violations iv WHERE iv.inspection_id = ${energySafetyInspections.id})`,
  }).from(energySafetyInspections)
    .leftJoin(energyProtectionCorridors, eq(energyProtectionCorridors.id, energySafetyInspections.corridorId))
    .leftJoin(energyAssets, eq(energyAssets.id, energyProtectionCorridors.assetId))
    .leftJoin(assetRef, eq(assetRef.id, energySafetyInspections.assetId))
    .where(eq(energySafetyInspections.id, inspectionId)).limit(1);
  return serializeInspection(row as Row | undefined);
}
