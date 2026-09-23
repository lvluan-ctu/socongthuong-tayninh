import { asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyConsumerReportLines, energyConsumerReports } from '@/db/schema';
import { db } from '@/lib/db';
import { reportLineSchema } from '@/lib/efficiency-schemas';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ reportId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { reportId } = await context.params;
    z.string().uuid().parse(reportId);
    const [report] = await db.select({ id: energyConsumerReports.id }).from(energyConsumerReports).where(eq(energyConsumerReports.id, reportId)).limit(1);
    if (!report) return NextResponse.json({ message: 'Không tìm thấy báo cáo đơn vị.' }, { status: 404 });
    const lines = await db.select().from(energyConsumerReportLines).where(eq(energyConsumerReportLines.reportId, reportId)).orderBy(asc(energyConsumerReportLines.metricCode));
    return NextResponse.json({ items: lines.map((line) => ({ ...line, value: Number(line.value) })) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Mã báo cáo không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải các chỉ tiêu báo cáo.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { reportId } = await context.params;
    z.string().uuid().parse(reportId);
    const payload = reportLineSchema.parse(await request.json());
    const line = await db.transaction(async (tx) => {
      const [report] = await tx.select({ id: energyConsumerReports.id }).from(energyConsumerReports).where(eq(energyConsumerReports.id, reportId)).limit(1);
      if (!report) throw new Error('Không tìm thấy báo cáo đơn vị.');
      const metricCode = payload.metricCode.trim().toUpperCase();
      const [created] = await tx.insert(energyConsumerReportLines).values({
        reportId,
        metricCode,
        value: String(payload.value),
        unit: payload.unit,
        source: payload.source,
        sourceRef: payload.sourceRef ?? null,
        quality: payload.quality,
        notes: payload.notes ?? null,
      }).onConflictDoUpdate({
        target: [energyConsumerReportLines.reportId, energyConsumerReportLines.metricCode],
        set: {
          value: String(payload.value),
          unit: payload.unit,
          source: payload.source,
          sourceRef: payload.sourceRef ?? null,
          quality: payload.quality,
          notes: payload.notes ?? null,
          updatedAt: new Date(),
        },
      }).returning();
      if (metricCode === 'TOTAL_ENERGY_KWH') {
        await tx.update(energyConsumerReports).set({ reportedEnergyKwh: String(payload.value) }).where(eq(energyConsumerReports.id, reportId));
      }
      return created;
    });
    return NextResponse.json({ ...line, value: Number(line.value) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Chỉ tiêu báo cáo không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu chỉ tiêu báo cáo.' }, { status: 400 });
  }
}
