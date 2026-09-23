import { and, count, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { energyDataSources, energyVbdhRecords, energyVbdhSyncRuns } from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const status = params.get('status');
    const runId = params.get('runId');
    const sourceRecordId = params.get('sourceRecordId');
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const filters = [status ? eq(energyVbdhRecords.validationStatus, status) : null, runId ? eq(energyVbdhRecords.syncRunId, runId) : null, sourceRecordId ? eq(energyVbdhRecords.sourceRecordId, sourceRecordId) : null].filter((item): item is NonNullable<typeof item> => item !== null);
    const where = filters.length ? and(...filters) : undefined;
    const select = {
      id: energyVbdhRecords.id, syncRunId: energyVbdhRecords.syncRunId, sourceId: energyVbdhRecords.sourceId, sourceCode: energyDataSources.code,
      sourceRecordId: energyVbdhRecords.sourceRecordId, documentNo: energyVbdhRecords.documentNo, sourceDocumentRef: energyVbdhRecords.sourceDocumentRef,
      sourceUrl: energyVbdhRecords.sourceUrl, senderUnit: energyVbdhRecords.senderUnit, issuedAt: energyVbdhRecords.issuedAt, receivedAt: energyVbdhRecords.receivedAt,
      fetchedAt: energyVbdhRecords.fetchedAt, checksum: energyVbdhRecords.checksum, parserVersion: energyVbdhRecords.parserVersion, mappingVersion: energyVbdhRecords.mappingVersion,
      validationStatus: energyVbdhRecords.validationStatus, mappedSourceId: energyVbdhRecords.mappedSourceId, mappedActivityId: energyVbdhRecords.mappedActivityId,
      mappedMeasurementId: energyVbdhRecords.mappedMeasurementId, errorMessage: energyVbdhRecords.errorMessage, rawPayload: energyVbdhRecords.rawPayload, rawText: energyVbdhRecords.rawText,
      metadata: energyVbdhRecords.metadata, runStatus: energyVbdhSyncRuns.status,
    };
    const query = db.select(select).from(energyVbdhRecords).leftJoin(energyDataSources, eq(energyDataSources.id, energyVbdhRecords.sourceId)).innerJoin(energyVbdhSyncRuns, eq(energyVbdhSyncRuns.id, energyVbdhRecords.syncRunId));
    const listQuery = query.where(where).orderBy(desc(energyVbdhRecords.createdAt));
    if (!wantsPagination) return NextResponse.json({ items: await listQuery.limit(500) });
    const [rows, totalRows] = await Promise.all([
      listQuery.limit(pagination.pageSize).offset(pagination.offset),
      db.select({ value: count() }).from(energyVbdhRecords).where(where),
    ]);
    return paginatedResponse(rows, pagination, Number(totalRows[0]?.value ?? 0));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải VBDH raw records.' }, { status: 500 });
  }
}
