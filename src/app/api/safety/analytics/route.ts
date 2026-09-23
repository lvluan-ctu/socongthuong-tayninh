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
}).superRefine((value, context) => {
  if (value.from && value.to && value.from > value.to) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: 'to must be on or after from.' });
  }
});

type RawRow = Record<string, unknown>;
type LineAggregate = { assetId: string | null; code: string; name: string | null; lineCount: number; lineKm: number; corridorCount: number; violations: number; openViolations: number; highCriticalViolations: number };
type VoltageAggregate = { voltageLevelKv: number | null; lineCount: number; lineKm: number; linesWithCorridor: number; violations: number; openViolations: number; highCriticalViolations: number };
type OutageSummary = { count: number; hours: number; affectedCustomers: number; affectedLoadMw: number; criticalCustomers: number; criticalFacilities: number };
type OutageSourceAggregate = { sourceType: string; source: string; outages: number; hours: number; affectedCustomers: number; affectedLoadMw: number };
type IncidentSummary = { count: number; openCount: number; resolvedCount: number; affectedCustomers: number; affectedLoadMw: number; restorationHours: number };
type IncidentTypeAggregate = { incidentType: string; incidents: number; openIncidents: number; affectedCustomers: number; affectedLoadMw: number; restorationHours: number; resolvedCount: number };
type AdminAggregate = { code: string; name: string | null; level: string | null; violations: number; openViolations: number; plannedCustomers: number; plannedLoadMw: number };

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

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function activeViolation(status: unknown) {
  return !['CLOSED', 'ARCHIVED', 'RESOLVED', 'FALSE_POSITIVE'].includes(String(status));
}

function addGroupedValue(map: Map<string, AdminAggregate>, row: AdminAggregate) {
  const current = map.get(row.code);
  if (!current) {
    map.set(row.code, { ...row });
    return;
  }
  current.violations += row.violations;
  current.openViolations += row.openViolations;
  current.plannedCustomers += row.plannedCustomers;
  current.plannedLoadMw += row.plannedLoadMw;
  if (!current.name && row.name) current.name = row.name;
  if (!current.level && row.level) current.level = row.level;
}

