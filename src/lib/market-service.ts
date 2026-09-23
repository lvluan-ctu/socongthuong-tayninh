// ============================================================
// SERVICE LAYER — THỊ TRƯỜNG & SẢN PHẨM.
// Tính KPI, dữ liệu biểu đồ, dự báo giá (deterministic) từ
// MARKET_PRICE_INDEX, và liên kết dữ liệu với trang "Báo cáo & BI"
// (/analytics) thông qua Kho báo cáo (localStorage sct.report.datasets).
// ============================================================
import {
  MARKET_ALERTS,
  MARKET_EXPORT_MARKETS,
  MARKET_PRICE_INDEX,
  MARKET_PRODUCTS,
} from "@/data/market-mock";
import type { MarketPriceRow, ReportDataset } from "@/lib/types";
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
export interface MarketKpis {
  products: number; // số sản phẩm chủ lực theo dõi
  groups: number; // số nhóm hàng
  facilities: number; // tổng cơ sở SXKD
  retail6T: string; // tổng mức bán lẻ 6T/2026
  retailGrowth: number; // % tăng so cùng kỳ
  export5T: string; // kim ngạch XK 5T/2026
  exportGrowth: number; // % tăng so cùng kỳ
  surplus: string; // xuất siêu
  priceRisers: number; // số nhóm tăng giá tháng gần nhất
  priceFallers: number; // số nhóm giảm giá tháng gần nhất
  alertCount: number;
}

export function computeMarketKpis(): MarketKpis {
  const groups = new Set(MARKET_PRODUCTS.map((p) => p.group));
  const facilities = MARKET_PRODUCTS.reduce((s, p) => s + (p.facilities ?? 0), 0);
  const last = MARKET_PRICE_INDEX[MARKET_PRICE_INDEX.length - 1];
  const prev = MARKET_PRICE_INDEX[MARKET_PRICE_INDEX.length - 2];
  let risers = 0;
  let fallers = 0;
  if (last && prev) {
    for (const key of ["caoSu", "duong", "nongSan", "detMay", "coKhi"] as const) {
      const d = (last[key] - prev[key]) / prev[key];
      if (d > 0.001) risers += 1;
      else if (d < -0.001) fallers += 1;
    }
  }
  return {
    products: MARKET_PRODUCTS.length,
    groups: groups.size,
    facilities,
    retail6T: "1,54 tỷ USD",
    retailGrowth: 22.35,
    export5T: "8,13 tỷ USD",
    exportGrowth: 16.1,
    surplus: "1,73 tỷ USD",
    priceRisers: risers,
    priceFallers: fallers,
    alertCount: MARKET_ALERTS.length,
  };
}

export function buildExportMarketChart(): { name: string; value: number }[] {
  return MARKET_EXPORT_MARKETS.map((m) => ({ name: m.name, value: m.valueBilUsd }));
}

// ---------------------------------------------------------------------------
// AI phân tích & dự báo giá
// Dự báo deterministic (hồi quy tuyến tính + sóng mùa vụ) trên chuỗi chỉ số
// giá theo nhóm hàng. Chỉ mang tính minh họa, không phải model thật.
// ---------------------------------------------------------------------------
export type MarketForecastHorizon = "Quý" | "6 tháng" | "1 năm";

const HORIZON_N: Record<MarketForecastHorizon, number> = { Quý: 3, "6 tháng": 6, "1 năm": 12 };

/** Ngưỡng tham chiếu: CPI bình quân tăng ~4%/năm (chỉ số 104). */
export const MARKET_CPI_THRESHOLD = 104;

export const PRICE_GROUP_KEYS = ["caoSu", "duong", "nongSan", "detMay", "coKhi"] as const;
export const PRICE_GROUP_LABEL: Record<(typeof PRICE_GROUP_KEYS)[number], string> = {
  caoSu: "Cao su",
  duong: "Đường – tinh bột",
  nongSan: "Nông sản chế biến",
  detMay: "Dệt may",
  coKhi: "Cơ khí – điện tử",
};

export interface MarketForecastPoint {
  period: string;
  actual?: number; // chỉ số bình quân thực tế
  forecast?: number; // chỉ số bình quân dự báo
  threshold: number;
}

export interface MarketGroupChange {
  group: string;
  current: number; // chỉ số hiện tại của nhóm
  forecast: number; // chỉ số dự báo cuối kỳ của nhóm
  changePct: number; // % dự báo cuối kỳ so hiện tại
}

export interface MarketForecast {
  horizon: MarketForecastHorizon;
  points: MarketForecastPoint[];
  currentIndex: number; // chỉ số bình quân hiện tại
  forecastEnd: number; // chỉ số bình quân cuối kỳ dự báo
  growthAnnualPct: number; // tăng trưởng bình quân %/năm
  risers: MarketGroupChange[];
  fallers: MarketGroupChange[];
  insights: string;
  recommendations: string[];
}

