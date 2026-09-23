import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyAdminAreas, energyAssets, energyParties, energySites } from '@/db/schema';
import { sitePatchSchema } from '@/lib/core-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ siteId: string }> };

function invalidId(value: string) { return !z.string().uuid().safeParse(value).success; }
function pointFromCoordinates(latitude: number | null | undefined, longitude: number | null | undefined) {
  return latitude != null && longitude != null ? `SRID=4326;POINT(${longitude} ${latitude})` : null;
}

export async function GET(_request: Request, context: Context) {
  try {
    const { siteId } = await context.params;
    if (invalidId(siteId)) return NextResponse.json({ message: 'Mã Site không hợp lệ.' }, { status: 400 });
    const [site] = await db.select({
      id: energySites.id,
      code: energySites.code,
      name: energySites.name,
      siteType: energySites.siteType,
      partyId: energySites.partyId,
      partyName: energyParties.name,
      address: energySites.address,
      adminAreaCode: energySites.adminAreaCode,
      adminAreaName: energyAdminAreas.name,
      status: energySites.status,
      classification: energySites.classification,
      latitude: sql<number | null>`ST_Y(${energySites.location}::geometry)`,
      longitude: sql<number | null>`ST_X(${energySites.location}::geometry)`,
      boundaryPresent: sql<boolean>`${energySites.boundary} IS NOT NULL`,
      metadata: energySites.metadata,
      createdAt: energySites.createdAt,
      updatedAt: energySites.updatedAt,
    }).from(energySites)
      .leftJoin(energyParties, eq(energyParties.id, energySites.partyId))
      .leftJoin(energyAdminAreas, eq(energyAdminAreas.code, energySites.adminAreaCode))
      .where(eq(energySites.id, siteId)).limit(1);
    if (!site) return NextResponse.json({ message: 'Không tìm thấy Site.' }, { status: 404 });
    const [assetSummary] = await db.select({ count: sql<number>`count(*)::int` }).from(energyAssets).where(eq(energyAssets.siteId, siteId));
    return NextResponse.json({ site, assetCount: Number(assetSummary?.count ?? 0), method: { geometry: 'PostGIS location/boundary thật; không tự geocode.', identity: 'Site là shared entity dùng chung cho Grid, Solar, Efficiency, Carbon, Safety và EV.' } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải Site 360.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { siteId } = await context.params;
    if (invalidId(siteId)) return NextResponse.json({ message: 'Mã Site không hợp lệ.' }, { status: 400 });
    const [current] = await db.select().from(energySites).where(eq(energySites.id, siteId)).limit(1);
    if (!current) return NextResponse.json({ message: 'Không tìm thấy Site.' }, { status: 404 });
    const payload = sitePatchSchema.parse(await request.json());
    if (payload.partyId) {
      const [party] = await db.select({ id: energyParties.id }).from(energyParties).where(eq(energyParties.id, payload.partyId)).limit(1);
      if (!party) return NextResponse.json({ message: 'Không tìm thấy Party sở hữu/quản lý Site.' }, { status: 404 });
    }
    if (payload.code && payload.code !== current.code) {
      const [duplicate] = await db.select({ id: energySites.id }).from(energySites).where(eq(energySites.code, payload.code)).limit(1);
      if (duplicate) return NextResponse.json({ message: `Mã Site ${payload.code} đã tồn tại.` }, { status: 409 });
    }
    const hasCoordinates = Object.prototype.hasOwnProperty.call(payload, 'latitude') || Object.prototype.hasOwnProperty.call(payload, 'longitude');
    const [updated] = await db.update(energySites).set({
      ...(payload.partyId === undefined ? {} : { partyId: payload.partyId }),
      ...(payload.code === undefined ? {} : { code: payload.code }),
      ...(payload.name === undefined ? {} : { name: payload.name }),
      ...(payload.siteType === undefined ? {} : { siteType: payload.siteType }),
      ...(payload.address === undefined ? {} : { address: payload.address }),
      ...(payload.adminAreaCode === undefined ? {} : { adminAreaCode: payload.adminAreaCode }),
      ...(hasCoordinates ? { location: pointFromCoordinates(payload.latitude, payload.longitude) } : {}),
      ...(payload.status === undefined ? {} : { status: payload.status }),
      ...(payload.classification === undefined ? {} : { classification: payload.classification }),
      ...(payload.metadata === undefined ? {} : { metadata: payload.metadata }),
      updatedAt: new Date(),
    }).where(eq(energySites.id, siteId)).returning();
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin Site không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật Site.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { siteId } = await context.params;
    if (invalidId(siteId)) return NextResponse.json({ message: 'Mã Site không hợp lệ.' }, { status: 400 });
    const [updated] = await db.update(energySites).set({ status: 'ARCHIVED', updatedAt: new Date() }).where(eq(energySites.id, siteId)).returning({ id: energySites.id, code: energySites.code, status: energySites.status });
    if (!updated) return NextResponse.json({ message: 'Không tìm thấy Site.' }, { status: 404 });
    return NextResponse.json({ ...updated, message: 'Site đã chuyển sang ARCHIVED để bảo toàn liên kết và lịch sử.' });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu trữ Site.' }, { status: 400 });
  }
}
