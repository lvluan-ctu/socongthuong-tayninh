export type MissionAiScenario = 'baseline' | 'growth' | 'efficiency';

export type MissionAiConfig = {
  taskId: number;
  missionCode: string;
  title: string;
  description: string;
  metricTitle: string;
  unit: string;
  entityType: string;
  queryTypes: Array<{ value: string; label: string; prompt: string }>;
};

export type MissionAiForecastPoint = {
  period: string;
  actual: number | null;
  forecast: number | null;
  min: number | null;
  max: number | null;
};

export type MissionAiAlert = {
  title: string;
  severity: 'danger' | 'warning' | 'info';
  message: string;
  recommendation: string;
  metric: string;
};

export type MissionAiResult = {
  requestId: string;
  generatedAt: string;
  dataCutoff: string;
  mode: 'MOCK' | 'EXTERNAL';
  model: { name: string; version: string };
  horizon: number;
  confidence: number;
  metricTitle: string;
  unit: string;
  summary: {
    headline: string;
    currentValue: number;
    forecastValue: number;
    changePct: number;
    riskCount: number;
    report: string;
  };
  series: MissionAiForecastPoint[];
  alerts: MissionAiAlert[];
  recommendations: string[];
  provenance: {
    sourceRecords: number;
    inferredRecords: number;
    observations: number;
    notes: string[];
  };
};

export type MissionAiHistoryItem = {
  id: string;
  missionCode: string;
  status: string;
  requestId: string;
  modelName: string | null;
  modelVersion: string | null;
  latencyMs: number | null;
  isMock: boolean;
  createdAt: string;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  inputSnapshot: Record<string, unknown> | null;
};

const query = (value: string, label: string, prompt: string) => ({ value, label, prompt });

