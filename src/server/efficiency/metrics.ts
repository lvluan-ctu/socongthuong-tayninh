import { eq } from 'drizzle-orm';
import { energyMetricDefinitions } from '@/db/schema';
import type { EfficiencyTransaction } from './meter';

export const canonicalMetricDefinitions = {
  ENERGY_IMPORT_KWH: { name: 'Điện năng nhận', unit: 'kWh', aggregation: 'SUM' },
  ACTIVE_POWER_KW: { name: 'Công suất tác dụng', unit: 'kW', aggregation: 'AVG' },
  MAX_DEMAND_KW: { name: 'Công suất cực đại', unit: 'kW', aggregation: 'MAX' },
  VOLTAGE_V: { name: 'Điện áp', unit: 'V', aggregation: 'AVG' },
  CURRENT_A: { name: 'Dòng điện', unit: 'A', aggregation: 'AVG' },
  POWER_FACTOR: { name: 'Hệ số công suất', unit: 'ratio', aggregation: 'AVG' },
  PEAK_ENERGY_KWH: { name: 'Điện năng giờ cao điểm', unit: 'kWh', aggregation: 'SUM' },
  NORMAL_ENERGY_KWH: { name: 'Điện năng giờ bình thường', unit: 'kWh', aggregation: 'SUM' },
  OFFPEAK_ENERGY_KWH: { name: 'Điện năng giờ thấp điểm', unit: 'kWh', aggregation: 'SUM' },
} as const;

export async function ensureCanonicalMetricDefinition(tx: EfficiencyTransaction, metricCode: keyof typeof canonicalMetricDefinitions) {
  const definition = canonicalMetricDefinitions[metricCode];
  await tx.insert(energyMetricDefinitions).values({
    code: metricCode,
    name: definition.name,
    unit: definition.unit,
    aggregation: definition.aggregation,
    metadata: { canonical: true, owner: 'MISSION_04_EFFICIENCY' },
  }).onConflictDoNothing({ target: energyMetricDefinitions.code });
  const [row] = await tx.select().from(energyMetricDefinitions).where(eq(energyMetricDefinitions.code, metricCode)).limit(1);
  if (!row) throw new Error(`Chưa cấu hình metric canonical ${metricCode}.`);
  return row;
}

export async function ensureAllCanonicalMetricDefinitions(tx: EfficiencyTransaction) {
  for (const metricCode of Object.keys(canonicalMetricDefinitions) as Array<keyof typeof canonicalMetricDefinitions>) {
    await ensureCanonicalMetricDefinition(tx, metricCode);
  }
}
