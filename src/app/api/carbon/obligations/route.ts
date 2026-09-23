import { count, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyParties, energyReportingObligations } from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const schema = z.object({
  partyId: z.string().uuid(),
  reportType: z.string().trim().min(2).max(120),
  period: z.string().trim().min(4).max(20),
  dueAt: z.string().min(1),
  status: z.enum(['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'COMPLETED', 'OVERDUE', 'WAIVED']).default('PENDING'),
  sourceSystem: z.string().trim().min(2).max(80).default('VBDH'),
  sourceDocumentRef: z.string().trim().max(1000).nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const query = db.select({
      id: energyReportingObligations.id,
      partyId: energyReportingObligations.partyId,
      partyCode: energyParties.code,
      partyName: energyParties.name,
      reportType: energyReportingObligations.reportType,
      period: energyReportingObligations.period,
      dueAt: energyReportingObligations.dueAt,
      status: energyReportingObligations.status,
      sourceSystem: energyReportingObligations.sourceSystem,
      sourceDocumentRef: energyReportingObligations.sourceDocumentRef,
    }).from(energyReportingObligations)
      .innerJoin(energyParties, eq(energyParties.id, energyReportingObligations.partyId))
      .orderBy(desc(energyReportingObligations.dueAt));
    if (!wantsPagination) return NextResponse.json({ items: await query });
    const [rows, totalRows] = await Promise.all([
      query.limit(pagination.pageSize).offset(pagination.offset),
      db.select({ value: count() }).from(energyReportingObligations),
    ]);
    return paginatedResponse(rows, pagination, Number(totalRows[0]?.value ?? 0));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải nghĩa vụ báo cáo.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const dueAt = new Date(payload.dueAt);
    if (Number.isNaN(dueAt.getTime())) return NextResponse.json({ message: 'Hạn nộp không hợp lệ.' }, { status: 400 });
    const [created] = await db.insert(energyReportingObligations).values({
      partyId: payload.partyId,
      reportType: payload.reportType,
      period: payload.period,
      dueAt,
      status: payload.status,
      sourceSystem: payload.sourceSystem,
      sourceDocumentRef: payload.sourceDocumentRef ?? null,
    }).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Nghĩa vụ báo cáo không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu nghĩa vụ báo cáo.' }, { status: 400 });
  }
}
