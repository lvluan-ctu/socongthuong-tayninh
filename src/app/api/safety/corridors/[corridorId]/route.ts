import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyProtectionCorridors } from '@/db/schema';
import { db } from '@/lib/db';
import { corridorPatchSchema } from '@/lib/safety-schemas';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ corridorId: string }> };
const paramsSchema = z.object({ corridorId: z.string().uuid() });

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseGeoJson(value: unknown) {
  if (typeof value !== 'string') return value ?? null;
  try { return JSON.parse(value) as unknown; } catch { return null; }
}

async function readCorridor(corridorId: string) {
  const current = await db.execute(sql`
    SELECT c.id, c.asset_id AS "assetId", a.code AS "assetCode", a.name AS "assetName", a.asset_type AS "assetType",
           c.rule_id AS "ruleId", cr.rule_code AS "ruleCode", cr.rule_name AS "ruleName",
           cr.voltage_level_kv::double precision AS "voltageLevelKv", cr.measurement_basis AS "measurementBasis",
           sr.code AS "regulationCode", sr.name AS "regulationName", sr.version_no AS "regulationVersionNo",
           sr.legal_document_ref AS "legalDocumentRef", c.status, c.version_no AS "versionNo",
           c.source_line_geometry_hash AS "sourceLineGeometryHash", c.rule_version AS "ruleVersion",
           c.calculated_at AS "calculatedAt", c.valid_from AS "validFrom", c.valid_to AS "validTo",
           c.calculation_method AS "calculationMethod", c.input_snapshot AS "inputSnapshot",
           ST_AsGeoJSON(c.geometry) AS geometry
    FROM energy_protection_corridors c
    JOIN energy_assets a ON a.id = c.asset_id
    LEFT JOIN energy_clearance_rules cr ON cr.id = c.rule_id
    LEFT JOIN energy_safety_regulations sr ON sr.id = cr.regulation_id
    WHERE c.id = ${corridorId}::uuid
  `);
  const item = current.rows[0] as Record<string, unknown> | undefined;
  if (!item) return null;
  const versions = await db.execute(sql`
    SELECT v.id, v.corridor_id AS "corridorId", v.asset_id AS "assetId", v.rule_id AS "ruleId",
           v.version_no AS "versionNo", v.source_line_geometry_hash AS "sourceLineGeometryHash",
           v.rule_version AS "ruleVersion", v.calculated_at AS "calculatedAt", v.valid_from AS "validFrom",
           v.valid_to AS "validTo", v.calculation_method AS "calculationMethod", v.input_snapshot AS "inputSnapshot",
           ST_AsGeoJSON(v.geometry) AS geometry
    FROM energy_protection_corridor_versions v
    WHERE v.corridor_id = ${corridorId}::uuid
    ORDER BY v.version_no DESC
  `);
  return {
    ...item,
    geometry: parseGeoJson(item.geometry),
    versions: (versions.rows as Array<Record<string, unknown>>).map((version) => ({ ...version, geometry: parseGeoJson(version.geometry) })),
  };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { corridorId } = paramsSchema.parse(await context.params);
    const item = await readCorridor(corridorId);
    if (!item) return NextResponse.json({ message: 'Protection corridor not found.' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Corridor ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load protection corridor.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { corridorId } = paramsSchema.parse(await context.params);
    const payload = corridorPatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) return NextResponse.json({ message: 'No fields to update.' }, { status: 400 });
    const [existing] = await db.select().from(energyProtectionCorridors).where(eq(energyProtectionCorridors.id, corridorId)).limit(1);
    if (!existing) return NextResponse.json({ message: 'Protection corridor not found.' }, { status: 404 });
    const validFrom = Object.prototype.hasOwnProperty.call(payload, 'validFrom') ? parseDate(payload.validFrom) : existing.validFrom;
    const validTo = Object.prototype.hasOwnProperty.call(payload, 'validTo') ? parseDate(payload.validTo) : existing.validTo;
    if (validFrom && validTo && validTo.getTime() < validFrom.getTime()) return NextResponse.json({ message: 'Corridor validTo must be after validFrom.', issues: [{ path: ['validTo'], message: 'Invalid validity range.' }] }, { status: 400 });
    await db.update(energyProtectionCorridors).set({
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'validFrom') ? { validFrom } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'validTo') ? { validTo } : {}),
      updatedAt: new Date(),
    }).where(eq(energyProtectionCorridors.id, corridorId));
    return NextResponse.json({ item: await readCorridor(corridorId) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Corridor is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not update protection corridor.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { corridorId } = paramsSchema.parse(await context.params);
    const [updated] = await db.update(energyProtectionCorridors).set({ status: 'ARCHIVED', updatedAt: new Date() })
      .where(eq(energyProtectionCorridors.id, corridorId)).returning({ id: energyProtectionCorridors.id });
    if (!updated) return NextResponse.json({ message: 'Protection corridor not found.' }, { status: 404 });
    return NextResponse.json({ deleted: true, archived: true, corridorId });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Corridor ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not archive protection corridor.' }, { status: 400 });
  }
}
