import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD.').refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Date is not a real calendar date.');

const querySchema = z.object({
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  voltageLevelKv: z.string().regex(/^\d+(?:\.\d{1,3})?$/, 'voltageLevelKv must be numeric.').optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  status: z.string().trim().min(1).max(60).regex(/^[A-Z_]+$/).optional(),
  source: z.enum(['AI_VISION', 'EVN', 'FIELD_MANUAL']).optional(),
});

type RawRow = Record<string, unknown>;
type Feature = { type: 'Feature'; id: string; geometry: unknown; properties: Record<string, unknown> };

function isoDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function defaultPeriod() {
  const today = new Date();
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 11, 1));
  return { from: isoDateOnly(from), to: isoDateOnly(today) };
}

function dateAtUtc(dateOnly: string, exclusiveEnd = false) {
  const value = new Date(`${dateOnly}T00:00:00.000Z`);
  if (exclusiveEnd) value.setUTCDate(value.getUTCDate() + 1);
  return value;
}

function parseGeoJson(value: unknown) {
  if (typeof value !== 'string') return value ?? null;
  try { return JSON.parse(value) as unknown; } catch { return null; }
}

function feature(row: RawRow, layer: string): Feature | null {
  const geometry = parseGeoJson(row.geometry);
  if (!geometry) return null;
  const properties = { ...row };
  delete properties.geometry;
  delete properties.id;
  return { type: 'Feature', id: String(row.id), geometry, properties: { ...properties, layer } };
}

function rowsToFeatures(rows: unknown, layer: string) {
  return (rows as RawRow[]).map((row) => feature(row, layer)).filter((item): item is Feature => Boolean(item));
}

