import { eq } from 'drizzle-orm';
import { energyEfficiencyBenchmarks } from '@/db/schema';
import { db } from '@/lib/db';

function serialize<T extends Record<string, unknown>>(row: T) {
  return {
    ...row,
    benchmarkValue: row.benchmarkValue == null ? null : Number(row.benchmarkValue),
    lowerBound: row.lowerBound == null ? null : Number(row.lowerBound),
    upperBound: row.upperBound == null ? null : Number(row.upperBound),
  };
}

export async function readBenchmark(id: string) {
  const [row] = await db.select().from(energyEfficiencyBenchmarks).where(eq(energyEfficiencyBenchmarks.id, id)).limit(1);
  return row ? serialize(row as Record<string, unknown>) : null;
}
