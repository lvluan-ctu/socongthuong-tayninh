import {
  Activity,
  BarChart3,
  Boxes,
  Database,
  FileBarChart,
  FileCheck2,
  Globe2,
  Layers,
  LayoutDashboard,
  Map,
  Plug,
  ShieldCheck,
  Ship,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type RoleId =
  "leader" | "dept" | "specialist" | "gis" | "surveyor" | "enterprise" | "investor" | "admin";

export interface RoleDef {
  id: RoleId;
  name: string;
  scope: string;
}

// Role switcher chỉ phục vụ DEMO RBAC (XXIII), không có backend auth.
export const ROLES: RoleDef[] = [
  { id: "leader", name: "Lãnh đạo UBND/Sở", scope: "Điều hành toàn ngành" },
  { id: "dept", name: "Lãnh đạo phòng/đơn vị", scope: "Kiểm duyệt – phê duyệt" },
  { id: "specialist", name: "Chuyên viên", scope: "Nhập liệu – tác nghiệp" },
  { id: "gis", name: "Cán bộ GIS", scope: "Dữ liệu không gian" },
  { id: "surveyor", name: "Cán bộ điều tra", scope: "Điều tra – năng lượng" },
  { id: "enterprise", name: "Doanh nghiệp", scope: "Cổng doanh nghiệp" },
  { id: "investor", name: "Nhà đầu tư", scope: "Thông tin công khai" },
  { id: "admin", name: "Quản trị hệ thống", scope: "Quản trị – an toàn" },
];

export interface NavChild {
  label: string;
  to: string;
  /** Đánh dấu mục con đặc biệt (vd "05-gis" = mở bộ lọc GIS). */
  code?: string;
  /** Query params kèm khi điều hướng (vd { mode: "station" } cho Nhiệm vụ 1). */
  search?: Record<string, unknown>;
  /** Phân quyền riêng cho mục con (nếu thiếu thì kế thừa của cha). */
  roles?: RoleId[];
  children?: NavChild[];
  /** Chỉ active khi URL khớp chính xác, tránh dashboard sáng ở mọi trang con. */
  exact?: boolean;
  /**  tạm thời ẩn khỏi sidebar (giữ route). */
  hidden?: boolean;
}

export interface NavItem {
  code: string;
  label: string;
  to: string;
  icon: LucideIcon;
  group: string;
  roles: RoleId[];
  /** Mở trong tab mới (dùng cho trang public portal). */
  external?: boolean;
  children?: NavChild[];
}

const ALL: RoleId[] = [
  "leader",
  "dept",
  "specialist",
  "gis",
  "surveyor",
  "enterprise",
  "investor",
  "admin",
];

function missionMenu(taskId: number, aiLabel: string, extras: NavChild[] = []): NavChild {
  const base = `/energy/nhiem-vu-${taskId}`;
  let subtitle = "";
  switch (taskId) {
    case 1:
      subtitle = "Quản lý lưới điện và trạm biến áp";
      break;
    case 2:
      subtitle = "Quản lý nguồn năng lượng tái tạo";
      break;
    case 3:
      subtitle = "Tư vấn điện mặt trời mái nhà";
      break;
    case 4:
      subtitle = "Đối soát báo cáo năng lượng";
      break;
    case 5:
      subtitle = "An toàn điện";
      break;
    case 6:
      subtitle = "Phân tích phát thải khí nhà kính";
      break;
    case 7:
      subtitle = "Dự báo trạm sạc xe điện";
      break;
    case 8:
      subtitle = "Quản lý hạ tầng dầu khí";
      break;
  }
  return {
    label: `Nhiệm vụ ${taskId} - ${subtitle}`,
    to: base,
    code: `energy-task-${taskId}`,
    children: [
      {
        label: "Tổng quan nhiệm vụ",
        to: base,
        code: `energy-task-${taskId}-overview`,
        exact: true,
      },
      ...extras,
      { label: "Quản lý dữ liệu", to: `${base}/quan-ly`, code: `energy-task-${taskId}-management` },
      { label: aiLabel, to: `${base}/ai`, code: `energy-task-${taskId}-ai` },
      {
        label: "Báo cáo & xuất dữ liệu",
        to: `${base}/bao-cao`,
        code: `energy-task-${taskId}-report`,
      },
    ],
  };
}

export const NAV_GROUPS = ["ĐIỀU HÀNH", "DỮ LIỆU", "DỮ LIỆU GIS", "BÁO CÁO", "HỆ THỐNG"];

export const NAV_ITEMS: NavItem[] = [
  {
    code: "01",
    label: "Tổng quan",
    to: "/",
    icon: LayoutDashboard,
    group: "ĐIỀU HÀNH",
    roles: ALL,
  },
  {
    code: "13",
    label: "Kiến trúc nền tảng",
    to: "/platform-overview",
    icon: Layers,
    group: "ĐIỀU HÀNH",
    roles: ALL,
  },
  {
    code: "03",
    label: "Quản trị dữ liệu",
    to: "/data-management",
    icon: Database,
    group: "DỮ LIỆU",
    roles: ["dept", "specialist", "admin"],
  },
  {
    code: "05",
    label: "Dữ liệu GIS",
    to: "/industrial-clusters",
    icon: Map,
    group: "DỮ LIỆU GIS",
    roles: ["leader", "dept", "specialist", "gis", "surveyor", "investor", "admin"],
    children: [
      { label: "Bản đồ GIS tổng hợp", to: "/gis/map", hidden: true },
      { label: "Cụm Công nghiệp", to: "/industrial-clusters", code: "05-gis" },
      {
        label: "Nguồn năng lượng tái tạo",
        to: "/energy",
        code: "06",
        roles: ["leader", "dept", "specialist", "surveyor", "admin"],
        children: [
          {
            label: "Đánh giá đầu tư năng lượng",
            to: "/energy/danh-gia-dau-tu",
            code: "energy-investment-assessment",
            roles: ["leader", "dept", "specialist", "gis", "investor", "admin"],
          },
          missionMenu(1, "AI dự báo phụ tải"),
          missionMenu(2, "AI dự báo nguồn điện"),
          missionMenu(3, "AI tư vấn điện mái nhà", [
            {
              label: "Tư vấn & thiết kế 3D",
              to: "/energy/nhiem-vu-3/tu-van",
              code: "energy-task-3-advisor",
            },
          ]),
          missionMenu(4, "AI đối soát báo cáo"),
          missionMenu(5, "AI an toàn điện"),
          missionMenu(6, "AI phân tích phát thải"),
          missionMenu(7, "AI dự báo trạm sạc"),
          missionMenu(8, "AI dự báo phụ tải dầu khí"),
        ],
      },
      {
        label: "Thương mại",
        to: "/market",
        code: "07-trade",
        roles: ["leader", "dept", "specialist", "enterprise", "admin"],
        children: [
          {
            label: "Quản lý thị trường",
            to: "/market",
            code: "07-market",
            roles: ["leader", "dept", "specialist", "enterprise", "admin"],
          },
          {
            label: "C/O",
            to: "/co",
            code: "08-co",
            roles: ["leader", "dept", "specialist", "enterprise", "admin"],
          },
          {
            label: "Xuất nhập khẩu",
            to: "/import-export",
            code: "09-xnk",
            roles: ["leader", "dept", "specialist", "enterprise", "admin"],
          },
        ],
      },
    ],
  },

  {
    code: "10",
    label: "Báo cáo & BI",
    to: "/analytics",
    icon: FileBarChart,
    group: "BÁO CÁO",
    roles: ["leader", "dept", "specialist", "investor", "admin"],
  },
  {
    code: "11",
    label: "Tích hợp dữ liệu",
    to: "/integration",
    icon: Plug,
    group: "HỆ THỐNG",
    roles: ["admin", "dept"],
  },
  {
    code: "12",
    label: "Quản trị hệ thống",
    to: "/admin",
    icon: ShieldCheck,
    group: "HỆ THỐNG",
    roles: ["admin"],
  },
  {
    code: "15",
    label: "Trag thông tin",
    to: "/trang-thong-tin",
    icon: Globe2,
    group: "ĐIỀU HÀNH",
    roles: ALL,
    external: true,
  },
];

export const QUICK_ACTIONS = [
  { label: "Cập nhật dữ liệu", to: "/data-management", icon: Database },
  { label: "Xem báo cáo", to: "/analytics", icon: FileBarChart },
  { label: "Tra cứu doanh nghiệp", to: "/co?tab=doanh-nghiep", icon: Boxes },
  { label: "Mở bản đồ GIS", to: "/industrial-clusters", icon: Map },
];

export const PLATFORM_MODULES = [
  {
    code: "A",
    name: "Khai thác / Điều hành",
    icon: BarChart3,
    tone: "gov" as const,
    to: "/analytics",
    items: [
      "Kho báo cáo",
      "BI / Drill-down",
      "Cổng Web – GIS Web – Mobile Web",
      "Tra cứu công khai",
      "Cảnh báo",
      "Xuất DOCX/XLSX/PDF",
      "KPI",
    ],
  },
  {
    code: "B",
    name: "Quản trị dữ liệu",
    icon: Database,
    tone: "teal" as const,
    to: "/data-management",
    items: [
      "Master Data",
      "Danh mục dùng chung",
      "OCR/AI",
      "Staging",
      "Data Quality",
      "Mapping",
      "Đối soát",
      "Versioning",
    ],
  },
  {
    code: "C",
    name: "Quản trị & Điều hành hệ thống",
    icon: ShieldCheck,
    tone: "navy" as const,
    to: "/admin",
    items: [
      "Người dùng – Vai trò – Phân quyền",
      "Workflow phê duyệt",
      "Notification",
      "Audit log",
      "Monitoring",
      "Cấu hình",
    ],
  },
  {
    code: "D",
    name: "CSDL ngành & Hồ sơ số cốt lõi",
    icon: Boxes,
    tone: "gov" as const,
    to: "/co?tab=doanh-nghiep",
    items: [
      "Doanh nghiệp",
      "Cơ sở SXKD",
      "Sản phẩm",
      "Giấy phép",
      "Đề án / Chương trình",
      "Dự án",
      "Tài liệu",
      "Dữ liệu địa bàn",
      "Hồ sơ năng lượng",
    ],
  },
  {
    code: "E",
    name: "Phân hệ chuyên ngành",
    icon: Layers,
    tone: "teal" as const,
    to: "/industrial-clusters",
    items: [
      "E1 – GIS Cụm công nghiệp",
      "E2 – Nguồn năng lượng tái tạo",
      "E3 – Quản lý thị trường",
      "E4 – Xuất nhập khẩu",
      "E5 – Xúc tiến thương mại",
    ],
  },
  {
    code: "F",
    name: "Tích hợp & An toàn",
    icon: Plug,
    tone: "success" as const,
    to: "/integration",
    items: [
      "LGSP / NDXP",
      "QLVBĐH",
      "Cổng DVC",
      "CSDL chuyên ngành",
      "API Gateway",
      "Giám sát an toàn thông tin",
    ],
  },
  {
    code: "G",
    name: "Hạ tầng kỹ thuật",
    icon: Activity,
    tone: "navy" as const,
    to: "/integration",
    items: [
      "Trung tâm dữ liệu tỉnh",
      "Máy chủ ứng dụng – CSDL",
      "Sao lưu – Dự phòng",
      "Bảo mật nhiều lớp",
      "Giám sát hạ tầng",
    ],
  },
  {
    code: "H",
    name: "Tác nhân / Use case",
    icon: Globe2,
    tone: "analytics" as const,
    to: "/platform-overview",
    items: [
      "Lãnh đạo UBND/Sở",
      "Lãnh đạo phòng",
      "Chuyên viên",
      "Cán bộ GIS – điều tra",
      "Doanh nghiệp",
      "Nhà đầu tư",
      "Quản trị hệ thống",
    ],
  },
];