function onlySource(source: string | undefined, accepted: string[]) {
  if (!source || accepted.includes(source)) return sql``;
  return sql`AND FALSE`;
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const parsedQuery = querySchema.safeParse({
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
    voltageLevelKv: searchParams.get('voltageLevelKv') ?? undefined,
    severity: searchParams.get('severity') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    source: searchParams.get('source') ?? undefined,
  });
  if (!parsedQuery.success) return NextResponse.json({ message: 'Safety GIS filter is invalid.', issues: parsedQuery.error.issues }, { status: 400 });

  const defaults = defaultPeriod();
  const from = parsedQuery.data.from ?? defaults.from;
  const to = parsedQuery.data.to ?? defaults.to;
  if (from > to) return NextResponse.json({ message: 'to must be on or after from.', issues: [{ path: ['to'], message: 'Invalid date range.' }] }, { status: 400 });
  const fromDate = dateAtUtc(from);
  const toExclusive = dateAtUtc(to, true);
  const voltageLevelKv = parsedQuery.data.voltageLevelKv == null ? null : Number(parsedQuery.data.voltageLevelKv);
  const lineVoltageFilter = voltageLevelKv == null ? sql`` : sql`AND pl.voltage_level_kv = ${voltageLevelKv}`;
  const positionVoltageFilter = voltageLevelKv == null ? sql`` : sql`AND pl.voltage_level_kv = ${voltageLevelKv}`;
  const corridorVoltageFilter = voltageLevelKv == null ? sql`` : sql`AND pl.voltage_level_kv = ${voltageLevelKv}`;
  const violationVoltageFilter = voltageLevelKv == null ? sql`` : sql`AND pl.voltage_level_kv = ${voltageLevelKv}`;
  const aiVoltageFilter = voltageLevelKv == null ? sql`` : sql`AND pl.voltage_level_kv = ${voltageLevelKv}`;
  const severityFilter = parsedQuery.data.severity ? sql`AND v.severity = ${parsedQuery.data.severity}` : sql``;
  const statusFilter = parsedQuery.data.status ? sql`AND v.status = ${parsedQuery.data.status}` : sql``;
  const violationSourceFilter = parsedQuery.data.source === 'AI_VISION'
    ? sql`AND v.ai_run_id IS NOT NULL`
    : parsedQuery.data.source === 'FIELD_MANUAL'
      ? sql`AND v.ai_run_id IS NULL`
      : parsedQuery.data.source === 'EVN' ? sql`AND FALSE` : sql``;
  const aiSourceFilter = onlySource(parsedQuery.data.source, ['AI_VISION']);
  const outageSourceFilter = parsedQuery.data.source === 'EVN' ? sql`AND o.source = 'EVN'` : onlySource(parsedQuery.data.source, ['EVN']);
  const inspectionSourceFilter = onlySource(parsedQuery.data.source, ['FIELD_MANUAL']);

  try {
    const [lineResult, positionResult, corridorResult, violationResult, inspectionResult, aiResult, outageResult, outageAreaResult, constructionResult, assetResult, adminResult] = await Promise.all([
      db.execute(sql`
        SELECT pl.asset_id AS id, a.code, a.name, a.asset_type AS "assetType", a.status,
          pl.voltage_level_kv::double precision AS "voltageLevelKv", pl.line_type AS "lineType",
          pl.conductor_type AS "conductorType", pl.circuit_count AS "circuitCount",
          COALESCE(NULLIF(pl.length_m, 0), CASE WHEN pl.geometry IS NULL THEN 0 ELSE ST_Length(pl.geometry::geography) END)::double precision AS "lengthM",
          pl.feeder_asset_id AS "feederAssetId", feeder.code AS "feederCode", feeder.name AS "feederName",
          ST_AsGeoJSON(pl.geometry) AS geometry
        FROM energy_power_lines pl
        JOIN energy_assets a ON a.id = pl.asset_id AND a.status = 'ACTIVE'
        LEFT JOIN energy_assets feeder ON feeder.id = pl.feeder_asset_id
        WHERE pl.geometry IS NOT NULL ${lineVoltageFilter}
        ORDER BY pl.voltage_level_kv DESC, a.code LIMIT 10000
      `),
      db.execute(sql`
        SELECT lp.id, lp.line_asset_id AS "lineAssetId", line.code AS "lineCode", line.name AS "lineName",
          pl.voltage_level_kv::double precision AS "voltageLevelKv", lp.position_code AS "positionCode",
          lp.sequence_no AS "sequenceNo", lp.distance_from_previous_m::double precision AS "distanceFromPreviousM",
          lp.turn_angle_deg::double precision AS "turnAngleDeg", s.asset_id AS "structureAssetId",
          s.structure_type AS "structureType", ST_AsGeoJSON(lp.location::geometry) AS geometry
        FROM energy_line_positions lp
        JOIN energy_power_lines pl ON pl.asset_id = lp.line_asset_id
        JOIN energy_assets line ON line.id = lp.line_asset_id AND line.status = 'ACTIVE'
        LEFT JOIN energy_power_structures s ON s.position_id = lp.id
        WHERE lp.location IS NOT NULL ${positionVoltageFilter}
        ORDER BY lp.line_asset_id, lp.sequence_no LIMIT 20000
      `),
      db.execute(sql`
        SELECT c.id, c.asset_id AS "assetId", a.code, a.name,
          pl.voltage_level_kv::double precision AS "voltageLevelKv", c.status,
          c.version_no AS "versionNo", c.rule_version AS "ruleVersion", c.calculation_method AS "calculationMethod",
          c.calculated_at AS "calculatedAt", ST_AsGeoJSON(c.geometry) AS geometry
        FROM energy_protection_corridors c
        JOIN energy_assets a ON a.id = c.asset_id AND a.status = 'ACTIVE'
        LEFT JOIN energy_power_lines pl ON pl.asset_id = c.asset_id
        WHERE c.status = 'ACTIVE' AND c.geometry IS NOT NULL
          AND (c.valid_from IS NULL OR c.valid_from <= CURRENT_TIMESTAMP)
          AND (c.valid_to IS NULL OR c.valid_to >= CURRENT_TIMESTAMP)
          ${corridorVoltageFilter}
        ORDER BY c.version_no DESC, c.calculated_at DESC LIMIT 10000
      `),
      db.execute(sql`
        SELECT v.id, v.code, v.corridor_id AS "corridorId", v.violation_type AS "violationType", v.severity,
          v.status, v.detected_at AS "detectedAt", v.distance_m::double precision AS "distanceM",
          v.ai_run_id AS "aiRunId", v.ai_detection_id AS "aiDetectionId", v.human_review_required AS "humanReviewRequired",
          v.review_decision AS "reviewDecision", a.code AS "assetCode", a.name AS "assetName",
          pl.voltage_level_kv::double precision AS "voltageLevelKv", ST_AsGeoJSON(v.location::geometry) AS geometry
        FROM energy_corridor_violations v
        JOIN energy_protection_corridors c ON c.id = v.corridor_id
        JOIN energy_assets a ON a.id = c.asset_id
        LEFT JOIN energy_power_lines pl ON pl.asset_id = c.asset_id
        WHERE v.location IS NOT NULL AND v.detected_at >= ${fromDate} AND v.detected_at < ${toExclusive}
          AND v.status <> 'ARCHIVED' ${violationVoltageFilter} ${severityFilter} ${statusFilter} ${violationSourceFilter}
        ORDER BY v.detected_at DESC LIMIT 10000
      `),
      db.execute(sql`
        SELECT i.id, i.inspection_code AS "inspectionCode", i.inspection_type AS "inspectionType", i.status,
          i.source, i.inspector, i.started_at AS "startedAt", i.completed_at AS "completedAt",
          i.corridor_id AS "corridorId", i.asset_id AS "assetId", ST_AsGeoJSON(i.geometry) AS geometry
        FROM energy_safety_inspections i
        WHERE i.geometry IS NOT NULL AND i.started_at >= ${fromDate} AND i.started_at < ${toExclusive}
          AND i.status <> 'ARCHIVED' ${inspectionSourceFilter}
        ORDER BY i.started_at DESC LIMIT 10000
      `),
      db.execute(sql`
        SELECT d.id, d.run_id AS "runId", d.label, d.confidence::double precision AS confidence,
          d.risk_score::double precision AS "riskScore", d.suggested_severity AS "suggestedSeverity",
          d.suggested_violation_type AS "suggestedViolationType", d.review_status AS "reviewStatus",
          d.created_violation_id AS "createdViolationId", r.model_provider AS "modelProvider",
          r.model_name AS "modelName", r.model_version AS "modelVersion", r.input_hash AS "inputHash",
          m.id AS "mediaId", m.title AS "mediaTitle", i.id AS "inspectionId", i.inspection_code AS "inspectionCode",
          r.matched_asset_id AS "matchedAssetId", pl.voltage_level_kv::double precision AS "voltageLevelKv",
          ST_AsGeoJSON(m.location::geometry) AS geometry
        FROM energy_ai_vision_detections d
        JOIN energy_ai_vision_runs r ON r.id = d.run_id AND r.status <> 'CANCELLED'
        JOIN energy_safety_inspection_media m ON m.id = r.media_id AND m.status <> 'ARCHIVED'
        JOIN energy_safety_inspections i ON i.id = m.inspection_id AND i.status <> 'ARCHIVED'
        LEFT JOIN energy_power_lines pl ON pl.asset_id = r.matched_asset_id
        WHERE m.location IS NOT NULL AND r.started_at >= ${fromDate} AND r.started_at < ${toExclusive}
          ${aiVoltageFilter} ${aiSourceFilter}
        ORDER BY r.started_at DESC, d.created_at DESC LIMIT 10000
      `),
      db.execute(sql`
        SELECT o.id, o.code, o.title, o.source, o.source_type AS "sourceType", o.status,
          o.start_at AS "startAt", o.end_at AS "endAt", o.affected_customers::double precision AS "affectedCustomers",
          o.impact_method AS "impactMethod", o.source_record_id AS "sourceRecordId",
          ST_AsGeoJSON(o.affected_geometry) AS geometry
        FROM energy_outage_plans o
        WHERE o.status <> 'ARCHIVED' AND o.affected_geometry IS NOT NULL
          AND o.start_at < ${toExclusive} AND o.end_at > ${fromDate}
          ${outageSourceFilter}
          ${voltageLevelKv == null ? sql`` : sql`AND EXISTS (SELECT 1 FROM energy_outage_affected_assets oa JOIN energy_power_lines pl ON pl.asset_id = oa.asset_id WHERE oa.outage_id = o.id AND pl.voltage_level_kv = ${voltageLevelKv})`}
        ORDER BY o.start_at DESC LIMIT 5000
      `),
      db.execute(sql`
        SELECT CONCAT(o.id::text, ':', oa.admin_area_code) AS id, o.id AS "outageId", o.code AS "outageCode",
          oa.admin_area_code AS "adminAreaCode", oa.affected_customer_count::double precision AS "affectedCustomers",
          oa.affected_load_mw::double precision AS "affectedLoadMw", oa.critical_facility_count AS "criticalFacilities",
          oa.determination_method AS "determinationMethod", ST_AsGeoJSON(aa.boundary) AS geometry
        FROM energy_outage_affected_areas oa
        JOIN energy_outage_plans o ON o.id = oa.outage_id
        JOIN energy_admin_areas aa ON aa.code = oa.admin_area_code AND aa.boundary IS NOT NULL
        WHERE o.status <> 'ARCHIVED' AND o.start_at < ${toExclusive} AND o.end_at > ${fromDate}
          ${outageSourceFilter}
        ORDER BY o.start_at DESC LIMIT 10000
      `),
      db.execute(sql`
        SELECT c.id, c.case_code AS "caseCode", c.project_type AS "projectType", c.status,
          c.geometry_source AS "geometrySource", c.submitted_at AS "submittedAt", ST_AsGeoJSON(c.proposed_geometry) AS geometry
        FROM energy_construction_cases c
        WHERE c.status <> 'ARCHIVED' AND c.proposed_geometry IS NOT NULL
          AND c.submitted_at < ${toExclusive} AND c.submitted_at >= ${fromDate}
        ORDER BY c.submitted_at DESC LIMIT 5000
      `),
      db.execute(sql`
        SELECT a.id, a.code, a.name, a.asset_type AS "assetType", a.status,
          ST_AsGeoJSON(COALESCE(a.location::geometry, a.boundary)) AS geometry
        FROM energy_assets a
        WHERE a.status = 'ACTIVE' AND a.asset_type IN ('SUBSTATION', 'TRANSFORMER', 'BAY', 'FEEDER')
          AND COALESCE(a.location::geometry, a.boundary) IS NOT NULL
        ORDER BY a.asset_type, a.code LIMIT 10000
      `),
      db.execute(sql`
        SELECT aa.id, aa.code, aa.name, aa.level, aa.parent_code AS "parentCode", ST_AsGeoJSON(aa.boundary) AS geometry
        FROM energy_admin_areas aa
        WHERE aa.boundary IS NOT NULL
        ORDER BY aa.level, aa.code LIMIT 5000
      `),
    ]);

    const layers = {
      powerLines: rowsToFeatures(lineResult.rows, 'power-line'),
      linePositions: rowsToFeatures(positionResult.rows, 'line-position'),
      protectionCorridors: rowsToFeatures(corridorResult.rows, 'protection-corridor'),
      violations: rowsToFeatures(violationResult.rows, 'safety-violation'),
      inspections: rowsToFeatures(inspectionResult.rows, 'inspection'),
      aiDetections: rowsToFeatures(aiResult.rows, 'ai-detection'),
      outagePlans: rowsToFeatures(outageResult.rows, 'outage-plan'),
      outageAreas: rowsToFeatures(outageAreaResult.rows, 'outage-area'),
      constructionCases: rowsToFeatures(constructionResult.rows, 'construction-case'),
      gridAssets: rowsToFeatures(assetResult.rows, 'grid-asset'),
      adminAreas: rowsToFeatures(adminResult.rows, 'admin-area'),
    };
    const allFeatures = Object.values(layers).flat();
    const warnings: string[] = [];
    if (!layers.powerLines.length) warnings.push('No active power-line geometry is available from the grid registry.');
    if (!layers.linePositions.length) warnings.push('No line-position/pole geometry is available for the selected voltage filter.');
    if (!layers.protectionCorridors.length) warnings.push('No current versioned protection-corridor geometry is available.');
    if (!layers.violations.length) warnings.push('No violation point with real GPS geometry matches the selected period and filters.');
    if (!layers.inspections.length) warnings.push('No inspection geometry is available; inspections without a surveyed geometry are not placed on the map.');
    if (!layers.aiDetections.length) warnings.push('No AI detection with persisted media GPS matches the selected period and filters.');
    if (!layers.outagePlans.length && !layers.outageAreas.length) warnings.push('No outage impact geometry is available from EVN plan polygons or administrative impact records.');
    if (!layers.constructionCases.length) warnings.push('No construction case with a proposed geometry matches the selected period.');
    if (!layers.adminAreas.length) warnings.push('No administrative boundary geometry is available; the map does not invent boundaries.');

    return NextResponse.json({
      period: { from, to, label: `${from} → ${to}` },
      filters: { voltageLevelKv, severity: parsedQuery.data.severity ?? null, status: parsedQuery.data.status ?? null, source: parsedQuery.data.source ?? null },
      layers,
      features: { type: 'FeatureCollection', features: allFeatures },
      stats: { layerCounts: Object.fromEntries(Object.entries(layers).map(([key, value]) => [key, value.length])), totalFeatures: allFeatures.length },
      warnings,
      method: {
        source: 'hệ thống GIS geometry from grid, safety, outage, construction and administrative registries.',
        heatmap: 'Safety findings are actual violation/media points; AI detections are a separate review-status layer and are never converted into confirmed violations automatically.',
        missingGeometry: 'Rows without persisted geometry are omitted and reported as warnings; no coordinate is geocoded or fabricated.',
      },
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load safety GIS.' }, { status: 500 });
  }
}
