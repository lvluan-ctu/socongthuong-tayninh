import { eq } from 'drizzle-orm';
import { energyEfficiencyBaselines } from '@/db/schema';
import { db } from '@/lib/db';

function serializeBaseline<T extends Record<string, unknown>>(row: T) {
  return { ...row, baselineKwh: row.baselineKwh == null ? null : Number(row.baselineKwh) };
}

export async function readBaseline(id: string) {
  const [row] = await db.select().from(energyEfficiencyBaselines).where(eq(energyEfficiencyBaselines.id, id)).limit(1);
  return row ? serializeBaseline(row as Record<string, unknown>) : null;
}
