import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyCorridorViolations, energyViolationAssignments, energyViolationStatusHistory } from '@/db/schema';
import { db } from '@/lib/db';
import { violationAssignmentSchema } from '@/lib/safety-schemas';
import { canTransitionViolation, isReviewPending } from '@/server/safety/violation-workflow';
import { readViolation } from '@/server/safety/violation-readers';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ violationId: string }> };
const paramsSchema = z.object({ violationId: z.string().uuid() });

function parseDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function assignmentIssues(payload: z.infer<typeof violationAssignmentSchema>, assignedAt: Date, dueAt: Date | null) {
  if (!payload.assignedTo && !payload.assignedTeam) return [{ path: ['assignedTo'], message: 'Provide an assignee or team.' }];
  if (payload.assignedAt && !assignedAt) return [{ path: ['assignedAt'], message: 'Assigned time is invalid.' }];
  if (payload.dueAt && !dueAt) return [{ path: ['dueAt'], message: 'Due time is invalid.' }];
  if (dueAt && dueAt < assignedAt) return [{ path: ['dueAt'], message: 'Due time must be after assignment time.' }];
  return [];
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { violationId } = paramsSchema.parse(await context.params);
    const [violation] = await db.select({ id: energyCorridorViolations.id }).from(energyCorridorViolations).where(eq(energyCorridorViolations.id, violationId)).limit(1);
    if (!violation) return NextResponse.json({ message: 'Violation not found.' }, { status: 404 });
    const items = await db.select().from(energyViolationAssignments).where(eq(energyViolationAssignments.violationId, violationId)).orderBy(desc(energyViolationAssignments.assignedAt));
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Violation ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load violation assignments.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { violationId } = paramsSchema.parse(await context.params);
    const payload = violationAssignmentSchema.parse(await request.json());
    const [violation] = await db.select().from(energyCorridorViolations).where(eq(energyCorridorViolations.id, violationId)).limit(1);
    if (!violation) return NextResponse.json({ message: 'Violation not found.' }, { status: 404 });
    const assignedAt = parseDate(payload.assignedAt) ?? new Date();
    const dueAt = parseDate(payload.dueAt);
    const issues = assignmentIssues(payload, assignedAt, dueAt);
    if (issues.length) return NextResponse.json({ message: 'Assignment is invalid.', issues }, { status: 400 });
    if (payload.status === 'ACTIVE' && ['CLOSED', 'ARCHIVED', 'FALSE_POSITIVE'].includes(violation.status)) {
      return NextResponse.json({ message: 'Closed, archived or false-positive violations cannot receive an active assignment.', issues: [{ path: ['status'], message: 'Reopen the violation before assigning it.' }] }, { status: 400 });
    }
    const evidence = violation.evidence ?? {};
    const source = typeof evidence === 'object' && evidence && 'source' in evidence ? String((evidence as Record<string, unknown>).source ?? '') : '';
    if (payload.status === 'ACTIVE' && isReviewPending(violation.status, violation.humanReviewRequired || source === 'AI_VISION', violation.reviewedAt)) {
      return NextResponse.json({ message: 'AI violation needs human review before assignment.', issues: [{ path: ['status'], message: 'Verify or confirm the detection first.' }] }, { status: 400 });
    }
    const targetStatus = payload.status === 'ACTIVE'
      ? violation.status === 'REMEDIATED' || violation.status === 'VERIFIED' || violation.status === 'RESOLVED' ? 'IN_PROGRESS' : violation.status === 'ASSIGNED' || violation.status === 'IN_PROGRESS' ? violation.status : 'ASSIGNED'
      : violation.status;
    if (targetStatus !== violation.status && !canTransitionViolation(violation.status, targetStatus)) {
      return NextResponse.json({ message: `Cannot assign violation from ${violation.status}.`, issues: [{ path: ['status'], message: 'Use the workflow actions in order.' }] }, { status: 400 });
    }
    const result = await db.transaction(async (tx) => {
      const [assignment] = await tx.insert(energyViolationAssignments).values({
        violationId,
        assignedTo: payload.assignedTo ?? null,
        assignedTeam: payload.assignedTeam ?? null,
        assignedAt,
        dueAt,
        status: payload.status,
        note: payload.note ?? null,
        createdBy: payload.createdBy ?? null,
        updatedAt: new Date(),
      }).returning();
      if (!assignment) throw new Error('Assignment was not created.');
      if (targetStatus !== violation.status) {
        await tx.update(energyCorridorViolations).set({ status: targetStatus, updatedAt: new Date() }).where(eq(energyCorridorViolations.id, violationId));
        await tx.insert(energyViolationStatusHistory).values({ violationId, fromStatus: violation.status, toStatus: targetStatus, changedBy: payload.createdBy ?? null, reason: 'VIOLATION_ASSIGNED' });
      }
      return assignment;
    });
    return NextResponse.json({ item: result, violation: await readViolation(violationId) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Assignment is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not create assignment.' }, { status: 400 });
  }
}
