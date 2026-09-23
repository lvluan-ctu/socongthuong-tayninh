import { and, count, desc, eq, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  energyConsumers,
  energyCustomerAccounts,
  energyEfficiencyBaselines,
  energyParties,
  energySavingMeasures,
} from '@/db/schema';
import { db } from '@/lib/db';
import { savingMeasureSchema } from '@/lib/efficiency-schemas';
import { paginatedResponse, parsePagination } from '@/lib/pagination';
import { calculateSavingRate } from '@/lib/efficiency-saving-api';

export const dynamic = 'force-dynamic';

function serialize<T extends Record<string, unknown>>(row: T) {
  return {
    ...row,
    estimatedSavingKwhYear: row.estimatedSavingKwhYear == null ? null : Number(row.estimatedSavingKwhYear),
    actualSavingKwhYear: row.actualSavingKwhYear == null ? null : Number(row.actualSavingKwhYear),
    savingRatePct: row.savingRatePct == null ? null : Number(row.savingRatePct),
    investmentCost: row.investmentCost == null ? null : Number(row.investmentCost),
  };
}

async function ensureReferences(consumerId: string, baselineId: string | null | undefined) {
  const [consumer] = await db.select({ id: energyConsumers.id }).from(energyConsumers)
    .where(and(eq(energyConsumers.id, consumerId), ne(energyConsumers.status, 'ARCHIVED'))).limit(1);
  if (!consumer) throw new Error('Không tìm thấy đơn vị sử dụng năng lượng.');
  if (!baselineId) return null;
  const [baseline] = await db.select({ id: energyEfficiencyBaselines.id, consumerId: energyEfficiencyBaselines.consumerId, baselineKwh: energyEfficiencyBaselines.baselineKwh })
    .from(energyEfficiencyBaselines).where(and(eq(energyEfficiencyBaselines.id, baselineId), ne(energyEfficiencyBaselines.status, 'ARCHIVED'))).limit(1);
  if (!baseline) throw new Error('Không tìm thấy baseline đang sử dụng.');
  if (baseline.consumerId !== consumerId) throw new Error('Baseline không thuộc đơn vị đang khai báo biện pháp.');
  return baseline;
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const consumerId = params.get('consumerId');
    const baselineId = params.get('baselineId');
    const status = params.get('status');
    const includeArchived = params.get('includeArchived') === 'true';
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    if (consumerId) z.string().uuid().parse(consumerId);
    if (baselineId) z.string().uuid().parse(baselineId);
    const conditions = [includeArchived ? undefined : ne(energySavingMeasures.status, 'ARCHIVED')].filter(Boolean) as Array<ReturnType<typeof ne>>;
    if (consumerId) conditions.push(eq(energySavingMeasures.consumerId, consumerId));
    if (baselineId) conditions.push(eq(energySavingMeasures.baselineId, baselineId));
    if (status) conditions.push(eq(energySavingMeasures.status, status));
    const query = db.select({
      id: energySavingMeasures.id,
      consumerId: energySavingMeasures.consumerId,
      baselineId: energySavingMeasures.baselineId,
      partyName: energyParties.name,
      customerCode: energyCustomerAccounts.customerCode,
      sector: energyConsumers.sector,
      consumerGroup: energyConsumers.consumerGroup,
      measureCode: energySavingMeasures.measureCode,
      name: energySavingMeasures.name,
      status: energySavingMeasures.status,
      estimatedSavingKwhYear: energySavingMeasures.estimatedSavingKwhYear,
      actualSavingKwhYear: energySavingMeasures.actualSavingKwhYear,
      savingRatePct: energySavingMeasures.savingRatePct,
      investmentCost: energySavingMeasures.investmentCost,
      targetCompletionAt: energySavingMeasures.targetCompletionAt,
      sourceRef: energySavingMeasures.sourceRef,
      evidenceRef: energySavingMeasures.evidenceRef,
      verifiedBy: energySavingMeasures.verifiedBy,
      verifiedAt: energySavingMeasures.verifiedAt,
      metadata: energySavingMeasures.metadata,
    }).from(energySavingMeasures)
      .innerJoin(energyConsumers, eq(energyConsumers.id, energySavingMeasures.consumerId))
      .innerJoin(energyParties, eq(energyParties.id, energyConsumers.partyId))
      .leftJoin(energyCustomerAccounts, eq(energyCustomerAccounts.id, energyConsumers.customerAccountId))
      .where(and(...conditions))
      .orderBy(desc(energySavingMeasures.updatedAt));
    const rows = wantsPagination ? await query.limit(pagination.pageSize).offset(pagination.offset) : await query;
    const totalRows = wantsPagination ? await db.select({ value: count() }).from(energySavingMeasures).where(and(...conditions)) : [];
    const items = rows.map((row) => serialize(row as Record<string, unknown>));
    return wantsPagination ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0)) : NextResponse.json({ items });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Bộ lọc biện pháp tiết kiệm không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải biện pháp tiết kiệm.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = savingMeasureSchema.parse(await request.json());
    const baseline = await ensureReferences(payload.consumerId, payload.baselineId);
    const calculatedRate = calculateSavingRate(payload.actualSavingKwhYear, baseline ? Number(baseline.baselineKwh) : null);
    if (calculatedRate != null && payload.savingRatePct != null && Math.abs(calculatedRate - payload.savingRatePct) > 0.01) {
      return NextResponse.json({ message: 'savingRatePct không khớp actual saving / baseline.', issues: [{ path: ['savingRatePct'], message: `Giá trị tính được là ${calculatedRate.toFixed(4)}%.` }] }, { status: 400 });
    }
    const [row] = await db.insert(energySavingMeasures).values({
      consumerId: payload.consumerId,
      baselineId: payload.baselineId ?? null,
      measureCode: payload.measureCode,
      name: payload.name,
      status: payload.status,
      estimatedSavingKwhYear: payload.estimatedSavingKwhYear == null ? null : String(payload.estimatedSavingKwhYear),
      actualSavingKwhYear: payload.actualSavingKwhYear == null ? null : String(payload.actualSavingKwhYear),
      savingRatePct: calculatedRate == null ? (payload.savingRatePct == null ? null : String(payload.savingRatePct)) : String(calculatedRate),
      investmentCost: payload.investmentCost == null ? null : String(payload.investmentCost),
      targetCompletionAt: payload.targetCompletionAt ? new Date(payload.targetCompletionAt) : null,
      sourceRef: payload.sourceRef ?? null,
      evidenceRef: payload.evidenceRef ?? null,
      verifiedBy: payload.verifiedBy ?? null,
      verifiedAt: payload.verifiedAt ? new Date(payload.verifiedAt) : null,
      metadata: payload.metadata ?? {},
    }).returning();
    return NextResponse.json({ item: serialize(row as Record<string, unknown>) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Biện pháp tiết kiệm không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tạo biện pháp tiết kiệm.' }, { status: 400 });
  }
}
