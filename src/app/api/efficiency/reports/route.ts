import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  energyConsumerReportLines,
  energyConsumerReports,
  energyConsumers,
  energyParties,
} from '@/db/schema';
import { db } from '@/lib/db';
import { reportSchema } from '@/lib/efficiency-schemas';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

function nullable(value: string | null | undefined) {
  return value == null || value.trim() === '' ? null : value.trim();
}

function serializeLine(line: typeof energyConsumerReportLines.$inferSelect) {
  return { ...line, value: Number(line.value) };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const consumerId = url.searchParams.get('consumerId');
    const period = url.searchParams.get('period');
    const wantsPagination = url.searchParams.get('options') !== 'true' && (url.searchParams.has('page') || url.searchParams.has('pageSize'));
    const pagination = parsePagination(url.searchParams);
    const filters = [consumerId ? eq(energyConsumerReports.consumerId, consumerId) : null, period ? eq(energyConsumerReports.period, period) : null].filter((item): item is NonNullable<typeof item> => item !== null);
    const where = filters.length ? and(...filters) : undefined;
    const listQuery = db.select({
      id: energyConsumerReports.id,
      consumerId: energyConsumerReports.consumerId,
      period: energyConsumerReports.period,
      reportType: energyConsumerReports.reportType,
      periodFrom: energyConsumerReports.periodFrom,
      periodTo: energyConsumerReports.periodTo,
      reportVersion: energyConsumerReports.reportVersion,
      reportedEnergyKwh: energyConsumerReports.reportedEnergyKwh,
      status: energyConsumerReports.status,
      submittedAt: energyConsumerReports.submittedAt,
      submittedBy: energyConsumerReports.submittedBy,
      documentRef: energyConsumerReports.documentRef,
      metadata: energyConsumerReports.metadata,
      partyName: energyParties.name,
      }).from(energyConsumerReports)
      .innerJoin(energyConsumers, eq(energyConsumers.id, energyConsumerReports.consumerId))
      .innerJoin(energyParties, eq(energyParties.id, energyConsumers.partyId))
      .where(where)
      .orderBy(desc(energyConsumerReports.period), energyParties.name);
    const rows = wantsPagination ? await listQuery.limit(pagination.pageSize).offset(pagination.offset) : await listQuery.limit(1000);
    const totalRows = wantsPagination ? await db.select({ value: count() }).from(energyConsumerReports).where(where) : [];
    const reportIds = rows.map((row) => row.id);
    const lineRows = reportIds.length ? await db.select().from(energyConsumerReportLines).where(inArray(energyConsumerReportLines.reportId, reportIds)) : [];
    const linesByReport = new Map<string, typeof lineRows>();
    for (const line of lineRows) {
      const list = linesByReport.get(line.reportId) ?? [];
      list.push(line);
      linesByReport.set(line.reportId, list);
    }
    const items = rows.map((row) => ({
      ...row,
      reportedEnergyKwh: Number(row.reportedEnergyKwh),
      lines: (linesByReport.get(row.id) ?? []).map(serializeLine),
    }));
    return wantsPagination
      ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0))
      : NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải báo cáo đơn vị.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = reportSchema.parse(await request.json());
    const result = await db.transaction(async (tx) => {
      const [consumer] = await tx.select({ id: energyConsumers.id }).from(energyConsumers).where(eq(energyConsumers.id, payload.consumerId)).limit(1);
      if (!consumer) throw new Error('Không tìm thấy đơn vị sử dụng năng lượng.');
      const submittedAt = payload.status === 'DRAFT' ? null : new Date();
      const metadata = { submittedBy: payload.submittedBy ?? 'energy-user', notes: payload.notes ?? null };
      const [report] = await tx.insert(energyConsumerReports).values({
        consumerId: payload.consumerId,
        period: payload.period,
        reportType: payload.reportType,
        periodFrom: payload.periodFrom ?? payload.period,
        periodTo: payload.periodTo ?? payload.period,
        reportVersion: payload.reportVersion,
        reportedEnergyKwh: String(payload.reportedEnergyKwh),
        status: payload.status,
        submittedAt,
        submittedBy: nullable(payload.submittedBy),
        documentRef: nullable(payload.documentRef),
        metadata,
      }).onConflictDoUpdate({
        target: [energyConsumerReports.consumerId, energyConsumerReports.period],
        set: {
          reportType: payload.reportType,
          periodFrom: payload.periodFrom ?? payload.period,
          periodTo: payload.periodTo ?? payload.period,
          reportVersion: payload.reportVersion,
          reportedEnergyKwh: String(payload.reportedEnergyKwh),
          status: payload.status,
          submittedAt,
          submittedBy: nullable(payload.submittedBy),
          documentRef: nullable(payload.documentRef),
          metadata,
        },
      }).returning();

      const lines = payload.lines ?? [];
      const totalLine = lines.find((line) => line.metricCode.toUpperCase() === 'TOTAL_ENERGY_KWH');
      const lineValues = totalLine ? lines : [{
        metricCode: 'TOTAL_ENERGY_KWH',
        value: payload.reportedEnergyKwh,
        unit: 'kWh',
        source: 'CONSUMER_REPORT',
        sourceRef: payload.documentRef ?? null,
        quality: 'REPORTED' as const,
        notes: payload.notes ?? null,
      }, ...lines];
      if (totalLine && Math.abs(totalLine.value - payload.reportedEnergyKwh) > 0.001) {
        throw new Error('TOTAL_ENERGY_KWH trong report lines phải khớp sản lượng báo cáo ở header.');
      }
      for (const line of lineValues) {
        await tx.insert(energyConsumerReportLines).values({
          reportId: report.id,
          metricCode: line.metricCode.trim().toUpperCase(),
          value: String(line.value),
          unit: line.unit,
          source: line.source,
          sourceRef: nullable(line.sourceRef),
          quality: line.quality,
          notes: nullable(line.notes),
        }).onConflictDoUpdate({
          target: [energyConsumerReportLines.reportId, energyConsumerReportLines.metricCode],
          set: {
            value: String(line.value),
            unit: line.unit,
            source: line.source,
            sourceRef: nullable(line.sourceRef),
            quality: line.quality,
            notes: nullable(line.notes),
            updatedAt: new Date(),
          },
        });
      }
      return report;
    });
    return NextResponse.json({ ...result, reportedEnergyKwh: Number(result.reportedEnergyKwh) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Báo cáo đơn vị không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu báo cáo.' }, { status: 400 });
  }
}
