import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyConsumerActivityMetrics } from '@/db/schema';
import { db } from '@/lib/db';
import { activityMetricPatchSchema } from '@/lib/efficiency-schemas';
import { readActivityMetric } from '@/lib/efficiency-activity-api';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ metricId: string }> };
const paramsSchema = z.object({ metricId: z.string().uuid() });

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { metricId } = paramsSchema.parse(await context.params);
    const item = await readActivityMetric(metricId);
    if (!item) return NextResponse.json({ message: 'Không tìm thấy activity metric.' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'ID activity metric không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải activity metric.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { metricId } = paramsSchema.parse(await context.params);
    const payload = activityMetricPatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) return NextResponse.json({ message: 'Không có trường nào để cập nhật.' }, { status: 400 });
    const [existing] = await db.select().from(energyConsumerActivityMetrics).where(eq(energyConsumerActivityMetrics.id, metricId)).limit(1);
    if (!existing) return NextResponse.json({ message: 'Không tìm thấy activity metric.' }, { status: 404 });
    await db.update(energyConsumerActivityMetrics).set({
      ...(payload.period !== undefined ? { period: payload.period } : {}),
      ...(payload.metricCode !== undefined ? { metricCode: payload.metricCode.trim().toUpperCase() } : {}),
      ...(payload.value !== undefined ? { value: String(payload.value) } : {}),
      ...(payload.unit !== undefined ? { unit: payload.unit } : {}),
      ...(payload.source !== undefined ? { source: payload.source } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'sourceRef') ? { sourceRef: payload.sourceRef ?? null } : {}),
      ...(payload.quality !== undefined ? { quality: payload.quality } : {}),
      ...(payload.metadata !== undefined ? { metadata: payload.metadata } : {}),
      updatedAt: new Date(),
    }).where(eq(energyConsumerActivityMetrics.id, metricId));
    return NextResponse.json({ item: await readActivityMetric(metricId) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Activity metric không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật activity metric.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { metricId } = paramsSchema.parse(await context.params);
    const [deleted] = await db.delete(energyConsumerActivityMetrics).where(eq(energyConsumerActivityMetrics.id, metricId)).returning({ id: energyConsumerActivityMetrics.id });
    if (!deleted) return NextResponse.json({ message: 'Không tìm thấy activity metric.' }, { status: 404 });
    return NextResponse.json({ deleted: true, metricId });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'ID activity metric không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể xoá activity metric.' }, { status: 400 });
  }
}
