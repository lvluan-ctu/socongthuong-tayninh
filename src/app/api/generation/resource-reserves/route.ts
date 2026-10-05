import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyGenerationProjects, energyGenerationResourceReserves } from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  projectAssetId: z.string().uuid(),
  resourceType: z.enum(['BIOMASS', 'LNG', 'WASTE', 'HYDRO_RESERVOIR', 'WATER', 'BATTERY', 'OTHER']),
  resourceName: z.string().trim().min(2).max(250),
  measuredAt: z.string().min(1),
  quantity: z.number().nonnegative(),
  usableQuantity: z.number().nonnegative().nullable().optional(),
  unit: z.string().trim().min(1).max(30),
  dailyInboundAvg: z.number().nonnegative().nullable().optional(),
  dailyConsumptionAvg: z.number().nonnegative().nullable().optional(),
  energyEquivalentMwh: z.number().nonnegative().nullable().optional(),
  maxSustainableCapacityMw: z.number().nonnegative().nullable().optional(),
  sustainableCapacityPct: z.number().min(0).max(100).nullable().optional(),
  calculationMethod: z.string().trim().max(200).nullable().optional(),
  sourceType: z.enum(['OPERATOR_REPORTED', 'DOCUMENT', 'EVN', 'SCADA', 'MANUAL_CALC']).default('OPERATOR_REPORTED'),
  sourceRef: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const projectAssetId = params.get('projectAssetId');
    if (projectAssetId && !z.string().uuid().safeParse(projectAssetId).success) {
      return NextResponse.json({ message: 'Mã dự án không hợp lệ.' }, { status: 400 });
    }
    const projectFilter = projectAssetId ? sql`WHERE r.project_asset_id = ${projectAssetId}::uuid` : sql``;
    const latestCte = sql`
      WITH latest AS (
        SELECT DISTINCT ON (r.project_asset_id, r.resource_type, r.resource_name)
          r.id,
          r.project_asset_id AS "projectAssetId",
          a.name AS "projectName",
          gp.source_type AS "projectSourceType",
          r.resource_type AS "resourceType",
          r.resource_name AS "resourceName",
          r.measured_at AS "measuredAt",
          r.quantity,
          r.usable_quantity AS "usableQuantity",
          r.unit,
          r.daily_inbound_avg AS "dailyInboundAvg",
          r.daily_consumption_avg AS "dailyConsumptionAvg",
          r.runway_days AS "runwayDays",
          r.energy_equivalent_mwh AS "energyEquivalentMwh",
          r.max_sustainable_capacity_mw AS "maxSustainableCapacityMw",
          r.sustainable_capacity_pct AS "sustainableCapacityPct",
          r.status,
          r.source_type AS "sourceType",
          r.source_ref AS "sourceRef"
        FROM energy_generation_resource_reserves r
        INNER JOIN energy_generation_projects gp ON gp.asset_id = r.project_asset_id
        INNER JOIN energy_assets a ON a.id = gp.asset_id
        ${projectFilter}
        ORDER BY r.project_asset_id, r.resource_type, r.resource_name, r.measured_at DESC, r.id DESC
      )
    `;
    const result = await db.execute(sql`${latestCte}
      SELECT * FROM latest
      ORDER BY "measuredAt" DESC, id DESC
      LIMIT ${wantsPagination ? pagination.pageSize : 1000}
      OFFSET ${wantsPagination ? pagination.offset : 0}
    `);
    const totalResult = wantsPagination
      ? await db.execute(sql`${latestCte} SELECT COUNT(*)::int AS "value" FROM latest`)
      : { rows: [] };
    const summaryResult = wantsPagination
      ? await db.execute(sql`${latestCte}
        SELECT
          COUNT(*) FILTER (WHERE status IN ('CRITICAL', 'WARNING'))::int AS "warnings",
          COALESCE(SUM("energyEquivalentMwh"), 0)::double precision AS "totalEnergyMwh",
          COALESCE(SUM("maxSustainableCapacityMw"), 0)::double precision AS "totalSustainableMw"
        FROM latest`)
      : { rows: [] };
    const items = (result.rows as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      projectAssetId: String(row.projectAssetId),
      projectName: String(row.projectName ?? ''),
      projectSourceType: String(row.projectSourceType ?? ''),
      resourceType: String(row.resourceType ?? ''),
      resourceName: String(row.resourceName ?? ''),
      measuredAt: row.measuredAt,
      quantity: row.quantity == null ? null : Number(row.quantity),
      usableQuantity: row.usableQuantity == null ? null : Number(row.usableQuantity),
      unit: String(row.unit ?? ''),
      dailyInboundAvg: row.dailyInboundAvg == null ? null : Number(row.dailyInboundAvg),
      dailyConsumptionAvg: row.dailyConsumptionAvg == null ? null : Number(row.dailyConsumptionAvg),
      runwayDays: row.runwayDays == null ? null : Number(row.runwayDays),
      energyEquivalentMwh: row.energyEquivalentMwh == null ? null : Number(row.energyEquivalentMwh),
      maxSustainableCapacityMw: row.maxSustainableCapacityMw == null ? null : Number(row.maxSustainableCapacityMw),
      sustainableCapacityPct: row.sustainableCapacityPct == null ? null : Number(row.sustainableCapacityPct),
      status: String(row.status ?? ''),
      sourceType: String(row.sourceType ?? ''),
      sourceRef: row.sourceRef == null ? null : String(row.sourceRef),
    }));
    const summaryRow = summaryResult.rows[0] as Record<string, unknown> | undefined;
    const summary = summaryRow ? {
      warnings: Number(summaryRow.warnings ?? 0),
      totalEnergyMwh: Number(summaryRow.totalEnergyMwh ?? 0),
      totalSustainableMw: Number(summaryRow.totalSustainableMw ?? 0),
    } : undefined;
    return wantsPagination
      ? paginatedResponse(items, pagination, Number((totalResult.rows[0] as Record<string, unknown> | undefined)?.value ?? 0), { summary })
      : NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải dữ liệu dự trữ.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = createSchema.parse(await request.json());
    const measuredAt = new Date(input.measuredAt);
    if (Number.isNaN(measuredAt.getTime())) return NextResponse.json({ message: 'Thời điểm ghi nhận không hợp lệ.' }, { status: 400 });

    const [project] = await db.select({ capacityMw: energyGenerationProjects.designedCapacityMw })
      .from(energyGenerationProjects).where(eq(energyGenerationProjects.assetId, input.projectAssetId)).limit(1);
    if (!project) return NextResponse.json({ message: 'Không tìm thấy dự án nguồn.' }, { status: 404 });

    const usable = input.usableQuantity ?? input.quantity;
    const netBurn = Math.max(0, (input.dailyConsumptionAvg ?? 0) - (input.dailyInboundAvg ?? 0));
    const runwayDays = netBurn > 0 ? usable / netBurn : null;
    const maxMw = input.maxSustainableCapacityMw
      ?? (input.sustainableCapacityPct != null ? Number(project.capacityMw) * input.sustainableCapacityPct / 100 : null);
    let status = 'NORMAL';
    if (runwayDays != null && runwayDays < 7) status = 'CRITICAL';
    else if (runwayDays != null && runwayDays < 14) status = 'WARNING';
    else if (runwayDays != null && runwayDays < 30) status = 'WATCH';

    const [created] = await db.insert(energyGenerationResourceReserves).values({
      projectAssetId: input.projectAssetId,
      resourceType: input.resourceType,
      resourceName: input.resourceName,
      measuredAt,
      quantity: String(input.quantity),
      usableQuantity: String(usable),
      unit: input.unit,
      dailyInboundAvg: input.dailyInboundAvg == null ? null : String(input.dailyInboundAvg),
      dailyConsumptionAvg: input.dailyConsumptionAvg == null ? null : String(input.dailyConsumptionAvg),
      runwayDays: runwayDays == null ? null : String(Math.round(runwayDays * 100) / 100),
      energyEquivalentMwh: input.energyEquivalentMwh == null ? null : String(input.energyEquivalentMwh),
      maxSustainableCapacityMw: maxMw == null ? null : String(maxMw),
      sustainableCapacityPct: input.sustainableCapacityPct == null ? null : String(input.sustainableCapacityPct),
      status,
      calculationMethod: input.calculationMethod ?? (netBurn > 0 ? 'USABLE_RESOURCE_DIV_NET_CONSUMPTION' : null),
      calculationVersion: '1.0',
      sourceType: input.sourceType,
      sourceRef: input.sourceRef ?? null,
      notes: input.notes ?? null,
    }).returning();

    return NextResponse.json({ item: created, calculation: { usableQuantity: usable, netBurnRate: netBurn, runwayDays, maxSustainableCapacityMw: maxMw, status } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Dữ liệu dự trữ không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu dữ liệu dự trữ.' }, { status: 400 });
  }
}
