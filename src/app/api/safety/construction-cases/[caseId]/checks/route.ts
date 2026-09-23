import { desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyConstructionCases, energyConstructionCaseStatusHistory, energyConstructionClearanceChecks } from '@/db/schema';
import { db } from '@/lib/db';
import { constructionCheckSchema } from '@/lib/safety-schemas';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ caseId: string }> };
const paramsSchema = z.object({ caseId: z.string().uuid() });

function numberOrNull(value: unknown) {
  if (value == null) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { caseId } = paramsSchema.parse(await context.params);
    const [parent] = await db.select({ id: energyConstructionCases.id }).from(energyConstructionCases).where(eq(energyConstructionCases.id, caseId)).limit(1);
    if (!parent) return NextResponse.json({ message: 'Construction case not found.' }, { status: 404 });
    const checks = await db.select().from(energyConstructionClearanceChecks).where(eq(energyConstructionClearanceChecks.caseId, caseId)).orderBy(desc(energyConstructionClearanceChecks.checkedAt));
    return NextResponse.json({ items: checks.map((check) => ({ ...check, nearestDistanceM: numberOrNull(check.nearestDistanceM), requiredClearanceM: numberOrNull(check.requiredClearanceM), minimumDistanceM: numberOrNull(check.minimumDistanceM), intersectionAreaM2: numberOrNull(check.intersectionAreaM2) })) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Case ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load construction checks.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { caseId } = paramsSchema.parse(await context.params);
    const payload = constructionCheckSchema.parse(await request.json());
    const [parent] = await db.select().from(energyConstructionCases).where(eq(energyConstructionCases.id, caseId)).limit(1);
    if (!parent) return NextResponse.json({ message: 'Construction case not found.' }, { status: 404 });
    const geometryJson = JSON.stringify(payload.geometry);
    const analysis = await db.execute(sql`
      WITH proposed AS (
        SELECT ST_SetSRID(ST_GeomFromGeoJSON(${geometryJson}::text), 4326) AS geom
      )
      SELECT line."assetId", line.code, line.name, line."voltageLevelKv", line."lineType", line."minimumDistanceM",
             line."corridorId", line."corridorVersionId", line."corridorVersionNo", line."lineGeometryHash",
             line."intersectsCorridor", line."intersectionAreaM2", line."requiredDistanceM", line."ruleId",
             line."regulationCode", line."regulationName", line."regulationVersionNo", line."legalDocumentRef",
             line."measurementBasis", line."calculationMethod", line."nearestPositionCode", line."nearestStructureAssetId"
      FROM proposed p
      CROSS JOIN LATERAL (
        SELECT pl.asset_id AS "assetId", a.code, a.name, pl.voltage_level_kv::double precision AS "voltageLevelKv", pl.line_type AS "lineType",
               ST_Distance(p.geom::geography, pl.geometry::geography)::double precision AS "minimumDistanceM",
               corridor.id AS "corridorId", version.id AS "corridorVersionId", corridor.version_no AS "corridorVersionNo",
               corridor.source_line_geometry_hash AS "lineGeometryHash",
               CASE WHEN corridor.geometry IS NULL THEN false ELSE ST_Intersects(ST_MakeValid(p.geom), ST_MakeValid(corridor.geometry)) END AS "intersectsCorridor",
               CASE WHEN corridor.geometry IS NULL OR GeometryType(p.geom) NOT IN ('POLYGON', 'MULTIPOLYGON') THEN 0::double precision
                    ELSE ST_Area(ST_Intersection(ST_MakeValid(p.geom), ST_MakeValid(corridor.geometry))::geography)::double precision END AS "intersectionAreaM2",
               rule.id AS "ruleId", rule."requiredDistanceM", rule."regulationCode", rule."regulationName", rule."regulationVersionNo",
               rule."legalDocumentRef", rule."measurementBasis", COALESCE(rule."calculationMethod", 'POSTGIS_RULE_DISTANCE') AS "calculationMethod",
               position."positionCode" AS "nearestPositionCode", position."structureAssetId" AS "nearestStructureAssetId"
        FROM energy_power_lines pl
        JOIN energy_assets a ON a.id = pl.asset_id AND a.status = 'ACTIVE'
        LEFT JOIN LATERAL (
          SELECT c.*
          FROM energy_protection_corridors c
          WHERE c.asset_id = pl.asset_id AND c.status = 'ACTIVE'
          ORDER BY c.version_no DESC
          LIMIT 1
        ) corridor ON true
        LEFT JOIN LATERAL (
          SELECT v.id
          FROM energy_protection_corridor_versions v
          WHERE v.corridor_id = corridor.id
          ORDER BY v.version_no DESC
          LIMIT 1
        ) version ON true
        LEFT JOIN LATERAL (
          SELECT cr.id, cr.horizontal_clearance_m::double precision AS "horizontalClearanceM",
                 cr.corridor_width_m::double precision AS "corridorWidthM", cr.measurement_basis AS "measurementBasis",
                 cr.calculation_method AS "calculationMethod", sr.code AS "regulationCode", sr.name AS "regulationName",
                 sr.version_no AS "regulationVersionNo", sr.legal_document_ref AS "legalDocumentRef",
                 COALESCE(cr.horizontal_clearance_m, cr.corridor_width_m / 2.0)::double precision AS "requiredDistanceM"
          FROM energy_clearance_rules cr
          JOIN energy_safety_regulations sr ON sr.id = cr.regulation_id
          WHERE sr.status = 'ACTIVE'
            AND sr.effective_from <= CURRENT_TIMESTAMP
            AND (sr.effective_to IS NULL OR sr.effective_to >= CURRENT_TIMESTAMP)
            AND (cr.valid_from IS NULL OR cr.valid_from <= CURRENT_TIMESTAMP)
            AND (cr.valid_to IS NULL OR cr.valid_to >= CURRENT_TIMESTAMP)
            AND cr.voltage_level_kv = pl.voltage_level_kv
            AND (cr.line_type IS NULL OR cr.line_type = pl.line_type)
            AND (cr.structure_type IS NULL OR cr.structure_type = ${payload.structureType})
            AND (cr.object_type IS NULL OR cr.object_type = ${payload.objectType ?? null})
            AND (cr.crossing_type IS NULL OR cr.crossing_type = ${payload.crossingType ?? null})
          ORDER BY cr.priority ASC, sr.effective_from DESC,
                   CASE WHEN cr.line_type = pl.line_type THEN 0 ELSE 1 END,
                   CASE WHEN cr.structure_type = ${payload.structureType} THEN 0 ELSE 1 END,
                   cr.id
          LIMIT 1
        ) rule ON true
        LEFT JOIN LATERAL (
          SELECT lp.position_code AS "positionCode", lp.asset_id AS "structureAssetId"
          FROM energy_line_positions lp
          WHERE lp.line_asset_id = pl.asset_id
          ORDER BY ST_Distance(p.geom::geography, lp.location::geography)
          LIMIT 1
        ) position ON true
        WHERE pl.geometry IS NOT NULL
        ORDER BY ST_Distance(p.geom::geography, pl.geometry::geography)
        LIMIT 1
      ) line
    `);
    const row = analysis.rows[0] as Record<string, unknown> | undefined;
    if (!row?.assetId) return NextResponse.json({ message: 'No active power line with geometry is available for this GIS check.', warnings: ['DATA_INCOMPLETE: add authoritative power-line geometry before relying on a construction result.'] }, { status: 422 });
    const minimumDistanceM = numberOrNull(row.minimumDistanceM) ?? 0;
    const requiredDistanceM = numberOrNull(row.requiredDistanceM);
    const intersectsCorridor = row.intersectsCorridor === true || row.intersectsCorridor === 't';
    const result = requiredDistanceM == null ? 'NEEDS_RULE' : intersectsCorridor || minimumDistanceM < requiredDistanceM ? 'FAIL_PRELIMINARY' : 'PASS_PRELIMINARY';
    const explanation = {
      method: 'POSTGIS_CONSTRUCTION_CLEARANCE_V2',
      input: { geometry: payload.geometry, structureType: payload.structureType, objectType: payload.objectType ?? null, crossingType: payload.crossingType ?? null, terrainType: payload.terrainType ?? null, urbanRuralType: payload.urbanRuralType ?? null },
      nearestLine: { assetId: row.assetId, code: row.code, name: row.name, voltageLevelKv: Number(row.voltageLevelKv), lineType: row.lineType, nearestPositionCode: row.nearestPositionCode ?? null, nearestStructureAssetId: row.nearestStructureAssetId ?? null },
      corridor: { id: row.corridorId ?? null, versionId: row.corridorVersionId ?? null, versionNo: row.corridorVersionNo ?? null, lineGeometryHash: row.lineGeometryHash ?? null, intersectsCorridor, intersectionAreaM2: numberOrNull(row.intersectionAreaM2) ?? 0 },
      rule: row.ruleId ? { id: row.ruleId, regulationCode: row.regulationCode, regulationName: row.regulationName, regulationVersionNo: row.regulationVersionNo, legalDocumentRef: row.legalDocumentRef, measurementBasis: row.measurementBasis, requiredDistanceM } : null,
      result,
      warning: 'This is a preliminary GIS reference result. It does not replace technical survey or construction-permit authority review.',
    };
    const [created] = await db.transaction(async (tx) => {
      const inserted = await tx.insert(energyConstructionClearanceChecks).values({
        caseId,
        siteId: parent.siteId,
        caseCode: parent.caseCode,
        proposedGeometry: sql`ST_SetSRID(ST_GeomFromGeoJSON(${geometryJson}::text), 4326)`,
        nearestGridAssetId: String(row.assetId),
        nearestDistanceM: String(minimumDistanceM),
        requiredClearanceM: requiredDistanceM == null ? null : String(requiredDistanceM),
        minimumDistanceM: String(minimumDistanceM),
        intersectionAreaM2: String(numberOrNull(row.intersectionAreaM2) ?? 0),
        intersectsCorridor,
        corridorVersionId: row.corridorVersionId ? String(row.corridorVersionId) : null,
        lineGeometryHash: row.lineGeometryHash ? String(row.lineGeometryHash) : null,
        calculationMethod: 'POSTGIS_CONSTRUCTION_CLEARANCE_V2',
        result,
        ruleId: row.ruleId ? String(row.ruleId) : null,
        reviewedBy: payload.reviewedBy ?? null,
        reviewedAt: payload.reviewedBy ? new Date() : null,
        checkedAt: new Date(),
        explanation: { ...explanation, notes: payload.notes ?? null },
      }).returning();
      if (parent.status === 'SUBMITTED') {
        await tx.update(energyConstructionCases).set({ status: 'GIS_CHECKED', updatedAt: new Date() }).where(eq(energyConstructionCases.id, caseId));
        await tx.insert(energyConstructionCaseStatusHistory).values({ caseId, fromStatus: parent.status, toStatus: 'GIS_CHECKED', changedBy: payload.reviewedBy ?? null, reason: result });
      }
      return inserted;
    });
    return NextResponse.json({ check: { ...created, nearestDistanceM: minimumDistanceM, requiredClearanceM: requiredDistanceM, minimumDistanceM, intersectionAreaM2: numberOrNull(row.intersectionAreaM2) ?? 0 }, nearestLine: explanation.nearestLine, corridor: explanation.corridor, rule: explanation.rule, result, warning: explanation.warning }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Construction GIS check is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not run construction GIS check.' }, { status: 400 });
  }
}
