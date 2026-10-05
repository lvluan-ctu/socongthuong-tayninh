import { NextResponse } from 'next/server';
import { count, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { energyAssets, energySites, energySubstations } from '@/db/schema';
import { substationFormSchema } from '@/features/grid/substations/substation.schema';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
  const pagination = parsePagination(params);
  const listQuery = db
    .select({
      id: energyAssets.id,
      code: energyAssets.code,
      name: energyAssets.name,
      status: energyAssets.status,
      commissionedAt: energyAssets.commissionedAt,
      voltageLevelKv: energySubstations.voltageLevelKv,
      substationType: energySubstations.substationType,
      designedCapacityMva: energySubstations.designedCapacityMva,
      installedCapacityMva: energySubstations.installedCapacityMva,
      currentLoadMva: energySubstations.currentLoadMva,
      loadFactorPct: energySubstations.loadFactorPct,
      availableCapacityMva: energySubstations.availableCapacityMva,
      overloadStatus: energySubstations.overloadStatus,
      operator: energySubstations.operator,
    })
    .from(energyAssets)
    .innerJoin(energySubstations, eq(energyAssets.id, energySubstations.assetId))
    .orderBy(desc(energyAssets.updatedAt));

  if (!wantsPagination) return NextResponse.json({ data: await listQuery });

  const [rows, totalRows, summaryRows] = await Promise.all([
    listQuery.limit(pagination.pageSize).offset(pagination.offset),
    db.select({ value: count() }).from(energyAssets).innerJoin(energySubstations, eq(energyAssets.id, energySubstations.assetId)),
    db.select({
      totalCapacity: sql<number>`COALESCE(SUM(COALESCE(${energySubstations.installedCapacityMva}, ${energySubstations.designedCapacityMva})), 0)`,
      totalLoad: sql<number>`COALESCE(SUM(${energySubstations.currentLoadMva}), 0)`,
      hotCount: sql<number>`COALESCE(SUM(CASE WHEN COALESCE(${energySubstations.loadFactorPct}, CASE WHEN COALESCE(${energySubstations.installedCapacityMva}, ${energySubstations.designedCapacityMva})::numeric > 0 THEN (${energySubstations.currentLoadMva}::numeric / COALESCE(${energySubstations.installedCapacityMva}, ${energySubstations.designedCapacityMva})::numeric) * 100 ELSE 0 END) >= 90 OR ${energySubstations.overloadStatus} IN ('WARNING', 'CRITICAL', 'OVERLOAD') THEN 1 ELSE 0 END), 0)`,
    }).from(energyAssets).innerJoin(energySubstations, eq(energyAssets.id, energySubstations.assetId)),
  ]);
  const summary = {
    total: Number(totalRows[0]?.value ?? 0),
    totalCapacity: Number(summaryRows[0]?.totalCapacity ?? 0),
    totalLoad: Number(summaryRows[0]?.totalLoad ?? 0),
    hotCount: Number(summaryRows[0]?.hotCount ?? 0),
  };
  return paginatedResponse(rows, pagination, summary.total, { summary });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = substationFormSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: 'Dữ liệu trạm không hợp lệ.', errors: parsed.error.flatten(), issues: parsed.error.issues }, { status: 400 });
    }

    const input = parsed.data;
    const [duplicateAsset, duplicateSite] = await Promise.all([
      db.select({ id: energyAssets.id }).from(energyAssets).where(eq(energyAssets.code, input.code)).limit(1),
      db.select({ id: energySites.id }).from(energySites).where(eq(energySites.code, input.siteCode)).limit(1),
    ]);
    if (duplicateAsset[0]) return NextResponse.json({ message: `Mã trạm ${input.code} đã tồn tại.`, issues: [{ path: ['code'], message: 'Mã trạm đã tồn tại trong Asset Registry.' }] }, { status: 409 });
    if (duplicateSite[0]) return NextResponse.json({ message: `Mã địa điểm ${input.siteCode} đã tồn tại.`, issues: [{ path: ['siteCode'], message: 'Mã địa điểm đã tồn tại.' }] }, { status: 409 });
  const designed = input.designedCapacityMva ?? 0;
  const installed = input.installedCapacityMva ?? designed;
  const current = input.currentLoadMva ?? 0;
  const loadFactor = installed > 0 ? (current / installed) * 100 : 0;
  const available = Math.max(0, installed - current);
  const overloadStatus = loadFactor >= 100 ? 'OVERLOAD' : loadFactor >= 90 ? 'CRITICAL' : loadFactor >= 80 ? 'WARNING' : 'NORMAL';
  const location = input.latitude != null && input.longitude != null
    ? `SRID=4326;POINT(${input.longitude} ${input.latitude})`
    : null;
    const commissionedAt = new Date(`${input.commissionedAt}T00:00:00+07:00`);
    if (Number.isNaN(commissionedAt.getTime())) {
      return NextResponse.json({ message: 'Ngày vận hành không hợp lệ.', issues: [{ path: ['commissionedAt'], message: 'Ngày vận hành không hợp lệ.' }] }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      const [site] = await tx.insert(energySites).values({
        code: input.siteCode,
        name: input.name,
        siteType: 'SUBSTATION',
        address: input.address ?? null,
        adminAreaCode: input.adminAreaCode || null,
        location,
        classification: 'INTERNAL',
        status: input.status === 'DECOMMISSIONED' ? 'INACTIVE' : input.status,
        metadata: { source: 'MANUAL' },
      }).returning({ id: energySites.id });

    const [asset] = await tx.insert(energyAssets).values({
      siteId: site.id,
      assetType: 'SUBSTATION',
      code: input.code,
      name: input.name,
      status: input.status,
      commissionedAt,
      location,
      classification: 'INTERNAL',
      metadata: {
        address: input.address ?? null,
        adminAreaCode: input.adminAreaCode || null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        source: 'MANUAL',
      },
    }).returning({ id: energyAssets.id });

    await tx.insert(energySubstations).values({
      assetId: asset.id,
      voltageLevelKv: String(input.voltageLevelKv),
      substationType: input.substationType,
      designedCapacityMva: String(designed),
      installedCapacityMva: String(installed),
      currentLoadMva: String(current),
      loadFactorPct: String(loadFactor),
      availableCapacityMva: String(available),
      overloadStatus,
      operator: input.operator ?? null,
    });

    return asset;
  });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tạo trạm biến áp.' }, { status: 400 });
  }
}
