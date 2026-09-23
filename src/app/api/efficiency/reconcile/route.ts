import { createHash } from 'node:crypto';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  energyConsumerReportLines,
  energyConsumerReports,
  energyConsumers,
  energyCustomerConsumptionMonthly,
  energyReconciliationRules,
  energyReconciliationRuleSets,
  energyReconciliationRuns,
  energyParties,
} from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const schema = z.object({ reportId: z.string().uuid(), ruleSetId: z.string().uuid().optional() });

type Rule = typeof energyReconciliationRules.$inferSelect;
type RuleSet = typeof energyReconciliationRuleSets.$inferSelect;

function number(value: string | number | null | undefined) {
  return value == null ? null : Number(value);
}

function periodBounds(period: string) {
  const [year, month] = period.split('-').map(Number);
  return { from: new Date(Date.UTC(year, month - 1, 1)), to: new Date(Date.UTC(year, month, 1)) };
}

function resultFor(absPct: number, rule: Rule, denominator: number) {
  if (denominator < Number(rule.minDenominator)) return 'REVIEW';
  if (absPct <= Number(rule.matchThresholdPct)) return 'MATCH';
  if (absPct <= Number(rule.reviewThresholdPct)) return 'REVIEW';
  return 'ALERT';
}

function worstResult(results: string[]) {
  if (results.includes('ALERT')) return 'ALERT';
  if (results.includes('REVIEW')) return 'REVIEW';
  return 'MATCH';
}

