import { count, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyCarbonReportSubmissions, energyParties, energyReportingObligations } from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const schema = z.object({
  obligationId: z.string().uuid(),
  submittedAt: z.string().min(1),
  status: z.enum(['SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'NEEDS_REVISION']).default('SUBMITTED'),
  totalCo2eKg: z.number().nonnegative().nullable().optional(),
  documentRef: z.string().trim().max(1000).nullable().optional(),
  sourceSystem: z.string().trim().min(2).max(80).default('VBDH'),
  sourceRecordId: z.string().trim().max(200).nullable().optional(),
  reviewedBy: z.string().trim().max(200).nullable().optional(),
  reviewDecision: z.string().trim().max(100).nullable().optional(),
  reviewNote: z.string().trim().max(2000).nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const query = db.select({
      id: energyCarbonReportSubmissions.id,
      obligationId: energyCarbonReportSubmissions.obligationId,
      partyName: energyParties.name,
      reportType: energyReportingObligations.reportType,
      period: energyReportingObligations.period,
      submittedAt: energyCarbonReportSubmissions.submittedAt,
      status: energyCarbonReportSubmissions.status,
      totalCo2eKg: energyCarbonReportSubmissions.totalCo2eKg,
      documentRef: energyCarbonReportSubmissions.documentRef,
      sourceSystem: energyCarbonReportSubmissions.sourceSystem,
      sourceRecordId: energyCarbonReportSubmissions.sourceRecordId,
      reviewedBy: energyCarbonReportSubmissions.reviewedBy,
      reviewedAt: energyCarbonReportSubmissions.reviewedAt,
      reviewDecision: energyCarbonReportSubmissions.reviewDecision,
      reviewNote: energyCarbonReportSubmissions.reviewNote,
    }).from(energyCarbonReportSubmissions)
      .innerJoin(energyReportingObligations, eq(energyReportingObligations.id, energyCarbonReportSubmissions.obligationId))
      .innerJoin(energyParties, eq(energyParties.id, energyReportingObligations.partyId))
      .orderBy(desc(energyCarbonReportSubmissions.submittedAt));
    const [rows, totalRows] = await Promise.all([
      wantsPagination ? query.limit(pagination.pageSize).offset(pagination.offset) : query,
      wantsPagination ? db.select({ value: count() }).from(energyCarbonReportSubmissions) : Promise.resolve([]),
    ]);
    const items = rows.map((row) => ({ ...row, totalCo2eKg: row.totalCo2eKg == null ? null : Number(row.totalCo2eKg) }));
    return wantsPagination
      ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0))
      : NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải hồ sơ báo cáo carbon.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const submittedAt = new Date(payload.submittedAt);
    if (Number.isNaN(submittedAt.getTime())) return NextResponse.json({ message: 'Ngày nộp không hợp lệ.' }, { status: 400 });

    const [obligation] = await db.select().from(energyReportingObligations).where(eq(energyReportingObligations.id, payload.obligationId)).limit(1);
    if (!obligation) return NextResponse.json({ message: 'Không tìm thấy nghĩa vụ báo cáo.' }, { status: 404 });

    const now = new Date();
    const reviewedAt = payload.reviewedBy ? now : null;
    const result = await db.transaction(async (tx) => {
      const [created] = await tx.insert(energyCarbonReportSubmissions).values({
        obligationId: payload.obligationId,
        submittedAt,
        status: payload.status,
        totalCo2eKg: payload.totalCo2eKg == null ? null : String(payload.totalCo2eKg),
        documentRef: payload.documentRef ?? null,
        sourceSystem: payload.sourceSystem,
        sourceRecordId: payload.sourceRecordId ?? null,
        reviewedBy: payload.reviewedBy ?? null,
        reviewedAt,
        reviewDecision: payload.reviewDecision ?? null,
        reviewNote: payload.reviewNote ?? null,
      }).returning();

      const obligationStatus = ['ACCEPTED'].includes(payload.status)
        ? 'COMPLETED'
        : payload.status === 'UNDER_REVIEW'
          ? 'UNDER_REVIEW'
          : 'SUBMITTED';
      await tx.update(energyReportingObligations).set({ status: obligationStatus }).where(eq(energyReportingObligations.id, payload.obligationId));
      return created;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Hồ sơ báo cáo carbon không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu hồ sơ báo cáo.' }, { status: 400 });
  }
}
