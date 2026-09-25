// ============================================================
// CHỈ TIÊU NGÀNH CÔNG THƯƠNG — parsed từ public/Chi_Tieu_Nganh_Cong_Thuong.xlsx.
// TMBLHH đơn vị tỷ đồng; XNK đơn vị triệu USD.
// Cột 2025 là số thực trong file; hộ dùng điện là số demo nhập tay (99,9%).
// Tái tạo: node scripts/parse-chi-tieu-nganh.mjs
// ============================================================
import type { ReportDataset, ReportRow } from "@/lib/types";

export const TMBLHH_KH = { value: 232129.194, tocdo: 0.14 }; // tỷ đồng
export const XNK_KH = { xk: 19600, xkTocdo: 0.1, nk: 15600, nkTocdo: 0.08 }; // triệu USD

export const TMBLHH_MONTHLY: { month: string; v2025: number; v2026: number; growth: number }[] = [
  { month: "T1", v2025: 16425.92, v2026: 18424, growth: 12.16 },
  { month: "T2", v2025: 15718.08, v2026: 18583.13, growth: 18.23 },
  { month: "T3", v2025: 15928.23, v2026: 18635.24, growth: 17 },
  { month: "T4", v2025: 16105.81, v2026: 19222.08, growth: 19.35 },
  { month: "T5", v2025: 16298.91, v2026: 19363.95, growth: 18.81 },
  { month: "T6", v2025: 15970.62, v2026: 19576.8, growth: 22.58 },
  { month: "T7", v2025: 16092.07, v2026: 20012.45, growth: 24.36 },
  { month: "T8", v2025: 16763.14, v2026: 20150.33, growth: 20.21 },
];
export const XK_MONTHLY: { month: string; v2025: number; v2026: number; growth: number }[] = [
  { month: "T1", v2025: 1311.56, v2026: 1726.92, growth: 31.67 },
  { month: "T2", v2025: 1173.77, v2026: 1137.08, growth: -3.13 },
  { month: "T3", v2025: 1481, v2026: 1772.53, growth: 19.69 },
  { month: "T4", v2025: 1523.96, v2026: 1770.84, growth: 16.2 },
  { month: "T5", v2025: 1514.99, v2026: 1728.66, growth: 14.1 },
  { month: "T6", v2025: 1485.09, v2026: 1800.47, growth: 21.24 },
  { month: "T7", v2025: 1598.7, v2026: 1843.63, growth: 15.32 },
  { month: "T8", v2025: 1547.46, v2026: 1832.45, growth: 18.42 },
];
export const NK_MONTHLY: { month: string; v2025: number; v2026: number; growth: number }[] = [
  { month: "T1", v2025: 906.79, v2026: 1299.85, growth: 43.35 },
  { month: "T2", v2025: 1051.73, v2026: 906.66, growth: -13.79 },
  { month: "T3", v2025: 1253.27, v2026: 1431.86, growth: 14.25 },
  { month: "T4", v2025: 1281.37, v2026: 1458.52, growth: 13.83 },
  { month: "T5", v2025: 1167.35, v2026: 1363.97, growth: 16.84 },
  { month: "T6", v2025: 1077.7, v2026: 1339.18, growth: 24.26 },
  { month: "T7", v2025: 1086.78, v2026: 1256.8, growth: 15.64 },
  { month: "T8", v2025: 1098.43, v2026: 1185.3, growth: 7.91 },
];

export const TMBLHH_ROWS: ReportRow[] = [
  { id: "R-01", cells: { thang: "1", v2025: 16425.92, v2026: 18424, growth: 12.16 } },
  { id: "R-02", cells: { thang: "2", v2025: 15718.08, v2026: 18583.13, growth: 18.23 } },
  { id: "R-03", cells: { thang: "3", v2025: 15928.23, v2026: 18635.24, growth: 17 } },
  { id: "R-04", cells: { thang: "4", v2025: 16105.81, v2026: 19222.08, growth: 19.35 } },
  { id: "R-05", cells: { thang: "5", v2025: 16298.91, v2026: 19363.95, growth: 18.81 } },
  { id: "R-06", cells: { thang: "6", v2025: 15970.62, v2026: 19576.8, growth: 22.58 } },
  { id: "R-07", cells: { thang: "7", v2025: 16092.07, v2026: 20012.45, growth: 24.36 } },
  { id: "R-08", cells: { thang: "8", v2025: 16763.14, v2026: 20150.33, growth: 20.21 } },
];
export const XK_ROWS: ReportRow[] = [
  { id: "R-01", cells: { thang: "1", v2025: 1311.56, v2026: 1726.92, growth: 31.67 } },
  { id: "R-02", cells: { thang: "2", v2025: 1173.77, v2026: 1137.08, growth: -3.13 } },
  { id: "R-03", cells: { thang: "3", v2025: 1481, v2026: 1772.53, growth: 19.69 } },
  { id: "R-04", cells: { thang: "4", v2025: 1523.96, v2026: 1770.84, growth: 16.2 } },
  { id: "R-05", cells: { thang: "5", v2025: 1514.99, v2026: 1728.66, growth: 14.1 } },
  { id: "R-06", cells: { thang: "6", v2025: 1485.09, v2026: 1800.47, growth: 21.24 } },
  { id: "R-07", cells: { thang: "7", v2025: 1598.7, v2026: 1843.63, growth: 15.32 } },
  { id: "R-08", cells: { thang: "8", v2025: 1547.46, v2026: 1832.45, growth: 18.42 } },
];
export const NK_ROWS: ReportRow[] = [
  { id: "R-01", cells: { thang: "1", v2025: 906.79, v2026: 1299.85, growth: 43.35 } },
  { id: "R-02", cells: { thang: "2", v2025: 1051.73, v2026: 906.66, growth: -13.79 } },
  { id: "R-03", cells: { thang: "3", v2025: 1253.27, v2026: 1431.86, growth: 14.25 } },
  { id: "R-04", cells: { thang: "4", v2025: 1281.37, v2026: 1458.52, growth: 13.83 } },
  { id: "R-05", cells: { thang: "5", v2025: 1167.35, v2026: 1363.97, growth: 16.84 } },
  { id: "R-06", cells: { thang: "6", v2025: 1077.7, v2026: 1339.18, growth: 24.26 } },
  { id: "R-07", cells: { thang: "7", v2025: 1086.78, v2026: 1256.8, growth: 15.64 } },
  { id: "R-08", cells: { thang: "8", v2025: 1098.43, v2026: 1185.3, growth: 7.91 } },
];
const CHITIEU_META = {
  fileType: "MẪU" as const,
  year: 2026,
  source: "Sở Công Thương – File Chỉ tiêu ngành Công Thương",
  status: "approved" as const,
  extractedAt: "25/09/2026 08:00",
  savedAt: "25/09/2026 08:00",
  via: "sample" as const,
};

