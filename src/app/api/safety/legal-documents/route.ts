import { and, count, desc, eq, inArray, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energySafetyLegalDocuments, energySafetyRegulationDocuments, energySafetyRegulations } from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';
import { legalDocumentSchema } from '@/lib/safety-schemas';

export const dynamic = 'force-dynamic';

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function validateRange(effectiveFrom: Date | null, effectiveTo: Date | null) {
  return !effectiveFrom || !effectiveTo || effectiveTo.getTime() >= effectiveFrom.getTime();
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const where = ne(energySafetyLegalDocuments.status, 'ARCHIVED');
    const listQuery = db.select().from(energySafetyLegalDocuments)
      .where(where)
      .orderBy(desc(energySafetyLegalDocuments.effectiveFrom), desc(energySafetyLegalDocuments.createdAt));
    const [documents, totalRows] = await Promise.all([
      wantsPagination ? listQuery.limit(pagination.pageSize).offset(pagination.offset) : listQuery,
      wantsPagination ? db.select({ value: count() }).from(energySafetyLegalDocuments).where(where) : Promise.resolve([]),
    ]);
    const documentIds = documents.map((document) => document.id);
    const references = documentIds.length ? await db.select({
        documentId: energySafetyRegulationDocuments.documentId,
        regulationId: energySafetyRegulations.id,
        regulationCode: energySafetyRegulations.code,
        regulationName: energySafetyRegulations.name,
        regulationVersionNo: energySafetyRegulations.versionNo,
        citation: energySafetyRegulationDocuments.citation,
        isPrimary: energySafetyRegulationDocuments.isPrimary,
      }).from(energySafetyRegulationDocuments)
        .innerJoin(energySafetyLegalDocuments, eq(energySafetyLegalDocuments.id, energySafetyRegulationDocuments.documentId))
        .innerJoin(energySafetyRegulations, eq(energySafetyRegulations.id, energySafetyRegulationDocuments.regulationId))
        .where(and(ne(energySafetyRegulations.status, 'ARCHIVED'), inArray(energySafetyRegulationDocuments.documentId, documentIds))) : [];
    const items = documents.map((document) => ({
        ...document,
        references: references.filter((reference) => reference.documentId === document.id),
      }));
    return wantsPagination
      ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0))
      : NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load safety legal documents.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = legalDocumentSchema.parse(await request.json());
    const effectiveFrom = parseDate(payload.effectiveFrom);
    const effectiveTo = parseDate(payload.effectiveTo);
    if (!validateRange(effectiveFrom, effectiveTo)) {
      return NextResponse.json({ message: 'Effective end date must be after effective start date.', issues: [{ path: ['effectiveTo'], message: 'Invalid effective date range.' }] }, { status: 400 });
    }
    const [created] = await db.insert(energySafetyLegalDocuments).values({
      code: payload.code,
      documentNo: payload.documentNo,
      title: payload.title,
      documentType: payload.documentType,
      issuingAuthority: payload.issuingAuthority,
      issuedAt: parseDate(payload.issuedAt),
      effectiveFrom,
      effectiveTo,
      status: payload.status,
      fileRef: payload.fileRef ?? null,
      sourceUrl: payload.sourceUrl ?? null,
      checksum: payload.checksum ?? null,
      notes: payload.notes ?? null,
    }).returning();
    return NextResponse.json({ item: created }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Legal document is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not save legal document.' }, { status: 400 });
  }
}
