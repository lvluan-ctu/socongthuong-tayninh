import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { numeric, serializeGeometry } from '@/server/solar/geo';

export const dynamic = 'force-dynamic';

const uuidSchema = z.string().uuid();

function serializeBuilding(row: Record<string, unknown>) {
  return {
    ...row,
    footprint: serializeGeometry(row.footprint),
    location: serializeGeometry(row.location),
    heightM: numeric(row.heightM),
  };
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const customerAccountId = params.get('customerAccountId')?.trim() || null;
    const siteId = params.get('siteId')?.trim() || null;
    for (const value of [customerAccountId, siteId].filter(Boolean)) {
      if (!uuidSchema.safeParse(value).success) return NextResponse.json({ message: 'ID bộ lọc công trình không đúng UUID.' }, { status: 400 });
    }
    const conditions = [sql`a.status <> 'DELETED'`];
    if (customerAccountId) conditions.push(sql`ca.id = ${customerAccountId}::uuid`);
    if (siteId) conditions.push(sql`b.site_id = ${siteId}::uuid`);
    const result = await db.execute(sql`
      SELECT b.asset_id AS id,
             a.code,
             a.name,
             a.status,
             b.site_id AS "siteId",
             s.code AS "siteCode",
             s.name AS "siteName",
             b.building_type AS "buildingType",
             b.height_m AS "heightM",
             b.floor_count AS "floorCount",
             ST_AsGeoJSON(b.footprint) AS footprint,
             ST_AsGeoJSON(a.location::geometry) AS location,
             COUNT(rs.id)::int AS "roofSurfaceCount",
             COALESCE(SUM(rs.usable_area_m2) FILTER (WHERE rs.status = 'ACTIVE'), 0)::double precision AS "usableRoofAreaM2"
      FROM energy_buildings b
      JOIN energy_assets a ON a.id = b.asset_id
      LEFT JOIN energy_sites s ON s.id = b.site_id
      LEFT JOIN energy_customer_accounts ca ON ca.site_id = b.site_id
      LEFT JOIN energy_roof_surfaces rs ON rs.building_asset_id = b.asset_id
      WHERE ${sql.join(conditions, sql` AND `)}
      GROUP BY b.asset_id, a.code, a.name, a.status, b.site_id, s.code, s.name, b.building_type, b.height_m, b.floor_count, b.footprint, a.location
      ORDER BY a.name, a.code
      LIMIT 1000
    `);
    return NextResponse.json({ items: result.rows.map((row) => ({
      ...serializeBuilding(row as Record<string, unknown>),
      floorCount: row.floorCount == null ? null : Number(row.floorCount),
      roofSurfaceCount: Number(row.roofSurfaceCount ?? 0),
      usableRoofAreaM2: Number(row.usableRoofAreaM2 ?? 0),
    })) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải danh sách công trình.' }, { status: 500 });
  }
}