export const MISSION_AI_CONFIGS: Record<number, MissionAiConfig> = {
  1: {
    taskId: 1,
    missionCode: 'AI_01_GRID_FORECAST',
    title: 'AI dự báo phụ tải và quá tải lưới điện',
    description: 'Phân tích chuỗi vận hành trạm/đường dây, dự báo phụ tải và ưu tiên xử lý nguy cơ quá tải.',
    metricTitle: 'Phụ tải toàn lưới', unit: 'MW/MVA', entityType: 'grid_asset',
    queryTypes: [
      query('load_forecast', 'Dự báo phụ tải', 'Dự báo xu hướng phụ tải và khoảng tin cậy theo dữ liệu vận hành gần nhất.'),
      query('overload_risk', 'Nguy cơ quá tải', 'Xếp hạng nguy cơ quá tải trạm và đường dây, kèm thời điểm cần can thiệp.'),
      query('renewable_absorption', 'Khả năng hấp thụ NLTT', 'Đánh giá dư địa hấp thụ nguồn tái tạo và các điểm nghẽn trên lưới.'),
    ],
  },
  2: {
    taskId: 2,
    missionCode: 'AI_02_RENEWABLE_GENERATION',
    title: 'AI dự báo nguồn năng lượng tái tạo',
    description: 'Dự báo sản lượng, độ khả dụng và rủi ro vận hành của các dự án nguồn điện tái tạo.',
    metricTitle: 'Sản lượng nguồn điện', unit: 'MWh', entityType: 'generation_project',
    queryTypes: [
      query('generation_forecast', 'Dự báo sản lượng', 'Dự báo sản lượng nguồn điện theo chuỗi vận hành và khoảng tin cậy.'),
      query('same_period_forecast', 'Dự báo sản lượng cùng kỳ', 'So sánh sản lượng cùng kỳ trước với kỳ hiện tại, có điều chỉnh theo thời tiết.'),
      query('demand_forecast', 'Dự báo nhu cầu điện', 'Dự báo nhu cầu điện của khách hàng và giải thích theo chỉ số hoạt động sản xuất.'),
      query('supply_alert', 'Cảnh báo cấp điện', 'So sánh nhu cầu điện dự báo với khả năng cung cấp và đề xuất phương án xử lý thiếu công suất.'),
      query('availability_risk', 'Rủi ro khả dụng', 'Phân tích suy giảm độ khả dụng và dự án cần ưu tiên bảo trì.'),
      query('development_scenario', 'Kịch bản phát triển', 'Mô phỏng tác động của kịch bản tăng trưởng nguồn tái tạo.'),
    ],
  },
  3: {
    taskId: 3,
    missionCode: 'AI_03_ROOFTOP_SOLAR',
    title: 'AI dự báo điện mặt trời mái nhà',
    description: 'Dự báo sản lượng, phát hiện hệ thống kém hiệu quả và gợi ý công suất phù hợp.',
    metricTitle: 'Sản lượng điện mái nhà', unit: 'kWh', entityType: 'rooftop_system',
    queryTypes: [
      query('solar_yield', 'Dự báo sản lượng', 'Dự báo sản lượng điện mặt trời mái nhà theo dữ liệu các kỳ gần nhất.'),
      query('underperformance', 'Phát hiện suy giảm', 'Phát hiện hệ thống có suất điện thấp và giải thích nguyên nhân có thể.'),
      query('capacity_recommendation', 'Gợi ý công suất', 'Đề xuất kịch bản công suất và ưu tiên khảo sát theo khu vực.'),
    ],
  },
  4: {
    taskId: 4,
    missionCode: 'AI_04_ENERGY_EFFICIENCY',
    title: 'AI dự báo sử dụng năng lượng hiệu quả',
    description: 'Dự báo tiêu thụ, ước tính tiềm năng tiết kiệm và cảnh báo nghĩa vụ báo cáo.',
    metricTitle: 'Điện năng tiêu thụ', unit: 'kWh', entityType: 'energy_consumer',
    queryTypes: [
      query('consumption_forecast', 'Dự báo tiêu thụ', 'Dự báo điện năng tiêu thụ và nhận diện biến động bất thường.'),
      query('saving_potential', 'Tiềm năng tiết kiệm', 'Ước tính tiềm năng tiết kiệm và xếp hạng nhóm giải pháp ưu tiên.'),
      query('reporting_compliance', 'Tuân thủ báo cáo', 'Phân tích rủi ro chậm hoặc thiếu báo cáo của cơ sở trọng điểm.'),
    ],
  },
  5: {
    taskId: 5,
    missionCode: 'AI_05_GRID_SAFETY',
    title: 'AI dự báo rủi ro an toàn điện',
    description: 'Dự báo nguy cơ hành lang, sự cố và ưu tiên lịch kiểm tra hiện trường theo mức độ rủi ro.',
    metricTitle: 'Phát hiện mất an toàn', unit: 'vụ việc', entityType: 'safety_case',
    queryTypes: [
      query('corridor_risk', 'Rủi ro hành lang', 'Dự báo xu hướng vi phạm hành lang và khu vực cần kiểm tra sớm.'),
      query('incident_risk', 'Nguy cơ sự cố', 'Đánh giá nguy cơ sự cố từ lịch sử vi phạm, kiểm tra và cắt điện.'),
      query('inspection_priority', 'Ưu tiên kiểm tra', 'Xếp hạng hồ sơ cần kiểm tra hiện trường và đề xuất thời hạn xử lý.'),
    ],
  },
  6: {
    taskId: 6,
    missionCode: 'AI_06_GHG_EMISSIONS',
    title: 'AI dự báo phát thải khí nhà kính',
    description: 'Dự báo phát thải, mô phỏng mục tiêu giảm phát thải và hỗ trợ lập báo cáo kiểm kê.',
    metricTitle: 'Phát thải khí nhà kính', unit: 'tCO₂e', entityType: 'emission_source',
    queryTypes: [
      query('emission_forecast', 'Dự báo phát thải', 'Dự báo phát thải theo phạm vi và chuỗi hoạt động gần nhất.'),
      query('reduction_scenario', 'Kịch bản giảm phát thải', 'Mô phỏng kịch bản giảm phát thải và mức đóng góp cần thiết.'),
      query('inventory_quality', 'Chất lượng kiểm kê', 'Đánh giá độ đầy đủ, nguồn gốc và rủi ro của dữ liệu kiểm kê.'),
    ],
  },
  7: {
    taskId: 7,
    missionCode: 'AI_07_EV_CHARGING_DEMAND',
    title: 'AI dự báo nhu cầu sạc xe điện',
    description: 'Dự báo điện năng, mức sử dụng đầu sạc và khu vực cần mở rộng công suất.',
    metricTitle: 'Điện năng cấp qua trạm sạc', unit: 'kWh', entityType: 'ev_charging_area',
    queryTypes: [
      query('charging_demand', 'Dự báo nhu cầu sạc', 'Dự báo điện năng và công suất trạm sạc trong các kỳ tiếp theo.'),
      query('utilization_risk', 'Nguy cơ quá tải trạm', 'Phân tích mức sử dụng, đầu sạc lỗi và nguy cơ thiếu công suất.'),
      query('expansion_priority', 'Ưu tiên mở rộng', 'Xếp hạng khu vực cần bổ sung trạm, đầu sạc hoặc công suất đấu nối.'),
    ],
  },
  8: {
    taskId: 8,
    missionCode: 'AI_08_OIL_INFRASTRUCTURE',
    title: 'AI dự báo phụ tải hạ tầng dầu khí',
    description: 'Dự báo sản lượng qua cơ sở dầu khí, nhận diện rủi ro thiếu công suất và ưu tiên bảo trì.',
    metricTitle: 'Sản lượng qua cơ sở dầu khí', unit: 'lít', entityType: 'oil_facility',
    queryTypes: [
      query('throughput_forecast', 'Dự báo sản lượng', 'Dự báo sản lượng qua trạm, kho và tuyến ống theo các kỳ tiếp theo.'),
      query('capacity_risk', 'Rủi ro năng lực', 'Phân tích nguy cơ thiếu năng lực chứa, bơm xuất hoặc vận chuyển dầu khí.'),
      query('maintenance_priority', 'Ưu tiên bảo trì', 'Xếp hạng cơ sở và tuyến ống cần kiểm tra, bảo trì hoặc nâng cấp.'),
    ],
  },
};

export function getMissionAiConfig(taskId: number) {
  return MISSION_AI_CONFIGS[taskId] ?? null;
}
