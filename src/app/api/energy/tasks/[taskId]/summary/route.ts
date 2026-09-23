import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type QuerySet = {
  title: string;
  description: string;
  coverage: string;
  kpis: string;
  breakdown: string;
  markers: string;
  records: string;
};

type EnrichmentQuerySet = {
  trendTitle: string;
  trendUnit: string;
  trend: string;
  alerts: string;
  polygons?: string;
  media?: string;
  provenance: string;
  notes: string[];
};

const QUERIES: Record<string, QuerySet> = {
  "1": {
    title: "Quản lý hạ tầng lưới điện",
    description: "Theo dõi trạm biến áp, đường dây, thiết bị và dữ liệu đo đếm trên lưới điện.",
    coverage: "Dữ liệu vận hành đã được nạp từ bộ dữ liệu nguồn của dự án energy-app.",
    kpis: `select
      (select count(*) from energy_substations s join energy_assets a on a.id=s.asset_id
        where a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED')) as substations,
      (select count(*) from energy_power_lines) as power_lines,
      (select count(*) from energy_electrical_equipment) as equipment,
      (select count(*) from energy_measurements) as measurements`,
    breakdown: `select concat(voltage_level_kv, ' kV') as name, count(*)::numeric as value
      from energy_substations s join energy_assets a on a.id=s.asset_id
      where a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED')
      group by voltage_level_kv order by voltage_level_kv desc`,
    markers: `select p.id::text, concat('VT-', p.position_code) as code,
      concat('Vị trí ', p.position_code, ' · ', a.name) as name, 'Vị trí đường dây' as category,
      a.status, st_y(p.location::geometry) as lat, st_x(p.location::geometry) as lng
      from energy_line_positions p join energy_assets a on a.id = p.line_asset_id
      where a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED')
      order by a.updated_at desc, a.code, p.sequence_no limit 500`,
    records: `select a.id::text, a.code, a.name, concat(s.voltage_level_kv, ' kV') as category,
      s.overload_status as status,
      concat(coalesce(s.installed_capacity_mva, 0), ' MVA') as metric,
      coalesce(si.name, si.address, 'Chưa xác định') as area
      from energy_substations s join energy_assets a on a.id = s.asset_id
      left join energy_sites si on si.id = a.site_id
      where a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED')
      order by a.updated_at desc, a.name limit 50`,
  },
  "2": {
    title: "Quản lý nguồn năng lượng tái tạo",
    description: "Danh mục dự án nguồn điện, công suất thiết kế và trạng thái vận hành.",
    coverage: "Dữ liệu dự án nguồn điện được đồng bộ từ danh mục hệ thống GIS và EVN.",
    kpis: `select count(*) as projects, coalesce(sum(designed_capacity_mw), 0) as capacity_mw,
      count(*) filter (where operation_status in ('OPERATING','ACTIVE')) as operating,
      count(distinct source_type) as source_types from energy_generation_projects p
      join energy_assets a on a.id=p.asset_id
      where a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED') and p.operation_status <> 'DECOMMISSIONED'`,
    breakdown: `select source_type as name, coalesce(sum(designed_capacity_mw), 0)::numeric as value
      from energy_generation_projects p join energy_assets a on a.id=p.asset_id
      where a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED') and p.operation_status <> 'DECOMMISSIONED'
      group by source_type order by value desc`,
    markers: `select a.id::text, a.code, a.name, p.source_type as category, p.operation_status as status,
      st_y(coalesce(a.location, s.location)::geometry) as lat,
      st_x(coalesce(a.location, s.location)::geometry) as lng
      from energy_generation_projects p join energy_assets a on a.id = p.asset_id
      left join energy_sites s on s.id = coalesce(p.site_id, a.site_id)
      where coalesce(a.location, s.location) is not null
      and a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED') and p.operation_status <> 'DECOMMISSIONED'
      order by a.created_at desc limit 500`,
    records: `select a.id::text, a.code, a.name, p.source_type as category, p.operation_status as status,
      concat(p.designed_capacity_mw, ' MW') as metric,
      coalesce(s.name, s.address, 'Chưa xác định') as area
      from energy_generation_projects p join energy_assets a on a.id = p.asset_id
      left join energy_sites s on s.id = coalesce(p.site_id, a.site_id)
      where a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED') and p.operation_status <> 'DECOMMISSIONED'
      order by a.created_at desc, p.designed_capacity_mw desc limit 50`,
  },
  "3": {
    title: "Điện mặt trời mái nhà",
    description: "Quản lý hệ thống điện mặt trời mái nhà, công suất và phân bố địa lý.",
    coverage:
      "Hồ sơ và công suất lấy từ dữ liệu khách hàng; GIS và chuỗi sản lượng thiếu được bổ sung có gắn cờ suy diễn.",
    kpis: `select count(*) as systems, coalesce(sum(installed_capacity_kwp), 0) as capacity_kwp,
      count(*) filter (where operation_status = 'ACTIVE') as active,
      count(distinct customer_account_id) as customers from energy_rooftop_systems r
      join energy_assets a on a.id=r.asset_id
      where a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED')
      and r.operation_status not in ('DECOMMISSIONED','DELETED')`,
    breakdown: `select case
        when installed_capacity_kwp < 10 then 'Dưới 10 kWp'
        when installed_capacity_kwp < 100 then '10–100 kWp'
        when installed_capacity_kwp < 1000 then '100–1.000 kWp'
        else 'Từ 1.000 kWp'
      end as name, count(*)::numeric as value
      from energy_rooftop_systems r join energy_assets a on a.id=r.asset_id
      where a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED')
      and r.operation_status not in ('DECOMMISSIONED','DELETED')
      group by 1 order by min(installed_capacity_kwp)`,
    markers: `select a.id::text, a.code, a.name, 'Điện mặt trời mái nhà' as category,
      r.operation_status as status, st_y(coalesce(a.location, s.location)::geometry) as lat,
      st_x(coalesce(a.location, s.location)::geometry) as lng
      from energy_rooftop_systems r join energy_assets a on a.id = r.asset_id
      left join energy_sites s on s.id = a.site_id
      where coalesce(a.location, s.location) is not null
      and a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED')
      and r.operation_status not in ('DECOMMISSIONED','DELETED')
      order by a.created_at desc limit 500`,
    records: `select a.id::text, a.code, a.name, coalesce(r.ownership_model, r.installation_type) as category,
      r.operation_status as status, concat(r.installed_capacity_kwp, ' kWp') as metric,
      coalesce(s.name, s.address, s.admin_area_code, 'Chưa xác định') as area
      from energy_rooftop_systems r join energy_assets a on a.id = r.asset_id
      left join energy_sites s on s.id = a.site_id
      where a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED')
      and r.operation_status not in ('DECOMMISSIONED','DELETED')
      order by a.created_at desc, r.installed_capacity_kwp desc limit 50`,
  },
  "4": {
    title: "Sử dụng năng lượng tiết kiệm và hiệu quả",
    description: "Theo dõi khách hàng sử dụng năng lượng trọng điểm, nghĩa vụ báo cáo và đo đếm.",
    coverage:
      "Danh mục và báo cáo lấy từ dữ liệu EVN; GIS.",
    kpis: `select count(*) as consumers,
      count(*) filter (where importance_level = 'KEY') as key_consumers,
      count(*) filter (where importance_level = 'NEAR_KEY') as near_key_consumers,
      count(*) filter (where reporting_required = 'YES') as reporting_required,
      count(*) filter (where importance_level = 'NORMAL') as normal_consumers
      from energy_consumers where status <> 'ARCHIVED'`,
    breakdown: `select sector as name, count(*)::numeric as value from energy_consumers
      where status <> 'ARCHIVED' group by sector order by value desc limit 12`,
    markers: `select c.id::text, p.code, p.name,
      concat(c.importance_level, ' · ', c.sector) as category,
      case when c.reporting_required = 'YES' then 'REPORTING_REQUIRED' else c.status end as status,
      st_y(s.location::geometry) as lat, st_x(s.location::geometry) as lng,
      a.customer_code,
      coalesce((select sum(m.energy_kwh) from energy_customer_consumption_monthly m
        where m.account_id = a.id), 0) as annual_consumption_kwh,
      coalesce((select max(m.peak_demand_kw) from energy_customer_consumption_monthly m
        where m.account_id = a.id), 0) as peak_demand_kw,
      (select count(*) from energy_consumer_reports r where r.consumer_id = c.id) as report_count,
      (select count(*) from energy_smart_meters m where m.consumer_id = c.id) as meter_count,
      c.importance_level, c.reporting_required, s.address
      from energy_consumers c join energy_parties p on p.id = c.party_id
      left join energy_sites s on s.id = c.site_id
      left join energy_customer_accounts a on a.id = c.customer_account_id
      where s.location is not null and c.status <> 'ARCHIVED'
      order by p.created_at desc limit 2000`,
    records: `select c.id::text, p.code, p.name, c.sector as category, c.status,
      c.importance_level as metric, coalesce(s.name, s.address, p.address, 'Chưa xác định') as area
      from energy_consumers c join energy_parties p on p.id = c.party_id
      left join energy_sites s on s.id = c.site_id where c.status <> 'ARCHIVED'
      order by p.created_at desc, p.name limit 50`,
  },
  "5": {
    title: "An toàn điện và hành lang lưới điện",
    description: "Quản lý vi phạm hành lang, kiểm tra hiện trường, kế hoạch cắt điện và sự cố.",
    coverage:
      "Hành lang được dựng từ tim tuyến PostGIS thật; hồ sơ vi phạm và ảnh hiện trường là kịch bản minh họa có gắn cờ.",
    kpis: `select
      (select count(*) from energy_corridor_violations v
        join energy_protection_corridors c on c.id=v.corridor_id
        join energy_assets a on a.id=c.asset_id
        where a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED')) as violations,
      (select count(*) from energy_safety_inspections i
        left join energy_protection_corridors c on c.id=i.corridor_id
        left join energy_assets a on a.id=coalesce(i.asset_id,c.asset_id)
        where a.id is null or a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED')) as inspections,
      (select count(*) from energy_outage_plans) as outage_plans,
      (select count(*) from energy_grid_incidents i left join energy_assets a on a.id=i.asset_id
        where coalesce(i.metadata->>'archived','false') <> 'true'
        and (a.id is null or a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED'))) as incidents`,
    breakdown: `select v.status as name, count(*)::numeric as value from energy_corridor_violations v
      join energy_protection_corridors c on c.id=v.corridor_id join energy_assets a on a.id=c.asset_id
      where a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED')
      group by v.status order by value desc`,
    markers: `select id,code,name,category,status,lat,lng,sort_at,
      outage_start_at,outage_end_at,outage_reason,outage_customers,outage_method from (
      select v.id::text,v.code,v.code as name,v.violation_type as category,v.status,
        st_y(v.location::geometry) as lat,st_x(v.location::geometry) as lng,v.detected_at as sort_at,
        null::timestamptz as outage_start_at,null::timestamptz as outage_end_at,null::text as outage_reason,
        null::numeric as outage_customers,null::text as outage_method
      from energy_corridor_violations v where v.location is not null and v.status <> 'ARCHIVED'
      union all
      select i.id::text,i.code,coalesce(a.name,i.code) as name,i.incident_type as category,i.status,
        st_y(coalesce(a.location,s.location)::geometry) as lat,st_x(coalesce(a.location,s.location)::geometry) as lng,i.started_at as sort_at,
        null::timestamptz as outage_start_at,null::timestamptz as outage_end_at,null::text as outage_reason,
        null::numeric as outage_customers,null::text as outage_method
      from energy_grid_incidents i left join energy_assets a on a.id=i.asset_id left join energy_sites s on s.id=a.site_id
      where coalesce(a.location,s.location) is not null and coalesce(i.metadata->>'archived','false') <> 'true'
      union all
      select o.id::text,o.code,o.title as name,'CẮT ĐIỆN' as category,o.status,
        st_y(st_pointonsurface(o.affected_geometry)::geometry) as lat,
        st_x(st_pointonsurface(o.affected_geometry)::geometry) as lng,o.start_at as sort_at,
        o.start_at as outage_start_at,o.end_at as outage_end_at,o.reason as outage_reason,
        o.affected_customers as outage_customers,o.impact_method as outage_method
      from energy_outage_plans o
      where o.status <> 'ARCHIVED' and o.affected_geometry is not null
    ) x order by sort_at desc limit 500`,
    records: `select id,code,name,category,status,metric,area from (
      select v.id::text,v.code,v.code as name,v.violation_type as category,v.status,v.severity as metric,
        coalesce(to_char(v.detected_at,'DD/MM/YYYY HH24:MI'),'Chưa xác định') as area,v.detected_at as sort_at
      from energy_corridor_violations v where v.status <> 'ARCHIVED'
      union all
      select i.id::text,i.code,coalesce(a.name,i.code) as name,i.incident_type as category,i.status,i.severity as metric,
        coalesce(to_char(i.started_at,'DD/MM/YYYY HH24:MI'),'Chưa xác định') as area,i.started_at as sort_at
      from energy_grid_incidents i left join energy_assets a on a.id=i.asset_id
      where coalesce(i.metadata->>'archived','false') <> 'true'
    ) x order by sort_at desc limit 50`,
  },
  "6": {
    title: "Kiểm kê khí nhà kính ngành năng lượng",
    description: "Quản lý nguồn phát thải, hoạt động, hệ số và nghĩa vụ báo cáo khí nhà kính.",
    coverage:
      "Nguồn chỉ có tài liệu tham chiếu; dữ liệu cơ sở và phát thải hiện là kịch bản quản trị, không dùng báo cáo pháp lý.",
    kpis: `select
      (select count(*) from energy_emission_sources where status <> 'INACTIVE') as sources,
      (select count(*) from energy_emission_activities a join energy_emission_sources s on s.id=a.source_id
        where s.status <> 'INACTIVE') as activities,
      (select coalesce(sum(a.co2e_kg), 0) from energy_emission_activities a
        join energy_emission_sources s on s.id=a.source_id where s.status <> 'INACTIVE') as co2e_kg,
      (select count(*) from energy_reporting_obligations) as obligations`,
    breakdown: `select concat(s.scope, ' - tCO2e') as name,
      coalesce(sum(a.co2e_kg),0)::numeric/1000 as value
      from energy_emission_sources s left join energy_emission_activities a on a.source_id=s.id
      where s.status <> 'INACTIVE' group by s.scope order by value desc`,
    markers: `select e.id::text, e.code, e.name, e.source_type as category, e.status,
      st_y(s.location::geometry) as lat, st_x(s.location::geometry) as lng
      from energy_emission_sources e join energy_sites s on s.id = e.site_id
      where s.location is not null and e.status <> 'INACTIVE'
      order by e.created_at desc limit 500`,
    records: `select e.id::text, e.code, e.name, e.source_type as category, e.status,
      e.scope as metric, coalesce(s.name, s.address, 'Chưa xác định') as area
      from energy_emission_sources e left join energy_sites s on s.id = e.site_id
      where e.status <> 'INACTIVE' order by e.created_at desc, e.name limit 50`,
  },
  "7": {
    title: "Hạ tầng trạm sạc xe điện",
    description: "Theo dõi trạm sạc, công suất đấu nối, đầu sạc khả dụng và trạng thái vận hành.",
    coverage:
      "Đã nạp 218 địa chỉ khách hàng; GIS, công suất, đầu sạc và snapshot thiếu được bổ sung dưới dạng kịch bản có gắn cờ.",
    kpis: `select count(*) as stations, coalesce(sum(total_power_kw), 0) as power_kw,
      coalesce(sum(connector_count), 0) as connectors,
      coalesce(sum(available_count), 0) as available from energy_ev_stations e
      join energy_assets a on a.id=e.asset_id
      where a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED') and e.operation_status <> 'DECOMMISSIONED'`,
    breakdown: `select coalesce(nullif(s.metadata->>'area', ''), 'Chưa phân vùng') as name, count(*)::numeric as value
      from energy_ev_stations e join energy_assets a on a.id=e.asset_id left join energy_sites s on s.id = e.site_id
      where a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED') and e.operation_status <> 'DECOMMISSIONED'
      group by 1 order by value desc limit 12`,
    markers: `select a.id::text, a.code, a.name, 'Trạm sạc xe điện' as category, e.operation_status as status,
      st_y(coalesce(a.location, s.location)::geometry) as lat,
      st_x(coalesce(a.location, s.location)::geometry) as lng
      from energy_ev_stations e join energy_assets a on a.id = e.asset_id
      left join energy_sites s on s.id = coalesce(e.site_id, a.site_id)
      where coalesce(a.location, s.location) is not null
      and a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED') and e.operation_status <> 'DECOMMISSIONED'
      order by a.created_at desc limit 500`,
    records: `select a.id::text, a.code, a.name, concat(e.connector_count, ' đầu sạc') as category,
      e.operation_status as status, concat(e.total_power_kw, ' kW') as metric,
      coalesce(s.name, s.address, 'Chưa xác định') as area
      from energy_ev_stations e join energy_assets a on a.id = e.asset_id
      left join energy_sites s on s.id = coalesce(e.site_id, a.site_id)
      where a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED') and e.operation_status <> 'DECOMMISSIONED'
      order by a.created_at desc, e.total_power_kw desc limit 50`,
  },
  "8": {
    title: "Quản lý hạ tầng dầu khí",
    description: "Theo dõi trạm xăng, kho xăng dầu, tuyến ống, năng lực chứa và sản lượng cung ứng.",
    coverage: "Dữ liệu được nạp từ ba CSV cơ sở dầu khí và GeoJSON đường ống trong docs/data; snapshot sản lượng là ước tính có gắn cờ.",
    kpis: `select
      (select count(*) from energy_oil_facilities f join energy_assets a on a.id=f.asset_id where a.status='ACTIVE') as facilities,
      (select count(*) from energy_oil_facilities f join energy_assets a on a.id=f.asset_id where a.status='ACTIVE' and f.facility_type ilike '%kho%') as warehouses,
      (select count(*) from energy_oil_pipelines p join energy_assets a on a.id=p.asset_id where a.status='ACTIVE') as pipelines,
      (select coalesce(sum(storage_capacity_m3),0) from energy_oil_facilities f join energy_assets a on a.id=f.asset_id where a.status='ACTIVE') as storage_m3`,
    breakdown: `select facility_type as name,count(*)::numeric as value from energy_oil_facilities f join energy_assets a on a.id=f.asset_id
      where a.status='ACTIVE' group by facility_type order by value desc`,
    markers: `select a.id::text,a.code,a.name,f.facility_type as category,f.operation_status as status,
      st_y(a.location::geometry) as lat,st_x(a.location::geometry) as lng from energy_oil_facilities f join energy_assets a on a.id=f.asset_id
      where a.location is not null and a.status='ACTIVE'
      union all
      select a.id::text,a.code,a.name,p.pipeline_type as category,'ACTIVE' as status,
      st_y(st_pointonsurface(p.geometry)::geometry) as lat,st_x(st_pointonsurface(p.geometry)::geometry) as lng
      from energy_oil_pipelines p join energy_assets a on a.id=p.asset_id where a.status='ACTIVE' limit 500`,
    records: `select a.id::text,a.code,a.name,f.facility_type as category,f.operation_status as status,
      concat(round(f.storage_capacity_m3::numeric,0),' m³') as metric,coalesce(f.address,'Chưa xác định') as area
      from energy_oil_facilities f join energy_assets a on a.id=f.asset_id where a.status='ACTIVE'
      union all
      select a.id::text,a.code,a.name,p.pipeline_type as category,'ACTIVE' as status,
      concat(coalesce(p.length_km,0),' km') as metric,concat(coalesce(p.source_facility_code,'?'),' → ',coalesce(p.destination_code,'?')) as area
      from energy_oil_pipelines p join energy_assets a on a.id=p.asset_id where a.status='ACTIVE' order by name limit 50`,
  },
};

