// ============================================================
// PHÂN HỆ ĐIỀU TRA & NĂNG LƯỢNG — Data model
// Thiết kế linh hoạt để map 1-1 với REST API backend sau này.
// Các trường bắt buộc tối thiểu; trường kỹ thuật chi tiết là optional.
// ============================================================

export type EnergyDataSource = "mock" | "api";

// ─────────────────────────── Trạm biến áp ───────────────────────────
export type VoltageLevel = "500kV" | "220kV" | "110kV" | "22kV";

export interface Substation {
  id: string;
  code: string;
  name: string;
  type: string;
  voltageLevel: VoltageLevel;
  district: string;
  address: string;
  latitude?: number;
  longitude?: number;
  operator: string;
  designCapacity?: number; // MVA
  operatingCapacity?: number; // MVA
  availableCapacity?: number; // MVA — khả năng mang tải
  loadFactor?: number; // hệ số tải (%)
  transformerCount?: number;
  transformerType?: string;
  yearCommissioned?: number;
  status: string;
  supplyArea: string;
  planned?: {
    location: string;
    investor: string;
    progress: string;
    year?: number;
  };
}

// ─────────────────────────── Lưới điện ───────────────────────────
export interface PowerLine {
  id: string;
  code: string;
  name: string;
  voltageLevel: VoltageLevel;
  operator: string;
  fromPoint: string;
  toPoint: string;
  lengthKm: number;
  districts: string[];
  status: string;
  capacityMw?: number;
  actualLoadMw?: number;
  lossPct?: number;
  incidents?: number;
  routeSource?: string;
  routeConfidencePct?: number;
  // Tuyến đường dây: toạ độ [lat, lng] để vẽ Polyline
  route?: [number, number][];
}

export interface PowerPole {
  id: string;
  code: string;
  number: string;
  lineCode: string;
  type: "Trụ thép" | "Trụ bê tông" | "Trụ néo" | "Trụ đỡ";
  height: number; // m
  yearBuilt: number;
  foundationStatus: string;
  technicalStatus: string;
  safetyCorridor: string;
  latitude?: number;
  longitude?: number;
}

// ─────────────────────────── Dự án nguồn điện ───────────────────────────
export type PowerProjectType =
  "Điện mặt trời" | "Điện gió" | "Sinh khối" | "Thủy điện" | "Điện rác" | "LNG";

export type PowerProjectStatus =
  "Đang vận hành" | "Đang đầu tư" | "Đang quy hoạch" | "Hoàn thành" | "Tạm dừng";

export interface PowerProject {
  id: string;
  code: string;
  name: string;
  type: PowerProjectType;
  investor: string;
  operator: string;
  address: string;
  district: string;
  latitude?: number;
  longitude?: number;
  status: PowerProjectStatus;
  designCapacityMw?: number;
  actualOutputMw?: number;
  outputGWh?: number;
  efficiencyPct?: number;
  availabilityPct?: number;
  technology?: string;
  unitCount?: number;
  gridVoltage?: string;
  substationCode?: string;
  lineCode?: string;
  planned?: {
    location: string;
    capacityMw: number;
    landHa: number;
    totalInvestment: string;
    interestedInvestor: string;
    year?: number;
    gridConnection: string;
  };
}

// ─────────────────────────── Điện mặt trời mái nhà ───────────────────────────
export type SolarCustomerType =
  | "Hộ gia đình"
  | "Doanh nghiệp"
  | "Cơ quan nhà nước"
  | "Nhà máy"
  | "KCN/CCN"
  | "Trang trại"
  | "Khác";

export interface RooftopSolar {
  id: string;
  code: string;
  owner: string;
  customerType: SolarCustomerType;
  address: string;
  district: string;
  latitude?: number;
  longitude?: number;
  operator: string;
  status: string;
  installedCapacityKw?: number;
  panelCount?: number;
  panelType?: string;
  panelEfficiencyPct?: number;
  inverter?: string;
  inverterCapacityKw?: number;
  storageKwh?: number;
  commissionDate?: string;
  connection: {
    point: string;
    substationCode: string;
    lineCode: string;
    gridCapacityKw: number;
    hostingCapacityKw: number;
    overload: string;
  };
  operation?: {
    outputKw: number;
    productionKwh: number;
    selfConsumptionKwh: number;
    exportKwh: number;
    efficiencyPct: number;
    inverterStatus: string;
    panelStatus: string;
  };
}

// ─────────────────────────── Tiêu thụ năng lượng ───────────────────────────
export type ConsumerGroup =
  "Sinh hoạt" | "Công nghiệp" | "Thương mại dịch vụ" | "Nông nghiệp" | "Cơ quan nhà nước";

