import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyClearanceRules, energyConstructionClearanceChecks, energyProtectionCorridors } from '@/db/schema';
import { db } from '@/lib/db';
import { clearanceRulePatchSchema, clearanceRuleSchema } from '@/lib/safety-schemas';
import { readRegulation } from '@/server/safety/regulation-readers';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ regulationId: string; ruleId: string }> };
const paramsSchema = z.object({ regulationId: z.string().uuid(), ruleId: z.string().uuid() });

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function validateRule(rule: z.infer<typeof clearanceRuleSchema>) {
  if (rule.horizontalClearanceM == null && rule.verticalClearanceM == null && rule.corridorWidthM == null) return 'Rule needs a clearance or corridor width value; the system will not invent a distance.';
  if (rule.voltageLevelFromKv != null && rule.voltageLevelToKv != null && rule.voltageLevelToKv < rule.voltageLevelFromKv) return 'Rule voltage end must be greater than or equal to voltage start.';
  const validFrom = parseDate(rule.validFrom);
  const validTo = parseDate(rule.validTo);
  if (validFrom && validTo && validTo.getTime() < validFrom.getTime()) return 'Rule effective end date must be after start date.';
  return null;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { regulationId, ruleId } = paramsSchema.parse(await context.params);
    const payload = clearanceRulePatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) return NextResponse.json({ message: 'No fields to update.' }, { status: 400 });
    const [existing] = await db.select().from(energyClearanceRules).where(and(eq(energyClearanceRules.id, ruleId), eq(energyClearanceRules.regulationId, regulationId))).limit(1);
    if (!existing) return NextResponse.json({ message: 'Clearance rule not found.' }, { status: 404 });
    const metadata = (existing.metadata ?? {}) as Record<string, unknown>;
    const full = clearanceRuleSchema.parse({
      ruleCode: payload.ruleCode !== undefined ? payload.ruleCode : existing.ruleCode,
      ruleName: payload.ruleName !== undefined ? payload.ruleName : existing.ruleName,
      voltageLevelKv: payload.voltageLevelKv ?? Number(existing.voltageLevelKv),
      voltageLevelFromKv: Object.prototype.hasOwnProperty.call(payload, 'voltageLevelFromKv') ? payload.voltageLevelFromKv : (existing.voltageLevelFromKv == null ? null : Number(existing.voltageLevelFromKv)),
      voltageLevelToKv: Object.prototype.hasOwnProperty.call(payload, 'voltageLevelToKv') ? payload.voltageLevelToKv : (existing.voltageLevelToKv == null ? null : Number(existing.voltageLevelToKv)),
      lineType: payload.lineType !== undefined ? payload.lineType : existing.lineType,
      structureType: payload.structureType !== undefined ? payload.structureType : existing.structureType,
      objectType: payload.objectType !== undefined ? payload.objectType : existing.objectType,
      crossingType: payload.crossingType !== undefined ? payload.crossingType : existing.crossingType,
      terrainType: payload.terrainType !== undefined ? payload.terrainType : existing.terrainType,
      urbanRuralType: payload.urbanRuralType !== undefined ? payload.urbanRuralType : existing.urbanRuralType,
      horizontalClearanceM: Object.prototype.hasOwnProperty.call(payload, 'horizontalClearanceM') ? payload.horizontalClearanceM : (existing.horizontalClearanceM == null ? null : Number(existing.horizontalClearanceM)),
      verticalClearanceM: Object.prototype.hasOwnProperty.call(payload, 'verticalClearanceM') ? payload.verticalClearanceM : (existing.verticalClearanceM == null ? null : Number(existing.verticalClearanceM)),
      corridorWidthM: Object.prototype.hasOwnProperty.call(payload, 'corridorWidthM') ? payload.corridorWidthM : (existing.corridorWidthM == null ? null : Number(existing.corridorWidthM)),
      measurementBasis: payload.measurementBasis !== undefined ? payload.measurementBasis : existing.measurementBasis,
      calculationMethod: payload.calculationMethod !== undefined ? payload.calculationMethod : existing.calculationMethod,
      priority: payload.priority ?? existing.priority,
      validFrom: Object.prototype.hasOwnProperty.call(payload, 'validFrom') ? payload.validFrom : existing.validFrom?.toISOString(),
      validTo: Object.prototype.hasOwnProperty.call(payload, 'validTo') ? payload.validTo : existing.validTo?.toISOString(),
      notes: Object.prototype.hasOwnProperty.call(payload, 'notes') ? payload.notes : (typeof metadata.notes === 'string' ? metadata.notes : null),
    });
    const message = validateRule(full);
    if (message) return NextResponse.json({ message, issues: [{ path: [], message }] }, { status: 400 });
    await db.update(energyClearanceRules).set({
      ruleCode: full.ruleCode ?? null,
      ruleName: full.ruleName ?? null,
      voltageLevelKv: String(full.voltageLevelKv),
      voltageLevelFromKv: full.voltageLevelFromKv == null ? null : String(full.voltageLevelFromKv),
      voltageLevelToKv: full.voltageLevelToKv == null ? null : String(full.voltageLevelToKv),
      lineType: full.lineType ?? null,
      structureType: full.structureType ?? null,
      objectType: full.objectType ?? null,
      crossingType: full.crossingType ?? null,
      terrainType: full.terrainType ?? null,
      urbanRuralType: full.urbanRuralType ?? null,
      horizontalClearanceM: full.horizontalClearanceM == null ? null : String(full.horizontalClearanceM),
      verticalClearanceM: full.verticalClearanceM == null ? null : String(full.verticalClearanceM),
      corridorWidthM: full.corridorWidthM == null ? null : String(full.corridorWidthM),
      measurementBasis: full.measurementBasis ?? null,
      calculationMethod: full.calculationMethod ?? null,
      priority: full.priority,
      validFrom: parseDate(full.validFrom),
      validTo: parseDate(full.validTo),
      metadata: { ...metadata, notes: full.notes ?? null },
      updatedAt: new Date(),
    }).where(eq(energyClearanceRules.id, ruleId));
    const item = await readRegulation(regulationId);
    return NextResponse.json({ item: item?.rules.find((rule) => rule.id === ruleId) ?? null });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Clearance rule is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not update clearance rule.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { regulationId, ruleId } = paramsSchema.parse(await context.params);
    const [existing] = await db.select({ id: energyClearanceRules.id }).from(energyClearanceRules).where(and(eq(energyClearanceRules.id, ruleId), eq(energyClearanceRules.regulationId, regulationId))).limit(1);
    if (!existing) return NextResponse.json({ message: 'Clearance rule not found.' }, { status: 404 });
    const [corridorReference, checkReference] = await Promise.all([
      db.select({ id: energyProtectionCorridors.id }).from(energyProtectionCorridors).where(eq(energyProtectionCorridors.ruleId, ruleId)).limit(1),
      db.select({ id: energyConstructionClearanceChecks.id }).from(energyConstructionClearanceChecks).where(eq(energyConstructionClearanceChecks.ruleId, ruleId)).limit(1),
    ]);
    if (corridorReference.length || checkReference.length) {
      await db.update(energyClearanceRules).set({ validTo: new Date(), updatedAt: new Date() }).where(eq(energyClearanceRules.id, ruleId));
      return NextResponse.json({ deleted: false, retired: true, ruleId, message: 'Rule is referenced by historical results, so it was retired with validTo instead of being physically deleted.' });
    }
    await db.delete(energyClearanceRules).where(eq(energyClearanceRules.id, ruleId));
    return NextResponse.json({ deleted: true, ruleId });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Rule ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not delete clearance rule.' }, { status: 400 });
  }
}
