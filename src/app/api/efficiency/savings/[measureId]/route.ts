import { and, eq, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyEfficiencyBaselines, energySavingMeasures } from '@/db/schema';
import { db } from '@/lib/db';
import { savingMeasurePatchSchema } from '@/lib/efficiency-schemas';
import { calculateSavingRate, readSavingMeasure } from '@/lib/efficiency-saving-api';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ measureId: string }> };
const paramsSchema = z.object({ measureId: z.string().uuid() });

function dateOrNull(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('Ngày/giờ biện pháp không hợp lệ.');
  return parsed;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { measureId } = paramsSchema.parse(await context.params);
    const item = await readSavingMeasure(measureId);
    if (!item) return NextResponse.json({ message: 'Không tìm thấy biện pháp tiết kiệm.' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'ID biện pháp không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải biện pháp tiết kiệm.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { measureId } = paramsSchema.parse(await context.params);
    const payload = savingMeasurePatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) return NextResponse.json({ message: 'Không có trường nào để cập nhật.' }, { status: 400 });
    const [existing] = await db.select().from(energySavingMeasures).where(eq(energySavingMeasures.id, measureId)).limit(1);
    if (!existing) return NextResponse.json({ message: 'Không tìm thấy biện pháp tiết kiệm.' }, { status: 404 });
    const baselineId = Object.prototype.hasOwnProperty.call(payload, 'baselineId') ? payload.baselineId : existing.baselineId;
    let baselineKwh: number | null = null;
    if (baselineId) {
      const [baseline] = await db.select({ consumerId: energyEfficiencyBaselines.consumerId, baselineKwh: energyEfficiencyBaselines.baselineKwh })
        .from(energyEfficiencyBaselines).where(and(eq(energyEfficiencyBaselines.id, baselineId), ne(energyEfficiencyBaselines.status, 'ARCHIVED'))).limit(1);
      if (!baseline) return NextResponse.json({ message: 'Không tìm thấy baseline đang sử dụng.' }, { status: 400 });
      if (baseline.consumerId !== existing.consumerId) return NextResponse.json({ message: 'Baseline không thuộc đơn vị của biện pháp.' }, { status: 400 });
      baselineKwh = Number(baseline.baselineKwh);
    }
    const actualSavingKwhYear = Object.prototype.hasOwnProperty.call(payload, 'actualSavingKwhYear') ? payload.actualSavingKwhYear : (existing.actualSavingKwhYear == null ? null : Number(existing.actualSavingKwhYear));
    const status = payload.status ?? existing.status;
    const evidenceRef = Object.prototype.hasOwnProperty.call(payload, 'evidenceRef') ? payload.evidenceRef : existing.evidenceRef;
    const verifiedBy = Object.prototype.hasOwnProperty.call(payload, 'verifiedBy') ? payload.verifiedBy : existing.verifiedBy;
    if (status === 'VERIFIED' && (actualSavingKwhYear == null || !evidenceRef || !verifiedBy)) {
      return NextResponse.json({ message: 'Measure VERIFIED cần actual saving, evidence và người xác nhận.', issues: [{ path: ['evidenceRef'], message: 'Thiếu bằng chứng hoặc người xác nhận.' }] }, { status: 400 });
    }
    const calculatedRate = calculateSavingRate(actualSavingKwhYear, baselineKwh);
    if (calculatedRate != null && payload.savingRatePct != null && Math.abs(calculatedRate - payload.savingRatePct) > 0.01) {
      return NextResponse.json({ message: 'savingRatePct không khớp actual saving / baseline.', issues: [{ path: ['savingRatePct'], message: `Giá trị tính được là ${calculatedRate.toFixed(4)}%.` }] }, { status: 400 });
    }
    await db.update(energySavingMeasures).set({
      ...(baselineId !== undefined ? { baselineId: baselineId ?? null } : {}),
      ...(payload.measureCode !== undefined ? { measureCode: payload.measureCode } : {}),
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.estimatedSavingKwhYear !== undefined ? { estimatedSavingKwhYear: payload.estimatedSavingKwhYear == null ? null : String(payload.estimatedSavingKwhYear) } : {}),
      ...(payload.actualSavingKwhYear !== undefined ? { actualSavingKwhYear: payload.actualSavingKwhYear == null ? null : String(payload.actualSavingKwhYear) } : {}),
      ...(calculatedRate != null ? { savingRatePct: String(calculatedRate) } : (payload.savingRatePct !== undefined ? { savingRatePct: payload.savingRatePct == null ? null : String(payload.savingRatePct) } : {})),
      ...(payload.investmentCost !== undefined ? { investmentCost: payload.investmentCost == null ? null : String(payload.investmentCost) } : {}),
      ...(payload.targetCompletionAt !== undefined ? { targetCompletionAt: dateOrNull(payload.targetCompletionAt) } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'sourceRef') ? { sourceRef: payload.sourceRef ?? null } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'evidenceRef') ? { evidenceRef: payload.evidenceRef ?? null } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'verifiedBy') ? { verifiedBy: payload.verifiedBy ?? null } : {}),
      ...(payload.verifiedAt !== undefined ? { verifiedAt: dateOrNull(payload.verifiedAt) } : {}),
      ...(payload.metadata !== undefined ? { metadata: payload.metadata } : {}),
      updatedAt: new Date(),
    }).where(eq(energySavingMeasures.id, measureId));
    return NextResponse.json({ item: await readSavingMeasure(measureId) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Biện pháp tiết kiệm không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật biện pháp tiết kiệm.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { measureId } = paramsSchema.parse(await context.params);
    const [updated] = await db.update(energySavingMeasures).set({ status: 'ARCHIVED' })
      .where(and(eq(energySavingMeasures.id, measureId), ne(energySavingMeasures.status, 'ARCHIVED')))
      .returning({ id: energySavingMeasures.id });
    if (!updated) return NextResponse.json({ message: 'Không tìm thấy biện pháp đang hoạt động.' }, { status: 404 });
    return NextResponse.json({ deleted: true, measureId, archived: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'ID biện pháp không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể archive biện pháp.' }, { status: 400 });
  }
}