export interface EnergyConsumer {
  id: string;
  code: string;
  name: string;
  group: ConsumerGroup;
  address: string;
  district: string;
  latitude?: number;
  longitude?: number;
  operator: string;
  meterType: string;
  consumption: {
    hourly: number;
    daily: number;
    monthly: number;
    annual: number;
    energyKwh: number;
    maxDemandKw: number;
    loadFactor: number;
    peakHours: number;
    offPeakHours: number;
    growthPct: number;
  };
}

export interface SmartMeter {
  id: string;
  code: string;
  consumerCode: string;
  address: string;
  district: string;
  latitude?: number;
  longitude?: number;
  status: string;
  installedAt: string;
}

export interface KeyEnergyConsumer {
  id: string;
  code: string;
  name: string;
  type:
    "Doanh nghiệp tiêu thụ lớn" | "Nhà máy" | "Trung tâm thương mại" | "Bệnh viện" | "Trường học";
  address: string;
  district: string;
  sector: string;
  latitude?: number;
  longitude?: number;
  consumptionKwh: number;
  maxDemandKw: number;
  specificConsumption: number;
  efficiencyPct: number;
  savingAssessment: string;
}

// ─────────────────────────── An toàn & Sự cố ───────────────────────────
export type IncidentSeverity = "severe" | "high" | "medium" | "resolved";

export interface GridIncident {
  id: string;
  code: string;
  time: string;
  source: string;
  type: string;
  severity: IncidentSeverity;
  location: string;
  lineCode: string;
  substationCode: string;
  affectedArea: string;
  customersAffected?: number;
  lostLoadMw?: number;
  outageDuration?: string;
  criticalInfra?: string;
  handler: string;
  responseTime?: string;
  progress?: string;
  recoveryTime?: string;
  latitude?: number;
  longitude?: number;
}

export interface GridSafetyViolation {
  id: string;
  code: string;
  lineCode: string;
  location: string;
  violationType: string;
  dangerLevel: string;
  distanceToLine: string;
  owner: string;
  detectedAt: string;
  status: string;
  latitude?: number;
  longitude?: number;
}

// ─────────────────────────── Phát thải Carbon ───────────────────────────
export interface EmissionSource {
  id: string;
  code: string;
  unit: string;
  sourceType: string;
  investor: string;
  address: string;
  district: string;
  latitude?: number;
  longitude?: number;
  status: string;
  capacityMw?: number;
  outputGWh?: number;
  fuel?: string;
  consumption?: string;
  co2: number; // tấn
  co2e: number; // tấn CO2e
  nox?: number;
  sox?: number;
  intensity: number; // gCO2e/kWh
}

export interface CarbonCredit {
  id: string;
  code: string;
  project: string;
  certification: string;
  volume: number; // tấn CO2e
  value: string;
  status: string;
}

// ─────────────────────────── Trạm sạc điện ───────────────────────────
export type ChargingStationType =
  "Công cộng" | "Trung tâm thương mại" | "Bãi đỗ xe" | "Doanh nghiệp" | "Chung cư";

export interface ChargingStation {
  id: string;
  code: string;
  name: string;
  address: string;
  district: string;
  latitude?: number;
  longitude?: number;
  operator: string;
  investor: string;
  type: ChargingStationType;
  powerKw: number;
  ports: {
    ccs2: number;
    chademo: number;
    acType2: number;
    fast: number;
    slow: number;
  };
  voltage: string;
  substationCode: string;
  supplyCapacityKw: number;
  freePorts: number;
  status: string;
}

// ─────────────────── Trạm sạc — nhu cầu sạc & AI (Nhiệm vụ 7) ───────────────────
export type ChargingForecastHorizon = "7 ngày" | "1 tháng" | "Quý" | "1 năm";

/** Dữ liệu nhu cầu sạc theo huyện, từng kỳ (12 kỳ T1..T12 trong năm). */
export interface ChargingDemandRecord {
  district: string;
  period: string;
  energyKwh: number;
  sessions: number;
}

/** Kết quả dự báo nhu cầu sạc điện cho một huyện (AI, demo deterministic). */
export interface ChargingDemandForecast {
  district: string;
  horizon: ChargingForecastHorizon;
  unit: string;
  /** Công suất lắp đặt trạm sạc hiện có của huyện (kW). */
  installedCapacityKw: number;
  /** Ngưỡng cảnh báo theo kỳ (kWh) = năng lượng tối đa các trạm có thể đáp ứng. */
  thresholdKwh: number;
  lastActualKwh: number;
  peakForecastKwh: number;
  growthPerYearPct: number;
  risk: "Thấp" | "Trung bình" | "Cao";
  points: {
    period: string;
    actual?: number;
    base?: number;
    min?: number;
    max?: number;
    threshold?: number;
  }[];
  scenarios: { key: "low" | "base" | "high"; label: string; value: number }[];
  method: string;
  confidencePct: number;
  note: string;
}

