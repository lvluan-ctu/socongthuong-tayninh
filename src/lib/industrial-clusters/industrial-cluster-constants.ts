import type { InvestmentMilestone } from "./industrial-cluster-types";

export const STANDARD_MILESTONES: Omit<InvestmentMilestone, "id" | "clusterId" | "actualDate" | "progressPercent" | "status" | "attachments" | "notes" | "createdBy" | "updatedAt">[] = [
  {
    code: "M01",
    name: "Quyết định thành lập/Phê duyệt quy hoạch",
    plannedDate: "",
  },
  {
    code: "M02",
    name: "Lựa chọn chủ đầu tư hạ tầng",
    plannedDate: "",
  },
  {
    code: "M03",
    name: "Giải phóng mặt bằng & bồi thường",
    plannedDate: "",
  },
  {
    code: "M04",
    name: "Cấp GP xây dựng hạ tầng",
    plannedDate: "",
  },
  {
    code: "M05",
    name: "Xây dựng giao thông nội bộ",
    plannedDate: "",
  },
  {
    code: "M06",
    name: "Xây dựng cấp/thoát nước",
    plannedDate: "",
  },
  {
    code: "M07",
    name: "Xây dựng điện, viễn thông",
    plannedDate: "",
  },
  {
    code: "M08",
    name: "Xây dựng nhà xử lý nước thải",
    plannedDate: "",
  },
  {
    code: "M09",
    name: "Hoàn thiện hạ tầng thiết yếu",
    plannedDate: "",
  },
  {
    code: "M10",
    name: "Nghiệm thu hạ tầng & đưa vào sử dụng",
    plannedDate: "",
  },
  {
    code: "M11",
    name: "Thu hút doanh nghiệp đầu tư sản xuất",
    plannedDate: "",
  },
  {
    code: "M12",
    name: "Đạt tỷ lệ lấp đầy quy định",
    plannedDate: "",
  },
];

export const REPORT_PERIODS: string[] = [
  "H1/2024",
  "2024",
  "H1/2025",
  "2025",
  "H1/2026",
  "2026",
];

export const REPORT_DEADLINES = {
  BIEU_01: { h1: "20/06", year: "20/12" },
  BIEU_02: { h1: "20/06", year: "20/12" },
  BIEU_03: { h1: "25/06", year: "25/12" },
  BIEU_04: { h1: "30/06", year: "31/12" },
};

export const REPORT_ENTITIES = {
  BIEU_01: ["WARD", "INVESTOR"],
  BIEU_02: ["INVESTOR"],
  BIEU_03: ["DISTRICT"],
  BIEU_04: ["PROVINCE"],
};

export const CLUSTER_STATUS_OPTIONS = [
  { value: "ALL", label: "Tất cả" },
  { value: "DRAFT", label: "Soạn thảo" },
  { value: "SUBMITTED", label: "Đã nộp" },
  { value: "UNDER_REVIEW", label: "Đang xem xét" },
  { value: "APPROVED", label: "Đã phê duyệt" },
  { value: "INVESTOR_SELECTING", label: "Chọn chủ đầu tư" },
  { value: "INFRA_CONSTRUCTION", label: "Đang xây dựng" },
  { value: "OPERATING", label: "Đang hoạt động" },
  { value: "EXPANDING", label: "Đang mở rộng" },
  { value: "SUSPENDED", label: "Tạm ngừng" },
  { value: "DISSOLVED", label: "Đã giải thể" },
];

export const MILESTONE_STATUS_OPTIONS = [
  { value: "ALL", label: "Tất cả" },
  { value: "NOT_STARTED", label: "Chưa bắt đầu" },
  { value: "IN_PROGRESS", label: "Đang thực hiện" },
  { value: "COMPLETED", label: "Hoàn thành" },
  { value: "DELAYED", label: "Chậm tiến độ" },
];

export const REPORT_STATUS_OPTIONS = [
  { value: "ALL", label: "Tất cả" },
  { value: "DRAFT", label: "Soạn thảo" },
  { value: "SUBMITTED", label: "Đã nộp" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "REJECTED", label: "Từ chối" },
];

export const DOCUMENT_TYPE_OPTIONS = [
  { value: "DECISION_ESTABLISH", label: "Quyết định thành lập" },
  { value: "DECISION_EXPAND", label: "Quyết định mở rộng" },
  { value: "PLANNING_DOC", label: "Văn bản quy hoạch" },
  { value: "LAND_USE_CERT", label: "Giấy chứng nhận đất" },
  { value: "ENV_IMPACT_ASSESSMENT", label: "Đánh giá MT" },
  { value: "INVESTOR_PROPOSAL", label: "Đề nghị chủ đầu tư" },
  { value: "INVESTOR_DECISION", label: "QĐ chọn chủ đầu tư" },
  { value: "INFRA_DESIGN", label: "Thiết kế hạ tầng" },
  { value: "CONSTRUCTION_PERMIT", label: "GP xây dựng" },
  { value: "PROGRESS_REPORT", label: "Báo cáo tiến độ" },
  { value: "COMPLETION_REPORT", label: "Báo cáo hoàn thành" },
  { value: "OTHER", label: "Khác" },
];

export const INVESTMENT_FORM_OPTIONS = [
  { value: "BUILD_TRANSFER", label: "Xây dựng - Chuyển giao (BT)" },
  { value: "BUILD_OPERATE_TRANSFER", label: "Xây dựng - Vận hành - Chuyển giao (BOT)" },
  { value: "PPP", label: "Hợp đồng PPP" },
  { value: "OTHER", label: "Hình thức khác" },
];

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  WARD_STAFF: [
    "cluster:read",
    "cluster:create",
    "cluster:update",
    "report:create",
    "report:submit",
    "milestone:create",
    "milestone:update",
    "document:upload",
  ],
  INVESTOR_STAFF: [
    "cluster:read",
    "milestone:update",
    "document:upload",
    "report:create",
    "report:submit",
  ],
  DISTRICT_STAFF: [
    "cluster:read",
    "cluster:update",
    "report:approve",
    "report:reject",
  ],
  PROVINCE_STAFF: [
    "cluster:read",
    "cluster:create",
    "cluster:update",
    "cluster:delete",
    "report:approve",
    "report:reject",
    "report:create",
    "report:submit",
    "milestone:create",
    "milestone:update",
    "document:upload",
    "user:manage",
  ],
  ADMIN: [
    "*",
  ],
};