import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyReductionActionProgress, energyReductionActions } from '@/db/schema';
import { reductionActionProgressSchema } from '@/lib/carbon-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ planId: string; actionId: string }> };
function dateOrNull(value: string | null | undefined) { return value ? new Date(value) : null; }
function numberOrNull(value: string | null) { return value == null ? null : Number(value); }

export async function GET(_request: Request, context: RouteContext) {
  const { planId, actionId } = await context.params; const [action] = await db.select({ id: energyReductionActions.id, planId: energyReductionActions.planId }).from(energyReductionActions).where(eq(energyReductionActions.id, actionId)).limit(1);
  if (!action || action.planId !== planId) return NextResponse.json({ message: 'Không tìm thấy action.' }, { status: 404 });
  const items = await db.select().from(energyReductionActionProgress).where(eq(energyReductionActionProgress.actionId, actionId)).orderBy(desc(energyReductionActionProgress.period));
  return NextResponse.json({ planId, items: items.map((item) => ({ ...item, actualCo2eKg: Number(item.actualCo2eKg), reductionPct: numberOrNull(item.reductionPct) })) });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { planId, actionId } = await context.params; const payload = reductionActionProgressSchema.parse(await request.json());
    const [action] = await db.select({ id: energyReductionActions.id, planId: energyReductionActions.planId }).from(energyReductionActions).where(eq(energyReductionActions.id, actionId)).limit(1);
    if (!action || action.planId !== planId) return NextResponse.json({ message: 'Không tìm thấy action thuộc kế hoạch.' }, { status: 404 });
    const [created] = await db.insert(energyReductionActionProgress).values({ actionId, period: payload.period, actualCo2eKg: String(payload.actualCo2eKg), reductionPct: payload.reductionPct == null ? null : String(payload.reductionPct), evidenceRef: payload.evidenceRef ?? null, verifiedBy: payload.verifiedBy ?? null, verifiedAt: dateOrNull(payload.verifiedAt), status: payload.status, notes: payload.notes ?? null }).returning();
    return NextResponse.json({ ...created, actualCo2eKg: Number(created.actualCo2eKg), reductionPct: numberOrNull(created.reductionPct) }, { status: 201 });
  } catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ message: 'Tiến độ action không hợp lệ.', issues: error.issues }, { status: 400 }); const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : undefined; if (code === '23505') return NextResponse.json({ message: 'Action đã có tiến độ cho kỳ này.' }, { status: 409 }); return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể ghi tiến độ action.' }, { status: 400 }); }
}
