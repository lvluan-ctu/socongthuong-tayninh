import { eq } from 'drizzle-orm';
import { energySavingMeasures } from '@/db/schema';
import { db } from '@/lib/db';

function serialize<T extends Record<string, unknown>>(row: T) {
  return {
    ...row,
    estimatedSavingKwhYear: row.estimatedSavingKwhYear == null ? null : Number(row.estimatedSavingKwhYear),
    actualSavingKwhYear: row.actualSavingKwhYear == null ? null : Number(row.actualSavingKwhYear),
    savingRatePct: row.savingRatePct == null ? null : Number(row.savingRatePct),
    investmentCost: row.investmentCost == null ? null : Number(row.investmentCost),
  };
}

export function calculateSavingRate(actual: number | null | undefined, baseline: number | null | undefined) {
  if (actual == null || baseline == null || baseline <= 0) return null;
  return actual / baseline * 100;
}

export async function readSavingMeasure(id: string) {
  const [row] = await db.select().from(energySavingMeasures).where(eq(energySavingMeasures.id, id)).limit(1);
  return row ? serialize(row as Record<string, unknown>) : null;
}
