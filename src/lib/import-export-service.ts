// ============================================================
// SERVICE LAYER — XUẤT NHẬP KHẨU (XNK).
// Tính KPI, dữ liệu biểu đồ từ TRADES / TRADE_PORTS và liên kết
// dữ liệu với trang "Báo cáo & BI" (/analytics) qua Kho báo cáo
// (localStorage sct.report.datasets).
// ============================================================
import { IMPORT_EXPORT_OVERVIEW, TRADE_PORTS, TRADES } from "@/data/mock";
import type { BorderGateRecord, ReportDataset, TradeRecord } from "@/lib/types";
import {
  createDraftDataset,
  formatNumber,
  readReportDatasets,
  summarizeDataset,
  writeReportDatasets,
} from "@/lib/report-service";

// ---------------------------------------------------------------------------
// KPI & thống kê
// ---------------------------------------------------------------------------
export interface ImportExportKpis {
  total2026: number;
  export2026: number;
  import2026: number;
  surplus2026: number;
  growth2026: number;
  exportGrowth2026: number;
  importGrowth2026: number;
  exportPlanPct: number;
  enterprises: number;
  markets: number;
  gates: number;
  topExportItem: string;
  topMarket: string;
}

export function computeImportExportKpis(): ImportExportKpis {
  const itemCount = new Map<string, number>();
  const marketCount = new Map<string, number>();
  TRADES.forEach((t) => {
    const g = t.hsGroup ?? "Khác";
    itemCount.set(g, (itemCount.get(g) ?? 0) + 1);
    marketCount.set(t.market, (marketCount.get(t.market) ?? 0) + 1);
  });
  const topExportItem = [...itemCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const topMarket = [...marketCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  return {
    total2026: IMPORT_EXPORT_OVERVIEW.total2026,
    export2026: IMPORT_EXPORT_OVERVIEW.export2026,
    import2026: IMPORT_EXPORT_OVERVIEW.import2026,
    surplus2026: IMPORT_EXPORT_OVERVIEW.surplus2026,
    growth2026: IMPORT_EXPORT_OVERVIEW.growth2026,
    exportGrowth2026: IMPORT_EXPORT_OVERVIEW.exportGrowth2026,
    importGrowth2026: IMPORT_EXPORT_OVERVIEW.importGrowth2026,
    exportPlanPct: IMPORT_EXPORT_OVERVIEW.exportPlanPct,
    enterprises: IMPORT_EXPORT_OVERVIEW.enterprises,
    markets: IMPORT_EXPORT_OVERVIEW.markets,
    gates: TRADE_PORTS.length,
    topExportItem,
    topMarket,
  };
}

export interface ImportExportChartData {
  valueByGroup: { name: string; value: number }[];
  directionDonut: { name: string; value: number }[];
  compare2025: { name: string; a: number; b: number }[];
  gates: { name: string; value: number; growth: number }[];
  gateTransit: { name: string; value: number }[];
}

export function buildImportExportChartData(): ImportExportChartData {
  const byGroup = new Map<string, number>();
  TRADES.forEach((t) => {
    const g = t.hsGroup ?? "Khác";
    byGroup.set(g, (byGroup.get(g) ?? 0) + t.exportValue + t.importValue);
  });
  const xkTotal = TRADES.reduce((s, t) => s + t.exportValue, 0);
  const nkTotal = TRADES.reduce((s, t) => s + t.importValue, 0);
  const value2025 = TRADES.reduce((s, t) => s + (t.value2025 ?? 0), 0);
  const value2026 = TRADES.reduce((s, t) => s + (t.value2026 ?? 0), 0);
  return {
    valueByGroup: [...byGroup.entries()]
      .map(([name, value]) => ({ name, value: Math.round(value * 10) / 10 }))
      .sort((a, b) => b.value - a.value),
    directionDonut: [
      { name: "Xuất khẩu", value: Math.round(xkTotal) },
      { name: "Nhập khẩu", value: Math.round(nkTotal) },
    ],
    compare2025: [
      { name: "XK (triệu USD)", a: Math.round(value2025), b: Math.round(value2026) },
      { name: "Mặt hàng", a: TRADES.filter((t) => t.direction === "XK").length, b: TRADES.length },
    ],
    gates: TRADE_PORTS.map((g) => ({
      name: shortGateName(g),
      value: g.value2026,
      growth: g.growth,
    })),
    gateTransit: TRADE_PORTS.filter((g) => g.transit2026 > 0).map((g) => ({
      name: shortGateName(g),
      value: g.transit2026,
    })),
  };
}

function shortGateName(g: BorderGateRecord): string {
  return g.name.replace("Cửa khẩu quốc tế ", "CKQT ").replace("Cửa khẩu chính ", "CKC ");
}

// ---------------------------------------------------------------------------
// Liên kết dữ liệu với "Báo cáo & BI" (/analytics)
// ---------------------------------------------------------------------------
export const XNK_REPORT_ID = "BC-XNK-6T2026";

export function buildImportExportDataset(): ReportDataset {
  const rows = TRADES.map((t, i) => ({
    id: `R-${String(i + 1).padStart(2, "0")}`,
    cells: {
      hang_hoa: t.name,
      hs: t.hs,
      nhom: t.hsGroup ?? "—",
      huong: t.direction ?? "—",
      cua_khau: t.gate ?? "—",
      thi_truong: t.market,
      xk_2025: t.value2025 ?? 0,
      xk_2026: t.value2026 ?? t.exportValue,
      tang_giam: t.growth ?? 0,
    },
  }));
  const ds = createDraftDataset({
    name: "Báo cáo kim ngạch xuất nhập khẩu 6 tháng đầu năm 2026",
    fileName: "bao-cao-xnk-6t2026.csv",
    fileType: "MẪU",
    columns: [
      { key: "hang_hoa", header: "Hàng hóa", type: "text" },
      { key: "hs", header: "Mã HS", type: "text" },
      { key: "nhom", header: "Nhóm hàng", type: "text" },
      { key: "huong", header: "Hướng (XK/NK)", type: "text" },
      { key: "cua_khau", header: "Cửa khẩu", type: "text" },
      { key: "thi_truong", header: "Thị trường", type: "text" },
      { key: "xk_2025", header: "Giá trị 6T/2025 (triệu USD)", type: "number" },
      { key: "xk_2026", header: "Giá trị 6T/2026 (triệu USD)", type: "number" },
      { key: "tang_giam", header: "Tăng/giảm (%)", type: "percent" },
    ],
    rows,
    period: "6 tháng đầu 2026",
    year: 2026,
    quarter: "6T",
    source: "Phòng QLTM – Sở Công Thương",
    via: "sample",
    status: "approved",
  });
  ds.id = XNK_REPORT_ID;
  ds.summary = summarizeDataset(ds);
  return ds;
}

export function readBiReportCount(): number {
  return readReportDatasets().length;
}

/** Đồng bộ dữ liệu XNK vào Kho báo cáo của trang /analytics. */
export function syncImportExportToBi(): ReportDataset {
  const ds = buildImportExportDataset();
  const list = readReportDatasets().filter((d) => d.id !== XNK_REPORT_ID);
  writeReportDatasets([ds, ...list]);
  return ds;
}

export function formatTyUsd(n: number): string {
  return `${formatNumber(n, 2)} tỷ USD`;
}

export function formatTrieuUsd(n: number): string {
  return `${formatNumber(n, 0)} tr. USD`;
}

// ---------------------------------------------------------------------------
// Căn cứ pháp lý (tra cứu từ nguồn công khai)
// ---------------------------------------------------------------------------
export interface LegalBasis {
  code: string;
  title: string;
  agency: string;
  date: string;
  effective: string;
  summary: string;
  url: string;
}

export const LEGAL_BASIS: LegalBasis[] = [
  {
    code: "Luật Quản lý ngoại thương 2017",
    title: "Luật Quản lý ngoại thương số 05/2017/QH14",
    agency: "Quốc hội",
    date: "12/06/2017",
    effective: "01/01/2018",
    summary:
      "Luật nền tảng quản lý hoạt động ngoại thương: quyền tự do xuất khẩu, nhập khẩu; các biện pháp quản lý (giấy phép, điều kiện, hạn ngạch, CFS…); thương mại biên giới với nước có chung biên giới (Điều 53, 54).",
    url: "https://vanban.chinhphu.vn/",
  },
  {
    code: "Nghị định 69/2018/NĐ-CP",
    title: "Quy định chi tiết một số điều của Luật Quản lý ngoại thương",
    agency: "Chính phủ",
    date: "15/05/2018",
    effective: "15/05/2018",
    summary:
      "Chi tiết thủ tục xuất khẩu, nhập khẩu; hàng hóa cấm XNK; XNK theo giấy phép, theo điều kiện; Giấy chứng nhận lưu hành tự do (CFS, Phụ lục V); hạn ngạch thuế quan; tạm nhập – tái xuất, chuyển khẩu, quá cảnh.",
    url: "https://thuvienphapluat.vn/van-ban/Thuong-mai/Nghi-dinh-69-2018-ND-CP-huong-dan-Luat-Quan-ly-ngoai-thuong-382305.aspx",
  },
  {
    code: "Nghị định 292/2026/NĐ-CP",
    title:
      "Quy định chi tiết một số điều và biện pháp để tổ chức, hướng dẫn thi hành Luật Quản lý ngoại thương",
    agency: "Chính phủ",
    date: "22/07/2026",
    effective: "05/09/2026",
    summary:
      "Văn bản mới nhất quy định chi tiết, biện pháp thi hành Luật Quản lý ngoại thương — thay thế các quy định về tổ chức, hướng dẫn thi hành theo cơ cấu mới.",
    url: "https://congbao.chinhphu.vn/van-ban/nghi-dinh-so-292-2026-nd-cp-470149.htm",
  },
  {
    code: "Nghị định 14/2018/NĐ-CP",
    title: "Quy định chi tiết về hoạt động thương mại biên giới",
    agency: "Chính phủ",
    date: "23/01/2018",
    effective: "10/03/2018",
    summary:
      "Điều kiện đối với cửa khẩu, lối mở; cửa khẩu biên giới thực hiện mua bán, trao đổi hàng hóa của thương nhân và cư dân biên giới; chợ biên giới; trách nhiệm UBND tỉnh biên giới tổ chức quản lý, điều hành hoạt động thương mại tại cửa khẩu trên địa bàn.",
    url: "https://thuvienphapluat.vn/van-ban/thuong-mai/decree-14-2018-nd-cp-on-border-trade-397487.aspx",
  },
  {
    code: "Thông tư 12/2018/TT-BCT",
    title:
      "Quy định chi tiết một số điều của Luật QLNT và Nghị định 69/2018/NĐ-CP (hợp nhất 70/2026/VBHN-TT-BCT)",
    agency: "Bộ Công Thương",
    date: "15/06/2018",
    effective: "15/06/2018",
    summary:
      "Danh mục hàng hóa cấm nhập khẩu theo mã HS; danh mục tạm ngừng kinh doanh tạm nhập – tái xuất, chuyển khẩu; hạn ngạch thuế quan nhập khẩu; mẫu đơn, mẫu báo cáo. Hợp nhất tại văn bản 24/VBHN-BCT (30/03/2026) và 70/2026/VBHN-TT-BCT (03/08/2026).",
    url: "https://congbao.chinhphu.vn/van-ban/van-ban-hop-nhat-so-70-2026-vbhn-tt-bct-470250.htm",
  },
  {
    code: "Nghị định 01/2015/NĐ-CP + 153/2026/NĐ-CP",
    title: "Quy định chi tiết phạm vi địa bàn hoạt động hải quan (sửa đổi 2026)",
    agency: "Chính phủ",
    date: "05/07/2026",
    effective: "05/07/2026",
    summary:
      "Từ 05/07/2026, 8 cửa khẩu trên địa bàn Tây Ninh (Tà Nông, Long Phước, Phước Chỉ, Long Thuận, Cây Gõ, Tân Phú, Tống Lê Chân, Hưng Điền A) không còn thuộc địa bàn hoạt động hải quan — siết chặt quản lý, tránh khoảng trống tại khu vực cửa khẩu, biên giới.",
    url: "https://thuehaiquan.tapchikinhtetaichinh.vn/tay-ninh-khong-de-khoang-trong-trong-quan-ly-dia-ban-hai-quan-160682.html",
  },
  {
    code: "Nghị định 134/2016/NĐ-CP",
    title: "Quy định chi tiết Luật Thuế xuất khẩu, thuế nhập khẩu",
    agency: "Chính phủ",
    date: "01/09/2016",
    effective: "01/09/2016",
    summary:
      "Chính sách thuế XNK; định mức miễn thuế đối với hàng hóa mua bán, trao đổi của cư dân biên giới (Phụ lục V) — áp dụng trực tiếp cho hoạt động thương mại biên giới tại Tây Ninh.",
    url: "https://vanban.chinhphu.vn/",
  },
  {
    code: "QĐ 52/2015/QĐ-TTg",
    title: "Quản lý hoạt động thương mại biên giới với các nước có chung biên giới",
    agency: "Thủ tướng Chính phủ",
    date: "20/10/2015",
    effective: "20/10/2015",
    summary:
      "Quy chế quản lý hoạt động thương mại biên giới giai đoạn trước; hiện được thay thế, thay thế một phần bởi Nghị định 14/2018/NĐ-CP. Giữ để tham chiếu lịch sử quản lý tại các cửa khẩu Tây Ninh.",
    url: "https://vanban.chinhphu.vn/",
  },
  {
    code: "Mục tiêu XNK 2026 (Tây Ninh)",
    title: "Kế hoạch phát triển KT-XH và kim ngạch XNK năm 2026",
    agency: "UBND tỉnh Tây Ninh",
    date: "01/2026",
    effective: "2026",
    summary:
      "Năm 2025 đạt 31,4 tỷ USD (+12,7%), top 10 cả nước; mục tiêu 2026: xuất khẩu 19,6 tỷ USD (+10%), nhập khẩu 14,5 tỷ USD (+8,3%). 6T/2026 đạt 17,65 tỷ USD (+~16%), xuất khẩu đạt 50,42% kế hoạch.",
    url: "https://baotayninh.vn/dong-luc-but-pha-cho-xuat-khau-136548.html",
  },
  {
    code: "Kinh tế cửa khẩu Mộc Bài",
    title: "Khu kinh tế cửa khẩu Mộc Bài và hệ thống cửa khẩu Tây Ninh",
    agency: "UBND tỉnh Tây Ninh",
    date: "2026",
    effective: "2026",
    summary:
      "Đường biên giới 369 km, 4 cửa khẩu quốc tế (Mộc Bài, Xa Mát, Tân Nam, Bình Hiệp), 4 cửa khẩu chính, 13 cửa khẩu phụ. 6T/2026 thu phí hạ tầng 326 tỷ đồng (+56%); quá cảnh qua Mộc Bài 2,26 tỷ USD. Định hướng cửa khẩu số, trung tâm logistics khu vực.",
    url: "https://baotayninh.vn/dau-tu-ha-tang-cua-khau-tay-ninh-mo-rong-khong-gian-giao-thuong-quoc-te-152094.html",
  },
  {
    code: "Thương mại VN – Campuchia",
    title: "Hiệp định thương mại biên giới Việt Nam – Campuchia",
    agency: "Chính phủ hai nước",
    date: "2016",
    effective: "2016",
    summary:
      "Khuôn khổ hợp tác thương mại biên giới; mục tiêu đưa kim ngạch thương mại song phương Việt Nam – Campuchia lên 20 tỷ USD vào năm 2030 — động lực cho hệ thống cửa khẩu Tây Ninh.",
    url: "https://otttayninh.mediatech.vn/xuat-nhap-khau-but-pha-tao-da-tang-truong-hai-con-so-152016.html",
  },
];
