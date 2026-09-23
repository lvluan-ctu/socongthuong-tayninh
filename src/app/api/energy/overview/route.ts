import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type {
  ChargingStation,
  EmissionSource,
  EnergyDashboardBundle,
  EnergyOverview,
  GridIncident,
  IncidentSeverity,
  KeyEnergyConsumer,
  PowerLine,
  PowerPole,
  PowerProject,
  RooftopSolar,
  Substation,
} from "@/lib/energy-types";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

const SOURCE_NAMES: Record<string, string> = {
  SOLAR: "Điện mặt trời",
  WIND: "Điện gió",
  BIOMASS: "Sinh khối",
  HYDRO: "Thủy điện",
  WASTE_TO_ENERGY: "Điện rác",
  LNG: "LNG",
};

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown, fallback = "") {
  return value == null || value === "" ? fallback : String(value);
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function run(statement: string) {
  const result = await db.execute(sql.raw(statement));
  return result.rows as Row[];
}

function area(row: Row) {
  return text(row.area, "Chưa xác định địa bàn");
}

function coords(row: Row) {
  const latitude = row.lat == null ? undefined : toNumber(row.lat);
  const longitude = row.lng == null ? undefined : toNumber(row.lng);
  return {
    ...(latitude ? { latitude } : {}),
    ...(longitude ? { longitude } : {}),
  };
}

function projectType(value: unknown): PowerProject["type"] {
  return (SOURCE_NAMES[text(value)] ?? text(value, "Điện mặt trời")) as PowerProject["type"];
}

function projectStatus(value: unknown): PowerProject["status"] {
  const status = text(value).toUpperCase();
  if (["ACTIVE", "OPERATING", "COMPLETED"].includes(status)) return "Đang vận hành";
  if (["INVESTING", "CONSTRUCTION", "UNDER_CONSTRUCTION"].includes(status)) return "Đang đầu tư";
  if (["SUSPENDED", "PAUSED"].includes(status)) return "Tạm dừng";
  return "Đang quy hoạch";
}

function severity(value: unknown, status?: unknown): IncidentSeverity {
  if (["CLOSED", "RESOLVED", "COMPLETED"].includes(text(status).toUpperCase())) return "resolved";
  const level = text(value).toUpperCase();
  if (["CRITICAL", "SEVERE", "EMERGENCY"].includes(level)) return "severe";
  if (["HIGH", "DANGER"].includes(level)) return "high";
  return "medium";
}

function parseRoute(value: unknown): [number, number][] {
  if (!value) return [];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== "object") return [];
    const coordinates = (parsed as { coordinates?: unknown }).coordinates;
    if (!Array.isArray(coordinates)) return [];
    const line = Array.isArray(coordinates[0]?.[0]) ? coordinates[0] : coordinates;
    return (line as unknown[]).flatMap((point) =>
      Array.isArray(point) && point.length >= 2
        ? [[toNumber(point[1]), toNumber(point[0])] as [number, number]]
        : [],
    );
  } catch {
    return [];
  }
}

