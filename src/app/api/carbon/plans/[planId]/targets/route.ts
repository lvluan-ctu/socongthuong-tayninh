import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyReductionPlanTargets, energyReductionPlans } from '@/db/schema';
import { reductionTargetSchema } from '@/lib/carbon-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ planId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { planId } = await context.params; const items = await db.select().from(energyReductionPlanTargets).where(eq(energyReductionPlanTargets.planId, planId)).orderBy(desc(energyReductionPlanTargets.year));
  return NextResponse.json({ items: items.map((item) => ({ ...item, year: Number(item.year), targetCo2eKg: Number(item.targetCo2eKg), targetReductionPct: Number(item.targetReductionPct) })) });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { planId } = await context.params; const payload = reductionTargetSchema.parse(await request.json());
    const [plan] = await db.select({ id: energyReductionPlans.id }).from(energyReductionPlans).where(eq(energyReductionPlans.id, planId)).limit(1);
    if (!plan) return NextResponse.json({ message: 'Không tìm thấy kế hoạch giảm phát thải.' }, { status: 404 });
    const [created] = await db.insert(energyReductionPlanTargets).values({ planId, year: payload.year, targetCo2eKg: String(payload.targetCo2eKg), targetReductionPct: String(payload.targetReductionPct), status: payload.status, notes: payload.notes ?? null }).returning();
    return NextResponse.json({ ...created, targetCo2eKg: Number(created.targetCo2eKg), targetReductionPct: Number(created.targetReductionPct) }, { status: 201 });
  } catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ message: 'Mục tiêu giảm phát thải không hợp lệ.', issues: error.issues }, { status: 400 }); const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : undefined; if (code === '23505') return NextResponse.json({ message: 'Kế hoạch đã có mục tiêu cho năm này.' }, { status: 409 }); return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tạo mục tiêu.' }, { status: 400 }); }
}