function monthColumns(unit: string) {
  return [
    { key: "thang", header: "Tháng", type: "text" as const },
    { key: "v2025", header: `2025 (${unit})`, type: "number" as const },
    { key: "v2026", header: `2026 (${unit})`, type: "number" as const },
    { key: "growth", header: "Tăng/giảm (%)", type: "percent" as const },
  ];
}

export const TMBLHH_DATASET: ReportDataset = {
  id: "SCT-TMBLHH-8T26",
  name: "Tổng mức bán lẻ hàng hóa và doanh thu dịch vụ T1-T8/2026",
  fileName: "Chi_Tieu_Nganh_Cong_Thuong.xlsx",
  period: "8 tháng đầu 2026 (so cùng kỳ 2025, KH 232.129 tỷ đồng)",
  columns: monthColumns("tỷ đồng"),
  rows: TMBLHH_ROWS,
  summary:
    "Tổng mức 8 tháng đầu 2026 đạt 153.968 tỷ đồng, bằng 66,3% kế hoạch năm (232.129 tỷ). " +
    "Tăng trưởng so cùng kỳ duy trì 12–24%/tháng. Nguồn: sheet TMBLHH.",
  ...CHITIEU_META,
};

export const XK_DATASET: ReportDataset = {
  id: "SCT-XK-8T26",
  name: "Kim ngạch xuất khẩu T1-T8/2026",
  fileName: "Chi_Tieu_Nganh_Cong_Thuong.xlsx",
  period: "8 tháng đầu 2026 (so cùng kỳ 2025, KH 19.600 triệu USD)",
  columns: monthColumns("triệu USD"),
  rows: XK_ROWS,
  summary:
    "Xuất khẩu 8 tháng đạt 13.612,6 triệu USD, bằng 69,5% kế hoạch năm. " +
    "Riêng tháng 2 giảm 3,1% so cùng kỳ, các tháng còn lại tăng 14–32%. Nguồn: sheet XNK.",
  ...CHITIEU_META,
};

export const NK_DATASET: ReportDataset = {
  id: "SCT-NK-8T26",
  name: "Kim ngạch nhập khẩu T1-T8/2026",
  fileName: "Chi_Tieu_Nganh_Cong_Thuong.xlsx",
  period: "8 tháng đầu 2026 (so cùng kỳ 2025, KH 15.600 triệu USD)",
  columns: monthColumns("triệu USD"),
  rows: NK_ROWS,
  summary: "Nhập khẩu 8 tháng đạt 10.242,1 triệu USD, bằng 65,7% kế hoạch năm. Nguồn: sheet XNK.",
  ...CHITIEU_META,
};

export const DIEN_HOGD_DATASET: ReportDataset = {
  id: "SCT-DIEN-HOGD-26",
  name: "Tỷ lệ hộ dân sử dụng điện năm 2026",
  fileName: "Nhập tay (sheet TLHDSD điện đang trống)",
  period: "Năm 2026",
  columns: [
    { key: "chitieu", header: "Chỉ tiêu", type: "text" },
    { key: "v2025", header: "2025 (%)", type: "number" },
    { key: "v2026", header: "2026 demo (%)", type: "number" },
    { key: "nguon", header: "Nguồn", type: "text" },
  ],
  rows: [
    {
      id: "R-01",
      cells: {
        chitieu: "Tỷ lệ hộ dân sử dụng điện toàn tỉnh",
        v2025: 99.97,
        v2026: 99.9,
        nguon: "Số demo nhập tay — công chức cập nhật khi có số liệu",
      },
    },
  ],
  summary:
    "Tỷ lệ hộ dùng điện demo 99,9% (sheet gốc trống). Công chức cập nhật số thật tại tab Tiếp nhận.",
  ...CHITIEU_META,
};

export const SCT_CHITIEU_DATASETS: ReportDataset[] = [
  TMBLHH_DATASET,
  XK_DATASET,
  NK_DATASET,
  DIEN_HOGD_DATASET,
];
