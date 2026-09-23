// ============================================================
// NHIỆM VỤ 1 — CSDL ĐƯỜNG DÂY ĐẤU NỐI & TRẠM BIẾN ÁP
// Data model mở rộng (kế thừa từ energy-types, bổ sung trường
// kỹ thuật/vận hành/quy hoạch). Được thiết kế để map 1-1 với
// REST API backend sau này. UI KHÔNG hard-code ngưỡng cảnh báo:
// mọi ngưỡng lấy từ GRID_CONFIG (dữ liệu mock, thay được).
// ============================================================
import type { GridIncident, PowerLine, PowerPole, Substation } from "@/lib/energy-types";

// ─────────────────────────── Trạng thái ───────────────────────────
// Tách 2 khái niệm: trạng thái PHÊ DUYỆT (workflow) và trạng thái VẬN HÀNH.
export type WorkflowStatus = "DRAFT" | "PENDING" | "APPROVED" | "RETURNED";
export type OperationStatus = "OPERATING" | "MAINTENANCE" | "STOPPED" | "CONSTRUCTION" | "PLANNED";

export const WORKFLOW_STATUS_LABEL: Record<WorkflowStatus, string> = {
  DRAFT: "Nháp",
  PENDING: "Chờ phê duyệt",
  APPROVED: "Đã phê duyệt",
  RETURNED: "Trả về",
};

export const OPERATION_STATUS_LABEL: Record<OperationStatus, string> = {
  OPERATING: "Đang vận hành",
  MAINTENANCE: "Cắt điện bảo trì",
  STOPPED: "Ngừng vận hành",
  CONSTRUCTION: "Đang xây dựng",
  PLANNED: "Quy hoạch",
};

export function operationStatusTone(status: OperationStatus) {
  if (status === "OPERATING") return "bg-success/10 text-success";
  if (status === "MAINTENANCE") return "bg-warning/10 text-warning";
  if (status === "STOPPED") return "bg-destructive/10 text-destructive";
  return "bg-muted text-muted-foreground";
}

// ─────────────────────────── Giai đoạn quy hoạch ───────────────────────────
// Chuẩn hóa tình trạng dự án theo yêu cầu NV1 (chưa triển khai → hoàn thành).
export type PlanPhase =
  "not_started" | "drafting" | "investment_approved" | "constructing" | "completed";

export const PLAN_PHASE_LABEL: Record<PlanPhase, string> = {
  not_started: "Chưa triển khai",
  drafting: "Lập dự án",
  investment_approved: "Chủ trương đầu tư",
  constructing: "Thi công",
  completed: "Hoàn thành",
};

export function planPhaseTone(phase: PlanPhase) {
  if (phase === "completed") return "bg-success/10 text-success";
  if (phase === "constructing") return "bg-gov/10 text-gov";
  if (phase === "investment_approved") return "bg-teal/10 text-teal";
  if (phase === "drafting") return "bg-warning/10 text-warning";
  return "bg-muted text-muted-foreground";
}

// ─────────────────────────── Cấu hình ngưỡng ───────────────────────────
// Demo: ngưỡng nằm trong config chứ KHÔNG hard-code trong UI.
export const GRID_CONFIG = {
  thresholds: {
    substationLoadWarnPct: 90,
    substationLoadCriticalPct: 100,
    lineLoadWarnPct: 90,
    lineLossHighPct: 5,
  },
  forecast: {
    horizons: ["7 ngày", "1 tháng", "Quý", "1 năm"] as const,
    // Demo: lề % cho 3 kịch bản (Thấp / Cơ sở / Cao).
    scenarioMarginPct: 8,
  },
  absorption: {
    // Công thức EVN: P_tiếp nhận ≤ P_vh cho phép + P_phụ tải giờ cao điểm trưa − P_đã vận hành − P_chưa vận hành.
    peakWindow: "11–13 giờ",
    // Lề an toàn điện áp +5% (Thông tư 30/2019/TT-BCT).
    voltageMarginPct: 5,
  },
} as const;

export type ForecastHorizon = (typeof GRID_CONFIG.forecast.horizons)[number];

// ─────────────────────────── Trạm biến áp (mở rộng) ───────────────────────────
export interface TransformerUnit {
  no: string;
  type: string;
  capacityMva: number;
  voltageRatio: string;
  yearCommissioned?: number;
  loadFactorPct: number;
  status: string;
}

