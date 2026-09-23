import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, isNotNull, lte, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { energyAssets, energyBuildings, energyCustomerAccounts, energyCustomerGridServiceLinks, energyParties, energyRoofSurfaces, energyRooftopGenerationMonthly, energyRooftopSystems, energySites } from '@/db/schema';
import { rooftopSystemSchema } from '@/lib/solar-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const OPERATION_STATUSES = ['ACTIVE', 'INSTALLING', 'MAINTENANCE', 'OFFLINE', 'PLANNED', 'DECOMMISSIONED', 'DELETED'] as const;

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function asNumber(value: string | number | null | undefined) {
  return value == null ? null : Number(value);
}

function serializeSystem(row: Record<string, unknown>) {
  return {
    ...row,
    installedCapacityKwp: Number(row.installedCapacityKwp),
    inverterCapacityKw: asNumber(row.inverterCapacityKw as string | number | null | undefined),
    batteryCapacityKwh: asNumber(row.batteryCapacityKwh as string | number | null | undefined),
    annualYieldKwh: asNumber(row.annualYieldKwh as string | number | null | undefined),
    selfConsumptionPct: asNumber(row.selfConsumptionPct as string | number | null | undefined),
    exportLimitKw: asNumber(row.exportLimitKw as string | number | null | undefined),
    confidence: asNumber(row.confidence as string | number | null | undefined),
    generatedLast12MonthsKwh: asNumber(row.generatedLast12MonthsKwh as string | number | null | undefined),
  };
}

