import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyEfficiencyBenchmarks } from '@/db/schema';
import { db } from '@/lib/db';
import { benchmarkPatchSchema } from '@/lib/efficiency-schemas';
import { readBenchmark } from '@/lib/efficiency-benchmark-api';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ benchmarkId: string }> };
const paramsSchema = z.object({ benchmarkId: z.string().uuid() });

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { benchmarkId } = paramsSchema.parse(await context.params);
    const item = await readBenchmark(benchmarkId);
    if (!item) return NextResponse.json({ message: 'Không tìm thấy benchmark.' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'ID benchmark không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải benchmark.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { benchmarkId } = paramsSchema.parse(await context.params);
    const payload = benchmarkPatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) return NextResponse.json({ message: 'Không có trường nào để cập nhật.' }, { status: 400 });
    const [existing] = await db.select().from(energyEfficiencyBenchmarks).where(eq(energyEfficiencyBenchmarks.id, benchmarkId)).limit(1);
    if (!existing) return NextResponse.json({ message: 'Không tìm thấy benchmark.' }, { status: 404 });
    const validFrom = payload.validFrom ? new Date(payload.validFrom) : existing.validFrom;
    const validTo = Object.prototype.hasOwnProperty.call(payload, 'validTo') ? (payload.validTo ? new Date(payload.validTo) : null) : existing.validTo;
    if (validTo && validTo.getTime() < validFrom.getTime()) return NextResponse.json({ message: 'Ngày kết thúc phải sau ngày bắt đầu.', issues: [{ path: ['validTo'], message: 'Khoảng hiệu lực không hợp lệ.' }] }, { status: 400 });
    const lowerBound = Object.prototype.hasOwnProperty.call(payload, 'lowerBound') ? payload.lowerBound : (existing.lowerBound == null ? null : Number(existing.lowerBound));
    const upperBound = Object.prototype.hasOwnProperty.call(payload, 'upperBound') ? payload.upperBound : (existing.upperBound == null ? null : Number(existing.upperBound));
    if (lowerBound != null && upperBound != null && upperBound < lowerBound) return NextResponse.json({ message: 'Upper bound phải lớn hơn hoặc bằng lower bound.', issues: [{ path: ['upperBound'], message: 'Khoảng benchmark không hợp lệ.' }] }, { status: 400 });
    const status = payload.status ?? existing.status;
    const sourceRef = Object.prototype.hasOwnProperty.call(payload, 'sourceRef') ? payload.sourceRef : existing.sourceRef;
    if (status === 'ACTIVE' && !sourceRef) return NextResponse.json({ message: 'Benchmark ACTIVE phải có source reference.', issues: [{ path: ['sourceRef'], message: 'Thiếu source reference.' }] }, { status: 400 });
    await db.update(energyEfficiencyBenchmarks).set({
      ...(payload.sector !== undefined ? { sector: payload.sector } : {}),
      ...(payload.consumerGroup !== undefined ? { consumerGroup: payload.consumerGroup ?? null } : {}),
      ...(payload.metricCode !== undefined ? { metricCode: payload.metricCode.trim().toUpperCase() } : {}),
      ...(payload.benchmarkValue !== undefined ? { benchmarkValue: String(payload.benchmarkValue) } : {}),
      ...(payload.unit !== undefined ? { unit: payload.unit } : {}),
      ...(payload.lowerBound !== undefined ? { lowerBound: payload.lowerBound == null ? null : String(payload.lowerBound) } : {}),
      ...(payload.upperBound !== undefined ? { upperBound: payload.upperBound == null ? null : String(payload.upperBound) } : {}),
      ...(payload.methodVersion !== undefined ? { methodVersion: payload.methodVersion } : {}),
      ...(payload.validFrom !== undefined ? { validFrom } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'validTo') ? { validTo } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'sourceRef') ? { sourceRef: payload.sourceRef ?? null } : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.metadata !== undefined ? { metadata: payload.metadata } : {}),
      updatedAt: new Date(),
    }).where(eq(energyEfficiencyBenchmarks.id, benchmarkId));
    return NextResponse.json({ item: await readBenchmark(benchmarkId) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Benchmark không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật benchmark.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { benchmarkId } = paramsSchema.parse(await context.params);
    const [updated] = await db.update(energyEfficiencyBenchmarks).set({ status: 'ARCHIVED', updatedAt: new Date() })
      .where(eq(energyEfficiencyBenchmarks.id, benchmarkId)).returning({ id: energyEfficiencyBenchmarks.id });
    if (!updated) return NextResponse.json({ message: 'Không tìm thấy benchmark.' }, { status: 404 });
    return NextResponse.json({ deleted: true, benchmarkId, archived: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'ID benchmark không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể archive benchmark.' }, { status: 400 });
  }
}
