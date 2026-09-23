import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyClearanceRules, energySafetyRegulations } from '@/db/schema';
import { db } from '@/lib/db';
import { clearanceRuleSchema } from '@/lib/safety-schemas';
import { readRegulation } from '@/server/safety/regulation-readers';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ regulationId: string }> };
const paramsSchema = z.object({ regulationId: z.string().uuid() });

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

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { regulationId } = paramsSchema.parse(await context.params);
    const regulation = await readRegulation(regulationId);
    if (!regulation) return NextResponse.json({ message: 'Safety regulation not found.' }, { status: 404 });
    return NextResponse.json({ items: regulation.rules });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Regulation ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load clearance rules.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { regulationId } = paramsSchema.parse(await context.params);
    const payload = clearanceRuleSchema.parse(await request.json());
    const message = validateRule(payload);
    if (message) return NextResponse.json({ message, issues: [{ path: [], message }] }, { status: 400 });
    const [regulation] = await db.select().from(energySafetyRegulations).where(eq(energySafetyRegulations.id, regulationId)).limit(1);
    if (!regulation) return NextResponse.json({ message: 'Safety regulation not found.' }, { status: 404 });
    const [created] = await db.insert(energyClearanceRules).values({
      regulationId,
      ruleCode: payload.ruleCode ?? null,
      ruleName: payload.ruleName ?? null,
      voltageLevelKv: String(payload.voltageLevelKv),
      voltageLevelFromKv: payload.voltageLevelFromKv == null ? null : String(payload.voltageLevelFromKv),
      voltageLevelToKv: payload.voltageLevelToKv == null ? null : String(payload.voltageLevelToKv),
      lineType: payload.lineType ?? null,
      structureType: payload.structureType ?? null,
      objectType: payload.objectType ?? null,
      crossingType: payload.crossingType ?? null,
      terrainType: payload.terrainType ?? null,
      urbanRuralType: payload.urbanRuralType ?? null,
      horizontalClearanceM: payload.horizontalClearanceM == null ? null : String(payload.horizontalClearanceM),
      verticalClearanceM: payload.verticalClearanceM == null ? null : String(payload.verticalClearanceM),
      corridorWidthM: payload.corridorWidthM == null ? null : String(payload.corridorWidthM),
      measurementBasis: payload.measurementBasis ?? null,
      calculationMethod: payload.calculationMethod ?? null,
      priority: payload.priority,
      validFrom: parseDate(payload.validFrom) ?? regulation.effectiveFrom,
      validTo: parseDate(payload.validTo) ?? regulation.effectiveTo,
      metadata: { notes: payload.notes ?? null },
    }).returning({ id: energyClearanceRules.id });
    const item = await readRegulation(regulationId);
    return NextResponse.json({ item: item?.rules.find((rule) => rule.id === created.id) ?? null }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Clearance rule is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not save clearance rule.' }, { status: 400 });
  }
}
