import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyReductionPlans, energyReductionProgress } from '@/db/schema';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const schema = z.object({
  planId: z.string().uuid(),
  period: z.string().trim().min(4).max(20),
  actualCo2eKg: z.number().nonnegative(),
  status: z.enum(['RECORDED', 'VERIFIED', 'APPROVED']).default('RECORDED'),
  evidenceRef: z.string().trim().max(1000).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const [plan] = await db.select().from(energyReductionPlans).where(eq(energyReductionPlans.id, payload.planId)).limit(1);
    if (!plan) return NextResponse.json({ message: 'Không tìm thấy kế hoạch giảm phát thải.' }, { status: 404 });
    const baseline = Number(plan.baselineCo2eKg);
    const reductionPct = baseline > 0 ? Math.max(-999, Math.min(100, (baseline - payload.actualCo2eKg) / baseline * 100)) : null;
    const [created] = await db.insert(energyReductionProgress).values({
      planId: payload.planId,
      period: payload.period,
      actualCo2eKg: String(payload.actualCo2eKg),
      reductionPct: reductionPct == null ? null : String(reductionPct),
      status: payload.status,
      evidenceRef: payload.evidenceRef ?? null,
      metadata: { notes: payload.notes ?? null, calculation: 'vs_baseline' },
    }).returning();
    return NextResponse.json({ ...created, reductionPct }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Tiến độ giảm phát thải không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu tiến độ giảm phát thải.' }, { status: 400 });
  }
}
