import { asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyReconciliationRules, energyReconciliationRuleSets } from '@/db/schema';
import { db } from '@/lib/db';
import { ruleSchema } from '@/lib/efficiency-schemas';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ ruleSetId: string }> };

function serializeRule(rule: typeof energyReconciliationRules.$inferSelect) {
  return { ...rule, matchThresholdPct: Number(rule.matchThresholdPct), reviewThresholdPct: Number(rule.reviewThresholdPct), minDenominator: Number(rule.minDenominator) };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { ruleSetId } = await context.params;
    z.string().uuid().parse(ruleSetId);
    const [ruleSet] = await db.select({ id: energyReconciliationRuleSets.id }).from(energyReconciliationRuleSets).where(eq(energyReconciliationRuleSets.id, ruleSetId)).limit(1);
    if (!ruleSet) return NextResponse.json({ message: 'Không tìm thấy rule set.' }, { status: 404 });
    const rules = await db.select().from(energyReconciliationRules).where(eq(energyReconciliationRules.ruleSetId, ruleSetId)).orderBy(asc(energyReconciliationRules.metricCode));
    return NextResponse.json({ items: rules.map(serializeRule) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Mã rule set không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải các rule.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { ruleSetId } = await context.params;
    z.string().uuid().parse(ruleSetId);
    const payload = ruleSchema.parse(await request.json());
    const [ruleSet] = await db.select({ id: energyReconciliationRuleSets.id }).from(energyReconciliationRuleSets).where(eq(energyReconciliationRuleSets.id, ruleSetId)).limit(1);
    if (!ruleSet) return NextResponse.json({ message: 'Không tìm thấy rule set.' }, { status: 404 });
    const [created] = await db.insert(energyReconciliationRules).values({
      ruleSetId,
      metricCode: payload.metricCode.trim().toUpperCase(),
      matchThresholdPct: String(payload.matchThresholdPct),
      reviewThresholdPct: String(payload.reviewThresholdPct),
      minDenominator: String(payload.minDenominator),
      severity: payload.severity,
      unit: payload.unit,
      metadata: payload.metadata ?? {},
    }).returning();
    return NextResponse.json(serializeRule(created), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Rule không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tạo rule.' }, { status: 400 });
  }
}
