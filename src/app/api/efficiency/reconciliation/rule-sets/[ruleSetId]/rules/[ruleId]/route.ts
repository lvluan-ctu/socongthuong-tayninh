import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyReconciliationRules, energyReconciliationRuleSets } from '@/db/schema';
import { db } from '@/lib/db';
import { rulePatchSchema } from '@/lib/efficiency-schemas';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ ruleSetId: string; ruleId: string }> };

function serializeRule(rule: typeof energyReconciliationRules.$inferSelect) {
  return { ...rule, matchThresholdPct: Number(rule.matchThresholdPct), reviewThresholdPct: Number(rule.reviewThresholdPct), minDenominator: Number(rule.minDenominator) };
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { ruleSetId, ruleId } = await context.params;
    z.string().uuid().parse(ruleSetId);
    z.string().uuid().parse(ruleId);
    const payload = rulePatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) return NextResponse.json({ message: 'Không có trường nào để cập nhật.' }, { status: 400 });
    const [ruleSet] = await db.select({ status: energyReconciliationRuleSets.status }).from(energyReconciliationRuleSets).where(eq(energyReconciliationRuleSets.id, ruleSetId)).limit(1);
    if (!ruleSet) return NextResponse.json({ message: 'Không tìm thấy rule set.' }, { status: 404 });
    if (ruleSet.status === 'ACTIVE') return NextResponse.json({ message: 'Rule set ACTIVE đã được snapshot; hãy tạo version mới thay vì sửa rule trực tiếp.' }, { status: 409 });
    const [existing] = await db.select().from(energyReconciliationRules).where(and(
      eq(energyReconciliationRules.id, ruleId),
      eq(energyReconciliationRules.ruleSetId, ruleSetId),
    )).limit(1);
    if (!existing) return NextResponse.json({ message: 'Không tìm thấy rule.' }, { status: 404 });
    const matchThresholdPct = payload.matchThresholdPct ?? Number(existing.matchThresholdPct);
    const reviewThresholdPct = payload.reviewThresholdPct ?? Number(existing.reviewThresholdPct);
    if (reviewThresholdPct < matchThresholdPct) return NextResponse.json({ message: 'Ngưỡng review phải lớn hơn hoặc bằng ngưỡng match.' }, { status: 400 });
    const [updated] = await db.update(energyReconciliationRules).set({
      ...(payload.metricCode ? { metricCode: payload.metricCode.trim().toUpperCase() } : {}),
      ...(payload.matchThresholdPct !== undefined ? { matchThresholdPct: String(payload.matchThresholdPct) } : {}),
      ...(payload.reviewThresholdPct !== undefined ? { reviewThresholdPct: String(payload.reviewThresholdPct) } : {}),
      ...(payload.minDenominator !== undefined ? { minDenominator: String(payload.minDenominator) } : {}),
      ...(payload.severity ? { severity: payload.severity } : {}),
      ...(payload.unit ? { unit: payload.unit } : {}),
      ...(payload.metadata ? { metadata: payload.metadata } : {}),
      updatedAt: new Date(),
    }).where(and(eq(energyReconciliationRules.id, ruleId), eq(energyReconciliationRules.ruleSetId, ruleSetId))).returning();
    return NextResponse.json(updated ? serializeRule(updated) : null);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Rule không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật rule.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { ruleSetId, ruleId } = await context.params;
    z.string().uuid().parse(ruleSetId);
    z.string().uuid().parse(ruleId);
    const [ruleSet] = await db.select({ status: energyReconciliationRuleSets.status }).from(energyReconciliationRuleSets).where(eq(energyReconciliationRuleSets.id, ruleSetId)).limit(1);
    if (!ruleSet) return NextResponse.json({ message: 'Không tìm thấy rule set.' }, { status: 404 });
    if (ruleSet.status === 'ACTIVE') return NextResponse.json({ message: 'Không thể xóa rule của rule set ACTIVE.' }, { status: 409 });
    const [deleted] = await db.delete(energyReconciliationRules).where(and(
      eq(energyReconciliationRules.id, ruleId),
      eq(energyReconciliationRules.ruleSetId, ruleSetId),
    )).returning({ id: energyReconciliationRules.id });
    if (!deleted) return NextResponse.json({ message: 'Không tìm thấy rule.' }, { status: 404 });
    return NextResponse.json({ deleted: true, ruleId });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Mã rule không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể xóa rule.' }, { status: 400 });
  }
}
