import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyConsumerReportLines, energyConsumerReports } from '@/db/schema';
import { db } from '@/lib/db';
import { reportLinePatchSchema } from '@/lib/efficiency-schemas';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ reportId: string; lineId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { reportId, lineId } = await context.params;
    z.string().uuid().parse(reportId);
    z.string().uuid().parse(lineId);
    const payload = reportLinePatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) return NextResponse.json({ message: 'Không có trường nào để cập nhật.' }, { status: 400 });
    const [existing] = await db.select().from(energyConsumerReportLines).where(and(
      eq(energyConsumerReportLines.id, lineId),
      eq(energyConsumerReportLines.reportId, reportId),
    )).limit(1);
    if (!existing) return NextResponse.json({ message: 'Không tìm thấy chỉ tiêu báo cáo.' }, { status: 404 });
    const metricCode = payload.metricCode?.trim().toUpperCase() ?? existing.metricCode;
    const [updated] = await db.update(energyConsumerReportLines).set({
      ...(payload.metricCode ? { metricCode } : {}),
      ...(payload.value !== undefined ? { value: String(payload.value) } : {}),
      ...(payload.unit ? { unit: payload.unit } : {}),
      ...(payload.source ? { source: payload.source } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'sourceRef') ? { sourceRef: payload.sourceRef ?? null } : {}),
      ...(payload.quality ? { quality: payload.quality } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'notes') ? { notes: payload.notes ?? null } : {}),
      updatedAt: new Date(),
    }).where(and(eq(energyConsumerReportLines.id, lineId), eq(energyConsumerReportLines.reportId, reportId))).returning();
    if (!updated) return NextResponse.json({ message: 'Không tìm thấy chỉ tiêu báo cáo.' }, { status: 404 });
    if (metricCode === 'TOTAL_ENERGY_KWH' && payload.value !== undefined) {
      await db.update(energyConsumerReports).set({ reportedEnergyKwh: String(payload.value) }).where(eq(energyConsumerReports.id, reportId));
    }
    return NextResponse.json({ ...updated, value: Number(updated.value) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Chỉ tiêu báo cáo không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật chỉ tiêu báo cáo.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { reportId, lineId } = await context.params;
    z.string().uuid().parse(reportId);
    z.string().uuid().parse(lineId);
    const [existing] = await db.select({ id: energyConsumerReportLines.id, metricCode: energyConsumerReportLines.metricCode })
      .from(energyConsumerReportLines).where(and(eq(energyConsumerReportLines.id, lineId), eq(energyConsumerReportLines.reportId, reportId))).limit(1);
    if (!existing) return NextResponse.json({ message: 'Không tìm thấy chỉ tiêu báo cáo.' }, { status: 404 });
    if (existing.metricCode === 'TOTAL_ENERGY_KWH') return NextResponse.json({ message: 'Không thể xóa TOTAL_ENERGY_KWH; hãy cập nhật thay vì xóa để giữ header nhất quán.' }, { status: 409 });
    await db.delete(energyConsumerReportLines).where(eq(energyConsumerReportLines.id, lineId));
    return NextResponse.json({ deleted: true, lineId });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Mã chỉ tiêu không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể xóa chỉ tiêu báo cáo.' }, { status: 400 });
  }
}
