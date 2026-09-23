import { asc, count, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  energyAssets,
  energyEvConnectors,
  energyEvStations,
  energyParties,
  energySites,
} from "@/db/schema";
import { db } from "@/lib/db";
import { paginatedResponse, parsePagination } from "@/lib/pagination";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    code: z.string().trim().min(2).max(100),
    name: z.string().trim().min(2).max(250),
    operatorPartyId: z.string().uuid(),
    siteCode: z.string().trim().min(2).max(100),
    siteName: z.string().trim().min(2).max(250),
    address: z.string().trim().min(2).max(500),
    adminAreaCode: z.string().trim().min(1).max(50),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    totalPowerKw: z.number().positive(),
    connectorCount: z.number().int().positive(),
    connectorTypes: z.array(z.string().trim().min(1)).min(1),
    connectorPowerKw: z.number().positive(),
    gridAssetId: z.string().uuid().nullable().optional(),
    operationStatus: z
      .enum(["ACTIVE", "MAINTENANCE", "OFFLINE", "PLANNED", "DECOMMISSIONED"])
      .default("ACTIVE"),
  })
  .superRefine((value, context) => {
    if (value.connectorPowerKw * value.connectorCount > value.totalPowerKw * 1.25) {
      context.addIssue({
        code: "custom",
        path: ["connectorPowerKw"],
        message: "Tổng công suất connector vượt 125% công suất trạm; hãy kiểm tra số liệu.",
      });
    }
  });

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const wantsPagination =
      params.get("options") !== "true" && (params.has("page") || params.has("pageSize"));
    const pagination = parsePagination(params);
    const listQuery = db
      .select({
        assetId: energyEvStations.assetId,
        code: energyAssets.code,
        name: energyAssets.name,
        status: energyAssets.status,
        operatorPartyId: energyEvStations.operatorPartyId,
        operatorName: energyParties.name,
        siteId: energyEvStations.siteId,
        siteName: energySites.name,
        address: energySites.address,
        adminAreaCode: energySites.adminAreaCode,
        latitude: sql<number | null>`ST_Y(${energySites.location}::geometry)`,
        longitude: sql<number | null>`ST_X(${energySites.location}::geometry)`,
        totalPowerKw: energyEvStations.totalPowerKw,
        installedPowerKw: energyEvStations.installedPowerKw,
        connectionCapacityKw: energyEvStations.connectionCapacityKw,
        actualPeakPowerKw: energyEvStations.actualPeakPowerKw,
        connectorCount: energyEvStations.connectorCount,
        availableCount: energyEvStations.availableCount,
        occupiedCount: energyEvStations.occupiedCount,
        faultedCount: energyEvStations.faultedCount,
        utilizationPct: energyEvStations.utilizationPct,
        gridAssetId: energyEvStations.gridAssetId,
        operationStatus: energyEvStations.operationStatus,
        applicationId: energyEvStations.applicationId,
      })
      .from(energyEvStations)
      .innerJoin(energyAssets, eq(energyAssets.id, energyEvStations.assetId))
      .leftJoin(energyParties, eq(energyParties.id, energyEvStations.operatorPartyId))
      .leftJoin(energySites, eq(energySites.id, energyEvStations.siteId))
      .orderBy(asc(energyAssets.name));
    const [rows, totalRows] = await Promise.all([
      wantsPagination ? listQuery.limit(pagination.pageSize).offset(pagination.offset) : listQuery,
      db.select({ value: count() }).from(energyEvStations),
    ]);
    const items = rows.map((r) => ({
      ...r,
      totalPowerKw: Number(r.totalPowerKw),
      installedPowerKw:
        r.installedPowerKw == null ? Number(r.totalPowerKw) : Number(r.installedPowerKw),
      connectionCapacityKw: r.connectionCapacityKw == null ? null : Number(r.connectionCapacityKw),
      actualPeakPowerKw: r.actualPeakPowerKw == null ? null : Number(r.actualPeakPowerKw),
      utilizationPct: Number(r.utilizationPct),
    }));
    return wantsPagination
      ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0))
      : NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể tải trạm sạc." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const [operator] = await db
      .select()
      .from(energyParties)
      .where(eq(energyParties.id, payload.operatorPartyId))
      .limit(1);
    if (!operator)
      return NextResponse.json({ message: "Không tìm thấy đơn vị vận hành." }, { status: 404 });
    const [dup] = await db
      .select({ id: energyAssets.id })
      .from(energyAssets)
      .where(eq(energyAssets.code, payload.code))
      .limit(1);
    if (dup) return NextResponse.json({ message: "Mã trạm sạc đã tồn tại." }, { status: 409 });
    const result = await db.transaction(async (tx) => {
      let [site] = await tx
        .select()
        .from(energySites)
        .where(eq(energySites.code, payload.siteCode))
        .limit(1);
      const location =
        payload.latitude != null && payload.longitude != null
          ? `SRID=4326;POINT(${payload.longitude} ${payload.latitude})`
          : null;
      if (!site) {
        [site] = await tx
          .insert(energySites)
          .values({
            partyId: payload.operatorPartyId,
            code: payload.siteCode,
            name: payload.siteName,
            siteType: "EV_CHARGING_STATION",
            address: payload.address,
            adminAreaCode: payload.adminAreaCode ?? null,
            location,
            status: "ACTIVE",
            classification: "INTERNAL",
          })
          .returning();
      } else if (payload.adminAreaCode || payload.address || location) {
        [site] = await tx
          .update(energySites)
          .set({
            name: payload.siteName,
            address: payload.address,
            adminAreaCode: payload.adminAreaCode ?? site.adminAreaCode,
            location: location ?? site.location,
            updatedAt: new Date(),
          })
          .where(eq(energySites.id, site.id))
          .returning();
      }
      const [asset] = await tx
        .insert(energyAssets)
        .values({
          siteId: site.id,
          ownerPartyId: payload.operatorPartyId,
          assetType: "EV_STATION",
          code: payload.code,
          name: payload.name,
          status: payload.operationStatus === "ACTIVE" ? "ACTIVE" : payload.operationStatus,
          location,
          classification: "INTERNAL",
          metadata: { source: "MANUAL" },
        })
        .returning();
      const [station] = await tx
        .insert(energyEvStations)
        .values({
          assetId: asset.id,
          operatorPartyId: payload.operatorPartyId,
          siteId: site.id,
          totalPowerKw: String(payload.totalPowerKw),
          installedPowerKw: String(payload.totalPowerKw),
          connectionCapacityKw: null,
          connectionPointAssetId: null,
          connectionMethod: null,
          connectionSourceRef: null,
          actualPeakPowerKw: null,
          connectorCount: payload.connectorCount,
          availableCount: payload.connectorCount,
          occupiedCount: 0,
          faultedCount: 0,
          utilizationPct: "0",
          gridAssetId: payload.gridAssetId ?? null,
          operationStatus: payload.operationStatus,
        })
        .returning();
      const rows = Array.from({ length: payload.connectorCount }, (_, i) => ({
        stationAssetId: asset.id,
        code: `${payload.code}-C${String(i + 1).padStart(2, "0")}`,
        connectorType: payload.connectorTypes[i % payload.connectorTypes.length] ?? "OTHER",
        chargingMode: String(
          (payload.connectorTypes[i % payload.connectorTypes.length] ?? "")
            .toUpperCase()
            .includes("CCS")
            ? "DC"
            : "AC",
        ),
        powerKw: String(payload.connectorPowerKw),
        status: "AVAILABLE",
      }));
      if (rows.length) await tx.insert(energyEvConnectors).values(rows);
      return { asset, station, site };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { message: "Thông tin trạm sạc không hợp lệ.", issues: error.issues },
        { status: 400 },
      );
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể lưu trạm sạc." },
      { status: 400 },
    );
  }
}
