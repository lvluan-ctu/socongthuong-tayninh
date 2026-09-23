import { count, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { energyDataSources, energyVbdhSyncRuns } from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const query = db.select({
      id: energyVbdhSyncRuns.id, sourceId: energyVbdhSyncRuns.sourceId, sourceCode: energyDataSources.code, sourceName: energyDataSources.name,
      mode: energyVbdhSyncRuns.mode, endpointRef: energyVbdhSyncRuns.endpointRef, startedAt: energyVbdhSyncRuns.startedAt, completedAt: energyVbdhSyncRuns.completedAt,
      status: energyVbdhSyncRuns.status, recordsReceived: energyVbdhSyncRuns.recordsReceived, recordsMapped: energyVbdhSyncRuns.recordsMapped,
      recordsNeedsReview: energyVbdhSyncRuns.recordsNeedsReview, recordsRejected: energyVbdhSyncRuns.recordsRejected, errorMessage: energyVbdhSyncRuns.errorMessage, metadata: energyVbdhSyncRuns.metadata,
    }).from(energyVbdhSyncRuns).leftJoin(energyDataSources, eq(energyDataSources.id, energyVbdhSyncRuns.sourceId)).orderBy(desc(energyVbdhSyncRuns.startedAt));
    const [rows, totalRows, summaryRows] = await Promise.all([
      wantsPagination ? query.limit(pagination.pageSize).offset(pagination.offset) : query,
      wantsPagination ? db.select({ value: count() }).from(energyVbdhSyncRuns) : Promise.resolve([]),
      db.select({ mapped: sql<number>`COALESCE(SUM(${energyVbdhSyncRuns.recordsMapped}), 0)`, needsReview: sql<number>`COALESCE(SUM(${energyVbdhSyncRuns.recordsNeedsReview}), 0)`, rejected: sql<number>`COALESCE(SUM(${energyVbdhSyncRuns.recordsRejected}), 0)` }).from(energyVbdhSyncRuns),
    ]);
    const summary = { mapped: Number(summaryRows[0]?.mapped ?? 0), needsReview: Number(summaryRows[0]?.needsReview ?? 0), rejected: Number(summaryRows[0]?.rejected ?? 0) };
    return wantsPagination
      ? paginatedResponse(rows, pagination, Number(totalRows[0]?.value ?? 0), { summary })
      : NextResponse.json({ items: rows, summary });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải VBDH sync runs.' }, { status: 500 });
  }
}
