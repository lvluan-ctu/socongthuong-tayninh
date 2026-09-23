import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyAssets, energyEvConnectors, energyEvSessions, energyEvStationSnapshots, energyEvStations, energyParties, energySites } from '@/db/schema';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ assetId: string }> };
const patchSchema = z.object({ name: z.string().trim().min(2).max(250).optional(), operationStatus: z.enum(['ACTIVE', 'MAINTENANCE', 'OFFLINE', 'PLANNED', 'DECOMMISSIONED']).optional(), installedPowerKw: z.number().finite().positive().optional(), connectionCapacityKw: z.number().finite().positive().nullable().optional(), connectionPointAssetId: z.string().uuid().nullable().optional(), connectionMethod: z.string().trim().max(120).nullable().optional(), connectionSourceRef: z.string().trim().max(500).nullable().optional(), actualPeakPowerKw: z.number().finite().min(0).nullable().optional() });

function invalidId(id: string) { return !z.string().uuid().safeParse(id).success; }
function numeric(value: string | number | null) { return value == null ? null : Number(value); }

export async function GET(_request: Request, context: Context) {
  try {
    const { assetId } = await context.params;
    if (invalidId(assetId)) return NextResponse.json({ message: 'Mã station không hợp lệ.' }, { status: 400 });
    const [station] = await db.select({ assetId: energyEvStations.assetId, applicationId: energyEvStations.applicationId, code: energyAssets.code, name: energyAssets.name, assetStatus: energyAssets.status, location: energyAssets.location, siteId: energyEvStations.siteId, siteName: energySites.name, siteAddress: energySites.address, adminAreaCode: energySites.adminAreaCode, operatorPartyId: energyEvStations.operatorPartyId, operatorName: energyParties.name, totalPowerKw: energyEvStations.totalPowerKw, installedPowerKw: energyEvStations.installedPowerKw, connectionCapacityKw: energyEvStations.connectionCapacityKw, connectionPointAssetId: energyEvStations.connectionPointAssetId, connectionMethod: energyEvStations.connectionMethod, connectionSourceRef: energyEvStations.connectionSourceRef, actualPeakPowerKw: energyEvStations.actualPeakPowerKw, connectorCount: energyEvStations.connectorCount, availableCount: energyEvStations.availableCount, occupiedCount: energyEvStations.occupiedCount, faultedCount: energyEvStations.faultedCount, utilizationPct: energyEvStations.utilizationPct, gridAssetId: energyEvStations.gridAssetId, operationStatus: energyEvStations.operationStatus }).from(energyEvStations).innerJoin(energyAssets, eq(energyAssets.id, energyEvStations.assetId)).leftJoin(energyParties, eq(energyParties.id, energyEvStations.operatorPartyId)).leftJoin(energySites, eq(energySites.id, energyEvStations.siteId)).where(eq(energyEvStations.assetId, assetId)).limit(1);
    if (!station) return NextResponse.json({ message: 'Không tìm thấy station.' }, { status: 404 });
    const [connectors, sessions, snapshots] = await Promise.all([
      db.select().from(energyEvConnectors).where(eq(energyEvConnectors.stationAssetId, assetId)),
      db.select({ id: energyEvSessions.id, connectorId: energyEvSessions.connectorId, connectorCode: energyEvConnectors.code, startedAt: energyEvSessions.startedAt, endedAt: energyEvSessions.endedAt, energyKwh: energyEvSessions.energyKwh, peakPowerKw: energyEvSessions.peakPowerKw, status: energyEvSessions.status }).from(energyEvSessions).innerJoin(energyEvConnectors, eq(energyEvConnectors.id, energyEvSessions.connectorId)).where(eq(energyEvConnectors.stationAssetId, assetId)).orderBy(desc(energyEvSessions.startedAt)).limit(1000),
      db.select().from(energyEvStationSnapshots).where(eq(energyEvStationSnapshots.stationAssetId, assetId)).orderBy(desc(energyEvStationSnapshots.measuredAt)).limit(1000),
    ]);
    return NextResponse.json({ station: { ...station, totalPowerKw: Number(station.totalPowerKw), installedPowerKw: numeric(station.installedPowerKw) ?? Number(station.totalPowerKw), connectionCapacityKw: numeric(station.connectionCapacityKw), actualPeakPowerKw: numeric(station.actualPeakPowerKw), utilizationPct: Number(station.utilizationPct) }, connectors: connectors.map((item) => ({ ...item, powerKw: Number(item.powerKw) })), sessions: sessions.map((item) => ({ ...item, energyKwh: numeric(item.energyKwh), peakPowerKw: numeric(item.peakPowerKw) })), snapshots: snapshots.map((item) => ({ ...item, utilizationPct: Number(item.utilizationPct), energyDeliveredKwh: numeric(item.energyDeliveredKwh), peakPowerKw: numeric(item.peakPowerKw) })) });
  } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải Station 360.' }, { status: 500 }); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { assetId } = await context.params;
    if (invalidId(assetId)) return NextResponse.json({ message: 'Mã station không hợp lệ.' }, { status: 400 });
    const payload = patchSchema.parse(await request.json());
    const [existing] = await db.select().from(energyEvStations).where(eq(energyEvStations.assetId, assetId)).limit(1);
    if (!existing) return NextResponse.json({ message: 'Không tìm thấy station.' }, { status: 404 });
    const [updated] = await db.transaction(async (tx) => {
      const [station] = await tx.update(energyEvStations).set({ installedPowerKw: payload.installedPowerKw === undefined ? existing.installedPowerKw ?? existing.totalPowerKw : String(payload.installedPowerKw), connectionCapacityKw: payload.connectionCapacityKw === undefined ? existing.connectionCapacityKw : payload.connectionCapacityKw == null ? null : String(payload.connectionCapacityKw), connectionPointAssetId: payload.connectionPointAssetId === undefined ? existing.connectionPointAssetId : payload.connectionPointAssetId, connectionMethod: payload.connectionMethod === undefined ? existing.connectionMethod : payload.connectionMethod, connectionSourceRef: payload.connectionSourceRef === undefined ? existing.connectionSourceRef : payload.connectionSourceRef, actualPeakPowerKw: payload.actualPeakPowerKw === undefined ? existing.actualPeakPowerKw : payload.actualPeakPowerKw == null ? null : String(payload.actualPeakPowerKw), operationStatus: payload.operationStatus ?? existing.operationStatus }).where(eq(energyEvStations.assetId, assetId)).returning();
      if (payload.name || payload.operationStatus) await tx.update(energyAssets).set({ name: payload.name, status: payload.operationStatus ? payload.operationStatus : undefined, updatedAt: new Date() }).where(eq(energyAssets.id, assetId));
      return [station] as const;
    });
    return NextResponse.json({ ...updated, installedPowerKw: numeric(updated.installedPowerKw) ?? Number(updated.totalPowerKw), connectionCapacityKw: numeric(updated.connectionCapacityKw), actualPeakPowerKw: numeric(updated.actualPeakPowerKw) });
  } catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin station không hợp lệ.', issues: error.issues }, { status: 400 }); return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật station.' }, { status: 400 }); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { assetId } = await context.params;
    if (invalidId(assetId)) return NextResponse.json({ message: 'Mã station không hợp lệ.' }, { status: 400 });
    const [existing] = await db.select({ assetId: energyEvStations.assetId }).from(energyEvStations).where(eq(energyEvStations.assetId, assetId)).limit(1);
    if (!existing) return NextResponse.json({ message: 'Không tìm thấy station.' }, { status: 404 });
    await db.transaction(async (tx) => { await tx.update(energyEvStations).set({ operationStatus: 'DECOMMISSIONED' }).where(eq(energyEvStations.assetId, assetId)); await tx.update(energyAssets).set({ status: 'DECOMMISSIONED', updatedAt: new Date() }).where(eq(energyAssets.id, assetId)); });
    return NextResponse.json({ assetId, status: 'DECOMMISSIONED', message: 'Station đã được archive mềm; session/snapshot vẫn được giữ.' });
  } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể archive station.' }, { status: 400 }); }
}
