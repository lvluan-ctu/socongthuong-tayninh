export type ClusterDossierStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "INVESTOR_SELECTING"
  | "INFRA_CONSTRUCTION"
  | "OPERATING"
  | "EXPANDING"
  | "SUSPENDED"
  | "DISSOLVED";

export type InvestmentMilestoneStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "DELAYED";

export type DocumentType =
  | "DECISION_ESTABLISH"
  | "DECISION_EXPAND"
  | "PLANNING_DOC"
  | "LAND_USE_CERT"
  | "ENV_IMPACT_ASSESSMENT"
  | "INVESTOR_PROPOSAL"
  | "INVESTOR_DECISION"
  | "INFRA_DESIGN"
  | "CONSTRUCTION_PERMIT"
  | "PROGRESS_REPORT"
  | "COMPLETION_REPORT"
  | "OTHER";

export type ReportType =
  | "BIEU_01"
  | "BIEU_02"
  | "BIEU_03"
  | "BIEU_04";

export type ReportStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED";

export type ReportPeriod = string;

export type IndustrialUserRole =
  | "WARD_STAFF"
  | "INVESTOR_STAFF"
  | "DISTRICT_STAFF"
  | "PROVINCE_STAFF"
  | "ADMIN";

export interface DocumentAttachment {
  id: string;
  name: string;
  type: DocumentType;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
  size?: number;
}

export interface InvestmentMilestone {
  id: string;
  clusterId: string;
  code: string;
  name: string;
  plannedDate: string;
  actualDate?: string;
  progressPercent: number;
  status: InvestmentMilestoneStatus;
  attachments: DocumentAttachment[];
  notes?: string;
  createdBy: string;
  updatedAt: string;
}

export interface LandFundDetail {
  totalArea: number;
  industrialLand: number;
  serviceLand: number;
  greenLand: number;
  trafficLand: number;
  vacantLand: number;
  leasedLand: number;
  unleasedLand: number;
  byFunctionZone: { zone: string; area: number; leased: number; occupancy: number }[];
}

export interface ClusterReport {
  id: string;
  clusterId: string;
  reportType: ReportType;
  period: ReportPeriod;
  reportingEntity: "WARD" | "INVESTOR" | "DISTRICT" | "PROVINCE";
  data: Record<string, unknown>;
  status: ReportStatus;
  submittedAt?: string;
  approvedAt?: string;
  fileUrl?: string;
  createdBy: string;
  createdAt: string;
}

export interface IndustrialUser {
  id: string;
  name: string;
  role: IndustrialUserRole;
  wardId?: string;
  investorId?: string;
  districtId?: string;
  permissions: string[];
}

