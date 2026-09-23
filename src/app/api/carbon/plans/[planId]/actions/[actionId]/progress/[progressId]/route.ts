import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyReductionActionProgress } from '@/db/schema';
import { reductionActionProgressPatchSchema } from '@/lib/carbon-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ planId: string; actionId: string; progressId: string }> };
function dateOrNull(value: string | null | undefined) { return value ? new Date(value) : null; }

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { actionId, progressId } = await context.params; const payload = reductionActionProgressPatchSchema.parse(await request.json());
    const [current] = await db.select().from(energyReductionActionProgress).where(and(eq(energyReductionActionProgress.id, progressId), eq(energyReductionActionProgress.actionId, actionId))).limit(1);
    if (!current) return NextResponse.json({ message: 'Không tìm thấy tiến độ action.' }, { status: 404 });
    if (Object.keys(payload).length === 0) return NextResponse.json({ message: 'Không có trường nào được cập nhật.' }, { status: 400 });
    const [updated] = await db.update(energyReductionActionProgress).set({ ...(payload.period === undefined ? {} : { period: payload.period }), ...(payload.actualCo2eKg === undefined ? {} : { actualCo2eKg: String(payload.actualCo2eKg) }), ...(payload.reductionPct === undefined ? {} : { reductionPct: payload.reductionPct == null ? null : String(payload.reductionPct) }), ...(payload.evidenceRef === undefined ? {} : { evidenceRef: payload.evidenceRef }), ...(payload.verifiedBy === undefined ? {} : { verifiedBy: payload.verifiedBy }), ...(payload.verifiedAt === undefined ? {} : { verifiedAt: dateOrNull(payload.verifiedAt) }), ...(payload.status === undefined ? {} : { status: payload.status }), ...(payload.notes === undefined ? {} : { notes: payload.notes }) }).where(and(eq(energyReductionActionProgress.id, progressId), eq(energyReductionActionProgress.actionId, actionId))).returning();
    return NextResponse.json({ item: updated });
  } catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ message: 'Tiến độ action không hợp lệ.', issues: error.issues }, { status: 400 }); return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật tiến độ.' }, { status: 400 }); }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { actionId, progressId } = await context.params; const [updated] = await db.update(energyReductionActionProgress).set({ status: 'REJECTED' }).where(and(eq(energyReductionActionProgress.id, progressId), eq(energyReductionActionProgress.actionId, actionId))).returning({ id: energyReductionActionProgress.id, status: energyReductionActionProgress.status });
  return updated ? NextResponse.json({ item: updated, archived: true }) : NextResponse.json({ message: 'Không tìm thấy tiến độ action.' }, { status: 404 });
}
