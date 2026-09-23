import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { numberOrNull, resolvePeriodRange } from './period';

export type EfficiencyMetric = {
  id: string;
  name: string;
  classification: string;
  consumerGroup: string;
  importanceLevel: string;
  sector: string;
  industryZoneCode: string | null;
  areaCode: string | null;
  areaName: string;
  currentEnergyKwh: number;
  compareEnergyKwh: number;
  currentPeakKw: number;
  comparePeakKw: number;
  currentHours: number;
  currentAvgDemandKw: number | null;
  loadFactorPct: number | null;
  growthPct: number | null;
  baselineKwh: number | null;
  actualSavingKwh: number;
  savingRatePct: number | null;
  verifiedMeasures: number;
  activityValue: number | null;
  activityUnit: string | null;
  intensityKwhPerUnit: number | null;
  anomalyStatus: 'NO_BASELINE' | 'ABOVE_BASELINE' | 'AT_OR_BELOW_BASELINE';
  anomalyDeviationPct: number | null;
  baselineSourceRef: string | null;
};

export type EfficiencyBucket = {
  key: string;
  name: string;
  consumers: number;
  consumptionKwh: number;
  compareConsumptionKwh: number;
  peakKw: number;
  savingKwh: number;
  baselineKwh: number;
  activityValue: number;
  activityUnit: string | null;
  growthPct: number | null;
  loadFactorPct: number | null;
  savingRatePct: number | null;
  intensityKwhPerUnit: number | null;
  verifiedMeasures: number;
};

export type EfficiencyAnalytics = {
  period: { from: string; to: string; compareFrom: string; compareTo: string; label: string };
  activityMetric: string;
  totals: EfficiencyBucket;
  byArea: EfficiencyBucket[];
  bySector: EfficiencyBucket[];
  byZone: EfficiencyBucket[];
  topConsumption: EfficiencyMetric[];
  topGrowth: EfficiencyMetric[];
  topPeak: EfficiencyMetric[];
  topIntensity: EfficiencyMetric[];
  anomalies: EfficiencyMetric[];
  consumerMetrics: EfficiencyMetric[];
  warnings: string[];
  methods: { version: string; growth: string; loadFactor: string; intensity: string; anomaly: string; source: string };
};

type RawMetric = Record<string, unknown>;

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value ? value : fallback;
}

function metric(row: RawMetric): EfficiencyMetric {
  const currentEnergyKwh = Number(row.currentEnergyKwh ?? 0);
  const compareEnergyKwh = Number(row.compareEnergyKwh ?? 0);
  const currentPeakKw = Number(row.currentPeakKw ?? 0);
  const currentHours = Number(row.currentHours ?? 0);
  const currentAvgDemandKw = currentHours > 0 ? currentEnergyKwh / currentHours : null;
  const baselineKwh = numberOrNull(row.baselineKwh);
  const actualSavingKwh = Number(row.actualSavingKwh ?? 0);
  const activityValue = numberOrNull(row.activityValue);
  const growthPct = compareEnergyKwh > 0 ? (currentEnergyKwh - compareEnergyKwh) / compareEnergyKwh * 100 : null;
  const loadFactorPct = currentAvgDemandKw != null && currentPeakKw > 0 ? currentAvgDemandKw / currentPeakKw * 100 : null;
  const savingRatePct = baselineKwh != null && baselineKwh > 0 ? actualSavingKwh / baselineKwh * 100 : null;
  const intensityKwhPerUnit = activityValue != null && activityValue > 0 ? currentEnergyKwh / activityValue : null;
  const anomalyStatus = baselineKwh == null ? 'NO_BASELINE' : currentEnergyKwh > baselineKwh ? 'ABOVE_BASELINE' : 'AT_OR_BELOW_BASELINE';
  const anomalyDeviationPct = baselineKwh != null && baselineKwh > 0 ? (currentEnergyKwh - baselineKwh) / baselineKwh * 100 : null;
  return {
    id: text(row.id), name: text(row.name, 'Chưa định danh'), classification: text(row.classification, text(row.importanceLevel, 'NORMAL')),
    consumerGroup: text(row.consumerGroup, 'OTHER'), importanceLevel: text(row.importanceLevel, 'NORMAL'), sector: text(row.sector, 'Chưa phân loại'),
    industryZoneCode: typeof row.industryZoneCode === 'string' ? row.industryZoneCode : null,
    areaCode: typeof row.areaCode === 'string' ? row.areaCode : null, areaName: text(row.areaName, 'Chưa phân loại'),
    currentEnergyKwh, compareEnergyKwh, currentPeakKw, comparePeakKw: Number(row.comparePeakKw ?? 0), currentHours, currentAvgDemandKw,
    loadFactorPct, growthPct, baselineKwh, actualSavingKwh, savingRatePct, verifiedMeasures: Number(row.verifiedMeasures ?? 0),
    activityValue, activityUnit: typeof row.activityUnit === 'string' ? row.activityUnit : null, intensityKwhPerUnit, anomalyStatus, anomalyDeviationPct,
    baselineSourceRef: typeof row.baselineSourceRef === 'string' ? row.baselineSourceRef : null,
  };
}

