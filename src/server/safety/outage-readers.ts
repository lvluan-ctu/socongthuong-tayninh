import { eq, sql } from 'drizzle-orm';
import { energyOutagePlans, energyOutageSourceRecords } from '@/db/schema';
import { db } from '@/lib/db';

export function serializeOutagePlan(row: Record<string, unknown> | undefined) {
  if (!row) return null;
  let affectedGeometry: unknown = null;
  if (typeof row.affectedGeometry === 'string') {
    try { affectedGeometry = JSON.parse(row.affectedGeometry); } catch { affectedGeometry = null; }
  } else {
    affectedGeometry = row.affectedGeometry ?? null;
  }
  return {
    ...row,
    affectedCustomers: row.affectedCustomers == null ? null : Number(row.affectedCustomers),
    sourceRecordCount: row.sourceRecordCount == null ? 0 : Number(row.sourceRecordCount),
    affectedGeometry,
  };
}

export async function readOutagePlan(outageId: string) {
  const [row] = await db.select({
    id: energyOutagePlans.id,
    code: energyOutagePlans.code,
    source: energyOutagePlans.source,
    sourceType: energyOutagePlans.sourceType,
    sourceRecordId: energyOutagePlans.sourceRecordId,
    sourceUrl: energyOutagePlans.sourceUrl,
    announcedAt: energyOutagePlans.announcedAt,
    title: energyOutagePlans.title,
    startAt: energyOutagePlans.startAt,
    endAt: energyOutagePlans.endAt,
    affectedCustomers: energyOutagePlans.affectedCustomers,
    reason: energyOutagePlans.reason,
    status: energyOutagePlans.status,
    impactMethod: energyOutagePlans.impactMethod,
    impactCalculatedAt: energyOutagePlans.impactCalculatedAt,
    createdAt: energyOutagePlans.createdAt,
    updatedAt: energyOutagePlans.updatedAt,
    affectedGeometry: sql<string | null>`CASE WHEN ${energyOutagePlans.affectedGeometry} IS NULL THEN NULL ELSE ST_AsGeoJSON(${energyOutagePlans.affectedGeometry}) END`,
  }).from(energyOutagePlans).where(eq(energyOutagePlans.id, outageId)).limit(1);
  if (!row) return null;
  const [count] = await db.select({ count: sql<number>`COUNT(*)` }).from(energyOutageSourceRecords).where(eq(energyOutageSourceRecords.outageId, outageId));
  return serializeOutagePlan({ ...(row as Record<string, unknown>), sourceRecordCount: count?.count ?? 0 });
}
