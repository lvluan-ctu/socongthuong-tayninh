import { and, count, desc, eq, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  energyConsumers,
  energyCustomerAccounts,
  energyDataSources,
  energyEfficiencyBaselines,
  energyParties,
} from '@/db/schema';
import { db } from '@/lib/db';
import { baselineSchema } from '@/lib/efficiency-schemas';
import { paginatedResponse, parsePagination } from '@/lib/pagination';
import { readBaseline } from '@/lib/efficiency-baseline-api';

export const dynamic = 'force-dynamic';

function serializeBaseline<T extends Record<string, unknown>>(row: T) {
  return {
    ...row,
    baselineKwh: row.baselineKwh == null ? null : Number(row.baselineKwh),
  };
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const consumerId = params.get('consumerId');
    const status = params.get('status');
    const includeArchived = params.get('includeArchived') === 'true';
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    if (consumerId) z.string().uuid().parse(consumerId);
    const conditions = [includeArchived ? undefined : ne(energyEfficiencyBaselines.status, 'ARCHIVED')].filter(Boolean) as Array<ReturnType<typeof ne>>;
    if (consumerId) conditions.push(eq(energyEfficiencyBaselines.consumerId, consumerId));
    if (status) conditions.push(eq(energyEfficiencyBaselines.status, status));
    const query = db.select({
      id: energyEfficiencyBaselines.id,
      consumerId: energyEfficiencyBaselines.consumerId,
      consumerGroup: energyConsumers.consumerGroup,
      importanceLevel: energyConsumers.importanceLevel,
      sector: energyConsumers.sector,
      partyName: energyParties.name,
      customerCode: energyCustomerAccounts.customerCode,
      baselineType: energyEfficiencyBaselines.baselineType,
      periodFrom: energyEfficiencyBaselines.periodFrom,
      periodTo: energyEfficiencyBaselines.periodTo,
      baselineKwh: energyEfficiencyBaselines.baselineKwh,
      normalizationMethod: energyEfficiencyBaselines.normalizationMethod,
      weatherAdjusted: energyEfficiencyBaselines.weatherAdjusted,
      productionAdjusted: energyEfficiencyBaselines.productionAdjusted,
      methodVersion: energyEfficiencyBaselines.methodVersion,
      sourceId: energyEfficiencyBaselines.sourceId,
      sourceRef: energyEfficiencyBaselines.sourceRef,
      status: energyEfficiencyBaselines.status,
      notes: energyEfficiencyBaselines.notes,
      metadata: energyEfficiencyBaselines.metadata,
      createdAt: energyEfficiencyBaselines.createdAt,
      updatedAt: energyEfficiencyBaselines.updatedAt,
    }).from(energyEfficiencyBaselines)
      .innerJoin(energyConsumers, eq(energyConsumers.id, energyEfficiencyBaselines.consumerId))
      .innerJoin(energyParties, eq(energyParties.id, energyConsumers.partyId))
      .leftJoin(energyCustomerAccounts, eq(energyCustomerAccounts.id, energyConsumers.customerAccountId))
      .where(and(...conditions))
      .orderBy(desc(energyEfficiencyBaselines.periodTo), desc(energyEfficiencyBaselines.createdAt));
    const rows = wantsPagination ? await query.limit(pagination.pageSize).offset(pagination.offset) : await query;
    const totalRows = wantsPagination ? await db.select({ value: count() }).from(energyEfficiencyBaselines).where(and(...conditions)) : [];
    const items = rows.map((row) => serializeBaseline(row as Record<string, unknown>));
    return wantsPagination ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0)) : NextResponse.json({ items });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Bộ lọc baseline không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải baseline hiệu suất.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = baselineSchema.parse(await request.json());
    const [consumer] = await db.select({ id: energyConsumers.id }).from(energyConsumers)
      .where(and(eq(energyConsumers.id, payload.consumerId), ne(energyConsumers.status, 'ARCHIVED'))).limit(1);
    if (!consumer) return NextResponse.json({ message: 'Không tìm thấy đơn vị sử dụng năng lượng đang hoạt động.' }, { status: 404 });
    if (payload.sourceId) {
      const [source] = await db.select({ id: energyDataSources.id }).from(energyDataSources).where(eq(energyDataSources.id, payload.sourceId)).limit(1);
      if (!source) return NextResponse.json({ message: 'Không tìm thấy data source của baseline.' }, { status: 400 });
    }
    const [created] = await db.insert(energyEfficiencyBaselines).values({
      consumerId: payload.consumerId,
      baselineType: payload.baselineType,
      periodFrom: payload.periodFrom,
      periodTo: payload.periodTo,
      baselineKwh: String(payload.baselineKwh),
      normalizationMethod: payload.normalizationMethod,
      weatherAdjusted: payload.weatherAdjusted,
      productionAdjusted: payload.productionAdjusted,
      methodVersion: payload.methodVersion,
      sourceId: payload.sourceId ?? null,
      sourceRef: payload.sourceRef ?? null,
      status: payload.status,
      notes: payload.notes ?? null,
      metadata: payload.metadata ?? {},
    }).returning();
    return NextResponse.json({ item: serializeBaseline(created as Record<string, unknown>) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Baseline không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tạo baseline.' }, { status: 400 });
  }
}