function bucket(key: string, name: string, rows: EfficiencyMetric[]): EfficiencyBucket {
  const consumptionKwh = rows.reduce((sum, row) => sum + row.currentEnergyKwh, 0);
  const compareConsumptionKwh = rows.reduce((sum, row) => sum + row.compareEnergyKwh, 0);
  const peakKw = rows.reduce((sum, row) => sum + row.currentPeakKw, 0);
  const baselineKwh = rows.reduce((sum, row) => sum + (row.baselineKwh ?? 0), 0);
  const savingKwh = rows.reduce((sum, row) => sum + row.actualSavingKwh, 0);
  const activityRows = rows.filter((row) => row.activityValue != null && row.activityValue > 0);
  const activityValue = activityRows.reduce((sum, row) => sum + Number(row.activityValue), 0);
  const units = new Set(activityRows.map((row) => row.activityUnit).filter(Boolean));
  const activityUnit = units.size === 1 ? [...units][0] ?? null : null;
  const hours = rows.reduce((sum, row) => sum + row.currentHours, 0);
  const growthPct = compareConsumptionKwh > 0 ? (consumptionKwh - compareConsumptionKwh) / compareConsumptionKwh * 100 : null;
  const avgDemandKw = hours > 0 ? consumptionKwh / hours : null;
  const loadFactorPct = avgDemandKw != null && peakKw > 0 ? avgDemandKw / peakKw * 100 : null;
  return {
    key, name, consumers: rows.length, consumptionKwh, compareConsumptionKwh, peakKw, savingKwh, baselineKwh, activityValue,
    activityUnit, growthPct, loadFactorPct, savingRatePct: baselineKwh > 0 ? savingKwh / baselineKwh * 100 : null,
    intensityKwhPerUnit: activityValue > 0 && activityUnit ? consumptionKwh / activityValue : null,
    verifiedMeasures: rows.reduce((sum, row) => sum + row.verifiedMeasures, 0),
  };
}

function groupBy(rows: EfficiencyMetric[], keyOf: (row: EfficiencyMetric) => string | null, nameOf?: (key: string, row: EfficiencyMetric) => string) {
  const groups = new Map<string, EfficiencyMetric[]>();
  for (const row of rows) {
    const key = keyOf(row) ?? 'UNCLASSIFIED';
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
  }
  return [...groups.entries()].map(([key, values]) => bucket(key, nameOf?.(key, values[0]) ?? key, values)).sort((a, b) => b.consumptionKwh - a.consumptionKwh).slice(0, 30);
}

