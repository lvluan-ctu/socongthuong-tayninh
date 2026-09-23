import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const operationsCte = sql`
  WITH project_level AS (
    SELECT DISTINCT ON (project_asset_id) project_asset_id, active_power_mw, availability_pct
    FROM energy_generation_operational_snapshots
    WHERE unit_id IS NULL
    ORDER BY project_asset_id, measured_at DESC
  ), unit_latest AS (
    SELECT DISTINCT ON (project_asset_id, unit_id) project_asset_id, unit_id, active_power_mw, availability_pct
    FROM energy_generation_operational_snapshots
    WHERE unit_id IS NOT NULL
    ORDER BY project_asset_id, unit_id, measured_at DESC
  ), unit_rollup AS (
    SELECT project_asset_id, sum(active_power_mw::numeric) AS active_power_mw, avg(availability_pct::numeric) AS availability_pct
    FROM unit_latest
    GROUP BY project_asset_id
  ), latest_op AS (
    SELECT p.asset_id AS project_asset_id,
      COALESCE(pl.active_power_mw::numeric, ur.active_power_mw::numeric) AS active_power_mw,
      COALESCE(pl.availability_pct::numeric, ur.availability_pct::numeric) AS availability_pct
    FROM energy_generation_projects p
    LEFT JOIN project_level pl ON pl.project_asset_id = p.asset_id
    LEFT JOIN unit_rollup ur ON ur.project_asset_id = p.asset_id
  )
`;

function numberValue(value: unknown) {
  if (value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function GET(request: Request) {
  try {
    const pagination = parsePagination(new URL(request.url).searchParams);
    const [rowsResult, countResult] = await Promise.all([
      db.execute(sql`${operationsCte}
        SELECT p.asset_id AS "assetId", a.name, p.source_type AS "sourceType", p.operation_status AS status,
          p.designed_capacity_mw AS "designedMw", p.actual_capacity_mw AS "actualMw",
          lo.active_power_mw AS "latestActiveMw", lo.availability_pct AS "latestAvailabilityPct",
          (SELECT count(*)::int FROM energy_generation_plans gp WHERE gp.project_asset_id = p.asset_id AND gp.plan_level = 'NATIONAL') AS "nationalPlans",
          (SELECT count(*)::int FROM energy_generation_plans gp WHERE gp.project_asset_id = p.asset_id AND gp.plan_level IN ('PROVINCIAL', 'PROVINCE')) AS "provincialPlans",
          (SELECT count(*)::int FROM energy_generation_planning_documents d WHERE d.project_asset_id = p.asset_id) AS documents
        FROM energy_generation_projects p
        INNER JOIN energy_assets a ON a.id = p.asset_id
        LEFT JOIN latest_op lo ON lo.project_asset_id = p.asset_id
        ORDER BY p.source_type, a.name
        LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}
      `),
      db.execute(sql`SELECT count(*)::int AS total FROM energy_generation_projects`),
    ]);
    const items = rowsResult.rows.map((row) => ({
      ...row,
      designedMw: Number(row.designedMw ?? 0),
      actualMw: numberValue(row.actualMw),
      latestActiveMw: numberValue(row.latestActiveMw),
      latestAvailabilityPct: numberValue(row.latestAvailabilityPct),
      nationalPlans: Number(row.nationalPlans ?? 0),
      provincialPlans: Number(row.provincialPlans ?? 0),
      documents: Number(row.documents ?? 0),
    }));
    return paginatedResponse(items, pagination, Number((countResult.rows[0] as { total?: number | string } | undefined)?.total ?? 0));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải danh sách dự án phân tích.' }, { status: 500 });
  }
}
