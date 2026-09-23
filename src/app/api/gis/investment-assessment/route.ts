import { sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  INVESTMENT_TYPE_LABELS,
  INVESTMENT_TYPES,
  type AssessmentBreakdownItem,
  type InvestmentAssessmentResponse,
  type InvestmentDataCoverage,
  type InvestmentProcedure,
  type InvestmentScenario,
  type InvestmentType,
  type NearbyConsumer,
  type NearbyEmissionSource,
  type NearbyEvStation,
  type NearbyLine,
  type NearbyProject,
  type NearbyRooftopSystem,
  type NearbySafetyEvent,
  type NearbySubstation,
} from "@/lib/investment-assessment";

export const dynamic = "force-dynamic";

const querySchema = z
  .object({
    lat: z.coerce.number().min(10.2).max(12.25).optional(),
    lng: z.coerce.number().min(105.4).max(107.1).optional(),
    address: z.string().trim().min(2).max(240).optional(),
    radiusKm: z.coerce.number().min(1).max(30).default(10),
    investmentType: z.enum(INVESTMENT_TYPES).default("INDUSTRIAL"),
    expectedDemandKw: z.coerce.number().min(10).max(200_000).default(1_500),
    landAreaHa: z.coerce.number().min(0.1).max(10_000).default(5),
    roofAreaM2: z.coerce.number().min(0).max(5_000_000).default(10_000),
  })
  .refine((value) => (value.lat != null && value.lng != null) || Boolean(value.address), {
    message: "Cần cung cấp tọa độ hoặc địa chỉ tại Tây Ninh.",
  })
  .refine(
    (value) => (value.lat == null && value.lng == null) || (value.lat != null && value.lng != null),
    { message: "Vĩ độ và kinh độ phải được cung cấp cùng nhau." },
  );

type Row = Record<string, unknown>;

const LOAD_FACTOR_BY_TYPE: Record<InvestmentType, number> = {
  INDUSTRIAL: 0.58,
  LOGISTICS: 0.45,
  COMMERCIAL: 0.35,
  EV_HUB: 0.25,
  RENEWABLE: 0.18,
};

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown, fallback = "") {
  return value == null || value === "" ? fallback : String(value);
}

function rounded(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function vi(value: number, maximumFractionDigits = 0) {
  return value.toLocaleString("vi-VN", { maximumFractionDigits });
}

function breakdownStatus(score: number, maxScore: number): AssessmentBreakdownItem["status"] {
  const ratio = maxScore ? score / maxScore : 0;
  return ratio >= 0.72 ? "GOOD" : ratio >= 0.45 ? "WATCH" : "LIMITED";
}

function pointCoordinates(row: Row) {
  return { lat: nullableNumber(row.lat), lng: nullableNumber(row.lng) };
}

async function geocodeFromDatabase(address: string) {
  const pattern = `%${address.trim()}%`;
  const result = await db.execute(sql`
    SELECT lat, lng, display_name
    FROM (
      SELECT ST_Y(ST_PointOnSurface(boundary)) AS lat,
             ST_X(ST_PointOnSurface(boundary)) AS lng,
             name || ', Tỉnh Tây Ninh' AS display_name,
             1 AS priority
      FROM energy_admin_areas
      WHERE boundary IS NOT NULL AND name ILIKE ${pattern}
      UNION ALL
      SELECT ST_Y(location::geometry) AS lat,
             ST_X(location::geometry) AS lng,
             concat_ws(', ', name, NULLIF(address, '')) AS display_name,
             2 AS priority
      FROM energy_sites
      WHERE location IS NOT NULL
        AND concat_ws(' ', name, address) ILIKE ${pattern}
    ) matches
    ORDER BY priority, length(display_name)
    LIMIT 1
  `);
  const match = result.rows[0] as Row | undefined;
  if (!match) return null;
  return {
    lat: number(match.lat),
    lng: number(match.lng),
    displayName: text(match.display_name),
    source: "LOCAL_POSTGIS" as const,
  };
}

async function geocodeFromNominatim(address: string) {
  const params = new URLSearchParams({
    q: `${address}, Tây Ninh, Việt Nam`,
    format: "jsonv2",
    limit: "5",
    countrycodes: "vn",
    addressdetails: "1",
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "TayNinh-Energy-GIS/2.0 (investment-location-assessment)",
    },
    signal: AbortSignal.timeout(12_000),
    next: { revalidate: 86_400 },
  });
  if (!response.ok) throw new Error("Dịch vụ tìm kiếm địa chỉ tạm thời không phản hồi.");
  const rows = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;
  const match = rows.find((row) => /tây ninh|tay ninh/i.test(row.display_name)) ?? rows[0];
  if (!match) {
    throw new Error(
      "Không tìm thấy địa chỉ. Hãy nhập địa chỉ chi tiết hơn hoặc chọn trực tiếp trên bản đồ.",
    );
  }
  return {
    lat: Number(match.lat),
    lng: Number(match.lon),
    displayName: match.display_name,
    source: "NOMINATIM" as const,
  };
}

async function geocode(address: string) {
  return (await geocodeFromDatabase(address)) ?? geocodeFromNominatim(address);
}

