import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyConstructionCases, energyConstructionCaseStatusHistory } from '@/db/schema';
import { db } from '@/lib/db';
import { constructionCasePatchSchema } from '@/lib/safety-schemas';
import { readConstructionCase } from '@/lib/construction-case-api';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ caseId: string }> };
const paramsSchema = z.object({ caseId: z.string().uuid() });

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { caseId } = paramsSchema.parse(await context.params);
    const item = await readConstructionCase(caseId);
    if (!item) return NextResponse.json({ message: 'Construction case not found.' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Case ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load construction case.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { caseId } = paramsSchema.parse(await context.params);
    const payload = constructionCasePatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) return NextResponse.json({ message: 'No fields to update.' }, { status: 400 });
    const [existing] = await db.select().from(energyConstructionCases).where(eq(energyConstructionCases.id, caseId)).limit(1);
    if (!existing) return NextResponse.json({ message: 'Construction case not found.' }, { status: 404 });
    const geometryProvided = Object.prototype.hasOwnProperty.call(payload, 'proposedGeometry');
    const geometryJson = payload.proposedGeometry ? JSON.stringify(payload.proposedGeometry) : null;
    await db.transaction(async (tx) => {
      await tx.update(energyConstructionCases).set({
        ...(payload.caseCode !== undefined ? { caseCode: payload.caseCode } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'applicantName') ? { applicantName: payload.applicantName ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'applicantOrganization') ? { applicantOrganization: payload.applicantOrganization ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'address') ? { address: payload.address ?? null } : {}),
        ...(payload.projectType !== undefined ? { projectType: payload.projectType } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'description') ? { description: payload.description ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'siteId') ? { siteId: payload.siteId ?? null } : {}),
        ...(payload.geometrySource !== undefined ? { geometrySource: payload.geometrySource } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'sourceRef') ? { sourceRef: payload.sourceRef ?? null } : {}),
        ...(payload.metadata !== undefined ? { metadata: payload.metadata } : {}),
        updatedAt: new Date(),
      }).where(eq(energyConstructionCases.id, caseId));
      if (geometryProvided) {
        await tx.execute(sql`
          UPDATE energy_construction_cases
          SET proposed_geometry = CASE WHEN ${geometryJson}::text IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON(${geometryJson}::text), 4326) END,
              updated_at = ${new Date()}
          WHERE id = ${caseId}::uuid
        `);
      }
      if (payload.status && payload.status !== existing.status) {
        await tx.insert(energyConstructionCaseStatusHistory).values({ caseId, fromStatus: existing.status, toStatus: payload.status, changedBy: payload.changedBy ?? null, reason: payload.reason ?? null });
      }
    });
    return NextResponse.json({ item: await readConstructionCase(caseId) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Construction case is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not update construction case.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { caseId } = paramsSchema.parse(await context.params);
    const [existing] = await db.select({ id: energyConstructionCases.id, status: energyConstructionCases.status }).from(energyConstructionCases).where(eq(energyConstructionCases.id, caseId)).limit(1);
    if (!existing) return NextResponse.json({ message: 'Construction case not found.' }, { status: 404 });
    await db.transaction(async (tx) => {
      await tx.update(energyConstructionCases).set({ status: 'ARCHIVED', updatedAt: new Date() }).where(eq(energyConstructionCases.id, caseId));
      if (existing.status !== 'ARCHIVED') await tx.insert(energyConstructionCaseStatusHistory).values({ caseId, fromStatus: existing.status, toStatus: 'ARCHIVED', changedBy: null, reason: 'CASE_ARCHIVED' });
    });
    return NextResponse.json({ deleted: true, archived: true, caseId });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Case ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not archive construction case.' }, { status: 400 });
  }
}
