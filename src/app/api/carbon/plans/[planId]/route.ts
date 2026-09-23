import { desc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyParties, energyReductionActionProgress, energyReductionActions, energyReductionPlanTargets, energyReductionPlans, energyReductionProgress } from '@/db/schema';
import { reductionPlanPatchSchema } from '@/lib/carbon-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ planId: string }> };

async function readPlan(planId: string) {
  const [plan] = await db.select({ id: energyReductionPlans.id, partyId: energyReductionPlans.partyId, partyName: energyParties.name, code: energyReductionPlans.code, name: energyReductionPlans.name, baselineYear: energyReductionPlans.baselineYear, targetYear: energyReductionPlans.targetYear, baselineCo2eKg: energyReductionPlans.baselineCo2eKg, targetReductionPct: energyReductionPlans.targetReductionPct, status: energyReductionPlans.status, metadata: energyReductionPlans.metadata }).from(energyReductionPlans).innerJoin(energyParties, eq(energyParties.id, energyReductionPlans.partyId)).where(eq(energyReductionPlans.id, planId)).limit(1);
  if (!plan) return null;
  const [targets, actions, progress] = await Promise.all([
    db.select().from(energyReductionPlanTargets).where(eq(energyReductionPlanTargets.planId, planId)).orderBy(desc(energyReductionPlanTargets.year)),
    db.select().from(energyReductionActions).where(eq(energyReductionActions.planId, planId)).orderBy(desc(energyReductionActions.targetAt)),
    db.select().from(energyReductionProgress).where(eq(energyReductionProgress.planId, planId)).orderBy(desc(energyReductionProgress.period)),
  ]);
  const actionIds = actions.map((action) => action.id);
  const actionProgress = actionIds.length ? await db.select().from(energyReductionActionProgress).where(inArray(energyReductionActionProgress.actionId, actionIds)) : [];
  const progressByAction = new Map<string, typeof actionProgress>();
  for (const item of actionProgress) { const list = progressByAction.get(item.actionId) ?? []; list.push(item); progressByAction.set(item.actionId, list); }
  return {
    ...plan, baselineYear: Number(plan.baselineYear), targetYear: Number(plan.targetYear), baselineCo2eKg: Number(plan.baselineCo2eKg), targetReductionPct: Number(plan.targetReductionPct),
    targets: targets.map((target) => ({ ...target, year: Number(target.year), targetCo2eKg: Number(target.targetCo2eKg), targetReductionPct: Number(target.targetReductionPct) })),
    actions: actions.map((action) => ({ ...action, budget: action.budget == null ? null : Number(action.budget), expectedReductionTco2eYear: action.expectedReductionTco2eYear == null ? null : Number(action.expectedReductionTco2eYear), actualReductionTco2eYear: action.actualReductionTco2eYear == null ? null : Number(action.actualReductionTco2eYear), progress: progressByAction.get(action.id) ?? [] })),
    progress: progress.map((item) => ({ ...item, actualCo2eKg: Number(item.actualCo2eKg), reductionPct: item.reductionPct == null ? null : Number(item.reductionPct) })),
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const { planId } = await context.params; const item = await readPlan(planId);
  return item ? NextResponse.json({ item }) : NextResponse.json({ message: 'Không tìm thấy kế hoạch giảm phát thải.' }, { status: 404 });
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { planId } = await context.params; const payload = reductionPlanPatchSchema.parse(await request.json());
    const [current] = await db.select().from(energyReductionPlans).where(eq(energyReductionPlans.id, planId)).limit(1);
    if (!current) return NextResponse.json({ message: 'Không tìm thấy kế hoạch giảm phát thải.' }, { status: 404 });
    const baselineYear = payload.baselineYear ?? Number(current.baselineYear); const targetYear = payload.targetYear ?? Number(current.targetYear);
    if (targetYear < baselineYear) return NextResponse.json({ message: 'Năm mục tiêu phải lớn hơn hoặc bằng năm cơ sở.' }, { status: 400 });
    if (Object.keys(payload).length === 0) return NextResponse.json({ message: 'Không có trường nào được cập nhật.' }, { status: 400 });
    const [updated] = await db.update(energyReductionPlans).set({ ...(payload.name === undefined ? {} : { name: payload.name }), ...(payload.baselineYear === undefined ? {} : { baselineYear: String(payload.baselineYear) }), ...(payload.targetYear === undefined ? {} : { targetYear: String(payload.targetYear) }), ...(payload.baselineCo2eKg === undefined ? {} : { baselineCo2eKg: String(payload.baselineCo2eKg) }), ...(payload.targetReductionPct === undefined ? {} : { targetReductionPct: String(payload.targetReductionPct) }), ...(payload.status === undefined ? {} : { status: payload.status }), ...(payload.metadata === undefined ? {} : { metadata: payload.metadata }) }).where(eq(energyReductionPlans.id, planId)).returning();
    return NextResponse.json({ item: updated });
  } catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin kế hoạch không hợp lệ.', issues: error.issues }, { status: 400 }); return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật kế hoạch.' }, { status: 400 }); }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { planId } = await context.params;
  const [updated] = await db.update(energyReductionPlans).set({ status: 'CANCELLED' }).where(eq(energyReductionPlans.id, planId)).returning({ id: energyReductionPlans.id, status: energyReductionPlans.status });
  return updated ? NextResponse.json({ item: updated, archived: true }) : NextResponse.json({ message: 'Không tìm thấy kế hoạch giảm phát thải.' }, { status: 404 });
}
