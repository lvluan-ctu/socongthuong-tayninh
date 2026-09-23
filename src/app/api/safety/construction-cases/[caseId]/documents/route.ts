import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyConstructionCaseDocuments, energyConstructionCases } from '@/db/schema';
import { db } from '@/lib/db';
import { constructionCaseDocumentSchema } from '@/lib/safety-schemas';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ caseId: string }> };
const paramsSchema = z.object({ caseId: z.string().uuid() });

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { caseId } = paramsSchema.parse(await context.params);
    const [parent] = await db.select({ id: energyConstructionCases.id }).from(energyConstructionCases).where(eq(energyConstructionCases.id, caseId)).limit(1);
    if (!parent) return NextResponse.json({ message: 'Construction case not found.' }, { status: 404 });
    return NextResponse.json({ items: await db.select().from(energyConstructionCaseDocuments).where(eq(energyConstructionCaseDocuments.caseId, caseId)).orderBy(desc(energyConstructionCaseDocuments.uploadedAt)) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Case ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load case documents.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { caseId } = paramsSchema.parse(await context.params);
    const payload = constructionCaseDocumentSchema.parse(await request.json());
    const [parent] = await db.select({ id: energyConstructionCases.id }).from(energyConstructionCases).where(eq(energyConstructionCases.id, caseId)).limit(1);
    if (!parent) return NextResponse.json({ message: 'Construction case not found.' }, { status: 404 });
    const [created] = await db.insert(energyConstructionCaseDocuments).values({
      caseId, documentType: payload.documentType, title: payload.title, fileRef: payload.fileRef ?? null,
      sourceUrl: payload.sourceUrl ?? null, checksum: payload.checksum ?? null, status: payload.status,
      notes: payload.notes ?? null, metadata: payload.metadata ?? {},
    }).returning();
    return NextResponse.json({ item: created }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Case document is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not save case document.' }, { status: 400 });
  }
}
