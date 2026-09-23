import { and, eq, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyConsumerReportLines, energyConsumerReports } from '@/db/schema';
import { db } from '@/lib/db';
import { reportPatchSchema } from '@/lib/efficiency-schemas';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ reportId: string }> };

async function loadReport(reportId: string) {
  const [report] = await db.select().from(energyConsumerReports).where(eq(energyConsumerReports.id, reportId)).limit(1);
  if (!report) return null;
  const lines = await db.select().from(energyConsumerReportLines).where(eq(energyConsumerReportLines.reportId, reportId));
  return { ...report, reportedEnergyKwh: Number(report.reportedEnergyKwh), lines: lines.map((line) => ({ ...line, value: Number(line.value) })) };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { reportId } = await context.params;
    z.string().uuid().parse(reportId);
    const report = await loadReport(reportId);
    if (!report) return NextResponse.json({ message: 'Không tìm thấy báo cáo đơn vị.' }, { status: 404 });
    return NextResponse.json({ report });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Mã báo cáo không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải báo cáo.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { reportId } = await context.params;
    z.string().uuid().parse(reportId);
    const payload = reportPatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) return NextResponse.json({ message: 'Không có trường nào để cập nhật.' }, { status: 400 });
    await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(energyConsumerReports).where(eq(energyConsumerReports.id, reportId)).limit(1);
      if (!existing) throw new Error('Không tìm thấy báo cáo đơn vị.');
      if (payload.period && payload.period !== existing.period) {
        const [conflict] = await tx.select({ id: energyConsumerReports.id }).from(energyConsumerReports).where(and(
          eq(energyConsumerReports.consumerId, existing.consumerId),
          eq(energyConsumerReports.period, payload.period),
          ne(energyConsumerReports.id, reportId),
        )).limit(1);
        if (conflict) throw new Error(`Kỳ ${payload.period} đã có báo cáo cho đơn vị này.`);
      }
      const existingMetadata = (existing.metadata ?? {}) as Record<string, unknown>;
      const metadata = {
        ...existingMetadata,
        ...(Object.prototype.hasOwnProperty.call(payload, 'notes') ? { notes: payload.notes ?? null } : {}),
        ...(payload.submittedBy ? { submittedBy: payload.submittedBy } : {}),
      };
      await tx.update(energyConsumerReports).set({
        ...(payload.period ? { period: payload.period, periodFrom: payload.periodFrom ?? payload.period, periodTo: payload.periodTo ?? payload.period } : {}),
        ...(payload.reportType ? { reportType: payload.reportType } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'periodFrom') ? { periodFrom: payload.periodFrom ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'periodTo') ? { periodTo: payload.periodTo ?? null } : {}),
        ...(payload.reportVersion ? { reportVersion: payload.reportVersion } : {}),
        ...(payload.reportedEnergyKwh !== undefined ? { reportedEnergyKwh: String(payload.reportedEnergyKwh) } : {}),
        ...(payload.status ? { status: payload.status, submittedAt: payload.status === 'DRAFT' ? null : new Date() } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'submittedBy') ? { submittedBy: payload.submittedBy ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'documentRef') ? { documentRef: payload.documentRef ?? null } : {}),
        metadata,
      }).where(eq(energyConsumerReports.id, reportId));
      if (payload.reportedEnergyKwh !== undefined) {
        await tx.insert(energyConsumerReportLines).values({
          reportId,
          metricCode: 'TOTAL_ENERGY_KWH',
          value: String(payload.reportedEnergyKwh),
          unit: 'kWh',
          source: 'CONSUMER_REPORT',
          quality: 'REPORTED',
        }).onConflictDoUpdate({
          target: [energyConsumerReportLines.reportId, energyConsumerReportLines.metricCode],
          set: { value: String(payload.reportedEnergyKwh), updatedAt: new Date() },
        });
      }
    });
    const report = await loadReport(reportId);
    return NextResponse.json({ report });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin cập nhật báo cáo không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật báo cáo.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { reportId } = await context.params;
    z.string().uuid().parse(reportId);
    const [updated] = await db.update(energyConsumerReports).set({ status: 'ARCHIVED' })
      .where(eq(energyConsumerReports.id, reportId)).returning({ id: energyConsumerReports.id });
    if (!updated) return NextResponse.json({ message: 'Không tìm thấy báo cáo đơn vị.' }, { status: 404 });
    return NextResponse.json({ deleted: true, reportId, message: 'Báo cáo đã được chuyển sang ARCHIVED để bảo toàn dữ liệu đối soát.' });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Mã báo cáo không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu trạng thái báo cáo.' }, { status: 400 });
  }
}