function currentLink<T extends { validFrom: Date | null; validTo: Date | null; isInferred: boolean; createdAt: Date }>(links: T[]) {
  const now = Date.now();
  return [...links].sort((a, b) => {
    const aCurrent = (!a.validFrom || a.validFrom.getTime() <= now) && (!a.validTo || a.validTo.getTime() >= now);
    const bCurrent = (!b.validFrom || b.validFrom.getTime() <= now) && (!b.validTo || b.validTo.getTime() >= now);
    if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;
    return (b.validFrom?.getTime() ?? 0) - (a.validFrom?.getTime() ?? 0) || b.createdAt.getTime() - a.createdAt.getTime();
  })[0] ?? null;
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const search = params.get('search')?.trim() ?? '';
    const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.get('pageSize') ?? 25) || 25));
    const adminAreaCode = params.get('adminAreaCode')?.trim();
    const customerType = params.get('customerType')?.trim();
    const operationStatus = params.get('operationStatus')?.trim();
    const source = params.get('source')?.trim();
    const battery = params.get('battery');
    const rawMinCapacity = params.get('minCapacity');
    const rawMaxCapacity = params.get('maxCapacity');
    const rawYear = params.get('year');
    const minCapacity = rawMinCapacity == null || rawMinCapacity === '' ? null : Number(rawMinCapacity);
    const maxCapacity = rawMaxCapacity == null || rawMaxCapacity === '' ? null : Number(rawMaxCapacity);
    const year = rawYear == null || rawYear === '' ? null : Number(rawYear);

    const filters = [
      operationStatus && OPERATION_STATUSES.includes(operationStatus as typeof OPERATION_STATUSES[number])
        ? eq(energyRooftopSystems.operationStatus, operationStatus)
        : inArray(energyRooftopSystems.operationStatus, OPERATION_STATUSES.filter((status) => status !== 'DELETED')),
      adminAreaCode ? eq(energySites.adminAreaCode, adminAreaCode) : undefined,
      customerType ? eq(energyCustomerAccounts.customerType, customerType) : undefined,
      source ? eq(energyRooftopSystems.source, source) : undefined,
      battery === 'yes' ? isNotNull(energyRooftopSystems.batteryCapacityKwh) : battery === 'no' ? isNull(energyRooftopSystems.batteryCapacityKwh) : undefined,
      minCapacity != null && Number.isFinite(minCapacity) ? gte(energyRooftopSystems.installedCapacityKwp, String(Math.max(0, minCapacity))) : undefined,
      maxCapacity != null && Number.isFinite(maxCapacity) ? lte(energyRooftopSystems.installedCapacityKwp, String(Math.max(0, maxCapacity))) : undefined,
      year != null && Number.isInteger(year) && year >= 1900 && year <= 2200 ? and(gte(energyAssets.commissionedAt, new Date(`${year}-01-01T00:00:00.000Z`)), lte(energyAssets.commissionedAt, new Date(`${year}-12-31T23:59:59.999Z`))) : undefined,
      search ? or(
        ilike(energyAssets.code, `%${search}%`),
        ilike(energyAssets.name, `%${search}%`),
        ilike(energyCustomerAccounts.customerCode, `%${search}%`),
        ilike(energyParties.name, `%${search}%`),
        ilike(energySites.address, `%${search}%`),
      ) : undefined,
    ].filter((value): value is NonNullable<typeof value> => value != null);
    const where = filters.length ? and(...filters) : undefined;

    const [rows, totalRows] = await Promise.all([
      db.select({
        assetId: energyRooftopSystems.assetId,
        assetCode: energyAssets.code,
        assetName: energyAssets.name,
        assetStatus: energyAssets.status,
        commissionedAt: energyAssets.commissionedAt,
        customerAccountId: energyRooftopSystems.customerAccountId,
        customerCode: energyCustomerAccounts.customerCode,
        customerName: energyParties.name,
        customerType: energyCustomerAccounts.customerType,
        serviceAddress: energyCustomerAccounts.serviceAddress,
        siteId: energyCustomerAccounts.siteId,
        siteName: energySites.name,
        adminAreaCode: energySites.adminAreaCode,
        installedCapacityKwp: energyRooftopSystems.installedCapacityKwp,
        inverterCapacityKw: energyRooftopSystems.inverterCapacityKw,
        batteryCapacityKwh: energyRooftopSystems.batteryCapacityKwh,
        gridConnectionAssetId: energyRooftopSystems.gridConnectionAssetId,
        operationStatus: energyRooftopSystems.operationStatus,
        ownershipModel: energyRooftopSystems.ownershipModel,
        installationType: energyRooftopSystems.installationType,
        evRegistrationNo: energyRooftopSystems.evRegistrationNo,
        annualYieldKwh: energyRooftopSystems.annualYieldKwh,
        selfConsumptionPct: energyRooftopSystems.selfConsumptionPct,
        exportLimitKw: energyRooftopSystems.exportLimitKw,
        source: energyRooftopSystems.source,
        sourceRef: energyRooftopSystems.sourceRef,
        lastVerifiedAt: energyRooftopSystems.lastVerifiedAt,
        confidence: energyRooftopSystems.confidence,
      })
        .from(energyRooftopSystems)
        .innerJoin(energyAssets, eq(energyAssets.id, energyRooftopSystems.assetId))
        .leftJoin(energyCustomerAccounts, eq(energyCustomerAccounts.id, energyRooftopSystems.customerAccountId))
        .leftJoin(energyParties, eq(energyParties.id, energyCustomerAccounts.partyId))
        .leftJoin(energySites, eq(energySites.id, energyCustomerAccounts.siteId))
        .where(where)
        .orderBy(desc(energyAssets.updatedAt), asc(energyAssets.name))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ value: count() })
        .from(energyRooftopSystems)
        .innerJoin(energyAssets, eq(energyAssets.id, energyRooftopSystems.assetId))
        .leftJoin(energyCustomerAccounts, eq(energyCustomerAccounts.id, energyRooftopSystems.customerAccountId))
        .leftJoin(energyParties, eq(energyParties.id, energyCustomerAccounts.partyId))
        .leftJoin(energySites, eq(energySites.id, energyCustomerAccounts.siteId))
        .where(where),
    ]);

    const systemIds = rows.map((row) => row.assetId);
    const accountIds = rows.map((row) => row.customerAccountId).filter((id): id is string => Boolean(id));
    const [links, generation] = systemIds.length
      ? await Promise.all([
        accountIds.length ? db.select().from(energyCustomerGridServiceLinks).where(inArray(energyCustomerGridServiceLinks.customerAccountId, accountIds)).orderBy(desc(energyCustomerGridServiceLinks.validFrom), desc(energyCustomerGridServiceLinks.createdAt)) : Promise.resolve([]),
        db.select({ systemAssetId: energyRooftopGenerationMonthly.systemAssetId, period: energyRooftopGenerationMonthly.period, energyGeneratedKwh: energyRooftopGenerationMonthly.energyGeneratedKwh })
          .from(energyRooftopGenerationMonthly)
          .where(inArray(energyRooftopGenerationMonthly.systemAssetId, systemIds))
          .orderBy(desc(energyRooftopGenerationMonthly.period)),
      ])
      : [[], []];
    const linksByAccount = new Map<string, typeof links[number]>();
    for (const accountId of accountIds) {
      const link = currentLink(links.filter((item) => item.customerAccountId === accountId));
      if (link) linksByAccount.set(accountId, link);
    }
    const generatedBySystem = new Map<string, number>();
    const monthsBySystem = new Map<string, number>();
    for (const row of generation) {
      const monthCount = monthsBySystem.get(row.systemAssetId) ?? 0;
      if (monthCount >= 12) continue;
      generatedBySystem.set(row.systemAssetId, (generatedBySystem.get(row.systemAssetId) ?? 0) + Number(row.energyGeneratedKwh));
      monthsBySystem.set(row.systemAssetId, monthCount + 1);
    }

    const gridAssetIds = Array.from(new Set(rows.flatMap((row) => {
      const link = row.customerAccountId ? linksByAccount.get(row.customerAccountId) : null;
      return [row.gridConnectionAssetId, link?.feederAssetId, link?.bayAssetId, link?.transformerAssetId, link?.substationAssetId].filter((id): id is string => Boolean(id));
    })));
    const gridAssets = gridAssetIds.length ? await db.select({ id: energyAssets.id, code: energyAssets.code, name: energyAssets.name, assetType: energyAssets.assetType }).from(energyAssets).where(inArray(energyAssets.id, gridAssetIds)) : [];
    const gridAssetMap = new Map(gridAssets.map((asset) => [asset.id, asset]));

    return NextResponse.json({
      items: rows.map((row) => {
        const link = row.customerAccountId ? linksByAccount.get(row.customerAccountId) ?? null : null;
        return serializeSystem({
          ...row,
          siteId: row.siteId,
          gridConnection: row.gridConnectionAssetId ? gridAssetMap.get(row.gridConnectionAssetId) ?? null : null,
          serviceLink: link ? {
            ...link,
            feeder: link.feederAssetId ? gridAssetMap.get(link.feederAssetId) ?? null : null,
            bay: link.bayAssetId ? gridAssetMap.get(link.bayAssetId) ?? null : null,
            transformer: link.transformerAssetId ? gridAssetMap.get(link.transformerAssetId) ?? null : null,
            substation: link.substationAssetId ? gridAssetMap.get(link.substationAssetId) ?? null : null,
          } : null,
          generatedLast12MonthsKwh: generatedBySystem.get(row.assetId) ?? null,
        });
      }),
      pagination: { page, pageSize, total: Number(totalRows[0]?.value ?? 0), totalPages: Math.ceil(Number(totalRows[0]?.value ?? 0) / pageSize) },
      filters: { search, adminAreaCode: adminAreaCode ?? null, customerType: customerType ?? null, operationStatus: operationStatus ?? 'ACTIVE', source: source ?? null, battery: battery ?? null },
    });
  } catch (error) {
    console.error('Rooftop system list failed', error);
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải danh sách hệ thống điện mặt trời mái nhà.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = rooftopSystemSchema.parse(await request.json());
    const result = await db.transaction(async (tx) => {
      const [account] = await tx.select({ id: energyCustomerAccounts.id, partyId: energyCustomerAccounts.partyId, siteId: energyCustomerAccounts.siteId, siteLocation: energySites.location }).from(energyCustomerAccounts).leftJoin(energySites, eq(energySites.id, energyCustomerAccounts.siteId)).where(eq(energyCustomerAccounts.id, payload.customerAccountId)).limit(1);
      if (!account) throw new Error('Không tìm thấy khách hàng EVN.');
      const [duplicate] = await tx.select({ id: energyAssets.id }).from(energyAssets).where(eq(energyAssets.code, payload.code)).limit(1);
      if (duplicate) throw new Error(`Mã hệ thống ${payload.code} đã tồn tại.`);

      let buildingAssetId = payload.buildingAssetId ?? null;
      if (payload.roofSurfaceId) {
        const [roof] = await tx.select({ id: energyRoofSurfaces.id, buildingAssetId: energyRoofSurfaces.buildingAssetId }).from(energyRoofSurfaces).where(eq(energyRoofSurfaces.id, payload.roofSurfaceId)).limit(1);
        if (!roof) throw new Error('Không tìm thấy bề mặt mái đã chọn.');
        if (buildingAssetId && buildingAssetId !== roof.buildingAssetId) throw new Error('Bề mặt mái không thuộc đúng công trình đã chọn.');
        buildingAssetId = roof.buildingAssetId;
      }
      if (buildingAssetId) {
        const [building] = await tx.select({ assetId: energyBuildings.assetId }).from(energyBuildings).where(eq(energyBuildings.assetId, buildingAssetId)).limit(1);
        if (!building) throw new Error('Không tìm thấy công trình/mái đã chọn.');
      }
      if (payload.installerPartyId) {
        const [installer] = await tx.select({ id: energyParties.id }).from(energyParties).where(eq(energyParties.id, payload.installerPartyId)).limit(1);
        if (!installer) throw new Error('Không tìm thấy đơn vị lắp đặt.');
      }
      if (payload.gridConnectionAssetId) {
        const [gridAsset] = await tx.select({ id: energyAssets.id }).from(energyAssets).where(eq(energyAssets.id, payload.gridConnectionAssetId)).limit(1);
        if (!gridAsset) throw new Error('Không tìm thấy tài sản lưới đấu nối.');
      }

      const [asset] = await tx.insert(energyAssets).values({
        siteId: account.siteId,
        ownerPartyId: account.partyId,
        assetType: 'ROOFTOP_SOLAR_SYSTEM',
        code: payload.code,
        name: payload.name,
        status: payload.operationStatus,
        commissionedAt: parseDate(payload.commissionedAt),
        location: account.siteLocation,
        classification: payload.source === 'EVN' ? 'RESTRICTED' : payload.source === 'DEMO' ? 'INTERNAL' : 'CONFIDENTIAL',
        metadata: { module: 'rooftop-solar', source: payload.source, sourceRef: payload.sourceRef ?? null },
      }).returning();
      const [system] = await tx.insert(energyRooftopSystems).values({
        assetId: asset.id,
        customerAccountId: payload.customerAccountId,
        buildingAssetId,
        roofSurfaceId: payload.roofSurfaceId ?? null,
        installedCapacityKwp: String(payload.installedCapacityKwp),
        inverterCapacityKw: payload.inverterCapacityKw == null ? null : String(payload.inverterCapacityKw),
        batteryCapacityKwh: payload.batteryCapacityKwh == null ? null : String(payload.batteryCapacityKwh),
        gridConnectionAssetId: payload.gridConnectionAssetId ?? null,
        annualYieldKwh: payload.annualYieldKwh == null ? null : String(payload.annualYieldKwh),
        selfConsumptionPct: payload.selfConsumptionPct == null ? null : String(payload.selfConsumptionPct),
        operationStatus: payload.operationStatus,
        ownershipModel: payload.ownershipModel ?? null,
        installationType: payload.installationType,
        installerPartyId: payload.installerPartyId ?? null,
        evRegistrationNo: payload.evRegistrationNo ?? null,
        evnAcceptanceAt: parseDate(payload.evnAcceptanceAt),
        meteringScheme: payload.meteringScheme ?? null,
        exportLimitKw: payload.exportLimitKw == null ? null : String(payload.exportLimitKw),
        source: payload.source,
        sourceId: payload.sourceId ?? null,
        sourceRef: payload.sourceRef ?? null,
        lastVerifiedAt: parseDate(payload.lastVerifiedAt),
        confidence: payload.confidence == null ? null : String(payload.confidence),
      }).returning();
      return { asset, system };
    });

    return NextResponse.json({ ...result, system: serializeSystem(result.system as unknown as Record<string, unknown>) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') return NextResponse.json({ message: 'Thông tin hệ rooftop không hợp lệ.', issues: (error as { issues?: unknown }).issues ?? [] }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tạo hệ thống điện mặt trời mái nhà.' }, { status: 400 });
  }
}
