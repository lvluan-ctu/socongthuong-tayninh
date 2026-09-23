const baseUrl = (process.env.ENERGY_APP_BASE_URL ?? "http://localhost:3113").replace(/\/$/, "");

const missions = [
  {
    id: 1,
    primaryTable: "energy_substations",
    workflowPath: "/api/grid/substations?page=1&pageSize=25",
    sources: [
      ["energy_substations", 0],
      ["energy_power_lines", 1],
      ["energy_electrical_equipment", 2],
      ["energy_measurements", 3],
    ],
  },
  {
    id: 2,
    primaryTable: "energy_generation_projects",
    workflowPath: "/api/generation/projects?page=1&pageSize=25",
    sources: [["energy_generation_projects", 0]],
  },
  {
    id: 3,
    primaryTable: "energy_rooftop_systems",
    workflowPath: "/api/solar/systems?page=1&pageSize=25",
    sources: [["energy_rooftop_systems", 0]],
  },
  {
    id: 4,
    primaryTable: "energy_consumers",
    workflowPath: "/api/efficiency/consumers?page=1&pageSize=25",
    sources: [
      ["energy_consumers", 0],
      ["energy_smart_meters", 3],
    ],
  },
  {
    id: 5,
    primaryTable: "energy_corridor_violations",
    workflowPath: "/api/safety/violations?page=1&pageSize=25",
    sources: [
      ["energy_corridor_violations", 0],
      ["energy_safety_inspections", 1],
      ["energy_outage_plans", 2],
      ["energy_grid_incidents", 3],
    ],
  },
  {
    id: 6,
    primaryTable: "energy_emission_sources",
    workflowPath: "/api/carbon/sources?page=1&pageSize=25",
    sources: [
      ["energy_emission_sources", 0],
      ["energy_emission_activities", 1],
      ["energy_reporting_obligations", 3],
    ],
  },
  {
    id: 7,
    primaryTable: "energy_ev_stations",
    workflowPath: "/api/ev/stations?page=1&pageSize=25",
    sources: [["energy_ev_stations", 0]],
  },
];

async function get(path, responseType = "json") {
  const response = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
  const body = responseType === "text" ? await response.text() : await response.json();
  if (!response.ok) {
    const detail = typeof body === "string" ? body.slice(0, 300) : JSON.stringify(body);
    throw new Error(`GET ${path} -> ${response.status}: ${detail}`);
  }
  return body;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function numberOf(value) {
  const result = Number(value);
  assert(Number.isFinite(result), `Giá trị KPI không phải số: ${String(value)}`);
  return result;
}

const results = [];

for (const mission of missions) {
  const [summary, consistency, workflow, primaryCatalog, managementHtml] = await Promise.all([
    get(`/api/energy/tasks/${mission.id}/summary`),
    get(`/api/management/mission-data?mission=${mission.id}&view=consistency`),
    get(mission.workflowPath),
    get(`/api/management/mission-data?mission=${mission.id}&resource=${mission.primaryTable}&page=1&pageSize=25`),
    get(`/energy/nhiem-vu-${mission.id}/quan-ly`, "text"),
  ]);

  const primaryKpi = numberOf(summary.kpis?.[0]?.value);
  const workflowTotal = numberOf(workflow.pagination?.total);
  const catalogTotal = numberOf(primaryCatalog.pagination?.total);
  const catalogItems = Array.isArray(primaryCatalog.items) ? primaryCatalog.items.length : 0;

  assert(consistency.primaryTable === mission.primaryTable,
    `NV${mission.id}: bảng mặc định ${consistency.primaryTable} khác ${mission.primaryTable}`);
  assert(numberOf(consistency.statisticsCount) === primaryKpi,
    `NV${mission.id}: đối soát ${consistency.statisticsCount} khác KPI ${primaryKpi}`);
  assert(workflowTotal === primaryKpi,
    `NV${mission.id}: nghiệp vụ chính ${workflowTotal} khác KPI ${primaryKpi}`);
  assert(catalogTotal === primaryKpi,
    `NV${mission.id}: catalog ${catalogTotal} khác KPI ${primaryKpi}`);
  assert(catalogItems === Math.min(25, catalogTotal),
    `NV${mission.id}: trang đầu catalog có ${catalogItems}/${Math.min(25, catalogTotal)} dòng`);
  assert(managementHtml.includes("Toàn bộ bảng dữ liệu"),
    `NV${mission.id}: trang quản lý thiếu tab catalog`);

  const sourceMap = new Map(
    (consistency.dashboardSources ?? []).map((source) => [source.table, source]),
  );
  for (const [table, kpiIndex] of mission.sources) {
    const source = sourceMap.get(table);
    const expected = numberOf(summary.kpis?.[kpiIndex]?.value);
    assert(source, `NV${mission.id}: thiếu liên kết quản lý cho ${table}`);
    assert(numberOf(source.rowCount) === expected,
      `NV${mission.id}: ${table} có ${source.rowCount} dòng nhưng KPI là ${expected}`);
  }

  results.push({
    mission: `NV${mission.id}`,
    status: "PASS",
    dashboard: primaryKpi,
    workflow: workflowTotal,
    catalog: catalogTotal,
    firstPage: catalogItems,
    linkedSources: mission.sources.length,
  });
}

console.table(results);