export interface ConnectionPoint {
  id: string;
  name: string;
  type: string;
  voltageLevel: string;
  hostSubstationId: string;
  latitude?: number;
  longitude?: number;
  status: string;
}

export interface GridSubstation extends Substation {
  workflowStatus?: WorkflowStatus;
  transformers?: TransformerUnit[];
  connectionPoints?: ConnectionPoint[];
  /** Bán kính cấp điện (km) — vẽ vòng tròn trên bản đồ. */
  supplyRadiusKm?: number;
  /** Trạng thái đóng/cắt (vận hành) — phân biệt với workflowStatus (phê duyệt). */
  switchingState?: OperationStatus;
  /** Lịch sử vận hành (đóng/cắt, bảo trì, sự cố). */
  operationLogs?: OperationLog[];
  /** Quy hoạch trạm (mở rộng giai đoạn chuẩn hóa PlanPhase). */
  planned?: Substation["planned"] & { phase?: PlanPhase };
}

// ─────────────────────────── Lưới điện (mở rộng) ───────────────────────────
export interface LineTechnical {
  conductorType: string;
  crossSectionMm2: string;
  strands?: string;
  insulation: string;
  groundingMethod: string;
  lineCount: number;
  avgHeightM: number;
}

export interface LineOperation {
  currentLoadA: number;
  voltageDeviationPct: number;
  hotSpot: string;
  lossPct: number;
  overloadCount: number;
  faultRatePerYear: number;
}

export interface LinePlanning {
  location: string;
  investor: string;
  progress: string;
  year?: number;
  investment?: string;
  corridorWidthM?: number;
  /** Giai đoạn quy hoạch chuẩn hóa. */
  phase?: PlanPhase;
}

export interface GridPowerLine extends PowerLine {
  workflowStatus?: WorkflowStatus;
  technical?: LineTechnical;
  operation?: LineOperation;
  planning?: LinePlanning;
  corridorStatus?: string;
  /** Trạng thái đóng/cắt (vận hành). */
  switchingState?: OperationStatus;
  /** Lịch sử vận hành (đóng/cắt, bảo trì, sự cố). */
  operationLogs?: OperationLog[];
  /** Sự cố tuyến (có tọa độ để vẽ trên bản đồ số). */
  incidentRecords?: GridIncident[];
  /** Trụ điện dự kiến theo quy hoạch tuyến. */
  planningPoles?: GridPowerPole[];
}

// ─────────────────────────── Trụ điện (mở rộng) ───────────────────────────
export interface PolePlanning {
  location: string;
  spacingKm: number;
  structureType: string;
  clearanceStatus: string;
  techDocs: string;
  envDocs: string;
  year?: number;
  progress?: string;
}

export interface GridPowerPole extends PowerPole {
  workflowStatus?: WorkflowStatus;
  planning?: PolePlanning;
  /** Hình ảnh hiện trạng trụ (yêu cầu NV1). */
  images?: string[];
}

// ─────────────────────────── Dữ liệu tải & dự báo ───────────────────────────
export type GridEntityType = "substation" | "line";

export interface GridLoadRecord {
  id: string;
  entityType: GridEntityType;
  entityId: string;
  timestamp: string;
  loadMw: number;
  capacityMw: number;
  loadFactorPct: number;
}

export interface ForecastPoint {
  period: string;
  history?: number;
  forecast?: number;
  threshold?: number;
}

export interface ForecastResult {
  entityType: GridEntityType;
  entityId: string;
  entityLabel: string;
  horizon: ForecastHorizon;
  unit: string;
  points: ForecastPoint[];
  risk: "Thấp" | "Trung bình" | "Cao";
  note: string;
}

// ─────────────────────────── AI hỗ trợ dự báo (demo) ───────────────────────────
/** Nguồn dữ liệu mà từng yếu tố ảnh hưởng lấy từ đâu (để giải thích cho AI). */
export type AiFactorSource = "history" | "gis" | "stats";

export interface FactorContribution {
  id: string;
  label: string;
  source: AiFactorSource;
  /** "up" = đẩy dự báo tăng, "down" = kéo giảm. */
  effect: "up" | "down";
  /** Mức tác động vào hệ số tải dự báo (điểm %). */
  impactPct: number;
}

export interface AiForecastPoint {
  period: string;
  /** Lịch sử thực tế (kỳ T1..T12). */
  actual?: number;
  /** Dự báo cơ sở (MW). */
  base?: number;
  /** Cận dưới khoảng tin cậy (MW). */
  min?: number;
  /** Cận trên khoảng tin cậy (MW). */
  max?: number;
  /** Ngưỡng cảnh báo (MW) theo GRID_CONFIG. */
  threshold?: number;
}

