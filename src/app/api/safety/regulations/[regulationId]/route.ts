import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyClearanceRules, energySafetyRegulationDocuments, energySafetyRegulations } from '@/db/schema';
import { db } from '@/lib/db';
import { regulationPatchSchema, regulationSchema } from '@/lib/safety-schemas';
import { readRegulation } from '@/server/safety/regulation-readers';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ regulationId: string }> };
const paramsSchema = z.object({ regulationId: z.string().uuid() });

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function inputDate(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function validateRange(effectiveFrom: Date | null, effectiveTo: Date | null) {
  return !effectiveFrom || !effectiveTo || effectiveTo.getTime() >= effectiveFrom.getTime();
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { regulationId } = paramsSchema.parse(await context.params);
    const item = await readRegulation(regulationId);
    if (!item) return NextResponse.json({ message: 'Safety regulation not found.' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Regulation ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load safety regulation.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { regulationId } = paramsSchema.parse(await context.params);
    const payload = regulationPatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) return NextResponse.json({ message: 'No fields to update.' }, { status: 400 });
    const existing = await readRegulation(regulationId);
    if (!existing) return NextResponse.json({ message: 'Safety regulation not found.' }, { status: 404 });

    const merged = regulationSchema.parse({
      code: payload.code ?? existing.code,
      versionNo: payload.versionNo ?? existing.versionNo,
      name: payload.name ?? existing.name,
      legalDocumentRef: payload.legalDocumentRef ?? existing.legalDocumentRef,
      effectiveFrom: inputDate(payload.effectiveFrom ?? existing.effectiveFrom) as string,
      effectiveTo: Object.prototype.hasOwnProperty.call(payload, 'effectiveTo') ? payload.effectiveTo : inputDate(existing.effectiveTo),
      status: payload.status ?? existing.status,
      notes: Object.prototype.hasOwnProperty.call(payload, 'notes') ? payload.notes : existing.notes,
      documents: payload.documents ?? existing.documents.map((document) => ({
        documentId: document.documentId,
        citation: document.citation,
        isPrimary: document.isPrimary,
      })),
      rules: payload.rules ?? existing.rules.map((rule) => ({
        id: rule.id,
        ruleCode: rule.ruleCode,
        ruleName: rule.ruleName,
        voltageLevelKv: Number(rule.voltageLevelKv),
        voltageLevelFromKv: rule.voltageLevelFromKv == null ? null : Number(rule.voltageLevelFromKv),
        voltageLevelToKv: rule.voltageLevelToKv == null ? null : Number(rule.voltageLevelToKv),
        lineType: rule.lineType,
        structureType: rule.structureType,
        objectType: rule.objectType,
        crossingType: rule.crossingType,
        terrainType: rule.terrainType,
        urbanRuralType: rule.urbanRuralType,
        horizontalClearanceM: rule.horizontalClearanceM == null ? null : Number(rule.horizontalClearanceM),
        verticalClearanceM: rule.verticalClearanceM == null ? null : Number(rule.verticalClearanceM),
        corridorWidthM: rule.corridorWidthM == null ? null : Number(rule.corridorWidthM),
        measurementBasis: rule.measurementBasis,
        calculationMethod: rule.calculationMethod,
        priority: rule.priority,
        validFrom: inputDate(rule.validFrom),
        validTo: inputDate(rule.validTo),
        notes: rule.notes,
      })),
    });
    const effectiveFrom = parseDate(merged.effectiveFrom);
    const effectiveTo = parseDate(merged.effectiveTo);
    if (!effectiveFrom || !validateRange(effectiveFrom, effectiveTo)) return NextResponse.json({ message: 'Regulation effective date range is invalid.', issues: [{ path: ['effectiveTo'], message: 'Effective end date must be after start date.' }] }, { status: 400 });
    for (const [index, rule] of merged.rules.entries()) {
      const ruleFrom = parseDate(rule.validFrom) ?? effectiveFrom;
      const ruleTo = parseDate(rule.validTo) ?? effectiveTo;
      if (rule.voltageLevelFromKv != null && rule.voltageLevelToKv != null && rule.voltageLevelToKv < rule.voltageLevelFromKv) return NextResponse.json({ message: 'Rule voltage range is invalid.', issues: [{ path: ['rules', index, 'voltageLevelToKv'], message: 'Voltage end must be >= voltage start.' }] }, { status: 400 });
      if (rule.horizontalClearanceM == null && rule.verticalClearanceM == null && rule.corridorWidthM == null) return NextResponse.json({ message: 'Rule needs a clearance or corridor width value.', issues: [{ path: ['rules', index], message: 'The system will not invent a distance.' }] }, { status: 400 });
      if (!validateRange(ruleFrom, ruleTo)) return NextResponse.json({ message: 'Rule effective date range is invalid.', issues: [{ path: ['rules', index, 'validTo'], message: 'Effective end date must be after start date.' }] }, { status: 400 });
    }
    if (new Set(merged.documents.map((document) => document.documentId)).size !== merged.documents.length) return NextResponse.json({ message: 'A legal document cannot be attached twice to one regulation.', issues: [{ path: ['documents'], message: 'Duplicate document.' }] }, { status: 400 });
    if (merged.documents.filter((document) => document.isPrimary).length > 1) return NextResponse.json({ message: 'A regulation can have only one primary legal document.', issues: [{ path: ['documents'], message: 'Multiple primary documents.' }] }, { status: 400 });

    const existingRuleIds = new Set(existing.rules.map((rule) => rule.id));
    if (payload.rules) {
      const incomingRuleIds = new Set(payload.rules.flatMap((rule) => rule.id ? [rule.id] : []));
      const omittedRule = existing.rules.find((rule) => !incomingRuleIds.has(rule.id));
      if (omittedRule) return NextResponse.json({ message: 'Do not implicitly delete a rule referenced by history. Delete it explicitly through the rule endpoint.', issues: [{ path: ['rules'], message: `Rule ${omittedRule.id} is missing.` }] }, { status: 409 });
      const unknownRule = payload.rules.find((rule) => rule.id && !existingRuleIds.has(rule.id));
      if (unknownRule) return NextResponse.json({ message: 'Rule does not belong to this regulation.', issues: [{ path: ['rules'], message: 'Unknown rule ID.' }] }, { status: 400 });
    }

    await db.transaction(async (tx) => {
      await tx.update(energySafetyRegulations).set({
        ...(payload.code !== undefined ? { code: payload.code } : {}),
        ...(payload.versionNo !== undefined ? { versionNo: payload.versionNo } : {}),
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.legalDocumentRef !== undefined ? { legalDocumentRef: payload.legalDocumentRef } : {}),
        ...(payload.effectiveFrom !== undefined ? { effectiveFrom: effectiveFrom as Date } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'effectiveTo') ? { effectiveTo } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'notes') ? { notes: payload.notes ?? null } : {}),
        updatedAt: new Date(),
      }).where(eq(energySafetyRegulations.id, regulationId));

      if (payload.documents) {
        await tx.delete(energySafetyRegulationDocuments).where(eq(energySafetyRegulationDocuments.regulationId, regulationId));
        if (payload.documents.length) await tx.insert(energySafetyRegulationDocuments).values(payload.documents.map((document) => ({
          regulationId,
          documentId: document.documentId,
          citation: document.citation ?? null,
          isPrimary: document.isPrimary,
        })));
      }

      if (payload.rules) {
        for (const rule of payload.rules) {
          const values = {
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
            updatedAt: new Date(),
          };
          if (rule.id) await tx.update(energyClearanceRules).set(values).where(eq(energyClearanceRules.id, rule.id));
          else await tx.insert(energyClearanceRules).values({ regulationId, ...values });
        }
      }
    });
    return NextResponse.json({ item: await readRegulation(regulationId) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Safety regulation is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not update safety regulation.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { regulationId } = paramsSchema.parse(await context.params);
    const [updated] = await db.update(energySafetyRegulations).set({ status: 'ARCHIVED', updatedAt: new Date() })
      .where(eq(energySafetyRegulations.id, regulationId)).returning({ id: energySafetyRegulations.id });
    if (!updated) return NextResponse.json({ message: 'Safety regulation not found.' }, { status: 404 });
    return NextResponse.json({ deleted: true, archived: true, regulationId });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Regulation ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not archive safety regulation.' }, { status: 400 });
  }
}