export interface ClusterDossier {
  id: string;
  name: string;
  district: string;
  ward: string;
  wardId: string;
  area: number;
  leased: number;
  enterprises: number;
  sectors: string;
  occupancy: number;
  status: ClusterDossierStatus;
  lat: number;
  lng: number;
  geometry?: {
    type: "Polygon";
    coordinates: number[][][];
  };
  investor?: string;
  investorTaxCode?: string;
  investorAddress?: string;
  investmentCapital?: number;
  investmentForm?: "BUILD_TRANSFER" | "BUILD_OPERATE_TRANSFER" | "PPP" | "OTHER";
  infrastructure: { name: string; level: number; note: string }[];
  dossierCode: string;
  decisionEstablish?: string;
  decisionDate?: string;
  planningDoc?: string;
  landUseCert?: string;
  envImpactAssessment?: string;
  milestones: InvestmentMilestone[];
  overallProgress: number;
  landCompensationProgress: number;
  infraConstructionProgress: number;
  landFund: LandFundDetail;
  reports: ClusterReport[];
  documents: DocumentAttachment[];
  managedByWardId?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WardZoneIndustrial {
  id: string;
  name: string;
  type: "xa" | "phuong";
  lat: number;
  lng: number;
  approxRadiusM: number;
  clusters: string[];
  note?: string;
}

export interface ClusterStatusLabel {
  label: string;
  color: string;
  bgColor: string;
}

export const CLUSTER_STATUS_LABELS: Record<ClusterDossierStatus, ClusterStatusLabel> = {
  DRAFT: { label: "Soạn thảo", color: "text-muted-foreground", bgColor: "bg-muted" },
  SUBMITTED: { label: "Đã nộp", color: "text-info", bgColor: "bg-info/10" },
  UNDER_REVIEW: { label: "Đang xem xét", color: "text-warning", bgColor: "bg-warning/10" },
  APPROVED: { label: "Đã phê duyệt", color: "text-success", bgColor: "bg-success/10" },
  INVESTOR_SELECTING: { label: "Chọn chủ đầu tư", color: "text-gov", bgColor: "bg-gov/10" },
  INFRA_CONSTRUCTION: { label: "Đang xây dựng", color: "text-gov", bgColor: "bg-gov/10" },
  OPERATING: { label: "Đang hoạt động", color: "text-success", bgColor: "bg-success/10" },
  EXPANDING: { label: "Đang mở rộng", color: "text-teal", bgColor: "bg-teal/10" },
  SUSPENDED: { label: "Tạm ngừng", color: "text-destructive", bgColor: "bg-destructive/10" },
  DISSOLVED: { label: "Đã giải thể", color: "text-muted-foreground", bgColor: "bg-muted" },
};

export const MILESTONE_STATUS_LABELS: Record<InvestmentMilestoneStatus, ClusterStatusLabel> = {
  NOT_STARTED: { label: "Chưa bắt đầu", color: "text-muted-foreground", bgColor: "bg-muted" },
  IN_PROGRESS: { label: "Đang thực hiện", color: "text-gov", bgColor: "bg-gov/10" },
  COMPLETED: { label: "Hoàn thành", color: "text-success", bgColor: "bg-success/10" },
  DELAYED: { label: "Chậm tiến độ", color: "text-destructive", bgColor: "bg-destructive/10" },
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  DECISION_ESTABLISH: "Quyết định thành lập",
  DECISION_EXPAND: "Quyết định mở rộng",
  PLANNING_DOC: "Văn bản quy hoạch",
  LAND_USE_CERT: "Giấy chứng nhận đất",
  ENV_IMPACT_ASSESSMENT: "Đánh giá MT",
  INVESTOR_PROPOSAL: "Đề nghị chủ đầu tư",
  INVESTOR_DECISION: "QĐ chọn chủ đầu tư",
  INFRA_DESIGN: "Thiết kế hạ tầng",
  CONSTRUCTION_PERMIT: "GP xây dựng",
  PROGRESS_REPORT: "Báo cáo tiến độ",
  COMPLETION_REPORT: "Báo cáo hoàn thành",
  OTHER: "Khác",
};

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  BIEU_01: "Biểu 01 - DN trong CCN",
  BIEU_02: "Biểu 02 - Chủ đầu tư hạ tầng",
  BIEU_03: "Biểu 03 - Tổng hợp huyện",
  BIEU_04: "Biểu 04 - Tổng hợp tỉnh",
};

export const INVESTMENT_FORM_LABELS: Record<string, string> = {
  BUILD_TRANSFER: "Xây dựng - Chuyển giao (BT)",
  BUILD_OPERATE_TRANSFER: "Xây dựng - Vận hành - Chuyển giao (BOT)",
  PPP: "Hợp đồng PPP",
  OTHER: "Hình thức khác",
};

export const CLUSTER_STATUS_ORDER: ClusterDossierStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "INVESTOR_SELECTING",
  "INFRA_CONSTRUCTION",
  "OPERATING",
  "EXPANDING",
  "SUSPENDED",
  "DISSOLVED",
];

export function getClusterStatusOrder(status: ClusterDossierStatus): number {
  return CLUSTER_STATUS_ORDER.indexOf(status);
}