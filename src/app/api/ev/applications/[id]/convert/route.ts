import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyAssets, energyEvApplicationHistory, energyEvConnectors, energyEvStationApplications, energyEvStations, energyParties, energySites } from '@/db/schema';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

function invalidId(id: string) {
  return !z.string().uuid().safeParse(id).success;
}

const schema = z.object({
  stationCode: z.string().trim().min(2).max(100),
  stationName: z.string().trim().min(2).max(250),
  operatorPartyId: z.string().uuid().nullable().optional(),
  connectorPowerKw: z.number().finite().positive().default(60),
  actor: z.string().trim().min(2).max(200),
});

export async function POST(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (invalidId(id)) return NextResponse.json({ message: 'Mã hồ sơ không hợp lệ.' }, { status: 400 });
    const payload = schema.parse(await request.json());
    const [app] = await db.select().from(energyEvStationApplications).where(eq(energyEvStationApplications.id, id)).limit(1);
    if (!app) return NextResponse.json({ message: 'Không tìm thấy hồ sơ đăng ký.' }, { status: 404 });
    if (app.status !== 'APPROVED') return NextResponse.json({ message: 'Chỉ hồ sơ APPROVED mới được chuyển thành trạm vận hành.' }, { status: 409 });
    const [duplicate] = await db.select({ id: energyAssets.id }).from(energyAssets).where(eq(energyAssets.code, payload.stationCode)).limit(1);
    if (duplicate) return NextResponse.json({ message: 'Mã trạm đã tồn tại.' }, { status: 409 });
    if (payload.operatorPartyId) {
      const [operator] = await db.select({ id: energyParties.id }).from(energyParties).where(eq(energyParties.id, payload.operatorPartyId)).limit(1);
      if (!operator) return NextResponse.json({ message: 'Không tìm thấy đơn vị vận hành.' }, { status: 404 });
    }

    const installedPowerKw = app.approvedPowerKw ?? app.requestedPowerKw;
    const result = await db.transaction(async (tx) => {
      const [site] = app.siteId ? await tx.select().from(energySites).where(eq(energySites.id, app.siteId)).limit(1) : [];
      const operatorPartyId = payload.operatorPartyId ?? app.applicantPartyId;
      const [asset] = await tx.insert(energyAssets).values({
        siteId: app.siteId,
        ownerPartyId: operatorPartyId,
        assetType: 'EV_STATION',
        code: payload.stationCode,
        name: payload.stationName,
        status: 'ACTIVE',
        location: app.location,
        classification: 'INTERNAL',
        metadata: { applicationId: id, source: 'EV_APPLICATION', approvedPowerKw: installedPowerKw },
      }).returning();
      const [station] = await tx.insert(energyEvStations).values({
        assetId: asset.id,
        applicationId: id,
        operatorPartyId,
        siteId: app.siteId,
        totalPowerKw: installedPowerKw,
        installedPowerKw,
        connectionCapacityKw: app.connectionCapacityKw,
        connectionPointAssetId: app.connectionPointAssetId,
        connectionMethod: app.connectionMethod,
        connectionSourceRef: app.connectionSourceRef,
        actualPeakPowerKw: null,
        connectorCount: app.requestedConnectorCount,
        availableCount: app.requestedConnectorCount,
        occupiedCount: 0,
        faultedCount: 0,
        utilizationPct: '0',
        gridAssetId: app.gridAssetId,
        operationStatus: 'ACTIVE',
      }).returning();
      const types = app.requestedConnectorTypes.length ? app.requestedConnectorTypes : ['OTHER'];
      const connectorRows = Array.from({ length: app.requestedConnectorCount }, (_, index) => {
        const connectorType = types[index % types.length] ?? 'OTHER';
        return { stationAssetId: asset.id, code: `${payload.stationCode}-C${String(index + 1).padStart(2, '0')}`, connectorType, chargingMode: connectorType.toUpperCase().includes('CCS') ? 'DC' : 'AC', powerKw: String(payload.connectorPowerKw), status: 'AVAILABLE' };
      });
      if (connectorRows.length) await tx.insert(energyEvConnectors).values(connectorRows);
      await tx.update(energyEvStationApplications).set({ status: 'CONVERTED' }).where(eq(energyEvStationApplications.id, id));
      await tx.insert(energyEvApplicationHistory).values({ applicationId: id, fromStatus: 'APPROVED', toStatus: 'CONVERTED', action: 'CONVERT_TO_STATION', actor: payload.actor, metadata: { stationAssetId: asset.id, stationCode: payload.stationCode, installedPowerKw } });
      return { asset, station, site };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin tạo trạm không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tạo trạm.' }, { status: 400 });
  }
}