function ols(values: number[]): { slope: number; intercept: number } {
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
  return den === 0
    ? { slope: 0, intercept: yMean }
    : { slope: num / den, intercept: yMean - (num / den) * xMean };
}

const GROUP_AMPLITUDE: Record<(typeof PRICE_GROUP_KEYS)[number], number> = {
  caoSu: 2.2,
  duong: 1.0,
  nongSan: 1.6,
  detMay: 0.8,
  coKhi: 1.4,
};

function avgRow(row: MarketPriceRow): number {
  return PRICE_GROUP_KEYS.reduce((s, k) => s + row[k], 0) / PRICE_GROUP_KEYS.length;
}

function nextPeriodLabel(n: number, offset: number): string {
  const lastMonth = 6; // T6/2026 — tháng gần nhất của chuỗi
  const month = (lastMonth + offset - 1) % 12; // 0-based
  const year = lastMonth + offset > 12 ? 2027 : 2026;
  return `T${month + 1}/${String(year).slice(2)}`;
}

export function computeMarketForecast(horizon: MarketForecastHorizon): MarketForecast {
  const n = MARKET_PRICE_INDEX.length;
  const count = HORIZON_N[horizon];
  const avgActual = MARKET_PRICE_INDEX.map(avgRow);

  const groupModels = PRICE_GROUP_KEYS.map((key) => {
    const values = MARKET_PRICE_INDEX.map((r) => r[key]);
    return { key, ...ols(values) };
  });

  const perGroupForecast = groupModels.map((m) => {
    const out: number[] = [];
    for (let j = 1; j <= count; j++) {
      const wave = Math.sin((n + j) * 0.6) * GROUP_AMPLITUDE[m.key];
      out.push(Math.max(0, Number((m.intercept + m.slope * (n + j) + wave).toFixed(1))));
    }
    return { key: m.key, values: out };
  });

  const points: MarketForecastPoint[] = [];
  const historyStart = Math.max(0, n - 10);
  for (let i = historyStart; i < n; i++) {
    points.push({
      period: MARKET_PRICE_INDEX[i]!.period,
      actual: Number(avgActual[i]!.toFixed(1)),
      threshold: MARKET_CPI_THRESHOLD,
    });
  }
  for (let j = 0; j < count; j++) {
    const avg = perGroupForecast.reduce((s, g) => s + g.values[j]!, 0) / perGroupForecast.length;
    points.push({
      period: nextPeriodLabel(n, j + 1),
      forecast: Number(avg.toFixed(1)),
      threshold: MARKET_CPI_THRESHOLD,
    });
  }

  const currentIndex = avgActual[n - 1]!;
  const forecastEnd =
    points.filter((p) => p.forecast !== undefined).pop()?.forecast ?? currentIndex;
  const growthAnnualPct = (avgActual[n - 1]! / avgActual[n - 13]! - 1) * 100;

  const lastRow = MARKET_PRICE_INDEX[n - 1]!;
  const changes: MarketGroupChange[] = groupModels.map((m) => {
    const current = lastRow[m.key];
    const end = perGroupForecast.find((g) => g.key === m.key)!.values[count - 1]!;
    return {
      group: PRICE_GROUP_LABEL[m.key],
      current: Number(current.toFixed(1)),
      forecast: Number(end.toFixed(1)),
      changePct: ((end - current) / current) * 100,
    };
  });
  const risers = [...changes]
    .filter((c) => c.changePct >= 0)
    .sort((a, b) => b.changePct - a.changePct);
  const fallers = [...changes]
    .filter((c) => c.changePct < 0)
    .sort((a, b) => a.changePct - b.changePct);

  const topRiser = risers[0];
  const insights =
    `Chỉ số giá bình quân 5 nhóm hàng đạt ${currentIndex.toFixed(1)} điểm (gốc 100 tại T1/2025), ` +
    `tương đương mức tăng ~${(currentIndex - 100).toFixed(1)}% trong 18 tháng. ` +
    `Dự báo đạt ${forecastEnd.toFixed(1)} điểm vào cuối kỳ ${horizon.toLowerCase()} ` +
    `(tăng trưởng bình quân khoảng ${growthAnnualPct.toFixed(1)}%/năm), ` +
    `chủ yếu do giá cao su và cơ khí – điện tử dẫn dắt.` +
    (topRiser
      ? ` Nhóm tăng mạnh nhất dự kiến là ${topRiser.group} (+${topRiser.changePct.toFixed(1)}%).`
      : "");

  const recommendations = [
    "Bám sát diễn biến giá cao su và cơ khí – điện tử để điều tiết tồn kho, ký hợp đồng dài hạn khi giá thuận lợi.",
    "Với các nhóm tăng giá nhanh (cao su, cơ khí – điện tử): rà soát chi phí nguyên liệu, hỗ trợ doanh nghiệp kết nối đơn hàng xuất khẩu.",
    "Với nhóm tăng chậm/giảm (dệt may, nông sản chế biến): tăng cường xúc tiến thương mại, đa dạng hóa thị trường, tránh phụ thuộc một thị trường.",
    "Phối hợp Ban chỉ đạo chống buôn lậu, gian lận thương mại và quản lý thị trường để bảo đảm giá hàng thiết yếu ổn định.",
  ];

  return {
    horizon,
    points,
    currentIndex,
    forecastEnd,
    growthAnnualPct,
    risers,
    fallers,
    insights,
    recommendations,
  };
}

