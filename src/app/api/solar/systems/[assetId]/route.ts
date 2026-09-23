import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  energyAssets,
  energyBuildings,
  energyCustomerAccounts,
  energyCustomerGridServiceLinks,
  energyParties,
  energyRoofSurfaces,
  energyRooftopGenerationMonthly,
  energyRooftopSystemComponents,
  energyRooftopSystemDocuments,
  energyRooftopSystems,
  energySites,
  energySolarAssessments,
} from "@/db/schema";
import { rooftopSystemPatchSchema } from "@/lib/solar-schemas";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ assetId: string }> };

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function numberOrNull(value: string | number | null | undefined) {
  return value == null ? null : Number(value);
}

function serializeNumeric(row: Record<string, unknown>) {
  const numericKeys = [
    "installedCapacityKwp",
    "inverterCapacityKw",
    "batteryCapacityKwh",
    "annualYieldKwh",
    "selfConsumptionPct",
    "exportLimitKw",
    "confidence",
    "ratedPower",
    "energyGeneratedKwh",
    "energySelfConsumedKwh",
    "energyExportedKwh",
    "energyImportedKwh",
    "peakGenerationKw",
    "score",
    "recommendedCapacityKwp",
    "recommendedInverterKw",
    "recommendedBatteryKwh",
    "availableGridCapacityKw",
  ];
  const result: Record<string, unknown> = { ...row };
  for (const key of numericKeys)
    if (key in result)
      result[key] = numberOrNull(result[key] as string | number | null | undefined);
  return result;
}

async function loadAsset(assetId: string) {
  const [row] = await db
    .select({
      assetId: energyRooftopSystems.assetId,
      assetCode: energyAssets.code,
      assetName: energyAssets.name,
      assetStatus: energyAssets.status,
      assetLocation: energyAssets.location,
      commissionedAt: energyAssets.commissionedAt,
      customerAccountId: energyRooftopSystems.customerAccountId,
      customerCode: energyCustomerAccounts.customerCode,
      customerName: energyParties.name,
      customerType: energyCustomerAccounts.customerType,
      partyId: energyCustomerAccounts.partyId,
      serviceAddress: energyCustomerAccounts.serviceAddress,
      customerStatus: energyCustomerAccounts.status,
      siteId: energyCustomerAccounts.siteId,
      siteName: energySites.name,
      siteAddress: energySites.address,
      adminAreaCode: energySites.adminAreaCode,
      siteLocation: energySites.location,
      installedCapacityKwp: energyRooftopSystems.installedCapacityKwp,
      inverterCapacityKw: energyRooftopSystems.inverterCapacityKw,
      batteryCapacityKwh: energyRooftopSystems.batteryCapacityKwh,
      gridConnectionAssetId: energyRooftopSystems.gridConnectionAssetId,
      operationStatus: energyRooftopSystems.operationStatus,
      ownershipModel: energyRooftopSystems.ownershipModel,
      installationType: energyRooftopSystems.installationType,
      installerPartyId: energyRooftopSystems.installerPartyId,
      evRegistrationNo: energyRooftopSystems.evRegistrationNo,
      evnAcceptanceAt: energyRooftopSystems.evnAcceptanceAt,
      meteringScheme: energyRooftopSystems.meteringScheme,
      exportLimitKw: energyRooftopSystems.exportLimitKw,
      annualYieldKwh: energyRooftopSystems.annualYieldKwh,
      selfConsumptionPct: energyRooftopSystems.selfConsumptionPct,
      source: energyRooftopSystems.source,
      sourceId: energyRooftopSystems.sourceId,
      sourceRef: energyRooftopSystems.sourceRef,
      lastVerifiedAt: energyRooftopSystems.lastVerifiedAt,
      confidence: energyRooftopSystems.confidence,
      buildingAssetId: energyRooftopSystems.buildingAssetId,
      roofSurfaceId: energyRooftopSystems.roofSurfaceId,
    })
    .from(energyRooftopSystems)
    .innerJoin(energyAssets, eq(energyAssets.id, energyRooftopSystems.assetId))
    .leftJoin(
      energyCustomerAccounts,
      eq(energyCustomerAccounts.id, energyRooftopSystems.customerAccountId),
    )
    .leftJoin(energyParties, eq(energyParties.id, energyCustomerAccounts.partyId))
    .leftJoin(energySites, eq(energySites.id, energyCustomerAccounts.siteId))
    .where(eq(energyRooftopSystems.assetId, assetId))
    .limit(1);
  return row ?? null;
}

