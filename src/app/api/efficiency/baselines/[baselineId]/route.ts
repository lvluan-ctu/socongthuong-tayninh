import { and, eq, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyDataSources, energyEfficiencyBaselines } from '@/db/schema';
import { db } from '@/lib/db';
import { baselinePatchSchema } from '@/lib/efficiency-schemas';
import { readBaseline } from '@/lib/efficiency-baseline-api';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ baselineId: string }> };

const paramsSchema = z.object({ baselineId: z.string().uuid() });

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { baselineId } = paramsSchema.parse(await context.params);
    const item = await readBaseline(baselineId);
    if (!item) return NextResponse.json({ message: 'Không tìm thấy baseline.' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'ID baseline không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải baseline.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { baselineId } = paramsSchema.parse(await context.params);
    const payload = baselinePatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) return NextResponse.json({ message: 'Không có trường nào để cập nhật.' }, { status: 400 });
    const [existing] = await db.select().from(energyEfficiencyBaselines).where(eq(energyEfficiencyBaselines.id, baselineId)).limit(1);
    if (!existing) return NextResponse.json({ message: 'Không tìm thấy baseline.' }, { status: 404 });
    const periodFrom = payload.periodFrom ?? existing.periodFrom;
    const periodTo = payload.periodTo ?? existing.periodTo;
    const status = payload.status ?? existing.status;
    const sourceRef = Object.prototype.hasOwnProperty.call(payload, 'sourceRef') ? payload.sourceRef : existing.sourceRef;
    if (periodFrom > periodTo) return NextResponse.json({ message: 'Kỳ kết thúc phải sau hoặc bằng kỳ bắt đầu.', issues: [{ path: ['periodTo'], message: 'Khoảng kỳ không hợp lệ.' }] }, { status: 400 });
    if (status === 'ACTIVE' && !sourceRef) return NextResponse.json({ message: 'Baseline ACTIVE phải có source reference.', issues: [{ path: ['sourceRef'], message: 'Thiếu source reference.' }] }, { status: 400 });
    if (Object.prototype.hasOwnProperty.call(payload, 'sourceId') && payload.sourceId) {
      const [source] = await db.select({ id: energyDataSources.id }).from(energyDataSources).where(eq(energyDataSources.id, payload.sourceId)).limit(1);
      if (!source) return NextResponse.json({ message: 'Không tìm thấy data source của baseline.' }, { status: 400 });
    }
    await db.update(energyEfficiencyBaselines).set({
      ...(payload.baselineType !== undefined ? { baselineType: payload.baselineType } : {}),
      ...(payload.periodFrom !== undefined ? { periodFrom: payload.periodFrom } : {}),
      ...(payload.periodTo !== undefined ? { periodTo: payload.periodTo } : {}),
      ...(payload.baselineKwh !== undefined ? { baselineKwh: String(payload.baselineKwh) } : {}),
      ...(payload.normalizationMethod !== undefined ? { normalizationMethod: payload.normalizationMethod } : {}),
      ...(payload.weatherAdjusted !== undefined ? { weatherAdjusted: payload.weatherAdjusted } : {}),
      ...(payload.productionAdjusted !== undefined ? { productionAdjusted: payload.productionAdjusted } : {}),
      ...(payload.methodVersion !== undefined ? { methodVersion: payload.methodVersion } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'sourceId') ? { sourceId: payload.sourceId ?? null } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'sourceRef') ? { sourceRef: payload.sourceRef ?? null } : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'notes') ? { notes: payload.notes ?? null } : {}),
      ...(payload.metadata !== undefined ? { metadata: payload.metadata } : {}),
      updatedAt: new Date(),
    }).where(eq(energyEfficiencyBaselines.id, baselineId));
    return NextResponse.json({ item: await readBaseline(baselineId) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Baseline không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật baseline.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { baselineId } = paramsSchema.parse(await context.params);
    const [updated] = await db.update(energyEfficiencyBaselines).set({ status: 'ARCHIVED', updatedAt: new Date() })
      .where(and(eq(energyEfficiencyBaselines.id, baselineId), ne(energyEfficiencyBaselines.status, 'ARCHIVED')))
      .returning({ id: energyEfficiencyBaselines.id });
    if (!updated) return NextResponse.json({ message: 'Không tìm thấy baseline đang hoạt động.' }, { status: 404 });
    return NextResponse.json({ deleted: true, baselineId, archived: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'ID baseline không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể archive baseline.' }, { status: 400 });
  }
}
