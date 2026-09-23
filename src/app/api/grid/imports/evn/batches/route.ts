import { count, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { energyImportBatches } from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const listQuery = db
      .select()
      .from(energyImportBatches)
      .where(eq(energyImportBatches.entityType, 'EVN_GRID_WORKBOOK'))
      .orderBy(desc(energyImportBatches.createdAt));
    const rows = wantsPagination ? await listQuery.limit(pagination.pageSize).offset(pagination.offset) : await listQuery.limit(1000);
    const totalRows = wantsPagination ? await db.select({ value: count() }).from(energyImportBatches).where(eq(energyImportBatches.entityType, 'EVN_GRID_WORKBOOK')) : [];

    const items = rows.map((row) => ({
        id: row.id,
        fileName: row.fileName,
        status: row.status,
        observationDate: row.observationDate,
        recordsRead: row.recordsRead,
        recordsAccepted: row.recordsAccepted,
        recordsRejected: row.recordsRejected,
        submittedBy: row.submittedBy,
        parserVersion: row.parserVersion,
        mappingVersion: row.mappingVersion,
        sourceUpdatedAt: row.sourceUpdatedAt,
        importedAt: row.importedAt,
        createdAt: row.createdAt,
        metadata: row.metadata,
      }));
    return wantsPagination
      ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0))
      : NextResponse.json({ items });
  } catch (error) {
    console.error('Cannot list EVN import batches', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Không thể tải lịch sử import EVN.' },
      { status: 500 },
    );
  }
}
