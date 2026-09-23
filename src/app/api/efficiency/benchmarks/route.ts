import { and, count, desc, eq, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyEfficiencyBenchmarks } from '@/db/schema';
import { db } from '@/lib/db';
import { benchmarkSchema } from '@/lib/efficiency-schemas';
import { paginatedResponse, parsePagination } from '@/lib/pagination';
import { readBenchmark } from '@/lib/efficiency-benchmark-api';

export const dynamic = 'force-dynamic';

function serialize<T extends Record<string, unknown>>(row: T) {
  return {
    ...row,
    benchmarkValue: row.benchmarkValue == null ? null : Number(row.benchmarkValue),
    lowerBound: row.lowerBound == null ? null : Number(row.lowerBound),
    upperBound: row.upperBound == null ? null : Number(row.upperBound),
  };
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const sector = params.get('sector');
    const metricCode = params.get('metricCode');
    const status = params.get('status');
    const includeArchived = params.get('includeArchived') === 'true';
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const conditions = [includeArchived ? undefined : ne(energyEfficiencyBenchmarks.status, 'ARCHIVED')].filter(Boolean) as Array<ReturnType<typeof ne>>;
    if (sector) conditions.push(eq(energyEfficiencyBenchmarks.sector, sector));
    if (metricCode) conditions.push(eq(energyEfficiencyBenchmarks.metricCode, metricCode.trim().toUpperCase()));
    if (status) conditions.push(eq(energyEfficiencyBenchmarks.status, status));
    const query = db.select().from(energyEfficiencyBenchmarks)
      .where(and(...conditions)).orderBy(desc(energyEfficiencyBenchmarks.validFrom));
    const rows = wantsPagination ? await query.limit(pagination.pageSize).offset(pagination.offset) : await query;
    const totalRows = wantsPagination ? await db.select({ value: count() }).from(energyEfficiencyBenchmarks).where(and(...conditions)) : [];
    const items = rows.map((row) => serialize(row as Record<string, unknown>));
    return wantsPagination ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0)) : NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải benchmark hiệu suất.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = benchmarkSchema.parse(await request.json());
    const [row] = await db.insert(energyEfficiencyBenchmarks).values({
      sector: payload.sector,
      consumerGroup: payload.consumerGroup ?? null,
      metricCode: payload.metricCode.trim().toUpperCase(),
      benchmarkValue: String(payload.benchmarkValue),
      unit: payload.unit,
      lowerBound: payload.lowerBound == null ? null : String(payload.lowerBound),
      upperBound: payload.upperBound == null ? null : String(payload.upperBound),
      methodVersion: payload.methodVersion,
      validFrom: new Date(payload.validFrom),
      validTo: payload.validTo ? new Date(payload.validTo) : null,
      sourceRef: payload.sourceRef ?? null,
      status: payload.status,
      metadata: payload.metadata ?? {},
    }).returning();
    return NextResponse.json({ item: serialize(row as Record<string, unknown>) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Benchmark không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tạo benchmark.' }, { status: 400 });
  }
}
