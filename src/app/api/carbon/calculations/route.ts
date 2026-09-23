import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyEmissionActivities, energyEmissionCalculationRuns, energyEmissionFactors, energyEmissionSources } from '@/db/schema';
import { calculationRunSchema } from '@/lib/carbon-schemas';
import { calculateActivityEmission } from '@/server/carbon/activity-calculation';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

function periodDate(period: string) { const date = new Date(`${period.length === 4 ? `${period}-01-01` : `${period}-01`}T00:00:00.000Z`); return Number.isNaN(date.getTime()) ? null : date; }

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams; const activityId = params.get('activityId'); const reviewStatus = params.get('reviewStatus');
    const filters = [activityId ? eq(energyEmissionCalculationRuns.activityId, activityId) : null, reviewStatus ? eq(energyEmissionCalculationRuns.reviewStatus, reviewStatus) : null].filter((item): item is NonNullable<typeof item> => item !== null);
    const query = db.select({
      id: energyEmissionCalculationRuns.id, activityId: energyEmissionCalculationRuns.activityId, sourceId: energyEmissionActivities.sourceId, sourceCode: energyEmissionSources.code,
      period: energyEmissionActivities.period, quantity: energyEmissionActivities.quantity, activityUnit: energyEmissionActivities.activityUnit, activityCo2eKg: energyEmissionActivities.co2eKg,
      factorId: energyEmissionCalculationRuns.factorId, factorCode: energyEmissionFactors.code, methodCode: energyEmissionCalculationRuns.methodCode, methodVersion: energyEmissionCalculationRuns.methodVersion,
      inputHash: energyEmissionCalculationRuns.inputHash, inputSnapshot: energyEmissionCalculationRuns.inputSnapshot, outputSnapshot: energyEmissionCalculationRuns.outputSnapshot,
      calculatedAt: energyEmissionCalculationRuns.calculatedAt, calculatedBy: energyEmissionCalculationRuns.calculatedBy, quality: energyEmissionCalculationRuns.quality,
      reviewStatus: energyEmissionCalculationRuns.reviewStatus, reviewedBy: energyEmissionCalculationRuns.reviewedBy, reviewedAt: energyEmissionCalculationRuns.reviewedAt, reviewNote: energyEmissionCalculationRuns.reviewNote,
    }).from(energyEmissionCalculationRuns).innerJoin(energyEmissionActivities, eq(energyEmissionActivities.id, energyEmissionCalculationRuns.activityId)).innerJoin(energyEmissionSources, eq(energyEmissionSources.id, energyEmissionActivities.sourceId)).leftJoin(energyEmissionFactors, eq(energyEmissionFactors.id, energyEmissionCalculationRuns.factorId));
    const rows = filters.length ? await query.where(and(...filters)).orderBy(desc(energyEmissionCalculationRuns.calculatedAt)).limit(500) : await query.orderBy(desc(energyEmissionCalculationRuns.calculatedAt)).limit(500);
    return NextResponse.json({ items: rows.map((row) => ({ ...row, quantity: Number(row.quantity), activityCo2eKg: Number(row.activityCo2eKg) })) });
  } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải calculation runs.' }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const payload = calculationRunSchema.parse(await request.json());
    const [activity] = await db.select().from(energyEmissionActivities).where(eq(energyEmissionActivities.id, payload.activityId)).limit(1);
    if (!activity) return NextResponse.json({ message: 'Không tìm thấy activity.' }, { status: 404 });
    const [factor] = await db.select().from(energyEmissionFactors).where(eq(energyEmissionFactors.id, activity.factorId)).limit(1);
    if (!factor) return NextResponse.json({ message: 'Không tìm thấy factor của activity.' }, { status: 404 });
    const at = periodDate(activity.period);
    if (!at || factor.validFrom > at || (factor.validTo && factor.validTo < at)) return NextResponse.json({ message: 'Factor không có hiệu lực trong kỳ activity.' }, { status: 400 });
    const calculation = await calculateActivityEmission({ sourceId: activity.sourceId, factorId: activity.factorId, period: activity.period, quantity: Number(activity.quantity), activityUnit: activity.activityUnit, co2eKg: null }, factor);
    if (calculation.co2eKg == null) return NextResponse.json({ message: 'Không thể re-calculate vì unit chưa tương thích hoặc thiếu conversion.', warnings: calculation.warnings }, { status: 422 });
    const result = await db.transaction(async (tx) => {
      const [run] = await tx.insert(energyEmissionCalculationRuns).values({
        activityId: activity.id, methodCode: calculation.methodCode, methodVersion: calculation.methodVersion, factorId: factor.id, inputHash: calculation.inputHash,
        inputSnapshot: calculation.inputSnapshot, outputSnapshot: calculation.outputSnapshot, calculatedBy: payload.calculatedBy ?? null, quality: 'CALCULATED', reviewStatus: 'PENDING_REVIEW',
      }).returning();
      const [updatedActivity] = await tx.update(energyEmissionActivities).set({ co2eKg: String(calculation.co2eKg), metadata: { ...activity.metadata, latestCalculationRunId: run.id, latestCalculationMethod: calculation.methodCode, latestCalculationWarnings: calculation.warnings } }).where(eq(energyEmissionActivities.id, activity.id)).returning();
      return { run, activity: updatedActivity };
    });
    return NextResponse.json({ ...result, warnings: calculation.warnings }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Calculation request không hợp lệ.', issues: error.issues }, { status: 400 });
    const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : undefined;
    if (code === '23505') return NextResponse.json({ message: 'Calculation run với cùng input hash đã tồn tại.' }, { status: 409 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tạo calculation run.' }, { status: 400 });
  }
}