export type ForecastScenarioKey = "low" | "base" | "high";

export interface AiForecastResult {
  entityType: GridEntityType;
  entityId: string;
  entityLabel: string;
  horizon: ForecastHorizon;
  unit: "MW";
  /** Mô tả phương pháp (demo). */
  method: string;
  /** True khi đối tượng chưa đủ chuỗi lịch sử → không dự báo được. */
  insufficient: boolean;
  inputSummary: {
    nPeriods: number;
    capacityMw: number;
    lastActualMw?: number;
    lastLoadFactorPct?: number;
    growthPerYearPct: number;
  };
  points: AiForecastPoint[];
  scenarios: Record<ForecastScenarioKey, { label: string; value: number }>;
  risk: "Thấp" | "Trung bình" | "Cao";
  /** Độ tin cậy của khoảng dự báo (%). */
  confidencePct: number;
  factors: FactorContribution[];
  recommendation: string;
  note: string;
}

/** Đề xuất từ AI, chạy theo luồng phê duyệt DRAFT → PENDING → APPROVED/RETURNED (demo). */
export interface GridPlanProposal {
  id: string;
  entityId: string;
  entityType: GridEntityType;
  entityLabel: string;
  title: string;
  kind: "upgrade" | "rebalance" | "monitor" | "new_line";
  workflowStatus: WorkflowStatus;
  createdAt: string;
  summary: string;
}

// ─────────────────────────── Vận hành & sự cố ───────────────────────────
export interface OperationLog {
  id: string;
  time: string;
  type: "energize" | "deenergize" | "maintenance" | "incident" | "switch";
  reason: string;
  affected: string;
  actor: string;
}

export const OPERATION_LOG_TYPE_LABEL: Record<OperationLog["type"], string> = {
  energize: "Đóng điện",
  deenergize: "Cắt điện",
  maintenance: "Bảo trì",
  incident: "Xử lý sự cố",
  switch: "Thao tác đóng/cắt",
};

export function operationLogTone(type: OperationLog["type"]) {
  if (type === "deenergize") return "bg-destructive/10 text-destructive";
  if (type === "incident") return "bg-warning/10 text-warning";
  if (type === "maintenance") return "bg-gov/10 text-gov";
  if (type === "energize") return "bg-success/10 text-success";
  return "bg-muted text-muted-foreground";
}

// ─────────────────────────── Nguồn NLTT đấu nối lưới ───────────────────────────
/** Nguồn năng lượng tái tạo đấu nối vào trạm/tuyến — phục vụ đánh giá khả năng tiếp nhận. */
export interface RenewableSource {
  id: string;
  code: string;
  owner: string;
  type: string;
  capacityKw: number;
  installedKw: number;
  gridCapacityKw: number;
  hostingCapacityKw: number;
  overload: "Không" | "Cảnh báo" | "Vượt giới hạn";
  hostSubstationId: string;
  hostLineCode: string;
  connectionPoint: string;
  status: string;
  energizedYear?: number;
  latitude?: number;
  longitude?: number;
}

// ─────────────────────────── Khu vực quá tải (bản đồ số) ───────────────────────────
export interface OverloadZone {
  id: string;
  label: string;
  kind: "substation" | "line";
  refId: string;
  district: string;
  loadFactorPct: number;
  note: string;
  polygons: [number, number][][];
}

// ─────────────────────────── Phân tích khả năng tiếp nhận NLTT ───────────────────────────
/**
 * Đánh giá khả năng tiếp nhận nguồn NLTT theo công thức EVN:
 * P_tiếp nhận ≤ P_vận hành cho phép + P_phụ tải giờ cao điểm trưa
 * − P_đã vận hành − P_chưa vận hành.
 * (Gắn nghiệp vụ thẩm định ĐMT mái nhà theo QĐ 2293/QĐ-UBND: kiểm tra
 * có/không gây quá tải trạm biến áp, lưới điện.)
 */
export interface AbsorptionAssessment {
  substationId: string;
  substationName: string;
  substationCode: string;
  voltageLevel: string;
  /** P_vận hành cho phép (MW). */
  allowableMw: number;
  /** P_phụ tải giờ cao điểm trưa (MW). */
  middayLoadMw: number;
  /** P_đã vận hành (MW). */
  operatingMw: number;
  /** P_chưa vận hành (MW). */
  plannedMw: number;
  /** Khả năng tiếp nhận còn lại (MW). */
  absorptionMw: number;
  status: "available" | "limited" | "full";
  recommendation: string;
  sources: RenewableSource[];
}

