import { count, desc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyParties, energyReductionPlans, energyReductionProgress } from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const planSchema = z.object({
  partyId: z.string().uuid(),
  code: z.string().trim().min(2).max(100),
  name: z.string().trim().min(2).max(250),
  baselineYear: z.number().int().min(2000).max(2100),
  targetYear: z.number().int().min(2000).max(2100),
  baselineCo2eKg: z.number().nonnegative(),
  targetReductionPct: z.number().min(0).max(100),
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED']).default('ACTIVE'),
});

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const listQuery = db.select({
      id: energyReductionPlans.id,
      partyId: energyReductionPlans.partyId,
      partyName: energyParties.name,
      code: energyReductionPlans.code,
      name: energyReductionPlans.name,
      baselineYear: energyReductionPlans.baselineYear,
      targetYear: energyReductionPlans.targetYear,
      baselineCo2eKg: energyReductionPlans.baselineCo2eKg,
      targetReductionPct: energyReductionPlans.targetReductionPct,
      status: energyReductionPlans.status,
    }).from(energyReductionPlans)
      .innerJoin(energyParties, eq(energyParties.id, energyReductionPlans.partyId))
      .orderBy(desc(energyReductionPlans.targetYear));
    const [plans, totalRows] = await Promise.all([
      wantsPagination ? listQuery.limit(pagination.pageSize).offset(pagination.offset) : listQuery,
      wantsPagination ? db.select({ value: count() }).from(energyReductionPlans) : Promise.resolve([]),
    ]);

    const planIds = plans.map((plan) => plan.id);
    const progressQuery = db.select().from(energyReductionProgress).orderBy(desc(energyReductionProgress.period));
    const progress = planIds.length && wantsPagination
      ? await progressQuery.where(inArray(energyReductionProgress.planId, planIds))
      : await progressQuery;
    const byPlan = new Map<string, typeof progress>();
    for (const row of progress) {
      const list = byPlan.get(row.planId) ?? [];
      list.push(row);
      byPlan.set(row.planId, list);
    }

    const items = plans.map((plan) => ({
        ...plan,
        baselineYear: Number(plan.baselineYear),
        targetYear: Number(plan.targetYear),
        baselineCo2eKg: Number(plan.baselineCo2eKg),
        targetReductionPct: Number(plan.targetReductionPct),
        progress: (byPlan.get(plan.id) ?? []).map((row) => ({
          ...row,
          actualCo2eKg: Number(row.actualCo2eKg),
          reductionPct: row.reductionPct == null ? null : Number(row.reductionPct),
        })),
      }));
    return wantsPagination
      ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0))
      : NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải kế hoạch giảm phát thải.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = planSchema.parse(await request.json());
    if (payload.targetYear < payload.baselineYear) return NextResponse.json({ message: 'Năm mục tiêu phải lớn hơn hoặc bằng năm cơ sở.' }, { status: 400 });
    const [created] = await db.insert(energyReductionPlans).values({
      partyId: payload.partyId,
      code: payload.code,
      name: payload.name,
      baselineYear: String(payload.baselineYear),
      targetYear: String(payload.targetYear),
      baselineCo2eKg: String(payload.baselineCo2eKg),
      targetReductionPct: String(payload.targetReductionPct),
      status: payload.status,
      metadata: { source: 'MANUAL' },
    }).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Kế hoạch giảm phát thải không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu kế hoạch giảm phát thải.' }, { status: 400 });
  }
}
