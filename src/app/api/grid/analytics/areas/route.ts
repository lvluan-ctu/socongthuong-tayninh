import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const areaStatsCte = sql`
  WITH area_stats AS (
    SELECT aa.code, aa.name, aa.level,
      (SELECT count(*)::int FROM energy_substations s JOIN energy_assets a ON a.id = s.asset_id LEFT JOIN energy_sites st ON st.id = a.site_id
        WHERE st.admin_area_code = aa.code OR (aa.boundary IS NOT NULL AND a.location IS NOT NULL AND ST_Intersects(aa.boundary, a.location::geometry))) AS substations,
      (SELECT count(*)::int FROM energy_transformers t JOIN energy_assets ta ON ta.id = t.asset_id LEFT JOIN energy_assets sa ON sa.id = t.substation_asset_id LEFT JOIN energy_sites st ON st.id = sa.site_id
        WHERE st.admin_area_code = aa.code OR (aa.boundary IS NOT NULL AND COALESCE(ta.location, sa.location) IS NOT NULL AND ST_Intersects(aa.boundary, COALESCE(ta.location, sa.location)::geometry))) AS transformers,
      (SELECT count(*)::int FROM energy_feeders f JOIN energy_assets fa ON fa.id = f.asset_id LEFT JOIN energy_assets sa ON sa.id = f.substation_asset_id LEFT JOIN energy_sites st ON st.id = sa.site_id
        WHERE st.admin_area_code = aa.code OR (aa.boundary IS NOT NULL AND COALESCE(fa.location, sa.location) IS NOT NULL AND ST_Intersects(aa.boundary, COALESCE(fa.location, sa.location)::geometry))) AS feeders,
      (SELECT count(*)::int FROM energy_power_lines pl JOIN energy_assets a ON a.id = pl.asset_id LEFT JOIN energy_sites st ON st.id = a.site_id
        WHERE st.admin_area_code = aa.code OR (aa.boundary IS NOT NULL AND pl.geometry IS NOT NULL AND ST_Intersects(aa.boundary, pl.geometry)) OR (aa.boundary IS NOT NULL AND pl.geometry IS NULL AND a.location IS NOT NULL AND ST_Intersects(aa.boundary, a.location::geometry))) AS lines,
      (SELECT count(*)::int FROM energy_power_structures ps JOIN energy_line_positions lp ON lp.id = ps.position_id JOIN energy_assets a ON a.id = ps.asset_id LEFT JOIN energy_sites st ON st.id = a.site_id
        WHERE st.admin_area_code = aa.code OR (aa.boundary IS NOT NULL AND ST_Intersects(aa.boundary, lp.location::geometry))) AS structures,
      (SELECT count(*)::int FROM energy_line_positions lp LEFT JOIN energy_assets a ON a.id = lp.asset_id LEFT JOIN energy_sites st ON st.id = a.site_id
        WHERE st.admin_area_code = aa.code OR (aa.boundary IS NOT NULL AND ST_Intersects(aa.boundary, lp.location::geometry))) AS positions,
      (SELECT COALESCE(sum(COALESCE(s.installed_capacity_mva, s.designed_capacity_mva)::numeric), 0) FROM energy_substations s JOIN energy_assets a ON a.id = s.asset_id LEFT JOIN energy_sites st ON st.id = a.site_id
        WHERE st.admin_area_code = aa.code OR (aa.boundary IS NOT NULL AND a.location IS NOT NULL AND ST_Intersects(aa.boundary, a.location::geometry))) AS "installedMva",
      (SELECT COALESCE(sum(t.rated_capacity_mva::numeric), 0) FROM energy_transformers t JOIN energy_assets ta ON ta.id = t.asset_id LEFT JOIN energy_assets sa ON sa.id = t.substation_asset_id LEFT JOIN energy_sites st ON st.id = sa.site_id
        WHERE st.admin_area_code = aa.code OR (aa.boundary IS NOT NULL AND COALESCE(ta.location, sa.location) IS NOT NULL AND ST_Intersects(aa.boundary, COALESCE(ta.location, sa.location)::geometry))) AS "transformerMva",
      (SELECT COALESCE(sum(s.current_load_mva::numeric), 0) FROM energy_substations s JOIN energy_assets a ON a.id = s.asset_id LEFT JOIN energy_sites st ON st.id = a.site_id
        WHERE st.admin_area_code = aa.code OR (aa.boundary IS NOT NULL AND a.location IS NOT NULL AND ST_Intersects(aa.boundary, a.location::geometry))) AS "currentLoadMva",
      (SELECT COALESCE(sum(s.available_capacity_mva::numeric), 0) FROM energy_substations s JOIN energy_assets a ON a.id = s.asset_id LEFT JOIN energy_sites st ON st.id = a.site_id
        WHERE st.admin_area_code = aa.code OR (aa.boundary IS NOT NULL AND a.location IS NOT NULL AND ST_Intersects(aa.boundary, a.location::geometry))) AS "availableMva",
      (SELECT COALESCE(sum(pl.rated_capacity_mw::numeric), 0) FROM energy_power_lines pl JOIN energy_assets a ON a.id = pl.asset_id LEFT JOIN energy_sites st ON st.id = a.site_id
        WHERE st.admin_area_code = aa.code OR (aa.boundary IS NOT NULL AND pl.geometry IS NOT NULL AND ST_Intersects(aa.boundary, pl.geometry))) AS "lineRatedMw",
      (SELECT COALESCE(sum(f.rated_capacity_mw::numeric), 0) FROM energy_feeders f JOIN energy_assets fa ON fa.id = f.asset_id LEFT JOIN energy_assets sa ON sa.id = f.substation_asset_id LEFT JOIN energy_sites st ON st.id = sa.site_id
        WHERE st.admin_area_code = aa.code OR (aa.boundary IS NOT NULL AND COALESCE(fa.location, sa.location) IS NOT NULL AND ST_Intersects(aa.boundary, COALESCE(fa.location, sa.location)::geometry))) AS "feederRatedMw",
      (SELECT COALESCE(sum(CASE WHEN aa.boundary IS NOT NULL AND pl.geometry IS NOT NULL AND ST_Intersects(aa.boundary, pl.geometry)
        THEN ST_Length(ST_Intersection(aa.boundary, pl.geometry)::geography) ELSE COALESCE(pl.length_m::numeric, 0) END), 0) / 1000
        FROM energy_power_lines pl JOIN energy_assets a ON a.id = pl.asset_id LEFT JOIN energy_sites st ON st.id = a.site_id
        WHERE st.admin_area_code = aa.code OR (aa.boundary IS NOT NULL AND pl.geometry IS NOT NULL AND ST_Intersects(aa.boundary, pl.geometry))) AS "lineKm"
    FROM energy_admin_areas aa
  )
`;

function numericValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export async function GET(request: Request) {
  try {
    const pagination = parsePagination(new URL(request.url).searchParams);
    const populated = sql`(substations + transformers + feeders + lines + structures + positions) > 0`;
    const [rowsResult, totalResult] = await Promise.all([
      db.execute(sql`${areaStatsCte}
        SELECT * FROM area_stats
        WHERE ${populated}
        ORDER BY level, name
        LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}
      `),
      db.execute(sql`${areaStatsCte}
        SELECT count(*)::int AS total
        FROM area_stats
        WHERE ${populated}
      `),
    ]);
    const items = rowsResult.rows.map((row) => ({
      ...row,
      substations: numericValue(row.substations),
      transformers: numericValue(row.transformers),
      feeders: numericValue(row.feeders),
      lines: numericValue(row.lines),
      structures: numericValue(row.structures),
      positions: numericValue(row.positions),
      installedMva: numericValue(row.installedMva),
      transformerMva: numericValue(row.transformerMva),
      currentLoadMva: numericValue(row.currentLoadMva),
      availableMva: numericValue(row.availableMva),
      lineRatedMw: numericValue(row.lineRatedMw),
      feederRatedMw: numericValue(row.feederRatedMw),
      lineKm: numericValue(row.lineKm),
    }));
    return paginatedResponse(items, pagination, Number((totalResult.rows[0] as { total?: number | string } | undefined)?.total ?? 0));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải thống kê địa giới lưới điện.' }, { status: 500 });
  }
}