export async function GET(request: Request) {
  const parsedQuery = querySchema.safeParse({
    from: new URL(request.url).searchParams.get('from') ?? undefined,
    to: new URL(request.url).searchParams.get('to') ?? undefined,
  });
  if (!parsedQuery.success) return NextResponse.json({ message: 'Analytics filter is invalid.', issues: parsedQuery.error.issues }, { status: 400 });

  const defaults = defaultPeriod();
  const from = parsedQuery.data.from ?? defaults.from;
  const to = parsedQuery.data.to ?? defaults.to;
  const fromDate = dateAtUtc(from);
  const toExclusive = dateAtUtc(to, true);

  try {
    const [summaryResult, lineResult, outageResult, outageUniqueResult, incidentResult, aiRunResult, aiDetectionResult, violationTypeResult, sourceResult, monthResult, adminViolationResult, adminOutageResult] = await Promise.all([
      db.execute(sql`
        WITH current_corridors AS (
          SELECT DISTINCT ON (c.asset_id) c.asset_id, c.id
          FROM energy_protection_corridors c
          WHERE c.status = 'ACTIVE'
            AND (c.valid_from IS NULL OR c.valid_from <= CURRENT_TIMESTAMP)
            AND (c.valid_to IS NULL OR c.valid_to >= CURRENT_TIMESTAMP)
          ORDER BY c.asset_id, c.version_no DESC, c.calculated_at DESC, c.id DESC
        ), overdue AS (
          SELECT DISTINCT a.violation_id
          FROM energy_violation_assignments a
          WHERE a.due_at IS NOT NULL
            AND a.due_at < CURRENT_TIMESTAMP
            AND a.status NOT IN ('CANCELLED', 'COMPLETED')
        )
        SELECT
          (SELECT COUNT(*) FROM current_corridors)::int AS "activeCorridors",
          (SELECT COUNT(DISTINCT pl.asset_id) FROM energy_power_lines pl JOIN current_corridors cc ON cc.asset_id = pl.asset_id)::int AS "linesWithCorridor",
          (SELECT COALESCE(SUM(COALESCE(NULLIF(pl.length_m, 0), CASE WHEN pl.geometry IS NULL THEN 0 ELSE ST_Length(pl.geometry::geography) END)) / 1000, 0)::double precision
             FROM energy_power_lines pl JOIN current_corridors cc ON cc.asset_id = pl.asset_id)::double precision AS "lineKmWithCorridor",
          (SELECT COUNT(*) FROM energy_corridor_violations v
             WHERE v.detected_at >= ${fromDate} AND v.detected_at < ${toExclusive}
               AND v.status NOT IN ('ARCHIVED', 'FALSE_POSITIVE'))::int AS "violations",
          (SELECT COUNT(*) FROM energy_corridor_violations v
             WHERE v.detected_at >= ${fromDate} AND v.detected_at < ${toExclusive}
               AND v.status NOT IN ('CLOSED', 'ARCHIVED', 'RESOLVED', 'FALSE_POSITIVE'))::int AS "openViolations",
          (SELECT COUNT(*) FROM energy_corridor_violations v
             WHERE v.detected_at >= ${fromDate} AND v.detected_at < ${toExclusive}
               AND v.severity IN ('HIGH', 'CRITICAL')
               AND v.status NOT IN ('CLOSED', 'ARCHIVED', 'RESOLVED', 'FALSE_POSITIVE'))::int AS "highCriticalViolations",
          (SELECT COUNT(*) FROM energy_corridor_violations v JOIN overdue o ON o.violation_id = v.id
             WHERE v.status NOT IN ('CLOSED', 'ARCHIVED', 'RESOLVED', 'FALSE_POSITIVE'))::int AS "overdueViolations",
          (SELECT COUNT(*) FROM energy_corridor_violations v
             WHERE v.detected_at >= ${fromDate} AND v.detected_at < ${toExclusive}
               AND v.human_review_required = true AND v.reviewed_at IS NULL)::int AS "pendingHumanReview"
      `),
      db.execute(sql`
        WITH current_corridors AS (
          SELECT DISTINCT ON (c.asset_id) c.asset_id
          FROM energy_protection_corridors c
          WHERE c.status = 'ACTIVE'
            AND (c.valid_from IS NULL OR c.valid_from <= CURRENT_TIMESTAMP)
            AND (c.valid_to IS NULL OR c.valid_to >= CURRENT_TIMESTAMP)
          ORDER BY c.asset_id, c.version_no DESC, c.calculated_at DESC, c.id DESC
        ), violation_counts AS (
          SELECT c.asset_id,
            COUNT(*) FILTER (WHERE v.status NOT IN ('ARCHIVED', 'FALSE_POSITIVE'))::int AS violations,
            COUNT(*) FILTER (WHERE v.status NOT IN ('CLOSED', 'ARCHIVED', 'RESOLVED', 'FALSE_POSITIVE'))::int AS open_violations,
            COUNT(*) FILTER (WHERE v.severity IN ('HIGH', 'CRITICAL') AND v.status NOT IN ('CLOSED', 'ARCHIVED', 'RESOLVED', 'FALSE_POSITIVE'))::int AS high_critical_violations
          FROM energy_protection_corridors c
          LEFT JOIN energy_corridor_violations v
            ON v.corridor_id = c.id
           AND v.detected_at >= ${fromDate} AND v.detected_at < ${toExclusive}
          WHERE c.status = 'ACTIVE'
          GROUP BY c.asset_id
        )
        SELECT
          pl.asset_id AS "assetId",
          a.code,
          a.name,
          pl.voltage_level_kv::double precision AS "voltageLevelKv",
          pl.feeder_asset_id AS "feederAssetId",
          feeder.code AS "feederCode",
          feeder.name AS "feederName",
          f.substation_asset_id AS "substationAssetId",
          substation.code AS "substationCode",
          substation.name AS "substationName",
          COALESCE(NULLIF(pl.length_m, 0), CASE WHEN pl.geometry IS NULL THEN 0 ELSE ST_Length(pl.geometry::geography) END)::double precision / 1000 AS "lengthKm",
          CASE WHEN cc.asset_id IS NULL THEN 0 ELSE 1 END AS "hasCorridor",
          COALESCE(vc.violations, 0) AS violations,
          COALESCE(vc.open_violations, 0) AS "openViolations",
          COALESCE(vc.high_critical_violations, 0) AS "highCriticalViolations"
        FROM energy_power_lines pl
        JOIN energy_assets a ON a.id = pl.asset_id AND a.status = 'ACTIVE'
        LEFT JOIN energy_assets feeder ON feeder.id = pl.feeder_asset_id
        LEFT JOIN energy_feeders f ON f.asset_id = pl.feeder_asset_id
        LEFT JOIN energy_assets substation ON substation.id = f.substation_asset_id
        LEFT JOIN current_corridors cc ON cc.asset_id = pl.asset_id
        LEFT JOIN violation_counts vc ON vc.asset_id = pl.asset_id
        ORDER BY "openViolations" DESC, "lengthKm" DESC NULLS LAST
        LIMIT 10000
      `),
      db.execute(sql`
        SELECT o.id, o.source, o.source_type AS "sourceType",
          EXTRACT(EPOCH FROM (LEAST(o.end_at, ${toExclusive}) - GREATEST(o.start_at, ${fromDate}))) / 3600.0 AS hours,
          CASE WHEN EXISTS (
            SELECT 1 FROM energy_outage_affected_customers ac
            WHERE ac.outage_id = o.id AND (ac.customer_account_id IS NOT NULL OR ac.service_point_code IS NOT NULL)
          ) THEN (
            SELECT COUNT(DISTINCT COALESCE(ac.customer_account_id::text, ac.service_point_code))
            FROM energy_outage_affected_customers ac
            WHERE ac.outage_id = o.id AND (ac.customer_account_id IS NOT NULL OR ac.service_point_code IS NOT NULL)
          ) ELSE COALESCE(o.affected_customers, 0) END AS "affectedCustomers",
          (SELECT COALESCE(SUM(aa.affected_load_mw), 0) FROM energy_outage_affected_areas aa WHERE aa.outage_id = o.id) AS "affectedLoadMw",
          (SELECT COUNT(DISTINCT COALESCE(ac.customer_account_id::text, ac.service_point_code))
             FROM energy_outage_affected_customers ac
             WHERE ac.outage_id = o.id AND ac.is_critical = true
               AND (ac.customer_account_id IS NOT NULL OR ac.service_point_code IS NOT NULL)) AS "criticalCustomers",
          (SELECT COALESCE(SUM(aa.critical_facility_count), 0) FROM energy_outage_affected_areas aa WHERE aa.outage_id = o.id) AS "criticalFacilities"
        FROM energy_outage_plans o
        WHERE o.status <> 'ARCHIVED'
          AND o.start_at < ${toExclusive}
          AND o.end_at > ${fromDate}
          AND o.end_at > o.start_at
        ORDER BY o.start_at DESC
        LIMIT 10000
      `),
      db.execute(sql`
        SELECT COUNT(DISTINCT COALESCE(ac.customer_account_id::text, ac.service_point_code)) AS count
        FROM energy_outage_plans o
        JOIN energy_outage_affected_customers ac ON ac.outage_id = o.id
        WHERE o.status <> 'ARCHIVED'
          AND o.start_at < ${toExclusive}
          AND o.end_at > ${fromDate}
          AND (ac.customer_account_id IS NOT NULL OR ac.service_point_code IS NOT NULL)
      `),
      db.execute(sql`
        SELECT incident_type AS "incidentType", severity, status, started_at AS "startedAt", resolved_at AS "resolvedAt",
          affected_customers AS "affectedCustomers", affected_load_mw AS "affectedLoadMw",
          CASE WHEN resolved_at IS NULL OR resolved_at <= started_at THEN NULL
            ELSE EXTRACT(EPOCH FROM (resolved_at - started_at)) / 3600.0 END AS "restorationHours"
        FROM energy_grid_incidents
        WHERE started_at < ${toExclusive}
          AND (resolved_at IS NULL OR resolved_at >= ${fromDate})
        ORDER BY started_at DESC
        LIMIT 10000
      `),
      db.execute(sql`
        SELECT
          COUNT(*)::int AS runs,
          COUNT(*) FILTER (WHERE r.status = 'SUCCEEDED')::int AS "succeededRuns",
          COUNT(*) FILTER (WHERE r.status = 'FAILED')::int AS "failedRuns",
          COUNT(*) FILTER (WHERE r.status = 'REVIEWED')::int AS "reviewedRuns"
        FROM energy_ai_vision_runs r
        WHERE r.status <> 'CANCELLED'
          AND r.started_at >= ${fromDate} AND r.started_at < ${toExclusive}
      `),
      db.execute(sql`
        SELECT d.review_status AS "reviewStatus", COUNT(*)::int AS count
        FROM energy_ai_vision_detections d
        JOIN energy_ai_vision_runs r ON r.id = d.run_id
        WHERE r.status <> 'CANCELLED'
          AND r.started_at >= ${fromDate} AND r.started_at < ${toExclusive}
        GROUP BY d.review_status
      `),
      db.execute(sql`
        SELECT v.violation_type AS "violationType",
          COUNT(*)::int AS violations,
          COUNT(*) FILTER (WHERE v.status NOT IN ('CLOSED', 'ARCHIVED', 'RESOLVED', 'FALSE_POSITIVE'))::int AS "openViolations",
          COUNT(*) FILTER (WHERE v.severity IN ('HIGH', 'CRITICAL') AND v.status NOT IN ('CLOSED', 'ARCHIVED', 'RESOLVED', 'FALSE_POSITIVE'))::int AS "highCriticalViolations",
          COUNT(*) FILTER (WHERE v.ai_run_id IS NOT NULL)::int AS "aiDetected",
          COUNT(*) FILTER (WHERE v.human_review_required = true AND v.reviewed_at IS NULL)::int AS "pendingHumanReview"
        FROM energy_corridor_violations v
        WHERE v.detected_at >= ${fromDate} AND v.detected_at < ${toExclusive}
          AND v.status <> 'ARCHIVED'
        GROUP BY v.violation_type ORDER BY violations DESC, "violationType"
      `),
      db.execute(sql`
        SELECT CASE WHEN v.ai_run_id IS NOT NULL THEN 'AI_VISION' ELSE COALESCE(NULLIF(v.evidence->>'source', ''), 'FIELD_MANUAL') END AS source,
          COUNT(*)::int AS violations,
          COUNT(*) FILTER (WHERE v.status NOT IN ('CLOSED', 'ARCHIVED', 'RESOLVED', 'FALSE_POSITIVE'))::int AS "openViolations",
          COUNT(*) FILTER (WHERE v.severity IN ('HIGH', 'CRITICAL') AND v.status NOT IN ('CLOSED', 'ARCHIVED', 'RESOLVED', 'FALSE_POSITIVE'))::int AS "highCriticalViolations"
        FROM energy_corridor_violations v
        WHERE v.detected_at >= ${fromDate} AND v.detected_at < ${toExclusive}
          AND v.status <> 'ARCHIVED'
        GROUP BY source ORDER BY violations DESC, source
      `),
      db.execute(sql`
        SELECT month,
          SUM(violations)::int AS violations,
          SUM(confirmed_violations)::int AS "confirmedViolations",
          SUM(outages)::int AS outages,
          SUM(incidents)::int AS incidents,
          SUM(ai_detections)::int AS "aiDetections",
          SUM(ai_confirmed)::int AS "aiConfirmed"
        FROM (
          SELECT TO_CHAR(date_trunc('month', v.detected_at), 'YYYY-MM') AS month,
            COUNT(*)::int AS violations,
            COUNT(*) FILTER (WHERE v.status IN ('CONFIRMED', 'ASSIGNED', 'IN_PROGRESS', 'REMEDIATED', 'VERIFIED', 'CLOSED'))::int AS confirmed_violations,
            0::int AS outages, 0::int AS incidents, 0::int AS ai_detections, 0::int AS ai_confirmed
          FROM energy_corridor_violations v
          WHERE v.detected_at >= ${fromDate} AND v.detected_at < ${toExclusive} AND v.status <> 'ARCHIVED'
          GROUP BY 1
          UNION ALL
          SELECT TO_CHAR(date_trunc('month', o.start_at), 'YYYY-MM'), 0, 0, COUNT(*)::int, 0, 0, 0
          FROM energy_outage_plans o
          WHERE o.status <> 'ARCHIVED' AND o.start_at < ${toExclusive} AND o.end_at > ${fromDate}
          GROUP BY 1
          UNION ALL
          SELECT TO_CHAR(date_trunc('month', i.started_at), 'YYYY-MM'), 0, 0, 0, COUNT(*)::int, 0, 0
          FROM energy_grid_incidents i
          WHERE i.started_at < ${toExclusive} AND (i.resolved_at IS NULL OR i.resolved_at >= ${fromDate})
          GROUP BY 1
          UNION ALL
          SELECT TO_CHAR(date_trunc('month', r.started_at), 'YYYY-MM'), 0, 0, 0, 0, COUNT(*)::int,
            COUNT(*) FILTER (WHERE d.review_status = 'CONFIRMED')::int
          FROM energy_ai_vision_runs r
          JOIN energy_ai_vision_detections d ON d.run_id = r.id
          WHERE r.status <> 'CANCELLED' AND r.started_at >= ${fromDate} AND r.started_at < ${toExclusive}
          GROUP BY 1
        ) events
        GROUP BY month ORDER BY month
      `),
      db.execute(sql`
        SELECT aa.code, aa.name, aa.level,
          COUNT(DISTINCT v.id)::int AS violations,
          COUNT(DISTINCT v.id) FILTER (WHERE v.status NOT IN ('CLOSED', 'ARCHIVED', 'RESOLVED', 'FALSE_POSITIVE'))::int AS "openViolations"
        FROM energy_admin_areas aa
        JOIN energy_corridor_violations v
          ON aa.boundary IS NOT NULL AND v.location IS NOT NULL
         AND ST_Intersects(v.location::geometry, aa.boundary)
        WHERE v.detected_at >= ${fromDate} AND v.detected_at < ${toExclusive}
          AND v.status <> 'ARCHIVED'
        GROUP BY aa.code, aa.name, aa.level
        ORDER BY violations DESC, aa.code
      `),
      db.execute(sql`
        SELECT oa.admin_area_code AS code, COALESCE(aa.name, oa.admin_area_code) AS name, aa.level,
          0::int AS violations, 0::int AS "openViolations",
          COALESCE(SUM(oa.affected_customer_count), 0)::double precision AS "plannedCustomers",
          COALESCE(SUM(oa.affected_load_mw), 0)::double precision AS "plannedLoadMw"
        FROM energy_outage_affected_areas oa
        JOIN energy_outage_plans o ON o.id = oa.outage_id
        LEFT JOIN energy_admin_areas aa ON aa.code = oa.admin_area_code
        WHERE o.status <> 'ARCHIVED' AND o.start_at < ${toExclusive} AND o.end_at > ${fromDate}
        GROUP BY oa.admin_area_code, aa.name, aa.level
        ORDER BY "plannedCustomers" DESC, code
      `),
    ]);

    const summaryRow = (summaryResult.rows as RawRow[])[0] ?? {};
    const lines = lineResult.rows as RawRow[];
    const outageRows = outageResult.rows as RawRow[];
    const incidentRows = incidentResult.rows as RawRow[];
    const aiRuns = (aiRunResult.rows as RawRow[])[0] ?? {};

    const lineRecords = lines.map((row) => ({
      assetId: String(row.assetId),
      code: row.code == null ? null : String(row.code),
      name: row.name == null ? null : String(row.name),
      voltageLevelKv: nullableNumber(row.voltageLevelKv),
      feederAssetId: row.feederAssetId == null ? null : String(row.feederAssetId),
      feederCode: row.feederCode == null ? null : String(row.feederCode),
      feederName: row.feederName == null ? null : String(row.feederName),
      substationAssetId: row.substationAssetId == null ? null : String(row.substationAssetId),
      substationCode: row.substationCode == null ? null : String(row.substationCode),
      substationName: row.substationName == null ? null : String(row.substationName),
      lengthKm: numberValue(row.lengthKm),
      corridorCount: numberValue(row.hasCorridor),
      violations: numberValue(row.violations),
      openViolations: numberValue(row.openViolations),
      highCriticalViolations: numberValue(row.highCriticalViolations),
    }));

    const aggregateLines = (key: 'feeder' | 'substation') => {
      const groups = new Map<string, LineAggregate>();
      for (const line of lineRecords) {
        const id = key === 'feeder' ? line.feederAssetId : line.substationAssetId;
        const code = key === 'feeder' ? line.feederCode : line.substationCode;
        const name = key === 'feeder' ? line.feederName : line.substationName;
        const mapKey = id ?? `UNMAPPED_${key}`;
        const current = groups.get(mapKey) ?? { assetId: id, code: code ?? 'UNMAPPED', name: name ?? null, lineCount: 0, lineKm: 0, corridorCount: 0, violations: 0, openViolations: 0, highCriticalViolations: 0 };
        current.lineCount = numberValue(current.lineCount) + 1;
        current.lineKm = numberValue(current.lineKm) + line.lengthKm;
        current.corridorCount = numberValue(current.corridorCount) + line.corridorCount;
        current.violations = numberValue(current.violations) + line.violations;
        current.openViolations = numberValue(current.openViolations) + line.openViolations;
        current.highCriticalViolations = numberValue(current.highCriticalViolations) + line.highCriticalViolations;
        groups.set(mapKey, current);
      }
      return Array.from(groups.values()).map((row) => ({ ...row, lineKm: round(numberValue(row.lineKm)), assetId: row.assetId == null ? null : String(row.assetId), code: String(row.code), name: row.name == null ? null : String(row.name) })).sort((a, b) => b.openViolations - a.openViolations || b.lineKm - a.lineKm);
    };

    const voltageMap = new Map<string, VoltageAggregate>();
    for (const line of lineRecords) {
      const key = line.voltageLevelKv == null ? 'UNMAPPED' : String(line.voltageLevelKv);
      const current = voltageMap.get(key) ?? { voltageLevelKv: line.voltageLevelKv, lineCount: 0, lineKm: 0, linesWithCorridor: 0, violations: 0, openViolations: 0, highCriticalViolations: 0 };
      current.lineCount = numberValue(current.lineCount) + 1;
      current.lineKm = numberValue(current.lineKm) + line.lengthKm;
      current.linesWithCorridor = numberValue(current.linesWithCorridor) + (line.corridorCount ? 1 : 0);
      current.violations = numberValue(current.violations) + line.violations;
      current.openViolations = numberValue(current.openViolations) + line.openViolations;
      current.highCriticalViolations = numberValue(current.highCriticalViolations) + line.highCriticalViolations;
      voltageMap.set(key, current);
    }

    const outageSummary = outageRows.reduce<OutageSummary>((result, row) => {
      const hours = Math.max(0, numberValue(row.hours));
      result.count += 1;
      result.hours += hours;
      result.affectedCustomers += numberValue(row.affectedCustomers);
      result.affectedLoadMw += numberValue(row.affectedLoadMw);
      result.criticalCustomers += numberValue(row.criticalCustomers);
      result.criticalFacilities += numberValue(row.criticalFacilities);
      return result;
    }, { count: 0, hours: 0, affectedCustomers: 0, affectedLoadMw: 0, criticalCustomers: 0, criticalFacilities: 0 });
    const outageSourceMap = new Map<string, OutageSourceAggregate>();
    for (const row of outageRows) {
      const key = `${String(row.sourceType ?? 'UNKNOWN')}|${String(row.source ?? 'UNKNOWN')}`;
      const current = outageSourceMap.get(key) ?? { sourceType: String(row.sourceType ?? 'UNKNOWN'), source: String(row.source ?? 'UNKNOWN'), outages: 0, hours: 0, affectedCustomers: 0, affectedLoadMw: 0 };
      current.outages = numberValue(current.outages) + 1;
      current.hours = numberValue(current.hours) + Math.max(0, numberValue(row.hours));
      current.affectedCustomers = numberValue(current.affectedCustomers) + numberValue(row.affectedCustomers);
      current.affectedLoadMw = numberValue(current.affectedLoadMw) + numberValue(row.affectedLoadMw);
      outageSourceMap.set(key, current);
    }

    const incidentSummary = incidentRows.reduce<IncidentSummary>((result, row) => {
      result.count += 1;
      result.affectedCustomers += numberValue(row.affectedCustomers);
      result.affectedLoadMw += numberValue(row.affectedLoadMw);
      const restorationHours = nullableNumber(row.restorationHours);
      if (restorationHours != null) { result.resolvedCount += 1; result.restorationHours += restorationHours; }
      if (activeViolation(row.status)) result.openCount += 1;
      return result;
    }, { count: 0, openCount: 0, resolvedCount: 0, affectedCustomers: 0, affectedLoadMw: 0, restorationHours: 0 });
    const incidentTypes = new Map<string, IncidentTypeAggregate>();
    for (const row of incidentRows) {
      const key = String(row.incidentType ?? 'UNKNOWN');
      const current = incidentTypes.get(key) ?? { incidentType: key, incidents: 0, openIncidents: 0, affectedCustomers: 0, affectedLoadMw: 0, restorationHours: 0, resolvedCount: 0 };
      current.incidents = numberValue(current.incidents) + 1;
      if (activeViolation(row.status)) current.openIncidents = numberValue(current.openIncidents) + 1;
      current.affectedCustomers = numberValue(current.affectedCustomers) + numberValue(row.affectedCustomers);
      current.affectedLoadMw = numberValue(current.affectedLoadMw) + numberValue(row.affectedLoadMw);
      const restorationHours = nullableNumber(row.restorationHours);
      if (restorationHours != null) { current.restorationHours = numberValue(current.restorationHours) + restorationHours; current.resolvedCount = numberValue(current.resolvedCount) + 1; }
      incidentTypes.set(key, current);
    }

    const aiDetectionCounts = new Map((aiDetectionResult.rows as RawRow[]).map((row) => [String(row.reviewStatus), numberValue(row.count)]));
    const reviewedDetections = (aiDetectionCounts.get('CONFIRMED') ?? 0) + (aiDetectionCounts.get('REJECTED') ?? 0);
    const adminMap = new Map<string, AdminAggregate>();
    for (const row of adminViolationResult.rows as RawRow[]) addGroupedValue(adminMap, { code: String(row.code), name: row.name == null ? null : String(row.name), level: row.level == null ? null : String(row.level), violations: numberValue(row.violations), openViolations: numberValue(row.openViolations), plannedCustomers: 0, plannedLoadMw: 0 });
    for (const row of adminOutageResult.rows as RawRow[]) addGroupedValue(adminMap, { code: String(row.code), name: row.name == null ? null : String(row.name), level: row.level == null ? null : String(row.level), violations: 0, openViolations: 0, plannedCustomers: numberValue(row.plannedCustomers), plannedLoadMw: numberValue(row.plannedLoadMw) });

    const lineQuality = await db.execute(sql`
      SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE pl.geometry IS NOT NULL)::int AS geometry,
        COUNT(*) FILTER (WHERE pl.length_m IS NOT NULL OR pl.geometry IS NOT NULL)::int AS measurable
      FROM energy_power_lines pl
      JOIN energy_assets a ON a.id = pl.asset_id AND a.status = 'ACTIVE'
    `);
    const lineQualityRow = (lineQuality.rows as RawRow[])[0] ?? {};
    const warnings: string[] = [];
    if (!numberValue(summaryRow.activeCorridors)) warnings.push('No active protection corridor is available for the current grid data.');
    if (!numberValue(lineQualityRow.geometry)) warnings.push('No active power-line geometry is available; line distance and GIS coverage are incomplete.');
    if (numberValue(lineQualityRow.total) > numberValue(lineQualityRow.measurable)) warnings.push('Some active power lines have neither length_m nor geometry; their line-km KPI is understated.');
    if (!numberValue(summaryRow.violations)) warnings.push('No non-archived corridor violation was detected in the selected period.');
    if (!numberValue(outageSummary.count)) warnings.push('No planned outage overlaps the selected period.');
    if (outageSummary.count && !outageRows.some((row) => numberValue(row.affectedCustomers) > 0)) warnings.push('Planned outage customer impact is unavailable; values use zero or the outage-plan fallback only.');
    if (!numberValue(incidentSummary.count)) warnings.push('No unplanned grid incident overlaps the selected period.');
    if (incidentSummary.count && !incidentSummary.resolvedCount) warnings.push('No resolved incident is available for MTTR in the selected period.');
    if (!numberValue(aiRuns.runs)) warnings.push('No AI Vision run is available in the selected period.');
    if (numberValue(aiRuns.runs) && !reviewedDetections) warnings.push('AI detections are not yet human-reviewed; confirmation and false-positive rate are not decision-ready.');
    if (!(adminViolationResult.rows as RawRow[]).length && !(adminOutageResult.rows as RawRow[]).length) warnings.push('No administrative-area safety impact can be spatially resolved from the current boundaries/impact records.');

    return NextResponse.json({
      period: { from, to, label: `${from} → ${to}` },
      summary: {
        activeCorridors: numberValue(summaryRow.activeCorridors),
        linesWithCorridor: numberValue(summaryRow.linesWithCorridor),
        lineKmWithCorridor: round(numberValue(summaryRow.lineKmWithCorridor)),
        violations: numberValue(summaryRow.violations),
        openViolations: numberValue(summaryRow.openViolations),
        highCriticalViolations: numberValue(summaryRow.highCriticalViolations),
        overdueViolations: numberValue(summaryRow.overdueViolations),
        pendingHumanReview: numberValue(summaryRow.pendingHumanReview),
      },
      plannedOutages: {
        outages: outageSummary.count,
        hours: round(outageSummary.hours),
        affectedCustomers: Math.round(outageSummary.affectedCustomers),
        uniqueAffectedCustomers: Math.round(numberValue((outageUniqueResult.rows as RawRow[])[0]?.count)),
        affectedLoadMw: round(outageSummary.affectedLoadMw),
        criticalCustomers: Math.round(outageSummary.criticalCustomers),
        criticalFacilities: Math.round(outageSummary.criticalFacilities),
      },
      incidents: {
        incidents: incidentSummary.count,
        openIncidents: incidentSummary.openCount,
        resolvedIncidents: incidentSummary.resolvedCount,
        affectedCustomers: Math.round(incidentSummary.affectedCustomers),
        affectedLoadMw: round(incidentSummary.affectedLoadMw),
        mttrHours: incidentSummary.resolvedCount ? round(incidentSummary.restorationHours / incidentSummary.resolvedCount) : null,
      },
      aiVision: {
        runs: numberValue(aiRuns.runs),
        succeededRuns: numberValue(aiRuns.succeededRuns),
        failedRuns: numberValue(aiRuns.failedRuns),
        reviewedRuns: numberValue(aiRuns.reviewedRuns),
        detections: Array.from(aiDetectionCounts.values()).reduce((sum, value) => sum + value, 0),
        pendingDetections: aiDetectionCounts.get('PENDING_HUMAN_REVIEW') ?? 0,
        confirmedDetections: aiDetectionCounts.get('CONFIRMED') ?? 0,
        rejectedDetections: aiDetectionCounts.get('REJECTED') ?? 0,
        falsePositiveRate: reviewedDetections ? round((aiDetectionCounts.get('REJECTED') ?? 0) / reviewedDetections * 100) : null,
      },
      byVoltage: Array.from(voltageMap.values()).map((row) => ({ ...row, lineKm: round(numberValue(row.lineKm)) })).sort((a, b) => numberValue(b.openViolations) - numberValue(a.openViolations) || numberValue(a.voltageLevelKv) - numberValue(b.voltageLevelKv)),
      byLine: lineRecords.slice(0, 500).map((row) => ({ ...row, lengthKm: round(row.lengthKm) })),
      byFeeder: aggregateLines('feeder'),
      bySubstation: aggregateLines('substation'),
      byViolationType: (violationTypeResult.rows as RawRow[]).map((row) => ({ violationType: String(row.violationType), violations: numberValue(row.violations), openViolations: numberValue(row.openViolations), highCriticalViolations: numberValue(row.highCriticalViolations), aiDetected: numberValue(row.aiDetected), pendingHumanReview: numberValue(row.pendingHumanReview) })),
      bySource: (sourceResult.rows as RawRow[]).map((row) => ({ source: String(row.source), violations: numberValue(row.violations), openViolations: numberValue(row.openViolations), highCriticalViolations: numberValue(row.highCriticalViolations) })),
      byOutageSource: Array.from(outageSourceMap.values()).map((row) => ({ ...row, hours: round(numberValue(row.hours)), affectedCustomers: Math.round(numberValue(row.affectedCustomers)), affectedLoadMw: round(numberValue(row.affectedLoadMw)) })).sort((a, b) => numberValue(b.outages) - numberValue(a.outages)),
      byIncidentType: Array.from(incidentTypes.values()).map((row) => ({ ...row, affectedCustomers: Math.round(numberValue(row.affectedCustomers)), affectedLoadMw: round(numberValue(row.affectedLoadMw)), mttrHours: numberValue(row.resolvedCount) ? round(numberValue(row.restorationHours) / numberValue(row.resolvedCount)) : null })).sort((a, b) => numberValue(b.incidents) - numberValue(a.incidents)),
      byAdminArea: Array.from(adminMap.values()).map((row) => ({ ...row, plannedCustomers: Math.round(row.plannedCustomers), plannedLoadMw: round(row.plannedLoadMw) })).sort((a, b) => b.violations - a.violations || b.plannedCustomers - a.plannedCustomers),
      byMonth: (monthResult.rows as RawRow[]).map((row) => ({ month: String(row.month), violations: numberValue(row.violations), confirmedViolations: numberValue(row.confirmedViolations), outages: numberValue(row.outages), incidents: numberValue(row.incidents), aiDetections: numberValue(row.aiDetections), aiConfirmed: numberValue(row.aiConfirmed) })),
      warnings,
      method: {
        source: 'hệ thống GIS safety registry, grid topology, EVN outage impact, incident and AI Vision provenance tables.',
        lineKm: 'COALESCE(length_m, ST_Length(geometry::geography)) / 1000 for active power lines with current active corridor.',
        outageCustomers: 'Distinct affected customer/service-point records per outage; uniqueAffectedCustomers is distinct across the selected period.',
        mttr: 'Average resolvedAt - startedAt for incidents overlapping the selected period; planned outages are kept separate.',
        aiReview: 'CONFIRMED and REJECTED detections are counted only after human review; no AI score is treated as final truth.',
      },
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load safety analytics.' }, { status: 500 });
  }
}
