import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { numeric, serializeGeometry } from '@/server/solar/geo';

function serializeResource(row: Record<string, unknown>) {
  return {
    ...row,
    boundary: serializeGeometry(row.boundary),
    annualGhiKwhM2: numeric(row.annualGhiKwhM2),
    annualDniKwhM2: numeric(row.annualDniKwhM2),
    annualDhiKwhM2: numeric(row.annualDhiKwhM2),
    referenceTiltDeg: numeric(row.referenceTiltDeg),
    referenceAzimuthDeg: numeric(row.referenceAzimuthDeg),
    confidence: numeric(row.confidence),
  };
}

export async function readSolarResourceZone(resourceId: string) {
  const result = await db.execute(sql`
    SELECT id, code, name, ST_AsGeoJSON(boundary) AS boundary,
           annual_ghi_kwh_m2 AS "annualGhiKwhM2", annual_dni_kwh_m2 AS "annualDniKwhM2",
           annual_dhi_kwh_m2 AS "annualDhiKwhM2", reference_tilt_deg AS "referenceTiltDeg",
           reference_azimuth_deg AS "referenceAzimuthDeg", source, source_version AS "sourceVersion",
           source_ref AS "sourceRef", measured_from AS "measuredFrom", measured_to AS "measuredTo",
           quality, confidence, status, metadata, created_at AS "createdAt", updated_at AS "updatedAt"
    FROM energy_solar_resource_zones WHERE id = ${resourceId}::uuid LIMIT 1
  `);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? serializeResource(row) : null;
}
