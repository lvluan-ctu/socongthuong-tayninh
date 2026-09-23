import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energySafetyLegalDocuments } from '@/db/schema';
import { db } from '@/lib/db';
import { legalDocumentPatchSchema } from '@/lib/safety-schemas';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ documentId: string }> };
const paramsSchema = z.object({ documentId: z.string().uuid() });

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { documentId } = paramsSchema.parse(await context.params);
    const [item] = await db.select().from(energySafetyLegalDocuments).where(eq(energySafetyLegalDocuments.id, documentId)).limit(1);
    if (!item) return NextResponse.json({ message: 'Legal document not found.' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Legal document ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load legal document.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { documentId } = paramsSchema.parse(await context.params);
    const payload = legalDocumentPatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) return NextResponse.json({ message: 'No fields to update.' }, { status: 400 });
    const [existing] = await db.select().from(energySafetyLegalDocuments).where(eq(energySafetyLegalDocuments.id, documentId)).limit(1);
    if (!existing) return NextResponse.json({ message: 'Legal document not found.' }, { status: 404 });
    const effectiveFrom = Object.prototype.hasOwnProperty.call(payload, 'effectiveFrom') ? parseDate(payload.effectiveFrom) : existing.effectiveFrom;
    const effectiveTo = Object.prototype.hasOwnProperty.call(payload, 'effectiveTo') ? parseDate(payload.effectiveTo) : existing.effectiveTo;
    if (!(!effectiveFrom || !effectiveTo || effectiveTo.getTime() >= effectiveFrom.getTime())) {
      return NextResponse.json({ message: 'Effective end date must be after effective start date.', issues: [{ path: ['effectiveTo'], message: 'Invalid effective date range.' }] }, { status: 400 });
    }
    const [updated] = await db.update(energySafetyLegalDocuments).set({
      ...(payload.code !== undefined ? { code: payload.code } : {}),
      ...(payload.documentNo !== undefined ? { documentNo: payload.documentNo } : {}),
      ...(payload.title !== undefined ? { title: payload.title } : {}),
      ...(payload.documentType !== undefined ? { documentType: payload.documentType } : {}),
      ...(payload.issuingAuthority !== undefined ? { issuingAuthority: payload.issuingAuthority } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'issuedAt') ? { issuedAt: parseDate(payload.issuedAt) } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'effectiveFrom') ? { effectiveFrom } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'effectiveTo') ? { effectiveTo } : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'fileRef') ? { fileRef: payload.fileRef ?? null } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'sourceUrl') ? { sourceUrl: payload.sourceUrl ?? null } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'checksum') ? { checksum: payload.checksum ?? null } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'notes') ? { notes: payload.notes ?? null } : {}),
      updatedAt: new Date(),
    }).where(eq(energySafetyLegalDocuments.id, documentId)).returning();
    return NextResponse.json({ item: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Legal document is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not update legal document.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { documentId } = paramsSchema.parse(await context.params);
    const [updated] = await db.update(energySafetyLegalDocuments).set({ status: 'ARCHIVED', updatedAt: new Date() })
      .where(eq(energySafetyLegalDocuments.id, documentId)).returning({ id: energySafetyLegalDocuments.id });
    if (!updated) return NextResponse.json({ message: 'Legal document not found.' }, { status: 404 });
    return NextResponse.json({ deleted: true, archived: true, documentId });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Legal document ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not archive legal document.' }, { status: 400 });
  }
}