const QUERIES = {
  counts:
    "select " +
    "(select count(*) from energy_generation_projects)::int projects, " +
    "(select count(*) from energy_generation_projects where operation_status in ('ACTIVE','OPERATING','COMPLETED'))::int project_operating, " +
    "(select count(*) from energy_generation_projects where operation_status in ('INVESTING','CONSTRUCTION','UNDER_CONSTRUCTION'))::int project_investing, " +
    "(select count(*) from energy_generation_projects where operation_status not in ('ACTIVE','OPERATING','COMPLETED','INVESTING','CONSTRUCTION','UNDER_CONSTRUCTION'))::int project_planning, " +
    "(select coalesce(sum(designed_capacity_mw),0) from energy_generation_projects)::numeric generation_capacity_mw, " +
    "(select coalesce(sum(designed_capacity_mw),0) from energy_generation_projects where source_type <> 'LNG')::numeric renewable_generation_capacity_mw, " +
    "(select coalesce(sum(installed_capacity_kwp),0)/1000 from energy_rooftop_systems)::numeric rooftop_capacity_mw, " +
    "(select count(*) from energy_substations)::int substations, " +
    "(select count(*) from energy_substations where coalesce(load_factor_pct,0) >= 90 or overload_status not in ('NORMAL','OK'))::int overloaded_substations, " +
    "(select count(*) from energy_power_lines where coalesce(rated_capacity_mw,0)>0 and current_load_mw/rated_capacity_mw*100 >= 90)::int overloaded_lines, " +
    "(select coalesce(sum(length_m),0)/1000 from energy_power_lines)::numeric grid_length_km, " +
    "(select count(*) from energy_consumers where classification in ('KEY_ENERGY_USER','KEY_CONSUMER') or reporting_required='YES')::int key_consumers, " +
    "((select count(*) from energy_grid_incidents where status not in ('CLOSED','RESOLVED','COMPLETED')) + " +
    "(select count(*) from energy_corridor_violations where status not in ('CLOSED','RESOLVED','COMPLETED')))::int incidents_active, " +
    "(select coalesce(sum(co2e_kg),0)/1000 from energy_emission_activities)::numeric co2e_tons, " +
    "(select count(*) from energy_ev_stations)::int charging_stations, " +
    "(select count(*) from energy_grid_alerts where status not in ('CLOSED','RESOLVED','COMPLETED'))::int active_alerts, " +
    "((select count(*) from energy_generation_operational_snapshots) + " +
    "(select count(*) from energy_rooftop_generation_monthly) + " +
    "(select count(*) from energy_grid_operating_snapshots) + " +
    "(select count(*) from energy_consumer_reports) + " +
    "(select count(*) from energy_emission_activities) + " +
    "(select count(*) from energy_ev_station_snapshots))::int observations, " +
    "(select count(*) from energy_sites where location is not null)::int mapped_locations",
  sourceMix:
    "select source_type as name,count(*)::int records,coalesce(sum(designed_capacity_mw),0)::numeric capacity_mw " +
    "from energy_generation_projects group by source_type union all " +
    "select 'ROOFTOP_SOLAR',count(*)::int,coalesce(sum(installed_capacity_kwp),0)/1000 " +
    "from energy_rooftop_systems order by capacity_mw desc",
  monthlyOutput:
    "select period,round(sum(gwh)::numeric,3) value from (" +
    "select to_char(date_trunc('month',measured_at),'YYYY-MM') period,coalesce(sum(energy_mwh),0)/1000 gwh " +
    "from energy_generation_operational_snapshots group by 1 union all " +
    "select period,coalesce(sum(energy_generated_kwh),0)/1000000 gwh " +
    "from energy_rooftop_generation_monthly group by period) x group by period order by period",
  consumption:
    "select coalesce(c.sector,'Khác') sector,round(sum(r.reported_energy_kwh)/1000000,3)::numeric value " +
    "from energy_consumer_reports r join energy_consumers c on c.id=r.consumer_id " +
    "group by c.sector order by value desc limit 10",
  consumptionTrend:
    "select r.period,round(sum(r.reported_energy_kwh)/1000000,3)::numeric value " +
    "from energy_consumer_reports r group by r.period order by r.period",
  projectStatus:
    "select operation_status name,count(*)::int value from energy_generation_projects group by operation_status order by value desc",
  incidentBreakdown:
    "select severity,status,count(*)::int value from (" +
    "select severity,status from energy_grid_incidents union all " +
    "select severity,status from energy_corridor_violations) x group by severity,status",
  operationalTrend:
    "select to_char(date_trunc('month',measured_at),'YYYY-MM') period, " +
    "round(avg(coalesce(load_factor_pct,0))::numeric,2) average_load_pct, " +
    "count(*) filter (where coalesce(load_factor_pct,0)>=80 or overload_status not in ('NORMAL','OK'))::int risk_count " +
    "from energy_grid_operating_snapshots group by 1 order by 1",
  observations:
    "select " +
    "(select count(*) from energy_generation_operational_snapshots)::int generation_snapshots, " +
    "(select count(*) from energy_rooftop_generation_monthly)::int rooftop_monthly, " +
    "(select count(*) from energy_grid_operating_snapshots)::int grid_snapshots, " +
    "(select count(*) from energy_consumer_reports)::int consumer_reports, " +
    "(select count(*) from energy_emission_activities)::int emission_activities, " +
    "(select count(*) from energy_ev_station_snapshots)::int ev_snapshots",
  substations:
    "select a.id::text,a.code,a.name,a.status,a.commissioned_at,s.voltage_level_kv,s.substation_type, " +
    "s.designed_capacity_mva,s.installed_capacity_mva,s.current_load_mva,s.available_capacity_mva, " +
    "s.load_factor_pct,s.overload_status,s.operator,coalesce(si.address,'') address, " +
    "coalesce(nullif(si.metadata->>'area',''),nullif(si.admin_area_code,''),si.name,si.address) area, " +
    "st_y(coalesce(a.location,si.location)::geometry) lat,st_x(coalesce(a.location,si.location)::geometry) lng " +
    "from energy_substations s join energy_assets a on a.id=s.asset_id left join energy_sites si on si.id=a.site_id " +
    "order by coalesce(s.load_factor_pct,0) desc",
  lines:
    "select a.id::text,a.code,a.name,a.status,l.voltage_level_kv,l.line_type,l.length_m,l.rated_capacity_mw,l.current_load_mw, " +
    "coalesce(l.technical_specs->>'operator','Đơn vị quản lý lưới điện') operator, " +
    "coalesce(l.technical_specs->>'geometrySource','SOURCE_GEOMETRY') route_source, " +
    "coalesce((l.technical_specs->>'geometryConfidence')::numeric,1) route_confidence, " +
    "coalesce(l.technical_specs->>'fromPoint',l.technical_specs->>'from_point','Điểm đầu cập nhật theo hồ sơ GIS') from_point, " +
    "coalesce(l.technical_specs->>'toPoint',l.technical_specs->>'to_point','Điểm cuối cập nhật theo hồ sơ GIS') to_point, " +
    "coalesce((l.technical_specs->>'lossPct')::numeric,(l.technical_specs->>'loss_pct')::numeric,0) loss_pct, " +
    "coalesce(st_asgeojson(l.geometry),(select json_build_object('type','LineString','coordinates',json_agg(json_build_array(st_x(p.location::geometry),st_y(p.location::geometry)) order by p.sequence_no))::text from energy_line_positions p where p.line_asset_id=a.id)) route " +
    "from energy_power_lines l join energy_assets a on a.id=l.asset_id order by l.voltage_level_kv desc,a.code",
  poles:
    "select p.id::text,p.position_code,p.sequence_no,p.location,la.code line_code, " +
    "coalesce(ps.structure_type,'POLE') structure_type,coalesce(ps.material,'Bê tông') material, " +
    "coalesce(ps.height_m,0) height_m,coalesce(sa.status,'ACTIVE') status, " +
    "st_y(p.location::geometry) lat,st_x(p.location::geometry) lng " +
    "from energy_line_positions p join energy_assets la on la.id=p.line_asset_id " +
    "left join energy_power_structures ps on ps.position_id=p.id left join energy_assets sa on sa.id=ps.asset_id " +
    "order by la.code,p.sequence_no limit 500",
  projects:
    "select a.id::text,a.code,a.name,a.status,a.commissioned_at,g.source_type,g.designed_capacity_mw,g.actual_capacity_mw, " +
    "g.operation_status,coalesce(ip.name,'Chưa cập nhật chủ đầu tư') investor,coalesce(op.name,ip.name,'Chưa cập nhật đơn vị vận hành') operator, " +
    "coalesce(si.address,'') address,coalesce(nullif(si.metadata->>'area',''),nullif(si.admin_area_code,''),si.name,si.address) area, " +
    "st_y(coalesce(a.location,si.location)::geometry) lat,st_x(coalesce(a.location,si.location)::geometry) lng, " +
    "latest.active_power_mw,latest.output_gwh,latest.availability_pct,latest.efficiency_pct " +
    "from energy_generation_projects g join energy_assets a on a.id=g.asset_id " +
    "left join energy_sites si on si.id=coalesce(g.site_id,a.site_id) left join energy_parties ip on ip.id=g.investor_party_id " +
    "left join energy_parties op on op.id=g.operator_party_id left join lateral (" +
    "select active_power_mw,energy_mwh/1000 output_gwh,availability_pct,efficiency_pct " +
    "from energy_generation_operational_snapshots s where s.project_asset_id=g.asset_id order by measured_at desc limit 1) latest on true " +
    "order by g.designed_capacity_mw desc",
  incidents:
    "select i.id::text,i.code,i.started_at event_time,i.incident_type,i.severity,i.status,i.affected_customers,i.affected_load_mw,i.cause, " +
    "a.code asset_code,a.name asset_name,coalesce(nullif(si.metadata->>'area',''),nullif(si.admin_area_code,''),si.name,si.address,a.name) area, " +
    "st_y(coalesce(a.location,si.location)::geometry) lat,st_x(coalesce(a.location,si.location)::geometry) lng " +
    "from energy_grid_incidents i left join energy_assets a on a.id=i.asset_id left join energy_sites si on si.id=a.site_id union all " +
    "select v.id::text,v.code,v.detected_at,v.violation_type,v.severity,v.status,null::numeric,null::numeric, " +
    "coalesce(v.evidence->>'description','Vi phạm hành lang an toàn lưới điện'),a.code,a.name,coalesce(a.name,'Hành lang lưới điện'), " +
    "st_y(coalesce(v.location,a.location)::geometry),st_x(coalesce(v.location,a.location)::geometry) " +
    "from energy_corridor_violations v join energy_protection_corridors c on c.id=v.corridor_id " +
    "join energy_assets a on a.id=c.asset_id order by event_time desc",
  rooftop:
    "select a.id::text,a.code,a.name,a.status,r.installed_capacity_kwp,r.inverter_capacity_kw,r.battery_capacity_kwh, " +
    "r.operation_status,r.installation_type,r.source,r.evn_acceptance_at,coalesce(p.name,a.name) owner,ca.customer_type, " +
    "coalesce(si.address,ca.service_address,'') address,coalesce(nullif(si.metadata->>'area',''),nullif(si.admin_area_code,''),si.name,si.address) area, " +
    "st_y(coalesce(a.location,si.location)::geometry) lat,st_x(coalesce(a.location,si.location)::geometry) lng, " +
    "latest.energy_generated_kwh,latest.energy_self_consumed_kwh,latest.energy_exported_kwh,latest.peak_generation_kw " +
    "from energy_rooftop_systems r join energy_assets a on a.id=r.asset_id " +
    "left join energy_customer_accounts ca on ca.id=r.customer_account_id left join energy_parties p on p.id=ca.party_id " +
    "left join energy_sites si on si.id=coalesce(ca.site_id,a.site_id) left join lateral (" +
    "select energy_generated_kwh,energy_self_consumed_kwh,energy_exported_kwh,peak_generation_kw " +
    "from energy_rooftop_generation_monthly m where m.system_asset_id=r.asset_id order by period desc limit 1) latest on true " +
    "where coalesce(a.location,si.location) is not null order by r.installed_capacity_kwp desc limit 700",
  emissions:
    "select e.id::text,e.code,e.name,e.source_type,e.scope,e.sector,e.status,coalesce(p.name,'Chưa cập nhật') investor, " +
    "coalesce(si.address,'') address,coalesce(nullif(si.metadata->>'area',''),nullif(si.admin_area_code,''),si.name,si.address) area, " +
    "st_y(si.location::geometry) lat,st_x(si.location::geometry) lng,coalesce(x.co2e_kg,0) co2e_kg " +
    "from energy_emission_sources e left join energy_sites si on si.id=e.site_id left join energy_parties p on p.id=e.party_id " +
    "left join lateral (select sum(co2e_kg) co2e_kg from energy_emission_activities a where a.source_id=e.id) x on true " +
    "order by x.co2e_kg desc nulls last",
  charging:
    "select a.id::text,a.code,a.name,a.status,e.total_power_kw,e.connector_count,e.available_count,e.occupied_count,e.faulted_count, " +
    "e.connection_capacity_kw,e.operation_status,coalesce(p.name,'Chưa cập nhật') operator,coalesce(si.address,'') address, " +
    "coalesce(nullif(si.metadata->>'area',''),nullif(si.admin_area_code,''),si.name,si.address) area, " +
    "st_y(coalesce(a.location,si.location)::geometry) lat,st_x(coalesce(a.location,si.location)::geometry) lng, " +
    "coalesce(c.ccs2,0) ccs2,coalesce(c.chademo,0) chademo,coalesce(c.ac_type2,0) ac_type2,coalesce(c.fast,0) fast,coalesce(c.slow,0) slow " +
    "from energy_ev_stations e join energy_assets a on a.id=e.asset_id left join energy_sites si on si.id=coalesce(e.site_id,a.site_id) " +
    "left join energy_parties p on p.id=e.operator_party_id left join lateral (" +
    "select count(*) filter(where upper(connector_type) like '%CCS%')::int ccs2,count(*) filter(where upper(connector_type) like '%CHADEMO%')::int chademo, " +
    "count(*) filter(where upper(connector_type) like '%TYPE%2%' and upper(connector_type) not like '%CCS%')::int ac_type2, " +
    "count(*) filter(where power_kw>=50)::int fast,count(*) filter(where power_kw<50)::int slow from energy_ev_connectors c where c.station_asset_id=e.asset_id) c on true",
  consumers:
    "select c.id::text,p.code,p.name,c.consumer_group,c.sector,c.status,coalesce(si.address,p.address,'') address, " +
    "coalesce(nullif(si.metadata->>'area',''),nullif(si.admin_area_code,''),si.name,si.address) area, " +
    "st_y(si.location::geometry) lat,st_x(si.location::geometry) lng,coalesce(r.reported_energy_kwh,0) consumption_kwh,coalesce(b.baseline_kwh,0) baseline_kwh " +
    "from energy_consumers c join energy_parties p on p.id=c.party_id left join energy_sites si on si.id=c.site_id " +
    "left join lateral (select reported_energy_kwh from energy_consumer_reports r where r.consumer_id=c.id order by period desc limit 1) r on true " +
    "left join lateral (select baseline_kwh from energy_efficiency_baselines b where b.consumer_id=c.id order by period_to desc limit 1) b on true " +
    "where si.location is not null order by r.reported_energy_kwh desc nulls last limit 500",
};