function hashInput(input: unknown) {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function ruleMatchesPeriod(ruleSet: RuleSet, period: string) {
  const bounds = periodBounds(period);
  return ruleSet.status === 'ACTIVE'
    && ruleSet.validFrom < bounds.to
    && (ruleSet.validTo == null || ruleSet.validTo >= bounds.from);
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const period = params.get('period');
    const reportIds = (params.get('reportIds') ?? '').split(',').map((value) => value.trim()).filter(Boolean);
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const filters = [period ? eq(energyConsumerReports.period, period) : null, reportIds.length ? inArray(energyReconciliationRuns.reportId, reportIds) : null].filter((item): item is NonNullable<typeof item> => item !== null);
    const where = filters.length ? and(...filters) : undefined;
    const listQuery = db.select({
      id: energyReconciliationRuns.id,
      reportId: energyReconciliationRuns.reportId,
      evnEnergyKwh: energyReconciliationRuns.evnEnergyKwh,
      reportedEnergyKwh: energyReconciliationRuns.reportedEnergyKwh,
      differenceKwh: energyReconciliationRuns.differenceKwh,
      differencePct: energyReconciliationRuns.differencePct,
      result: energyReconciliationRuns.result,
      ruleVersion: energyReconciliationRuns.ruleVersion,
      ruleSetId: energyReconciliationRuns.ruleSetId,
      inputHash: energyReconciliationRuns.inputHash,
      reportVersion: energyReconciliationRuns.reportVersion,
      executedAt: energyReconciliationRuns.executedAt,
      evnSourceRef: energyReconciliationRuns.evnSourceRef,
      reportSourceRef: energyReconciliationRuns.reportSourceRef,
      explanation: energyReconciliationRuns.explanation,
      reviewedBy: energyReconciliationRuns.reviewedBy,
      reviewedAt: energyReconciliationRuns.reviewedAt,
      reviewDecision: energyReconciliationRuns.reviewDecision,
      period: energyConsumerReports.period,
      reportStatus: energyConsumerReports.status,
      consumerId: energyConsumerReports.consumerId,
      partyName: energyParties.name,
    }).from(energyReconciliationRuns)
      .innerJoin(energyConsumerReports, eq(energyConsumerReports.id, energyReconciliationRuns.reportId))
      .innerJoin(energyConsumers, eq(energyConsumers.id, energyConsumerReports.consumerId))
      .innerJoin(energyParties, eq(energyParties.id, energyConsumers.partyId))
      .where(where)
      .orderBy(desc(energyReconciliationRuns.executedAt), desc(energyConsumerReports.period), energyParties.name)
    const rows = wantsPagination ? await listQuery.limit(pagination.pageSize).offset(pagination.offset) : await listQuery.limit(1000);
    const totalRows = wantsPagination ? await db.select({ value: count() }).from(energyReconciliationRuns).innerJoin(energyConsumerReports, eq(energyConsumerReports.id, energyReconciliationRuns.reportId)).where(where) : [];
    const items = rows.map((row) => ({
      ...row,
      evnEnergyKwh: Number(row.evnEnergyKwh),
      reportedEnergyKwh: Number(row.reportedEnergyKwh),
      differenceKwh: Number(row.differenceKwh),
      differencePct: Number(row.differencePct),
    }));
    return wantsPagination
      ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0))
      : NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải kết quả đối soát.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const [row] = await db.select({
      reportId: energyConsumerReports.id,
      consumerId: energyConsumerReports.consumerId,
      period: energyConsumerReports.period,
      reportVersion: energyConsumerReports.reportVersion,
      reportSourceRef: energyConsumerReports.documentRef,
      reportedEnergyKwh: energyConsumerReports.reportedEnergyKwh,
      customerAccountId: energyConsumers.customerAccountId,
    }).from(energyConsumerReports)
      .innerJoin(energyConsumers, eq(energyConsumers.id, energyConsumerReports.consumerId))
      .where(eq(energyConsumerReports.id, payload.reportId)).limit(1);
    if (!row) return NextResponse.json({ message: 'Không tìm thấy báo cáo đơn vị.' }, { status: 404 });
    if (!row.customerAccountId) return NextResponse.json({ message: 'Đơn vị chưa liên kết tài khoản EVN nên chưa thể đối soát tự động.' }, { status: 422 });

    const [evn] = await db.select().from(energyCustomerConsumptionMonthly)
      .where(eq(energyCustomerConsumptionMonthly.accountId, row.customerAccountId))
      .then((items) => items.filter((item) => item.period === row.period).slice(0, 1));
    if (!evn) return NextResponse.json({ message: `Không có dữ liệu EVN kỳ ${row.period}.` }, { status: 422 });

    const allRuleSets = await db.select().from(energyReconciliationRuleSets);
    const candidates = allRuleSets.filter((ruleSet) => ruleMatchesPeriod(ruleSet, row.period));
    const ruleSet = payload.ruleSetId
      ? allRuleSets.find((item) => item.id === payload.ruleSetId)
      : candidates.length === 1 ? candidates[0] : null;
    if (!ruleSet) {
      return NextResponse.json({
        message: payload.ruleSetId
          ? 'Rule set được chọn không tồn tại hoặc không ACTIVE trong kỳ báo cáo.'
          : candidates.length > 1
            ? 'Có nhiều rule set ACTIVE cùng hiệu lực; cần chỉ định ruleSetId để tạo snapshot không mơ hồ.'
            : 'Chưa có đúng một rule set ACTIVE hợp lệ cho kỳ báo cáo. Hãy cấu hình Rule Registry trước khi đối soát.',
        candidates: candidates.map((item) => ({ id: item.id, code: item.code, version: item.version })),
      }, { status: 422 });
    }
    if (!ruleMatchesPeriod(ruleSet, row.period)) return NextResponse.json({ message: 'Rule set được chọn không ACTIVE hoặc không bao phủ kỳ báo cáo.' }, { status: 422 });

    const rules = await db.select().from(energyReconciliationRules).where(eq(energyReconciliationRules.ruleSetId, ruleSet.id));
    const ruleByMetric = new Map(rules.map((rule) => [rule.metricCode.toUpperCase(), rule]));
    const [reportLines] = await Promise.all([
      db.select().from(energyConsumerReportLines).where(eq(energyConsumerReportLines.reportId, row.reportId)),
    ]);
    const reportedByMetric = new Map(reportLines.map((line) => [line.metricCode.toUpperCase(), Number(line.value)]));
    reportedByMetric.set('TOTAL_ENERGY_KWH', Number(row.reportedEnergyKwh));
    const evnByMetric = new Map<string, number | null>([
      ['TOTAL_ENERGY_KWH', Number(evn.energyKwh)],
      ['ENERGY_IMPORT_KWH', Number(evn.energyKwh)],
      ['MAX_DEMAND_KW', number(evn.peakDemandKw)],
    ]);

    const metricResults: Array<Record<string, unknown>> = [];
    for (const [metricCode, reportedValue] of reportedByMetric.entries()) {
      const rule = ruleByMetric.get(metricCode);
      const evnValue = evnByMetric.get(metricCode);
      if (!rule || evnValue == null) continue;
      const difference = reportedValue - evnValue;
      const differencePct = evnValue === 0 ? (reportedValue === 0 ? 0 : 100) : difference / evnValue * 100;
      const absoluteDifferencePct = Math.abs(differencePct);
      metricResults.push({
        metricCode,
        evnValue,
        reportedValue,
        difference,
        differencePct,
        absoluteDifferencePct,
        minDenominator: Number(rule.minDenominator),
        matchThresholdPct: Number(rule.matchThresholdPct),
        reviewThresholdPct: Number(rule.reviewThresholdPct),
        result: resultFor(absoluteDifferencePct, rule, Math.abs(evnValue)),
      });
    }
    const totalRule = ruleByMetric.get('TOTAL_ENERGY_KWH') ?? ruleByMetric.get('ENERGY_IMPORT_KWH');
    if (!totalRule) return NextResponse.json({ message: 'Rule set chưa khai báo TOTAL_ENERGY_KWH hoặc ENERGY_IMPORT_KWH.' }, { status: 422 });
    if (!metricResults.length) return NextResponse.json({ message: 'Không có metric report/EVN tương ứng để đối soát theo rule set.' }, { status: 422 });

    const totalEvnEnergyKwh = Number(evn.energyKwh);
    const totalReportedEnergyKwh = Number(row.reportedEnergyKwh);
    const differenceKwh = totalReportedEnergyKwh - totalEvnEnergyKwh;
    const differencePct = totalEvnEnergyKwh === 0 ? (totalReportedEnergyKwh === 0 ? 0 : 100) : differenceKwh / totalEvnEnergyKwh * 100;
    const result = worstResult(metricResults.map((item) => String(item.result)));
    const inputSnapshot = {
      reportId: row.reportId,
      consumerId: row.consumerId,
      period: row.period,
      reportVersion: row.reportVersion,
      reportSourceRef: row.reportSourceRef,
      evnSource: evn.source,
      evnEnergyKwh: totalEvnEnergyKwh,
      reportedEnergyKwh: totalReportedEnergyKwh,
      evnPeakDemandKw: number(evn.peakDemandKw),
      reportLines: reportLines.map((line) => ({ metricCode: line.metricCode, value: Number(line.value), unit: line.unit, quality: line.quality, sourceRef: line.sourceRef })),
      ruleSetId: ruleSet.id,
      ruleVersion: ruleSet.version,
      rules: rules.map((rule) => ({ metricCode: rule.metricCode, matchThresholdPct: rule.matchThresholdPct, reviewThresholdPct: rule.reviewThresholdPct, minDenominator: rule.minDenominator })),
    };
    const explanation = {
      formula: '(reportedValue - evnValue) / evnValue * 100',
      ruleSet: { id: ruleSet.id, code: ruleSet.code, version: ruleSet.version, sourceDocumentNo: ruleSet.sourceDocumentNo, sourceDocumentRef: ruleSet.sourceDocumentRef },
      metricResults,
      absoluteDifferencePct: Math.round(Math.abs(differencePct) * 10000) / 10000,
      sourcePeriod: row.period,
      note: 'Kết quả được tính từ Rule Registry versioned; snapshot gồm inputHash, nguồn EVN, nguồn báo cáo và phiên bản báo cáo.',
    };
    const [created] = await db.insert(energyReconciliationRuns).values({
      reportId: row.reportId,
      evnEnergyKwh: String(totalEvnEnergyKwh),
      reportedEnergyKwh: String(totalReportedEnergyKwh),
      differenceKwh: String(differenceKwh),
      differencePct: String(differencePct),
      result,
      ruleVersion: ruleSet.version,
      ruleSetId: ruleSet.id,
      inputHash: hashInput(inputSnapshot),
      reportVersion: row.reportVersion,
      executedAt: new Date(),
      evnSourceRef: evn.source,
      reportSourceRef: row.reportSourceRef,
      explanation,
    }).returning();

    await db.update(energyConsumerReports).set({
      status: result === 'MATCH' ? 'ACCEPTED' : 'UNDER_REVIEW',
    }).where(eq(energyConsumerReports.id, row.reportId));

    return NextResponse.json({
      ...created,
      evnEnergyKwh: totalEvnEnergyKwh,
      reportedEnergyKwh: totalReportedEnergyKwh,
      differenceKwh,
      differencePct,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Yêu cầu đối soát không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể chạy đối soát.' }, { status: 400 });
  }
}
