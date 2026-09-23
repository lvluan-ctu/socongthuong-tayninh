export type MissionDataAccess = "full" | "append" | "review" | "readonly" | "workflow";
export type MissionDataScope = "domain" | "shared" | "ai";
export type MissionDataImpact = "KPI" | "CHART" | "GIS" | "REPORT" | "AI" | "GOVERNANCE";

export type MissionDataResource = {
  table: string;
  label: string;
  group: string;
  scope: MissionDataScope;
  access: MissionDataAccess;
  impacts: MissionDataImpact[];
  description?: string;
};

/**
 * Canonical business table behind the primary KPI on each mission dashboard.
 * The catalog opens this table first instead of an unrelated empty table.
 */
export const MISSION_PRIMARY_DATA_TABLE: Record<number, string> = {
  1: "energy_substations",
  2: "energy_generation_projects",
  3: "energy_rooftop_systems",
  4: "energy_consumers",
  5: "energy_corridor_violations",
  6: "energy_emission_sources",
  7: "energy_ev_stations",
};

/** Physical tables read directly by the four KPI cards of each dashboard. */
export const MISSION_DASHBOARD_DATA_TABLES: Record<number, readonly string[]> = {
  1: [
    "energy_substations",
    "energy_power_lines",
    "energy_electrical_equipment",
    "energy_measurements",
  ],
  2: ["energy_generation_projects"],
  3: ["energy_rooftop_systems"],
  4: ["energy_consumers", "energy_smart_meters"],
  5: [
    "energy_corridor_violations",
    "energy_safety_inspections",
    "energy_outage_plans",
    "energy_grid_incidents",
  ],
  6: [
    "energy_emission_sources",
    "energy_emission_activities",
    "energy_reporting_obligations",
  ],
  7: ["energy_ev_stations"],
  8: ["energy_oil_facilities", "energy_oil_pipelines", "energy_oil_facility_snapshots", "energy_oil_alerts"],
};

function resource(
  table: string,
  label: string,
  group: string,
  scope: MissionDataScope,
  access: MissionDataAccess = "full",
  impacts: MissionDataImpact[] = ["REPORT"],
  description?: string,
): MissionDataResource {
  return { table, label, group, scope, access, impacts, description };
}

/**
 * Shared registry used by all seven missions. Composite root entities remain on
 * their validated workflow; this catalog exposes every physical table without
 * bypassing those multi-table invariants.
 */
export const SHARED_MISSION_DATA_RESOURCES: MissionDataResource[] = [
  resource("energy_admin_areas", "Địa bàn hành chính", "Danh mục dùng chung", "shared", "readonly", ["GIS", "GOVERNANCE"]),
  resource("energy_parties", "Tổ chức / cá nhân", "Danh mục dùng chung", "shared", "full", ["REPORT", "GOVERNANCE"]),
  resource("energy_sites", "Site và vị trí", "Danh mục dùng chung", "shared", "full", ["GIS", "REPORT"]),
  resource("energy_assets", "Tài sản năng lượng", "Danh mục dùng chung", "shared", "full", ["KPI", "GIS", "REPORT"], "Bảng gốc của tài sản. Khi tạo tài sản chuyên ngành, ưu tiên workflow nghiệp vụ để tạo đồng bộ Site và bảng chi tiết."),
  resource("energy_external_identifiers", "Mã định danh bên ngoài", "Danh mục dùng chung", "shared", "full", ["GOVERNANCE"]),
  resource("energy_asset_relations", "Quan hệ tài sản", "Danh mục dùng chung", "shared", "full", ["GIS", "GOVERNANCE"]),
  resource("energy_data_sources", "Nguồn dữ liệu", "Quản trị nguồn", "shared", "full", ["GOVERNANCE", "REPORT"]),
  resource("energy_import_batches", "Lô nhập dữ liệu", "Quản trị nguồn", "shared", "review", ["GOVERNANCE"]),
  resource("energy_import_records", "Bản ghi nhập", "Quản trị nguồn", "shared", "review", ["GOVERNANCE"]),
  resource("energy_metric_definitions", "Định nghĩa chỉ số", "Đo đếm dùng chung", "shared", "full", ["CHART", "AI", "GOVERNANCE"]),
  resource("energy_measurement_points", "Điểm đo", "Đo đếm dùng chung", "shared", "full", ["CHART", "GIS", "AI"]),
  resource("energy_measurements", "Giá trị đo", "Đo đếm dùng chung", "shared", "append", ["KPI", "CHART", "AI"]),
  resource("energy_metric_source_mappings", "Ánh xạ chỉ số nguồn", "Đo đếm dùng chung", "shared", "full", ["GOVERNANCE"]),
  resource("energy_measurement_point_mappings", "Ánh xạ điểm đo", "Đo đếm dùng chung", "shared", "full", ["GOVERNANCE", "GIS"]),
  resource("energy_data_quality_issues", "Vấn đề chất lượng dữ liệu", "Quản trị nguồn", "shared", "review", ["GOVERNANCE"]),
];

