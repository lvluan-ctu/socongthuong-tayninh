import { count, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyAssets, energyFuelStorages, energyGenerationProjects } from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const schema = z.object({
  projectAssetId: z.string().uuid(),
  code: z.string().trim().min(2).max(100),
  name: z.string().trim().max(250).nullable().optional(),
  fuelType: z.string().trim().min(2).max(80),
  capacity: z.number().positive(),
  unit: z.string().trim().min(1).max(30),
  minimumReserve: z.number().nonnegative().nullable().optional(),
  locationDescription: z.string().trim().max(500).nullable().optional(),
});

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const projectAssetId = params.get('projectAssetId');
  const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
  const pagination = parsePagination(params);
  const where = projectAssetId ? eq(energyFuelStorages.projectAssetId, projectAssetId) : undefined;
  const base = db
    .select({
      id: energyFuelStorages.id,
      code: energyFuelStorages.code,
      name: energyFuelStorages.name,
      fuelType: energyFuelStorages.fuelType,
      capacity: energyFuelStorages.capacity,
      unit: energyFuelStorages.unit,
      minimumReserve: energyFuelStorages.minimumReserve,
      locationDescription: energyFuelStorages.locationDescription,
      projectAssetId: energyFuelStorages.projectAssetId,
      projectCode: energyAssets.code,
      projectName: energyAssets.name,
      snapshotMeasuredAt: sql<Date | null>`(SELECT s.measured_at FROM energy_fuel_inventory_snapshots s WHERE s.storage_id = ${energyFuelStorages.id} ORDER BY s.measured_at DESC LIMIT 1)`,
      snapshotQuantity: sql<string | null>`(SELECT s.quantity FROM energy_fuel_inventory_snapshots s WHERE s.storage_id = ${energyFuelStorages.id} ORDER BY s.measured_at DESC LIMIT 1)`,
      snapshotDailyInboundAvg: sql<string | null>`(SELECT s.daily_inbound_avg FROM energy_fuel_inventory_snapshots s WHERE s.storage_id = ${energyFuelStorages.id} ORDER BY s.measured_at DESC LIMIT 1)`,
      snapshotDailyConsumptionAvg: sql<string | null>`(SELECT s.daily_consumption_avg FROM energy_fuel_inventory_snapshots s WHERE s.storage_id = ${energyFuelStorages.id} ORDER BY s.measured_at DESC LIMIT 1)`,
      snapshotNetBurnRate: sql<string | null>`(SELECT s.net_burn_rate FROM energy_fuel_inventory_snapshots s WHERE s.storage_id = ${energyFuelStorages.id} ORDER BY s.measured_at DESC LIMIT 1)`,
      snapshotRunwayDays: sql<string | null>`(SELECT s.runway_days FROM energy_fuel_inventory_snapshots s WHERE s.storage_id = ${energyFuelStorages.id} ORDER BY s.measured_at DESC LIMIT 1)`,
      snapshotSustainableCapacityPct: sql<string | null>`(SELECT s.sustainable_capacity_pct FROM energy_fuel_inventory_snapshots s WHERE s.storage_id = ${energyFuelStorages.id} ORDER BY s.measured_at DESC LIMIT 1)`,
      snapshotMaxSustainableCapacityMw: sql<string | null>`(SELECT s.max_sustainable_capacity_mw FROM energy_fuel_inventory_snapshots s WHERE s.storage_id = ${energyFuelStorages.id} ORDER BY s.measured_at DESC LIMIT 1)`,
      snapshotStatus: sql<string | null>`(SELECT s.status FROM energy_fuel_inventory_snapshots s WHERE s.storage_id = ${energyFuelStorages.id} ORDER BY s.measured_at DESC LIMIT 1)`,
    })
    .from(energyFuelStorages)
    .innerJoin(energyGenerationProjects, eq(energyGenerationProjects.assetId, energyFuelStorages.projectAssetId))
    .innerJoin(energyAssets, eq(energyAssets.id, energyGenerationProjects.assetId));

  const listQuery = base.where(where).orderBy(energyAssets.name, energyFuelStorages.code);
  const rows = wantsPagination
    ? await listQuery.limit(pagination.pageSize).offset(pagination.offset)
    : await listQuery.limit(1000);
  const totalRows = wantsPagination
    ? await db.select({ value: count() }).from(energyFuelStorages).where(where)
    : [];
  const summaryRows = wantsPagination
    ? await db.select({
      monitored: sql<number>`COUNT(*) FILTER (WHERE (SELECT s.id FROM energy_fuel_inventory_snapshots s WHERE s.storage_id = ${energyFuelStorages.id} ORDER BY s.measured_at DESC LIMIT 1) IS NOT NULL)`,
      critical: sql<number>`COUNT(*) FILTER (WHERE (SELECT s.status FROM energy_fuel_inventory_snapshots s WHERE s.storage_id = ${energyFuelStorages.id} ORDER BY s.measured_at DESC LIMIT 1) IN ('CRITICAL', 'WARNING'))`,
    }).from(energyFuelStorages).where(where)
    : [];

  const items = rows.map((row) => ({
      ...row,
      capacity: Number(row.capacity),
      minimumReserve: row.minimumReserve == null ? null : Number(row.minimumReserve),
      snapshot: row.snapshotMeasuredAt == null ? null : {
        measuredAt: row.snapshotMeasuredAt,
        quantity: row.snapshotQuantity == null ? null : Number(row.snapshotQuantity),
        dailyInboundAvg: row.snapshotDailyInboundAvg == null ? null : Number(row.snapshotDailyInboundAvg),
        dailyConsumptionAvg: row.snapshotDailyConsumptionAvg == null ? null : Number(row.snapshotDailyConsumptionAvg),
        netBurnRate: row.snapshotNetBurnRate == null ? null : Number(row.snapshotNetBurnRate),
        runwayDays: row.snapshotRunwayDays == null ? null : Number(row.snapshotRunwayDays),
        sustainableCapacityPct: row.snapshotSustainableCapacityPct == null ? null : Number(row.snapshotSustainableCapacityPct),
        maxSustainableCapacityMw: row.snapshotMaxSustainableCapacityMw == null ? null : Number(row.snapshotMaxSustainableCapacityMw),
        status: row.snapshotStatus,
      },
    }));
  const summary = summaryRows[0]
    ? { monitored: Number(summaryRows[0].monitored ?? 0), critical: Number(summaryRows[0].critical ?? 0) }
    : undefined;
  return wantsPagination
    ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0), { summary })
    : NextResponse.json({ items });
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const [project] = await db.select({ id: energyGenerationProjects.assetId }).from(energyGenerationProjects).where(eq(energyGenerationProjects.assetId, payload.projectAssetId)).limit(1);
    if (!project) return NextResponse.json({ message: 'Không tìm thấy dự án nguồn.' }, { status: 404 });

    const [created] = await db.insert(energyFuelStorages).values({
      projectAssetId: payload.projectAssetId,
      code: payload.code,
      name: payload.name ?? null,
      fuelType: payload.fuelType,
      capacity: String(payload.capacity),
      unit: payload.unit,
      minimumReserve: payload.minimumReserve == null ? null : String(payload.minimumReserve),
      locationDescription: payload.locationDescription ?? null,
      metadata: { source: 'MANUAL' },
    }).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Dữ liệu kho nhiên liệu không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tạo kho nhiên liệu.' }, { status: 400 });
  }
}
