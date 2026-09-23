import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const assetTypes = ['SUBSTATION', 'FEEDER', 'POWER_LINE'] as const;
type AssetType = (typeof assetTypes)[number];

function requestedAssetType(value: string | null): AssetType | null {
  return assetTypes.includes(value as AssetType) ? value as AssetType : null;
}

function numberValue(value: unknown) {
  if (value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

const assetsCte = sql`
  WITH latest_snapshot AS (
    SELECT DISTINCT ON (asset_id) asset_id, measured_at, source
    FROM energy_grid_operating_snapshots
    ORDER BY asset_id, measured_at DESC
  ), assets AS (
    SELECT
      a.id AS "assetId", 'SUBSTATION' AS "assetType", a.code, a.name,
      s.voltage_level_kv AS "voltageKv",
      COALESCE(s.installed_capacity_mva, s.designed_capacity_mva) AS capacity,
      s.current_load_mva AS "currentLoad",
      COALESCE(s.available_capacity_mva,
        CASE WHEN COALESCE(s.installed_capacity_mva, s.designed_capacity_mva) IS NOT NULL AND s.current_load_mva IS NOT NULL
          THEN GREATEST(0, COALESCE(s.installed_capacity_mva, s.designed_capacity_mva) - s.current_load_mva) END) AS available,
      COALESCE(s.load_factor_pct,
        CASE WHEN COALESCE(s.installed_capacity_mva, s.designed_capacity_mva) > 0 AND s.current_load_mva IS NOT NULL
          THEN s.current_load_mva / COALESCE(s.installed_capacity_mva, s.designed_capacity_mva) * 100 END) AS "loadFactor",
      s.overload_status AS status, 'MVA' AS unit,
      ls.measured_at AS "latestAt", ls.source
    FROM energy_substations s
    INNER JOIN energy_assets a ON a.id = s.asset_id
    LEFT JOIN latest_snapshot ls ON ls.asset_id = a.id

    UNION ALL

    SELECT
      a.id AS "assetId", 'FEEDER' AS "assetType", a.code, a.name,
      f.voltage_level_kv AS "voltageKv",
      f.rated_capacity_mw AS capacity,
      f.current_load_mw AS "currentLoad",
      COALESCE(f.headroom_mw,
        CASE WHEN f.rated_capacity_mw IS NOT NULL AND f.current_load_mw IS NOT NULL
          THEN GREATEST(0, f.rated_capacity_mw - f.current_load_mw) END) AS available,
      CASE WHEN f.rated_capacity_mw > 0 AND f.current_load_mw IS NOT NULL
        THEN f.current_load_mw / f.rated_capacity_mw * 100 END AS "loadFactor",
      CASE WHEN f.rated_capacity_mw IS NULL OR f.current_load_mw IS NULL THEN 'UNKNOWN'
        WHEN f.current_load_mw / f.rated_capacity_mw * 100 >= 100 THEN 'OVERLOAD'
        WHEN f.current_load_mw / f.rated_capacity_mw * 100 >= 90 THEN 'CRITICAL'
        WHEN f.current_load_mw / f.rated_capacity_mw * 100 >= 80 THEN 'WARNING'
        ELSE 'NORMAL' END AS status,
      'MW' AS unit, ls.measured_at AS "latestAt", ls.source
    FROM energy_feeders f
    INNER JOIN energy_assets a ON a.id = f.asset_id
    LEFT JOIN latest_snapshot ls ON ls.asset_id = a.id

    UNION ALL

    SELECT
      a.id AS "assetId", 'POWER_LINE' AS "assetType", a.code, a.name,
      l.voltage_level_kv AS "voltageKv",
      l.rated_capacity_mw AS capacity,
      l.current_load_mw AS "currentLoad",
      CASE WHEN l.rated_capacity_mw IS NOT NULL AND l.current_load_mw IS NOT NULL
        THEN GREATEST(0, l.rated_capacity_mw - l.current_load_mw) END AS available,
      CASE WHEN l.rated_capacity_mw > 0 AND l.current_load_mw IS NOT NULL
        THEN l.current_load_mw / l.rated_capacity_mw * 100 END AS "loadFactor",
      CASE WHEN l.rated_capacity_mw IS NULL OR l.current_load_mw IS NULL THEN 'UNKNOWN'
        WHEN l.current_load_mw / l.rated_capacity_mw * 100 >= 100 THEN 'OVERLOAD'
        WHEN l.current_load_mw / l.rated_capacity_mw * 100 >= 90 THEN 'CRITICAL'
        WHEN l.current_load_mw / l.rated_capacity_mw * 100 >= 80 THEN 'WARNING'
        ELSE 'NORMAL' END AS status,
      'MW' AS unit, ls.measured_at AS "latestAt", ls.source
    FROM energy_power_lines l
    INNER JOIN energy_assets a ON a.id = l.asset_id
    LEFT JOIN latest_snapshot ls ON ls.asset_id = a.id
  )
`;

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const pagination = parsePagination(params);
    const assetType = requestedAssetType(params.get('assetType'));
    const filter = assetType ? sql`"assetType" = ${assetType}` : sql`TRUE`;

    const [rowsResult, countResult, snapshotResult] = await Promise.all([
      db.execute(sql`${assetsCte}
        SELECT * FROM assets
        WHERE ${filter}
        ORDER BY "loadFactor" DESC NULLS LAST, name, code
        LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}
      `),
      db.execute(sql`${assetsCte}
        SELECT
          count(*)::int AS total,
          count(*) FILTER (WHERE status = 'OVERLOAD')::int AS overloaded,
          count(*) FILTER (WHERE status IN ('CRITICAL', 'OVERLOAD'))::int AS critical,
          count(*) FILTER (WHERE status = 'WARNING')::int AS warning
        FROM assets
        WHERE ${filter}
      `),
      db.execute(sql`
        SELECT count(*)::int AS count, max(measured_at) AS latest
        FROM energy_grid_operating_snapshots
      `),
    ]);

    const items = rowsResult.rows.map((row) => ({
      ...row,
      voltageKv: numberValue(row.voltageKv),
      capacity: numberValue(row.capacity),
      currentLoad: numberValue(row.currentLoad),
      available: numberValue(row.available),
      loadFactor: numberValue(row.loadFactor),
    }));
    const counts = countResult.rows[0] as { total?: number | string; overloaded?: number | string; critical?: number | string; warning?: number | string } | undefined;
    const snapshots = snapshotResult.rows[0] as { count?: number | string; latest?: string | Date | null } | undefined;

    return paginatedResponse(items, pagination, Number(counts?.total ?? 0), {
      summary: {
        total: Number(counts?.total ?? 0),
        overloaded: Number(counts?.overloaded ?? 0),
        critical: Number(counts?.critical ?? 0),
        warning: Number(counts?.warning ?? 0),
        snapshots: Number(snapshots?.count ?? 0),
        latestSnapshotAt: snapshots?.latest ?? null,
      },
      assetType,
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải dữ liệu vận hành lưới.' }, { status: 500 });
  }
}
