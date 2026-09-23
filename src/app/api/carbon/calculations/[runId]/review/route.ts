import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyEmissionActivities, energyEmissionCalculationRuns } from '@/db/schema';
import { calculationReviewSchema } from '@/lib/carbon-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ runId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params; const payload = calculationReviewSchema.parse(await request.json());
    const result = await db.transaction(async (tx) => {
      const [run] = await tx.select().from(energyEmissionCalculationRuns).where(eq(energyEmissionCalculationRuns.id, runId)).limit(1);
      if (!run) return null;
      const [updatedRun] = await tx.update(energyEmissionCalculationRuns).set({ reviewStatus: payload.reviewStatus, reviewedBy: payload.reviewedBy, reviewedAt: payload.reviewStatus === 'PENDING_REVIEW' ? null : new Date(), reviewNote: payload.reviewNote ?? null, quality: payload.reviewStatus === 'APPROVED' ? 'VERIFIED' : payload.reviewStatus === 'REJECTED' ? 'REJECTED' : 'NEEDS_REVIEW' }).where(eq(energyEmissionCalculationRuns.id, runId)).returning();
      const [activity] = await tx.select().from(energyEmissionActivities).where(eq(energyEmissionActivities.id, run.activityId)).limit(1);
      if (activity && payload.reviewStatus !== 'PENDING_REVIEW') await tx.update(energyEmissionActivities).set({ status: payload.reviewStatus === 'APPROVED' ? 'VERIFIED' : 'DRAFT', metadata: { ...activity.metadata, calculationReview: { status: payload.reviewStatus, reviewedBy: payload.reviewedBy, reviewedAt: new Date().toISOString(), note: payload.reviewNote ?? null } } }).where(eq(energyEmissionActivities.id, activity.id));
      return { run: updatedRun, activityId: run.activityId };
    });
    if (!result) return NextResponse.json({ message: 'Không tìm thấy calculation run.' }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin review không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể review calculation run.' }, { status: 400 });
  }
}
