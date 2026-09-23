import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyCustomerConsumptionMonthly } from '@/db/schema';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ accountId: string; consumptionId: string }> };

const rowSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  energyKwh: z.number().nonnegative(),
  peakDemandKw: z.number().nonnegative().nullable().optional(),
  daytimeSharePct: z.number().min(0).max(100).nullable().optional(),
  source: z.string().trim().min(2).max(50),
});

function serialize(row: typeof energyCustomerConsumptionMonthly.$inferSelect) {
  return {
    ...row,
    energyKwh: Number(row.energyKwh),
    peakDemandKw: row.peakDemandKw == null ? null : Number(row.peakDemandKw),
    daytimeSharePct: row.daytimeSharePct == null ? null : Number(row.daytimeSharePct),
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { accountId, consumptionId } = await context.params;
    const [existing] = await db.select().from(energyCustomerConsumptionMonthly).where(and(eq(energyCustomerConsumptionMonthly.id, consumptionId), eq(energyCustomerConsumptionMonthly.accountId, accountId))).limit(1);
    if (!existing) return NextResponse.json({ message: 'Không tìm thấy kỳ tiêu thụ.' }, { status: 404 });
    const payload = rowSchema.parse(await request.json());
    const [periodConflict] = await db.select({ id: energyCustomerConsumptionMonthly.id }).from(energyCustomerConsumptionMonthly)
      .where(and(eq(energyCustomerConsumptionMonthly.accountId, accountId), eq(energyCustomerConsumptionMonthly.period, payload.period))).limit(1);
    if (periodConflict && periodConflict.id !== consumptionId) return NextResponse.json({ message: `Kỳ ${payload.period} đã có dữ liệu tiêu thụ.` }, { status: 409 });
    const [row] = await db.update(energyCustomerConsumptionMonthly).set({
      period: payload.period,
      energyKwh: String(payload.energyKwh),
      peakDemandKw: payload.peakDemandKw == null ? null : String(payload.peakDemandKw),
      daytimeSharePct: payload.daytimeSharePct == null ? null : String(payload.daytimeSharePct),
      source: payload.source,
    }).where(and(eq(energyCustomerConsumptionMonthly.id, consumptionId), eq(energyCustomerConsumptionMonthly.accountId, accountId))).returning();
    if (!row) return NextResponse.json({ message: 'Không tìm thấy kỳ tiêu thụ.' }, { status: 404 });
    return NextResponse.json({ item: serialize(row) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Dữ liệu tiêu thụ không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật kỳ tiêu thụ.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { accountId, consumptionId } = await context.params;
    const [row] = await db.delete(energyCustomerConsumptionMonthly).where(and(eq(energyCustomerConsumptionMonthly.id, consumptionId), eq(energyCustomerConsumptionMonthly.accountId, accountId))).returning({ id: energyCustomerConsumptionMonthly.id });
    if (!row) return NextResponse.json({ message: 'Không tìm thấy kỳ tiêu thụ.' }, { status: 404 });
    return NextResponse.json({ deleted: true, consumptionId });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể xóa kỳ tiêu thụ.' }, { status: 400 });
  }
}
