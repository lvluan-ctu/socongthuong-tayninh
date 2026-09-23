import { and, eq, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyReconciliationRules, energyReconciliationRuleSets } from '@/db/schema';
import { db } from '@/lib/db';
import { ruleSetPatchSchema } from '@/lib/efficiency-schemas';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ ruleSetId: string }> };

function serializeRule(rule: typeof energyReconciliationRules.$inferSelect) {
  return { ...rule, matchThresholdPct: Number(rule.matchThresholdPct), reviewThresholdPct: Number(rule.reviewThresholdPct), minDenominator: Number(rule.minDenominator) };
}

async function loadRuleSet(ruleSetId: string) {
  const [set] = await db.select().from(energyReconciliationRuleSets).where(eq(energyReconciliationRuleSets.id, ruleSetId)).limit(1);
  if (!set) return null;
  const rules = await db.select().from(energyReconciliationRules).where(eq(energyReconciliationRules.ruleSetId, ruleSetId));
  return { ...set, rules: rules.map(serializeRule) };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { ruleSetId } = await context.params;
    z.string().uuid().parse(ruleSetId);
    const ruleSet = await loadRuleSet(ruleSetId);
    if (!ruleSet) return NextResponse.json({ message: 'Không tìm thấy rule set.' }, { status: 404 });
    return NextResponse.json({ ruleSet });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Mã rule set không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải rule set.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { ruleSetId } = await context.params;
    z.string().uuid().parse(ruleSetId);
    const payload = ruleSetPatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) return NextResponse.json({ message: 'Không có trường nào để cập nhật.' }, { status: 400 });
    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(energyReconciliationRuleSets).where(eq(energyReconciliationRuleSets.id, ruleSetId)).limit(1);
      if (!existing) throw new Error('Không tìm thấy rule set.');
      const nextStatus = payload.status ?? existing.status;
      if (payload.code || payload.version) {
        const [duplicate] = await tx.select({ id: energyReconciliationRuleSets.id }).from(energyReconciliationRuleSets).where(and(
          eq(energyReconciliationRuleSets.code, payload.code ?? existing.code),
          eq(energyReconciliationRuleSets.version, payload.version ?? existing.version),
          ne(energyReconciliationRuleSets.id, ruleSetId),
        )).limit(1);
        if (duplicate) throw new Error('Code + version của rule set đã tồn tại.');
      }
      const validFrom = payload.validFrom ? new Date(payload.validFrom) : existing.validFrom;
      const validTo = Object.prototype.hasOwnProperty.call(payload, 'validTo') ? (payload.validTo ? new Date(payload.validTo) : null) : existing.validTo;
      if (validTo && validTo.getTime() < validFrom.getTime()) throw new Error('Ngày kết thúc phải sau ngày bắt đầu.');
      if (nextStatus === 'ACTIVE' && !payload.sourceDocumentNo && !payload.sourceDocumentRef && !existing.sourceDocumentNo && !existing.sourceDocumentRef) {
        throw new Error('Rule ACTIVE phải có văn bản hoặc nguồn công bố.');
      }
      const [row] = await tx.update(energyReconciliationRuleSets).set({
        ...(payload.code ? { code: payload.code } : {}),
        ...(payload.name ? { name: payload.name } : {}),
        ...(payload.version ? { version: payload.version } : {}),
        ...(payload.validFrom ? { validFrom } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'validTo') ? { validTo } : {}),
        ...(payload.status ? { status: payload.status } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'sourceDocumentNo') ? { sourceDocumentNo: payload.sourceDocumentNo ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'sourceDocumentRef') ? { sourceDocumentRef: payload.sourceDocumentRef ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'notes') ? { notes: payload.notes ?? null } : {}),
        updatedAt: new Date(),
      }).where(eq(energyReconciliationRuleSets.id, ruleSetId)).returning();
      return row;
    });
    const ruleSet = await loadRuleSet(ruleSetId);
    return NextResponse.json({ ...updated, rules: ruleSet?.rules ?? [] });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin rule set không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật rule set.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { ruleSetId } = await context.params;
    z.string().uuid().parse(ruleSetId);
    const [updated] = await db.update(energyReconciliationRuleSets).set({ status: 'ARCHIVED', updatedAt: new Date() })
      .where(eq(energyReconciliationRuleSets.id, ruleSetId)).returning({ id: energyReconciliationRuleSets.id });
    if (!updated) return NextResponse.json({ message: 'Không tìm thấy rule set.' }, { status: 404 });
    return NextResponse.json({ deleted: true, ruleSetId, message: 'Rule set đã được chuyển sang ARCHIVED để bảo toàn snapshot đối soát.' });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Mã rule set không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu trạng thái rule set.' }, { status: 400 });
  }
}
