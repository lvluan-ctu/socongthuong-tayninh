import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  energyAssets,
  energyFeeders,
  energyGridOperatingSnapshots,
  energyPowerLines,
  energySubstations,
} from '@/db/schema';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ assetId: string }> };

const schema = z.object({
  currentLoad: z.number().nonnegative(),
  measuredAt: z.string().optional(),
  source: z.string().trim().min(2).max(80).default('MANUAL'),
  sourceRef: z.string().trim().max(500).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
});

function statusOf(loadFactorPct: number) {
  if (loadFactorPct >= 100) return 'OVERLOAD';
  if (loadFactorPct >= 90) return 'CRITICAL';
  if (loadFactorPct >= 80) return 'WARNING';
  return 'NORMAL';
}

function numberOf(value: string | null | undefined) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { assetId } = await context.params;
    const payload = schema.parse(await request.json());
    const measuredAt = payload.measuredAt ? new Date(payload.measuredAt) : new Date();
    if (Number.isNaN(measuredAt.getTime())) {
      return NextResponse.json({ message: 'Thời điểm ghi nhận không hợp lệ.' }, { status: 400 });
    }

    const [asset] = await db.select().from(energyAssets).where(eq(energyAssets.id, assetId)).limit(1);
    if (!asset) return NextResponse.json({ message: 'Không tìm thấy tài sản lưới điện.' }, { status: 404 });

    if (asset.assetType === 'SUBSTATION') {
      const [row] = await db.select().from(energySubstations).where(eq(energySubstations.assetId, assetId)).limit(1);
      if (!row) return NextResponse.json({ message: 'Không tìm thấy dữ liệu chuyên ngành của TBA.' }, { status: 404 });
      const capacity = numberOf(row.installedCapacityMva) ?? numberOf(row.designedCapacityMva);
      if (capacity == null || capacity <= 0) return NextResponse.json({ message: 'TBA chưa có công suất định mức để tính tải.' }, { status: 422 });
      const loadFactorPct = payload.currentLoad / capacity * 100;
      const available = Math.max(0, capacity - payload.currentLoad);
      const overloadStatus = statusOf(loadFactorPct);
      await db.transaction(async (tx) => {
        await tx.update(energySubstations).set({
          currentLoadMva: String(payload.currentLoad),
          loadFactorPct: String(loadFactorPct),
          availableCapacityMva: String(available),
          overloadStatus,
        }).where(eq(energySubstations.assetId, assetId));
        await tx.insert(energyGridOperatingSnapshots).values({
          assetId,
          measuredAt,
          currentLoadMva: String(payload.currentLoad),
          ratedCapacityMva: String(capacity),
          loadFactorPct: String(loadFactorPct),
          availableCapacityMva: String(available),
          overloadStatus,
          source: payload.source,
          sourceRef: payload.sourceRef ?? null,
          metadata: { note: payload.note ?? null, assetType: asset.assetType },
        });
      });
      return NextResponse.json({ assetId, assetType: asset.assetType, currentLoad: payload.currentLoad, unit: 'MVA', capacity, loadFactorPct, available, overloadStatus });
    }

    if (asset.assetType === 'FEEDER') {
      const [row] = await db.select().from(energyFeeders).where(eq(energyFeeders.assetId, assetId)).limit(1);
      if (!row) return NextResponse.json({ message: 'Không tìm thấy dữ liệu phát tuyến.' }, { status: 404 });
      const capacity = numberOf(row.ratedCapacityMw);
      if (capacity == null || capacity <= 0) return NextResponse.json({ message: 'Phát tuyến chưa có công suất định mức để tính tải.' }, { status: 422 });
      const loadFactorPct = payload.currentLoad / capacity * 100;
      const available = Math.max(0, capacity - payload.currentLoad);
      const overloadStatus = statusOf(loadFactorPct);
      await db.transaction(async (tx) => {
        await tx.update(energyFeeders).set({ currentLoadMw: String(payload.currentLoad), headroomMw: String(available) }).where(eq(energyFeeders.assetId, assetId));
        await tx.insert(energyGridOperatingSnapshots).values({
          assetId,
          measuredAt,
          currentLoadMw: String(payload.currentLoad),
          ratedCapacityMw: String(capacity),
          loadFactorPct: String(loadFactorPct),
          availableCapacityMw: String(available),
          overloadStatus,
          source: payload.source,
          sourceRef: payload.sourceRef ?? null,
          metadata: { note: payload.note ?? null, assetType: asset.assetType },
        });
      });
      return NextResponse.json({ assetId, assetType: asset.assetType, currentLoad: payload.currentLoad, unit: 'MW', capacity, loadFactorPct, available, overloadStatus });
    }

    if (asset.assetType === 'POWER_LINE') {
      const [row] = await db.select().from(energyPowerLines).where(eq(energyPowerLines.assetId, assetId)).limit(1);
      if (!row) return NextResponse.json({ message: 'Không tìm thấy dữ liệu đường dây.' }, { status: 404 });
      const capacity = numberOf(row.ratedCapacityMw);
      if (capacity == null || capacity <= 0) return NextResponse.json({ message: 'Đường dây chưa có công suất định mức để tính tải.' }, { status: 422 });
      const loadFactorPct = payload.currentLoad / capacity * 100;
      const available = Math.max(0, capacity - payload.currentLoad);
      const overloadStatus = statusOf(loadFactorPct);
      await db.transaction(async (tx) => {
        await tx.update(energyPowerLines).set({ currentLoadMw: String(payload.currentLoad) }).where(eq(energyPowerLines.assetId, assetId));
        await tx.insert(energyGridOperatingSnapshots).values({
          assetId,
          measuredAt,
          currentLoadMw: String(payload.currentLoad),
          ratedCapacityMw: String(capacity),
          loadFactorPct: String(loadFactorPct),
          availableCapacityMw: String(available),
          overloadStatus,
          source: payload.source,
          sourceRef: payload.sourceRef ?? null,
          metadata: { note: payload.note ?? null, assetType: asset.assetType },
        });
      });
      return NextResponse.json({ assetId, assetType: asset.assetType, currentLoad: payload.currentLoad, unit: 'MW', capacity, loadFactorPct, available, overloadStatus });
    }

    return NextResponse.json({ message: `Asset type ${asset.assetType} chưa hỗ trợ cập nhật tải vận hành.` }, { status: 422 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Dữ liệu tải vận hành không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu tải vận hành.' }, { status: 400 });
  }
}