// ---------------------------------------------------------------------------
// Căn cứ pháp lý
// ---------------------------------------------------------------------------
export interface MarketLegalBasis {
  code: string;
  title: string;
  agency: string;
  date: string;
  effective: string;
  summary: string;
  url: string;
}

export const MARKET_LEGAL_BASIS: MarketLegalBasis[] = [
  {
    code: "Luật Thương mại 2005",
    title: "Luật Thương mại số 36/2005/QH11",
    agency: "Quốc hội",
    date: "14/06/2005",
    effective: "01/01/2006",
    summary:
      "Quy định hoạt động thương mại: mua bán hàng hóa, dịch vụ, xúc tiến thương mại, quản lý nhà nước về hoạt động thương mại — nền tảng pháp lý cho công tác quản lý thị trường của Sở Công Thương.",
    url: "https://vanban.chinhphu.vn/",
  },
  {
    code: "Luật Quản lý ngoại thương 2017",
    title: "Luật Quản lý ngoại thương số 05/2017/QH14",
    agency: "Quốc hội",
    date: "12/06/2017",
    effective: "01/01/2018",
    summary:
      "Quy định biện pháp quản lý ngoại thương: xuất khẩu, nhập khẩu, tạm nhập – tái xuất, quá cảnh, các biện pháp phòng vệ thương mại và phát triển ngoại thương.",
    url: "https://vanban.chinhphu.vn/",
  },
  {
    code: "Nghị định 69/2018/NĐ-CP",
    title: "Quy định chi tiết một số điều của Luật Quản lý ngoại thương",
    agency: "Chính phủ",
    date: "15/05/2018",
    effective: "15/07/2018",
    summary:
      "Hướng dẫn quyền xuất nhập khẩu, các thủ tục về tạm nhập – tái xuất, chuyển khẩu, kho ngoại quan; thương mại biên giới giữa Việt Nam – Campuchia qua cửa khẩu Mộc Bài, Xa Mát.",
    url: "https://vanban.chinhphu.vn/",
  },
  {
    code: "Nghị định 94/2017/NĐ-CP",
    title: "Quy định về hàng hóa, dịch vụ cấm kinh doanh, hạn chế kinh doanh",
    agency: "Chính phủ",
    date: "17/08/2017",
    effective: "10/10/2017",
    summary:
      "Ban hành danh mục hàng hóa, dịch vụ cấm kinh doanh, hạn chế kinh doanh và điều kiện kinh doanh — căn cứ kiểm tra, kiểm soát thị trường của lực lượng Quản lý thị trường.",
    url: "https://vanban.chinhphu.vn/",
  },
  {
    code: "Nghị định 98/2020/NĐ-CP",
    title: "Xử phạt vi phạm hành chính trong hoạt động thương mại, sản xuất, buôn bán hàng giả",
    agency: "Chính phủ",
    date: "26/08/2020",
    effective: "15/10/2020",
    summary:
      "Quy định mức xử phạt đối với hành vi kinh doanh hàng hóa nhập lậu, hàng giả, vi phạm giá, hóa đơn chứng từ — nghiệp vụ của Cục Quản lý thị trường trên địa bàn.",
    url: "https://vanban.chinhphu.vn/",
  },
  {
    code: "Nghị định 109/2018/NĐ-CP",
    title: "Quy định về kinh doanh xăng dầu",
    agency: "Chính phủ",
    date: "20/08/2018",
    effective: "01/11/2018",
    summary:
      "Quy định điều kiện kinh doanh, quyền và nghĩa vụ của thương nhân kinh doanh xăng dầu; cơ chế giá, bảo đảm nguồn cung xăng dầu cho sản xuất và dân sinh.",
    url: "https://vanban.chinhphu.vn/",
  },
  {
    code: "Luật Giá 2023",
    title: "Luật Giá số 16/2023/QH15",
    agency: "Quốc hội",
    date: "19/06/2023",
    effective: "01/07/2024",
    summary:
      "Quy định về giá, thẩm định giá, biện pháp bình ổn giá đối với hàng hóa, dịch vụ thiết yếu — căn cứ Sở Công Thương tham mưu UBND tỉnh các giải pháp bình ổn thị trường.",
    url: "https://vanban.chinhphu.vn/",
  },
  {
    code: "Nghị định 85/2021/NĐ-CP",
    title: "Sửa đổi, bổ sung Nghị định 52/2013/NĐ-CP về thương mại điện tử",
    agency: "Chính phủ",
    date: "25/09/2021",
    effective: "01/01/2022",
    summary:
      "Cập nhật quy định quản lý website thương mại điện tử, ứng dụng bán hàng, sàn giao dịch TMĐT — cơ sở quản lý thị trường số, kênh phân phối hiện đại.",
    url: "https://vanban.chinhphu.vn/",
  },
  {
    code: "Quyết định 1163/QĐ-TTg",
    title: "Phê duyệt Đề án phát triển thị trường trong nước giai đoạn 2021 – 2025",
    agency: "Thủ tướng Chính phủ",
    date: "13/07/2021",
    effective: "2021",
    summary:
      "Định hướng phát triển thị trường trong nước: đẩy mạnh cuộc vận động 'Người Việt Nam ưu tiên dùng hàng Việt Nam', phát triển phân phối hiện đại, bảo vệ quyền lợi người tiêu dùng.",
    url: "https://vanban.chinhphu.vn/",
  },
  {
    code: "Báo cáo thị trường 6T/2026",
    title: "Tình hình thị trường, giá cả 6 tháng đầu năm 2026 – Sở Công Thương Tây Ninh",
    agency: "Sở Công Thương Tây Ninh",
    date: "07/2026",
    effective: "2026",
    summary:
      "Thị trường hàng hóa thiết yếu duy trì ổn định; tổng mức bán lẻ 6 tháng ước đạt 1,54 tỷ USD, tăng 22,35% so cùng kỳ; không xảy ra thiếu hàng, sốt giá; kim ngạch XK 5 tháng đạt 8,13 tỷ USD, giữ vững xuất siêu 1,73 tỷ USD.",
    url: "https://sct.tayninh.gov.vn/thuong-mai",
  },
];