function mapSubstations(rows: Row[]): Substation[] {
  return rows.map((row) => {
    const load = round(toNumber(row.load_factor_pct), 1);
    return {
      id: text(row.id),
      code: text(row.code),
      name: text(row.name),
      type: text(row.substation_type),
      voltageLevel: (round(toNumber(row.voltage_level_kv), 0) + "kV") as Substation["voltageLevel"],
      district: area(row),
      address: text(row.address),
      operator: text(row.operator, "Đơn vị quản lý lưới điện"),
      designCapacity: toNumber(row.designed_capacity_mva),
      operatingCapacity: toNumber(row.current_load_mva || row.installed_capacity_mva),
      availableCapacity: toNumber(row.available_capacity_mva),
      loadFactor: load,
      yearCommissioned: row.commissioned_at ? new Date(String(row.commissioned_at)).getFullYear() : undefined,
      status: load >= 90 ? "Quá tải" : load >= 80 ? "Cảnh báo" : text(row.overload_status, text(row.status)),
      supplyArea: area(row),
      ...coords(row),
    };
  });
}

function mapLines(rows: Row[]): PowerLine[] {
  return rows.map((row) => {
    const capacity = toNumber(row.rated_capacity_mw);
    const actual = toNumber(row.current_load_mw);
    const load = capacity ? (actual / capacity) * 100 : 0;
    return {
      id: text(row.id),
      code: text(row.code),
      name: text(row.name),
      voltageLevel: (round(toNumber(row.voltage_level_kv), 0) + "kV") as PowerLine["voltageLevel"],
      operator: text(row.operator),
      fromPoint: text(row.from_point),
      toPoint: text(row.to_point),
      lengthKm: round(toNumber(row.length_m) / 1000, 2),
      districts: [],
      status: load >= 100 ? "Quá tải" : load >= 90 ? "Nguy cơ quá tải" : load >= 80 ? "Cảnh báo tải cao" : text(row.status),
      capacityMw: capacity,
      actualLoadMw: actual,
      lossPct: round(toNumber(row.loss_pct), 2),
      routeSource: text(row.route_source),
      routeConfidencePct: round(toNumber(row.route_confidence) * 100, 0),
      route: parseRoute(row.route),
    };
  });
}

