export interface CoFta {
  code: string;
  name: string;
  shortName: string;
  region: string;
  members: string[];
  effectiveDate: string;
  legalBasis: string;
  status: "active" | "inactive";
}

export interface CoForm {
  code: string;
  name: string;
  ftaCode: string | null;
  authority: string;
  isPreferential: boolean;
  legalBasis: string;
  totalBoxes: number;
  originCriteria: string[];
  pdfUrl?: string;
  description?: string;
}

export interface CoCountry {
  code: string;
  name: string;
  nameEn: string;
  region: string;
  isAsean: boolean;
  isEu: boolean;
}

export interface CoHsCode {
  code: string;
  code6: string;
  code4: string;
  nameVi: string;
  nameEn: string;
  unit: string;
  chapter: string;
}

export interface CoOriginCriterion {
  code: string;
  name: string;
  nameVi: string;
  description: string;
  examples: string[];
  formula?: string;
  thresholds?: Record<string, number>;
  appliesTo: string[];
}

export interface CoTariffSchedule {
  hsCode: string;
  description: string;
  mfnRate: number;
  atiga: number;
  acfta: number;
  akfta: number;
  cptpp: number;
  evfta: number;
  rcep: number;
  aanz: number;
  ai: number;
}

export interface CoApplicationItem {
  itemNumber: number;
  hsCode: string;
  description: string;
  quantity: number;
  unit: string;
  fobValue: number;
  originCriterion: string;
  countryOfOrigin: string;
  rvcPercentage?: number;
  invoiceNumber: string;
  invoiceDate: string;
}

export interface CoStatusEvent {
  from: CoApplicationStatus | null;
  to: CoApplicationStatus;
  action: CoWorkflowAction;
  by: string;
  at: string;
  note?: string;
}

export type CoWorkflowAction =
  | "CREATE"
  | "SUBMIT"
  | "ACCEPT"
  | "RETURN"
  | "APPROVE"
  | "REJECT"
  | "ISSUE"
  | "CANCEL";

export interface CoSelfAssessmentItem {
  id: string;
  met: boolean;
  note?: string;
}

export interface CoSelfAssessment {
  items: CoSelfAssessmentItem[];
  assessedBy: string;
  assessedAt: string;
}

export interface CoApplication {
  id: string;
  applicationNo: string;
  formCode: string;
  ftaCode: string;
  /** C/O hay Văn bản chấp thuận tự chứng nhận xuất xứ (TT 40/2025). */
  certificateType: "CO" | "SELF_CERT";
  /** Cơ quan tiếp nhận hồ sơ — theo phân cấp (QĐ 34/2025/QĐ-UBND). */
  receivingAgency: string;
  exporter: {
    name: string;
    address: string;
    taxCode: string;
    country: string;
  };
  consignee: {
    name: string;
    address: string;
    country: string;
  };
  transport: {
    departureDate: string;
    vessel: string;
    portLoading: string;
    portDischarge: string;
  };
  items: CoApplicationItem[];
  declaration: {
    exportingCountry: string;
    importingCountry: string;
    signDate: string;
    signerName: string;
  };
  status: CoApplicationStatus;
  coNumber: string | null;
  coIssuedDate: string | null;
  approvedBy: string | null;
  /** Ghi chú của người thẩm định / lý do trả lại, từ chối, thu hồi. */
  reviewerNote: string | null;
  /** Nhật ký chuyển trạng thái hồ sơ (audit). */
  statusHistory: CoStatusEvent[];
  dataSource: "MANUAL" | "ECOSYS" | "FILE_IMPORT";
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type CoApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "PROCESSING"
  | "RETURNED"
  | "APPROVED"
  | "REJECTED"
  | "ISSUED"
  | "CANCELLED";

export interface CoImportBatch {
  id: string;
  source: string;
  fileName: string;
  totalRecords: number;
  acceptedRecords: number;
  rejectedRecords: number;
  status: string;
  importedAt: string;
  importedBy: string;
  errors: { row: number; message: string }[];
}

export interface CoKpis {
  totalApplications: number;
  totalValue: number;
  totalSavings: number;
  pendingCount: number;
  issuedThisMonth: number;
  byFta: { fta: string; count: number; value: number }[];
}

export interface CoChartData {
  monthlyTrend: { month: string; count: number; value: number }[];
  byCountry: { country: string; count: number; value: number }[];
  byFta: { fta: string; count: number; value: number }[];
  byStatus: { status: CoApplicationStatus; count: number }[];
}

export interface CoTaxComparison {
  hsCode: string;
  description: string;
  mfnRate: number;
  options: {
    fta: string;
    formCO: string;
    rate: number;
    savings: number;
    savingsPercent: number;
  }[];
  bestOption: string;
}

export const CO_STATUS_LABELS: Record<CoApplicationStatus, string> = {
  DRAFT: "Nháp",
  SUBMITTED: "Đã nộp",
  PROCESSING: "Đang xử lý",
  RETURNED: "Trả lại/HS bổ sung",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
  ISSUED: "Đã cấp C/O",
  CANCELLED: "Đã hủy/thu hồi",
};

export const CO_STATUS_COLORS: Record<CoApplicationStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SUBMITTED: "bg-info/10 text-info",
  PROCESSING: "bg-warning/10 text-warning",
  RETURNED: "bg-orange-100 text-orange-700",
  APPROVED: "bg-success/10 text-success",
  REJECTED: "bg-destructive/10 text-destructive",
  ISSUED: "bg-gov/10 text-gov",
  CANCELLED: "bg-slate-200 text-slate-600",
};

export const CO_WORKFLOW_ACTION_LABELS: Record<CoWorkflowAction, string> = {
  CREATE: "Tạo hồ sơ",
  SUBMIT: "Nộp hồ sơ",
  ACCEPT: "Tiếp nhận & thẩm định",
  RETURN: "Trả lại/yc bổ sung",
  APPROVE: "Duyệt",
  REJECT: "Từ chối",
  ISSUE: "Cấp C/O",
  CANCEL: "Hủy/thu hồi",
};