export type ChargingSuggestionKind = "new" | "expand";

/** Đề xuất vị trí trạm sạc mới từ AI (luồng phê duyệt Nháp→Trình→Duyệt). */
export interface ChargingStationSuggestion {
  id: string;
  kind: ChargingSuggestionKind;
  title: string;
  district: string;
  latitude: number;
  longitude: number;
  demandKw: number;
  score: number;
  reasons: string[];
  workflowStatus: "DRAFT" | "PENDING" | "APPROVED" | "RETURNED";
  createdAt: string;
  nearStation?: string;
}

/** Phân tích vị trí đặt trạm sạc mới: trạm gần nhất + dư địa + độ phủ. */
export interface ChargingLocationAnalysis {
  lat: number;
  lng: number;
  demandKw: number;
  nearStation: ChargingStation | null;
  distanceKm: number | null;
  spareKw: number;
  canSupply: boolean;
  coveragePct: number;
  recommendation: string;
}

// ─────────────────────────── Tổng quan ───────────────────────────
export interface EnergyOverview {
  kpis: {
    projects: number;
    projectOperating: number;
    projectInvesting: number;
    projectPlanning: number;
    totalCapacityMw: number;
    electricityOutputGwh: number;
    substations: number;
    overloadedSubstations: number;
    overloadedLines: number;
    gridLengthKm: number;
    rooftopSolarMw: number;
    keyConsumers: number;
    incidentsActive: number;
    co2eKilotons: number;
    co2eTons: number;
    chargingStations: number;
    renewableRatioPct: number;
  };
  sourceMix: { name: string; value: number; capacityMw: number }[];
  capacityByType: { name: string; value: number }[];
  outputByMonth: { month: string; value: number }[];
  outputComparison: { month: string; previous: number; current: number }[];
  outputByQuarter: { month: string; previous: number; current: number }[];
  outputByYear: { month: string; previous: number; current: number }[];
  consumptionBySector: { sector: string; value: number }[];
  consumptionTrend: { month: string; value: number; peak: number }[];
  projectStatus: { name: string; value: number }[];
  incidentBreakdown: { severity: IncidentSeverity; label: string; value: number }[];
  alerts: { severity: IncidentSeverity; count: number; label: string }[];
  /** Mức tải bình quân và số snapshot rủi ro được tổng hợp trực tiếp theo kỳ. */
  operationalTrend: { period: string; averageLoadPct: number; riskCount: number }[];
  dataFreshness: {
    latestPeriod: string;
    observations: number;
    activeAlerts: number;
    mappedLocations: number;
  };
  /** Độ phủ các bảng quan sát nghiệp vụ trong cơ sở dữ liệu hiện hành. */
  monitoringIndicators: { label: string; value: string; detail?: string }[];
  /** @deprecated Chỉ còn giữ để tương thích các màn hình mock cũ. */
  reliabilityTrend?: { year: string; saifi: number; saidi: number }[];
  /** @deprecated Chỉ còn giữ để tương thích các màn hình mock cũ. */
  reliabilityTarget?: { period: string; saifi: number; saidi: number };
  /** @deprecated Chỉ còn giữ để tương thích các màn hình mock cũ. */
  automationIndicators?: { label: string; value: string; detail?: string }[];
}

export interface EnergyDashboardBundle {
  overview: EnergyOverview;
  gis: EnergyGisData;
  substations: Substation[];
  projects: PowerProject[];
  incidents: GridIncident[];
  generatedAt: string;
  source: "postgresql-postgis";
}

// ─────────────────────────── GIS ───────────────────────────
export interface EnergyGisData {
  substations: Substation[];
  lines: PowerLine[];
  poles: PowerPole[];
  projects: PowerProject[];
  rooftopSolar: RooftopSolar[];
  incidents: GridIncident[];
  emissionSources: EmissionSource[];
  chargingStations: ChargingStation[];
  keyConsumers: KeyEnergyConsumer[];
}

// ─────────────────────────── Phân quyền ───────────────────────────
export const ENERGY_PERMISSIONS = {
  VIEW_ENERGY: "VIEW_ENERGY",
  EDIT_ENERGY: "EDIT_ENERGY",
  MANAGE_ENERGY: "MANAGE_ENERGY",
  VIEW_ENERGY_GIS: "VIEW_ENERGY_GIS",
  VIEW_ENERGY_REPORT: "VIEW_ENERGY_REPORT",
  EXPORT_ENERGY: "EXPORT_ENERGY",
} as const;

export type EnergyPermission = keyof typeof ENERGY_PERMISSIONS;
