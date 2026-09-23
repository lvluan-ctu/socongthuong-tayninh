import { asc, count, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyCustomerAccounts, energyCustomerConsumptionMonthly } from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ accountId: string }> };

const rowSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  energyKwh: z.number().nonnegative(),
  peakDemandKw: z.number().nonnegative().nullable().optional(),
  daytimeSharePct: z.number().min(0).max(100).nullable().optional(),
  source: z.string().trim().max(50).default('EVN'),
});

const payloadSchema = z.object({ rows: z.array(rowSchema).min(1).max(120) });

export async function GET(request: Request, context: RouteContext) {
  try {
    const { accountId } = await context.params;
    const [account] = await db.select({ id: energyCustomerAccounts.id }).from(energyCustomerAccounts).where(eq(energyCustomerAccounts.id, accountId)).limit(1);
    if (!account) return NextResponse.json({ message: 'Không tìm thấy tài khoản khách hàng.' }, { status: 404 });
    const params = new URL(request.url).searchParams;
    const wantsPagination = params.has('page') || params.has('pageSize');
    const pagination = parsePagination(params);
    const query = db.select().from(energyCustomerConsumptionMonthly)
      .where(eq(energyCustomerConsumptionMonthly.accountId, accountId))
      .orderBy(asc(energyCustomerConsumptionMonthly.period));
    const [rows, totalRows, summaryRows] = await Promise.all([
      wantsPagination ? query.limit(pagination.pageSize).offset(pagination.offset) : query,
      wantsPagination ? db.select({ value: count() }).from(energyCustomerConsumptionMonthly).where(eq(energyCustomerConsumptionMonthly.accountId, accountId)) : Promise.resolve([]),
      db.execute(sql`
        SELECT
          COALESCE(sum(energy_kwh::numeric), 0) AS "totalAnnual",
          avg(daytime_share_pct::numeric) AS "averageDaytime",
          count(*)::int AS count
        FROM (
          SELECT energy_kwh, daytime_share_pct
          FROM energy_customer_consumption_monthly
          WHERE account_id = ${accountId}
          ORDER BY period DESC
          LIMIT 12
        ) latest
      `),
    ]);
    const items = rows.map((row) => ({
        ...row,
        energyKwh: Number(row.energyKwh),
        peakDemandKw: row.peakDemandKw == null ? null : Number(row.peakDemandKw),
        daytimeSharePct: row.daytimeSharePct == null ? null : Number(row.daytimeSharePct),
      }));
    const summaryRow = summaryRows.rows[0] as { totalAnnual?: number | string; averageDaytime?: number | string | null; count?: number | string } | undefined;
    const summary = {
      totalAnnual: Number(summaryRow?.totalAnnual ?? 0),
      averageDaytime: summaryRow?.averageDaytime == null ? null : Number(summaryRow.averageDaytime),
      count: Number(summaryRow?.count ?? 0),
    };
    return wantsPagination
      ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0), { summary })
      : NextResponse.json({ items, summary });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải lịch sử tiêu thụ.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { accountId } = await context.params;
    const payload = payloadSchema.parse(await request.json());
    const [account] = await db.select({ id: energyCustomerAccounts.id }).from(energyCustomerAccounts).where(eq(energyCustomerAccounts.id, accountId)).limit(1);
    if (!account) return NextResponse.json({ message: 'Không tìm thấy tài khoản khách hàng.' }, { status: 404 });

    let upserted = 0;
    await db.transaction(async (tx) => {
      for (const row of payload.rows) {
        await tx.insert(energyCustomerConsumptionMonthly).values({
          accountId,
          period: row.period,
          energyKwh: String(row.energyKwh),
          peakDemandKw: row.peakDemandKw == null ? null : String(row.peakDemandKw),
          daytimeSharePct: row.daytimeSharePct == null ? null : String(row.daytimeSharePct),
          source: row.source,
        }).onConflictDoUpdate({
          target: [energyCustomerConsumptionMonthly.accountId, energyCustomerConsumptionMonthly.period],
          set: {
            energyKwh: String(row.energyKwh),
            peakDemandKw: row.peakDemandKw == null ? null : String(row.peakDemandKw),
            daytimeSharePct: row.daytimeSharePct == null ? null : String(row.daytimeSharePct),
            source: row.source,
          },
        });
        upserted += 1;
      }
    });

    return NextResponse.json({ accountId, upserted });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Dữ liệu tiêu thụ không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu tiêu thụ.' }, { status: 400 });
  }
}