async function loadAssetNames(ids: Array<string | null | undefined>) {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  if (!uniqueIds.length)
    return new Map<
      string,
      { id: string; code: string; name: string; assetType: string; status: string }
    >();
  const rows = await db
    .select({
      id: energyAssets.id,
      code: energyAssets.code,
      name: energyAssets.name,
      assetType: energyAssets.assetType,
      status: energyAssets.status,
    })
    .from(energyAssets)
    .where(inArray(energyAssets.id, uniqueIds));
  return new Map(rows.map((item) => [item.id, item]));
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { assetId } = await context.params;
    const row = await loadAsset(assetId);
    if (!row)
      return NextResponse.json(
        { message: "Không tìm thấy hệ thống điện mặt trời mái nhà." },
        { status: 404 },
      );

    const [components, generation, documents, links, assessments] = await Promise.all([
      db
        .select()
        .from(energyRooftopSystemComponents)
        .where(eq(energyRooftopSystemComponents.systemAssetId, assetId))
        .orderBy(desc(energyRooftopSystemComponents.createdAt)),
      db
        .select()
        .from(energyRooftopGenerationMonthly)
        .where(eq(energyRooftopGenerationMonthly.systemAssetId, assetId))
        .orderBy(desc(energyRooftopGenerationMonthly.period)),
      db
        .select()
        .from(energyRooftopSystemDocuments)
        .where(eq(energyRooftopSystemDocuments.systemAssetId, assetId))
        .orderBy(
          desc(energyRooftopSystemDocuments.issuedAt),
          desc(energyRooftopSystemDocuments.createdAt),
        ),
      row.customerAccountId
        ? db
            .select()
            .from(energyCustomerGridServiceLinks)
            .where(eq(energyCustomerGridServiceLinks.customerAccountId, row.customerAccountId))
            .orderBy(
              desc(energyCustomerGridServiceLinks.validFrom),
              desc(energyCustomerGridServiceLinks.createdAt),
            )
        : Promise.resolve([]),
      row.customerAccountId
        ? db
            .select()
            .from(energySolarAssessments)
            .where(eq(energySolarAssessments.customerAccountId, row.customerAccountId))
            .orderBy(desc(energySolarAssessments.assessedAt))
            .limit(20)
        : Promise.resolve([]),
    ]);
    const assets = await loadAssetNames([
      row.gridConnectionAssetId,
      ...links.flatMap((link) => [
        link.feederAssetId,
        link.bayAssetId,
        link.transformerAssetId,
        link.substationAssetId,
      ]),
    ]);

    return NextResponse.json({
      system: serializeNumeric(row as unknown as Record<string, unknown>),
      components: components.map((item) =>
        serializeNumeric(item as unknown as Record<string, unknown>),
      ),
      generation: generation.map((item) =>
        serializeNumeric(item as unknown as Record<string, unknown>),
      ),
      documents,
      serviceLinks: links.map((link) => ({
        ...link,
        feeder: link.feederAssetId ? (assets.get(link.feederAssetId) ?? null) : null,
        bay: link.bayAssetId ? (assets.get(link.bayAssetId) ?? null) : null,
        transformer: link.transformerAssetId ? (assets.get(link.transformerAssetId) ?? null) : null,
        substation: link.substationAssetId ? (assets.get(link.substationAssetId) ?? null) : null,
      })),
      assessments: assessments.map((item) =>
        serializeNumeric(item as unknown as Record<string, unknown>),
      ),
      gridConnection: row.gridConnectionAssetId
        ? (assets.get(row.gridConnectionAssetId) ?? null)
        : null,
    });
  } catch (error) {
    console.error("Rooftop system detail failed", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể tải chi tiết hệ rooftop." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { assetId } = await context.params;
    const payload = rooftopSystemPatchSchema.parse(await request.json());
    if (!Object.keys(payload).length)
      return NextResponse.json({ message: "Không có trường nào để cập nhật." }, { status: 400 });

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(energyRooftopSystems)
        .where(eq(energyRooftopSystems.assetId, assetId))
        .limit(1);
      if (!existing) throw new Error("Không tìm thấy hệ thống điện mặt trời mái nhà.");

      const customerAccountId = payload.customerAccountId ?? existing.customerAccountId;
      if (!customerAccountId) throw new Error("Hệ rooftop phải được gắn với khách hàng EVN.");
      const [account] = await tx
        .select({
          id: energyCustomerAccounts.id,
          partyId: energyCustomerAccounts.partyId,
          siteId: energyCustomerAccounts.siteId,
          siteLocation: energySites.location,
        })
        .from(energyCustomerAccounts)
        .leftJoin(energySites, eq(energySites.id, energyCustomerAccounts.siteId))
        .where(eq(energyCustomerAccounts.id, customerAccountId))
        .limit(1);
      if (!account) throw new Error("Không tìm thấy khách hàng EVN.");

      if (
        payload.code &&
        payload.code !==
          (
            await tx
              .select({ code: energyAssets.code })
              .from(energyAssets)
              .where(eq(energyAssets.id, assetId))
              .limit(1)
          )[0]?.code
      ) {
        const [duplicate] = await tx
          .select({ id: energyAssets.id })
          .from(energyAssets)
          .where(and(eq(energyAssets.code, payload.code), ne(energyAssets.id, assetId)))
          .limit(1);
        if (duplicate) throw new Error(`Mã hệ thống ${payload.code} đã tồn tại.`);
      }

      let buildingAssetId = existing.buildingAssetId;
      if (Object.prototype.hasOwnProperty.call(payload, "buildingAssetId"))
        buildingAssetId = payload.buildingAssetId ?? null;
      let roofSurfaceId = existing.roofSurfaceId;
      if (Object.prototype.hasOwnProperty.call(payload, "roofSurfaceId"))
        roofSurfaceId = payload.roofSurfaceId ?? null;
      if (roofSurfaceId) {
        const [roof] = await tx
          .select({
            id: energyRoofSurfaces.id,
            buildingAssetId: energyRoofSurfaces.buildingAssetId,
          })
          .from(energyRoofSurfaces)
          .where(eq(energyRoofSurfaces.id, roofSurfaceId))
          .limit(1);
        if (!roof) throw new Error("Không tìm thấy bề mặt mái đã chọn.");
        if (buildingAssetId && buildingAssetId !== roof.buildingAssetId)
          throw new Error("Bề mặt mái không thuộc đúng công trình đã chọn.");
        buildingAssetId = roof.buildingAssetId;
      }
      if (buildingAssetId) {
        const [building] = await tx
          .select({ assetId: energyBuildings.assetId })
          .from(energyBuildings)
          .where(eq(energyBuildings.assetId, buildingAssetId))
          .limit(1);
        if (!building) throw new Error("Không tìm thấy công trình/mái đã chọn.");
      }

      const code = payload.code;
      const assetStatus = payload.operationStatus;
      await tx
        .update(energyAssets)
        .set({
          ...(code ? { code } : {}),
          ...(payload.name ? { name: payload.name } : {}),
          ...(assetStatus ? { status: assetStatus } : {}),
          ...(Object.prototype.hasOwnProperty.call(payload, "commissionedAt")
            ? { commissionedAt: parseDate(payload.commissionedAt) }
            : {}),
          ...(payload.customerAccountId
            ? {
                siteId: account.siteId,
                ownerPartyId: account.partyId,
                location: account.siteLocation,
              }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(energyAssets.id, assetId));

      const systemUpdate = {
        ...(payload.customerAccountId ? { customerAccountId: payload.customerAccountId } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, "buildingAssetId") ||
        Object.prototype.hasOwnProperty.call(payload, "roofSurfaceId")
          ? { buildingAssetId, roofSurfaceId }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, "installedCapacityKwp")
          ? { installedCapacityKwp: String(payload.installedCapacityKwp) }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, "inverterCapacityKw")
          ? {
              inverterCapacityKw:
                payload.inverterCapacityKw == null ? null : String(payload.inverterCapacityKw),
            }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, "batteryCapacityKwh")
          ? {
              batteryCapacityKwh:
                payload.batteryCapacityKwh == null ? null : String(payload.batteryCapacityKwh),
            }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, "gridConnectionAssetId")
          ? { gridConnectionAssetId: payload.gridConnectionAssetId ?? null }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, "annualYieldKwh")
          ? {
              annualYieldKwh:
                payload.annualYieldKwh == null ? null : String(payload.annualYieldKwh),
            }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, "selfConsumptionPct")
          ? {
              selfConsumptionPct:
                payload.selfConsumptionPct == null ? null : String(payload.selfConsumptionPct),
            }
          : {}),
        ...(payload.operationStatus ? { operationStatus: payload.operationStatus } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, "ownershipModel")
          ? { ownershipModel: payload.ownershipModel ?? null }
          : {}),
        ...(payload.installationType ? { installationType: payload.installationType } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, "installerPartyId")
          ? { installerPartyId: payload.installerPartyId ?? null }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, "evRegistrationNo")
          ? { evRegistrationNo: payload.evRegistrationNo ?? null }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, "evnAcceptanceAt")
          ? { evnAcceptanceAt: parseDate(payload.evnAcceptanceAt) }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, "meteringScheme")
          ? { meteringScheme: payload.meteringScheme ?? null }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, "exportLimitKw")
          ? { exportLimitKw: payload.exportLimitKw == null ? null : String(payload.exportLimitKw) }
          : {}),
        ...(payload.source ? { source: payload.source } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, "sourceId")
          ? { sourceId: payload.sourceId ?? null }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, "sourceRef")
          ? { sourceRef: payload.sourceRef ?? null }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, "lastVerifiedAt")
          ? { lastVerifiedAt: parseDate(payload.lastVerifiedAt) }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, "confidence")
          ? { confidence: payload.confidence == null ? null : String(payload.confidence) }
          : {}),
      };
      const [system] = await tx
        .update(energyRooftopSystems)
        .set(systemUpdate)
        .where(eq(energyRooftopSystems.assetId, assetId))
        .returning();
      return system;
    });
    return NextResponse.json({
      system: serializeNumeric(result as unknown as Record<string, unknown>),
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { message: "Thông tin cập nhật hệ rooftop không hợp lệ.", issues: error.issues },
        { status: 400 },
      );
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể cập nhật hệ rooftop." },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { assetId } = await context.params;
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ assetId: energyRooftopSystems.assetId })
        .from(energyRooftopSystems)
        .where(eq(energyRooftopSystems.assetId, assetId))
        .limit(1);
      if (!existing) throw new Error("Không tìm thấy hệ thống điện mặt trời mái nhà.");
      await tx
        .update(energyRooftopSystems)
        .set({ operationStatus: "DELETED" })
        .where(eq(energyRooftopSystems.assetId, assetId));
      const [asset] = await tx
        .update(energyAssets)
        .set({ status: "DELETED", updatedAt: new Date() })
        .where(eq(energyAssets.id, assetId))
        .returning({ id: energyAssets.id, status: energyAssets.status });
      return asset;
    });
    return NextResponse.json({
      deleted: true,
      asset: result,
      message: "Hệ rooftop đã được đánh dấu DELETED để bảo toàn lịch sử.",
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể xóa hệ rooftop." },
      { status: 400 },
    );
  }
}