/** Đánh giá khả năng giải tỏa công suất NLTT của tuyến. */
export interface LineCurtailment {
  lineId: string;
  lineName: string;
  lineCode: string;
  voltageLevel: string;
  capacityMw: number;
  currentLoadMw: number;
  renewablesConnectedMw: number;
  headroomMw: number;
  status: "available" | "limited" | "full";
  recommendation: string;
  sources: RenewableSource[];
}

/** Kết quả tra cứu trạm gần nhất cho phụ tải mới (yêu cầu NV1). */
export interface NearestSubstationResult {
  lat: number;
  lng: number;
  demandMw: number;
  substation: {
    id: string;
    name: string;
    code: string;
    voltageLevel: string;
    district: string;
  } | null;
  distanceKm: number | null;
  spareMw: number;
  canSupply: boolean;
  recommendation: string;
}

/** Dự báo nhu cầu phụ tải theo khu vực (gộp trạm trong vùng phụ tải). */
export interface AreaForecastResult {
  areaId: string;
  areaName: string;
  district: string;
  peakMw: number;
  growthPerYearPct: number;
  unit: "MW";
  points: AiForecastPoint[];
  risk: "Thấp" | "Trung bình" | "Cao";
  note: string;
}

// ─────────────────────────── Báo cáo theo Thông tư 34/2019/TT-BCT ───────────────────────────
export interface EnergyReportSection {
  id: string;
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

export interface EnergyReport {
  year: number;
  standard: string;
  generatedAt: string;
  sections: EnergyReportSection[];
  csv: string;
}

export interface GridWarning {
  id: string;
  entityId: string;
  entityType: GridEntityType;
  label: string;
  severity: "info" | "warning" | "danger";
  current: number;
  forecast: number;
  trend: "up" | "down" | "flat";
  risk: "Thấp" | "Trung bình" | "Cao";
  reason: string;
  recommendation: string;
}

// ─────────────────────────── Vùng không gian ───────────────────────────
/** Polygon đơn giản: mảng điểm [lat, lng] (ring). */
export interface SupplyArea {
  id: string;
  name: string;
  substationId: string;
  district: string;
  polygons: [number, number][][];
}

export interface LoadArea {
  id: string;
  name: string;
  district: string;
  peakMw: number;
  polygons: [number, number][][];
}

// ─────────────────────────── Tài sản quy hoạch ───────────────────────────
export interface GridPlanAsset {
  id: string;
  code: string;
  name: string;
  type: "substation" | "line" | "pole";
  voltageLevel: string;
  district: string;
  location: string;
  investor: string;
  progress: string;
  /** Giai đoạn quy hoạch chuẩn hóa. */
  phase?: PlanPhase;
  year: number;
  latitude?: number;
  longitude?: number;
  route?: [number, number][];
  description?: string;
}

// ─────────────────────────── Bundle dữ liệu trang ───────────────────────────
export interface GridOverview {
  totalSubstations: number;
  totalSubstationCapacityMva: number;
  totalOperatingCapacityMva: number;
  overloadedSubstations: number;
  totalLines: number;
  totalLineLengthKm: number;
  highLoadLines: number;
  avgLossPct: number;
}

export interface Task1GridData {
  substations: GridSubstation[];
  lines: GridPowerLine[];
  poles: GridPowerPole[];
  /** Trụ điện theo quy hoạch tuyến (chưa xây dựng). */
  plannedPoles: GridPowerPole[];
  planned: GridPlanAsset[];
  supplyAreas: SupplyArea[];
  loadAreas: LoadArea[];
  /** Điểm sự cố tuyến (có tọa độ). */
  incidents: GridIncident[];
  /** Khu vực quá tải (bản đồ số). */
  overloadZones: OverloadZone[];
  /** Nguồn NLTT đấu nối lưới. */
  renewables: RenewableSource[];
  /** Lịch sử vận hành gần nhất toàn lưới. */
  operationLogs: OperationLog[];
  warnings: GridWarning[];
  overview: GridOverview;
  loadHistory?: GridLoadRecord[];
  provenance?: {
    source: string;
    measurements: number;
    gisPositions: number;
    planningAssets: number;
    operatingSnapshots: number;
    latestMeasurementAt?: string | null;
    notes: string[];
  };
}
