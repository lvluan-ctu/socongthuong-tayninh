import { count, desc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyReconciliationRules, energyReconciliationRuleSets } from '@/db/schema';
import { db } from '@/lib/db';
import { ruleSetSchema } from '@/lib/efficiency-schemas';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

function serializeRule(rule: typeof energyReconciliationRules.$inferSelect) {
  return {
    ...rule,
    matchThresholdPct: Number(rule.matchThresholdPct),
    reviewThresholdPct: Number(rule.reviewThresholdPct),
    minDenominator: Number(rule.minDenominator),
  };
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const status = params.get('status');
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const where = status && status !== 'ALL' ? eq(energyReconciliationRuleSets.status, status) : undefined;
    const setQuery = db.select().from(energyReconciliationRuleSets).where(where).orderBy(desc(energyReconciliationRuleSets.validFrom));
    const sets = wantsPagination ? await setQuery.limit(pagination.pageSize).offset(pagination.offset) : await setQuery;
    const totalRows = wantsPagination ? await db.select({ value: count() }).from(energyReconciliationRuleSets).where(where) : [];
    const setIds = sets.map((set) => set.id);
    const rules = setIds.length ? await db.select().from(energyReconciliationRules).where(inArray(energyReconciliationRules.ruleSetId, setIds)) : [];
    const rulesBySet = new Map<string, typeof rules>();
    for (const rule of rules) {
      const list = rulesBySet.get(rule.ruleSetId) ?? [];
      list.push(rule);
      rulesBySet.set(rule.ruleSetId, list);
    }
    const items = sets.map((set) => ({
      ...set,
      rules: (rulesBySet.get(set.id) ?? []).map(serializeRule),
    }));
    return wantsPagination ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0)) : NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải registry rule đối soát.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = ruleSetSchema.parse(await request.json());
    const result = await db.transaction(async (tx) => {
      const [created] = await tx.insert(energyReconciliationRuleSets).values({
        code: payload.code,
        name: payload.name,
        version: payload.version,
        validFrom: new Date(payload.validFrom),
        validTo: payload.validTo ? new Date(payload.validTo) : null,
        status: payload.status,
        sourceDocumentNo: payload.sourceDocumentNo ?? null,
        sourceDocumentRef: payload.sourceDocumentRef ?? null,
        notes: payload.notes ?? null,
      }).returning();
      const rules = [];
      for (const rule of payload.rules) {
        const [createdRule] = await tx.insert(energyReconciliationRules).values({
          ruleSetId: created.id,
          metricCode: rule.metricCode.trim().toUpperCase(),
          matchThresholdPct: String(rule.matchThresholdPct),
          reviewThresholdPct: String(rule.reviewThresholdPct),
          minDenominator: String(rule.minDenominator),
          severity: rule.severity,
          unit: rule.unit,
          metadata: rule.metadata ?? {},
        }).returning();
        rules.push(createdRule);
      }
      return { created, rules };
    });
    return NextResponse.json({ ...result.created, rules: result.rules.map(serializeRule) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Rule set không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tạo rule set.' }, { status: 400 });
  }
}
