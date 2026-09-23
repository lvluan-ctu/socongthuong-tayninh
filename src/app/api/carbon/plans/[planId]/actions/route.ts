import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyEmissionSources, energyReductionActions, energyReductionPlans, energySites } from '@/db/schema';
import { reductionActionSchema } from '@/lib/carbon-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ planId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { planId } = await context.params;
  const items = await db.select({ action: energyReductionActions, sourceName: energyEmissionSources.name, siteName: energySites.name }).from(energyReductionActions).leftJoin(energyEmissionSources, eq(energyEmissionSources.id, energyReductionActions.sourceId)).leftJoin(energySites, eq(energySites.id, energyReductionActions.siteId)).where(eq(energyReductionActions.planId, planId)).orderBy(desc(energyReductionActions.targetAt));
  return NextResponse.json({ items: items.map(({ action, ...related }) => ({ ...action, ...related, budget: action.budget == null ? null : Number(action.budget), expectedReductionTco2eYear: action.expectedReductionTco2eYear == null ? null : Number(action.expectedReductionTco2eYear), actualReductionTco2eYear: action.actualReductionTco2eYear == null ? null : Number(action.actualReductionTco2eYear) })) });
}

async function validateReferences(sourceId: string | null | undefined, siteId: string | null | undefined) {
  if (sourceId) { const [source] = await db.select({ id: energyEmissionSources.id }).from(energyEmissionSources).where(eq(energyEmissionSources.id, sourceId)).limit(1); if (!source) return 'Không tìm thấy nguồn phát thải gắn với action.'; }
  if (siteId) { const [site] = await db.select({ id: energySites.id }).from(energySites).where(eq(energySites.id, siteId)).limit(1); if (!site) return 'Không tìm thấy Site gắn với action.'; }
  return null;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { planId } = await context.params; const payload = reductionActionSchema.parse(await request.json());
    const [plan] = await db.select({ id: energyReductionPlans.id }).from(energyReductionPlans).where(eq(energyReductionPlans.id, planId)).limit(1);
    if (!plan) return NextResponse.json({ message: 'Không tìm thấy kế hoạch giảm phát thải.' }, { status: 404 });
    const referenceError = await validateReferences(payload.sourceId, payload.siteId); if (referenceError) return NextResponse.json({ message: referenceError }, { status: 400 });
    const [created] = await db.insert(energyReductionActions).values({
      planId, code: payload.code, name: payload.name, actionType: payload.actionType, sourceId: payload.sourceId ?? null, siteId: payload.siteId ?? null, owner: payload.owner ?? null,
      startAt: payload.startAt ? new Date(payload.startAt) : null, targetAt: payload.targetAt ? new Date(payload.targetAt) : null, budget: payload.budget == null ? null : String(payload.budget), expectedReductionTco2eYear: payload.expectedReductionTco2eYear == null ? null : String(payload.expectedReductionTco2eYear), actualReductionTco2eYear: payload.actualReductionTco2eYear == null ? null : String(payload.actualReductionTco2eYear), status: payload.status, method: payload.method ?? null, verificationRequired: payload.verificationRequired, evidenceRef: payload.evidenceRef ?? null,
    }).returning();
    return NextResponse.json({ ...created, budget: created.budget == null ? null : Number(created.budget), expectedReductionTco2eYear: created.expectedReductionTco2eYear == null ? null : Number(created.expectedReductionTco2eYear), actualReductionTco2eYear: created.actualReductionTco2eYear == null ? null : Number(created.actualReductionTco2eYear) }, { status: 201 });
  } catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ message: 'Action giảm phát thải không hợp lệ.', issues: error.issues }, { status: 400 }); const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : undefined; if (code === '23505') return NextResponse.json({ message: 'Mã action đã tồn tại trong kế hoạch.' }, { status: 409 }); return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tạo action.' }, { status: 400 }); }
}
