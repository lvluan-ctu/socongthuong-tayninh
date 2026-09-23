import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyCorridorViolations, energyProtectionCorridors, energyViolationStatusHistory } from '@/db/schema';
import { db } from '@/lib/db';
import { safetyViolationPatchSchema } from '@/lib/safety-schemas';
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

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { violationId } = paramsSchema.parse(await context.params);
    const item = await readViolation(violationId);
    if (!item) return NextResponse.json({ message: 'Violation not found.' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Violation ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load violation.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { violationId } = paramsSchema.parse(await context.params);
    const payload = safetyViolationPatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) return NextResponse.json({ message: 'No fields to update.' }, { status: 400 });
    const [existing] = await db.select().from(energyCorridorViolations).where(eq(energyCorridorViolations.id, violationId)).limit(1);
    if (!existing) return NextResponse.json({ message: 'Violation not found.' }, { status: 404 });
    if (payload.corridorId) {
      const [corridor] = await db.select({ id: energyProtectionCorridors.id }).from(energyProtectionCorridors).where(eq(energyProtectionCorridors.id, payload.corridorId)).limit(1);
      if (!corridor) return NextResponse.json({ message: 'Corridor not found.', issues: [{ path: ['corridorId'], message: 'Choose an existing corridor.' }] }, { status: 404 });
    }
    const locationFields = Object.prototype.hasOwnProperty.call(payload, 'latitude') || Object.prototype.hasOwnProperty.call(payload, 'longitude');
    if (locationFields && ((payload.latitude == null) !== (payload.longitude == null))) return NextResponse.json({ message: 'Location needs latitude and longitude together.', issues: [{ path: ['longitude'], message: 'Provide both coordinates.' }] }, { status: 400 });
    if (payload.status && payload.status !== existing.status && payload.status !== 'ARCHIVED' && !canTransitionViolation(existing.status, payload.status)) {
      return NextResponse.json({ message: `Invalid violation status transition ${existing.status} -> ${payload.status}.`, issues: [{ path: ['status'], message: 'Use the workflow actions in order.' }] }, { status: 400 });
    }
    const currentEvidence = existing.evidence ?? {};
    const currentSource = typeof currentEvidence === 'object' && currentEvidence && 'source' in currentEvidence ? String((currentEvidence as Record<string, unknown>).source ?? '') : '';
    const nextHumanReviewRequired = payload.humanReviewRequired ?? (payload.source === 'AI_VISION' ? true : existing.humanReviewRequired);
    if (payload.status && payload.status !== existing.status && isReviewPending(existing.status, existing.humanReviewRequired || currentSource === 'AI_VISION', existing.reviewedAt) && !['DETECTED', 'PENDING_REVIEW', 'ARCHIVED'].includes(payload.status)) {
      return NextResponse.json({ message: 'AI violation needs human review before workflow progression.', issues: [{ path: ['status'], message: 'Verify or confirm the AI detection first.' }] }, { status: 400 });
    }
    if (payload.source === 'AI_VISION' && payload.status && !['DETECTED', 'PENDING_REVIEW'].includes(payload.status)) {
      return NextResponse.json({ message: 'AI detections must remain pending human review.', issues: [{ path: ['status'], message: 'Use DETECTED or PENDING_REVIEW until a human reviews it.' }] }, { status: 400 });
    }
    const detectedAt = payload.detectedAt ? parseDate(payload.detectedAt) : existing.detectedAt;
    if (!detectedAt) return NextResponse.json({ message: 'Detected time is invalid.', issues: [{ path: ['detectedAt'], message: 'Invalid date.' }] }, { status: 400 });
    const evidenceProvided = payload.evidenceRefs !== undefined || payload.source !== undefined || payload.aiLabel !== undefined || payload.aiConfidencePct !== undefined || payload.notes !== undefined;
    const evidence = evidenceProvided ? {
      ...(typeof currentEvidence === 'object' && currentEvidence ? currentEvidence : {}),
      ...(payload.evidenceRefs !== undefined ? { refs: payload.evidenceRefs } : {}),
      ...(payload.source !== undefined ? { source: payload.source } : {}),
      ...(payload.aiLabel !== undefined || payload.aiConfidencePct !== undefined ? { ai: { label: payload.aiLabel ?? null, confidencePct: payload.aiConfidencePct ?? null } } : {}),
      ...(payload.notes !== undefined ? { notes: payload.notes ?? null } : {}),
    } : undefined;
    await db.transaction(async (tx) => {
      await tx.update(energyCorridorViolations).set({
        ...(payload.corridorId !== undefined ? { corridorId: payload.corridorId } : {}),
        ...(payload.code !== undefined ? { code: payload.code } : {}),
        ...(payload.violationType !== undefined ? { violationType: payload.violationType } : {}),
        ...(payload.severity !== undefined ? { severity: payload.severity } : {}),
        ...(payload.detectedAt !== undefined ? { detectedAt } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(payload.distanceM !== undefined ? { distanceM: payload.distanceM == null ? null : String(payload.distanceM) } : {}),
        ...(evidenceProvided ? { evidence } : {}),
        ...(payload.humanReviewRequired !== undefined || payload.source !== undefined ? { humanReviewRequired: nextHumanReviewRequired } : {}),
        ...(payload.status === 'CLOSED' ? { closedAt: existing.closedAt ?? new Date() } : payload.status && payload.status !== 'ARCHIVED' ? { closedAt: null } : {}),
        updatedAt: new Date(),
      }).where(eq(energyCorridorViolations.id, violationId));
      if (locationFields) {
        await tx.execute(sql`UPDATE energy_corridor_violations SET location = CASE WHEN ${payload.latitude == null ? null : `SRID=4326;POINT(${payload.longitude} ${payload.latitude})`}::text IS NULL THEN NULL ELSE ST_GeogFromText(${payload.latitude == null ? null : `SRID=4326;POINT(${payload.longitude} ${payload.latitude})`}::text) END, updated_at = CURRENT_TIMESTAMP WHERE id = ${violationId}::uuid`);
      }
      if (payload.status && payload.status !== existing.status) {
        await tx.insert(energyViolationStatusHistory).values({ violationId, fromStatus: existing.status, toStatus: payload.status, changedBy: payload.changedBy ?? null, reason: payload.reason ?? null });
      }
    });
    return NextResponse.json({ item: await readViolation(violationId) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Violation is invalid.', issues: error.issues }, { status: 400 });
    const message = error instanceof Error ? error.message : 'Could not update violation.';
    return NextResponse.json({ message }, { status: message.includes('energy_corridor_violations_code_uq') ? 409 : 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { violationId } = paramsSchema.parse(await context.params);
    const [existing] = await db.select({ id: energyCorridorViolations.id, status: energyCorridorViolations.status }).from(energyCorridorViolations).where(eq(energyCorridorViolations.id, violationId)).limit(1);
    if (!existing) return NextResponse.json({ message: 'Violation not found.' }, { status: 404 });
    await db.transaction(async (tx) => {
      await tx.update(energyCorridorViolations).set({ status: 'ARCHIVED', updatedAt: new Date() }).where(eq(energyCorridorViolations.id, violationId));
      if (existing.status !== 'ARCHIVED') await tx.insert(energyViolationStatusHistory).values({ violationId, fromStatus: existing.status, toStatus: 'ARCHIVED', changedBy: null, reason: 'VIOLATION_ARCHIVED' });
    });
    return NextResponse.json({ deleted: true, archived: true, violationId });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Violation ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not archive violation.' }, { status: 400 });
  }
}
