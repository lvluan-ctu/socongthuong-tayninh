import { count, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyEmissionActivities, energyEmissionCalculationRuns, energyEmissionFactors, energyEmissionSources } from '@/db/schema';
import { calculateActivityEmission } from '@/server/carbon/activity-calculation';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const schema = z.object({
  sourceId: z.string().uuid(),
  factorId: z.string().uuid(),
  vbdhRecordId: z.string().uuid().nullable().optional(),
  period: z.string().regex(/^\d{4}(-\d{2})?$/, 'Kỳ dữ liệu phải có dạng YYYY hoặc YYYY-MM.'),
  quantity: z.number().finite().nonnegative(),
  activityUnit: z.string().trim().min(1).max(80),
  co2eKg: z.number().finite().nonnegative().nullable().optional(),
  noxKg: z.number().finite().nonnegative().nullable().optional(),
  soxKg: z.number().finite().nonnegative().nullable().optional(),
  sourceSystem: z.enum(['MANUAL', 'VBDH', 'EVN', 'IMPORT', 'API']).default('MANUAL'),
  sourceDocumentRef: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'VERIFIED', 'APPROVED']).default('DRAFT'),
  notes: z.string().trim().max(2000).nullable().optional(),
});

function periodDate(period: string) {
  const date = new Date(`${period.length === 4 ? `${period}-01-01` : `${period}-01`}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const listQuery = db.select({
      id: energyEmissionActivities.id,
      sourceId: energyEmissionActivities.sourceId,
      sourceCode: energyEmissionSources.code,
      sourceName: energyEmissionSources.name,
      energyTypeCode: energyEmissionSources.energyTypeCode,
      sector: energyEmissionSources.sector,
      scope: energyEmissionSources.scope,
      factorId: energyEmissionActivities.factorId,
      factorCode: energyEmissionFactors.code,
      factorValue: energyEmissionFactors.factorValue,
      factorUnit: energyEmissionFactors.factorUnit,
      vbdhRecordId: energyEmissionActivities.vbdhRecordId,
      period: energyEmissionActivities.period,
      quantity: energyEmissionActivities.quantity,
      activityUnit: energyEmissionActivities.activityUnit,
      co2eKg: energyEmissionActivities.co2eKg,
      noxKg: energyEmissionActivities.noxKg,
      soxKg: energyEmissionActivities.soxKg,
      sourceSystem: energyEmissionActivities.sourceSystem,
      sourceDocumentRef: energyEmissionActivities.sourceDocumentRef,
      status: energyEmissionActivities.status,
      metadata: energyEmissionActivities.metadata,
    }).from(energyEmissionActivities)
      .innerJoin(energyEmissionSources, eq(energyEmissionSources.id, energyEmissionActivities.sourceId))
      .innerJoin(energyEmissionFactors, eq(energyEmissionFactors.id, energyEmissionActivities.factorId))
      .orderBy(desc(energyEmissionActivities.period));
    const [rows, totalRows, summaryRows] = await Promise.all([
      wantsPagination ? listQuery.limit(pagination.pageSize).offset(pagination.offset) : listQuery,
      wantsPagination ? db.select({ value: count() }).from(energyEmissionActivities) : Promise.resolve([]),
      db.select({ totalCo2eKg: sql<number>`COALESCE(SUM(${energyEmissionActivities.co2eKg}), 0)` }).from(energyEmissionActivities),
    ]);
    const items = rows.map((row) => ({
      ...row,
      factorValue: Number(row.factorValue), quantity: Number(row.quantity), co2eKg: Number(row.co2eKg),
      noxKg: row.noxKg == null ? null : Number(row.noxKg), soxKg: row.soxKg == null ? null : Number(row.soxKg),
    }));
    const summary = { totalCo2eKg: Number(summaryRows[0]?.totalCo2eKg ?? 0) };
    return wantsPagination
      ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0), { summary })
      : NextResponse.json({ items, summary });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải dữ liệu phát thải.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const [[source], [factor]] = await Promise.all([
      db.select().from(energyEmissionSources).where(eq(energyEmissionSources.id, payload.sourceId)).limit(1),
      db.select().from(energyEmissionFactors).where(eq(energyEmissionFactors.id, payload.factorId)).limit(1),
    ]);
    if (!source) return NextResponse.json({ message: 'Không tìm thấy nguồn phát thải.' }, { status: 404 });
    if (!factor) return NextResponse.json({ message: 'Không tìm thấy hệ số phát thải.' }, { status: 404 });
    if (source.status === 'INACTIVE') return NextResponse.json({ message: 'Không thể ghi activity mới cho nguồn INACTIVE.' }, { status: 409 });
    const at = periodDate(payload.period);
    if (!at) return NextResponse.json({ message: 'Kỳ dữ liệu không hợp lệ.' }, { status: 400 });
    if (factor.validFrom > at || (factor.validTo && factor.validTo < at)) return NextResponse.json({ message: 'Hệ số không có hiệu lực trong kỳ activity đã chọn.' }, { status: 400 });
    const calculation = await calculateActivityEmission({ ...payload, co2eKg: payload.co2eKg ?? null }, factor);
    if (calculation.co2eKg == null) return NextResponse.json({ message: 'Không thể tính CO2e vì đơn vị chưa tương thích hoặc chưa có conversion có provenance.', warnings: calculation.warnings }, { status: 422 });
    const metadata = {
      calculationMethod: calculation.methodCode,
      calculationMethodVersion: calculation.methodVersion,
      factorCode: factor.code,
      factorVersion: factor.sourceVersion,
      factorUnit: factor.factorUnit,
      unitCompatibilityVerified: calculation.compatible,
      warnings: calculation.warnings,
      notes: payload.notes ?? null,
    };
    const result = await db.transaction(async (tx) => {
      const [created] = await tx.insert(energyEmissionActivities).values({
        sourceId: payload.sourceId,
        factorId: payload.factorId,
        vbdhRecordId: payload.vbdhRecordId ?? null,
        period: payload.period,
        quantity: String(payload.quantity),
        activityUnit: payload.activityUnit,
        co2eKg: String(calculation.co2eKg),
        noxKg: payload.noxKg == null ? null : String(payload.noxKg),
        soxKg: payload.soxKg == null ? null : String(payload.soxKg),
        sourceSystem: payload.sourceSystem,
        sourceDocumentRef: payload.sourceDocumentRef ?? null,
        status: payload.status,
        metadata,
      }).returning();
      const [run] = await tx.insert(energyEmissionCalculationRuns).values({
        activityId: created.id,
        methodCode: calculation.methodCode,
        methodVersion: calculation.methodVersion,
        factorId: factor.id,
        inputHash: calculation.inputHash,
        inputSnapshot: calculation.inputSnapshot,
        outputSnapshot: calculation.outputSnapshot,
        quality: calculation.compatible && payload.co2eKg == null ? 'CALCULATED' : 'NEEDS_REVIEW',
        reviewStatus: 'PENDING_REVIEW',
      }).returning();
      return { created, run };
    });
    return NextResponse.json({ ...result.created, co2eKg: calculation.co2eKg, calculationRun: result.run, warnings: calculation.warnings }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Dữ liệu hoạt động phát thải không hợp lệ.', issues: error.issues }, { status: 400 });
    const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : undefined;
    if (code === '23505') return NextResponse.json({ message: 'Activity calculation đã tồn tại với cùng input hash.' }, { status: 409 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu dữ liệu phát thải.' }, { status: 400 });
  }
}
