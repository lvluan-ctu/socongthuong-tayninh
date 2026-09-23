import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { solarResourceZoneSchema } from '@/lib/solar-schemas';
import { db } from '@/lib/db';
import { numeric, parseDate, serializeGeometry } from '@/server/solar/geo';
import { readSolarResourceZone } from '@/lib/solar-resource-api';

export const dynamic = 'force-dynamic';

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

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const includeArchived = params.get('includeArchived') === 'true';
    const rawLimit = Number(params.get('limit') ?? 500);
    const limit = Math.min(2000, Math.max(1, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 500));
    const conditions = [includeArchived ? sql`TRUE` : sql`status = 'ACTIVE'`];
    const bbox = params.get('bbox')?.split(',').map(Number);
    if (bbox?.length === 4 && bbox.every(Number.isFinite)) {
      const [minX, minY, maxX, maxY] = bbox;
      if (minX >= -180 && maxX <= 180 && minY >= -90 && maxY <= 90 && minX < maxX && minY < maxY) {
        conditions.push(sql`boundary IS NOT NULL AND ST_Intersects(boundary, ST_MakeEnvelope(${minX}, ${minY}, ${maxX}, ${maxY}, 4326))`);
      } else {
        return NextResponse.json({ message: 'bbox không hợp lệ.' }, { status: 400 });
      }
    } else if (params.has('bbox')) {
      return NextResponse.json({ message: 'bbox phải có dạng minLng,minLat,maxLng,maxLat.' }, { status: 400 });
    }
    const result = await db.execute(sql`
      SELECT id,
             code,
             name,
             ST_AsGeoJSON(boundary) AS boundary,
             annual_ghi_kwh_m2 AS "annualGhiKwhM2",
             annual_dni_kwh_m2 AS "annualDniKwhM2",
             annual_dhi_kwh_m2 AS "annualDhiKwhM2",
             reference_tilt_deg AS "referenceTiltDeg",
             reference_azimuth_deg AS "referenceAzimuthDeg",
             source,
             source_version AS "sourceVersion",
             source_ref AS "sourceRef",
             measured_from AS "measuredFrom",
             measured_to AS "measuredTo",
             quality,
             confidence,
             status,
             metadata,
             created_at AS "createdAt",
             updated_at AS "updatedAt"
      FROM energy_solar_resource_zones
      WHERE ${sql.join(conditions, sql` AND `)}
      ORDER BY code
      LIMIT ${limit}
    `);
    return NextResponse.json({ items: result.rows.map((row) => serializeResource(row as Record<string, unknown>)) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải vùng tài nguyên bức xạ.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = solarResourceZoneSchema.parse(await request.json());
    const boundaryJson = payload.boundary ? JSON.stringify(payload.boundary) : null;
    const result = await db.execute(sql`
      INSERT INTO energy_solar_resource_zones (
        code, name, boundary, annual_ghi_kwh_m2, annual_dni_kwh_m2, annual_dhi_kwh_m2,
        reference_tilt_deg, reference_azimuth_deg, source, source_version, source_ref,
        measured_from, measured_to, quality, confidence, status
      ) VALUES (
        ${payload.code},
        ${payload.name},
        CASE WHEN ${boundaryJson}::text IS NULL THEN NULL ELSE ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${boundaryJson}), 4326)), 3)) END,
        ${String(payload.annualGhiKwhM2)},
        ${payload.annualDniKwhM2 == null ? null : String(payload.annualDniKwhM2)},
        ${payload.annualDhiKwhM2 == null ? null : String(payload.annualDhiKwhM2)},
        ${payload.referenceTiltDeg == null ? null : String(payload.referenceTiltDeg)},
        ${payload.referenceAzimuthDeg == null ? null : String(payload.referenceAzimuthDeg)},
        ${payload.source},
        ${payload.sourceVersion},
        ${payload.sourceRef?.trim() || null},
        ${parseDate(payload.measuredFrom)},
        ${parseDate(payload.measuredTo)},
        ${payload.quality},
        ${payload.confidence == null ? null : String(payload.confidence)},
        ${payload.status}
      )
      RETURNING id
    `);
    const id = String((result.rows[0] as { id: string }).id);
    return NextResponse.json({ item: await readSolarResourceZone(id) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin vùng tài nguyên không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tạo vùng tài nguyên bức xạ.' }, { status: 400 });
  }
}
