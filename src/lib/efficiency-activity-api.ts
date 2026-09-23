import { eq } from 'drizzle-orm';
import { energyConsumerActivityMetrics } from '@/db/schema';
import { db } from '@/lib/db';

function serialize<T extends Record<string, unknown>>(row: T) {
  return { ...row, value: row.value == null ? null : Number(row.value) };
}

export async function readActivityMetric(id: string) {
  const [row] = await db.select().from(energyConsumerActivityMetrics).where(eq(energyConsumerActivityMetrics.id, id)).limit(1);
  return row ? serialize(row as Record<string, unknown>) : null;
}