export async function getEfficiencyAnalytics(params: URLSearchParams): Promise<EfficiencyAnalytics> {
  const period = resolvePeriodRange(params);
  const activityMetric = (params.get('activityMetric') ?? 'PRODUCTION_OUTPUT').trim().toUpperCase();
  if (!/^[A-Z0-9_]{2,100}$/.test(activityMetric)) throw new Error('activityMetric không hợp lệ.');
  const result = await db.execute(sql`
    WITH consumption AS (
      SELECT m.account_id,
             COALESCE(SUM(m.energy_kwh) FILTER (WHERE m.period BETWEEN ${period.from} AND ${period.to}), 0)::double precision AS current_energy_kwh,
             COALESCE(SUM(m.energy_kwh) FILTER (WHERE m.period BETWEEN ${period.compareFrom} AND ${period.compareTo}), 0)::double precision AS compare_energy_kwh,
             COALESCE(MAX(m.peak_demand_kw) FILTER (WHERE m.period BETWEEN ${period.from} AND ${period.to}), 0)::double precision AS current_peak_kw,
             COALESCE(MAX(m.peak_demand_kw) FILTER (WHERE m.period BETWEEN ${period.compareFrom} AND ${period.compareTo}), 0)::double precision AS compare_peak_kw,
             COALESCE(SUM(EXTRACT(EPOCH FROM ((to_date(m.period, 'YYYY-MM') + INTERVAL '1 month') - to_date(m.period, 'YYYY-MM'))) / 3600) FILTER (WHERE m.period BETWEEN ${period.from} AND ${period.to}), 0)::double precision AS current_hours
      FROM energy_customer_consumption_monthly m
      WHERE m.period BETWEEN LEAST(${period.from}, ${period.compareFrom}) AND GREATEST(${period.to}, ${period.compareTo})
      GROUP BY m.account_id
    ), activities AS (
      SELECT a.consumer_id,
             COALESCE(SUM(a.value) FILTER (WHERE a.period BETWEEN ${period.from} AND ${period.to} AND a.metric_code = ${activityMetric} AND a.quality NOT IN ('INVALID', 'MISSING')), 0)::double precision AS activity_value,
             MAX(a.unit) FILTER (WHERE a.period BETWEEN ${period.from} AND ${period.to} AND a.metric_code = ${activityMetric} AND a.quality NOT IN ('INVALID', 'MISSING')) AS activity_unit
      FROM energy_consumer_activity_metrics a
      GROUP BY a.consumer_id
    ), latest_baselines AS (
      SELECT DISTINCT ON (b.consumer_id) b.consumer_id, b.baseline_kwh, b.source_ref
      FROM energy_efficiency_baselines b
      WHERE b.status = 'ACTIVE'
      ORDER BY b.consumer_id, b.period_to DESC, b.created_at DESC
    ), savings AS (
      SELECT s.consumer_id,
             COALESCE(SUM(s.actual_saving_kwh_year) FILTER (WHERE s.status IN ('IMPLEMENTED', 'COMPLETED', 'VERIFIED')), 0)::double precision AS actual_saving_kwh,
             COUNT(*) FILTER (WHERE s.status = 'VERIFIED')::int AS verified_measures
      FROM energy_saving_measures s
      WHERE s.status <> 'ARCHIVED'
      GROUP BY s.consumer_id
    )
    SELECT c.id,
           p.name,
           c.classification,
           c.consumer_group AS "consumerGroup",
           c.importance_level AS "importanceLevel",
           c.sector,
           c.industry_zone_code AS "industryZoneCode",
           site.admin_area_code AS "areaCode",
           COALESCE(area.name, site.admin_area_code, 'Chưa phân loại') AS "areaName",
           COALESCE(cons.current_energy_kwh, 0) AS "currentEnergyKwh",
           COALESCE(cons.compare_energy_kwh, 0) AS "compareEnergyKwh",
           COALESCE(cons.current_peak_kw, 0) AS "currentPeakKw",
           COALESCE(cons.compare_peak_kw, 0) AS "comparePeakKw",
           COALESCE(cons.current_hours, 0) AS "currentHours",
           base.baseline_kwh AS "baselineKwh",
           COALESCE(sav.actual_saving_kwh, 0) AS "actualSavingKwh",
           COALESCE(sav.verified_measures, 0) AS "verifiedMeasures",
           act.activity_value AS "activityValue",
           act.activity_unit AS "activityUnit",
           base.source_ref AS "baselineSourceRef"
    FROM energy_consumers c
    INNER JOIN energy_parties p ON p.id = c.party_id
    LEFT JOIN energy_customer_accounts account ON account.id = c.customer_account_id
    LEFT JOIN energy_sites site ON site.id = COALESCE(c.site_id, account.site_id)
    LEFT JOIN energy_admin_areas area ON area.code = site.admin_area_code
    LEFT JOIN consumption cons ON cons.account_id = account.id
    LEFT JOIN activities act ON act.consumer_id = c.id
    LEFT JOIN latest_baselines base ON base.consumer_id = c.id
    LEFT JOIN savings sav ON sav.consumer_id = c.id
    WHERE c.status = 'ACTIVE'
    ORDER BY COALESCE(cons.current_energy_kwh, 0) DESC, p.name
    LIMIT 10000
  `);
  const rows = (result.rows as RawMetric[]).map(metric);
  const totals = bucket('TOTAL', 'Toàn tỉnh', rows);
  const byArea = groupBy(rows, (row) => row.areaCode, (key, row) => key === 'UNCLASSIFIED' ? 'Chưa phân loại' : row.areaName);
  const bySector = groupBy(rows, (row) => row.sector);
  const byZone = groupBy(rows, (row) => row.industryZoneCode, (key) => key === 'UNCLASSIFIED' ? 'Ngoài KCN/CCN' : key);
  const topConsumption = [...rows].sort((a, b) => b.currentEnergyKwh - a.currentEnergyKwh).slice(0, 20);
  const topGrowth = rows.filter((row) => row.growthPct != null).sort((a, b) => Number(b.growthPct) - Number(a.growthPct)).slice(0, 20);
  const topPeak = [...rows].sort((a, b) => b.currentPeakKw - a.currentPeakKw).slice(0, 20);
  const topIntensity = rows.filter((row) => row.intensityKwhPerUnit != null).sort((a, b) => Number(b.intensityKwhPerUnit) - Number(a.intensityKwhPerUnit)).slice(0, 20);
  const anomalies = rows.filter((row) => row.anomalyStatus === 'ABOVE_BASELINE').sort((a, b) => Number(b.anomalyDeviationPct ?? 0) - Number(a.anomalyDeviationPct ?? 0)).slice(0, 20);
  const warnings: string[] = [];
  if (!rows.some((row) => row.currentEnergyKwh > 0)) warnings.push('Chưa có EVN consumption trong kỳ phân tích.');
  if (!rows.some((row) => row.compareEnergyKwh > 0)) warnings.push('Chưa có consumption kỳ so sánh; growthPct được trả null.');
  if (!rows.some((row) => row.loadFactorPct != null)) warnings.push('Chưa có peak demand hợp lệ để tính load factor.');
  if (!rows.some((row) => row.baselineKwh != null)) warnings.push('Chưa có baseline ACTIVE; anomaly và saving rate chưa thể kết luận.');
  if (!rows.some((row) => row.intensityKwhPerUnit != null)) warnings.push(`Chưa có activity metric ${activityMetric} hợp lệ; intensity được trả null.`);
  if (rows.some((row) => row.anomalyStatus === 'ABOVE_BASELINE')) warnings.push('Anomaly chỉ là candidate: current period cao hơn baseline ACTIVE; chưa gắn ngưỡng cảnh báo cố định.');
  return {
    period, activityMetric, totals, byArea, bySector, byZone, topConsumption, topGrowth, topPeak, topIntensity, anomalies, consumerMetrics: rows, warnings,
    methods: {
      version: 'EFFICIENCY_ANALYTICS_V2', growth: '(currentPeriod - comparisonPeriod) / comparisonPeriod × 100',
      loadFactor: 'averageDemand / peakDemand × 100; averageDemand = monthly energy / calendar hours',
      intensity: `current energy kWh / valid activity metric ${activityMetric}`, anomaly: 'candidate khi current energy > latest ACTIVE baseline',
      source: 'energy_customer_consumption_monthly + energy_consumer_activity_metrics + energy_efficiency_baselines + energy_saving_measures',
    },
  };
}
