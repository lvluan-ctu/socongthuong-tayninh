import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyConstructionCaseReviews, energyConstructionCases, energyConstructionCaseStatusHistory } from '@/db/schema';
import { db } from '@/lib/db';
import { constructionCaseReviewSchema } from '@/lib/safety-schemas';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ caseId: string }> };
const paramsSchema = z.object({ caseId: z.string().uuid() });
const decisionStatus: Record<string, string | undefined> = {
  REQUEST_MORE_INFO: 'REQUEST_MORE_INFO',
  SITE_SURVEY_REQUIRED: 'SITE_SURVEY_REQUIRED',
  RECOMMEND_APPROVAL: 'RECOMMEND_APPROVAL',
  RECOMMEND_REJECTION: 'RECOMMEND_REJECTION',
  FINALIZED: 'FINALIZED',
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { caseId } = paramsSchema.parse(await context.params);
    const [parent] = await db.select({ id: energyConstructionCases.id }).from(energyConstructionCases).where(eq(energyConstructionCases.id, caseId)).limit(1);
    if (!parent) return NextResponse.json({ message: 'Construction case not found.' }, { status: 404 });
    return NextResponse.json({ items: await db.select().from(energyConstructionCaseReviews).where(eq(energyConstructionCaseReviews.caseId, caseId)).orderBy(desc(energyConstructionCaseReviews.reviewedAt)) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Case ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load case reviews.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { caseId } = paramsSchema.parse(await context.params);
    const payload = constructionCaseReviewSchema.parse(await request.json());
    const [parent] = await db.select().from(energyConstructionCases).where(eq(energyConstructionCases.id, caseId)).limit(1);
    if (!parent) return NextResponse.json({ message: 'Construction case not found.' }, { status: 404 });
    const status = decisionStatus[payload.decision];
    const item = await db.transaction(async (tx) => {
      const [review] = await tx.insert(energyConstructionCaseReviews).values({
        caseId, reviewType: payload.reviewType, decision: payload.decision, reviewer: payload.reviewer,
        note: payload.note ?? null, evidence: payload.evidence ?? {},
      }).returning();
      if (status && status !== parent.status) {
        await tx.update(energyConstructionCases).set({ status, updatedAt: new Date() }).where(eq(energyConstructionCases.id, caseId));
        await tx.insert(energyConstructionCaseStatusHistory).values({ caseId, fromStatus: parent.status, toStatus: status, changedBy: payload.reviewer, reason: `REVIEW:${payload.decision}` });
      }
      return review;
    });
    return NextResponse.json({ item, status: status ?? parent.status }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Case review is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not save case review.' }, { status: 400 });
  }
}
