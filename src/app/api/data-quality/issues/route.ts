import { and, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import {
  energyAssets,
  energyDataSources,
  energyDataQualityIssues,
  energyImportBatches,
  energyImportRecords,
} from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status')?.trim();
    const severity = url.searchParams.get('severity')?.trim();
    const batchId = url.searchParams.get('batchId')?.trim();
    const pagination = parsePagination(url.searchParams);

    const filters = [];
    if (status && status !== 'ALL') filters.push(eq(energyDataQualityIssues.status, status));
    if (severity && severity !== 'ALL') filters.push(eq(energyDataQualityIssues.severity, severity));
    if (batchId) filters.push(eq(energyDataQualityIssues.batchId, batchId));

    const where = filters.length ? and(...filters) : undefined;
    const rowsQuery = db
      .select({
        id: energyDataQualityIssues.id,
        severity: energyDataQualityIssues.severity,
        issueCode: energyDataQualityIssues.issueCode,
        fieldName: energyDataQualityIssues.fieldName,
        rawValue: energyDataQualityIssues.rawValue,
        message: energyDataQualityIssues.message,
        status: energyDataQualityIssues.status,
        resolution: energyDataQualityIssues.resolution,
        resolvedBy: energyDataQualityIssues.resolvedBy,
        resolvedAt: energyDataQualityIssues.resolvedAt,
        metadata: energyDataQualityIssues.metadata,
        createdAt: energyDataQualityIssues.createdAt,
        batchId: energyDataQualityIssues.batchId,
        sourceId: energyImportBatches.sourceId,
        sourceCode: energyDataSources.code,
        sourceName: energyDataSources.name,
        sourceProvider: energyDataSources.provider,
        sourceType: energyDataSources.sourceType,
        sourceAuthoritativeLevel: energyDataSources.authoritativeLevel,
        batchFileName: energyImportBatches.fileName,
        batchStatus: energyImportBatches.status,
        observationDate: energyImportBatches.observationDate,
        recordId: energyDataQualityIssues.recordId,
        sheetName: energyImportRecords.sheetName,
        rowNumber: energyImportRecords.rowNumber,
        externalKey: energyImportRecords.externalKey,
        parentExternalKey: energyImportRecords.parentExternalKey,
        payload: energyImportRecords.payload,
        assetId: energyDataQualityIssues.assetId,
        assetCode: energyAssets.code,
        assetName: energyAssets.name,
        assetType: energyAssets.assetType,
      })
      .from(energyDataQualityIssues)
      .leftJoin(energyImportBatches, eq(energyImportBatches.id, energyDataQualityIssues.batchId))
      .leftJoin(energyDataSources, eq(energyDataSources.id, energyImportBatches.sourceId))
      .leftJoin(energyImportRecords, eq(energyImportRecords.id, energyDataQualityIssues.recordId))
      .leftJoin(energyAssets, eq(energyAssets.id, energyDataQualityIssues.assetId))
      .where(where)
      .orderBy(
        sql`case ${energyDataQualityIssues.severity} when 'ERROR' then 1 when 'WARNING' then 2 else 3 end`,
        desc(energyDataQualityIssues.createdAt),
      )
      .limit(pagination.pageSize)
      .offset(pagination.offset);

    const [rows, totalRows, summaryRows] = await Promise.all([
      rowsQuery,
      db.select({ value: sql<number>`count(*)::int` }).from(energyDataQualityIssues).where(where),
      db.select({
        total: sql<number>`count(*)::int`,
        open: sql<number>`count(*) filter (where ${energyDataQualityIssues.status} = 'OPEN')::int`,
        errors: sql<number>`count(*) filter (where ${energyDataQualityIssues.status} = 'OPEN' and ${energyDataQualityIssues.severity} = 'ERROR')::int`,
        warnings: sql<number>`count(*) filter (where ${energyDataQualityIssues.status} = 'OPEN' and ${energyDataQualityIssues.severity} = 'WARNING')::int`,
        resolved: sql<number>`count(*) filter (where ${energyDataQualityIssues.status} = 'RESOLVED')::int`,
        ignored: sql<number>`count(*) filter (where ${energyDataQualityIssues.status} = 'IGNORED')::int`,
      }).from(energyDataQualityIssues),
    ]);

    return paginatedResponse(rows, pagination, Number(totalRows[0]?.value ?? 0), { summary: summaryRows[0] ?? {} });
  } catch (error) {
    console.error('Data quality issue list failed', error);
    return NextResponse.json({ message: 'Không thể tải hàng đợi chất lượng dữ liệu.' }, { status: 500 });
  }
}
