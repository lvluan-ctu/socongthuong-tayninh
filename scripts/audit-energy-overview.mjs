import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const queries = {
  counts: `select
    (select count(*) from energy_generation_projects)::int projects,
    (select count(*) from energy_rooftop_systems)::int rooftop_systems,
    (select count(*) from energy_substations)::int substations,
    (select count(*) from energy_power_lines)::int power_lines,
    (select count(*) from energy_grid_incidents)::int grid_incidents,
    (select count(*) from energy_corridor_violations)::int corridor_violations,
    (select count(*) from energy_emission_sources)::int emission_sources,
    (select count(*) from energy_ev_stations)::int charging_stations,
    (select count(*) from energy_consumers)::int consumers`,
  generation: `select source_type,operation_status,count(*)::int records,
    round(sum(coalesce(designed_capacity_mw,0))::numeric,3) capacity_mw
    from energy_generation_projects group by 1,2 order by 1,2`,
  areas: `select coalesce(nullif(metadata->>'area',''),nullif(admin_area_code,''),'(không có)') area,
    count(*)::int records from energy_sites group by 1 order by 2 desc limit 30`,
  gridRisk: `select overload_status,count(*)::int records,
    round(max(coalesce(load_factor_pct,0))::numeric,2) max_load_pct
    from energy_substations group by 1 order by 2 desc`,
  lineRisk: `select case when coalesce(rated_capacity_mw,0)>0
      then round(current_load_mw/rated_capacity_mw*100,1) end load_pct,
    count(*)::int records from energy_power_lines group by 1 order by 1 desc nulls last limit 20`,
  lineGeometry: `select a.id,a.code,a.name,
    st_y(a.location::geometry) lat,st_x(a.location::geometry) lng,
    l.technical_specs::text technical_specs,
    (select count(*) from energy_line_positions p where p.line_asset_id=a.id)::int positions,
    st_asgeojson(l.geometry) geometry
    from energy_power_lines l join energy_assets a on a.id=l.asset_id order by a.code`,
  observations: `select
    (select count(*) from energy_generation_operational_snapshots)::int generation_snapshots,
    (select count(*) from energy_rooftop_generation_monthly)::int rooftop_monthly,
    (select count(*) from energy_grid_operating_snapshots)::int grid_snapshots,
    (select count(*) from energy_consumer_reports)::int consumer_reports,
    (select count(*) from energy_emission_activities)::int emission_activities,
    (select count(*) from energy_ev_station_snapshots)::int ev_snapshots`,
};

for (const [name, statement] of Object.entries(queries)) {
  const result = await client.query(statement);
  console.log(`\n[${name}]`);
  console.table(result.rows);
}

await client.end();