const KPI_META: Record<string, Array<[string, string, string?]>> = {
  "1": [
    ["substations", "Trạm biến áp"],
    ["power_lines", "Đường dây"],
    ["equipment", "Thiết bị"],
    ["measurements", "Bản ghi đo"],
  ],
  "2": [
    ["projects", "Dự án"],
    ["capacity_mw", "Tổng công suất", "MW"],
    ["operating", "Đang vận hành"],
    ["source_types", "Loại nguồn"],
  ],
  "3": [
    ["systems", "Hệ thống"],
    ["capacity_kwp", "Tổng công suất", "kWp"],
    ["active", "Đang hoạt động"],
    ["customers", "Khách hàng"],
  ],
  "4": [
    ["consumers", "Khách hàng"],
    ["key_consumers", "Khách hàng trọng điểm"],
    ["near_key_consumers", "Khách hàng cận trọng điểm"],
    ["reporting_required", "Phải báo cáo"],
    ["normal_consumers", "Khách hàng thường"],
  ],
  "5": [
    ["violations", "Vi phạm hành lang"],
    ["inspections", "Đợt kiểm tra"],
    ["outage_plans", "Kế hoạch cắt điện"],
    ["incidents", "Sự cố lưới"],
  ],
  "6": [
    ["sources", "Nguồn phát thải"],
    ["activities", "Hoạt động phát thải"],
    ["co2e_kg", "Tổng phát thải kịch bản", "kg CO2e"],
    ["obligations", "Nghĩa vụ báo cáo"],
  ],
  "7": [
    ["stations", "Địa điểm kịch bản"],
    ["power_kw", "Công suất kịch bản", "kW"],
    ["connectors", "Đầu sạc kịch bản"],
    ["available", "Khả dụng kịch bản"],
  ],
  "8": [
    ["facilities", "Cơ sở dầu khí"],
    ["warehouses", "Kho xăng dầu"],
    ["pipelines", "Tuyến ống"],
    ["storage_m3", "Sức chứa", "m³"],
  ],
};

