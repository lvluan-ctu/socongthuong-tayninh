import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyEmissionSources, energyReductionActions, energySites } from '@/db/schema';
import { reductionActionPatchSchema } from '@/lib/carbon-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ planId: string; actionId: string }> };

async function read(planId: string, actionId: string) { const [row] = await db.select().from(energyReductionActions).where(and(eq(energyReductionActions.planId, planId), eq(energyReductionActions.id, actionId))).limit(1); return row; }
async function validateReferences(sourceId: string | null | undefined, siteId: string | null | undefined) {
  if (sourceId) { const [source] = await db.select({ id: energyEmissionSources.id }).from(energyEmissionSources).where(eq(energyEmissionSources.id, sourceId)).limit(1); if (!source) return 'Không tìm thấy nguồn phát thải gắn với action.'; }
  if (siteId) { const [site] = await db.select({ id: energySites.id }).from(energySites).where(eq(energySites.id, siteId)).limit(1); if (!site) return 'Không tìm thấy Site gắn với action.'; }
  return null;
}

export async function GET(_request: Request, context: RouteContext) {
  const { planId, actionId } = await context.params; const row = await read(planId, actionId);
  return row ? NextResponse.json({ item: { ...row, budget: row.budget == null ? null : Number(row.budget), expectedReductionTco2eYear: row.expectedReductionTco2eYear == null ? null : Number(row.expectedReductionTco2eYear), actualReductionTco2eYear: row.actualReductionTco2eYear == null ? null : Number(row.actualReductionTco2eYear) } }) : NextResponse.json({ message: 'Không tìm thấy action của kế hoạch.' }, { status: 404 });
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { planId, actionId } = await context.params; const current = await read(planId, actionId); if (!current) return NextResponse.json({ message: 'Không tìm thấy action của kế hoạch.' }, { status: 404 });
    const payload = reductionActionPatchSchema.parse(await request.json()); if (Object.keys(payload).length === 0) return NextResponse.json({ message: 'Không có trường nào được cập nhật.' }, { status: 400 });
    const startAt = payload.startAt === undefined ? current.startAt : payload.startAt ? new Date(payload.startAt) : null; const targetAt = payload.targetAt === undefined ? current.targetAt : payload.targetAt ? new Date(payload.targetAt) : null;
    if (startAt && targetAt && targetAt < startAt) return NextResponse.json({ message: 'Thời điểm mục tiêu phải sau thời điểm bắt đầu.' }, { status: 400 });
    const referenceError = await validateReferences(payload.sourceId, payload.siteId); if (referenceError) return NextResponse.json({ message: referenceError }, { status: 400 });
    const [updated] = await db.update(energyReductionActions).set({ ...(payload.code === undefined ? {} : { code: payload.code }), ...(payload.name === undefined ? {} : { name: payload.name }), ...(payload.actionType === undefined ? {} : { actionType: payload.actionType }), ...(payload.sourceId === undefined ? {} : { sourceId: payload.sourceId }), ...(payload.siteId === undefined ? {} : { siteId: payload.siteId }), ...(payload.owner === undefined ? {} : { owner: payload.owner }), ...(payload.startAt === undefined ? {} : { startAt }), ...(payload.targetAt === undefined ? {} : { targetAt }), ...(payload.budget === undefined ? {} : { budget: payload.budget == null ? null : String(payload.budget) }), ...(payload.expectedReductionTco2eYear === undefined ? {} : { expectedReductionTco2eYear: payload.expectedReductionTco2eYear == null ? null : String(payload.expectedReductionTco2eYear) }), ...(payload.actualReductionTco2eYear === undefined ? {} : { actualReductionTco2eYear: payload.actualReductionTco2eYear == null ? null : String(payload.actualReductionTco2eYear) }), ...(payload.status === undefined ? {} : { status: payload.status }), ...(payload.method === undefined ? {} : { method: payload.method }), ...(payload.verificationRequired === undefined ? {} : { verificationRequired: payload.verificationRequired }), ...(payload.evidenceRef === undefined ? {} : { evidenceRef: payload.evidenceRef }), updatedAt: new Date() }).where(and(eq(energyReductionActions.planId, planId), eq(energyReductionActions.id, actionId))).returning();
    return NextResponse.json({ item: updated });
  } catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ message: 'Action không hợp lệ.', issues: error.issues }, { status: 400 }); return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật action.' }, { status: 400 }); }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { planId, actionId } = await context.params; const [updated] = await db.update(energyReductionActions).set({ status: 'CANCELLED', updatedAt: new Date() }).where(and(eq(energyReductionActions.planId, planId), eq(energyReductionActions.id, actionId))).returning({ id: energyReductionActions.id, planId: energyReductionActions.planId, status: energyReductionActions.status });
  return updated ? NextResponse.json({ item: updated, archived: true }) : NextResponse.json({ message: 'Không tìm thấy action của kế hoạch.' }, { status: 404 });
}