// ---------------------------------------------------------------------------
// Liên kết dữ liệu với "Báo cáo & BI" (/analytics)
// ---------------------------------------------------------------------------
export const MARKET_REPORT_ID = "BC-TT-6T2026";

export function buildMarketDataset(): ReportDataset {
  const rows = MARKET_PRODUCTS.map((p, i) => ({
    id: `TT-${String(i + 1).padStart(2, "0")}`,
    cells: {
      san_pham: p.name,
      nhom: p.group,
      san_luong: p.output ?? 0,
      don_gia: p.price ?? 0,
      thi_truong: p.market,
      tieu_chuan: p.standard,
      chung_nhan: p.certificate,
      bien_dong: p.trend,
      trang_thai: p.status,
    },
  }));
  const ds = createDraftDataset({
    name: "Báo cáo diễn biến thị trường và giá cả 6 tháng đầu năm 2026",
    fileName: "bao-cao-thi-truong-6t2026.csv",
    fileType: "MẪU",
    columns: [
      { key: "san_pham", header: "Sản phẩm", type: "text" },
      { key: "nhom", header: "Nhóm hàng", type: "text" },
      { key: "san_luong", header: "Sản lượng", type: "number" },
      { key: "don_gia", header: "Đơn giá tham chiếu (USD)", type: "number" },
      { key: "thi_truong", header: "Thị trường", type: "text" },
      { key: "tieu_chuan", header: "Tiêu chuẩn", type: "text" },
      { key: "chung_nhan", header: "Chứng nhận", type: "text" },
      { key: "bien_dong", header: "Biến động (%)", type: "percent" },
      { key: "trang_thai", header: "Trạng thái", type: "text" },
    ],
    rows,
    period: "6 tháng đầu 2026",
    year: 2026,
    quarter: "6T",
    source: "Phòng Quản lý Thương mại",
    via: "sample",
    status: "approved",
  });
  ds.id = MARKET_REPORT_ID;
  ds.summary = summarizeDataset(ds);
  return ds;
}

export function readBiReportCount(): number {
  return readReportDatasets().length;
}

/** Đồng bộ dữ liệu thị trường vào Kho báo cáo của trang /analytics. */
export function syncMarketToBi(): ReportDataset {
  const ds = buildMarketDataset();
  const list = readReportDatasets().filter((d) => d.id !== MARKET_REPORT_ID);
  writeReportDatasets([ds, ...list]);
  return ds;
}

export function formatPrice(n: number): string {
  return formatNumber(n, 1);
}
