import { count, desc, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  energyClearanceRules,
  energySafetyRegulationDocuments,
  energySafetyRegulations,
} from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';
import { regulationSchema } from '@/lib/safety-schemas';
import { readRegulation } from '@/server/safety/regulation-readers';

export const dynamic = 'force-dynamic';

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}


function validatePayload(payload: z.infer<typeof regulationSchema>) {
  const effectiveFrom = parseDate(payload.effectiveFrom);
  const effectiveTo = parseDate(payload.effectiveTo);
  if (!effectiveFrom) return { message: 'Effective start date is invalid.', path: ['effectiveFrom'] };
  if (effectiveTo && effectiveTo.getTime() < effectiveFrom.getTime()) return { message: 'Effective end date must be after effective start date.', path: ['effectiveTo'] };
  for (const [index, rule] of payload.rules.entries()) {
    if (rule.voltageLevelFromKv != null && rule.voltageLevelToKv != null && rule.voltageLevelToKv < rule.voltageLevelFromKv) {
      return { message: 'Rule voltage range is invalid.', path: ['rules', index, 'voltageLevelToKv'] };
    }
    const ruleFrom = parseDate(rule.validFrom);
    const ruleTo = parseDate(rule.validTo);
    if (ruleTo && ruleFrom && ruleTo.getTime() < ruleFrom.getTime()) return { message: 'Rule effective end date must be after start date.', path: ['rules', index, 'validTo'] };
    if (rule.horizontalClearanceM == null && rule.verticalClearanceM == null && rule.corridorWidthM == null) {
      return { message: 'Rule needs at least one clearance or corridor width value; the system will not invent a distance.', path: ['rules', index] };
    }
  }
  const documentIds = payload.documents.map((document) => document.documentId);
  if (new Set(documentIds).size !== documentIds.length) return { message: 'A legal document cannot be attached twice to one regulation.', path: ['documents'] };
  if (payload.documents.filter((document) => document.isPrimary).length > 1) return { message: 'A regulation can have only one primary legal document.', path: ['documents'] };
  return null;
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const includeArchived = params.get('includeArchived') === 'true';
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const where = includeArchived ? undefined : ne(energySafetyRegulations.status, 'ARCHIVED');
    const listQuery = db.select().from(energySafetyRegulations)
      .where(where)
      .orderBy(desc(energySafetyRegulations.effectiveFrom), desc(energySafetyRegulations.versionNo));
    const [regulations, totalRows] = await Promise.all([
      wantsPagination ? listQuery.limit(pagination.pageSize).offset(pagination.offset) : listQuery,
      wantsPagination ? db.select({ value: count() }).from(energySafetyRegulations).where(where) : Promise.resolve([]),
    ]);
    const items = await Promise.all(regulations.map((regulation) => readRegulation(regulation.id)));
    const serialized = items.filter((item): item is NonNullable<typeof item> => Boolean(item));
    return wantsPagination
      ? paginatedResponse(serialized, pagination, Number(totalRows[0]?.value ?? 0))
      : NextResponse.json({ items: serialized });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load safety regulations.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = regulationSchema.parse(await request.json());
    const validation = validatePayload(payload);
    if (validation) return NextResponse.json({ message: validation.message, issues: [{ path: validation.path, message: validation.message }] }, { status: 400 });
    const effectiveFrom = parseDate(payload.effectiveFrom);
    const effectiveTo = parseDate(payload.effectiveTo);
    const regulation = await db.transaction(async (tx) => {
      const [created] = await tx.insert(energySafetyRegulations).values({
        code: payload.code,
        versionNo: payload.versionNo,
        name: payload.name,
        legalDocumentRef: payload.legalDocumentRef,
        effectiveFrom: effectiveFrom as Date,
        effectiveTo,
        status: payload.status,
        notes: payload.notes ?? null,
      }).returning();
      await tx.insert(energyClearanceRules).values(payload.rules.map((rule) => ({
        regulationId: created.id,
        ruleCode: rule.ruleCode ?? null,
        ruleName: rule.ruleName ?? null,
        voltageLevelKv: String(rule.voltageLevelKv),
        voltageLevelFromKv: rule.voltageLevelFromKv == null ? null : String(rule.voltageLevelFromKv),
        voltageLevelToKv: rule.voltageLevelToKv == null ? null : String(rule.voltageLevelToKv),
        lineType: rule.lineType ?? null,
        structureType: rule.structureType ?? null,
        objectType: rule.objectType ?? null,
        crossingType: rule.crossingType ?? null,
        terrainType: rule.terrainType ?? null,
        urbanRuralType: rule.urbanRuralType ?? null,
        horizontalClearanceM: rule.horizontalClearanceM == null ? null : String(rule.horizontalClearanceM),
        verticalClearanceM: rule.verticalClearanceM == null ? null : String(rule.verticalClearanceM),
        corridorWidthM: rule.corridorWidthM == null ? null : String(rule.corridorWidthM),
        measurementBasis: rule.measurementBasis ?? null,
        calculationMethod: rule.calculationMethod ?? null,
        priority: rule.priority,
        validFrom: parseDate(rule.validFrom) ?? effectiveFrom,
        validTo: parseDate(rule.validTo) ?? effectiveTo,
        metadata: { notes: rule.notes ?? null },
      })));
      if (payload.documents.length) {
        await tx.insert(energySafetyRegulationDocuments).values(payload.documents.map((document) => ({
          regulationId: created.id,
          documentId: document.documentId,
          citation: document.citation ?? null,
          isPrimary: document.isPrimary,
        })));
      }
      return created;
    });
    return NextResponse.json({ item: await readRegulation(regulation.id) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Safety regulation is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not save safety regulation.' }, { status: 400 });
  }
}
