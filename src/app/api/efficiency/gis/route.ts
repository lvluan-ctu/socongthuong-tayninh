import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getEfficiencyAnalytics, type EfficiencyMetric } from '@/server/efficiency/analytics';
import { parseGeoJson, resolvePeriodRange } from '@/server/efficiency/period';

export const dynamic = 'force-dynamic';

type Feature = { type: 'Feature'; id: string; geometry: { type: string; coordinates: unknown }; properties: Record<string, unknown> };
type Collection = { type: 'FeatureCollection'; features: Feature[] };
type RawRow = Record<string, unknown>;

function feature(layer: string, row: EfficiencyMetric, geometry: { type: string; coordinates: unknown } | null, properties: Record<string, unknown> = {}) {
  if (!geometry) return null;
  return {
    type: 'Feature' as const,
    id: row.id,
    geometry,
    properties: {
      layer, consumerId: row.id, name: row.name, sector: row.sector, areaName: row.areaName,
      consumerGroup: row.consumerGroup, importanceLevel: row.importanceLevel, industryZoneCode: row.industryZoneCode,
      currentEnergyKwh: row.currentEnergyKwh, compareEnergyKwh: row.compareEnergyKwh, growthPct: row.growthPct,
      currentPeakKw: row.currentPeakKw, loadFactorPct: row.loadFactorPct, baselineKwh: row.baselineKwh,
      actualSavingKwh: row.actualSavingKwh, savingRatePct: row.savingRatePct, intensityKwhPerUnit: row.intensityKwhPerUnit,
      anomalyStatus: row.anomalyStatus, anomalyDeviationPct: row.anomalyDeviationPct, ...properties,
    },
  };
}

