import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { numberOrNull, resolvePeriodRange } from '@/server/efficiency/period';

export const dynamic = 'force-dynamic';

type GridRow = Record<string, unknown>;

function serialize(row: GridRow) {
  return {
    level: row.level,
    assetId: row.assetId,
    code: row.code,
    name: row.name,
    assetType: row.assetType,
    consumers: Number(row.consumers ?? 0),
    linkCount: Number(row.linkCount ?? 0),
    inferredCount: Number(row.inferredCount ?? 0),
    consumptionKwh: Number(row.consumptionKwh ?? 0),
    compareConsumptionKwh: Number(row.compareConsumptionKwh ?? 0),
    peakKw: Number(row.peakKw ?? 0),
    comparePeakKw: Number(row.comparePeakKw ?? 0),
    growthPct: numberOrNull(row.growthPct),
    geometry: row.geometry,
  };
}

export async function GET(request: Request) {
  try {
    const range = resolvePeriodRange(new URL(request.url).searchParams);
    const currentStart = `${range.from}-01`;
    const currentEnd = `${range.to}-01`;
    const result = await db.execute(sql`
      WITH latest_links AS (
        SELECT l.*,
               ROW_NUMBER() OVER (
                 PARTITION BY l.customer_account_id
                 ORDER BY l.valid_from DESC NULLS LAST, l.created_at DESC, l.id DESC
               ) AS rn
        FROM energy_customer_grid_service_links l
        WHERE (l.valid_from IS NULL OR l.valid_from <= (${currentEnd}::date + INTERVAL '1 month - 1 day'))
          AND (l.valid_to IS NULL OR l.valid_to >= ${currentStart}::date)
      ), consumption AS (
        SELECT m.account_id,
               COALESCE(SUM(m.energy_kwh) FILTER (WHERE m.period BETWEEN ${range.from} AND ${range.to}), 0)::double precision AS current_energy,
               COALESCE(SUM(m.energy_kwh) FILTER (WHERE m.period BETWEEN ${range.compareFrom} AND ${range.compareTo}), 0)::double precision AS compare_energy,
               COALESCE(SUM(m.peak_demand_kw) FILTER (WHERE m.period BETWEEN ${range.from} AND ${range.to}), 0)::double precision AS current_peak,
               COALESCE(SUM(m.peak_demand_kw) FILTER (WHERE m.period BETWEEN ${range.compareFrom} AND ${range.compareTo}), 0)::double precision AS compare_peak
        FROM energy_customer_consumption_monthly m
        WHERE m.period BETWEEN LEAST(${range.from}, ${range.compareFrom}) AND GREATEST(${range.to}, ${range.compareTo})
        GROUP BY m.account_id
      ), linked AS (
        SELECT c.id AS consumer_id,
               ca.id AS account_id,
               COALESCE(cons.current_energy, 0)::double precision AS current_energy,
               COALESCE(cons.compare_energy, 0)::double precision AS compare_energy,
               COALESCE(cons.current_peak, 0)::double precision AS current_peak,
               COALESCE(cons.compare_peak, 0)::double precision AS compare_peak,
               l.id AS link_id,
               l.is_inferred,
               l.feeder_asset_id,
               l.transformer_asset_id,
               l.substation_asset_id
        FROM energy_consumers c
        LEFT JOIN energy_customer_accounts ca ON ca.id = c.customer_account_id
        LEFT JOIN consumption cons ON cons.account_id = ca.id
        LEFT JOIN latest_links l ON l.customer_account_id = ca.id AND l.rn = 1
        WHERE c.status = 'ACTIVE'
      ), grouped AS (
        SELECT 'FEEDER'::text AS level, feeder_asset_id AS asset_id,
               COUNT(DISTINCT consumer_id)::int AS consumers,
               COUNT(*)::int AS link_count,
               COUNT(*) FILTER (WHERE is_inferred)::int AS inferred_count,
               COALESCE(SUM(current_energy), 0)::double precision AS consumption_kwh,
               COALESCE(SUM(compare_energy), 0)::double precision AS compare_consumption_kwh,
               COALESCE(SUM(current_peak), 0)::double precision AS peak_kw,
               COALESCE(SUM(compare_peak), 0)::double precision AS compare_peak_kw
        FROM linked WHERE feeder_asset_id IS NOT NULL GROUP BY feeder_asset_id
        UNION ALL
        SELECT 'TRANSFORMER'::text, transformer_asset_id,
               COUNT(DISTINCT consumer_id)::int, COUNT(*)::int, COUNT(*) FILTER (WHERE is_inferred)::int,
               COALESCE(SUM(current_energy), 0)::double precision, COALESCE(SUM(compare_energy), 0)::double precision,
               COALESCE(SUM(current_peak), 0)::double precision, COALESCE(SUM(compare_peak), 0)::double precision
        FROM linked WHERE transformer_asset_id IS NOT NULL GROUP BY transformer_asset_id
        UNION ALL
        SELECT 'SUBSTATION'::text, substation_asset_id,
               COUNT(DISTINCT consumer_id)::int, COUNT(*)::int, COUNT(*) FILTER (WHERE is_inferred)::int,
               COALESCE(SUM(current_energy), 0)::double precision, COALESCE(SUM(compare_energy), 0)::double precision,
               COALESCE(SUM(current_peak), 0)::double precision, COALESCE(SUM(compare_peak), 0)::double precision
        FROM linked WHERE substation_asset_id IS NOT NULL GROUP BY substation_asset_id
        UNION ALL
        SELECT 'SUMMARY'::text, NULL::uuid,
               COUNT(DISTINCT consumer_id)::int,
               COUNT(*) FILTER (WHERE link_id IS NOT NULL)::int,
               COUNT(*) FILTER (WHERE is_inferred)::int,
               COALESCE(SUM(current_energy), 0)::double precision, COALESCE(SUM(compare_energy), 0)::double precision,
               COALESCE(SUM(current_peak), 0)::double precision, COALESCE(SUM(compare_peak), 0)::double precision
        FROM linked
      )
      SELECT g.level,
             g.asset_id AS "assetId",
             a.code,
             a.name,
             a.asset_type AS "assetType",
             g.consumers,
             g.link_count AS "linkCount",
             g.inferred_count AS "inferredCount",
             g.consumption_kwh AS "consumptionKwh",
             g.compare_consumption_kwh AS "compareConsumptionKwh",
             g.peak_kw AS "peakKw",
             g.compare_peak_kw AS "comparePeakKw",
             CASE WHEN g.compare_consumption_kwh > 0 THEN (g.consumption_kwh - g.compare_consumption_kwh) / g.compare_consumption_kwh * 100 END AS "growthPct",
             CASE WHEN g.asset_id IS NULL THEN NULL ELSE ST_AsGeoJSON(COALESCE(a.location::geometry, a.boundary)) END AS geometry
      FROM grouped g
      LEFT JOIN energy_assets a ON a.id = g.asset_id
      ORDER BY CASE g.level WHEN 'SUMMARY' THEN 0 WHEN 'SUBSTATION' THEN 1 WHEN 'FEEDER' THEN 2 ELSE 3 END,
               g.consumption_kwh DESC
    `);
    const rows = (result.rows as GridRow[]).map(serialize);
    const summary = rows.find((row) => row.level === 'SUMMARY') ?? { consumers: 0, linkCount: 0, inferredCount: 0, consumptionKwh: 0, compareConsumptionKwh: 0, peakKw: 0, comparePeakKw: 0, growthPct: null };
    const warnings: string[] = [];
    if (!summary.linkCount) warnings.push('Chưa có customer-grid-service-link hiệu lực cho các consumer ACTIVE.');
    if (summary.inferredCount) warnings.push(`${summary.inferredCount} consumer đang dùng liên kết grid suy luận; cần xác minh trước quyết định vận hành.`);
    if (!summary.compareConsumptionKwh) warnings.push('Không có consumption kỳ so sánh nên growthPct được trả null.');
    return NextResponse.json({
      period: range,
      summary,
      byFeeder: rows.filter((row) => row.level === 'FEEDER'),
      byTransformer: rows.filter((row) => row.level === 'TRANSFORMER'),
      bySubstation: rows.filter((row) => row.level === 'SUBSTATION'),
      warnings,
      method: { version: 'GRID_LINKED_CONSUMPTION_V1', peak: 'SUM_CUSTOMER_MONTHLY_PEAK', linkSelection: 'LATEST_VALID_LINK_PER_ACCOUNT', source: 'energy_customer_grid_service_links + energy_customer_consumption_monthly' },
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tổng hợp analytics theo grid.', issues: error instanceof Error ? undefined : [] }, { status: 400 });
  }
}
