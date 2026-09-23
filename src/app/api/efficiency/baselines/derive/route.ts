import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  energyConsumers,
  energyCustomerAccounts,
  energyCustomerConsumptionMonthly,
  energyDataSources,
  energyEfficiencyBaselines,
} from '@/db/schema';
import { db } from '@/lib/db';
import { baselineDeriveSchema } from '@/lib/efficiency-schemas';

export const dynamic = 'force-dynamic';

function serialize(row: typeof energyEfficiencyBaselines.$inferSelect) {
  return { ...row, baselineKwh: Number(row.baselineKwh) };
}

export async function POST(request: Request) {
  try {
    const payload = baselineDeriveSchema.parse(await request.json());
    const [consumer] = await db.select({ id: energyConsumers.id, customerAccountId: energyConsumers.customerAccountId })
      .from(energyConsumers).where(and(eq(energyConsumers.id, payload.consumerId), eq(energyConsumers.status, 'ACTIVE'))).limit(1);
    if (!consumer) return NextResponse.json({ message: 'Không tìm thấy đơn vị sử dụng năng lượng ACTIVE.' }, { status: 404 });
    if (!consumer.customerAccountId) {
      return NextResponse.json({ message: 'Đơn vị chưa liên kết tài khoản EVN nên chưa thể derive baseline từ consumption thật.', warnings: ['Thiếu customer_account_id.'] }, { status: 422 });
    }
    const [account] = await db.select({ id: energyCustomerAccounts.id, customerCode: energyCustomerAccounts.customerCode })
      .from(energyCustomerAccounts).where(eq(energyCustomerAccounts.id, consumer.customerAccountId)).limit(1);
    if (!account) return NextResponse.json({ message: 'Không tìm thấy tài khoản EVN của đơn vị.' }, { status: 422 });
    if (payload.sourceId) {
      const [source] = await db.select({ id: energyDataSources.id }).from(energyDataSources).where(eq(energyDataSources.id, payload.sourceId)).limit(1);
      if (!source) return NextResponse.json({ message: 'Không tìm thấy data source của baseline.' }, { status: 400 });
    }
    const rows = await db.select({ period: energyCustomerConsumptionMonthly.period, energyKwh: energyCustomerConsumptionMonthly.energyKwh })
      .from(energyCustomerConsumptionMonthly)
      .where(and(
        eq(energyCustomerConsumptionMonthly.accountId, consumer.customerAccountId),
        gte(energyCustomerConsumptionMonthly.period, payload.periodFrom),
        lte(energyCustomerConsumptionMonthly.period, payload.periodTo),
      ))
      .orderBy(asc(energyCustomerConsumptionMonthly.period));
    if (!rows.length) {
      return NextResponse.json({ message: 'Không có consumption monthly thật trong khoảng kỳ đã chọn.', warnings: [`EVN account ${account.customerCode} không có bản ghi từ ${payload.periodFrom} đến ${payload.periodTo}.`] }, { status: 422 });
    }
    const baselineKwh = rows.reduce((sum, row) => sum + Number(row.energyKwh), 0);
    const [created] = await db.insert(energyEfficiencyBaselines).values({
      consumerId: payload.consumerId,
      baselineType: payload.baselineType,
      periodFrom: payload.periodFrom,
      periodTo: payload.periodTo,
      baselineKwh: String(baselineKwh),
      normalizationMethod: payload.normalizationMethod,
      weatherAdjusted: payload.weatherAdjusted,
      productionAdjusted: payload.productionAdjusted,
      methodVersion: payload.methodVersion,
      sourceId: payload.sourceId ?? null,
      sourceRef: payload.sourceRef ?? 'EVN:energy_customer_consumption_monthly',
      status: payload.status,
      notes: payload.notes ?? null,
      metadata: {
        ...(payload as Record<string, unknown>),
        derivation: 'SUM_MONTHLY_ENERGY_KWH',
        sourceAccountId: consumer.customerAccountId,
        sourcePeriods: rows.map((row) => row.period),
        sourceRows: rows.length,
        derivedAt: new Date().toISOString(),
      },
    }).returning();
    return NextResponse.json({ item: serialize(created), derivation: { aggregation: 'SUM', sourceRows: rows.length, sourceAccountId: consumer.customerAccountId } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Yêu cầu derive baseline không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể derive baseline từ consumption EVN.' }, { status: 400 });
  }
}
