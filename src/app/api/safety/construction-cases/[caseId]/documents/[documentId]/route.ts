import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyConstructionCaseDocuments } from '@/db/schema';
import { db } from '@/lib/db';
import { constructionCaseDocumentPatchSchema } from '@/lib/safety-schemas';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ caseId: string; documentId: string }> };
const paramsSchema = z.object({ caseId: z.string().uuid(), documentId: z.string().uuid() });

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { caseId, documentId } = paramsSchema.parse(await context.params);
    const payload = constructionCaseDocumentPatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) return NextResponse.json({ message: 'No fields to update.' }, { status: 400 });
    const [existing] = await db.select().from(energyConstructionCaseDocuments).where(and(eq(energyConstructionCaseDocuments.id, documentId), eq(energyConstructionCaseDocuments.caseId, caseId))).limit(1);
    if (!existing) return NextResponse.json({ message: 'Case document not found.' }, { status: 404 });
    await db.update(energyConstructionCaseDocuments).set({
      ...(payload.documentType !== undefined ? { documentType: payload.documentType } : {}),
      ...(payload.title !== undefined ? { title: payload.title } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'fileRef') ? { fileRef: payload.fileRef ?? null } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'sourceUrl') ? { sourceUrl: payload.sourceUrl ?? null } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'checksum') ? { checksum: payload.checksum ?? null } : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'notes') ? { notes: payload.notes ?? null } : {}),
      ...(payload.metadata !== undefined ? { metadata: payload.metadata } : {}),
    }).where(eq(energyConstructionCaseDocuments.id, documentId));
    const [item] = await db.select().from(energyConstructionCaseDocuments).where(eq(energyConstructionCaseDocuments.id, documentId)).limit(1);
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Case document is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not update case document.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { caseId, documentId } = paramsSchema.parse(await context.params);
    const [updated] = await db.update(energyConstructionCaseDocuments).set({ status: 'ARCHIVED' })
      .where(and(eq(energyConstructionCaseDocuments.id, documentId), eq(energyConstructionCaseDocuments.caseId, caseId))).returning({ id: energyConstructionCaseDocuments.id });
    if (!updated) return NextResponse.json({ message: 'Case document not found.' }, { status: 404 });
    return NextResponse.json({ deleted: true, archived: true, documentId });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Document ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not archive case document.' }, { status: 400 });
  }
}
