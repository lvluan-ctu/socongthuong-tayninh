import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyAssets, energySites, energySubstations } from '@/db/schema';
import { substationFormSchema } from '@/features/grid/substations/substation.schema';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ assetId: string }> };
const paramsSchema = z.object({ assetId: z.string().uuid() });

async function loadSubstation(assetId: string) {
  const [row] = await db.select({
    assetId: energyAssets.id,
    code: energyAssets.code,
    name: energyAssets.name,
    status: energyAssets.status,
    commissionedAt: energyAssets.commissionedAt,
    siteId: energyAssets.siteId,
    siteCode: energySites.code,
    address: energySites.address,
    adminAreaCode: energySites.adminAreaCode,
    latitude: sql<number | null>`CASE WHEN ${energyAssets.location} IS NULL THEN NULL ELSE ST_Y(${energyAssets.location}::geometry) END`,
    longitude: sql<number | null>`CASE WHEN ${energyAssets.location} IS NULL THEN NULL ELSE ST_X(${energyAssets.location}::geometry) END`,
    voltageLevelKv: energySubstations.voltageLevelKv,
    substationType: energySubstations.substationType,
    designedCapacityMva: energySubstations.designedCapacityMva,
    installedCapacityMva: energySubstations.installedCapacityMva,
    currentLoadMva: energySubstations.currentLoadMva,
    loadFactorPct: energySubstations.loadFactorPct,
    availableCapacityMva: energySubstations.availableCapacityMva,
    overloadStatus: energySubstations.overloadStatus,
    operator: energySubstations.operator,
  }).from(energyAssets)
    .innerJoin(energySubstations, eq(energySubstations.assetId, energyAssets.id))
    .leftJoin(energySites, eq(energySites.id, energyAssets.siteId))
    .where(eq(energyAssets.id, assetId))
    .limit(1);
  if (!row) return null;
  return {
    ...row,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    voltageLevelKv: Number(row.voltageLevelKv),
    designedCapacityMva: Number(row.designedCapacityMva),
    installedCapacityMva: Number(row.installedCapacityMva),
    currentLoadMva: Number(row.currentLoadMva),
    loadFactorPct: Number(row.loadFactorPct),
    availableCapacityMva: Number(row.availableCapacityMva),
  };
}

export async function GET(_request: Request, context: Context) {
  try {
    const { assetId } = paramsSchema.parse(await context.params);
    const item = await loadSubstation(assetId);
    if (!item) return NextResponse.json({ message: 'Không tìm thấy trạm biến áp.' }, { status: 404 });
    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Mã trạm không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải hồ sơ trạm.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { assetId } = paramsSchema.parse(await context.params);
    const parsed = substationFormSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ message: 'Dữ liệu trạm không hợp lệ.', errors: parsed.error.flatten(), issues: parsed.error.issues }, { status: 400 });
    const input = parsed.data;
    const current = await loadSubstation(assetId);
    if (!current) return NextResponse.json({ message: 'Không tìm thấy trạm biến áp.' }, { status: 404 });
    if (input.code !== current.code) return NextResponse.json({ message: 'Không được thay đổi mã trạm sau khi tạo.', issues: [{ path: ['code'], message: 'Mã trạm là định danh bất biến.' }] }, { status: 400 });

    const location = `SRID=4326;POINT(${input.longitude} ${input.latitude})`;
    const designed = input.designedCapacityMva;
    const installed = input.installedCapacityMva;
    const currentLoad = input.currentLoadMva;
    const loadFactor = installed > 0 ? currentLoad / installed * 100 : 0;
    const available = Math.max(0, installed - currentLoad);
    const overloadStatus = loadFactor >= 100 ? 'OVERLOAD' : loadFactor >= 90 ? 'CRITICAL' : loadFactor >= 80 ? 'WARNING' : 'NORMAL';

    await db.transaction(async (tx) => {
      let siteId = current.siteId;
      if (siteId) {
        await tx.update(energySites).set({
          name: input.name,
          address: input.address,
          adminAreaCode: input.adminAreaCode,
          location,
          status: input.status === 'DECOMMISSIONED' ? 'INACTIVE' : input.status,
          metadata: { source: 'MANUAL', updatedFrom: 'SUBSTATION_MANAGEMENT' },
          updatedAt: new Date(),
        }).where(eq(energySites.id, siteId));
      } else {
        const duplicateSite = await tx.select({ id: energySites.id }).from(energySites).where(eq(energySites.code, input.siteCode)).limit(1);
        if (duplicateSite[0]) throw new Error(`Mã địa điểm ${input.siteCode} đã tồn tại.`);
        const [createdSite] = await tx.insert(energySites).values({
          code: input.siteCode,
          name: input.name,
          siteType: 'SUBSTATION',
          address: input.address,
          adminAreaCode: input.adminAreaCode,
          location,
          classification: 'INTERNAL',
          status: input.status === 'DECOMMISSIONED' ? 'INACTIVE' : input.status,
          metadata: { source: 'MANUAL', createdFrom: 'SUBSTATION_MANAGEMENT' },
        }).returning({ id: energySites.id });
        siteId = createdSite.id;
      }

      await tx.update(energyAssets).set({
        siteId,
        name: input.name,
        status: input.status,
        commissionedAt: new Date(`${input.commissionedAt}T00:00:00+07:00`),
        location,
        metadata: {
          address: input.address,
          adminAreaCode: input.adminAreaCode,
          latitude: input.latitude,
          longitude: input.longitude,
          source: 'MANUAL',
        },
        updatedAt: new Date(),
      }).where(eq(energyAssets.id, assetId));

      await tx.update(energySubstations).set({
        voltageLevelKv: String(input.voltageLevelKv),
        substationType: input.substationType,
        designedCapacityMva: String(designed),
        installedCapacityMva: String(installed),
        currentLoadMva: String(currentLoad),
        loadFactorPct: String(loadFactor),
        availableCapacityMva: String(available),
        overloadStatus,
        operator: input.operator,
      }).where(eq(energySubstations.assetId, assetId));
    });

    return NextResponse.json(await loadSubstation(assetId));
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Yêu cầu cập nhật không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật trạm biến áp.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { assetId } = paramsSchema.parse(await context.params);
    const current = await loadSubstation(assetId);
    if (!current) return NextResponse.json({ message: 'Không tìm thấy trạm biến áp.' }, { status: 404 });
    await db.transaction(async (tx) => {
      await tx.update(energyAssets).set({ status: 'DECOMMISSIONED', updatedAt: new Date() }).where(eq(energyAssets.id, assetId));
      if (current.siteId) await tx.update(energySites).set({ status: 'INACTIVE', updatedAt: new Date() }).where(eq(energySites.id, current.siteId));
    });
    return NextResponse.json({ message: `Đã chuyển trạm ${current.code} sang trạng thái ngừng khai thác; lịch sử vận hành vẫn được giữ.` });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Mã trạm không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể ngừng khai thác trạm.' }, { status: 400 });
  }
}
