// ============================================================
// ENGINE DỰ BÁO AI (DEMO) — NHIỆM VỤ 1
// Minh hoạ phương pháp "hồi quy tuyến tính + phân rã mùa vụ"
// trên chuỗi lịch sử tải (GRID_LOAD_HISTORY), sau đó hiệu chỉnh
// bởi dữ liệu GIS (vùng phụ tải/cấp điện) và thống kê lưới
// (quá tải, tổn thất, suất sự cố). Kết quả deterministic để
// mọi ô AI có thể giải thích được. KHÔNG phải model thật.
// ============================================================
import {
  GRID_LOAD_AREAS,
  GRID_LOAD_HISTORY,
  GRID_POWER_LINES,
  GRID_SUBSTATIONS,
} from "@/data/grid-mock";
import { GRID_CONFIG } from "@/lib/grid-types";
import type {
  AiForecastPoint,
  AiForecastResult,
  FactorContribution,
  ForecastHorizon,
  GridEntityType,
} from "@/lib/grid-types";

const PERIODS = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];

const HORIZON_META: Record<ForecastHorizon, { label: string; n: number }> = {
  "7 ngày": { label: "D", n: 7 },
  "1 tháng": { label: "W", n: 4 },
  Quý: { label: "Q", n: 3 },
  "1 năm": { label: "M", n: 12 },
};

function periodIndex(p: string): number {
  const i = PERIODS.indexOf(p);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

/** Hồi quy tuyến tính y = a.x + b (OLS) trên các giá trị tuần tự. */
function linearRegression(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  const xs = values.map((_, i) => i + 1);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - xMean) * (values[i]! - yMean);
    den += (xs[i]! - xMean) ** 2;
  }
  return {
    slope: den === 0 ? 0 : num / den,
    intercept: yMean - (den === 0 ? 0 : num / den) * xMean,
  };
}

const round1 = (v: number): number => Math.round(v * 10) / 10;

