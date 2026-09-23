import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyCorridorViolations, energyViolationActions, energyViolationStatusHistory } from '@/db/schema';
import { db } from '@/lib/db';
import { violationActionSchema } from '@/lib/safety-schemas';
import { actionWorkflowChanges } from '@/server/safety/violation-workflow';
import { readViolation } from '@/server/safety/violation-readers';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ violationId: string }> };
const paramsSchema = z.object({ violationId: z.string().uuid() });

function parseDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateIssues(payload: z.infer<typeof violationActionSchema>, plannedAt: Date | null, startedAt: Date | null, completedAt: Date | null) {
  if (payload.plannedAt && !plannedAt) return [{ path: ['plannedAt'], message: 'Planned time is invalid.' }];
  if (payload.startedAt && !startedAt) return [{ path: ['startedAt'], message: 'Start time is invalid.' }];
  if (payload.completedAt && !completedAt) return [{ path: ['completedAt'], message: 'Completion time is invalid.' }];
  if (plannedAt && startedAt && startedAt < plannedAt) return [{ path: ['startedAt'], message: 'Start time must be after planned time.' }];
  if (startedAt && completedAt && completedAt < startedAt) return [{ path: ['completedAt'], message: 'Completion time must be after start time.' }];
  return [];
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { violationId } = paramsSchema.parse(await context.params);
    const [violation] = await db.select({ id: energyCorridorViolations.id }).from(energyCorridorViolations).where(eq(energyCorridorViolations.id, violationId)).limit(1);
    if (!violation) return NextResponse.json({ message: 'Violation not found.' }, { status: 404 });
    const items = await db.select().from(energyViolationActions).where(eq(energyViolationActions.violationId, violationId)).orderBy(desc(energyViolationActions.createdAt));
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Violation ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load violation actions.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { violationId } = paramsSchema.parse(await context.params);
    const payload = violationActionSchema.parse(await request.json());
    const [violation] = await db.select().from(energyCorridorViolations).where(eq(energyCorridorViolations.id, violationId)).limit(1);
    if (!violation) return NextResponse.json({ message: 'Violation not found.' }, { status: 404 });
    const now = new Date();
    const plannedAt = parseDate(payload.plannedAt);
    const startedAt = parseDate(payload.startedAt) ?? (payload.status === 'IN_PROGRESS' || payload.status === 'COMPLETED' ? now : null);
    const completedAt = parseDate(payload.completedAt) ?? (payload.status === 'COMPLETED' ? now : null);
    const issues = dateIssues(payload, plannedAt, startedAt, completedAt);
    if (issues.length) return NextResponse.json({ message: 'Action time range is invalid.', issues }, { status: 400 });
    const changes = actionWorkflowChanges(violation, payload.status);
    if (changes === null) return NextResponse.json({ message: 'Action cannot advance this violation yet.', issues: [{ path: ['status'], message: 'Review the violation first or use a valid workflow action.' }] }, { status: 400 });
    const result = await db.transaction(async (tx) => {
      const [action] = await tx.insert(energyViolationActions).values({
        violationId,
        actionType: payload.actionType,
        status: payload.status,
        plannedAt,
        startedAt,
        completedAt,
        actor: payload.actor,
        note: payload.note ?? null,
        beforeEvidence: payload.beforeEvidence,
        afterEvidence: payload.afterEvidence,
        updatedAt: now,
      }).returning();
      if (!action) throw new Error('Violation action was not created.');
      let fromStatus = violation.status;
      for (const toStatus of changes) {
        await tx.update(energyCorridorViolations).set({ status: toStatus, updatedAt: now, closedAt: null }).where(eq(energyCorridorViolations.id, violationId));
        await tx.insert(energyViolationStatusHistory).values({ violationId, fromStatus, toStatus, changedBy: payload.actor, reason: `ACTION_${payload.status}` });
        fromStatus = toStatus;
      }
      return action;
    });
    return NextResponse.json({ item: result, violation: await readViolation(violationId) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Violation action is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not create violation action.' }, { status: 400 });
  }
}
