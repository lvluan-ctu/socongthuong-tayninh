import { count, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  energyGenerationOperationalSnapshots,
  energyGenerationProjects,
  energyGenerationUnits,
} from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const schema = z.object({
  projectAssetId: z.string().uuid(),
  unitId: z.string().uuid().nullable().optional(),
  measuredAt: z.string().min(1),
  activePowerMw: z.number().nonnegative().nullable().optional(),
  energyMwh: z.number().nonnegative().nullable().optional(),
  availableCapacityMw: z.number().nonnegative().nullable().optional(),
  availabilityPct: z.number().min(0).max(100).nullable().optional(),
  efficiencyPct: z.number().min(0).max(100).nullable().optional(),
  operationStatus: z.string().trim().max(100).nullable().optional(),
  quality: z.enum(['GOOD', 'ESTIMATED', 'MISSING', 'INVALID']).default('GOOD'),
  notes: z.string().max(2000).nullable().optional(),
  resourceMetrics: z.record(z.string(), z.unknown()).optional().default({}),
}).superRefine((value, context) => {
  if ([value.activePowerMw, value.energyMwh, value.availableCapacityMw, value.availabilityPct, value.efficiencyPct].every((item) => item == null)) context.addIssue({ code: 'custom', path: ['activePowerMw'], message: 'Nhập ít nhất một chỉ số vận hành.' });
});

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const projectAssetId = params.get('projectAssetId');
    if (!projectAssetId) return NextResponse.json({ message: 'Thiếu projectAssetId.' }, { status: 400 });
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);

    const listQuery = db
      .select({
        id: energyGenerationOperationalSnapshots.id,
        projectAssetId: energyGenerationOperationalSnapshots.projectAssetId,
        unitId: energyGenerationOperationalSnapshots.unitId,
        unitCode: energyGenerationUnits.code,
        unitName: energyGenerationUnits.name,
        measuredAt: energyGenerationOperationalSnapshots.measuredAt,
        activePowerMw: energyGenerationOperationalSnapshots.activePowerMw,
        energyMwh: energyGenerationOperationalSnapshots.energyMwh,
        availableCapacityMw: energyGenerationOperationalSnapshots.availableCapacityMw,
        availabilityPct: energyGenerationOperationalSnapshots.availabilityPct,
        efficiencyPct: energyGenerationOperationalSnapshots.efficiencyPct,
        operationStatus: energyGenerationOperationalSnapshots.operationStatus,
        quality: energyGenerationOperationalSnapshots.quality,
        resourceMetrics: energyGenerationOperationalSnapshots.resourceMetrics,
        notes: energyGenerationOperationalSnapshots.notes,
      })
      .from(energyGenerationOperationalSnapshots)
      .leftJoin(energyGenerationUnits, eq(energyGenerationUnits.id, energyGenerationOperationalSnapshots.unitId))
      .where(eq(energyGenerationOperationalSnapshots.projectAssetId, projectAssetId))
      .orderBy(desc(energyGenerationOperationalSnapshots.measuredAt));
    const rows = wantsPagination
      ? await listQuery.limit(pagination.pageSize).offset(pagination.offset)
      : await listQuery.limit(500);
    const [totalRows, summaryRows] = wantsPagination
      ? await Promise.all([
        db.select({ value: count() }).from(energyGenerationOperationalSnapshots).where(eq(energyGenerationOperationalSnapshots.projectAssetId, projectAssetId)),
        db.select({ latestPower: sql<number | null>`MAX(${energyGenerationOperationalSnapshots.activePowerMw})` }).from(energyGenerationOperationalSnapshots).where(eq(energyGenerationOperationalSnapshots.projectAssetId, projectAssetId)),
      ])
      : [[], []];

    const items = rows.map((row) => ({
        ...row,
        activePowerMw: row.activePowerMw == null ? null : Number(row.activePowerMw),
        energyMwh: row.energyMwh == null ? null : Number(row.energyMwh),
        availableCapacityMw: row.availableCapacityMw == null ? null : Number(row.availableCapacityMw),
        availabilityPct: row.availabilityPct == null ? null : Number(row.availabilityPct),
        efficiencyPct: row.efficiencyPct == null ? null : Number(row.efficiencyPct),
      }));
    const summary = summaryRows[0] ? { latestPower: summaryRows[0].latestPower == null ? null : Number(summaryRows[0].latestPower) } : undefined;
    return wantsPagination
      ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0), { summary })
      : NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải lịch sử vận hành.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const [project] = await db.select({ id: energyGenerationProjects.assetId }).from(energyGenerationProjects).where(eq(energyGenerationProjects.assetId, payload.projectAssetId)).limit(1);
    if (!project) return NextResponse.json({ message: 'Không tìm thấy dự án nguồn.' }, { status: 404 });

    if (payload.unitId) {
      const [unit] = await db.select({ id: energyGenerationUnits.id }).from(energyGenerationUnits).where(eq(energyGenerationUnits.id, payload.unitId)).limit(1);
      if (!unit) return NextResponse.json({ message: 'Không tìm thấy tổ máy.' }, { status: 404 });
    }

    const measuredAt = new Date(payload.measuredAt);
    if (Number.isNaN(measuredAt.getTime())) return NextResponse.json({ message: 'Thời điểm ghi nhận không hợp lệ.' }, { status: 400 });

    const [created] = await db.insert(energyGenerationOperationalSnapshots).values({
      projectAssetId: payload.projectAssetId,
      unitId: payload.unitId ?? null,
      measuredAt,
      activePowerMw: payload.activePowerMw == null ? null : String(payload.activePowerMw),
      energyMwh: payload.energyMwh == null ? null : String(payload.energyMwh),
      availableCapacityMw: payload.availableCapacityMw == null ? null : String(payload.availableCapacityMw),
      availabilityPct: payload.availabilityPct == null ? null : String(payload.availabilityPct),
      efficiencyPct: payload.efficiencyPct == null ? null : String(payload.efficiencyPct),
      operationStatus: payload.operationStatus ?? null,
      quality: payload.quality,
      resourceMetrics: payload.resourceMetrics,
      notes: payload.notes ?? null,
    }).returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Dữ liệu vận hành không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể ghi nhận vận hành.' }, { status: 400 });
  }
}