export const AI_MISSION_DATA_RESOURCES: MissionDataResource[] = [
  resource("energy_ai_jobs", "Lịch sử yêu cầu AI", "Dữ liệu AI dùng chung", "ai", "review", ["AI", "REPORT"]),
  resource("energy_ai_job_results", "Kết quả AI", "Dữ liệu AI dùng chung", "ai", "readonly", ["AI", "CHART", "REPORT"]),
  resource("energy_ai_job_files", "Tệp AI", "Dữ liệu AI dùng chung", "ai", "readonly", ["AI", "GOVERNANCE"]),
  resource("energy_ai_job_reviews", "Duyệt kết quả AI", "Dữ liệu AI dùng chung", "ai", "append", ["AI", "GOVERNANCE"]),
  resource("energy_ai_forecast_evaluations", "Đánh giá dự báo AI", "Dữ liệu AI dùng chung", "ai", "append", ["AI", "CHART"]),
];

export const MISSION_DATA_RESOURCES: Record<number, MissionDataResource[]> = {
  1: [
    resource("energy_substations", "Trạm biến áp", "Tài sản lưới", "domain", "workflow", ["KPI", "GIS", "CHART", "REPORT"]),
    resource("energy_transformers", "Máy biến áp", "Tài sản lưới", "domain", "full", ["KPI", "REPORT"]),
    resource("energy_bays", "Ngăn lộ", "Tài sản lưới", "domain", "full", ["REPORT"]),
    resource("energy_feeders", "Xuất tuyến / feeder", "Tài sản lưới", "domain", "full", ["KPI", "GIS", "CHART"]),
    resource("energy_power_lines", "Đường dây điện", "Tài sản lưới", "domain", "full", ["KPI", "GIS", "CHART"]),
    resource("energy_line_positions", "Vị trí tuyến / cột", "Tài sản lưới", "domain", "full", ["GIS", "REPORT"]),
    resource("energy_electrical_equipment", "Thiết bị điện", "Tài sản lưới", "domain", "full", ["KPI", "REPORT"]),
    resource("energy_load_zones", "Vùng phụ tải", "Không gian lưới", "domain", "full", ["GIS", "CHART", "AI"]),
    resource("energy_grid_capacity_assessments", "Đánh giá khả năng lưới", "Phân tích lưới", "domain", "full", ["CHART", "AI", "REPORT"]),
    resource("energy_power_structures", "Kết cấu cột / tháp", "Tài sản lưới", "domain", "full", ["GIS", "REPORT"]),
    resource("energy_grid_operating_snapshots", "Snapshot vận hành", "Vận hành lưới", "domain", "append", ["KPI", "CHART", "AI"]),
    resource("energy_grid_operation_events", "Nhật ký thao tác", "Vận hành lưới", "domain", "append", ["REPORT", "AI"]),
    resource("energy_grid_alerts", "Cảnh báo lưới", "Vận hành lưới", "domain", "review", ["KPI", "GIS", "AI"]),
  ],
  2: [
    resource("energy_generation_projects", "Dự án nguồn điện", "Danh mục nguồn", "domain", "workflow", ["KPI", "GIS", "CHART", "REPORT"]),
    resource("energy_generation_units", "Tổ máy", "Vận hành nguồn", "domain", "full", ["KPI", "CHART"]),
    resource("energy_generation_operational_snapshots", "Snapshot vận hành nguồn", "Vận hành nguồn", "domain", "append", ["CHART", "AI"]),
    resource("energy_fuel_storages", "Kho nhiên liệu", "Nhiên liệu", "domain", "full", ["KPI", "REPORT"]),
    resource("energy_fuel_inventory_snapshots", "Tồn kho nhiên liệu", "Nhiên liệu", "domain", "append", ["CHART", "AI"]),
    resource("energy_fuel_movements", "Nhập / xuất nhiên liệu", "Nhiên liệu", "domain", "append", ["CHART", "REPORT"]),
    resource("energy_fuel_supply_contracts", "Hợp đồng cung ứng", "Nhiên liệu", "domain", "full", ["REPORT"]),
    resource("energy_generation_resource_reserves", "Dự trữ tài nguyên", "Nhiên liệu", "domain", "append", ["CHART", "AI"]),
    resource("energy_generation_plans", "Kế hoạch nguồn điện", "Quy hoạch nguồn", "domain", "full", ["CHART", "REPORT"]),
    resource("energy_generation_planning_documents", "Văn bản quy hoạch", "Quy hoạch nguồn", "domain", "full", ["REPORT", "GOVERNANCE"]),
    resource("energy_generation_plan_documents", "Liên kết kế hoạch – văn bản", "Quy hoạch nguồn", "domain", "full", ["GOVERNANCE"]),
  ],
  3: [
    resource("energy_customer_accounts", "Tài khoản khách hàng điện", "Khách hàng và công trình", "domain", "full", ["KPI", "REPORT"]),
    resource("energy_customer_consumption_monthly", "Tiêu thụ điện theo tháng", "Khách hàng và công trình", "domain", "append", ["CHART", "AI"]),
    resource("energy_buildings", "Công trình / nhà", "Khách hàng và công trình", "domain", "full", ["GIS", "REPORT"]),
    resource("energy_solar_resource_zones", "Vùng bức xạ mặt trời", "Tiềm năng mặt trời", "domain", "full", ["GIS", "AI"]),
    resource("energy_roof_surfaces", "Bề mặt mái", "Tiềm năng mặt trời", "domain", "full", ["GIS", "AI"]),
    resource("energy_rooftop_systems", "Hệ điện mặt trời mái nhà", "Hệ thống điện mặt trời", "domain", "workflow", ["KPI", "GIS", "CHART", "REPORT"]),
    resource("energy_rooftop_system_components", "Thiết bị hệ mái nhà", "Hệ thống điện mặt trời", "domain", "full", ["REPORT"]),
    resource("energy_rooftop_generation_monthly", "Sản lượng điện theo tháng", "Hệ thống điện mặt trời", "domain", "append", ["CHART", "AI"]),
    resource("energy_rooftop_system_documents", "Hồ sơ hệ mái nhà", "Hệ thống điện mặt trời", "domain", "full", ["REPORT", "GOVERNANCE"]),
    resource("energy_customer_grid_service_links", "Liên kết khách hàng – lưới", "Đấu nối", "domain", "full", ["GIS", "AI"]),
    resource("energy_solar_assessments", "Đánh giá tiềm năng", "Tư vấn và thiết kế", "domain", "review", ["CHART", "AI", "REPORT"]),
    resource("energy_solar_designs", "Phương án thiết kế 3D", "Tư vấn và thiết kế", "domain", "full", ["AI", "REPORT"]),
    resource("energy_solar_design_versions", "Phiên bản thiết kế 3D", "Tư vấn và thiết kế", "domain", "append", ["AI", "REPORT"]),
    resource("energy_solar_consultations", "Lịch sử tư vấn công dân", "Tư vấn và thiết kế", "domain", "review", ["AI", "REPORT"]),
  ],
  4: [
    resource("energy_consumers", "Cơ sở sử dụng năng lượng", "Hồ sơ cơ sở", "domain", "workflow", ["KPI", "GIS", "CHART", "REPORT"]),
    resource("energy_consumer_classification_history", "Lịch sử phân loại cơ sở", "Hồ sơ cơ sở", "domain", "append", ["GOVERNANCE", "REPORT"]),
    resource("energy_smart_meters", "Công tơ thông minh", "Đo đếm", "domain", "full", ["KPI", "CHART"]),
    resource("energy_meter_events", "Sự kiện công tơ", "Đo đếm", "domain", "append", ["REPORT", "AI"]),
    resource("energy_consumer_reports", "Báo cáo năng lượng", "Báo cáo và đối soát", "domain", "full", ["CHART", "REPORT"]),
    resource("energy_consumer_report_lines", "Dòng chỉ tiêu báo cáo", "Báo cáo và đối soát", "domain", "full", ["CHART", "REPORT"]),
    resource("energy_reconciliation_rule_sets", "Bộ quy tắc đối soát", "Báo cáo và đối soát", "domain", "full", ["GOVERNANCE"]),
    resource("energy_reconciliation_rules", "Quy tắc đối soát", "Báo cáo và đối soát", "domain", "full", ["GOVERNANCE"]),
    resource("energy_reconciliation_runs", "Lần chạy đối soát", "Báo cáo và đối soát", "domain", "review", ["AI", "REPORT"]),
    resource("energy_efficiency_baselines", "Đường cơ sở năng lượng", "Hiệu quả năng lượng", "domain", "full", ["CHART", "AI"]),
    resource("energy_consumer_activity_metrics", "Chỉ số hoạt động cơ sở", "Hiệu quả năng lượng", "domain", "full", ["CHART", "AI"]),
    resource("energy_efficiency_benchmarks", "Định mức so sánh", "Hiệu quả năng lượng", "domain", "full", ["CHART", "AI"]),
    resource("energy_saving_measures", "Giải pháp tiết kiệm", "Hiệu quả năng lượng", "domain", "full", ["KPI", "CHART", "REPORT"]),
  ],
  5: [
    resource("energy_safety_legal_documents", "Văn bản pháp lý an toàn", "Pháp lý và quy tắc", "domain", "full", ["GOVERNANCE", "REPORT"]),
    resource("energy_safety_regulations", "Quy định an toàn", "Pháp lý và quy tắc", "domain", "full", ["GOVERNANCE", "REPORT"]),
    resource("energy_safety_regulation_documents", "Liên kết quy định – văn bản", "Pháp lý và quy tắc", "domain", "full", ["GOVERNANCE"]),
    resource("energy_clearance_rules", "Quy tắc khoảng cách", "Pháp lý và quy tắc", "domain", "full", ["GIS", "AI", "GOVERNANCE"]),
    resource("energy_protection_corridors", "Hành lang bảo vệ", "Hành lang lưới", "domain", "full", ["GIS", "KPI", "REPORT"]),
    resource("energy_protection_corridor_versions", "Phiên bản hành lang", "Hành lang lưới", "domain", "append", ["GIS", "GOVERNANCE"]),
    resource("energy_corridor_violations", "Vi phạm hành lang", "Kiểm tra và vi phạm", "domain", "full", ["KPI", "GIS", "CHART", "AI"]),
    resource("energy_safety_inspections", "Đợt kiểm tra an toàn", "Kiểm tra và vi phạm", "domain", "full", ["KPI", "REPORT"]),
    resource("energy_safety_inspection_media", "Ảnh / video kiểm tra", "Kiểm tra và vi phạm", "domain", "full", ["GIS", "AI", "REPORT"]),
    resource("energy_ai_vision_runs", "Lần phân tích ảnh AI", "AI an toàn điện", "domain", "review", ["AI", "REPORT"]),
    resource("energy_ai_vision_detections", "Phát hiện ảnh AI", "AI an toàn điện", "domain", "review", ["AI", "GIS"]),
    resource("energy_ai_vision_reviews", "Duyệt phát hiện AI", "AI an toàn điện", "domain", "append", ["AI", "GOVERNANCE"]),
    resource("energy_safety_inspection_violations", "Liên kết kiểm tra – vi phạm", "Kiểm tra và vi phạm", "domain", "full", ["GOVERNANCE"]),
    resource("energy_violation_assignments", "Phân công xử lý vi phạm", "Xử lý vi phạm", "domain", "full", ["REPORT"]),
    resource("energy_violation_actions", "Biện pháp xử lý vi phạm", "Xử lý vi phạm", "domain", "full", ["REPORT"]),
    resource("energy_violation_status_history", "Lịch sử trạng thái vi phạm", "Xử lý vi phạm", "domain", "append", ["GOVERNANCE", "REPORT"]),
    resource("energy_outage_plans", "Kế hoạch cắt điện", "Cắt điện và sự cố", "domain", "full", ["KPI", "GIS", "REPORT"]),
    resource("energy_outage_source_records", "Bản ghi nguồn cắt điện", "Cắt điện và sự cố", "domain", "review", ["GOVERNANCE"]),
    resource("energy_outage_affected_assets", "Tài sản bị ảnh hưởng", "Cắt điện và sự cố", "domain", "full", ["GIS", "REPORT"]),
    resource("energy_outage_affected_areas", "Địa bàn bị ảnh hưởng", "Cắt điện và sự cố", "domain", "full", ["GIS", "REPORT"]),
    resource("energy_outage_affected_customers", "Khách hàng bị ảnh hưởng", "Cắt điện và sự cố", "domain", "full", ["KPI", "REPORT"]),
    resource("energy_construction_cases", "Hồ sơ công trình gần lưới", "Công trình và cấp phép", "domain", "full", ["GIS", "REPORT"]),
    resource("energy_construction_case_documents", "Tài liệu hồ sơ công trình", "Công trình và cấp phép", "domain", "full", ["GOVERNANCE"]),
    resource("energy_construction_case_reviews", "Ý kiến thẩm định công trình", "Công trình và cấp phép", "domain", "append", ["GOVERNANCE", "REPORT"]),
    resource("energy_construction_case_status_history", "Lịch sử hồ sơ công trình", "Công trình và cấp phép", "domain", "append", ["GOVERNANCE"]),
    resource("energy_construction_clearance_checks", "Kiểm tra khoảng cách công trình", "Công trình và cấp phép", "domain", "review", ["GIS", "AI", "REPORT"]),
    resource("energy_grid_incidents", "Sự cố lưới điện", "Cắt điện và sự cố", "domain", "workflow", ["KPI", "GIS", "CHART", "REPORT"]),
  ],
  6: [
    resource("energy_energy_types", "Loại năng lượng", "Danh mục kiểm kê", "domain", "full", ["GOVERNANCE", "REPORT"]),
    resource("energy_emission_sources", "Nguồn phát thải", "Kiểm kê phát thải", "domain", "workflow", ["KPI", "GIS", "CHART", "REPORT"]),
    resource("energy_vbdh_sync_runs", "Lần đồng bộ VBĐH", "Tích hợp VBĐH", "domain", "review", ["GOVERNANCE"]),
    resource("energy_vbdh_records", "Bản ghi VBĐH", "Tích hợp VBĐH", "domain", "review", ["GOVERNANCE", "REPORT"]),
    resource("energy_vbdh_field_mappings", "Ánh xạ trường VBĐH", "Tích hợp VBĐH", "domain", "full", ["GOVERNANCE"]),
    resource("energy_emission_factors", "Hệ số phát thải", "Danh mục kiểm kê", "domain", "full", ["CHART", "AI", "GOVERNANCE"]),
    resource("energy_emission_activities", "Hoạt động phát thải", "Kiểm kê phát thải", "domain", "full", ["KPI", "CHART", "AI"]),
    resource("energy_emission_measurements", "Phép đo phát thải", "Kiểm kê phát thải", "domain", "append", ["CHART", "AI"]),
    resource("energy_unit_definitions", "Đơn vị đo", "Danh mục kiểm kê", "domain", "full", ["GOVERNANCE"]),
    resource("energy_unit_conversions", "Quy đổi đơn vị", "Danh mục kiểm kê", "domain", "full", ["GOVERNANCE", "AI"]),
    resource("energy_emission_calculation_runs", "Lần tính phát thải", "Tính toán phát thải", "domain", "review", ["KPI", "AI", "REPORT"]),
    resource("energy_reduction_plans", "Kế hoạch giảm phát thải", "Giảm phát thải", "domain", "full", ["CHART", "REPORT"]),
    resource("energy_reduction_progress", "Tiến độ kế hoạch", "Giảm phát thải", "domain", "append", ["KPI", "CHART"]),
    resource("energy_reduction_plan_targets", "Mục tiêu giảm phát thải", "Giảm phát thải", "domain", "full", ["CHART", "REPORT"]),
    resource("energy_reduction_actions", "Hành động giảm phát thải", "Giảm phát thải", "domain", "full", ["CHART", "REPORT"]),
    resource("energy_reduction_action_progress", "Tiến độ hành động", "Giảm phát thải", "domain", "append", ["KPI", "CHART"]),
    resource("energy_carbon_projects", "Dự án tín chỉ carbon", "Tín chỉ carbon", "domain", "full", ["KPI", "REPORT"]),
    resource("energy_carbon_credit_batches", "Lô tín chỉ carbon", "Tín chỉ carbon", "domain", "full", ["KPI", "REPORT"]),
    resource("energy_carbon_credit_transactions", "Giao dịch tín chỉ", "Tín chỉ carbon", "domain", "append", ["CHART", "REPORT"]),
    resource("energy_carbon_credits", "Sổ dư tín chỉ carbon", "Tín chỉ carbon", "domain", "review", ["KPI", "REPORT"]),
    resource("energy_reporting_obligations", "Nghĩa vụ báo cáo", "Báo cáo phát thải", "domain", "full", ["KPI", "REPORT"]),
    resource("energy_carbon_report_submissions", "Hồ sơ nộp báo cáo", "Báo cáo phát thải", "domain", "review", ["REPORT", "GOVERNANCE"]),
  ],
  7: [
    resource("energy_ev_station_applications", "Hồ sơ đăng ký trạm sạc", "Hồ sơ đầu tư", "domain", "full", ["KPI", "GIS", "REPORT"]),
    resource("energy_ev_application_history", "Lịch sử hồ sơ đăng ký", "Hồ sơ đầu tư", "domain", "append", ["GOVERNANCE", "REPORT"]),
    resource("energy_ev_application_documents", "Tài liệu hồ sơ trạm sạc", "Hồ sơ đầu tư", "domain", "full", ["GOVERNANCE"]),
    resource("energy_ev_stations", "Trạm sạc xe điện", "Vận hành trạm sạc", "domain", "workflow", ["KPI", "GIS", "CHART", "REPORT"]),
    resource("energy_ev_grid_assessments", "Đánh giá đấu nối lưới", "Hồ sơ đầu tư", "domain", "review", ["GIS", "AI", "REPORT"]),
    resource("energy_ev_application_reviews", "Thẩm định hồ sơ trạm sạc", "Hồ sơ đầu tư", "domain", "append", ["GOVERNANCE", "REPORT"]),
    resource("energy_ev_station_snapshots", "Snapshot vận hành trạm", "Vận hành trạm sạc", "domain", "append", ["KPI", "CHART", "AI"]),
    resource("energy_ev_connectors", "Đầu sạc", "Vận hành trạm sạc", "domain", "full", ["KPI", "REPORT"]),
    resource("energy_ev_sessions", "Phiên sạc", "Vận hành trạm sạc", "domain", "full", ["CHART", "AI", "REPORT"]),
  ],
  8: [
    resource("energy_oil_facilities", "Cơ sở dầu khí", "Danh mục cơ sở", "domain", "full", ["KPI", "GIS", "CHART", "REPORT"]),
    resource("energy_oil_pipelines", "Đường ống xăng dầu", "Hạ tầng vận chuyển", "domain", "full", ["KPI", "GIS", "REPORT"]),
    resource("energy_oil_facility_snapshots", "Snapshot sản lượng dầu khí", "Vận hành dầu khí", "domain", "append", ["KPI", "CHART", "AI"]),
    resource("energy_oil_alerts", "Sự cố và cảnh báo dầu khí", "An toàn vận hành", "domain", "full", ["KPI", "GIS", "REPORT", "AI"]),
  ],
};

export function getMissionDataResources(taskId: number, scope?: MissionDataScope) {
  const resources = [
    ...(MISSION_DATA_RESOURCES[taskId] ?? []),
    ...SHARED_MISSION_DATA_RESOURCES,
    ...AI_MISSION_DATA_RESOURCES,
  ];
  return scope ? resources.filter((item) => item.scope === scope) : resources;
}

export function findMissionDataResource(taskId: number, table: string) {
  return getMissionDataResources(taskId).find((item) => item.table === table);
}

export const MISSION_DATA_TABLE_COUNT = new Set([
  ...Object.values(MISSION_DATA_RESOURCES).flat(),
  ...SHARED_MISSION_DATA_RESOURCES,
  ...AI_MISSION_DATA_RESOURCES,
].map((item) => item.table)).size;
