import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyCorridorViolations, energyViolationStatusHistory } from '@/db/schema';
import { db } from '@/lib/db';
import { violationVerifySchema } from '@/lib/safety-schemas';
import { canTransitionViolation } from '@/server/safety/violation-workflow';
import { readViolation } from '@/server/safety/violation-readers';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ violationId: string }> };
const paramsSchema = z.object({ violationId: z.string().uuid() });

function decisionTarget(current: string, decision: string) {
  if (decision === 'VERIFIED') return ['REMEDIATED', 'RESOLVED'].includes(current) ? 'VERIFIED' : null;
  if (decision === 'CLOSE') return ['REMEDIATED', 'VERIFIED', 'RESOLVED', 'IN_PROGRESS', 'ASSIGNED'].includes(current) ? 'CLOSED' : null;
  if (decision === 'REOPEN') return ['CLOSED', 'VERIFIED', 'RESOLVED'].includes(current) ? 'IN_PROGRESS' : current === 'FALSE_POSITIVE' ? 'PENDING_REVIEW' : null;
  if (decision === 'FALSE_POSITIVE') return ['DETECTED', 'PENDING_REVIEW', 'CONFIRMED', 'ASSIGNED', 'OPEN'].includes(current) ? 'FALSE_POSITIVE' : null;
  return null;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { violationId } = paramsSchema.parse(await context.params);
    const payload = violationVerifySchema.parse(await request.json());
    const [existing] = await db.select().from(energyCorridorViolations).where(eq(energyCorridorViolations.id, violationId)).limit(1);
    if (!existing) return NextResponse.json({ message: 'Violation not found.' }, { status: 404 });
    const targetStatus = decisionTarget(existing.status, payload.decision);
    if (!targetStatus || (!canTransitionViolation(existing.status, targetStatus) && existing.status !== targetStatus)) {
      return NextResponse.json({ message: `Decision ${payload.decision} is not valid from ${existing.status}.`, issues: [{ path: ['decision'], message: 'Complete the preceding workflow step first.' }] }, { status: 400 });
    }
    const now = new Date();
    const currentEvidence = existing.evidence ?? {};
    const evidence = {
      ...(typeof currentEvidence === 'object' && currentEvidence ? currentEvidence : {}),
      review: { decision: payload.decision, reviewer: payload.reviewer, note: payload.note ?? null, reviewedAt: now.toISOString() },
    };
    await db.transaction(async (tx) => {
      await tx.update(energyCorridorViolations).set({
        status: targetStatus,
        evidence,
        humanReviewRequired: false,
        reviewDecision: payload.decision,
        reviewedBy: payload.reviewer,
        reviewedAt: now,
        verifiedBy: ['VERIFIED', 'CLOSE'].includes(payload.decision) ? payload.reviewer : null,
        verifiedAt: ['VERIFIED', 'CLOSE'].includes(payload.decision) ? now : null,
        closedAt: payload.decision === 'CLOSE' ? now : payload.decision === 'REOPEN' ? null : existing.closedAt,
        updatedAt: now,
      }).where(eq(energyCorridorViolations.id, violationId));
      if (existing.status !== targetStatus) await tx.insert(energyViolationStatusHistory).values({ violationId, fromStatus: existing.status, toStatus: targetStatus, changedBy: payload.reviewer, reason: `REVIEW_${payload.decision}` });
    });
    return NextResponse.json({ item: await readViolation(violationId) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Verification is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not verify violation.' }, { status: 400 });
  }
}