function mapProjects(rows: Row[]): PowerProject[] {
  return rows.map((row) => ({
    id: text(row.id),
    code: text(row.code),
    name: text(row.name),
    type: projectType(row.source_type),
    investor: text(row.investor),
    operator: text(row.operator),
    address: text(row.address),
    district: area(row),
    status: projectStatus(row.operation_status),
    designCapacityMw: toNumber(row.designed_capacity_mw),
    actualOutputMw: toNumber(row.active_power_mw || row.actual_capacity_mw),
    outputGWh: toNumber(row.output_gwh),
    availabilityPct: toNumber(row.availability_pct),
    efficiencyPct: toNumber(row.efficiency_pct),
    ...coords(row),
  }));
}

function mapIncidents(rows: Row[]): GridIncident[] {
  return rows.map((row) => ({
    id: text(row.id),
    code: text(row.code),
    time: row.event_time ? new Date(String(row.event_time)).toISOString() : "",
    source: text(row.asset_name, "Hệ thống giám sát"),
    type: text(row.incident_type),
    severity: severity(row.severity, row.status),
    location: area(row),
    lineCode: text(row.asset_code),
    substationCode: "",
    affectedArea: area(row),
    customersAffected: toNumber(row.affected_customers),
    lostLoadMw: toNumber(row.affected_load_mw),
    criticalInfra: text(row.cause),
    handler: "Đơn vị quản lý vận hành",
    progress: ["CLOSED", "RESOLVED", "COMPLETED"].includes(text(row.status).toUpperCase()) ? "Đã xử lý" : "Đang xử lý",
    ...coords(row),
  }));
}

