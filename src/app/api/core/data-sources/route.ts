import { and, asc, eq, ilike, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyDataQualityIssues, energyDataSources, energyImportBatches } from '@/db/schema';
import { dataSourceSchema } from '@/lib/core-schemas';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

function dateOrNull(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const status = query.get('status')?.trim();
    const search = query.get('search')?.trim();
    const wantsPagination = query.get('options') !== 'true' && (query.has('page') || query.has('pageSize'));
    const pagination = parsePagination(query);
    const where = and(
      status && status !== 'ALL' ? eq(energyDataSources.status, status) : undefined,
      search ? ilike(energyDataSources.name, `%${search}%`) : undefined,
    );
    const select = {
      id: energyDataSources.id,
      code: energyDataSources.code,
      name: energyDataSources.name,
      provider: energyDataSources.provider,
      sourceType: energyDataSources.sourceType,
      owner: energyDataSources.owner,
      endpointRef: energyDataSources.endpointRef,
      schedule: energyDataSources.schedule,
      refreshCadence: energyDataSources.refreshCadence,
      authoritativeLevel: energyDataSources.authoritativeLevel,
      status: energyDataSources.status,
      classification: energyDataSources.classification,
      sourceVersion: energyDataSources.sourceVersion,
      lastSourceUpdatedAt: energyDataSources.lastSourceUpdatedAt,
      lastSyncAt: energyDataSources.lastSyncAt,
      createdAt: energyDataSources.createdAt,
      updatedAt: energyDataSources.updatedAt,
    };
    const listQuery = db.select(select).from(energyDataSources).where(where)
      .orderBy(asc(energyDataSources.provider), asc(energyDataSources.name));
    const statsQuery = db.select({
      sourceId: energyImportBatches.sourceId,
      batchCount: sql<number>`count(distinct "energy_import_batches"."id")::int`,
      latestBatchAt: sql<Date | null>`max("energy_import_batches"."created_at")`,
      openQualityIssues: sql<number>`count(*) filter (where "energy_data_quality_issues"."status" in ('OPEN', 'ACKNOWLEDGED'))::int`,
    }).from(energyImportBatches).leftJoin(energyDataQualityIssues, eq(energyDataQualityIssues.batchId, energyImportBatches.id)).groupBy(energyImportBatches.sourceId);
    const [sources, totalRows, stats] = await Promise.all([
      wantsPagination ? listQuery.limit(pagination.pageSize).offset(pagination.offset) : listQuery,
      wantsPagination ? db.select({ value: sql<number>`count(*)::int` }).from(energyDataSources).where(where) : Promise.resolve([{ value: 0 }]),
      statsQuery,
    ]);
    const statsBySource = new Map(stats.map((row) => [row.sourceId, row]));
    const items = sources.map((source) => ({ ...source, batchCount: Number(statsBySource.get(source.id)?.batchCount ?? 0), latestBatchAt: statsBySource.get(source.id)?.latestBatchAt ?? null, openQualityIssues: Number(statsBySource.get(source.id)?.openQualityIssues ?? 0) }));
    return wantsPagination ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0)) : NextResponse.json({ items });
  } catch (error) {
    console.error('Data source list failed', error);
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải danh mục nguồn dữ liệu.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = dataSourceSchema.parse(await request.json());
    const [duplicate] = await db.select({ id: energyDataSources.id }).from(energyDataSources).where(eq(energyDataSources.code, payload.code)).limit(1);
    if (duplicate) return NextResponse.json({ message: `Mã nguồn ${payload.code} đã tồn tại.` }, { status: 409 });
    const [created] = await db.insert(energyDataSources).values({
      code: payload.code,
      name: payload.name,
      provider: payload.provider,
      sourceType: payload.sourceType,
      owner: payload.owner ?? null,
      endpointRef: payload.endpointRef ?? null,
      schedule: payload.schedule ?? null,
      refreshCadence: payload.refreshCadence ?? null,
      authoritativeLevel: payload.authoritativeLevel,
      status: payload.status,
      classification: payload.classification,
      sourceVersion: payload.sourceVersion ?? null,
      lastSourceUpdatedAt: dateOrNull(payload.lastSourceUpdatedAt),
      config: payload.config ?? {},
    }).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin nguồn dữ liệu không hợp lệ.', issues: error.issues }, { status: 400 });
    console.error('Data source create failed', error);
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tạo nguồn dữ liệu.' }, { status: 400 });
  }
}
