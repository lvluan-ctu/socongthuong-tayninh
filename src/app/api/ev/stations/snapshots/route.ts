import { count, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { energyAssets, energyEvStationSnapshots, energyEvStations } from "@/db/schema";
import { db } from "@/lib/db";
import { paginatedResponse, parsePagination } from "@/lib/pagination";

export const dynamic = "force-dynamic";

const schema = z.object({
  stationAssetId: z.string().uuid(),
  measuredAt: z.string().min(1),
  availableCount: z.number().int().min(0),
  occupiedCount: z.number().int().min(0),
  faultedCount: z.number().int().min(0),
  utilizationPct: z.number().min(0).max(100),
  energyDeliveredKwh: z.number().min(0).nullable().optional(),
  peakPowerKw: z.number().min(0).nullable().optional(),
  source: z.string().trim().min(2).max(80).default("MANUAL"),
});

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const wantsPagination =
      params.get("options") !== "true" && (params.has("page") || params.has("pageSize"));
    const pagination = parsePagination(params);
    const listQuery = db
      .select({
        id: energyEvStationSnapshots.id,
        stationAssetId: energyEvStationSnapshots.stationAssetId,
        stationName: energyAssets.name,
        measuredAt: energyEvStationSnapshots.measuredAt,
        availableCount: energyEvStationSnapshots.availableCount,
        occupiedCount: energyEvStationSnapshots.occupiedCount,
        faultedCount: energyEvStationSnapshots.faultedCount,
        utilizationPct: energyEvStationSnapshots.utilizationPct,
        energyDeliveredKwh: energyEvStationSnapshots.energyDeliveredKwh,
        peakPowerKw: energyEvStationSnapshots.peakPowerKw,
        source: energyEvStationSnapshots.source,
      })
      .from(energyEvStationSnapshots)
      .innerJoin(energyAssets, eq(energyAssets.id, energyEvStationSnapshots.stationAssetId))
      .orderBy(desc(energyEvStationSnapshots.measuredAt));
    const [rows, totalRows] = await Promise.all([
      wantsPagination ? listQuery.limit(pagination.pageSize).offset(pagination.offset) : listQuery,
      db.select({ value: count() }).from(energyEvStationSnapshots),
    ]);
    const items = rows.map((r) => ({
      ...r,
      utilizationPct: Number(r.utilizationPct),
      energyDeliveredKwh: r.energyDeliveredKwh == null ? null : Number(r.energyDeliveredKwh),
      peakPowerKw: r.peakPowerKw == null ? null : Number(r.peakPowerKw),
    }));
    return wantsPagination
      ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0))
      : NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể tải snapshot trạm sạc." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const p = schema.parse(await request.json());
    const [station] = await db
      .select()
      .from(energyEvStations)
      .where(eq(energyEvStations.assetId, p.stationAssetId))
      .limit(1);
    if (!station)
      return NextResponse.json({ message: "Không tìm thấy trạm sạc." }, { status: 404 });
    const measuredAt = new Date(p.measuredAt);
    if (Number.isNaN(measuredAt.getTime()))
      return NextResponse.json({ message: "Thời điểm snapshot không hợp lệ." }, { status: 400 });
    if (p.availableCount + p.occupiedCount + p.faultedCount > station.connectorCount)
      return NextResponse.json(
        { message: "Tổng trạng thái connector vượt quá số connector của trạm." },
        { status: 400 },
      );
    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(energyEvStationSnapshots)
        .values({
          stationAssetId: p.stationAssetId,
          measuredAt,
          availableCount: p.availableCount,
          occupiedCount: p.occupiedCount,
          faultedCount: p.faultedCount,
          utilizationPct: String(p.utilizationPct),
          energyDeliveredKwh: p.energyDeliveredKwh == null ? null : String(p.energyDeliveredKwh),
          peakPowerKw: p.peakPowerKw == null ? null : String(p.peakPowerKw),
          source: p.source,
        })
        .returning();
      await tx
        .update(energyEvStations)
        .set({
          availableCount: p.availableCount,
          occupiedCount: p.occupiedCount,
          faultedCount: p.faultedCount,
          utilizationPct: String(p.utilizationPct),
        })
        .where(eq(energyEvStations.assetId, p.stationAssetId));
      return created;
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { message: "Snapshot vận hành không hợp lệ.", issues: error.issues },
        { status: 400 },
      );
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể lưu snapshot." },
      { status: 400 },
    );
  }
}