function buildOverview(
  counts: Row,
  sourceRows: Row[],
  monthlyRows: Row[],
  consumptionRows: Row[],
  consumptionTrendRows: Row[],
  statusRows: Row[],
  incidentRows: Row[],
  operationalRows: Row[],
  observation: Row,
): EnergyOverview {
  const generationCapacity = toNumber(counts.generation_capacity_mw);
  const rooftopCapacity = toNumber(counts.rooftop_capacity_mw);
  const totalCapacity = generationCapacity + rooftopCapacity;
  const renewableCapacity = toNumber(counts.renewable_generation_capacity_mw) + rooftopCapacity;
  const monthly = monthlyRows.map((row) => ({ period: text(row.period), value: toNumber(row.value) }));
  const latestTwelve = monthly.slice(-12);
  const years = [...new Set(monthly.map((item) => Number(item.period.slice(0, 4))))].sort();
  const firstRecentIndex = Math.max(0, monthly.length - 12);
  const outputComparison = latestTwelve.map((item, index) => ({
    month: item.period.slice(5) + "/" + item.period.slice(2, 4),
    previous: round(monthly[firstRecentIndex + index - 1]?.value ?? 0, 2),
    current: round(item.value, 2),
  }));
  const quarterTotals = new Map<string, number>();
  monthly.forEach((item) => {
    const year = Number(item.period.slice(0, 4));
    const month = Number(item.period.slice(5, 7));
    const key = year + "-Q" + Math.ceil(month / 3);
    quarterTotals.set(key, (quarterTotals.get(key) ?? 0) + item.value);
  });
  const quarterKeys = [...quarterTotals.keys()].sort();
  const outputByQuarter = quarterKeys.slice(-8).map((key) => {
    const index = quarterKeys.indexOf(key);
    return {
      month: key.slice(5) + "/" + key.slice(2, 4),
      previous: round(index > 0 ? quarterTotals.get(quarterKeys[index - 1]!) ?? 0 : 0, 2),
      current: round(quarterTotals.get(key) ?? 0, 2),
    };
  });
  const yearTotals = new Map<number, number>();
  monthly.forEach((item) => {
    const year = Number(item.period.slice(0, 4));
    yearTotals.set(year, (yearTotals.get(year) ?? 0) + item.value);
  });
  const outputByYear = years.slice(-5).map((year) => ({
    month: String(year),
    previous: round(yearTotals.get(year - 1) ?? 0, 2),
    current: round(yearTotals.get(year) ?? 0, 2),
  }));
  const incidentGroups = new Map<IncidentSeverity, number>([
    ["severe", 0],
    ["high", 0],
    ["medium", 0],
    ["resolved", 0],
  ]);
  incidentRows.forEach((row) => {
    const key = severity(row.severity, row.status);
    incidentGroups.set(key, (incidentGroups.get(key) ?? 0) + toNumber(row.value));
  });
  const labels: Record<IncidentSeverity, string> = {
    severe: "Nghiêm trọng",
    high: "Mức cao",
    medium: "Mức trung bình",
    resolved: "Đã xử lý",
  };
  const incidentBreakdown = ([...incidentGroups.entries()] as [IncidentSeverity, number][]).map(([key, value]) => ({
    severity: key,
    label: labels[key],
    value,
  }));
  const latestPeriod = monthly.at(-1)?.period ?? "Chưa có dữ liệu";
  const monitoringIndicators = [
    { label: "Vận hành nguồn điện", value: toNumber(observation.generation_snapshots).toLocaleString("vi-VN"), detail: "snapshot công suất và sản lượng" },
    { label: "Điện mặt trời mái nhà", value: toNumber(observation.rooftop_monthly).toLocaleString("vi-VN"), detail: "bản ghi sản lượng theo tháng" },
    { label: "Vận hành lưới điện", value: toNumber(observation.grid_snapshots).toLocaleString("vi-VN"), detail: "snapshot mức tải có nguồn gốc dữ liệu" },
    { label: "Báo cáo tiêu thụ", value: toNumber(observation.consumer_reports).toLocaleString("vi-VN"), detail: "báo cáo của khách hàng sử dụng điện" },
    { label: "Hoạt động phát thải", value: toNumber(observation.emission_activities).toLocaleString("vi-VN"), detail: "quan sát CO2e theo kỳ" },
    { label: "Vận hành trạm sạc", value: toNumber(observation.ev_snapshots).toLocaleString("vi-VN"), detail: "snapshot trụ sạc và mức sử dụng" },
  ];
  const co2eTons = round(toNumber(counts.co2e_tons), 1);
  return {
    kpis: {
      projects: toNumber(counts.projects),
      projectOperating: toNumber(counts.project_operating),
      projectInvesting: toNumber(counts.project_investing),
      projectPlanning: toNumber(counts.project_planning),
      totalCapacityMw: round(totalCapacity, 1),
      electricityOutputGwh: round(latestTwelve.reduce((sum, item) => sum + item.value, 0), 1),
      substations: toNumber(counts.substations),
      overloadedSubstations: toNumber(counts.overloaded_substations),
      overloadedLines: toNumber(counts.overloaded_lines),
      gridLengthKm: round(toNumber(counts.grid_length_km), 1),
      rooftopSolarMw: round(rooftopCapacity, 1),
      keyConsumers: toNumber(counts.key_consumers),
      incidentsActive: toNumber(counts.incidents_active),
      co2eKilotons: round(co2eTons / 1000, 2),
      co2eTons,
      chargingStations: toNumber(counts.charging_stations),
      renewableRatioPct: totalCapacity ? round((renewableCapacity / totalCapacity) * 100, 1) : 0,
    },
    sourceMix: sourceRows.map((row) => ({
      name: text(row.name) === "ROOFTOP_SOLAR" ? "Điện mặt trời mái nhà" : SOURCE_NAMES[text(row.name)] ?? text(row.name),
      value: toNumber(row.records),
      capacityMw: round(toNumber(row.capacity_mw), 2),
    })),
    capacityByType: sourceRows.map((row) => ({
      name: text(row.name) === "ROOFTOP_SOLAR" ? "ĐMT mái nhà" : SOURCE_NAMES[text(row.name)] ?? text(row.name),
      value: round(toNumber(row.capacity_mw), 2),
    })),
    outputByMonth: latestTwelve.map((item) => ({ month: item.period, value: round(item.value, 2) })),
    outputComparison,
    outputByQuarter,
    outputByYear,
    consumptionBySector: consumptionRows.map((row) => ({ sector: text(row.sector), value: toNumber(row.value) })),
    consumptionTrend: consumptionTrendRows.slice(-12).map((row) => ({
      month: text(row.period),
      value: toNumber(row.value),
      peak: toNumber(row.value),
    })),
    projectStatus: statusRows.map((row) => ({ name: projectStatus(row.name), value: toNumber(row.value) })),
    incidentBreakdown,
    alerts: incidentBreakdown.map((item) => ({ severity: item.severity, count: item.value, label: item.label })),
    operationalTrend: operationalRows.slice(-12).map((row) => ({
      period: text(row.period),
      averageLoadPct: toNumber(row.average_load_pct),
      riskCount: toNumber(row.risk_count),
    })),
    monitoringIndicators,
    dataFreshness: {
      latestPeriod,
      observations: toNumber(counts.observations),
      activeAlerts: toNumber(counts.active_alerts),
      mappedLocations: toNumber(counts.mapped_locations),
    },
  };
}

