import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  energyEmissionActivities, energyEmissionCalculationRuns, energyEmissionMeasurements, energyEmissionSources,
  energyVbdhRecords, energyVbdhSyncRuns,
} from '@/db/schema';
import { vbdhRecordMapSchema } from '@/lib/carbon-schemas';
import { db } from '@/lib/db';
import { calculateActivityEmission, loadEmissionFactor } from '@/server/carbon/activity-calculation';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ recordId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { recordId } = await context.params;
    const payload = vbdhRecordMapSchema.parse(await request.json());
    const [record] = await db.select().from(energyVbdhRecords).where(eq(energyVbdhRecords.id, recordId)).limit(1);
    if (!record) return NextResponse.json({ message: 'Không tìm thấy VBDH raw record.' }, { status: 404 });
    if (record.validationStatus === 'MAPPED') return NextResponse.json({ message: 'Record đã được map; hãy tạo raw import/version mới nếu cần điều chỉnh để giữ audit trail.' }, { status: 409 });
    const [source] = await db.select().from(energyEmissionSources).where(eq(energyEmissionSources.id, payload.sourceId)).limit(1);
    if (!source) return NextResponse.json({ message: 'Không tìm thấy nguồn phát thải đích.' }, { status: 404 });

    if (payload.target === 'ACTIVITY') {
      if (!payload.factorId || !payload.period || payload.quantity == null || !payload.activityUnit) return NextResponse.json({ message: 'Map Activity cần factorId, period, quantity và activityUnit.' }, { status: 400 });
      const factor = await loadEmissionFactor(payload.factorId);
      if (!factor) return NextResponse.json({ message: 'Không tìm thấy hệ số phát thải đích.' }, { status: 404 });
      const calculation = await calculateActivityEmission({ sourceId: source.id, factorId: factor.id, period: payload.period, quantity: payload.quantity, activityUnit: payload.activityUnit, co2eKg: payload.co2eKg ?? null }, factor);
      if (calculation.co2eKg == null) return NextResponse.json({ message: 'Không thể map Activity vì unit chưa tương thích hoặc chưa có conversion có provenance.', warnings: calculation.warnings }, { status: 422 });
      const period = payload.period;
      const quantity = payload.quantity;
      const activityUnit = payload.activityUnit;
      const sourceDocumentRef = payload.sourceDocumentRef ?? record.sourceDocumentRef ?? record.documentNo ?? null;
      const result = await db.transaction(async (tx) => {
        const [activity] = await tx.insert(energyEmissionActivities).values({
          sourceId: source.id, factorId: factor.id, vbdhRecordId: record.id, period, quantity: String(quantity),
          activityUnit, co2eKg: String(calculation.co2eKg), sourceSystem: 'VBDH', sourceDocumentRef, status: 'SUBMITTED',
          metadata: { vbdhRecordId: record.id, mappingVersion: record.mappingVersion, calculationMethod: calculation.methodCode, calculationMethodVersion: calculation.methodVersion, warnings: calculation.warnings },
        }).returning();
        const [run] = await tx.insert(energyEmissionCalculationRuns).values({
          activityId: activity.id, methodCode: calculation.methodCode, methodVersion: calculation.methodVersion, factorId: factor.id,
          inputHash: calculation.inputHash, inputSnapshot: calculation.inputSnapshot, outputSnapshot: calculation.outputSnapshot,
          quality: calculation.compatible && payload.co2eKg == null ? 'CALCULATED' : 'NEEDS_REVIEW', reviewStatus: 'PENDING_REVIEW',
        }).returning();
        await tx.update(energyVbdhRecords).set({ validationStatus: 'MAPPED', mappedSourceId: source.id, mappedActivityId: activity.id, errorMessage: null, updatedAt: new Date() }).where(eq(energyVbdhRecords.id, record.id));
        const [pending] = await tx.select({ count: sql<number>`count(*)::int` }).from(energyVbdhRecords).where(and(eq(energyVbdhRecords.syncRunId, record.syncRunId), eq(energyVbdhRecords.validationStatus, 'NEEDS_REVIEW')));
        await tx.update(energyVbdhSyncRuns).set({ recordsMapped: sql`${energyVbdhSyncRuns.recordsMapped} + 1`, recordsNeedsReview: sql`GREATEST(${energyVbdhSyncRuns.recordsNeedsReview} - 1, 0)`, status: Number(pending.count) > 0 ? 'PARTIALLY_MAPPED' : 'COMPLETED' }).where(eq(energyVbdhSyncRuns.id, record.syncRunId));
        return { activity, run };
      });
      return NextResponse.json({ target: 'ACTIVITY', item: result.activity, calculationRun: result.run, warnings: calculation.warnings }, { status: 201 });
    }

    if (!payload.metricCode || payload.value == null || !payload.unit) return NextResponse.json({ message: 'Map Measurement cần metricCode, value và unit.' }, { status: 400 });
    const metricCode = payload.metricCode;
    const value = payload.value;
    const unit = payload.unit;
    const measuredAt = payload.measuredAt ? new Date(payload.measuredAt) : record.receivedAt ?? record.issuedAt;
    if (!measuredAt) return NextResponse.json({ message: 'Measurement cần measuredAt hoặc issuedAt/receivedAt trong raw record.' }, { status: 400 });
    const periodFrom = payload.periodFrom ? new Date(payload.periodFrom) : null;
    const periodTo = payload.periodTo ? new Date(payload.periodTo) : null;
    const sourceDocumentRef = payload.sourceDocumentRef ?? record.sourceDocumentRef ?? record.documentNo ?? null;
    const result = await db.transaction(async (tx) => {
      const [measurement] = await tx.insert(energyEmissionMeasurements).values({
        sourceId: source.id, vbdhRecordId: record.id, metricCode, periodFrom, periodTo, measuredAt,
        value: String(value), unit, measurementMethod: payload.measurementMethod ?? null, instrumentRef: payload.instrumentRef ?? null,
        sourceSystem: 'VBDH', sourceRecordId: record.sourceRecordId, sourceDocumentRef, quality: payload.quality, verificationStatus: payload.verificationStatus,
        metadata: { vbdhRecordId: record.id, mappingVersion: record.mappingVersion },
      }).returning();
      await tx.update(energyVbdhRecords).set({ validationStatus: 'MAPPED', mappedSourceId: source.id, mappedMeasurementId: measurement.id, errorMessage: null, updatedAt: new Date() }).where(eq(energyVbdhRecords.id, record.id));
      const [pending] = await tx.select({ count: sql<number>`count(*)::int` }).from(energyVbdhRecords).where(and(eq(energyVbdhRecords.syncRunId, record.syncRunId), eq(energyVbdhRecords.validationStatus, 'NEEDS_REVIEW')));
      await tx.update(energyVbdhSyncRuns).set({ recordsMapped: sql`${energyVbdhSyncRuns.recordsMapped} + 1`, recordsNeedsReview: sql`GREATEST(${energyVbdhSyncRuns.recordsNeedsReview} - 1, 0)`, status: Number(pending.count) > 0 ? 'PARTIALLY_MAPPED' : 'COMPLETED' }).where(eq(energyVbdhSyncRuns.id, record.syncRunId));
      return measurement;
    });
    return NextResponse.json({ target: 'MEASUREMENT', item: result, warnings: measuredAt === record.receivedAt || measuredAt === record.issuedAt ? ['MEASURED_AT_DERIVED_FROM_VBDH_RECORD_DATE: hãy xác nhận timestamp đo nếu cần.'] : [] }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Mapping VBDH không hợp lệ.', issues: error.issues }, { status: 400 });
    const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : undefined;
    if (code === '23505') return NextResponse.json({ message: 'Bản ghi đích đã tồn tại với cùng provenance/source key hoặc calculation input.' }, { status: 409 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể map VBDH raw record.' }, { status: 400 });
  }
}
