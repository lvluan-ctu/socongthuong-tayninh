import { and, count, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyConsumerActivityMetrics, energyConsumers, energyCustomerAccounts, energyParties } from '@/db/schema';
import { db } from '@/lib/db';
import { activityMetricSchema } from '@/lib/efficiency-schemas';
import { paginatedResponse, parsePagination } from '@/lib/pagination';
import { readActivityMetric } from '@/lib/efficiency-activity-api';

export const dynamic = 'force-dynamic';

function serialize<T extends Record<string, unknown>>(row: T) {
  return { ...row, value: row.value == null ? null : Number(row.value) };
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const consumerId = params.get('consumerId');
    const period = params.get('period');
    const metricCode = params.get('metricCode');
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    if (consumerId) z.string().uuid().parse(consumerId);
    const conditions = [];
    if (consumerId) conditions.push(eq(energyConsumerActivityMetrics.consumerId, consumerId));
    if (period) conditions.push(eq(energyConsumerActivityMetrics.period, period));
    if (metricCode) conditions.push(eq(energyConsumerActivityMetrics.metricCode, metricCode.trim().toUpperCase()));
    const query = db.select({
      id: energyConsumerActivityMetrics.id,
      consumerId: energyConsumerActivityMetrics.consumerId,
      partyName: energyParties.name,
      customerCode: energyCustomerAccounts.customerCode,
      period: energyConsumerActivityMetrics.period,
      metricCode: energyConsumerActivityMetrics.metricCode,
      value: energyConsumerActivityMetrics.value,
      unit: energyConsumerActivityMetrics.unit,
      source: energyConsumerActivityMetrics.source,
      sourceRef: energyConsumerActivityMetrics.sourceRef,
      quality: energyConsumerActivityMetrics.quality,
      metadata: energyConsumerActivityMetrics.metadata,
      createdAt: energyConsumerActivityMetrics.createdAt,
      updatedAt: energyConsumerActivityMetrics.updatedAt,
    }).from(energyConsumerActivityMetrics)
      .innerJoin(energyConsumers, eq(energyConsumers.id, energyConsumerActivityMetrics.consumerId))
      .innerJoin(energyParties, eq(energyParties.id, energyConsumers.partyId))
      .leftJoin(energyCustomerAccounts, eq(energyCustomerAccounts.id, energyConsumers.customerAccountId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(energyConsumerActivityMetrics.period), desc(energyConsumerActivityMetrics.updatedAt));
    const rows = wantsPagination ? await query.limit(pagination.pageSize).offset(pagination.offset) : await query;
    const totalRows = wantsPagination ? await db.select({ value: count() }).from(energyConsumerActivityMetrics).where(conditions.length ? and(...conditions) : undefined) : [];
    const items = rows.map((row) => serialize(row as Record<string, unknown>));
    return wantsPagination ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0)) : NextResponse.json({ items });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Bộ lọc activity metric không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải activity metrics.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = activityMetricSchema.parse(await request.json());
    const [consumer] = await db.select({ id: energyConsumers.id }).from(energyConsumers)
      .where(and(eq(energyConsumers.id, payload.consumerId), eq(energyConsumers.status, 'ACTIVE'))).limit(1);
    if (!consumer) return NextResponse.json({ message: 'Không tìm thấy đơn vị sử dụng năng lượng ACTIVE.' }, { status: 404 });
    const [row] = await db.insert(energyConsumerActivityMetrics).values({
      consumerId: payload.consumerId,
      period: payload.period,
      metricCode: payload.metricCode.trim().toUpperCase(),
      value: String(payload.value),
      unit: payload.unit,
      source: payload.source,
      sourceRef: payload.sourceRef ?? null,
      quality: payload.quality,
      metadata: payload.metadata ?? {},
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [energyConsumerActivityMetrics.consumerId, energyConsumerActivityMetrics.period, energyConsumerActivityMetrics.metricCode],
      set: {
        value: String(payload.value), unit: payload.unit, source: payload.source,
        sourceRef: payload.sourceRef ?? null, quality: payload.quality,
        metadata: payload.metadata ?? {}, updatedAt: new Date(),
      },
    }).returning();
    return NextResponse.json({ item: serialize(row as Record<string, unknown>) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Activity metric không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu activity metric.' }, { status: 400 });
  }
}