export async function GET() {
  try {
    const [
      countRows,
      sourceRows,
      monthlyRows,
      consumptionRows,
      consumptionTrendRows,
      statusRows,
      incidentBreakdownRows,
      operationalRows,
      observationRows,
      substationRows,
      lineRows,
      poleRows,
      projectRows,
      incidentRows,
      rooftopRows,
      emissionRows,
      chargingRows,
      consumerRows,
    ] = await Promise.all(Object.values(QUERIES).map(run));

    const counts = countRows[0] ?? {};
    const substations = mapSubstations(substationRows);
    const lines = mapLines(lineRows);
    const projects = mapProjects(projectRows);
    const incidents = mapIncidents(incidentRows);
    const rooftopSolar: RooftopSolar[] = rooftopRows.map((row) => ({
      id: text(row.id),
      code: text(row.code),
      owner: text(row.owner),
      customerType: text(row.customer_type, "Khác") as RooftopSolar["customerType"],
      address: text(row.address),
      district: area(row),
      operator: text(row.source, "EVN"),
      status: text(row.operation_status, text(row.status)),
      installedCapacityKw: toNumber(row.installed_capacity_kwp),
      inverterCapacityKw: toNumber(row.inverter_capacity_kw),
      storageKwh: toNumber(row.battery_capacity_kwh),
      commissionDate: row.evn_acceptance_at ? new Date(String(row.evn_acceptance_at)).toISOString() : undefined,
      connection: {
        point: "Điểm đấu nối trong hồ sơ tài sản",
        substationCode: "",
        lineCode: "",
        gridCapacityKw: 0,
        hostingCapacityKw: 0,
        overload: "Theo dõi tại Nhiệm vụ 3",
      },
      operation: {
        outputKw: toNumber(row.peak_generation_kw),
        productionKwh: toNumber(row.energy_generated_kwh),
        selfConsumptionKwh: toNumber(row.energy_self_consumed_kwh),
        exportKwh: toNumber(row.energy_exported_kwh),
        efficiencyPct: 0,
        inverterStatus: text(row.operation_status),
        panelStatus: text(row.operation_status),
      },
      ...coords(row),
    }));
    const emissionSources: EmissionSource[] = emissionRows.map((row) => ({
      id: text(row.id),
      code: text(row.code),
      unit: text(row.name),
      sourceType: text(row.source_type),
      investor: text(row.investor),
      address: text(row.address),
      district: area(row),
      status: text(row.status),
      co2: round(toNumber(row.co2e_kg) / 1000, 2),
      co2e: round(toNumber(row.co2e_kg) / 1000, 2),
      intensity: 0,
      ...coords(row),
    }));
    const chargingStations: ChargingStation[] = chargingRows.map((row) => ({
      id: text(row.id),
      code: text(row.code),
      name: text(row.name),
      address: text(row.address),
      district: area(row),
      operator: text(row.operator),
      investor: text(row.operator),
      type: "Công cộng",
      powerKw: toNumber(row.total_power_kw),
      ports: {
        ccs2: toNumber(row.ccs2),
        chademo: toNumber(row.chademo),
        acType2: toNumber(row.ac_type2),
        fast: toNumber(row.fast),
        slow: toNumber(row.slow),
      },
      voltage: "Theo hồ sơ đấu nối",
      substationCode: "",
      supplyCapacityKw: toNumber(row.connection_capacity_kw),
      freePorts: toNumber(row.available_count),
      status: text(row.operation_status, text(row.status)),
      ...coords(row),
    }));
    const keyConsumers: KeyEnergyConsumer[] = consumerRows.map((row) => {
      const consumption = toNumber(row.consumption_kwh);
      const baseline = toNumber(row.baseline_kwh);
      return {
        id: text(row.id),
        code: text(row.code),
        name: text(row.name),
        type: "Doanh nghiệp tiêu thụ lớn",
        address: text(row.address),
        district: area(row),
        sector: text(row.sector),
        consumptionKwh: consumption,
        maxDemandKw: 0,
        specificConsumption: 0,
        efficiencyPct: baseline ? round((baseline / Math.max(consumption, 1)) * 100, 1) : 0,
        savingAssessment: baseline && consumption > baseline ? "Cần rà soát mức tiêu thụ vượt đường cơ sở" : "Theo dõi định kỳ",
        ...coords(row),
      };
    });
    const poles: PowerPole[] = poleRows.map((row) => ({
      id: text(row.id),
      code: "VT-" + text(row.position_code),
      number: text(row.position_code),
      lineCode: text(row.line_code),
      type: text(row.material).toLowerCase().includes("thép") ? "Trụ thép" : "Trụ bê tông",
      height: toNumber(row.height_m),
      yearBuilt: 0,
      foundationStatus: text(row.status),
      technicalStatus: text(row.status),
      safetyCorridor: "Theo dõi tại Nhiệm vụ 5",
      ...coords(row),
    }));
    const overview = buildOverview(
      counts,
      sourceRows,
      monthlyRows,
      consumptionRows,
      consumptionTrendRows,
      statusRows,
      incidentBreakdownRows,
      operationalRows,
      observationRows[0] ?? {},
    );
    const payload: EnergyDashboardBundle = {
      overview,
      gis: {
        substations,
        lines,
        poles,
        projects,
        rooftopSolar,
        incidents,
        emissionSources,
        chargingStations,
        keyConsumers,
      },
      substations,
      projects,
      incidents,
      generatedAt: new Date().toISOString(),
      source: "postgresql-postgis",
    };
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Energy overview query failed", error);
    return NextResponse.json(
      { error: "Không thể tổng hợp dữ liệu năng lượng từ hệ thống GIS." },
      { status: 500 },
    );
  }
}