function collection(features: Array<Feature | null>): Collection {
  return { type: 'FeatureCollection', features: features.filter((item): item is Feature => Boolean(item)) };
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const analytics = await getEfficiencyAnalytics(params);
    const range = resolvePeriodRange(params);
    const currentStart = `${range.from}-01`;
    const currentEnd = `${range.to}-01`;
    const [consumerGeometry, assetGeometry, zoneGeometry] = await Promise.all([
      db.execute(sql`
        WITH latest_links AS (
          SELECT l.*, ROW_NUMBER() OVER (PARTITION BY l.customer_account_id ORDER BY l.valid_from DESC NULLS LAST, l.created_at DESC, l.id DESC) AS rn
          FROM energy_customer_grid_service_links l
          WHERE (l.valid_from IS NULL OR l.valid_from <= (${currentEnd}::date + INTERVAL '1 month - 1 day'))
            AND (l.valid_to IS NULL OR l.valid_to >= ${currentStart}::date)
        )
        SELECT c.id AS "consumerId", ca.id AS "accountId", ST_AsGeoJSON(COALESCE(site.location::geometry, site.boundary)) AS geometry,
               l.id AS "linkId", l.service_point_code AS "servicePointCode", l.is_inferred AS "isInferred",
               l.feeder_asset_id AS "feederAssetId", l.transformer_asset_id AS "transformerAssetId", l.substation_asset_id AS "substationAssetId", l.bay_asset_id AS "bayAssetId"
        FROM energy_consumers c
        LEFT JOIN energy_customer_accounts ca ON ca.id = c.customer_account_id
        LEFT JOIN energy_sites site ON site.id = COALESCE(c.site_id, ca.site_id)
        LEFT JOIN latest_links l ON l.customer_account_id = ca.id AND l.rn = 1
        WHERE c.status = 'ACTIVE'
      `),
      db.execute(sql`
        SELECT a.id, a.asset_type AS "assetType", a.code, a.name, ST_AsGeoJSON(COALESCE(a.location::geometry, a.boundary)) AS geometry
        FROM energy_assets a
        WHERE a.status = 'ACTIVE' AND a.asset_type IN ('FEEDER', 'TRANSFORMER', 'SUBSTATION', 'BAY')
      `),
      db.execute(sql`
        SELECT z.id, z.code, z.name, z.zone_type AS "zoneType", z.admin_area_code AS "adminAreaCode",
               ST_AsGeoJSON(z.geometry) AS geometry
        FROM energy_load_zones z
        WHERE z.geometry IS NOT NULL
      `),
    ]);
    const consumersWithGeometry = new Map<string, { geometry: { type: string; coordinates: unknown } | null; link: RawRow }>();
    for (const row of consumerGeometry.rows as RawRow[]) {
      consumersWithGeometry.set(String(row.consumerId), { geometry: parseGeoJson(row.geometry), link: row });
    }
    const metricsById = new Map(analytics.consumerMetrics.map((row) => [row.id, row]));
    const metricRows = analytics.consumerMetrics;
    const keyConsumers = metricRows.filter((row) => ['KEY', 'NEAR_KEY'].includes(row.importanceLevel));
    const consumption = metricRows.filter((row) => row.currentEnergyKwh > 0);
    const growth = metricRows.filter((row) => row.growthPct != null);
    const saving = metricRows.filter((row) => row.actualSavingKwh > 0 || row.savingRatePct != null);
    const intensity = metricRows.filter((row) => row.intensityKwhPerUnit != null);
    const anomaly = metricRows.filter((row) => row.anomalyStatus === 'ABOVE_BASELINE');
    const featureFor = (layer: string, row: EfficiencyMetric) => feature(layer, row, consumersWithGeometry.get(row.id)?.geometry ?? null, { servicePointCode: consumersWithGeometry.get(row.id)?.link.servicePointCode ?? null, gridLinkId: consumersWithGeometry.get(row.id)?.link.linkId ?? null, gridLinkIsInferred: consumersWithGeometry.get(row.id)?.link.isInferred ?? null });
    const layerCollections = {
      keyConsumers: collection(keyConsumers.map((row) => featureFor('key-consumer', row))),
      consumption: collection(consumption.map((row) => featureFor('consumption-heatmap', row))),
      growth: collection(growth.map((row) => featureFor('growth', row))),
      saving: collection(saving.map((row) => featureFor('saving', row))),
      intensity: collection(intensity.map((row) => featureFor('intensity', row))),
      anomaly: collection(anomaly.map((row) => featureFor('anomaly', row))),
    };
    const assetStats = new Map<string, { consumers: number; inferred: number; consumptionKwh: number; peakKw: number }>();
    for (const entry of consumersWithGeometry.values()) {
      const metric = metricsById.get(String(entry.link.consumerId));
      if (!metric) continue;
      for (const assetId of [entry.link.feederAssetId, entry.link.transformerAssetId, entry.link.substationAssetId, entry.link.bayAssetId]) {
        if (!assetId) continue;
        const key = String(assetId);
        const current = assetStats.get(key) ?? { consumers: 0, inferred: 0, consumptionKwh: 0, peakKw: 0 };
        current.consumers += 1; current.inferred += entry.link.isInferred ? 1 : 0; current.consumptionKwh += metric.currentEnergyKwh; current.peakKw += metric.currentPeakKw;
        assetStats.set(key, current);
      }
    }
    const gridFeatures = (assetGeometry.rows as RawRow[]).flatMap((row) => {
      const geometry = parseGeoJson(row.geometry);
      if (!geometry) return [];
      const stats = assetStats.get(String(row.id)) ?? { consumers: 0, inferred: 0, consumptionKwh: 0, peakKw: 0 };
      return [{ type: 'Feature' as const, id: String(row.id), geometry, properties: { layer: 'grid-asset', assetId: row.id, assetType: row.assetType, code: row.code, name: row.name, ...stats } }];
    });
    const zoneFeatures = (zoneGeometry.rows as RawRow[]).flatMap((row) => {
      const geometry = parseGeoJson(row.geometry);
      if (!geometry) return [];
      const zoneRows = analytics.consumerMetrics.filter((item) => item.industryZoneCode === row.code);
      return [{ type: 'Feature' as const, id: String(row.id), geometry, properties: { layer: 'industry-zone', zoneId: row.id, code: row.code, name: row.name, zoneType: row.zoneType, adminAreaCode: row.adminAreaCode, consumers: zoneRows.length, consumptionKwh: zoneRows.reduce((sum, item) => sum + item.currentEnergyKwh, 0) } }];
    });
    const warnings = [...analytics.warnings];
    const geometryCount = [...layerCollections.keyConsumers.features, ...layerCollections.consumption.features].length;
    const layerCounts = Object.fromEntries(Object.entries(layerCollections).map(([key, item]) => [key, item.features.length]));
    layerCounts['key-consumer'] = layerCounts.keyConsumers ?? 0;
    layerCounts['consumption-heatmap'] = layerCounts.consumption ?? 0;
    if (!geometryCount) warnings.push('Không có geometry site cho các consumer đang hiển thị; hệ thống không tự geocode hoặc tạo điểm giả.');
    if (!gridFeatures.length) warnings.push('Chưa có feeder/TBA/MBA/BAY ACTIVE có geometry để vẽ trên GIS.');
    if (!zoneFeatures.length) warnings.push('Chưa có KCN/CCN geometry trong energy_load_zones; chỉ consumer có industry_zone_code mới được thống kê mã khu.');
    if ([...consumersWithGeometry.values()].filter((entry) => entry.link.isInferred).length) warnings.push('Một số customer-grid link là INFERRED; cần xác minh source EVN trước khi dùng kết quả vận hành.');
    return NextResponse.json({
      period: analytics.period,
      layers: layerCollections,
      grid: { type: 'FeatureCollection', features: gridFeatures },
      industryZones: { type: 'FeatureCollection', features: zoneFeatures },
      features: { type: 'FeatureCollection', features: [...Object.values(layerCollections).flatMap((item) => item.features), ...gridFeatures, ...zoneFeatures] },
      stats: { activeConsumers: analytics.totals.consumers, mappedConsumers: [...consumersWithGeometry.values()].filter((entry) => entry.geometry).length, linkedConsumers: [...consumersWithGeometry.values()].filter((entry) => entry.link.linkId).length, inferredLinks: [...consumersWithGeometry.values()].filter((entry) => entry.link.isInferred).length, gridAssets: gridFeatures.length, industryZones: zoneFeatures.length, layerCounts },
      warnings,
      method: { analytics: analytics.methods, geometry: 'ST_AsGeoJSON(COALESCE(site.location::geometry, site.boundary))', source: 'hệ thống GIS; no synthetic coordinate' },
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải Efficiency GIS.' }, { status: 400 });
  }
}
