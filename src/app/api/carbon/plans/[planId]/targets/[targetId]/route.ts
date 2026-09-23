import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyReductionPlanTargets } from '@/db/schema';
import { reductionTargetPatchSchema, reductionTargetSchema } from '@/lib/carbon-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ planId: string; targetId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { planId, targetId } = await context.params; const payload = reductionTargetPatchSchema.parse(await request.json());
    const [current] = await db.select().from(energyReductionPlanTargets).where(eq(energyReductionPlanTargets.id, targetId)).limit(1);
    if (!current || current.planId !== planId) return NextResponse.json({ message: 'Không tìm thấy mục tiêu của kế hoạch.' }, { status: 404 });
    const merged = reductionTargetSchema.parse({ year: payload.year ?? Number(current.year), targetCo2eKg: payload.targetCo2eKg ?? Number(current.targetCo2eKg), targetReductionPct: payload.targetReductionPct ?? Number(current.targetReductionPct), status: payload.status ?? current.status, notes: payload.notes === undefined ? current.notes : payload.notes });
    const [updated] = await db.update(energyReductionPlanTargets).set({ year: merged.year, targetCo2eKg: String(merged.targetCo2eKg), targetReductionPct: String(merged.targetReductionPct), status: merged.status, notes: merged.notes ?? null, updatedAt: new Date() }).where(eq(energyReductionPlanTargets.id, targetId)).returning();
    return NextResponse.json({ item: { ...updated, targetCo2eKg: Number(updated.targetCo2eKg), targetReductionPct: Number(updated.targetReductionPct) } });
  } catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ message: 'Mục tiêu không hợp lệ.', issues: error.issues }, { status: 400 }); return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật mục tiêu.' }, { status: 400 }); }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { planId, targetId } = await context.params;
  const [updated] = await db.update(energyReductionPlanTargets).set({ status: 'RETIRED', updatedAt: new Date() }).where(and(eq(energyReductionPlanTargets.id, targetId), eq(energyReductionPlanTargets.planId, planId))).returning({ id: energyReductionPlanTargets.id, planId: energyReductionPlanTargets.planId, status: energyReductionPlanTargets.status });
  if (!updated) return NextResponse.json({ message: 'Không tìm thấy mục tiêu của kế hoạch.' }, { status: 404 });
  return NextResponse.json({ item: updated, archived: true });
}
