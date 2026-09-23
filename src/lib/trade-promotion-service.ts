// ============================================================
// SERVICE LAYER — XÚC TIẾN THƯƠNG MẠI (XTTM).
// Tính KPI, dữ liệu biểu đồ từ PROMOTIONS, và liên kết dữ liệu
// với trang "Báo cáo & BI" (/analytics) thông qua Kho báo cáo
// (localStorage sct.report.datasets).
// ============================================================
import { PROMOTIONS } from "@/data/mock";
import type { PromotionProgram, ReportDataset } from "@/lib/types";
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
export interface TradePromotionKpis {
  countYear: number;
  count2025: number;
  count2026: number;
  totalBudget: number;
  budget2025: number;
  budget2026: number;
  totalEnterprises: number;
  enterprises2025: number;
  enterprises2026: number;
  ongoing: number;
  growthPrograms: number; // tăng/giảm số chương trình 2026 so 2025
  growthBudget: number; // tăng/giảm kinh phí 2026 so 2025
  topMarket: string;
}

export function computeTradePromotionKpis(): TradePromotionKpis {
  const in2025 = PROMOTIONS.filter((p) => p.year === 2025);
  const in2026 = PROMOTIONS.filter((p) => p.year === 2026);
  const ongoing = PROMOTIONS.filter((p) => p.status === "pending").length;
  const sum = (arr: PromotionProgram[], f: (p: PromotionProgram) => number) =>
    arr.reduce((s, p) => s + (Number.isFinite(f(p)) ? f(p) : 0), 0);
  const marketCount = new Map<string, number>();
  PROMOTIONS.forEach((p) => {
    const m = p.market ?? "Chưa xác định";
    marketCount.set(m, (marketCount.get(m) ?? 0) + 1);
  });
  const topMarket = [...marketCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const growth = (cur: number, prev: number) =>
    prev ? Math.round(((cur - prev) / prev) * 1000) / 10 : 0;
  return {
    countYear: in2026.length,
    count2025: in2025.length,
    count2026: in2026.length,
    totalBudget: sum(PROMOTIONS, (p) => p.budget),
    budget2025: sum(in2025, (p) => p.budget),
    budget2026: sum(in2026, (p) => p.budget),
    totalEnterprises: sum(PROMOTIONS, (p) => p.enterprises),
    enterprises2025: sum(in2025, (p) => p.enterprises),
    enterprises2026: sum(in2026, (p) => p.enterprises),
    ongoing,
    growthPrograms: growth(in2026.length, in2025.length),
    growthBudget: growth(
      sum(in2026, (p) => p.budget),
      sum(in2025, (p) => p.budget),
    ),
    topMarket,
  };
}

export interface TradePromotionChartData {
  budgetByKind: { name: string; value: number }[];
  enterprisesByKind: { name: string; value: number }[];
  compare2025: { name: string; a: number; b: number }[];
  fundSource: { name: string; value: number }[];
  byMarket: { name: string; value: number }[];
}

export function buildTradePromotionChartData(): TradePromotionChartData {
  const byKind = (f: (p: PromotionProgram) => number) => {
    const map = new Map<string, number>();
    PROMOTIONS.forEach((p) => map.set(p.kind, (map.get(p.kind) ?? 0) + f(p)));
    return [...map.entries()]
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  };
  const byYear = (f: (p: PromotionProgram) => number) => ({
    a: Math.round(PROMOTIONS.filter((p) => p.year === 2025).reduce((s, p) => s + f(p), 0)),
    b: Math.round(PROMOTIONS.filter((p) => p.year === 2026).reduce((s, p) => s + f(p), 0)),
  });
  const budget2025 = byYear((p) => p.budget);
  const ent2025 = byYear((p) => p.enterprises);
  const fund = new Map<string, number>();
  PROMOTIONS.forEach((p) =>
    fund.set(
      p.fundSource ?? "Chưa xác định",
      (fund.get(p.fundSource ?? "Chưa xác định") ?? 0) + p.budget,
    ),
  );
  const market = new Map<string, number>();
  PROMOTIONS.forEach((p) =>
    market.set(
      p.market ?? "Chưa xác định",
      (market.get(p.market ?? "Chưa xác định") ?? 0) + p.enterprises,
    ),
  );
  return {
    budgetByKind: byKind((p) => p.budget),
    enterprisesByKind: byKind((p) => p.enterprises),
    compare2025: [
      {
        name: "Số chương trình",
        a: PROMOTIONS.filter((p) => p.year === 2025).length,
        b: PROMOTIONS.filter((p) => p.year === 2026).length,
      },
      { name: "Kinh phí (nghìn USD)", a: budget2025.a, b: budget2025.b },
      { name: "Lượt DN", a: ent2025.a, b: ent2025.b },
    ],
    fundSource: [...fund.entries()].map(([name, value]) => ({ name, value: Math.round(value) })),
    byMarket: [...market.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
  };
}

// ---------------------------------------------------------------------------
// Liên kết dữ liệu với "Báo cáo & BI" (/analytics)
// ---------------------------------------------------------------------------
export const XTTM_REPORT_ID = "BC-XTTM-6T2026";

export function buildTradePromotionDataset(): ReportDataset {
  const k = computeTradePromotionKpis();
  const rows = PROMOTIONS.filter((p) => p.year === 2026).map((p, i) => ({
    id: `X-${String(i + 1).padStart(2, "0")}`,
    cells: {
      chuong_trinh: p.name,
      loai: p.kind,
      thoi_gian: p.quarter ?? p.time,
      thi_truong: p.market ?? "—",
      dn: p.enterprises,
      kinh_phi: p.budget,
      nguon: p.fundSource ?? "—",
    },
  }));
  const ds = createDraftDataset({
    name: "Báo cáo kết quả xúc tiến thương mại 6 tháng đầu năm 2026",
    fileName: "bao-cao-xttm-6t2026.csv",
    fileType: "MẪU",
    columns: [
      { key: "chuong_trinh", header: "Chương trình", type: "text" },
      { key: "loai", header: "Loại hình", type: "text" },
      { key: "thoi_gian", header: "Kỳ", type: "text" },
      { key: "thi_truong", header: "Thị trường", type: "text" },
      { key: "dn", header: "Lượt DN tham gia", type: "number" },
      { key: "kinh_phi", header: "Kinh phí (nghìn USD)", type: "number" },
      { key: "nguon", header: "Nguồn kinh phí", type: "text" },
    ],
    rows,
    period: "6 tháng đầu 2026",
    year: 2026,
    quarter: "6T",
    source: "Phòng Xúc tiến Thương mại",
    via: "sample",
    status: "approved",
  });
  ds.id = XTTM_REPORT_ID;
  ds.summary = summarizeDataset(ds);
  return ds;
}

export function readBiReportCount(): number {
  return readReportDatasets().length;
}

/** Đồng bộ dữ liệu XTTM vào Kho báo cáo của trang /analytics. */
export function syncTradePromotionToBi(): ReportDataset {
  const ds = buildTradePromotionDataset();
  const list = readReportDatasets().filter((d) => d.id !== XTTM_REPORT_ID);
  writeReportDatasets([ds, ...list]);
  return ds;
}

export function formatNghinUsd(n: number): string {
  return `${formatNumber(n, 0)} nghìn USD`;
}

// ---------------------------------------------------------------------------
// AI phân tích & dự báo XTTM
// Dự báo deterministic (hồi quy tuyến tính + sóng mùa vụ) trên chuỗi quý
// kinh phí & lượt DN. Chỉ mang tính minh họa, không phải model thật.
// ---------------------------------------------------------------------------
export type XttmForecastHorizon = "H2/2026" | "Năm 2027";

const XTTM_QUARTERS = [
  "Q1/25",
  "Q2/25",
  "Q3/25",
  "Q4/25",
  "Q1/26",
  "Q2/26",
  "Q3/26",
  "Q4/26",
] as const;

const XTTM_FORECAST_LABELS = ["Q3/26", "Q4/26", "Q1/27", "Q2/27", "Q3/27", "Q4/27"] as const;

const XTTM_HORIZON_N: Record<XttmForecastHorizon, number> = {
  "H2/2026": 2,
  "Năm 2027": 6,
};

export interface XttmForecastPoint {
  quarter: string;
  /** Kinh phí thực tế (nghìn USD) — chỉ có ở các quý đã có chương trình. */
  actual?: number;
  /** Kinh phí dự báo (nghìn USD). */
  forecast?: number;
}

export interface XttmForecast {
  horizon: XttmForecastHorizon;
  points: XttmForecastPoint[];
  budgetH1: number; // kinh phí 6T/2026 đã thực hiện (nghìn USD)
  budgetYear: number; // dự báo kinh phí cả năm 2026
  budget2025: number; // kinh phí cả năm 2025
  budgetPlan: number; // kế hoạch 2026 (tổng kinh phí đã bố trí)
  budgetPlanPct: number; // % đạt kế hoạch 2026 theo dự báo
  enterprisesH1: number; // lượt DN 6T/2026
  enterprisesYear: number; // dự báo lượt DN cả năm 2026
  enterprises2025: number; // lượt DN cả năm 2025
  growthBudgetPct: number; // tăng trưởng kinh phí dự báo so 2025
  growthEnterprisesPct: number; // tăng trưởng lượt DN dự báo so 2025
  quarterPlan: number; // kinh phí bình quân quý theo kế hoạch 2026
  topKind: string;
  topMarket: string;
  insights: string;
  recommendations: string[];
}

/** Gom chương trình theo quý; chương trình "Cả năm" chia đều cho 4 quý. */
function buildXttmQuarterSeries() {
  const qIndex = new Map<string, number>([
    ["2025-Q1", 0],
    ["2025-Q2", 1],
    ["2025-Q3", 2],
    ["2025-Q4", 3],
    ["2026-Q1", 4],
    ["2026-Q2", 5],
    ["2026-Q3", 6],
    ["2026-Q4", 7],
  ]);
  const budget = new Array(8).fill(0);
  const ent = new Array(8).fill(0);
  for (const p of PROMOTIONS) {
    let quarters: number[];
    if (p.quarter === "Cả năm") quarters = [1, 2, 3, 4];
    else if (p.quarter?.startsWith("Q")) {
      const q = Number(p.quarter.slice(1));
      quarters = Number.isFinite(q) && q >= 1 && q <= 4 ? [q] : [];
    } else {
      quarters = [];
    }
    const share = quarters.length ? 1 / quarters.length : 0;
    for (const q of quarters) {
      const idx = qIndex.get(`${p.year}-Q${q}`);
      if (idx === undefined) continue;
      budget[idx] += (p.budget ?? 0) * share;
      ent[idx] += (p.enterprises ?? 0) * share;
    }
  }
  return { budget, ent };
}

/** Hồi quy tuyến tính (OLS) + sóng mùa vụ, trả về `count` kỳ dự báo. */
function olsForecast(values: number[], count: number): number[] {
  const n = values.length;
  const xs = values.map((_, i) => i + 1);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - xMean) * (values[i]! - yMean);
    den += (xs[i]! - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;
  const out: number[] = [];
  for (let j = 1; j <= count; j++) {
    const wave = Math.sin((n + j) * 0.6) * 36;
    out.push(Math.max(0, Math.round(intercept + slope * (n + j) + wave)));
  }
  return out;
}

function pct(cur: number, prev: number): number {
  return prev ? Math.round((cur / prev - 1) * 100) : 0;
}

export function computeTradePromotionForecast(
  horizon: XttmForecastHorizon = "H2/2026",
): XttmForecast {
  const { budget, ent } = buildXttmQuarterSeries();
  const count = XTTM_HORIZON_N[horizon];
  const budgetFc = olsForecast(budget, count);
  const entFc = olsForecast(ent, count);

  const points: XttmForecastPoint[] = XTTM_QUARTERS.map((quarter, i) => ({
    quarter,
    actual: Math.round(budget[i] ?? 0),
  }));
  for (let j = 0; j < count; j++) {
    const value = budgetFc[j];
    if (value === undefined) continue;
    points.push({ quarter: XTTM_FORECAST_LABELS[j]!, forecast: value });
  }

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const budgetH1 = sum(budget.slice(0, 4));
  const budgetH2 = sum(budgetFc.slice(0, 2));
  const enterprisesH1 = sum(ent.slice(0, 4));
  const enterprisesH2 = sum(entFc.slice(0, 2));
  const budget2025 = sum(budget.slice(0, 4));
  const enterprises2025 = sum(ent.slice(0, 4));
  const budgetPlan = sum(budget.slice(4, 8));
  const budgetYear = budgetH1 + budgetH2;
  const enterprisesYear = enterprisesH1 + enterprisesH2;

  const in2026 = PROMOTIONS.filter((p) => p.year === 2026);
  const byKind = new Map<string, number>();
  const byMarket = new Map<string, number>();
  in2026.forEach((p) => {
    byKind.set(p.kind, (byKind.get(p.kind) ?? 0) + (p.budget ?? 0));
    byMarket.set(p.market ?? "—", (byMarket.get(p.market ?? "—") ?? 0) + (p.enterprises ?? 0));
  });
  const topKind = [...byKind.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const topMarket = [...byMarket.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  const insights = `6 tháng đầu năm 2026 đã thực hiện ${formatNumber(budgetH1, 0)} nghìn USD kinh phí XTTM (đạt ${formatNumber((budgetH1 / budgetPlan) * 100, 0)}% kế hoạch năm). Với đà tăng trưởng hiện tại, dự báo cả năm 2026 đạt ${formatNumber(budgetYear, 0)} nghìn USD — tăng ${pct(budgetYear, budget2025)}% so năm 2025 và đạt ${formatNumber((budgetYear / budgetPlan) * 100, 0)}% kế hoạch; lượt doanh nghiệp dự kiến ${formatNumber(enterprisesYear, 0)} lượt (tăng ${pct(enterprisesYear, enterprises2025)}%).`;

  const recommendations = [
    `Ưu tiên các chương trình loại hình "${topKind}" và kết nối giao thương quốc tế trong quý III–IV/2026, đặc biệt các hội chợ cuối năm (mùa vụ Q4/2025 đạt ${formatNumber(budget[3] ?? 0, 0)} nghìn USD).`,
    `Thị trường tiềm năng hiện tại là "${topMarket}" — mở rộng thêm đoàn giao thương, triển lãm tại EU, Nhật Bản, Campuchia để đa dạng hóa.`,
    budgetYear > budgetPlan
      ? `Dự báo kinh phí vượt kế hoạch ${formatNumber(budgetYear - budgetPlan, 0)} nghìn USD — cân nhắc đăng ký bổ sung chương trình hoặc điều chuyển nguồn để tối ưu giải ngân.`
      : `Dự báo kinh phí chưa đạt kế hoạch (${formatNumber(budgetYear, 0)}/${formatNumber(budgetPlan, 0)} nghìn USD) — đề xuất bố trí thêm chương trình quý IV.`,
    "Theo dõi tiến độ giải ngân theo quý và đối chiếu với kế hoạch năm để kịp thời điều chỉnh danh mục chương trình.",
  ];

  return {
    horizon,
    points,
    budgetH1,
    budgetYear,
    budget2025,
    budgetPlan,
    budgetPlanPct: (budgetYear / budgetPlan) * 100,
    enterprisesH1,
    enterprisesYear,
    enterprises2025,
    growthBudgetPct: pct(budgetYear, budget2025),
    growthEnterprisesPct: pct(enterprisesYear, enterprises2025),
    quarterPlan: budgetPlan / 4,
    topKind,
    topMarket,
    insights,
    recommendations,
  };
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
    code: "Luật Thương mại 2005",
    title: "Luật Thương mại số 36/2005/QH11",
    agency: "Quốc hội",
    date: "14/06/2005",
    effective: "01/01/2006",
    summary:
      "Quy định hoạt động thương mại trong đó có xúc tiến thương mại (khuyến mại, hội chợ, triển lãm thương mại) — nền tảng pháp lý cơ bản cho công tác XTTM của Sở Công Thương.",
    url: "https://vanban.chinhphu.vn/",
  },
  {
    code: "Nghị định 81/2018/NĐ-CP",
    title: "Quy định chi tiết Luật Thương mại về hoạt động xúc tiến thương mại",
    agency: "Chính phủ",
    date: "22/05/2018",
    effective: "15/07/2018",
    summary:
      "Hướng dẫn khuyến mại (hạn mức tối đa 100% cho khuyến mại tập trung tại Điều 6, Điều 7) và hội chợ, triển lãm thương mại (Điều 25–31); kèm các mẫu 01–14 về đăng ký, báo cáo, công khai kết quả. Thay thế Nghị định 37/2006/NĐ-CP.",
    url: "https://vanban.chinhphu.vn/?docid=193772&pageid=27160",
  },
  {
    code: "Nghị định 28/2018/NĐ-CP",
    title:
      "Quy định chi tiết Luật Quản lý ngoại thương về một số biện pháp phát triển ngoại thương",
    agency: "Chính phủ",
    date: "01/03/2018",
    effective: "01/05/2018",
    summary:
      "Quy định các biện pháp phát triển ngoại thương, xúc tiến thương mại, thương hiệu ngành hàng; được sửa đổi, bổ sung bởi Nghị định 14/2024/NĐ-CP và Nghị định 230/2026/NĐ-CP (hiệu lực 25/06/2026).",
    url: "https://thuvienphapluat.vn/",
  },
  {
    code: "Nghị định 230/2026/NĐ-CP",
    title: "Sửa đổi, bổ sung một số điều của Nghị định 28/2018/NĐ-CP về phát triển ngoại thương",
    agency: "Chính phủ",
    date: "25/06/2026",
    effective: "25/06/2026",
    summary:
      "Cập nhật quy trình xây dựng đề án Chương trình cấp quốc gia về xúc tiến thương mại (hồ sơ, mẫu 10–11, gửi trực tuyến qua Cổng DVCQG) và Chương trình xây dựng, phát triển thương hiệu ngành hàng Việt Nam.",
    url: "https://www.vietnam.vn/chinh-phu-sua-doi-quy-dinh-ve-chuong-trinh-xuc-tien-thuong-mai-cap-quoc-gia",
  },
  {
    code: "Quyết định 72/2010/QĐ-TTg",
    title: "Quy chế xây dựng, quản lý và thực hiện Chương trình xúc tiến thương mại quốc gia",
    agency: "Thủ tướng Chính phủ",
    date: "15/11/2010",
    effective: "01/01/2011",
    summary:
      "Quy chế khung quản lý Chương trình cấp quốc gia về xúc tiến thương mại: mục tiêu, nội dung (ngoại thương, thị trường trong nước, miền núi – biên giới – hải đảo), cơ quan quản lý, kinh phí.",
    url: "https://vanban.chinhphu.vn/",
  },
  {
    code: "Quyết định 12/2019/QĐ-TTg",
    title: "Sửa đổi, bổ sung Quy chế Chương trình xúc tiến thương mại quốc gia",
    agency: "Thủ tướng Chính phủ",
    date: "26/02/2019",
    effective: "15/04/2019",
    summary:
      "Sửa đổi, bổ sung quy chế; đổi tên gọi thành 'Chương trình cấp quốc gia về xúc tiến thương mại'. Cùng với QĐ 72/2010/QĐ-TTg được hợp nhất tại văn bản 56/VBHN-BCT (01/07/2026).",
    url: "https://vanban.chinhphu.vn/",
  },
  {
    code: "Quyết định 3838/QĐ-BCT",
    title: "Phê duyệt Chương trình cấp quốc gia về xúc tiến thương mại năm 2026",
    agency: "Bộ Công Thương",
    date: "31/12/2025",
    effective: "31/12/2025",
    summary:
      "Phê duyệt danh mục đề án thuộc Chương trình cấp quốc gia về xúc tiến thương mại năm 2026: hội chợ, triển lãm quốc tế, đoàn giao dịch, kết nối giao thương, xây dựng cơ sở dữ liệu thị trường, đào tạo năng lực XTTM số.",
    url: "https://vietnam24h.com.vn/bo-cong-thuong-phe-duyet-chuong-trinh-cap-quoc-gia-ve-xuc-tien-thuong-mai-nam-2026.html",
  },
  {
    code: "Quyết định 3733/QĐ-BCT",
    title: "Kế hoạch hoạt động xúc tiến thương mại giai đoạn 2026 – 2030",
    agency: "Bộ Công Thương",
    date: "24/12/2025",
    effective: "24/12/2025",
    summary:
      "Định hướng XTTM 5 năm: tăng trưởng xuất khẩu 5–6%/năm; tỷ trọng hàng chế biến, chế tạo đạt 90%; 100% cơ quan XTTM cấp tỉnh đạt TPCI ≥ 75/100; xây dựng Hệ sinh thái xúc tiến thương mại số quốc gia.",
    url: "https://tapchicongthuong.vn/bo-cong-thuong-phe-duyet-ke-hoach-hoat-dong-xuc-tien-thuong-mai-giai-doan-2026-2030-386028.htm",
  },
  {
    code: "Quyết định 626/QĐ-TTg",
    title: "Chương trình 'Vươn ra thị trường quốc tế giai đoạn 2026–2030' (GoGlobal)",
    agency: "Thủ tướng Chính phủ",
    date: "06/04/2026",
    effective: "06/04/2026",
    summary:
      "Phê duyệt Chương trình GoGlobal; Bộ Công Thương triển khai qua Quyết định 1406/QĐ-BCT ngày 12/06/2026, Cục Xúc tiến thương mại làm đầu mối, đánh giá hàng năm theo bộ chỉ số GoGlobal Index.",
    url: "https://moit.gov.vn/tin-tuc/bo-cong-thuong-ban-hanh-chuong-trinh-hanh-dong-trien-khai-chuong-trinh-vuon-ra-thi-truong-quoc-te-giai-doan-2026-2030-.html",
  },
  {
    code: "Chương trình XTTM Tây Ninh 2026–2030",
    title: "Chương trình xúc tiến thương mại trên địa bàn tỉnh Tây Ninh giai đoạn 2026–2030",
    agency: "UBND tỉnh Tây Ninh",
    date: "03/2026",
    effective: "2026",
    summary:
      "Tổng kinh phí dự kiến 77,5 tỉ đồng; mục tiêu hỗ trợ trên 5.000 lượt doanh nghiệp tìm kiếm thị trường, tổ chức ít nhất 3 hội chợ triển lãm, hơn 120 sự kiện kết nối giao thương, khoảng 25 chương trình XTTM ở nước ngoài; Sở Công Thương chủ trì triển khai.",
    url: "https://baotayninh.vn/tay-ninh-dau-tu-77-5-ti-dong-ho-tro-doanh-nghiep-mo-rong-thi-truong-141537.html",
  },
  {
    code: "Số liệu thực hiện 2025",
    title: "Kết quả xúc tiến thương mại năm 2025 – Sở Công Thương Tây Ninh",
    agency: "Sở Công Thương Tây Ninh",
    date: "02/2026",
    effective: "2025",
    summary:
      "Tây Ninh xây dựng và triển khai 47 kế hoạch xúc tiến thương mại với tổng kinh phí hỗ trợ 5,5 tỉ đồng, đạt 100% kế hoạch; hơn 1.000 lượt doanh nghiệp được hỗ trợ tham gia hội chợ, triển lãm, kết nối giao thương trong và ngoài nước.",
    url: "https://congthuong.vn/tay-ninh-xuc-tien-thuong-mai-di-vao-thuc-chat-hieu-qua-443744.html",
  },
  {
    code: "Số liệu 5 tháng 2026",
    title: "5 tháng đầu năm 2026: hỗ trợ gần 20 chương trình xúc tiến thương mại",
    agency: "Sở Công Thương Tây Ninh",
    date: "26/05/2026",
    effective: "2026",
    summary:
      "Tây Ninh hỗ trợ hơn 170 lượt doanh nghiệp tham gia gần 20 chương trình xúc tiến thương mại, tổng kinh phí thực hiện hơn 3,5 tỉ đồng; trong đó 120 lượt DN tham gia 8 sự kiện (kinh phí hơn 1,1 tỉ đồng), hơn 30 lượt DN tham gia Hội chợ Mùa Xuân (kinh phí hơn 2,3 tỉ đồng).",
    url: "https://baotayninh.vn/5-thang-dau-nam-2026-tay-ninh-ho-tro-doanh-nghiep-tham-gia-gan-20-chuong-trinh-xuc-tien-thuong-mai-147642.html",
  },
];
