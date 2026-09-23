import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyFuelInventorySnapshots, energyFuelStorages, energyGenerationProjects } from '@/db/schema';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const schema = z.object({
  storageId: z.string().uuid(),
  measuredAt: z.string().min(1),
  quantity: z.number().nonnegative(),
  dailyInboundAvg: z.number().nonnegative().nullable().optional(),
  dailyConsumptionAvg: z.number().nonnegative().nullable().optional(),
  sustainableCapacityPct: z.number().min(0).max(100).nullable().optional(),
  maxSustainableCapacityMw: z.number().nonnegative().nullable().optional(),
  energyEquivalentMwh: z.number().nonnegative().nullable().optional(),
  capacityMethod: z.string().trim().max(200).nullable().optional(),
  sourceRef: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

function parseDate(value: string) {
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date;
  const local = new Date(`${value}T00:00:00+07:00`);
  return Number.isNaN(local.getTime()) ? null : local;
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const measuredAt = parseDate(payload.measuredAt);
    if (!measuredAt) return NextResponse.json({ message: 'Thời điểm ghi nhận không hợp lệ.' }, { status: 400 });

    const [storage] = await db.select().from(energyFuelStorages).where(eq(energyFuelStorages.id, payload.storageId)).limit(1);
    if (!storage) return NextResponse.json({ message: 'Không tìm thấy kho nhiên liệu.' }, { status: 404 });

    const [project] = await db.select({ designedCapacityMw: energyGenerationProjects.designedCapacityMw })
      .from(energyGenerationProjects)
      .where(eq(energyGenerationProjects.assetId, storage.projectAssetId))
      .limit(1);

    const inbound = payload.dailyInboundAvg ?? 0;
    const consumption = payload.dailyConsumptionAvg ?? 0;
    const minimumReserve = Number(storage.minimumReserve ?? 0);
    const usableQuantity = Math.max(0, payload.quantity - minimumReserve);
    const netBurnRate = Math.max(0, consumption - inbound);
    const runwayDays = netBurnRate > 0 ? usableQuantity / netBurnRate : null;

    const designedCapacityMw = project ? Number(project.designedCapacityMw) : null;
    const maxSustainableCapacityMw = payload.maxSustainableCapacityMw
      ?? (payload.sustainableCapacityPct != null && designedCapacityMw != null
        ? designedCapacityMw * payload.sustainableCapacityPct / 100
        : null);

    let status = 'NORMAL';
    if (payload.quantity <= minimumReserve) status = 'CRITICAL';
    else if (runwayDays != null && runwayDays < 7) status = 'CRITICAL';
    else if (runwayDays != null && runwayDays < 14) status = 'WARNING';
    else if (runwayDays != null && runwayDays < 30) status = 'WATCH';

    const [created] = await db.insert(energyFuelInventorySnapshots).values({
      storageId: payload.storageId,
      measuredAt,
      quantity: String(payload.quantity),
      usableQuantity: String(usableQuantity),
      dailyInboundAvg: payload.dailyInboundAvg == null ? null : String(payload.dailyInboundAvg),
      dailyConsumptionAvg: payload.dailyConsumptionAvg == null ? null : String(payload.dailyConsumptionAvg),
      netBurnRate: String(netBurnRate),
      runwayDays: runwayDays == null ? null : String(Math.round(runwayDays * 100) / 100),
      sustainableCapacityPct: payload.sustainableCapacityPct == null ? null : String(payload.sustainableCapacityPct),
      maxSustainableCapacityMw: maxSustainableCapacityMw == null ? null : String(maxSustainableCapacityMw),
      energyEquivalentMwh: payload.energyEquivalentMwh == null ? null : String(payload.energyEquivalentMwh),
      status,
      calculationMethod: 'USABLE_STOCK_DIV_NET_BURN',
      calculationVersion: '2.0',
      capacityMethod: payload.capacityMethod ?? (payload.sustainableCapacityPct != null ? 'OPERATOR_REPORTED_PERCENT_OF_DESIGNED_CAPACITY' : null),
      sourceRef: payload.sourceRef ?? null,
      notes: payload.notes ?? null,
    }).returning();

    return NextResponse.json({
      snapshot: created,
      calculation: {
        minimumReserve,
        usableQuantity,
        netBurnRate,
        runwayDays,
        maxSustainableCapacityMw,
        status,
        formula: 'runway = max(0, quantity - minimumReserve) / max(0, dailyConsumptionAvg - dailyInboundAvg)',
        capacityRule: 'MW duy trì chỉ lấy giá trị được cung cấp/xác nhận hoặc quy đổi từ % công suất do đơn vị cung cấp; không suy diễn từ runway.',
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Dữ liệu tồn kho không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể ghi nhận tồn kho.' }, { status: 400 });
  }
}
