import { eq } from 'drizzle-orm';
import { energyMeasurementPoints, energySmartMeters } from '@/db/schema';
import { db } from '@/lib/db';

export type EfficiencyTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function resolveMeterMeasurementPoint(
  tx: EfficiencyTransaction,
  measurementPointId: string | null | undefined,
  meterCode: string,
  provider: string,
) {
  if (measurementPointId) {
    const [point] = await tx.select().from(energyMeasurementPoints)
      .where(eq(energyMeasurementPoints.id, measurementPointId)).limit(1);
    if (!point) throw new Error('Không tìm thấy điểm đo được liên kết với công tơ.');
    return point;
  }

  const code = `METER:${meterCode}`;
  const [existing] = await tx.select().from(energyMeasurementPoints)
    .where(eq(energyMeasurementPoints.code, code)).limit(1);
  if (existing) return existing;

  const [created] = await tx.insert(energyMeasurementPoints).values({
    code,
    name: `Điểm đo công tơ ${meterCode}`,
    provider,
    externalCode: meterCode,
    status: 'ACTIVE',
    metadata: { managedBy: 'EFFICIENCY_SMART_METER_REGISTRY' },
  }).returning();
  return created;
}

export async function loadMeter(meterId: string) {
  const [row] = await db.select({
    id: energySmartMeters.id,
    consumerId: energySmartMeters.consumerId,
    siteId: energySmartMeters.siteId,
    customerAccountId: energySmartMeters.customerAccountId,
    measurementPointId: energySmartMeters.measurementPointId,
    meterCode: energySmartMeters.meterCode,
    provider: energySmartMeters.provider,
    meterType: energySmartMeters.meterType,
    manufacturer: energySmartMeters.manufacturer,
    model: energySmartMeters.model,
    serialNumber: energySmartMeters.serialNumber,
    phaseType: energySmartMeters.phaseType,
    voltageLevelKv: energySmartMeters.voltageLevelKv,
    installedAt: energySmartMeters.installedAt,
    commissionedAt: energySmartMeters.commissionedAt,
    lastInspectionAt: energySmartMeters.lastInspectionAt,
    nextInspectionDueAt: energySmartMeters.nextInspectionDueAt,
    replacementDueAt: energySmartMeters.replacementDueAt,
    status: energySmartMeters.status,
    communicationType: energySmartMeters.communicationType,
    sourceId: energySmartMeters.sourceId,
    sourceRef: energySmartMeters.sourceRef,
    confidence: energySmartMeters.confidence,
    metadata: energySmartMeters.metadata,
    createdAt: energySmartMeters.createdAt,
    updatedAt: energySmartMeters.updatedAt,
  }).from(energySmartMeters).where(eq(energySmartMeters.id, meterId)).limit(1);
  return row ?? null;
}

export function serializeMeter<T extends Record<string, unknown>>(row: T) {
  const serialized: Record<string, unknown> = { ...row };
  for (const key of ['voltageLevelKv', 'confidence']) {
    if (key in serialized) serialized[key] = serialized[key] == null ? null : Number(serialized[key]);
  }
  return serialized;
}
