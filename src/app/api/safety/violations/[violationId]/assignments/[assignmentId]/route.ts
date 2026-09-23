import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyViolationAssignments } from '@/db/schema';
import { db } from '@/lib/db';
import { violationAssignmentPatchSchema } from '@/lib/safety-schemas';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ violationId: string; assignmentId: string }> };
const paramsSchema = z.object({ violationId: z.string().uuid(), assignmentId: z.string().uuid() });

function parseDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function readAssignment(violationId: string, assignmentId: string) {
  const [item] = await db.select().from(energyViolationAssignments).where(sql`${energyViolationAssignments.id} = ${assignmentId}::uuid AND ${energyViolationAssignments.violationId} = ${violationId}::uuid`).limit(1);
  return item ?? null;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const params = paramsSchema.parse(await context.params);
    const item = await readAssignment(params.violationId, params.assignmentId);
    if (!item) return NextResponse.json({ message: 'Assignment not found.' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Assignment ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load assignment.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const params = paramsSchema.parse(await context.params);
    const payload = violationAssignmentPatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) return NextResponse.json({ message: 'No fields to update.' }, { status: 400 });
    const existing = await readAssignment(params.violationId, params.assignmentId);
    if (!existing) return NextResponse.json({ message: 'Assignment not found.' }, { status: 404 });
    const assignedAt = Object.prototype.hasOwnProperty.call(payload, 'assignedAt') ? parseDate(payload.assignedAt) : existing.assignedAt;
    const dueAt = Object.prototype.hasOwnProperty.call(payload, 'dueAt') ? parseDate(payload.dueAt) : existing.dueAt;
    if (!assignedAt || (payload.assignedAt && !parseDate(payload.assignedAt))) return NextResponse.json({ message: 'Assigned time is invalid.', issues: [{ path: ['assignedAt'], message: 'Invalid date.' }] }, { status: 400 });
    if (payload.dueAt && !dueAt) return NextResponse.json({ message: 'Due time is invalid.', issues: [{ path: ['dueAt'], message: 'Invalid date.' }] }, { status: 400 });
    if (dueAt && dueAt < assignedAt) return NextResponse.json({ message: 'Due time must be after assignment time.', issues: [{ path: ['dueAt'], message: 'Invalid assignment interval.' }] }, { status: 400 });
    const assignedTo = Object.prototype.hasOwnProperty.call(payload, 'assignedTo') ? payload.assignedTo : existing.assignedTo;
    const assignedTeam = Object.prototype.hasOwnProperty.call(payload, 'assignedTeam') ? payload.assignedTeam : existing.assignedTeam;
    if (payload.status === 'ACTIVE' && !assignedTo && !assignedTeam) return NextResponse.json({ message: 'Assignment needs a person or team.', issues: [{ path: ['assignedTo'], message: 'Provide an assignee or team.' }] }, { status: 400 });
    await db.update(energyViolationAssignments).set({
      ...(Object.prototype.hasOwnProperty.call(payload, 'assignedTo') ? { assignedTo: payload.assignedTo ?? null } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'assignedTeam') ? { assignedTeam: payload.assignedTeam ?? null } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'assignedAt') ? { assignedAt } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'dueAt') ? { dueAt } : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'note') ? { note: payload.note ?? null } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'createdBy') ? { createdBy: payload.createdBy ?? null } : {}),
      updatedAt: new Date(),
    }).where(eq(energyViolationAssignments.id, params.assignmentId));
    return NextResponse.json({ item: await readAssignment(params.violationId, params.assignmentId) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Assignment is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not update assignment.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const params = paramsSchema.parse(await context.params);
    const [updated] = await db.update(energyViolationAssignments).set({ status: 'CANCELLED', updatedAt: new Date() }).where(sql`${energyViolationAssignments.id} = ${params.assignmentId}::uuid AND ${energyViolationAssignments.violationId} = ${params.violationId}::uuid`).returning({ id: energyViolationAssignments.id });
    if (!updated) return NextResponse.json({ message: 'Assignment not found.' }, { status: 404 });
    return NextResponse.json({ deleted: true, cancelled: true, assignmentId: params.assignmentId });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Assignment ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not cancel assignment.' }, { status: 400 });
  }
}
