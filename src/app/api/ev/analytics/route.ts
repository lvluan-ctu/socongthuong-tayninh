import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { evAnalyticsFilterSchema } from '@/lib/ev-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type NumericRow = Record<string, string | number | null>;

function number(value: string | number | null | undefined) { return value == null ? 0 : Number(value); }

function statusFilter(status: string) {
  if (status === 'SUBMITTED') return sql`AND app.status IN ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFO', 'PRELIMINARY_OK', 'APPROVED', 'CONVERTED')`;
  if (status === 'APPROVED') return sql`AND app.status IN ('APPROVED', 'CONVERTED')`;
  if (status === 'OPERATING') return sql`AND app.status = 'CONVERTED'`;
  return sql``;
}

export async function GET(request: Request) {
  try {
    const raw = Object.fromEntries(new URL(request.url).searchParams.entries());
    const filters = evAnalyticsFilterSchema.parse(raw);
    const from = filters.from ?? '1900-01-01';
    const to = filters.to ?? '2999-12-31';
    const appDateFilter = sql`AND app.submitted_at >= ${from}::date AND app.submitted_at < (${to}::date + interval '1 day')`;
    const snapshotDateFilter = sql`AND snapshot.measured_at >= ${from}::date AND snapshot.measured_at < (${to}::date + interval '1 day')`;
    const sessionDateFilter = sql`AND session.started_at >= ${from}::date AND session.started_at < (${to}::date + interval '1 day')`;
    const appAreaFilter = filters.adminAreaCode ? sql`AND COALESCE(site.admin_area_code, party.admin_area_code, 'UNASSIGNED') = ${filters.adminAreaCode}` : sql``;
    const stationAreaFilter = filters.adminAreaCode ? sql`AND COALESCE(site.admin_area_code, 'UNASSIGNED') = ${filters.adminAreaCode}` : sql``;
    const appStatusFilter = statusFilter(filters.status);

    const [summaryResult, stationResult, snapshotResult, sessionResult, regionalResult, funnelResult, headroomResult, qualityResult] = await Promise.all([
      db.execute(sql`
        SELECT COUNT(*)::int AS "applications",
               COUNT(DISTINCT app.applicant_party_id)::int AS "uniqueApplicants",
               COALESCE(SUM(app.requested_power_kw), 0)::double precision AS "requestedPowerKw",
               COALESCE(SUM(CASE WHEN app.status IN ('APPROVED', 'CONVERTED') THEN COALESCE(app.approved_power_kw, 0) ELSE 0 END), 0)::double precision AS "approvedPowerKw",
               COALESCE(SUM(CASE WHEN app.status IN ('APPROVED', 'CONVERTED') THEN COALESCE(app.connection_capacity_kw, 0) ELSE 0 END), 0)::double precision AS "connectionCapacityKw"
        FROM energy_ev_station_applications app
        JOIN energy_parties party ON party.id = app.applicant_party_id
        LEFT JOIN energy_sites site ON site.id = app.site_id
        WHERE TRUE ${appDateFilter} ${appStatusFilter} ${appAreaFilter}
      `),
      db.execute(sql`
        SELECT COUNT(*) FILTER (WHERE station.operation_status <> 'DECOMMISSIONED')::int AS "stations",
               COUNT(*) FILTER (WHERE station.operation_status = 'ACTIVE')::int AS "operatingStations",
               COALESCE(SUM(CASE WHEN station.operation_status <> 'DECOMMISSIONED' THEN COALESCE(station.installed_power_kw, station.total_power_kw) ELSE 0 END), 0)::double precision AS "installedPowerKw",
               COALESCE(SUM(CASE WHEN station.operation_status <> 'DECOMMISSIONED' THEN station.connector_count ELSE 0 END), 0)::int AS "connectors"
        FROM energy_ev_stations station
        LEFT JOIN energy_sites site ON site.id = station.site_id
        WHERE TRUE ${stationAreaFilter}
      `),
      db.execute(sql`
        SELECT COALESCE(AVG(snapshot.utilization_pct), 0)::double precision AS "averageUtilizationPct",
               COALESCE(SUM(snapshot.energy_delivered_kwh), 0)::double precision AS "energyDeliveredKwh",
               COALESCE(MAX(snapshot.peak_power_kw), 0)::double precision AS "actualPeakPowerKw"
        FROM energy_ev_station_snapshots snapshot
        JOIN energy_ev_stations station ON station.asset_id = snapshot.station_asset_id
        LEFT JOIN energy_sites site ON site.id = station.site_id
        WHERE station.operation_status <> 'DECOMMISSIONED' ${snapshotDateFilter} ${stationAreaFilter}
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(session.energy_kwh), 0)::double precision AS "sessionEnergyKwh",
               COALESCE(MAX(session.peak_power_kw), 0)::double precision AS "sessionPeakPowerKw"
        FROM energy_ev_sessions session
        JOIN energy_ev_connectors connector ON connector.id = session.connector_id
        JOIN energy_ev_stations station ON station.asset_id = connector.station_asset_id
        LEFT JOIN energy_sites site ON site.id = station.site_id
        WHERE station.operation_status <> 'DECOMMISSIONED' ${sessionDateFilter} ${stationAreaFilter}
      `),
      db.execute(sql`
        WITH app_region AS (
          SELECT COALESCE(site.admin_area_code, party.admin_area_code, 'UNASSIGNED') AS "areaCode",
                 COALESCE(area.name, site.admin_area_code, party.admin_area_code, 'Chưa phân loại') AS "areaName",
                 COUNT(DISTINCT app.applicant_party_id)::int AS "uniqueApplicants",
                 COUNT(*)::int AS "applications",
                 COALESCE(SUM(app.requested_power_kw), 0)::double precision AS "requestedPowerKw",
                 COALESCE(SUM(CASE WHEN app.status IN ('APPROVED', 'CONVERTED') THEN COALESCE(app.approved_power_kw, 0) ELSE 0 END), 0)::double precision AS "approvedPowerKw",
                 COALESCE(SUM(CASE WHEN app.status IN ('APPROVED', 'CONVERTED') THEN COALESCE(app.connection_capacity_kw, 0) ELSE 0 END), 0)::double precision AS "connectionCapacityKw"
          FROM energy_ev_station_applications app
          JOIN energy_parties party ON party.id = app.applicant_party_id
          LEFT JOIN energy_sites site ON site.id = app.site_id
          LEFT JOIN energy_admin_areas area ON area.code = COALESCE(site.admin_area_code, party.admin_area_code)
          WHERE TRUE ${appDateFilter} ${appStatusFilter} ${appAreaFilter}
          GROUP BY COALESCE(site.admin_area_code, party.admin_area_code, 'UNASSIGNED'), COALESCE(area.name, site.admin_area_code, party.admin_area_code, 'Chưa phân loại')
        ), station_region AS (
          SELECT COALESCE(site.admin_area_code, 'UNASSIGNED') AS "areaCode",
                 COALESCE(area.name, site.admin_area_code, 'Chưa phân loại') AS "areaName",
                 COUNT(*) FILTER (WHERE station.operation_status <> 'DECOMMISSIONED')::int AS "stations",
                 COALESCE(SUM(CASE WHEN station.operation_status <> 'DECOMMISSIONED' THEN COALESCE(station.installed_power_kw, station.total_power_kw) ELSE 0 END), 0)::double precision AS "installedPowerKw",
                 COALESCE(SUM(CASE WHEN station.operation_status <> 'DECOMMISSIONED' THEN station.connector_count ELSE 0 END), 0)::int AS "connectors",
                 COALESCE(SUM(CASE WHEN station.operation_status <> 'DECOMMISSIONED' THEN station.available_count ELSE 0 END), 0)::int AS "availableConnectors"
          FROM energy_ev_stations station
          LEFT JOIN energy_sites site ON site.id = station.site_id
          LEFT JOIN energy_admin_areas area ON area.code = site.admin_area_code
          WHERE TRUE ${stationAreaFilter}
          GROUP BY COALESCE(site.admin_area_code, 'UNASSIGNED'), COALESCE(area.name, site.admin_area_code, 'Chưa phân loại')
        )
        SELECT COALESCE(app_region."areaCode", station_region."areaCode") AS "areaCode",
               COALESCE(app_region."areaName", station_region."areaName") AS "areaName",
               COALESCE(app_region."uniqueApplicants", 0)::int AS "uniqueApplicants",
               COALESCE(app_region."applications", 0)::int AS "applications",
               COALESCE(app_region."requestedPowerKw", 0)::double precision AS "requestedPowerKw",
               COALESCE(app_region."approvedPowerKw", 0)::double precision AS "approvedPowerKw",
               COALESCE(app_region."connectionCapacityKw", 0)::double precision AS "connectionCapacityKw",
               COALESCE(station_region."installedPowerKw", 0)::double precision AS "installedPowerKw",
               COALESCE(station_region."stations", 0)::int AS "stations",
               COALESCE(station_region."connectors", 0)::int AS "connectors",
               COALESCE(station_region."availableConnectors", 0)::int AS "availableConnectors"
        FROM app_region FULL OUTER JOIN station_region USING ("areaCode")
        ORDER BY COALESCE(app_region."requestedPowerKw", 0) DESC, COALESCE(station_region."installedPowerKw", 0) DESC
        LIMIT 100
      `),
      db.execute(sql`
        SELECT app.status, COUNT(*)::int AS count
        FROM energy_ev_station_applications app
        JOIN energy_parties party ON party.id = app.applicant_party_id
        LEFT JOIN energy_sites site ON site.id = app.site_id
        WHERE TRUE ${appDateFilter} ${appStatusFilter} ${appAreaFilter}
        GROUP BY app.status
        ORDER BY app.status
      `),
      db.execute(sql`
        WITH ranked AS (
          SELECT DISTINCT ON (COALESCE(assessment.confirmed_grid_asset_id, assessment.candidate_grid_asset_id))
                 COALESCE(assessment.confirmed_grid_asset_id, assessment.candidate_grid_asset_id) AS "gridAssetId",
                 asset.code AS "gridAssetCode", asset.name AS "gridAssetName",
                 assessment.assessment_type AS "assessmentType",
                 assessment.status,
                 assessment.assessed_at AS "assessedAt",
                 assessment.available_capacity_kw AS "availableCapacityKw",
                 assessment.approved_capacity_kw AS "approvedCapacityKw"
          FROM energy_ev_grid_assessments assessment
          JOIN energy_ev_station_applications app ON app.id = assessment.application_id
          JOIN energy_parties party ON party.id = app.applicant_party_id
          LEFT JOIN energy_sites site ON site.id = app.site_id
          LEFT JOIN energy_assets asset ON asset.id = COALESCE(assessment.confirmed_grid_asset_id, assessment.candidate_grid_asset_id)
          WHERE COALESCE(assessment.confirmed_grid_asset_id, assessment.candidate_grid_asset_id) IS NOT NULL
            ${appDateFilter} ${appStatusFilter} ${appAreaFilter}
          ORDER BY COALESCE(assessment.confirmed_grid_asset_id, assessment.candidate_grid_asset_id), assessment.assessed_at DESC
        )
        SELECT * FROM ranked ORDER BY "availableCapacityKw" NULLS FIRST, "gridAssetCode"
        LIMIT 100
      `),
      db.execute(sql`
        SELECT COUNT(*) FILTER (WHERE app.location IS NULL AND site.location IS NULL AND site.boundary IS NULL)::int AS "missingApplicationGeometry",
               COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM energy_ev_grid_assessments assessment WHERE assessment.application_id = app.id))::int AS "missingGridAssessment",
               COUNT(*) FILTER (WHERE app.status IN ('APPROVED', 'CONVERTED') AND app.approved_power_kw IS NULL)::int AS "approvedWithoutPower",
               COUNT(*)::int AS "totalApplications"
        FROM energy_ev_station_applications app
        JOIN energy_parties party ON party.id = app.applicant_party_id
        LEFT JOIN energy_sites site ON site.id = app.site_id
        WHERE TRUE ${appDateFilter} ${appStatusFilter} ${appAreaFilter}
      `),
    ]);

    const summary = (summaryResult.rows[0] ?? {}) as NumericRow;
    const station = (stationResult.rows[0] ?? {}) as NumericRow;
    const snapshot = (snapshotResult.rows[0] ?? {}) as NumericRow;
    const session = (sessionResult.rows[0] ?? {}) as NumericRow;
    const totals = {
      uniqueApplicants: number(summary.uniqueApplicants),
      applications: number(summary.applications),
      requestedPowerKw: number(summary.requestedPowerKw),
      approvedPowerKw: number(summary.approvedPowerKw),
      connectionCapacityKw: number(summary.connectionCapacityKw),
      installedPowerKw: number(station.installedPowerKw),
      stations: number(station.stations),
      operatingStations: number(station.operatingStations),
      connectors: number(station.connectors),
      averageUtilizationPct: number(snapshot.averageUtilizationPct),
      energyDeliveredKwh: number(snapshot.energyDeliveredKwh) || number(session.sessionEnergyKwh),
      actualPeakPowerKw: Math.max(number(snapshot.actualPeakPowerKw), number(session.sessionPeakPowerKw)),
    };
    const warnings: string[] = [];
    const quality = (qualityResult.rows[0] ?? {}) as NumericRow;
    if (totals.applications === 0) warnings.push('EV_ANALYTICS_EMPTY: chưa có hồ sơ trong bộ lọc; KPI bằng 0 và không phải dữ liệu giả.');
    if (number(quality.missingApplicationGeometry) > 0) warnings.push(`MISSING_GEOMETRY: ${number(quality.missingApplicationGeometry)} hồ sơ chưa có location/boundary thật.`);
    if (number(quality.missingGridAssessment) > 0) warnings.push(`MISSING_GRID_ASSESSMENT: ${number(quality.missingGridAssessment)} hồ sơ chưa có assessment/provenance lưới.`);
    if (number(quality.approvedWithoutPower) > 0) warnings.push(`MISSING_APPROVED_POWER: ${number(quality.approvedWithoutPower)} hồ sơ APPROVED/CONVERTED chưa có approved power.`);
    warnings.push('GRID_HEADROOM_IS_UNIQUE_ASSET: headroom trả theo assessment mới nhất của từng grid asset, không cộng lặp theo application.');

    return NextResponse.json({
      period: { from: filters.from ?? null, to: filters.to ?? null, adminAreaCode: filters.adminAreaCode ?? null, status: filters.status },
      totals,
      regional: regionalResult.rows,
      funnel: funnelResult.rows,
      gridHeadroom: headroomResult.rows.map((row) => ({ ...row, availableCapacityKw: number((row as NumericRow).availableCapacityKw), approvedCapacityKw: number((row as NumericRow).approvedCapacityKw) })),
      quality: { ...quality, missingApplicationGeometry: number(quality.missingApplicationGeometry), missingGridAssessment: number(quality.missingGridAssessment), approvedWithoutPower: number(quality.approvedWithoutPower), totalApplications: number(quality.totalApplications) },
      warnings,
      method: {
        source: 'PostgreSQL EV application/station/session/snapshot tables',
        uniqueCustomer: 'COUNT(DISTINCT applicant_party_id)',
        requestedPower: 'SUM(application.requested_power_kw)',
        approvedPower: "SUM(approved_power_kw) only for APPROVED/CONVERTED",
        installedPower: 'SUM(COALESCE(installed_power_kw, total_power_kw)) per Station Registry',
        gridHeadroom: 'latest assessment per unique candidate/confirmed grid asset; never summed per application',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Bộ lọc EV analytics không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải EV analytics.' }, { status: 500 });
  }
}