function buildScenarios(input: {
  score: number;
  expectedDemandKw: number;
  gridHeadroomKw: number;
  rooftopPotentialKwp: number;
  loadFactor: number;
  emissionFactor: number;
}) {
  const variants: Array<{
    id: InvestmentScenario["id"];
    label: string;
    demandFactor: number;
    rooftopFactor: number;
    scoreOffset: number;
  }> = [
    {
      id: "CONSERVATIVE",
      label: "Khởi động thận trọng",
      demandFactor: 0.7,
      rooftopFactor: 0.6,
      scoreOffset: 3,
    },
    { id: "BASE", label: "Phương án cơ sở", demandFactor: 1, rooftopFactor: 1, scoreOffset: 0 },
    {
      id: "GROWTH",
      label: "Mở rộng tăng trưởng",
      demandFactor: 1.35,
      rooftopFactor: 1,
      scoreOffset: -3,
    },
  ];

  return variants.map<InvestmentScenario>((variant) => {
    const demandKw = Math.round(input.expectedDemandKw * variant.demandFactor);
    const annualElectricityMwh = (demandKw * 8_760 * input.loadFactor) / 1_000;
    const rooftopKwp = Math.round(input.rooftopPotentialKwp * variant.rooftopFactor);
    const rooftopAnnualOutputMwh = rooftopKwp * 1.45;
    const renewableCoveragePct = annualElectricityMwh
      ? clamp((rooftopAnnualOutputMwh / annualElectricityMwh) * 100, 0, 100)
      : 0;
    const gridCoveragePct = demandKw ? (input.gridHeadroomKw / demandKw) * 100 : 0;
    const estimatedAnnualCo2eTonnes =
      Math.max(annualElectricityMwh - rooftopAnnualOutputMwh, 0) * input.emissionFactor;
    const status: InvestmentScenario["status"] =
      input.gridHeadroomKw >= demandKw * 1.2
        ? "READY"
        : input.gridHeadroomKw >= demandKw
          ? "CONDITIONAL"
          : "CAPACITY_REVIEW";
    const scenarioScore = clamp(
      Math.round(
        input.score +
          variant.scoreOffset +
          (status === "READY" ? 2 : status === "CAPACITY_REVIEW" ? -12 : -3),
      ),
      0,
      100,
    );

    return {
      id: variant.id,
      label: variant.label,
      status,
      score: scenarioScore,
      demandKw,
      gridCoveragePct: rounded(gridCoveragePct, 1),
      rooftopKwp,
      rooftopAnnualOutputMwh: rounded(rooftopAnnualOutputMwh, 1),
      renewableCoveragePct: rounded(renewableCoveragePct, 1),
      estimatedAnnualCo2eTonnes: rounded(estimatedAnnualCo2eTonnes, 1),
      headline:
        status === "READY"
          ? "Dư địa lưới sơ bộ đáp ứng quy mô kịch bản"
          : status === "CONDITIONAL"
            ? "Có thể triển khai khi xác nhận phương án đấu nối"
            : "Cần nâng cấp hoặc điều chỉnh quy mô phụ tải",
      rationale: [
        `Phụ tải cực đại giả định ${vi(demandKw)} kW, tương đương ${vi(annualElectricityMwh, 1)} MWh/năm.`,
        `Điện mặt trời mái nhà ${vi(rooftopKwp)} kWp có thể bù khoảng ${vi(renewableCoveragePct, 1)}% điện năng kịch bản.`,
        `Phát thải điện mua vào ước tính ${vi(estimatedAnnualCo2eTonnes, 1)} tCO₂e/năm sau khi trừ sản lượng mái nhà.`,
      ],
    };
  });
}

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Tham số đánh giá không hợp lệ." },
      { status: 400 },
    );
  }

  try {
    const input = parsed.data;
    const geocoded =
      input.lat == null || input.lng == null ? await geocode(input.address ?? "") : null;
    const lat = input.lat ?? geocoded!.lat;
    const lng = input.lng ?? geocoded!.lng;
    const radiusMeters = input.radiusKm * 1_000;

    const [
      areaResult,
      projectResult,
      substationResult,
      lineResult,
      rooftopResult,
      evResult,
      safetyResult,
      emissionResult,
      consumerResult,
      summaryResult,
    ] = await Promise.all([
      db.execute(sql`
        WITH p AS (SELECT ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326) AS geom)
        SELECT code, name, level
        FROM energy_admin_areas, p
        WHERE boundary IS NOT NULL AND ST_Covers(boundary, p.geom)
        ORDER BY CASE
          WHEN level IN ('COMMUNE', 'WARD', 'XA', 'PHUONG') THEN 1
          WHEN level IN ('DISTRICT', 'HUYEN', 'CITY') THEN 2
          WHEN level = 'PROVINCE' THEN 3
          ELSE 4
        END
        LIMIT 1
      `),
      db.execute(sql`
        WITH p AS (SELECT ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography AS geog)
        SELECT a.id::text, a.code, a.name, g.source_type, g.operation_status,
               g.designed_capacity_mw,
               ROUND((ST_Distance(COALESCE(a.location, s.location), p.geog) / 1000)::numeric, 2) AS distance_km,
               ST_Y(COALESCE(a.location, s.location)::geometry) AS lat,
               ST_X(COALESCE(a.location, s.location)::geometry) AS lng
        FROM energy_generation_projects g
        JOIN energy_assets a ON a.id = g.asset_id
        LEFT JOIN energy_sites s ON s.id = COALESCE(g.site_id, a.site_id)
        CROSS JOIN p
        WHERE COALESCE(a.location, s.location) IS NOT NULL
          AND ST_DWithin(COALESCE(a.location, s.location), p.geog, ${radiusMeters})
        ORDER BY ST_Distance(COALESCE(a.location, s.location), p.geog)
        LIMIT 10
      `),
      db.execute(sql`
        WITH p AS (SELECT ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography AS geog)
        SELECT a.id::text, a.code, a.name, s.voltage_level_kv, s.installed_capacity_mva,
               s.current_load_mva, s.available_capacity_mva, s.load_factor_pct, s.overload_status,
               COALESCE(f.feeder_headroom_mw, 0) AS feeder_headroom_mw,
               COALESCE(c.available_capacity_mw, 0) AS assessed_available_mw,
               ROUND((ST_Distance(COALESCE(a.location, si.location), p.geog) / 1000)::numeric, 2) AS distance_km,
               ST_Y(COALESCE(a.location, si.location)::geometry) AS lat,
               ST_X(COALESCE(a.location, si.location)::geometry) AS lng
        FROM energy_substations s
        JOIN energy_assets a ON a.id = s.asset_id
        LEFT JOIN energy_sites si ON si.id = a.site_id
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(GREATEST(COALESCE(ef.headroom_mw, 0), 0)), 0) AS feeder_headroom_mw
          FROM energy_feeders ef WHERE ef.substation_asset_id = s.asset_id
        ) f ON true
        LEFT JOIN LATERAL (
          SELECT ca.available_capacity_mw
          FROM energy_grid_capacity_assessments ca
          WHERE ca.asset_id = s.asset_id
          ORDER BY ca.assessed_at DESC LIMIT 1
        ) c ON true
        CROSS JOIN p
        WHERE COALESCE(a.location, si.location) IS NOT NULL
          AND ST_DWithin(COALESCE(a.location, si.location), p.geog, ${radiusMeters})
        ORDER BY ST_Distance(COALESCE(a.location, si.location), p.geog)
        LIMIT 10
      `),
      db.execute(sql`
        WITH p AS (
          SELECT ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326) AS geom,
                 ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography AS geog
        )
        SELECT a.id::text, a.code, a.name, l.voltage_level_kv, l.rated_capacity_mw,
               l.current_load_mw,
               GREATEST(COALESCE(l.rated_capacity_mw, 0) - COALESCE(l.current_load_mw, 0), 0) AS headroom_mw,
               CASE WHEN COALESCE(l.rated_capacity_mw, 0) > 0
                    THEN l.current_load_mw / l.rated_capacity_mw * 100 ELSE 0 END AS load_factor_pct,
               ROUND((ST_Distance(l.geometry::geography, p.geog) / 1000)::numeric, 2) AS distance_km,
               ST_Y(ST_ClosestPoint(l.geometry, p.geom)) AS lat,
               ST_X(ST_ClosestPoint(l.geometry, p.geom)) AS lng
        FROM energy_power_lines l
        JOIN energy_assets a ON a.id = l.asset_id
        CROSS JOIN p
        WHERE l.geometry IS NOT NULL
          AND ST_DWithin(l.geometry::geography, p.geog, ${radiusMeters})
        ORDER BY ST_Distance(l.geometry::geography, p.geog)
        LIMIT 12
      `),
      db.execute(sql`
        WITH p AS (SELECT ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography AS geog)
        SELECT a.id::text, a.code, a.name, COALESCE(owner.name, a.name) AS owner,
               r.installed_capacity_kwp, r.operation_status,
               ROUND((ST_Distance(COALESCE(a.location, si.location), p.geog) / 1000)::numeric, 2) AS distance_km,
               ST_Y(COALESCE(a.location, si.location)::geometry) AS lat,
               ST_X(COALESCE(a.location, si.location)::geometry) AS lng
        FROM energy_rooftop_systems r
        JOIN energy_assets a ON a.id = r.asset_id
        LEFT JOIN energy_customer_accounts ca ON ca.id = r.customer_account_id
        LEFT JOIN energy_parties owner ON owner.id = ca.party_id
        LEFT JOIN energy_sites si ON si.id = COALESCE(ca.site_id, a.site_id)
        CROSS JOIN p
        WHERE COALESCE(a.location, si.location) IS NOT NULL
          AND ST_DWithin(COALESCE(a.location, si.location), p.geog, ${radiusMeters})
        ORDER BY ST_Distance(COALESCE(a.location, si.location), p.geog)
        LIMIT 10
      `),
      db.execute(sql`
        WITH p AS (SELECT ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography AS geog)
        SELECT a.id::text, a.code, a.name, e.total_power_kw, e.connector_count,
               e.available_count, e.operation_status,
               ROUND((ST_Distance(COALESCE(a.location, si.location), p.geog) / 1000)::numeric, 2) AS distance_km,
               ST_Y(COALESCE(a.location, si.location)::geometry) AS lat,
               ST_X(COALESCE(a.location, si.location)::geometry) AS lng
        FROM energy_ev_stations e
        JOIN energy_assets a ON a.id = e.asset_id
        LEFT JOIN energy_sites si ON si.id = COALESCE(e.site_id, a.site_id)
        CROSS JOIN p
        WHERE COALESCE(a.location, si.location) IS NOT NULL
          AND ST_DWithin(COALESCE(a.location, si.location), p.geog, ${radiusMeters})
        ORDER BY ST_Distance(COALESCE(a.location, si.location), p.geog)
        LIMIT 12
      `),
      db.execute(sql`
        WITH p AS (SELECT ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography AS geog),
        events AS (
          SELECT i.id, 'GRID_INCIDENT'::text AS kind, i.code,
                 COALESCE(a.name, i.incident_type) AS name, i.severity, i.status,
                 i.started_at AS occurred_at, COALESCE(a.location, si.location) AS location
          FROM energy_grid_incidents i
          LEFT JOIN energy_assets a ON a.id = i.asset_id
          LEFT JOIN energy_sites si ON si.id = a.site_id
          UNION ALL
          SELECT v.id, 'CORRIDOR_VIOLATION'::text, v.code,
                 COALESCE(a.name, v.violation_type), v.severity, v.status,
                 v.detected_at, COALESCE(v.location, ST_PointOnSurface(c.geometry)::geography)
          FROM energy_corridor_violations v
          JOIN energy_protection_corridors c ON c.id = v.corridor_id
          LEFT JOIN energy_assets a ON a.id = c.asset_id
        )
        SELECT e.id::text, e.kind, e.code, e.name, e.severity, e.status, e.occurred_at,
               ROUND((ST_Distance(e.location, p.geog) / 1000)::numeric, 2) AS distance_km,
               ST_Y(e.location::geometry) AS lat, ST_X(e.location::geometry) AS lng
        FROM events e CROSS JOIN p
        WHERE e.location IS NOT NULL AND ST_DWithin(e.location, p.geog, ${radiusMeters})
        ORDER BY ST_Distance(e.location, p.geog), e.occurred_at DESC
        LIMIT 12
      `),
      db.execute(sql`
        WITH p AS (SELECT ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography AS geog)
        SELECT e.id::text, e.code, e.name, e.source_type, e.scope, e.status,
               COALESCE(activity.co2e_kg, 0) / 1000 AS recorded_co2e_tonnes,
               activity.latest_period, COALESCE(obligation.total, 0) AS reporting_obligations,
               ROUND((ST_Distance(si.location, p.geog) / 1000)::numeric, 2) AS distance_km,
               ST_Y(si.location::geometry) AS lat, ST_X(si.location::geometry) AS lng
        FROM energy_emission_sources e
        JOIN energy_sites si ON si.id = e.site_id
        LEFT JOIN LATERAL (
          SELECT SUM(a.co2e_kg) AS co2e_kg, MAX(a.period) AS latest_period
          FROM energy_emission_activities a WHERE a.source_id = e.id
        ) activity ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS total FROM energy_reporting_obligations o
          WHERE o.party_id = e.party_id
        ) obligation ON true
        CROSS JOIN p
        WHERE si.location IS NOT NULL AND ST_DWithin(si.location, p.geog, ${radiusMeters})
        ORDER BY ST_Distance(si.location, p.geog)
        LIMIT 10
      `),
      db.execute(sql`
        WITH p AS (SELECT ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography AS geog)
        SELECT c.id::text, owner.code, owner.name, c.sector, c.classification,
               c.importance_level, COALESCE(report.reported_energy_kwh, 0) / 1000 AS reported_energy_mwh,
               ROUND((ST_Distance(si.location, p.geog) / 1000)::numeric, 2) AS distance_km,
               ST_Y(si.location::geometry) AS lat, ST_X(si.location::geometry) AS lng
        FROM energy_consumers c
        JOIN energy_parties owner ON owner.id = c.party_id
        JOIN energy_sites si ON si.id = c.site_id
        LEFT JOIN LATERAL (
          SELECT r.reported_energy_kwh FROM energy_consumer_reports r
          WHERE r.consumer_id = c.id ORDER BY r.period DESC LIMIT 1
        ) report ON true
        CROSS JOIN p
        WHERE si.location IS NOT NULL AND ST_DWithin(si.location, p.geog, ${radiusMeters})
        ORDER BY ST_Distance(si.location, p.geog)
        LIMIT 12
      `),
      db.execute(sql`
        WITH p AS (SELECT ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography AS geog)
        SELECT
          (SELECT COUNT(*) FROM energy_generation_projects g
            JOIN energy_assets a ON a.id = g.asset_id
            LEFT JOIN energy_sites s ON s.id = COALESCE(g.site_id, a.site_id), p
            WHERE COALESCE(a.location, s.location) IS NOT NULL
              AND ST_DWithin(COALESCE(a.location, s.location), p.geog, ${radiusMeters}))::int AS project_count,
          (SELECT COALESCE(SUM(g.designed_capacity_mw), 0) FROM energy_generation_projects g
            JOIN energy_assets a ON a.id = g.asset_id
            LEFT JOIN energy_sites s ON s.id = COALESCE(g.site_id, a.site_id), p
            WHERE COALESCE(a.location, s.location) IS NOT NULL
              AND ST_DWithin(COALESCE(a.location, s.location), p.geog, ${radiusMeters}))::numeric AS generation_capacity_mw,
          (SELECT COUNT(*) FROM energy_substations ss
            JOIN energy_assets a ON a.id = ss.asset_id LEFT JOIN energy_sites s ON s.id = a.site_id, p
            WHERE COALESCE(a.location, s.location) IS NOT NULL
              AND ST_DWithin(COALESCE(a.location, s.location), p.geog, ${radiusMeters}))::int AS substation_count,
          (SELECT COALESCE(SUM(ss.available_capacity_mva), 0) FROM energy_substations ss
            JOIN energy_assets a ON a.id = ss.asset_id LEFT JOIN energy_sites s ON s.id = a.site_id, p
            WHERE COALESCE(a.location, s.location) IS NOT NULL
              AND ST_DWithin(COALESCE(a.location, s.location), p.geog, ${radiusMeters}))::numeric AS available_capacity_mva,
          (SELECT COALESCE(MAX(ss.available_capacity_mva), 0) FROM energy_substations ss
            JOIN energy_assets a ON a.id = ss.asset_id LEFT JOIN energy_sites s ON s.id = a.site_id, p
            WHERE COALESCE(a.location, s.location) IS NOT NULL
              AND ST_DWithin(COALESCE(a.location, s.location), p.geog, ${radiusMeters}))::numeric AS best_substation_available_mva,
          (SELECT COALESCE(MAX(ss.voltage_level_kv), 0) FROM energy_substations ss
            JOIN energy_assets a ON a.id = ss.asset_id LEFT JOIN energy_sites s ON s.id = a.site_id, p
            WHERE COALESCE(a.location, s.location) IS NOT NULL
              AND ST_DWithin(COALESCE(a.location, s.location), p.geog, ${radiusMeters}))::numeric AS max_substation_voltage_kv,
          (SELECT COUNT(*) FROM energy_power_lines l, p
            WHERE l.geometry IS NOT NULL AND ST_DWithin(l.geometry::geography, p.geog, ${radiusMeters}))::int AS line_count,
          (SELECT COALESCE(MAX(l.voltage_level_kv), 0) FROM energy_power_lines l, p
            WHERE l.geometry IS NOT NULL AND ST_DWithin(l.geometry::geography, p.geog, ${radiusMeters}))::numeric AS max_line_voltage_kv,
          (SELECT COALESCE(MAX(GREATEST(COALESCE(l.rated_capacity_mw, 0) - COALESCE(l.current_load_mw, 0), 0)), 0)
            FROM energy_power_lines l, p WHERE l.geometry IS NOT NULL
              AND ST_DWithin(l.geometry::geography, p.geog, ${radiusMeters}))::numeric AS best_line_headroom_mw,
          (SELECT COALESCE(MAX(GREATEST(COALESCE(f.headroom_mw, 0), 0)), 0)
            FROM energy_feeders f JOIN energy_assets a ON a.id = f.asset_id
            LEFT JOIN energy_sites s ON s.id = a.site_id, p
            WHERE COALESCE(a.location, s.location) IS NOT NULL
              AND ST_DWithin(COALESCE(a.location, s.location), p.geog, ${radiusMeters}))::numeric AS best_feeder_headroom_mw,
          (SELECT COALESCE(MAX(ca.available_capacity_mw), 0)
            FROM energy_grid_capacity_assessments ca JOIN energy_assets a ON a.id = ca.asset_id
            LEFT JOIN energy_sites s ON s.id = a.site_id, p
            WHERE COALESCE(a.location, s.location) IS NOT NULL
              AND ST_DWithin(COALESCE(a.location, s.location), p.geog, ${radiusMeters}))::numeric AS assessed_capacity_mw,
          (SELECT COUNT(*) FROM energy_rooftop_systems r
            JOIN energy_assets a ON a.id = r.asset_id LEFT JOIN energy_sites s ON s.id = a.site_id, p
            WHERE COALESCE(a.location, s.location) IS NOT NULL
              AND ST_DWithin(COALESCE(a.location, s.location), p.geog, ${radiusMeters}))::int AS rooftop_count,
          (SELECT COALESCE(SUM(r.installed_capacity_kwp), 0) / 1000 FROM energy_rooftop_systems r
            JOIN energy_assets a ON a.id = r.asset_id LEFT JOIN energy_sites s ON s.id = a.site_id, p
            WHERE COALESCE(a.location, s.location) IS NOT NULL
              AND ST_DWithin(COALESCE(a.location, s.location), p.geog, ${radiusMeters}))::numeric AS rooftop_capacity_mw,
          (SELECT COUNT(*) FROM energy_ev_stations e
            JOIN energy_assets a ON a.id = e.asset_id LEFT JOIN energy_sites s ON s.id = COALESCE(e.site_id, a.site_id), p
            WHERE COALESCE(a.location, s.location) IS NOT NULL
              AND ST_DWithin(COALESCE(a.location, s.location), p.geog, ${radiusMeters}))::int AS ev_count,
          (SELECT COALESCE(SUM(e.total_power_kw), 0) FROM energy_ev_stations e
            JOIN energy_assets a ON a.id = e.asset_id LEFT JOIN energy_sites s ON s.id = COALESCE(e.site_id, a.site_id), p
            WHERE COALESCE(a.location, s.location) IS NOT NULL
              AND ST_DWithin(COALESCE(a.location, s.location), p.geog, ${radiusMeters}))::numeric AS ev_power_kw,
          (SELECT COALESCE(SUM(e.connector_count), 0) FROM energy_ev_stations e
            JOIN energy_assets a ON a.id = e.asset_id LEFT JOIN energy_sites s ON s.id = COALESCE(e.site_id, a.site_id), p
            WHERE COALESCE(a.location, s.location) IS NOT NULL
              AND ST_DWithin(COALESCE(a.location, s.location), p.geog, ${radiusMeters}))::int AS ev_connectors,
          (SELECT COALESCE(SUM(e.available_count), 0) FROM energy_ev_stations e
            JOIN energy_assets a ON a.id = e.asset_id LEFT JOIN energy_sites s ON s.id = COALESCE(e.site_id, a.site_id), p
            WHERE COALESCE(a.location, s.location) IS NOT NULL
              AND ST_DWithin(COALESCE(a.location, s.location), p.geog, ${radiusMeters}))::int AS ev_available_connectors,
          (SELECT COUNT(*) FROM energy_grid_incidents i
            LEFT JOIN energy_assets a ON a.id = i.asset_id LEFT JOIN energy_sites s ON s.id = a.site_id, p
            WHERE i.status NOT IN ('CLOSED', 'RESOLVED', 'COMPLETED')
              AND COALESCE(a.location, s.location) IS NOT NULL
              AND ST_DWithin(COALESCE(a.location, s.location), p.geog, ${radiusMeters}))::int AS active_incidents,
          (SELECT COUNT(*) FROM energy_grid_incidents i
            LEFT JOIN energy_assets a ON a.id = i.asset_id LEFT JOIN energy_sites s ON s.id = a.site_id, p
            WHERE i.started_at >= NOW() - INTERVAL '12 months'
              AND COALESCE(a.location, s.location) IS NOT NULL
              AND ST_DWithin(COALESCE(a.location, s.location), p.geog, ${radiusMeters}))::int AS incidents_12_months,
          (SELECT COUNT(*) FROM energy_corridor_violations v
            JOIN energy_protection_corridors c ON c.id = v.corridor_id, p
            WHERE v.status NOT IN ('CLOSED', 'RESOLVED', 'COMPLETED')
              AND ST_DWithin(COALESCE(v.location, ST_PointOnSurface(c.geometry)::geography), p.geog, ${radiusMeters}))::int AS corridor_violations,
          (SELECT COUNT(DISTINCT o.id) FROM energy_outage_plans o, p
            WHERE o.start_at >= NOW() - INTERVAL '12 months' AND (
              (o.affected_geometry IS NOT NULL AND ST_DWithin(o.affected_geometry::geography, p.geog, ${radiusMeters}))
              OR EXISTS (
                SELECT 1 FROM energy_outage_affected_assets oa
                JOIN energy_assets a ON a.id = oa.asset_id LEFT JOIN energy_sites s ON s.id = a.site_id
                WHERE oa.outage_id = o.id AND COALESCE(a.location, s.location) IS NOT NULL
                  AND ST_DWithin(COALESCE(a.location, s.location), p.geog, ${radiusMeters})
              )
            ))::int AS outage_plans_12_months,
          (SELECT COUNT(*) FROM energy_emission_sources e JOIN energy_sites s ON s.id = e.site_id, p
            WHERE s.location IS NOT NULL AND ST_DWithin(s.location, p.geog, ${radiusMeters}))::int AS emission_source_count,
          (SELECT COALESCE(SUM(activity.co2e_kg), 0) / 1000
            FROM energy_emission_sources e JOIN energy_sites s ON s.id = e.site_id
            LEFT JOIN LATERAL (SELECT SUM(a.co2e_kg) AS co2e_kg FROM energy_emission_activities a WHERE a.source_id = e.id) activity ON true, p
            WHERE s.location IS NOT NULL AND ST_DWithin(s.location, p.geog, ${radiusMeters}))::numeric AS recorded_co2e_tonnes,
          (SELECT COUNT(DISTINCT o.id) FROM energy_reporting_obligations o
            JOIN energy_emission_sources e ON e.party_id = o.party_id JOIN energy_sites s ON s.id = e.site_id, p
            WHERE o.status NOT IN ('COMPLETED', 'APPROVED', 'CLOSED')
              AND s.location IS NOT NULL AND ST_DWithin(s.location, p.geog, ${radiusMeters}))::int AS pending_obligations,
          (SELECT COUNT(*) FROM energy_consumers c JOIN energy_sites s ON s.id = c.site_id, p
            WHERE s.location IS NOT NULL AND ST_DWithin(s.location, p.geog, ${radiusMeters}))::int AS consumer_count,
          (SELECT COUNT(*) FROM energy_consumers c JOIN energy_sites s ON s.id = c.site_id, p
            WHERE (c.classification IN ('KEY_ENERGY_USER', 'KEY_CONSUMER') OR c.reporting_required = 'YES' OR c.importance_level IN ('HIGH', 'CRITICAL'))
              AND s.location IS NOT NULL AND ST_DWithin(s.location, p.geog, ${radiusMeters}))::int AS key_consumer_count,
          (SELECT factor_value FROM energy_emission_factors
            WHERE activity_type = 'ELECTRICITY_CONSUMPTION' ORDER BY valid_from DESC LIMIT 1)::numeric AS emission_factor,
          (SELECT factor_unit FROM energy_emission_factors
            WHERE activity_type = 'ELECTRICITY_CONSUMPTION' ORDER BY valid_from DESC LIMIT 1) AS emission_factor_unit,
          (SELECT source_ref FROM energy_emission_factors
            WHERE activity_type = 'ELECTRICITY_CONSUMPTION' ORDER BY valid_from DESC LIMIT 1) AS emission_factor_source,
          (SELECT COUNT(*) FROM energy_data_sources WHERE status = 'ACTIVE')::int AS active_data_sources,
          (SELECT MAX(COALESCE(last_sync_at, last_source_updated_at, updated_at))
            FROM energy_data_sources WHERE status = 'ACTIVE') AS last_data_sync
      `),
    ]);

    const area = (areaResult.rows[0] ?? null) as Row | null;
    const summary = (summaryResult.rows[0] ?? {}) as Row;
    const projectRows = projectResult.rows as Row[];
    const substationRows = substationResult.rows as Row[];
    const lineRows = lineResult.rows as Row[];
    const rooftopRows = rooftopResult.rows as Row[];
    const evRows = evResult.rows as Row[];
    const safetyRows = safetyResult.rows as Row[];
    const emissionRows = emissionResult.rows as Row[];
    const consumerRows = consumerResult.rows as Row[];

    const projectCount = number(summary.project_count);
    const generationCapacityMw = number(summary.generation_capacity_mw);
    const substationCount = number(summary.substation_count);
    const availableCapacityMva = number(summary.available_capacity_mva);
    const lineCount = number(summary.line_count);
    const rooftopSystems = number(summary.rooftop_count);
    const rooftopCapacityMw = number(summary.rooftop_capacity_mw);
    const evStations = number(summary.ev_count);
    const activeIncidents = number(summary.active_incidents);
    const incidents12Months = number(summary.incidents_12_months);
    const corridorViolations = number(summary.corridor_violations);
    const outagePlans12Months = number(summary.outage_plans_12_months);
    const emissionSources = number(summary.emission_source_count);
    const consumers = number(summary.consumer_count);
    const keyConsumers = number(summary.key_consumer_count);
    const nearestSubstationKm = substationRows.length
      ? number(substationRows[0]!.distance_km)
      : null;
    const nearestLineKm = lineRows.length ? number(lineRows[0]!.distance_km) : null;
    const nearestEvStationKm = evRows.length ? number(evRows[0]!.distance_km) : null;
    const maxVoltageKv = Math.max(
      number(summary.max_line_voltage_kv),
      number(summary.max_substation_voltage_kv),
    );
    const bestLineHeadroomMw = number(summary.best_line_headroom_mw);
    const bestSubstationHeadroomMw = number(summary.best_substation_available_mva) * 0.9;
    const bestFeederHeadroomMw = number(summary.best_feeder_headroom_mw);
    const assessedCapacityMw = number(summary.assessed_capacity_mw);
    const gridHeadroomKw = Math.round(
      Math.max(
        bestLineHeadroomMw,
        bestSubstationHeadroomMw,
        bestFeederHeadroomMw,
        assessedCapacityMw,
      ) * 1_000,
    );
    const connectionCandidates = [bestLineHeadroomMw, bestSubstationHeadroomMw].filter(
      (value) => value > 0,
    );
    const estimatedConnectionHeadroomKw = Math.round(
      (connectionCandidates.length ? Math.min(...connectionCandidates) : gridHeadroomKw / 1_000) *
        1_000,
    );
    const demandCoveragePct = input.expectedDemandKw
      ? (estimatedConnectionHeadroomKw / input.expectedDemandKw) * 100
      : 0;
    const threePhaseReadiness =
      maxVoltageKv >= 22 &&
      nearestLineKm != null &&
      nearestLineKm <= 3 &&
      estimatedConnectionHeadroomKw >= input.expectedDemandKw
        ? "AVAILABLE_PRELIMINARY"
        : maxVoltageKv >= 22 && nearestLineKm != null
          ? "LIMITED"
          : "SURVEY_REQUIRED";
    const stabilityIndex = clamp(
      Math.round(
        100 -
          activeIncidents * 8 -
          incidents12Months * 5 -
          corridorViolations * 3 -
          outagePlans12Months * 2,
      ),
      0,
      100,
    );
    const loadFactor = LOAD_FACTOR_BY_TYPE[input.investmentType];
    const emissionFactor = number(summary.emission_factor);
    const annualElectricityMwh = (input.expectedDemandKw * 8_760 * loadFactor) / 1_000;
    const rooftopPotentialKwp = Math.round(
      Math.min(input.roofAreaM2 * 0.16, estimatedConnectionHeadroomKw * 0.8),
    );
    const rooftopAnnualOutputMwh = rooftopPotentialKwp * 1.45;
    const renewableCoveragePct = annualElectricityMwh
      ? clamp((rooftopAnnualOutputMwh / annualElectricityMwh) * 100, 0, 100)
      : 0;
    const estimatedOperationalCo2eTonnes =
      Math.max(annualElectricityMwh - rooftopAnnualOutputMwh, 0) * emissionFactor;

    const gridScore =
      (nearestLineKm == null
        ? 0
        : nearestLineKm <= 1
          ? 8
          : nearestLineKm <= 3
            ? 6
            : nearestLineKm <= 7
              ? 3
              : 1) +
      (nearestSubstationKm == null
        ? 0
        : nearestSubstationKm <= 3
          ? 7
          : nearestSubstationKm <= 7
            ? 5
            : nearestSubstationKm <= 12
              ? 2
              : 1) +
      (demandCoveragePct >= 200
        ? 10
        : demandCoveragePct >= 120
          ? 8
          : demandCoveragePct >= 100
            ? 6
            : demandCoveragePct >= 70
              ? 3
              : 0) +
      (maxVoltageKv >= 220
        ? 5
        : maxVoltageKv >= 110
          ? 4
          : maxVoltageKv >= 22
            ? 3
            : maxVoltageKv > 0
              ? 1
              : 0);
    const renewableScore =
      (projectCount >= 5 ? 4 : projectCount > 0 ? 2 : 0) +
      (rooftopSystems >= 100 ? 4 : rooftopSystems >= 10 ? 3 : rooftopSystems > 0 ? 1 : 0) +
      (rooftopPotentialKwp >= 1_000
        ? 7
        : rooftopPotentialKwp >= 300
          ? 5
          : rooftopPotentialKwp > 0
            ? 3
            : 0);
    const resilienceScore =
      (activeIncidents === 0 ? 4 : activeIncidents <= 1 ? 2 : 0) +
      (incidents12Months === 0 ? 4 : incidents12Months <= 2 ? 3 : incidents12Months <= 5 ? 1 : 0) +
      (corridorViolations === 0
        ? 4
        : corridorViolations <= 2
          ? 2
          : corridorViolations <= 5
            ? 1
            : 0) +
      (outagePlans12Months === 0
        ? 3
        : outagePlans12Months <= 2
          ? 2
          : outagePlans12Months <= 5
            ? 1
            : 0);
    const mobilityScore =
      (evStations >= 10 ? 4 : evStations >= 3 ? 3 : evStations > 0 ? 1 : 0) +
      (number(summary.ev_power_kw) >= 1_000 ? 2 : number(summary.ev_power_kw) > 0 ? 1 : 0) +
      (number(summary.ev_available_connectors) >= 10
        ? 2
        : number(summary.ev_available_connectors) > 0
          ? 1
          : 0) +
      (nearestEvStationKm == null
        ? 0
        : nearestEvStationKm <= 3
          ? 2
          : nearestEvStationKm <= 8
            ? 1
            : 0);
    const environmentScore =
      (emissionSources > 0 ? 2 : 0) +
      (number(summary.pending_obligations) > 0 ? 2 : 0) +
      (renewableCoveragePct >= 20
        ? 4
        : renewableCoveragePct >= 10
          ? 3
          : renewableCoveragePct > 0
            ? 1
            : 0) +
      (emissionFactor > 0 ? 2 : 0);
    const ecosystemScore =
      (consumers >= 100 ? 5 : consumers >= 25 ? 4 : consumers > 0 ? 2 : 0) +
      (keyConsumers >= 10 ? 2 : keyConsumers > 0 ? 1 : 0) +
      (projectCount >= 5 ? 2 : projectCount > 0 ? 1 : 0) +
      (area ? 1 : 0);

    const dataCoverage: InvestmentDataCoverage[] = [
      {
        domain: "GRID",
        label: "Lưới điện & trạm biến áp",
        records: lineCount + substationCount,
        status: lineCount + substationCount > 0 ? "AVAILABLE" : "NO_RECORDS",
        note: `${substationCount} trạm và ${lineCount} tuyến trong bán kính khảo sát.`,
      },
      {
        domain: "RENEWABLE",
        label: "Nguồn điện & điện mái nhà",
        records: projectCount + rooftopSystems,
        status: projectCount + rooftopSystems > 0 ? "AVAILABLE" : "NO_RECORDS",
        note: `${projectCount} dự án nguồn, ${vi(rooftopSystems)} hệ thống mái nhà.`,
      },
      {
        domain: "SAFETY",
        label: "An toàn, sự cố & hành lang",
        records: incidents12Months + corridorViolations + outagePlans12Months,
        status: "AVAILABLE",
        note: "Có dữ liệu kiểm tra cả trường hợp không phát sinh sự cố trong kỳ.",
      },
      {
        domain: "EV",
        label: "Hạ tầng sạc xe điện",
        records: evStations,
        status: evStations > 0 ? "AVAILABLE" : "NO_RECORDS",
        note: `${evStations} trạm sạc trong vùng phân tích.`,
      },
      {
        domain: "EMISSION",
        label: "Phát thải & nghĩa vụ báo cáo",
        records: emissionSources,
        status: emissionSources > 0 ? "AVAILABLE" : "LIMITED",
        note: `${emissionSources} nguồn phát thải được gắn vị trí; đây là hồ sơ lân cận, không phải phát thải của dự án mới.`,
      },
      {
        domain: "ECOSYSTEM",
        label: "Hệ sinh thái phụ tải",
        records: consumers,
        status: consumers > 0 ? "AVAILABLE" : "LIMITED",
        note: `${consumers} cơ sở tiêu thụ điện được gắn vị trí trong vùng khảo sát.`,
      },
      {
        domain: "ADMIN",
        label: "Địa giới hành chính",
        records: area ? 1 : 0,
        status: area ? "AVAILABLE" : "LIMITED",
        note: area
          ? `Điểm thuộc ${text(area.name)}.`
          : "Chưa định danh được đơn vị hành chính cấp cơ sở.",
      },
    ];
    const availableDomains = dataCoverage.filter((item) => item.status === "AVAILABLE").length;
    const dataScore = clamp(Math.round((availableDomains / dataCoverage.length) * 10), 0, 10);

    const scoreBreakdown: AssessmentBreakdownItem[] = [
      {
        key: "GRID",
        label: "Năng lực lưới điện",
        score: gridScore,
        maxScore: 30,
        status: breakdownStatus(gridScore, 30),
        summary: `${vi(estimatedConnectionHeadroomKw)} kW dư địa kỹ thuật sơ bộ, lưới cao nhất ${vi(maxVoltageKv)} kV.`,
        evidence: [
          nearestLineKm == null
            ? "Chưa ghi nhận tuyến điện trong bán kính."
            : `Tuyến gần nhất cách ${vi(nearestLineKm, 2)} km.`,
          nearestSubstationKm == null
            ? "Chưa ghi nhận trạm biến áp trong bán kính."
            : `Trạm gần nhất cách ${vi(nearestSubstationKm, 2)} km.`,
          `Dư địa bằng ${vi(demandCoveragePct, 1)}% phụ tải dự kiến.`,
        ],
      },
      {
        key: "RENEWABLE",
        label: "Năng lượng tái tạo",
        score: renewableScore,
        maxScore: 15,
        status: breakdownStatus(renewableScore, 15),
        summary: `Có thể sàng lọc khoảng ${vi(rooftopPotentialKwp)} kWp điện mặt trời mái nhà.`,
        evidence: [
          `${vi(rooftopSystems)} hệ thống mái nhà, tổng ${vi(rooftopCapacityMw, 2)} MWp trong khu vực.`,
          `${projectCount} dự án nguồn điện, ${vi(generationCapacityMw, 1)} MW trong bán kính.`,
        ],
      },
      {
        key: "RESILIENCE",
        label: "An toàn & ổn định",
        score: resilienceScore,
        maxScore: 15,
        status: breakdownStatus(resilienceScore, 15),
        summary: `Chỉ số ổn định hồ sơ GIS ${stabilityIndex}/100; ${activeIncidents} sự cố đang mở.`,
        evidence: [
          `${incidents12Months} sự cố lưới trong 12 tháng gần nhất.`,
          `${corridorViolations} vi phạm hành lang chưa đóng; ${outagePlans12Months} kế hoạch mất điện có liên kết vị trí.`,
        ],
      },
      {
        key: "MOBILITY",
        label: "Hạ tầng xanh & trạm sạc",
        score: mobilityScore,
        maxScore: 10,
        status: breakdownStatus(mobilityScore, 10),
        summary: `${evStations} trạm sạc, tổng ${vi(number(summary.ev_power_kw))} kW trong vùng khảo sát.`,
        evidence: [
          `${number(summary.ev_connectors)} cổng, còn trống ${number(summary.ev_available_connectors)} cổng theo dữ liệu vận hành.`,
          nearestEvStationKm == null
            ? "Chưa ghi nhận trạm sạc gần vị trí."
            : `Trạm sạc gần nhất cách ${vi(nearestEvStationKm, 2)} km.`,
        ],
      },
      {
        key: "ENVIRONMENT",
        label: "Phát thải & chuyển đổi xanh",
        score: environmentScore,
        maxScore: 10,
        status: breakdownStatus(environmentScore, 10),
        summary: `Kịch bản cơ sở ước tính ${vi(estimatedOperationalCo2eTonnes, 1)} tCO₂e/năm sau bù trừ điện mái nhà.`,
        evidence: [
          `${emissionSources} nguồn phát thải lân cận có hồ sơ; ${number(summary.pending_obligations)} nghĩa vụ đang theo dõi.`,
          `Điện mái nhà có thể đáp ứng ${vi(renewableCoveragePct, 1)}% điện năng kịch bản.`,
        ],
      },
      {
        key: "ECOSYSTEM",
        label: "Hệ sinh thái đầu tư",
        score: ecosystemScore,
        maxScore: 10,
        status: breakdownStatus(ecosystemScore, 10),
        summary: `${consumers} cơ sở phụ tải, trong đó ${keyConsumers} cơ sở trọng điểm/báo cáo năng lượng.`,
        evidence: [
          area
            ? `Vị trí đã được định danh tại ${text(area.name)}.`
            : "Cần bổ sung đối soát địa giới chi tiết.",
          "Số liệu thể hiện hệ sinh thái năng lượng; dữ liệu lao động và quỹ đất cần đối soát ở hệ thống chuyên ngành.",
        ],
      },
      {
        key: "DATA",
        label: "Độ phủ dữ liệu",
        score: dataScore,
        maxScore: 10,
        status: breakdownStatus(dataScore, 10),
        summary: `${availableDomains}/${dataCoverage.length} nhóm dữ liệu sẵn sàng cho sàng lọc.`,
        evidence: [
          `${number(summary.active_data_sources)} nguồn dữ liệu đang hoạt động trong kho dùng chung.`,
          `Thời điểm đồng bộ gần nhất: ${summary.last_data_sync ? new Date(String(summary.last_data_sync)).toLocaleString("vi-VN") : "chưa ghi nhận"}.`,
        ],
      },
    ];
    const rawScore = clamp(
      Math.round(scoreBreakdown.reduce((sum, item) => sum + item.score, 0)),
      0,
      100,
    );
    const score =
      lineCount === 0 || substationCount === 0
        ? Math.min(rawScore, 49)
        : demandCoveragePct < 70
          ? Math.min(rawScore, 55)
          : demandCoveragePct < 100
            ? Math.min(rawScore, 59)
            : demandCoveragePct < 120
              ? Math.min(rawScore, 74)
              : rawScore;
    const grade = score >= 80 ? "FAVORABLE" : score >= 60 ? "CONDITIONAL" : "REVIEW_REQUIRED";
    const areaName = area ? text(area.name) : "vị trí đã chọn";

    const strengths = [
      ...(maxVoltageKv > 0
        ? [
            `Có lưới ${vi(maxVoltageKv)} kV trong bán kính ${input.radiusKm} km; tuyến gần nhất cách ${vi(nearestLineKm ?? 0, 2)} km.`,
          ]
        : []),
      ...(estimatedConnectionHeadroomKw > 0
        ? [
            `Dư địa kỹ thuật sơ bộ khoảng ${vi(estimatedConnectionHeadroomKw)} kW, tương đương ${vi(demandCoveragePct, 1)}% nhu cầu khai báo.`,
          ]
        : []),
      ...(threePhaseReadiness === "AVAILABLE_PRELIMINARY"
        ? [
            "Khả năng cấp điện 3 pha sẵn sàng ở mức sàng lọc GIS; cần điện lực xác nhận điểm đấu nối và cấp điện áp.",
          ]
        : []),
      ...(evStations > 0
        ? [
            `Hệ sinh thái di chuyển xanh có ${evStations} trạm sạc/${number(summary.ev_connectors)} cổng trong vùng phân tích.`,
          ]
        : []),
      ...(rooftopPotentialKwp > 0
        ? [
            `Diện tích mái khai báo cho phép sàng lọc phương án khoảng ${vi(rooftopPotentialKwp)} kWp, sản lượng giả định ${vi(rooftopAnnualOutputMwh, 1)} MWh/năm.`,
          ]
        : []),
      ...(incidents12Months === 0
        ? [
            "Không ghi nhận sự cố lưới có vị trí trong bán kính trong 12 tháng gần nhất của kho dữ liệu.",
          ]
        : []),
    ];
    const constraints = [
      ...(maxVoltageKv < 220
        ? [
            `Chưa ghi nhận tuyến/trạm 220 kV trong bán kính ${input.radiusKm} km; cấp cao nhất hiện thấy là ${vi(maxVoltageKv)} kV.`,
          ]
        : []),
      ...(corridorViolations > 0
        ? [
            `Có ${corridorViolations} hồ sơ vi phạm hành lang chưa đóng trong vùng; cần kiểm tra khoảng cách an toàn tại khu đất cụ thể.`,
          ]
        : []),
      ...(demandCoveragePct < 120
        ? [
            "Dư địa kỹ thuật chưa đạt biên dự phòng 120% phụ tải; cần điều chỉnh quy mô hoặc nâng cấp đấu nối.",
          ]
        : []),
      ...(emissionSources === 0
        ? ["Dữ liệu nguồn phát thải lân cận còn hạn chế; cần khảo sát môi trường bổ sung."]
        : []),
      "Kết quả chưa bao gồm pháp lý thửa đất, giá đất, giao thông, lao động và xác nhận quy hoạch sử dụng đất.",
    ];
    const recommendations = [
      `Gửi yêu cầu tiền khả thi ${vi(input.expectedDemandKw)} kW cho đơn vị điện lực, kèm tọa độ và biểu đồ phụ tải dự kiến.`,
      "Khảo sát thực địa tuyến gần nhất và trạm biến áp gần nhất; không dùng tổng dư địa GIS làm công suất đấu nối đã được phê duyệt.",
      `Đối soát quy hoạch đất, hành lang an toàn điện, PCCC và môi trường cho khu đất ${vi(input.landAreaHa, 2)} ha.`,
      ...(rooftopPotentialKwp > 0
        ? [
            `Lập mô phỏng mái, kết cấu và tự dùng cho phương án ${vi(rooftopPotentialKwp)} kWp trước khi chốt thiết kế.`,
          ]
        : []),
      ...(corridorViolations > 0
        ? [
            "Mở lớp hành lang an toàn và kiểm tra từng hồ sơ vi phạm lân cận trước khi xác lập ranh dự án.",
          ]
        : []),
    ];

    const scenarios = buildScenarios({
      score,
      expectedDemandKw: input.expectedDemandKw,
      gridHeadroomKw: estimatedConnectionHeadroomKw,
      rooftopPotentialKwp,
      loadFactor,
      emissionFactor,
    });
    const procedures: InvestmentProcedure[] = [
      {
        step: 1,
        title: "Sàng lọc vị trí và quy hoạch đất",
        agency: "Cơ quan quy hoạch/đầu tư và chính quyền địa phương",
        status: "SCREENING",
        description:
          "Đối chiếu ranh khu đất, mục đích sử dụng, hành lang kỹ thuật và khả năng tiếp cận hạ tầng.",
        requiredInputs: ["Tọa độ/ranh khu đất", "Quy mô diện tích", "Loại hình đầu tư"],
      },
      {
        step: 2,
        title: "Tiền khả thi nhu cầu điện",
        agency: "Đơn vị điện lực quản lý địa bàn",
        status: demandCoveragePct >= 120 ? "READY" : "CONFIRMATION_REQUIRED",
        description:
          "Xác nhận cấp điện áp, điểm đấu nối, biểu đồ phụ tải và yêu cầu dự phòng; GIS chỉ là bước sàng lọc.",
        requiredInputs: ["Công suất cực đại", "Tiến độ đóng điện", "Đặc tính phụ tải 3 pha"],
      },
      {
        step: 3,
        title: "Thỏa thuận đấu nối và chất lượng điện",
        agency: "Đơn vị điện lực/chủ quản lưới",
        status: "CONFIRMATION_REQUIRED",
        description:
          "Tính toán ngắn mạch, bảo vệ, N-1, sóng hài và phương án đầu tư công trình điện liên quan.",
        requiredInputs: ["Sơ đồ một sợi", "Danh mục thiết bị", "Yêu cầu độ tin cậy"],
      },
      {
        step: 4,
        title: "Môi trường, PCCC và xây dựng",
        agency: "Cơ quan chuyên ngành theo thẩm quyền",
        status: "SCREENING",
        description:
          "Phân loại nghĩa vụ theo quy mô/ngành nghề thực tế; kết quả phát thải trên trang là kịch bản năng lượng, không phải hồ sơ pháp lý.",
        requiredInputs: [
          "Công nghệ sản xuất",
          "Nhiên liệu",
          "Lưu lượng/chất thải",
          "Hồ sơ công trình",
        ],
      },
      {
        step: 5,
        title: "Điện mặt trời mái nhà và hạ tầng sạc",
        agency: "Chủ đầu tư, tư vấn thiết kế và đơn vị điện lực",
        status: rooftopPotentialKwp > 0 ? "READY" : "SCREENING",
        description:
          "Tối ưu tỷ lệ tự dùng, kết cấu mái, bảo vệ chống phát ngược và công suất trạm sạc theo nhu cầu vận hành.",
        requiredInputs: ["Bản vẽ mái", "Biểu đồ phụ tải", "Số xe/ca vận hành"],
      },
      {
        step: 6,
        title: "Nghiệm thu, vận hành và báo cáo",
        agency: "Chủ đầu tư và các cơ quan/đơn vị quản lý liên quan",
        status: "SCREENING",
        description:
          "Thiết lập đo đếm, giám sát sự cố, kiểm kê phát thải và báo cáo năng lượng theo nghĩa vụ được xác định cho dự án.",
        requiredInputs: ["Hồ sơ hoàn công", "Biên bản nghiệm thu", "Kế hoạch quan trắc/báo cáo"],
      },
    ];

    const nearbyProjects: NearbyProject[] = projectRows.map((row) => ({
      id: text(row.id),
      code: text(row.code),
      name: text(row.name),
      sourceType: text(row.source_type),
      status: text(row.operation_status),
      capacityMw: number(row.designed_capacity_mw),
      distanceKm: number(row.distance_km),
      ...pointCoordinates(row),
    }));
    const nearbySubstations: NearbySubstation[] = substationRows.map((row) => ({
      id: text(row.id),
      code: text(row.code),
      name: text(row.name),
      voltageKv: number(row.voltage_level_kv),
      installedCapacityMva: number(row.installed_capacity_mva),
      currentLoadMva: number(row.current_load_mva),
      availableCapacityMva: number(row.available_capacity_mva),
      feederHeadroomMw: number(row.feeder_headroom_mw),
      assessedAvailableMw: number(row.assessed_available_mw),
      loadFactorPct: number(row.load_factor_pct),
      status: text(row.overload_status),
      distanceKm: number(row.distance_km),
      ...pointCoordinates(row),
    }));
    const nearbyLines: NearbyLine[] = lineRows.map((row) => ({
      id: text(row.id),
      code: text(row.code),
      name: text(row.name),
      voltageKv: number(row.voltage_level_kv),
      capacityMw: number(row.rated_capacity_mw),
      currentLoadMw: number(row.current_load_mw),
      headroomMw: number(row.headroom_mw),
      loadFactorPct: number(row.load_factor_pct),
      distanceKm: number(row.distance_km),
      ...pointCoordinates(row),
    }));
    const nearbyRooftopSystems: NearbyRooftopSystem[] = rooftopRows.map((row) => ({
      id: text(row.id),
      code: text(row.code),
      name: text(row.name),
      owner: text(row.owner),
      capacityKwp: number(row.installed_capacity_kwp),
      status: text(row.operation_status),
      distanceKm: number(row.distance_km),
      ...pointCoordinates(row),
    }));
    const nearbyEvStations: NearbyEvStation[] = evRows.map((row) => ({
      id: text(row.id),
      code: text(row.code),
      name: text(row.name),
      powerKw: number(row.total_power_kw),
      connectors: number(row.connector_count),
      availableConnectors: number(row.available_count),
      status: text(row.operation_status),
      distanceKm: number(row.distance_km),
      ...pointCoordinates(row),
    }));
    const nearbySafetyEvents: NearbySafetyEvent[] = safetyRows.map((row) => ({
      id: text(row.id),
      kind: text(row.kind) === "GRID_INCIDENT" ? "GRID_INCIDENT" : "CORRIDOR_VIOLATION",
      code: text(row.code),
      name: text(row.name),
      severity: text(row.severity),
      status: text(row.status),
      occurredAt: row.occurred_at ? new Date(String(row.occurred_at)).toISOString() : null,
      distanceKm: number(row.distance_km),
      ...pointCoordinates(row),
    }));
    const nearbyEmissionSources: NearbyEmissionSource[] = emissionRows.map((row) => ({
      id: text(row.id),
      code: text(row.code),
      name: text(row.name),
      sourceType: text(row.source_type),
      scope: text(row.scope),
      status: text(row.status),
      recordedCo2eTonnes: number(row.recorded_co2e_tonnes),
      latestPeriod: row.latest_period ? text(row.latest_period) : null,
      reportingObligations: number(row.reporting_obligations),
      distanceKm: number(row.distance_km),
      ...pointCoordinates(row),
    }));
    const nearbyConsumers: NearbyConsumer[] = consumerRows.map((row) => ({
      id: text(row.id),
      code: text(row.code),
      name: text(row.name),
      sector: text(row.sector),
      classification: text(row.classification),
      importanceLevel: text(row.importance_level),
      reportedEnergyMwh: number(row.reported_energy_mwh),
      distanceKm: number(row.distance_km),
      ...pointCoordinates(row),
    }));

    const payload: InvestmentAssessmentResponse = {
      location: {
        lat: rounded(lat, 6),
        lng: rounded(lng, 6),
        inputAddress: input.address ?? null,
        displayName: geocoded?.displayName ?? null,
        adminArea: area
          ? { code: text(area.code), name: text(area.name), level: text(area.level) }
          : null,
        radiusKm: input.radiusKm,
      },
      profile: {
        investmentType: input.investmentType,
        investmentTypeLabel: INVESTMENT_TYPE_LABELS[input.investmentType],
        expectedDemandKw: input.expectedDemandKw,
        landAreaHa: input.landAreaHa,
        roofAreaM2: input.roofAreaM2,
      },
      assessment: {
        score,
        grade,
        label:
          grade === "FAVORABLE"
            ? "Rất thuận lợi để khảo sát khả thi"
            : grade === "CONDITIONAL"
              ? "Có tiềm năng, cần xác nhận điều kiện"
              : "Cần khảo sát và bổ sung hạ tầng",
        decision:
          grade === "FAVORABLE"
            ? "PROCEED_TO_FEASIBILITY"
            : grade === "CONDITIONAL"
              ? "PROCEED_WITH_CONDITIONS"
              : "SURVEY_REQUIRED",
        conclusion:
          grade === "FAVORABLE"
            ? `${areaName} có lợi thế hạ tầng năng lượng rõ ràng: lưới ${vi(maxVoltageKv)} kV ở gần và dư địa kỹ thuật sơ bộ cao hơn nhu cầu khai báo. Nên chuyển sang khảo sát khả thi và làm việc chính thức về đấu nối.`
            : grade === "CONDITIONAL"
              ? `${areaName} có thể xem xét đầu tư, nhưng cần xác nhận dư địa lưới, hành lang an toàn và quy hoạch khu đất trước khi chốt quy mô.`
              : `${areaName} chưa đủ căn cứ để khuyến nghị đầu tư ở quy mô đã khai báo; ưu tiên khảo sát lưới và phương án nâng cấp/đấu nối.`,
        strengths,
        constraints,
        recommendations,
        disclaimer:
          "Đây là kết quả sàng lọc đa tiêu chí từ dữ liệu hệ thống GIS và các giả định kịch bản được công khai. Kết quả không thay thế văn bản quy hoạch, pháp lý đất đai, khảo sát hiện trường, thỏa thuận đấu nối hoặc giấy phép chuyên ngành.",
      },
      scoreBreakdown,
      metrics: {
        projects: projectCount,
        generationCapacityMw: rounded(generationCapacityMw),
        substations: substationCount,
        availableCapacityMva: rounded(availableCapacityMva),
        gridHeadroomKw,
        estimatedConnectionHeadroomKw,
        demandCoveragePct: rounded(demandCoveragePct, 1),
        nearestSubstationKm,
        lines: lineCount,
        nearestLineKm,
        maxVoltageKv,
        hasHighVoltageGrid: maxVoltageKv >= 110,
        has220Kv: maxVoltageKv >= 220,
        threePhaseReadiness,
        rooftopSystems,
        rooftopCapacityMw: rounded(rooftopCapacityMw),
        rooftopPotentialKwp,
        rooftopAnnualOutputMwh: rounded(rooftopAnnualOutputMwh, 1),
        renewableCoveragePct: rounded(renewableCoveragePct, 1),
        activeIncidents,
        incidents12Months,
        corridorViolations,
        outagePlans12Months,
        stabilityIndex,
        evStations,
        evPowerKw: rounded(number(summary.ev_power_kw)),
        evConnectors: number(summary.ev_connectors),
        evAvailableConnectors: number(summary.ev_available_connectors),
        nearestEvStationKm,
        emissionSources,
        recordedCo2eTonnes: rounded(number(summary.recorded_co2e_tonnes), 1),
        pendingReportingObligations: number(summary.pending_obligations),
        estimatedAnnualElectricityMwh: rounded(annualElectricityMwh, 1),
        estimatedOperationalCo2eTonnes: rounded(estimatedOperationalCo2eTonnes, 1),
        emissionFactorKgPerKwh: emissionFactor,
        consumers,
        keyConsumers,
      },
      nearby: {
        projects: nearbyProjects,
        substations: nearbySubstations,
        lines: nearbyLines,
        rooftopSystems: nearbyRooftopSystems,
        evStations: nearbyEvStations,
        safetyEvents: nearbySafetyEvents,
        emissionSources: nearbyEmissionSources,
        consumers: nearbyConsumers,
      },
      scenarios,
      procedures,
      dataCoverage,
      assumptions: [
        {
          key: "GRID_HEADROOM",
          label: "Dư địa đấu nối sơ bộ",
          value:
            "Giá trị nhỏ hơn giữa dư địa tuyến tốt nhất và 90% công suất khả dụng trạm tốt nhất trong bán kính.",
          source: "energy_power_lines + energy_substations",
          classification: "DERIVED",
        },
        {
          key: "ROOFTOP_DENSITY",
          label: "Mật độ công suất mái",
          value: "0,16 kWp/m² mái khai báo; giới hạn ở 80% dư địa lưới sơ bộ.",
          source: "Giả định sàng lọc thiết kế, phải đo mái/kết cấu thực tế",
          classification: "PLANNING_ASSUMPTION",
        },
        {
          key: "SOLAR_YIELD",
          label: "Suất phát điện mái nhà",
          value: "1,45 MWh/kWp/năm",
          source: "Giả định kịch bản để so sánh, không phải cam kết sản lượng",
          classification: "PLANNING_ASSUMPTION",
        },
        {
          key: "LOAD_FACTOR",
          label: "Hệ số sử dụng phụ tải",
          value: `${rounded(loadFactor * 100)}% theo loại hình ${INVESTMENT_TYPE_LABELS[input.investmentType]}`,
          source: "Giả định kịch bản; thay bằng biểu đồ phụ tải của nhà đầu tư khi có",
          classification: "PLANNING_ASSUMPTION",
        },
        {
          key: "EMISSION_FACTOR",
          label: "Hệ số phát thải điện",
          value: `${emissionFactor} ${text(summary.emission_factor_unit, "kgCO₂e/kWh")}`,
          source: text(summary.emission_factor_source, "energy_emission_factors"),
          classification: "DATABASE",
        },
      ],
      generatedAt: new Date().toISOString(),
      source: "postgresql-postgis",
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Investment GIS assessment failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể đánh giá vị trí đầu tư." },
      { status: 500 },
    );
  }
}
