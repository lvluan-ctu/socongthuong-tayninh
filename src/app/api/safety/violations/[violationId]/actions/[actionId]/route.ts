import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyCorridorViolations, energyViolationActions, energyViolationStatusHistory } from '@/db/schema';
import { db } from '@/lib/db';
import { violationActionPatchSchema } from '@/lib/safety-schemas';
import { actionWorkflowChanges } from '@/server/safety/violation-workflow';
import { readViolation } from '@/server/safety/violation-readers';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ violationId: string; actionId: string }> };
const paramsSchema = z.object({ violationId: z.string().uuid(), actionId: z.string().uuid() });

function parseDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function readAction(violationId: string, actionId: string) {
  const [item] = await db.select().from(energyViolationActions).where(sql`${energyViolationActions.id} = ${actionId}::uuid AND ${energyViolationActions.violationId} = ${violationId}::uuid`).limit(1);
  return item ?? null;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const params = paramsSchema.parse(await context.params);
    const item = await readAction(params.violationId, params.actionId);
    if (!item) return NextResponse.json({ message: 'Violation action not found.' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Action ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load violation action.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const params = paramsSchema.parse(await context.params);
    const payload = violationActionPatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) return NextResponse.json({ message: 'No fields to update.' }, { status: 400 });
    const existing = await readAction(params.violationId, params.actionId);
    if (!existing) return NextResponse.json({ message: 'Violation action not found.' }, { status: 404 });
    const [violation] = await db.select().from(energyCorridorViolations).where(eq(energyCorridorViolations.id, params.violationId)).limit(1);
    if (!violation) return NextResponse.json({ message: 'Violation not found.' }, { status: 404 });
    const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(payload, key);
    const now = new Date();
    const plannedAt = hasOwn('plannedAt') ? parseDate(payload.plannedAt) : existing.plannedAt;
    const finalStatus = payload.status ?? existing.status;
    const startedAt = hasOwn('startedAt') ? parseDate(payload.startedAt) : existing.startedAt ?? (finalStatus === 'IN_PROGRESS' || finalStatus === 'COMPLETED' ? now : null);
    const completedAt = hasOwn('completedAt') ? parseDate(payload.completedAt) : existing.completedAt ?? (finalStatus === 'COMPLETED' ? now : null);
    if ((payload.plannedAt && !plannedAt) || (payload.startedAt && !startedAt) || (payload.completedAt && !completedAt)) return NextResponse.json({ message: 'Action time is invalid.', issues: [{ path: ['completedAt'], message: 'Provide valid dates.' }] }, { status: 400 });
    if (plannedAt && startedAt && startedAt < plannedAt) return NextResponse.json({ message: 'Start time must be after planned time.', issues: [{ path: ['startedAt'], message: 'Invalid action interval.' }] }, { status: 400 });
    if (startedAt && completedAt && completedAt < startedAt) return NextResponse.json({ message: 'Completion time must be after start time.', issues: [{ path: ['completedAt'], message: 'Invalid action interval.' }] }, { status: 400 });
    const changes = actionWorkflowChanges(violation, finalStatus);
    if (changes === null) return NextResponse.json({ message: 'Action cannot advance this violation yet.', issues: [{ path: ['status'], message: 'Review the violation first or use a valid workflow action.' }] }, { status: 400 });
    await db.transaction(async (tx) => {
      await tx.update(energyViolationActions).set({
        ...(payload.actionType !== undefined ? { actionType: payload.actionType } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(hasOwn('plannedAt') ? { plannedAt } : {}),
        ...(hasOwn('startedAt') || (finalStatus !== existing.status && startedAt !== existing.startedAt) ? { startedAt } : {}),
        ...(hasOwn('completedAt') || (finalStatus === 'COMPLETED' && !existing.completedAt) ? { completedAt } : {}),
        ...(payload.actor !== undefined ? { actor: payload.actor } : {}),
        ...(hasOwn('note') ? { note: payload.note ?? null } : {}),
        ...(payload.beforeEvidence !== undefined ? { beforeEvidence: payload.beforeEvidence } : {}),
        ...(payload.afterEvidence !== undefined ? { afterEvidence: payload.afterEvidence } : {}),
        updatedAt: now,
      }).where(eq(energyViolationActions.id, params.actionId));
      let fromStatus = violation.status;
      for (const toStatus of changes) {
        await tx.update(energyCorridorViolations).set({ status: toStatus, updatedAt: now, closedAt: null }).where(eq(energyCorridorViolations.id, params.violationId));
        await tx.insert(energyViolationStatusHistory).values({ violationId: params.violationId, fromStatus, toStatus, changedBy: payload.actor ?? existing.actor, reason: `ACTION_${finalStatus}` });
        fromStatus = toStatus;
      }
    });
    return NextResponse.json({ item: await readAction(params.violationId, params.actionId), violation: await readViolation(params.violationId) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Violation action is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not update violation action.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const params = paramsSchema.parse(await context.params);
    const [updated] = await db.update(energyViolationActions).set({ status: 'CANCELLED', updatedAt: new Date() }).where(sql`${energyViolationActions.id} = ${params.actionId}::uuid AND ${energyViolationActions.violationId} = ${params.violationId}::uuid`).returning({ id: energyViolationActions.id });
    if (!updated) return NextResponse.json({ message: 'Violation action not found.' }, { status: 404 });
    return NextResponse.json({ deleted: true, cancelled: true, actionId: params.actionId });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Action ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not cancel violation action.' }, { status: 400 });
  }
}
