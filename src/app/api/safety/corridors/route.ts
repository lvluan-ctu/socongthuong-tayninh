import { count, eq, inArray, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import {
  energyAssets,
  energyClearanceRules,
  energyProtectionCorridorVersions,
  energyProtectionCorridors,
  energySafetyRegulations,
} from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const wantsPagination = params.has('page') || params.has('pageSize');
    const pagination = parsePagination(params);
    const listQuery = db.select({
      id: energyProtectionCorridors.id,
      assetId: energyProtectionCorridors.assetId,
      assetCode: energyAssets.code,
      assetName: energyAssets.name,
      assetType: energyAssets.assetType,
      ruleId: energyProtectionCorridors.ruleId,
      status: energyProtectionCorridors.status,
      versionNo: energyProtectionCorridors.versionNo,
      sourceLineGeometryHash: energyProtectionCorridors.sourceLineGeometryHash,
      ruleVersion: energyProtectionCorridors.ruleVersion,
      calculatedAt: energyProtectionCorridors.calculatedAt,
      validFrom: energyProtectionCorridors.validFrom,
      validTo: energyProtectionCorridors.validTo,
      calculationMethod: energyProtectionCorridors.calculationMethod,
      inputSnapshot: energyProtectionCorridors.inputSnapshot,
      ruleCode: energyClearanceRules.ruleCode,
      ruleName: energyClearanceRules.ruleName,
      measurementBasis: energyClearanceRules.measurementBasis,
      voltageLevelKv: energyClearanceRules.voltageLevelKv,
      horizontalClearanceM: energyClearanceRules.horizontalClearanceM,
      verticalClearanceM: energyClearanceRules.verticalClearanceM,
      corridorWidthM: energyClearanceRules.corridorWidthM,
      regulationCode: energySafetyRegulations.code,
      regulationName: energySafetyRegulations.name,
      legalDocumentRef: energySafetyRegulations.legalDocumentRef,
      areaM2: sql<number>`ST_Area(${energyProtectionCorridors.geometry}::geography)`,
    }).from(energyProtectionCorridors)
      .innerJoin(energyAssets, eq(energyAssets.id, energyProtectionCorridors.assetId))
      .leftJoin(energyClearanceRules, eq(energyClearanceRules.id, energyProtectionCorridors.ruleId))
      .leftJoin(energySafetyRegulations, eq(energySafetyRegulations.id, energyClearanceRules.regulationId))
      .orderBy(energyAssets.name);

    const [rows, totalRows, versionTotalRows] = await Promise.all([
      wantsPagination ? listQuery.limit(pagination.pageSize).offset(pagination.offset) : listQuery.limit(1000),
      wantsPagination ? db.select({ value: count() }).from(energyProtectionCorridors) : Promise.resolve([]),
      db.select({ value: count() }).from(energyProtectionCorridorVersions),
    ]);
    const corridorIds = rows.map((row) => row.id);
    const versions = corridorIds.length
      ? await db.select({ corridorId: energyProtectionCorridorVersions.corridorId, value: count() })
        .from(energyProtectionCorridorVersions)
        .where(inArray(energyProtectionCorridorVersions.corridorId, corridorIds))
        .groupBy(energyProtectionCorridorVersions.corridorId)
      : [];
    const versionCounts = new Map<string, number>();
    for (const version of versions) versionCounts.set(version.corridorId, Number(version.value ?? 0));
    const items = rows.map((row) => ({
      ...row,
      voltageLevelKv: row.voltageLevelKv == null ? null : Number(row.voltageLevelKv),
      horizontalClearanceM: row.horizontalClearanceM == null ? null : Number(row.horizontalClearanceM),
      verticalClearanceM: row.verticalClearanceM == null ? null : Number(row.verticalClearanceM),
      corridorWidthM: row.corridorWidthM == null ? null : Number(row.corridorWidthM),
      areaM2: Number(row.areaM2 ?? 0),
      versionCount: versionCounts.get(row.id) ?? 0,
    }));
    return wantsPagination
      ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0), { summary: { versionCount: Number(versionTotalRows[0]?.value ?? 0) } })
      : NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải hành lang lưới điện.' }, { status: 500 });
  }
}
