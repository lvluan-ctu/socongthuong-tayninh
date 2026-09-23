import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

function number(value: unknown) { return value == null ? 0 : Number(value); }

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const result = await db.execute(sql`
      WITH app_agg AS (
        SELECT app.applicant_party_id AS "partyId",
               COUNT(*)::int AS "applications",
               COALESCE(SUM(app.requested_power_kw), 0)::double precision AS "requestedPowerKw",
               COALESCE(SUM(CASE WHEN app.status IN ('APPROVED', 'CONVERTED') THEN COALESCE(app.approved_power_kw, 0) ELSE 0 END), 0)::double precision AS "approvedPowerKw",
               COUNT(*) FILTER (WHERE app.status IN ('APPROVED', 'CONVERTED'))::int AS "approvedApplications",
               COUNT(*) FILTER (WHERE app.status = 'CONVERTED')::int AS "convertedApplications",
               (ARRAY_AGG(app.status ORDER BY app.submitted_at DESC NULLS LAST))[1] AS "latestStatus",
               (ARRAY_AGG(COALESCE(site.admin_area_code, party.admin_area_code) ORDER BY app.submitted_at DESC NULLS LAST))[1] AS "areaCode"
        FROM energy_ev_station_applications app
        JOIN energy_parties party ON party.id = app.applicant_party_id
        LEFT JOIN energy_sites site ON site.id = app.site_id
        GROUP BY app.applicant_party_id
      ), station_agg AS (
        SELECT COALESCE(app.applicant_party_id, station.operator_party_id, asset.owner_party_id) AS "partyId",
               COUNT(*) FILTER (WHERE station.operation_status <> 'DECOMMISSIONED')::int AS "stations",
               COALESCE(SUM(CASE WHEN station.operation_status <> 'DECOMMISSIONED' THEN COALESCE(station.installed_power_kw, station.total_power_kw) ELSE 0 END), 0)::double precision AS "installedPowerKw"
        FROM energy_ev_stations station
        JOIN energy_assets asset ON asset.id = station.asset_id
        LEFT JOIN energy_ev_station_applications app ON app.id = station.application_id
        GROUP BY COALESCE(app.applicant_party_id, station.operator_party_id, asset.owner_party_id)
      )
       SELECT party.id AS "partyId", party.code, party.name, party.tax_code AS "taxCode", party.address, party.admin_area_code AS "adminAreaCode", party.phone, party.email,
              COUNT(*) OVER()::int AS "totalCount",
             COALESCE(app_agg."applications", 0)::int AS applications,
             COALESCE(app_agg."approvedApplications", 0)::int AS "approvedApplications",
             COALESCE(app_agg."convertedApplications", 0)::int AS "convertedApplications",
             COALESCE(app_agg."requestedPowerKw", 0)::double precision AS "requestedPowerKw",
             COALESCE(app_agg."approvedPowerKw", 0)::double precision AS "approvedPowerKw",
             COALESCE(station_agg."installedPowerKw", 0)::double precision AS "installedPowerKw",
             COALESCE(station_agg.stations, 0)::int AS stations,
             app_agg."latestStatus" AS "latestStatus",
             COALESCE(app_agg."areaCode", party.admin_area_code) AS "areaCode"
      FROM energy_parties party
      LEFT JOIN app_agg ON app_agg."partyId" = party.id
      LEFT JOIN station_agg ON station_agg."partyId" = party.id
      WHERE party.party_type = 'EV_APPLICANT' OR app_agg."partyId" IS NOT NULL OR station_agg."partyId" IS NOT NULL
       ORDER BY COALESCE(app_agg."applications", 0) DESC, party.name
       ${wantsPagination ? sql`LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}` : sql``}
     `);
    const total = Number((result.rows[0] as { totalCount?: number | string } | undefined)?.totalCount ?? (wantsPagination ? 0 : result.rows.length));
    const items = result.rows.map((row) => {
      const item = Object.fromEntries(Object.entries(row as { totalCount?: number | string; [key: string]: unknown }).filter(([key]) => key !== 'totalCount'));
      return {
      ...item,
      applications: number(row.applications),
      approvedApplications: number(row.approvedApplications),
      convertedApplications: number(row.convertedApplications),
      requestedPowerKw: number(row.requestedPowerKw),
      approvedPowerKw: number(row.approvedPowerKw),
      installedPowerKw: number(row.installedPowerKw),
      stations: number(row.stations),
      };
    });
    return wantsPagination ? paginatedResponse(items, pagination, total) : NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải danh sách khách hàng EV.' }, { status: 500 });
  }
}
