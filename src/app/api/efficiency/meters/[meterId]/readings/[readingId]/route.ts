import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyMeasurements } from '@/db/schema';
import { db } from '@/lib/db';
import { canonicalMetricCodeSchema, meterReadingPatchSchema } from '@/lib/efficiency-schemas';
import { loadMeter } from '@/server/efficiency/meter';
import { ensureCanonicalMetricDefinition } from '@/server/efficiency/metrics';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ meterId: string; readingId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { meterId, readingId } = await context.params;
    z.string().uuid().parse(meterId);
    z.string().uuid().parse(readingId);
    const payload = meterReadingPatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) return NextResponse.json({ message: 'Không có trường nào để cập nhật.' }, { status: 400 });
    const meter = await loadMeter(meterId);
    if (!meter?.measurementPointId) return NextResponse.json({ message: 'Không tìm thấy công tơ hoặc measurement point.' }, { status: 404 });

    const [existing] = await db.select().from(energyMeasurements).where(and(
      eq(energyMeasurements.id, readingId),
      eq(energyMeasurements.measurementPointId, meter.measurementPointId),
    )).limit(1);
    if (!existing) return NextResponse.json({ message: 'Không tìm thấy bản ghi đo của công tơ.' }, { status: 404 });
    const metricCode = canonicalMetricCodeSchema.parse(payload.metricCode ?? existing.metricCode);
    await db.transaction(async (tx) => {
      await ensureCanonicalMetricDefinition(tx, metricCode);
      await tx.update(energyMeasurements).set({
        ...(payload.metricCode ? { metricCode: payload.metricCode } : {}),
        ...(payload.measuredAt ? { measuredAt: new Date(payload.measuredAt) } : {}),
        ...(payload.value !== undefined ? { value: String(payload.value) } : {}),
        ...(payload.unit ? { unit: payload.unit } : {}),
        ...(payload.quality ? { quality: payload.quality } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'sourceId') ? { sourceId: payload.sourceId ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'rawValue') ? { rawValue: payload.rawValue ?? null } : {}),
        ...(payload.metadata ? { metadata: { ...payload.metadata, smartMeterId: meterId } } : {}),
      }).where(and(
        eq(energyMeasurements.id, readingId),
        eq(energyMeasurements.measurementPointId, meter.measurementPointId as string),
      ));
    });
    const [updated] = await db.select().from(energyMeasurements).where(eq(energyMeasurements.id, readingId)).limit(1);
    return NextResponse.json(updated ? { ...updated, value: Number(updated.value) } : null);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Bản ghi đo không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật bản ghi đo.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { meterId, readingId } = await context.params;
    z.string().uuid().parse(meterId);
    z.string().uuid().parse(readingId);
    const meter = await loadMeter(meterId);
    if (!meter?.measurementPointId) return NextResponse.json({ message: 'Không tìm thấy công tơ hoặc measurement point.' }, { status: 404 });
    const [deleted] = await db.delete(energyMeasurements).where(and(
      eq(energyMeasurements.id, readingId),
      eq(energyMeasurements.measurementPointId, meter.measurementPointId),
    )).returning({ id: energyMeasurements.id });
    if (!deleted) return NextResponse.json({ message: 'Không tìm thấy bản ghi đo của công tơ.' }, { status: 404 });
    return NextResponse.json({ deleted: true, readingId });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Mã bản ghi không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể xóa bản ghi đo.' }, { status: 400 });
  }
}