export function buildAiForecast(
  entityType: GridEntityType,
  entityId: string,
  horizon: ForecastHorizon,
): AiForecastResult {
  const sub =
    entityType === "substation" ? GRID_SUBSTATIONS.find((s) => s.id === entityId) : undefined;
  const line = entityType === "line" ? GRID_POWER_LINES.find((l) => l.id === entityId) : undefined;
  const entityLabel = sub?.name ?? line?.name ?? entityId;

  const history = GRID_LOAD_HISTORY.filter(
    (r) => r.entityId === entityId && r.entityType === entityType,
  )
    .slice()
    .sort((a, b) => periodIndex(a.timestamp) - periodIndex(b.timestamp));

  const capacity =
    entityType === "substation" ? (sub?.designCapacity ?? 0) : (line?.capacityMw ?? 0);

  if (history.length < 4 || capacity <= 0) {
    return {
      entityType,
      entityId,
      entityLabel,
      horizon,
      unit: "MW",
      method: "Hồi quy tuyến tính + phân rã mùa vụ",
      insufficient: true,
      inputSummary: { nPeriods: history.length, capacityMw: capacity, growthPerYearPct: 0 },
      points: [],
      scenarios: {
        low: { label: "Thấp", value: 0 },
        base: { label: "Cơ sở", value: 0 },
        high: { label: "Cao", value: 0 },
      },
      risk: "Thấp",
      confidencePct: 0,
      factors: [],
      recommendation: "Chưa đủ chuỗi lịch sử tải để thực hiện dự báo cho đối tượng này.",
      note: "Đối tượng chưa đóng điện hoặc chưa thu thập đủ 12 kỳ số liệu. AI sẽ tự động chạy lại khi đủ dữ liệu.",
    };
  }

  const loadFactors = history.map((r) => r.loadFactorPct);
  const { slope, intercept } = linearRegression(loadFactors);
  const residuals = loadFactors.map((v, i) => v - (intercept + slope * (i + 1)));
  const std = Math.sqrt(residuals.reduce((a, v) => a + v * v, 0) / residuals.length);

  // Hệ số mùa vụ theo chu kỳ 4 kỳ (độ lệch trung bình so với trend).
  const season = [0, 1, 2, 3].map(
    (k) =>
      residuals.filter((_, i) => i % 4 === k).reduce((a, v) => a + v, 0) /
      Math.max(1, residuals.filter((_, i) => i % 4 === k).length),
  );

  // ── Yếu tố GIS: tổng phụ tải các vùng cùng huyện → tốc độ tăng trưởng. ──
  const districts = entityType === "substation" ? [sub?.district ?? ""] : (line?.districts ?? []);
  const areaLoadMw = GRID_LOAD_AREAS.filter((a) => districts.includes(a.district)).reduce(
    (s, a) => s + a.peakMw,
    0,
  );
  const gisBoostPct = areaLoadMw > 120 ? 3 : areaLoadMw > 60 ? 1.5 : 0;

  // ── Yếu tố thống kê: quá tải / tổn thất / suất sự cố. ──
  let statAdjPct = 0;
  if (sub) {
    if ((sub.loadFactor ?? 0) >= 100) statAdjPct += 2;
    else if ((sub.loadFactor ?? 0) >= 90) statAdjPct += 0.5;
    if ((sub.transformers ?? []).some((t) => t.loadFactorPct >= 100)) statAdjPct += 0.5;
  }
  if (line?.operation) {
    const op = line.operation;
    if (op.overloadCount > 0) statAdjPct += 1;
    if ((op.lossPct ?? 0) >= GRID_CONFIG.thresholds.lineLossHighPct) statAdjPct += 1;
    if (op.faultRatePerYear >= 1.5) statAdjPct += 1;
  }

  const warnPct =
    entityType === "substation"
      ? GRID_CONFIG.thresholds.substationLoadWarnPct
      : GRID_CONFIG.thresholds.lineLoadWarnPct;
  const thresholdMw = Math.round((capacity * warnPct) / 100);
  const { label, n } = HORIZON_META[horizon];

  const points: AiForecastPoint[] = history.map((r) => ({
    period: r.timestamp,
    actual: r.loadMw,
    threshold: thresholdMw,
  }));

  const lastFactor = loadFactors[loadFactors.length - 1] ?? 50;
  for (let k = 1; k <= n; k++) {
    const pct = Math.min(
      200,
      Math.max(
        20,
        lastFactor +
          slope * k +
          (season[(history.length + k - 1) % 4] ?? 0) +
          gisBoostPct +
          statAdjPct,
      ),
    );
    const base = Math.round((capacity * pct) / 100);
    const band = Math.max(2, round1(std * (1 + k * 0.06)));
    points.push({
      period: `${label}${k}`,
      base,
      min: Math.max(0, Math.round(base - band)),
      max: Math.round(base + band),
      threshold: thresholdMw,
    });
  }

  const last = points[points.length - 1]!;
  const lastBase = last.base ?? 0;
  const marginPct = GRID_CONFIG.forecast.scenarioMarginPct;
  const scenarios: AiForecastResult["scenarios"] = {
    low: { label: "Thấp", value: Math.max(0, Math.round(lastBase * (1 - marginPct / 100))) },
    base: { label: "Cơ sở", value: lastBase },
    high: { label: "Cao", value: Math.round(lastBase * (1 + marginPct / 100)) },
  };

  const maxBase = Math.max(...points.filter((p) => p.base !== undefined).map((p) => p.base ?? 0));
  const risk: AiForecastResult["risk"] =
    maxBase >= capacity ? "Cao" : maxBase >= thresholdMw ? "Trung bình" : "Thấp";

  const lastActualMw = history[history.length - 1]?.loadMw;
  const growthPerYearPct = round1((slope * 12 * 100) / Math.max(1, lastFactor));

  const trendEffect: FactorContribution["effect"] = slope >= 0 ? "up" : "down";
  const factors: FactorContribution[] = [
    {
      id: "trend",
      label: `Xu hướng ${growthPerYearPct >= 0 ? "tăng" : "giảm"} ${Math.abs(growthPerYearPct)}%/năm từ chuỗi lịch sử 12 kỳ`,
      source: "history",
      effect: trendEffect,
      impactPct: round1(Math.abs(slope) * (n / 2)),
    },
    {
      id: "season",
      label: "Mùa vụ theo chu kỳ 4 kỳ (phân rã phần dư)",
      source: "history",
      effect: "down",
      impactPct: round1(Math.abs(season[0] ?? 0)),
    },
    {
      id: "gis",
      label: `Phụ tải GIS khu vực ${areaLoadMw} MW (${districts.join(", ") || "không xác định"})`,
      source: "gis",
      effect: gisBoostPct >= 0 ? "up" : "down",
      impactPct: gisBoostPct,
    },
    {
      id: "stats",
      label:
        statAdjPct > 0
          ? "Quá tải/tổn thất/sự cố gần nhất làm tăng rủi ro"
          : "Thống kê lưới ổn định",
      source: "stats",
      effect: statAdjPct >= 0 ? "up" : "down",
      impactPct: statAdjPct,
    },
  ];

  const recommendation =
    risk === "Cao"
      ? "Đề xuất san tải/xem xét nâng công suất hoặc đẩy nhanh trạm/tuyến quy hoạch tại khu vực."
      : risk === "Trung bình"
        ? "Theo dõi sát tải định kỳ; chuẩn bị phương án dự phòng nếu vượt ngưỡng 2 kỳ liên tiếp."
        : "Duy trì chế độ giám sát định kỳ hiện tại, không cần can thiệp.";

  return {
    entityType,
    entityId,
    entityLabel,
    horizon,
    unit: "MW",
    method: "Hồi quy tuyến tính + phân rã mùa vụ (12 kỳ) + hiệu chỉnh GIS & thống kê",
    insufficient: false,
    inputSummary: {
      nPeriods: history.length,
      capacityMw: capacity,
      ...(lastActualMw !== undefined ? { lastActualMw } : {}),
      lastLoadFactorPct: lastFactor,
      growthPerYearPct,
    },
    points,
    scenarios,
    risk,
    confidencePct: Math.max(
      60,
      Math.min(95, Math.round(100 - (std / Math.max(1, lastFactor)) * 25)),
    ),
    factors,
    recommendation,
    note: "Bản phân tích AI dựa trên dữ liệu vận hành 12 kỳ gần nhất. Khoảng tin cậy phản ánh độ phân tán phần dư của mô hình hồi quy.",
  };
}