const ENRICHMENT: Record<string, EnrichmentQuerySet> = {
  "1": {
    trendTitle: "Phụ tải tác dụng có số liệu MW theo tháng",
    trendUnit: "MW",
    trend: `select to_char(measured_at,'YYYY-MM') as period,
      sum(current_load_mw)::numeric as value
      from energy_grid_operating_snapshots s join energy_assets a on a.id=s.asset_id
      where a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED')
      and current_load_mw is not null group by 1 order by 1`,
    alerts: `select g.id::text as id,coalesce(a.name,g.code) as title,
      case when g.severity in ('CRITICAL','HIGH') or g.risk_level='HIGH' then 'danger'
        when g.severity in ('WARNING','MEDIUM') or g.risk_level='MEDIUM' then 'warning' else 'info' end as severity,
      g.reason as message,g.recommendation,
      concat(round(g.current_value::numeric,1),'% · ',g.trend) as metric,g.status,
      st_y(a.location::geometry) as lat,st_x(a.location::geometry) as lng,null::text as image_url
      from energy_grid_alerts g left join energy_assets a on a.id=g.asset_id
      where a.id is null or a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED')
      order by case when g.risk_level='HIGH' then 1 when g.risk_level='MEDIUM' then 2 else 3 end,g.generated_at desc limit 20`,
    provenance: `select
      count(*) filter(where source='EVN_TELEMETRY_DERIVED')::numeric as source_records,
      count(*) filter(where source<>'EVN_TELEMETRY_DERIVED')::numeric as inferred_records,
      count(*)::numeric as observations from energy_grid_operating_snapshots`,
    notes: [
      "Chuỗi phụ tải chỉ cộng các snapshot có đại lượng MW; không cộng lẫn MW với MVA.",
      "Các điểm thiếu telemetry được nội suy theo thông số kỹ thuật và gắn nguồn NV1_DASHBOARD_SEED_V1.",
    ],
  },
  "2": {
    trendTitle: "Sản lượng nguồn điện theo tháng",
    trendUnit: "MWh",
    trend: `select to_char(measured_at,'YYYY-MM') as period,sum(energy_mwh)::numeric as value
      from energy_generation_operational_snapshots s join energy_assets a on a.id=s.project_asset_id
      where a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED') group by 1 order by 1`,
    alerts: `select p.asset_id::text as id,a.name as title,
      case when p.operation_status='PLANNED' and p.designed_capacity_mw>=200 then 'warning'
        when coalesce(x.availability_pct,100)<88 then 'danger' else 'info' end as severity,
      case when p.operation_status='PLANNED' then 'Dự án công suất lớn đang chờ triển khai.'
        else 'Độ khả dụng kỳ gần nhất thấp hơn mức theo dõi.' end as message,
      case when p.operation_status='PLANNED' then 'Rà soát tiến độ pháp lý, đấu nối và kế hoạch giải tỏa công suất.'
        else 'Kiểm tra lịch bảo trì và nguyên nhân suy giảm khả dụng.' end as recommendation,
      concat(coalesce(x.availability_pct,0),'% · ',p.designed_capacity_mw,' MW') as metric,
      p.operation_status as status,st_y(a.location::geometry) as lat,st_x(a.location::geometry) as lng,null::text as image_url
      from energy_generation_projects p join energy_assets a on a.id=p.asset_id
      left join lateral (select availability_pct from energy_generation_operational_snapshots s
        where s.project_asset_id=p.asset_id order by measured_at desc limit 1) x on true
      where a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED') and p.operation_status <> 'DECOMMISSIONED'
      and ((p.operation_status='PLANNED' and p.designed_capacity_mw>=200) or coalesce(x.availability_pct,100)<88)
      order by p.designed_capacity_mw desc limit 12`,
    provenance: `select count(*)::numeric as source_records,
      (count(*) filter(where a.metadata->>'coordinateAuthoritative'='false')
        +(select count(*) from energy_generation_operational_snapshots where quality='ESTIMATED'))::numeric as inferred_records,
      (select count(*) from energy_generation_operational_snapshots)::numeric as observations
      from energy_generation_projects p join energy_assets a on a.id=p.asset_id
      where a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED') and p.operation_status <> 'DECOMMISSIONED'`,
    notes: [
      "Danh mục, công suất và 21 tọa độ ban đầu lấy từ dữ liệu khách hàng.",
      "Tọa độ còn thiếu và snapshot vận hành mang nguồn NV2_DASHBOARD_SEED_V1.",
    ],
  },
  "3": {
    trendTitle: "Sản lượng điện mặt trời mái nhà",
    trendUnit: "kWh",
    trend: `select period,sum(energy_generated_kwh)::numeric as value
      from energy_rooftop_generation_monthly m join energy_assets a on a.id=m.system_asset_id
      join energy_rooftop_systems r on r.asset_id=m.system_asset_id
      where a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED') and r.operation_status not in ('DECOMMISSIONED','DELETED')
      group by period order by period`,
    alerts: `select r.asset_id::text as id,a.name as title,
      case when coalesce(r.installed_capacity_kwp,0)=0 then 'danger'
        when g.generated is not null and g.generated<r.installed_capacity_kwp*70 then 'warning' else 'info' end as severity,
      case when coalesce(r.installed_capacity_kwp,0)=0 then 'Công suất nguồn chưa được cung cấp trong hồ sơ.'
        else 'Sản lượng kỳ gần nhất thấp hơn ngưỡng kịch bản 70 kWh/kWp.' end as message,
      case when coalesce(r.installed_capacity_kwp,0)=0 then 'Bổ sung biên bản nghiệm thu và công suất inverter/pin.'
        else 'Kiểm tra che bóng, inverter, công tơ và tình trạng vệ sinh tấm pin.' end as recommendation,
      concat(round(coalesce(g.generated,0)::numeric,1),' kWh') as metric,r.operation_status as status,
      st_y(a.location::geometry) as lat,st_x(a.location::geometry) as lng,null::text as image_url
      from energy_rooftop_systems r join energy_assets a on a.id=r.asset_id
      left join lateral(select energy_generated_kwh as generated from energy_rooftop_generation_monthly m
        where m.system_asset_id=r.asset_id order by period desc limit 1) g on true
      where a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED') and r.operation_status not in ('DECOMMISSIONED','DELETED')
      and (coalesce(r.installed_capacity_kwp,0)=0 or (g.generated is not null and g.generated<r.installed_capacity_kwp*70))
      order by coalesce(r.installed_capacity_kwp,0) desc limit 12`,
    provenance: `select count(*)::numeric as source_records,
      (count(*) filter(where a.metadata->>'coordinateAuthoritative'='false')
        +(select count(*) from energy_rooftop_generation_monthly where quality='ESTIMATED'))::numeric as inferred_records,
      (select count(*) from energy_rooftop_generation_monthly)::numeric as observations
      from energy_rooftop_systems r join energy_assets a on a.id=r.asset_id
      where a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED') and r.operation_status not in ('DECOMMISSIONED','DELETED')`,
    notes: [
      "7.568 hồ sơ hệ thống và công suất lấy từ dữ liệu khách hàng đã chuẩn hóa.",
      "GIS phân cụm và chuỗi sản lượng thiếu được đánh dấu ESTIMATED/NV3_DASHBOARD_SEED_V1.",
    ],
  },
  "4": {
    trendTitle: "Điện năng báo cáo của cơ sở",
    trendUnit: "kWh",
    trend: `select r.period,sum(r.reported_energy_kwh)::numeric as value from energy_consumer_reports r
      join energy_consumers c on c.id=r.consumer_id where c.status <> 'ARCHIVED' group by r.period order by r.period`,
    alerts: `select c.id::text as id,p.name as title,
      case when c.reporting_required='YES' and not exists(
        select 1 from energy_consumer_reports er where er.consumer_id=c.id
          and er.period like concat(to_char(current_date,'YYYY'),'%')) then 'danger'
        when b.baseline_kwh>=5000000 then 'warning' else 'info' end as severity,
      case when c.reporting_required='YES' and not exists(
        select 1 from energy_consumer_reports er where er.consumer_id=c.id
          and er.period like concat(to_char(current_date,'YYYY'),'%'))
        then concat('Cơ sở thuộc diện báo cáo nhưng chưa có báo cáo kỳ ',to_char(current_date,'YYYY'),'.')
        else 'Mức tiêu thụ baseline cao, cần ưu tiên giám sát giải pháp tiết kiệm.' end as message,
      case when c.reporting_required='YES' and not exists(
        select 1 from energy_consumer_reports er where er.consumer_id=c.id
          and er.period like concat(to_char(current_date,'YYYY'),'%'))
        then 'Nhắc nộp báo cáo, kiểm tra tính đầy đủ và đối soát với EVN.'
        else 'Theo dõi chỉ số cường độ năng lượng và tiến độ giải pháp tiết kiệm.' end as recommendation,
      concat(round(coalesce(b.baseline_kwh,0)::numeric,0),' kWh') as metric,c.status,
      st_y(s.location::geometry) as lat,st_x(s.location::geometry) as lng,null::text as image_url
      from energy_consumers c join energy_parties p on p.id=c.party_id left join energy_sites s on s.id=c.site_id
      left join lateral(select baseline_kwh from energy_efficiency_baselines b where b.consumer_id=c.id order by created_at desc limit 1) b on true
      where c.status <> 'ARCHIVED' and ((c.reporting_required='YES' and not exists(
        select 1 from energy_consumer_reports er where er.consumer_id=c.id
          and er.period like concat(to_char(current_date,'YYYY'),'%'))) or b.baseline_kwh>=5000000)
      order by b.baseline_kwh desc nulls last limit 12`,
    provenance: `select count(*)::numeric as source_records,
      count(*) filter(where s.metadata->>'coordinateAuthoritative'='false')::numeric as inferred_records,
      ((select count(*) from energy_consumer_reports)+(select count(*) from energy_efficiency_baselines))::numeric as observations
      from energy_consumers c left join energy_sites s on s.id=c.site_id where c.status <> 'ARCHIVED'`,
    notes: [
      "Danh mục cơ sở và báo cáo ngưỡng tiêu thụ lấy từ dữ liệu EVN/khách hàng.",
      "Vị trí GIS, baseline còn thiếu và giải pháp đề xuất được gắn nguồn NV4_DASHBOARD_SEED_V1.",
    ],
  },
  "5": {
    trendTitle: "Phát hiện mất an toàn theo ngày",
    trendUnit: "vụ việc",
    trend: `select to_char(v.detected_at,'YYYY-MM-DD') as period,count(*)::numeric as value
      from energy_corridor_violations v join energy_protection_corridors c on c.id=v.corridor_id
      join energy_assets a on a.id=c.asset_id
      where a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED') group by 1 order by 1`,
    alerts: `select v.id::text as id,concat(v.code,' · ',v.violation_type) as title,
      case when v.severity in ('CRITICAL','HIGH') then 'danger' when v.severity='MEDIUM' then 'warning' else 'info' end as severity,
      concat('Khoảng cách ghi nhận: ',coalesce(v.distance_m::text,'chưa đo'),' m. Trạng thái ',v.status,'.') as message,
      coalesce(v.evidence->>'recommendation','Tổ chức kiểm tra hiện trường và cập nhật biện pháp xử lý.') as recommendation,
      concat(v.severity,' · ',v.status) as metric,v.status,
      st_y(v.location::geometry) as lat,st_x(v.location::geometry) as lng,v.evidence->>'image' as image_url
      from energy_corridor_violations v join energy_protection_corridors c on c.id=v.corridor_id
      join energy_assets a on a.id=c.asset_id
      where a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED')
      order by case v.severity when 'CRITICAL' then 1 when 'HIGH' then 2 else 3 end,v.detected_at desc limit 20`,
    polygons: `select c.id::text,a.name,concat('Hành lang ',a.code) as category,
      case when exists(select 1 from energy_corridor_violations v where v.corridor_id=c.id and v.status<>'CLOSED') then '#dc2626' else '#f59e0b' end as color,
      st_asgeojson(c.geometry) as geometry,null::text as outage_code,null::timestamptz as outage_start_at,
      null::timestamptz as outage_end_at,null::text as outage_reason,null::numeric as outage_customers,
      null::text as outage_method from energy_protection_corridors c join energy_assets a on a.id=c.asset_id where c.status='ACTIVE'
      union all
      select o.id::text,concat(o.title,' · ',o.code) as name,'Vùng ảnh hưởng cắt điện' as category,
        '#dc2626' as color,st_asgeojson(o.affected_geometry) as geometry,o.code as outage_code,
        o.start_at as outage_start_at,o.end_at as outage_end_at,o.reason as outage_reason,
        o.affected_customers as outage_customers,o.impact_method as outage_method
      from energy_outage_plans o
      where o.status <> 'ARCHIVED' and o.affected_geometry is not null`,
    media: `select m.id::text,m.title,m.file_ref as url,m.notes as caption,
      coalesce(v.severity,'INFO') as severity,v.code as related_code
      from energy_safety_inspection_media m
      join energy_safety_inspections i on i.id=m.inspection_id
      left join energy_safety_inspection_violations iv on iv.inspection_id=i.id
      left join energy_corridor_violations v on v.id=iv.violation_id
      where m.status='ACTIVE' order by m.captured_at desc limit 12`,
    provenance: `select (select count(*) from energy_power_lines l join energy_assets a on a.id=l.asset_id
        where l.geometry is not null and a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED'))::numeric as source_records,
      (select count(*) from energy_corridor_violations v join energy_protection_corridors c on c.id=v.corridor_id
        join energy_assets a on a.id=c.asset_id where v.evidence->>'authoritative'='false'
        and a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED'))::numeric as inferred_records,
      ((select count(*) from energy_safety_inspections)+(select count(*) from energy_safety_inspection_media))::numeric as observations`,
    notes: [
      "Polygon hành lang được buffer từ tim tuyến PostGIS thật.",
      "Vi phạm, kiểm tra và ảnh hiện trường hiện là kịch bản minh họa, có authoritative=false và illustrativeImage=true.",
    ],
  },
  "6": {
    trendTitle: "Phát thải khí nhà kính theo kỳ",
    trendUnit: "tCO2e",
    trend: `select a.period,(sum(a.co2e_kg)/1000)::numeric as value from energy_emission_activities a
      join energy_emission_sources s on s.id=a.source_id where s.status <> 'INACTIVE' group by a.period order by a.period`,
    alerts: `select s.id::text as id,s.name as title,
      case when x.co2e_kg>=150000 then 'danger' when x.co2e_kg>=80000 then 'warning' else 'info' end as severity,
      concat('Nguồn có phát thải ',coalesce(s.scope,'chưa phân loại'),' kỳ gần nhất cần theo dõi.') as message,
      'Xác minh dữ liệu hoạt động, hệ số phát thải và lập kế hoạch giảm phát thải theo cơ sở.' as recommendation,
      concat(round((x.co2e_kg/1000)::numeric,1),' tCO2e') as metric,s.status,
      st_y(si.location::geometry) as lat,st_x(si.location::geometry) as lng,null::text as image_url
      from energy_emission_sources s left join energy_sites si on si.id=s.site_id
      join lateral(select co2e_kg from energy_emission_activities a where a.source_id=s.id order by period desc limit 1) x on true
      where s.status <> 'INACTIVE' order by x.co2e_kg desc limit 12`,
    provenance: `select count(*) filter(where classification<>'SCENARIO')::numeric as source_records,
      (count(*) filter(where classification='SCENARIO')
        +(select count(*) from energy_emission_activities a join energy_emission_sources s2 on s2.id=a.source_id
          where s2.status <> 'INACTIVE' and s2.classification='SCENARIO'))::numeric as inferred_records,
      (select count(*) from energy_emission_activities a join energy_emission_sources s2 on s2.id=a.source_id where s2.status <> 'INACTIVE')::numeric as observations
      from energy_emission_sources where status <> 'INACTIVE'`,
    notes: [
      "Nguồn khách hàng chỉ có tài liệu tham chiếu NV6, chưa có số liệu kiểm kê cơ sở chính thức.",
      "Nguồn phát thải, hoạt động và hệ số hiện tại là kịch bản có classification/sourceSystem=SCENARIO, không dùng để báo cáo pháp lý.",
    ],
  },
  "7": {
    trendTitle: "Điện năng cấp qua trạm sạc",
    trendUnit: "kWh",
    trend: `select to_char(measured_at,'YYYY-MM') as period,sum(energy_delivered_kwh)::numeric as value
      from energy_ev_station_snapshots s join energy_ev_stations e on e.asset_id=s.station_asset_id
      join energy_assets a on a.id=e.asset_id
      where a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED') and e.operation_status <> 'DECOMMISSIONED'
      group by 1 order by 1`,
    alerts: `select e.asset_id::text as id,a.name as title,
      case when e.faulted_count>0 then 'danger' when e.utilization_pct>=75 then 'warning' else 'info' end as severity,
      case when e.faulted_count>0 then 'Có đầu sạc ở trạng thái lỗi cần xử lý.'
        else 'Mức sử dụng cao, có nguy cơ thiếu đầu sạc khả dụng vào giờ cao điểm.' end as message,
      case when e.faulted_count>0 then 'Kiểm tra thiết bị, cô lập đầu sạc lỗi và cập nhật thời gian khôi phục.'
        else 'Theo dõi công suất đỉnh và xem xét bổ sung đầu sạc/công suất đấu nối.' end as recommendation,
      concat(round(e.utilization_pct::numeric,1),'% · ',e.available_count,'/',e.connector_count,' khả dụng') as metric,
      e.operation_status as status,st_y(a.location::geometry) as lat,st_x(a.location::geometry) as lng,null::text as image_url
      from energy_ev_stations e join energy_assets a on a.id=e.asset_id
      where a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED') and e.operation_status <> 'DECOMMISSIONED'
      and (e.faulted_count>0 or e.utilization_pct>=75) order by e.faulted_count desc,e.utilization_pct desc limit 12`,
    provenance: `select count(*)::numeric as source_records,
      (count(*) filter(where a.metadata->>'technicalValuesAuthoritative'='false')
        +(select count(*) from energy_ev_station_snapshots))::numeric as inferred_records,
      (select count(*) from energy_ev_station_snapshots)::numeric as observations
      from energy_ev_stations e join energy_assets a on a.id=e.asset_id
      where a.status not in ('ARCHIVED','DECOMMISSIONED','DELETED') and e.operation_status <> 'DECOMMISSIONED'`,
    notes: [
      "218 địa chỉ trạm sạc lấy từ dữ liệu khách hàng.",
      "Tọa độ, công suất, đầu sạc và snapshot hiện là kịch bản NV7_DASHBOARD_SEED_V1 vì nguồn chưa cung cấp thông số kỹ thuật.",
    ],
  },
  "8": {
    trendTitle: "Sản lượng qua cơ sở dầu khí theo tháng",
    trendUnit: "lít",
    trend: `select to_char(measured_at,'YYYY-MM') as period,sum(throughput_litres)::numeric as value
      from energy_oil_facility_snapshots s join energy_assets a on a.id=s.facility_asset_id
      where a.status='ACTIVE' group by 1 order by 1`,
    alerts: `select o.id::text,o.title,
      case when o.severity in ('CRITICAL','HIGH') or o.alert_type='INCIDENT' then 'danger' else 'warning' end as severity,
      o.message,o.recommendation,concat(o.severity,' · ',f.facility_type) as metric,o.status,
      st_y(a.location::geometry) as lat,st_x(a.location::geometry) as lng,null::text as image_url
      from energy_oil_alerts o join energy_assets a on a.id=o.facility_asset_id
      join energy_oil_facilities f on f.asset_id=o.facility_asset_id
      where a.status='ACTIVE' and o.status <> 'CLOSED'
      order by case when o.alert_type='INCIDENT' then 1 else 2 end,o.detected_at desc limit 7`,
    provenance: `select count(*)::numeric as source_records,
      (select count(*) from energy_oil_facility_snapshots where metadata->>'authoritative'='false')::numeric as inferred_records,
      (select count(*) from energy_oil_facility_snapshots)::numeric as observations
      from energy_oil_facilities f join energy_assets a on a.id=f.asset_id where a.status='ACTIVE'`,
    notes: [
      "Danh mục cơ sở và hình học tuyến lấy từ các tệp CSV/GeoJSON trong docs/data.",
      "Snapshot sản lượng được suy diễn từ sản lượng ước tính theo ngày, có authoritative=false và cần đối soát với đơn vị vận hành.",
    ],
  },
};

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nextForecastPeriod(lastPeriod: string, offset: number) {
  const month = /^(\d{4})-(\d{2})$/.exec(lastPeriod);
  if (month) {
    const date = new Date(Date.UTC(Number(month[1]), Number(month[2]) - 1 + offset, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  if (/^\d{4}$/.test(lastPeriod)) return String(Number(lastPeriod) + offset);
  return `Kịch bản +${offset}`;
}

function forecastTrend(rows: Array<Record<string, unknown>>) {
  const usableRows = rows
    .filter((row) => !/SNAPSHOT|PARTIAL|TẠM/i.test(String(row.period ?? "")))
    .filter((row) => row.value != null && Number.isFinite(Number(row.value)))
    .slice(-12);
  const values = usableRows.map((row) => toNumber(row.value));
  if (values.length < 6) return [];
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((sum, value) => sum + value, 0) / n;
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    numerator += (index - xMean) * (value - yMean);
    denominator += (index - xMean) ** 2;
  });
  const slope = denominator ? numerator / denominator : 0;
  const residual = Math.sqrt(
    values.reduce((sum, value, index) => {
      const expected = yMean + slope * (index - xMean);
      return sum + (value - expected) ** 2;
    }, 0) / n,
  );
  const lastPeriod = String(usableRows.at(-1)?.period ?? "");
  return Array.from({ length: 6 }, (_, index) => {
    const value = Math.max(0, yMean + slope * (n + index - xMean));
    const scenarioBand = Math.max(residual, Math.abs(value) * 0.08, Math.abs(yMean) * 0.05);
    return {
      period: nextForecastPeriod(lastPeriod, index + 1),
      value: Math.round(value * 100) / 100,
      min: Math.max(0, Math.round((value - scenarioBand) * 100) / 100),
      max: Math.round((value + scenarioBand) * 100) / 100,
    };
  });
}

async function run(statement: string) {
  const result = await db.execute(sql.raw(statement));
  return result.rows as Array<Record<string, unknown>>;
}

export async function GET(_request: Request, context: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await context.params;
  const query = QUERIES[taskId];
  if (!query) return NextResponse.json({ error: "Nhiệm vụ không tồn tại." }, { status: 404 });
  const enrichment = ENRICHMENT[taskId];

  try {
    const [
      kpiRows,
      breakdownRows,
      markerRows,
      recordRows,
      trendRows,
      alertRows,
      polygonRows,
      mediaRows,
      provenanceRows,
    ] = await Promise.all([
      run(query.kpis),
      run(query.breakdown),
      run(query.markers),
      run(query.records),
      enrichment ? run(enrichment.trend) : Promise.resolve([]),
      enrichment ? run(enrichment.alerts) : Promise.resolve([]),
      enrichment?.polygons ? run(enrichment.polygons) : Promise.resolve([]),
      enrichment?.media ? run(enrichment.media) : Promise.resolve([]),
      enrichment ? run(enrichment.provenance) : Promise.resolve([]),
    ]);
    const first = kpiRows[0] ?? {};
    const kpis = KPI_META[taskId].map(([key, label, unit]) => ({
      label,
      value: toNumber(first[key]),
      ...(unit ? { unit } : {}),
    }));
    const totalRecords = kpis[0]?.value ?? 0;

    const trend = trendRows.map((row) => ({
      period: String(row.period ?? ""),
      value: toNumber(row.value),
    }));
    const provenance = provenanceRows[0] ?? {};

    return NextResponse.json({
      taskId: Number(taskId),
      title: query.title,
      description: query.description,
      coverage: query.coverage,
      coverageStatus: totalRecords > 0 ? "READY" : "EMPTY",
      updatedAt: new Date().toISOString(),
      kpis,
      breakdown: breakdownRows.map((row) => ({
        name: String(row.name ?? "Khác"),
        value: toNumber(row.value),
      })),
      markers: markerRows
        .map((row) => ({
          id: String(row.id),
          code: String(row.code ?? ""),
          name: String(row.name ?? ""),
          category: String(row.category ?? ""),
          status: String(row.status ?? ""),
          lat: toNumber(row.lat),
          lng: toNumber(row.lng),
          ...(row.customer_code != null ? { customer_code: String(row.customer_code) } : {}),
          ...(row.annual_consumption_kwh != null
            ? { annual_consumption_kwh: toNumber(row.annual_consumption_kwh) }
            : {}),
          ...(row.peak_demand_kw != null ? { peak_demand_kw: toNumber(row.peak_demand_kw) } : {}),
          ...(row.report_count != null ? { report_count: toNumber(row.report_count) } : {}),
          ...(row.meter_count != null ? { meter_count: toNumber(row.meter_count) } : {}),
          ...(row.importance_level != null ? { importance_level: String(row.importance_level) } : {}),
          ...(row.reporting_required != null
            ? { reporting_required: String(row.reporting_required) }
            : {}),
          ...(row.address != null ? { address: String(row.address) } : {}),
          ...(row.outage_start_at != null ? { outageStartAt: String(row.outage_start_at) } : {}),
          ...(row.outage_end_at != null ? { outageEndAt: String(row.outage_end_at) } : {}),
          ...(row.outage_reason != null ? { outageReason: String(row.outage_reason) } : {}),
          ...(row.outage_customers != null ? { outageCustomers: toNumber(row.outage_customers) } : {}),
          ...(row.outage_method != null ? { outageMethod: String(row.outage_method) } : {}),
        }))
        .filter((item) => item.lat && item.lng),
      records: recordRows.map((row) => ({
        id: String(row.id),
        code: String(row.code ?? ""),
        name: String(row.name ?? ""),
        category: String(row.category ?? ""),
        status: String(row.status ?? ""),
        metric: String(row.metric ?? ""),
        area: String(row.area ?? ""),
      })),
      intelligence: enrichment
        ? {
            trendTitle: enrichment.trendTitle,
            trendUnit: enrichment.trendUnit,
            trend,
            forecast: forecastTrend(trendRows),
            forecastMethod:
              "Ngoại suy tuyến tính tối đa 12 kỳ đủ dữ liệu (tối thiểu 6 kỳ); dải thấp/cao là biên kịch bản theo sai số phần dư tối thiểu 8%, không phải khoảng tin cậy thống kê.",
            alerts: alertRows.map((row) => ({
              id: String(row.id ?? ""),
              title: String(row.title ?? ""),
              severity: String(row.severity ?? "info"),
              message: String(row.message ?? ""),
              recommendation: String(row.recommendation ?? ""),
              metric: String(row.metric ?? ""),
              status: String(row.status ?? ""),
              lat: row.lat == null ? null : toNumber(row.lat),
              lng: row.lng == null ? null : toNumber(row.lng),
              imageUrl: row.image_url ? String(row.image_url) : null,
            })),
            polygons: polygonRows.flatMap((row) => {
              try {
                const geometry = JSON.parse(String(row.geometry ?? "null")) as {
                  coordinates?: unknown;
                } | null;
                return geometry
                  ? [
                      {
                        id: String(row.id),
                        name: String(row.name ?? ""),
                        category: String(row.category ?? ""),
                        color: String(row.color ?? "#f59e0b"),
                        geometry,
                        ...(row.outage_code ? { outageCode: String(row.outage_code) } : {}),
                        ...(row.outage_start_at ? { outageStartAt: String(row.outage_start_at) } : {}),
                        ...(row.outage_end_at ? { outageEndAt: String(row.outage_end_at) } : {}),
                        ...(row.outage_reason ? { outageReason: String(row.outage_reason) } : {}),
                        ...(row.outage_customers != null ? { outageCustomers: toNumber(row.outage_customers) } : {}),
                        ...(row.outage_method ? { outageMethod: String(row.outage_method) } : {}),
                      },
                    ]
                  : [];
              } catch {
                return [];
              }
            }),
            media: mediaRows.map((row) => ({
              id: String(row.id ?? ""),
              title: String(row.title ?? ""),
              url: String(row.url ?? ""),
              caption: String(row.caption ?? ""),
              severity: String(row.severity ?? ""),
              relatedCode: String(row.related_code ?? ""),
            })),
            provenance: {
              sourceRecords: toNumber(provenance.source_records),
              inferredRecords: toNumber(provenance.inferred_records),
              observations: toNumber(provenance.observations),
              notes: enrichment.notes,
            },
          }
        : null,
    });
  } catch (error) {
    console.error(`Cannot load mission ${taskId} summary`, error);
    return NextResponse.json({ error: "Không thể truy vấn dữ liệu nhiệm vụ." }, { status: 500 });
  }
}
