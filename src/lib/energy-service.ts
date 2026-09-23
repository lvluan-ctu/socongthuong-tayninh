// ============================================================
// SERVICE LAYER — PHÂN HỆ ĐIỀU TRA & NĂNG LƯỢNG
// Hiện chạy MOCK adapter (dữ liệu demo trong src/data/energy-mock.ts).
// Khi backend sẵn sàng: đổi ENERGY_DATA_SOURCE sang "api" và implement
// các hàm fetch tương ứng endpoint gợi ý bên dưới.
//
// ENDPOINT GỢI Ý (REST):
//   GET /energy/overview
//   GET /energy/substations | /energy/substations/:id
//   GET /energy/power-lines   | /energy/power-lines/:id
//   GET /energy/power-poles
//   GET /energy/projects      | /energy/projects/:id
//   GET /energy/rooftop-solar | /energy/rooftop-solar/:id
//   GET /energy/consumption
//   GET /energy/incidents     | /energy/incidents/:id
//   GET /energy/emissions     | /energy/emissions/:id
//   GET /energy/charging-stations | /energy/charging-stations/:id
// GIS:
//   GET /energy/gis (bundle các layer không gian)
// ============================================================
import type {
  CarbonCredit,
  ChargingDemandForecast,
  ChargingDemandRecord,
  ChargingForecastHorizon,
  ChargingLocationAnalysis,
  ChargingStation,
  ChargingStationSuggestion,
  EmissionSource,
  EnergyConsumer,
  EnergyDataSource,
  EnergyDashboardBundle,
  EnergyGisData,
  EnergyOverview,
  GridIncident,
  GridSafetyViolation,
  KeyEnergyConsumer,
  PowerLine,
  PowerPole,
  PowerProject,
  RooftopSolar,
  SmartMeter,
  Substation,
} from "@/lib/energy-types";
import { haversineKm } from "@/lib/grid-geo";
import {
  CARBON_CREDITS,
  CHARGING_DEMAND_HISTORY,
  CHARGING_STATIONS,
  EMISSION_SOURCES,
  ENERGY_CONSUMERS,
  ENERGY_GIS_DATA,
  ENERGY_OVERVIEW,
  GRID_INCIDENTS,
  GRID_SAFETY_VIOLATIONS,
  KEY_ENERGY_CONSUMERS,
  POWER_LINES,
  POWER_POLES,
  POWER_PROJECTS,
  ROOFTOP_SOLAR,
  SMART_METERS,
  SUBSTATIONS,
} from "@/data/energy-mock";

// Bật MOCK / API. Production phải đổi sang "api" và cấu hình base URL.
export const ENERGY_DATA_SOURCE: EnergyDataSource = "mock";

const USE_MOCK = ENERGY_DATA_SOURCE === "mock";

export async function getEnergyDashboard(): Promise<EnergyDashboardBundle> {
  const response = await fetch("/api/energy/overview", {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Không thể tải dữ liệu tổng quan năng lượng.");
  }
  return response.json() as Promise<EnergyDashboardBundle>;
}

// Giả lập độ trễ mạng để UI có Loading state đúng cách.
function delay<T>(value: T, ms = 320): Promise<T> {
  if (!USE_MOCK) return Promise.resolve(value);
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function listEndpoint<T>(path: string): Promise<T[]> {
  // Khi chuyển "api": return fetch(`/api${path}`).then((r) => r.json());
  void path;
  return delay([] as T[]);
}

// ─────────────────────────── Tổng quan ───────────────────────────
export function getEnergyOverview(): Promise<EnergyOverview> {
  return delay(ENERGY_OVERVIEW);
}

// ─────────────────────────── Trạm biến áp ───────────────────────────
export async function getSubstations(): Promise<Substation[]> {
  if (!USE_MOCK) return listEndpoint<Substation>("/energy/substations");
  return delay(SUBSTATIONS);
}

export async function getSubstation(id: string): Promise<Substation | undefined> {
  if (!USE_MOCK) return listEndpoint<Substation>(`/energy/substations/${id}`).then((l) => l[0]);
  return delay(SUBSTATIONS.find((s) => s.id === id || s.code === id));
}

// ─────────────────────────── Lưới điện ───────────────────────────
export async function getPowerLines(): Promise<PowerLine[]> {
  if (!USE_MOCK) return listEndpoint<PowerLine>("/energy/power-lines");
  return delay(POWER_LINES);
}

export async function getPowerPoles(): Promise<PowerPole[]> {
  if (!USE_MOCK) return listEndpoint<PowerPole>("/energy/power-poles");
  return delay(POWER_POLES);
}

// ─────────────────────────── Dự án nguồn điện ───────────────────────────
export async function getPowerProjects(): Promise<PowerProject[]> {
  if (!USE_MOCK) return listEndpoint<PowerProject>("/energy/projects");
  return delay(POWER_PROJECTS);
}

export async function getPowerProject(id: string): Promise<PowerProject | undefined> {
  if (!USE_MOCK) return listEndpoint<PowerProject>(`/energy/projects/${id}`).then((l) => l[0]);
  return delay(POWER_PROJECTS.find((p) => p.id === id || p.code === id));
}

// ─────────────────────────── Điện mặt trời mái nhà ───────────────────────────
export async function getRooftopSolar(): Promise<RooftopSolar[]> {
  if (!USE_MOCK) return listEndpoint<RooftopSolar>("/energy/rooftop-solar");
  return delay(ROOFTOP_SOLAR);
}

// ─────────────────────────── Tiêu thụ & công tơ ───────────────────────────
export async function getEnergyConsumers(): Promise<EnergyConsumer[]> {
  if (!USE_MOCK) return listEndpoint<EnergyConsumer>("/energy/consumption");
  return delay(ENERGY_CONSUMERS);
}

export async function getSmartMeters(): Promise<SmartMeter[]> {
  if (!USE_MOCK) return listEndpoint<SmartMeter>("/energy/smart-meters");
  return delay(SMART_METERS);
}

export async function getKeyEnergyConsumers(): Promise<KeyEnergyConsumer[]> {
  if (!USE_MOCK) return listEndpoint<KeyEnergyConsumer>("/energy/key-consumers");
  return delay(KEY_ENERGY_CONSUMERS);
}

// ─────────────────────────── An toàn & Sự cố ───────────────────────────
export async function getGridIncidents(): Promise<GridIncident[]> {
  if (!USE_MOCK) return listEndpoint<GridIncident>("/energy/incidents");
  return delay(GRID_INCIDENTS);
}

export async function getGridSafetyViolations(): Promise<GridSafetyViolation[]> {
  if (!USE_MOCK) return listEndpoint<GridSafetyViolation>("/energy/safety-violations");
  return delay(GRID_SAFETY_VIOLATIONS);
}

// ─────────────────────────── Phát thải Carbon ───────────────────────────
export async function getEmissionSources(): Promise<EmissionSource[]> {
  if (!USE_MOCK) return listEndpoint<EmissionSource>("/energy/emissions");
  return delay(EMISSION_SOURCES);
}

export async function getCarbonCredits(): Promise<CarbonCredit[]> {
  if (!USE_MOCK) return listEndpoint<CarbonCredit>("/energy/carbon-credits");
  return delay(CARBON_CREDITS);
}

// ─────────────────────────── Trạm sạc ───────────────────────────
export async function getChargingStations(): Promise<ChargingStation[]> {
  if (!USE_MOCK) return listEndpoint<ChargingStation>("/energy/charging-stations");
  return delay(CHARGING_STATIONS);
}

// ─────────────────── Trạm sạc — AI dự báo & đề xuất (Nhiệm vụ 7) ───────────────────
/** Toàn bộ chuỗi nhu cầu sạc theo huyện (dùng cho biểu đồ xu hướng). */
export async function getChargingDemandHistory(): Promise<ChargingDemandRecord[]> {
  return delay(CHARGING_DEMAND_HISTORY);
}

const CHARGING_FMT = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);

const HOURS_PER_PERIOD = 16 * 30; // 16 giờ hoạt động/ngày × 30 ngày
const UTILIZATION_PCT = 0.85;

const FORECAST_COUNT: Record<ChargingForecastHorizon, { label: string; n: number }> = {
  "7 ngày": { label: "D", n: 7 },
  "1 tháng": { label: "W", n: 4 },
  Quý: { label: "Q", n: 3 },
  "1 năm": { label: "M", n: 12 },
};

function aggregateDemandSeries(): ChargingDemandRecord[] {
  const byPeriod = new Map<string, { energyKwh: number; sessions: number }>();
  for (const r of CHARGING_DEMAND_HISTORY) {
    const cur = byPeriod.get(r.period) ?? { energyKwh: 0, sessions: 0 };
    cur.energyKwh += r.energyKwh;
    cur.sessions += r.sessions;
    byPeriod.set(r.period, cur);
  }
  return Array.from(byPeriod.entries()).map(([period, v]) => ({
    district: "Toàn tỉnh",
    period,
    energyKwh: Math.round(v.energyKwh),
    sessions: v.sessions,
  }));
}

/**
 * Dự báo nhu cầu sạc điện của một huyện (hoặc "Toàn tỉnh") (AI, demo deterministic):
 * hồi quy tuyến tính + phân rã mùa vụ trên chuỗi 12 kỳ nhu cầu sạc.
 */
export async function getChargingDemandForecast(
  district: string,
  horizon: ChargingForecastHorizon,
): Promise<ChargingDemandForecast> {
  const isAll = district === "Toàn tỉnh";
  const series = isAll
    ? aggregateDemandSeries()
    : CHARGING_DEMAND_HISTORY.filter((r) => r.district === district);
  const installedCapacityKw = CHARGING_STATIONS.filter(
    (s) => (isAll || s.district === district) && s.status !== "Quy hoạch",
  ).reduce((sum, s) => sum + s.powerKw, 0);

  if (!series.length) {
    return delay({
      district,
      horizon,
      unit: "kWh",
      installedCapacityKw,
      thresholdKwh: 0,
      lastActualKwh: 0,
      peakForecastKwh: 0,
      growthPerYearPct: 0,
      risk: "Thấp",
      points: [],
      scenarios: [],
      method: "Hồi quy tuyến tính + mùa vụ (demo)",
      confidencePct: 0,
      note: `Không có dữ liệu nhu cầu sạc cho ${district}.`,
    });
  }

  const values = series.map((r) => r.energyKwh);
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
  const std = Math.sqrt(values.reduce((s, v) => s + (v - yMean) ** 2, 0) / n);

  const thresholdKwh = Math.round(installedCapacityKw * HOURS_PER_PERIOD * UTILIZATION_PCT);
  const { label, n: fc } = FORECAST_COUNT[horizon];

  const points: ChargingDemandForecast["points"] = [];
  const historyStart = Math.max(0, n - 8);
  for (let i = historyStart; i < n; i++) {
    points.push({ period: series[i]!.period, actual: values[i]!, threshold: thresholdKwh });
  }
  for (let j = 1; j <= fc; j++) {
    const wave = Math.sin((n + j) * 0.6) * std * 0.5;
    const base = Math.max(0, Math.round(intercept + slope * (n + j) + wave));
    points.push({
      period: `${label}${j}`,
      base,
      min: Math.round(base - std * 0.4),
      max: Math.round(base + std * 0.5),
      threshold: thresholdKwh,
    });
  }

  const lastActualKwh = values[n - 1]!;
  const peakForecastKwh = Math.max(
    ...points.filter((p) => p.base !== undefined).map((p) => p.base ?? 0),
  );
  const growthPerYearPct = lastActualKwh ? Math.round((slope * 12 * 100) / lastActualKwh) : 0;
  const risk: ChargingDemandForecast["risk"] =
    peakForecastKwh >= thresholdKwh
      ? "Cao"
      : peakForecastKwh >= thresholdKwh * 0.85
        ? "Trung bình"
        : "Thấp";
  const note =
    risk === "Cao"
      ? `Nhu cầu sạc dự báo vượt ngưỡng ${CHARGING_FMT(thresholdKwh)} kWh/kỳ — cần bổ sung trạm/cổng sạc tại ${district}.`
      : risk === "Trung bình"
        ? `Nhu cầu sạc tăng ~${growthPerYearPct}%/năm tại ${district}, cần theo dõi định kỳ theo quý.`
        : `Nhu cầu sạc tại ${district} trong giới hạn hiện tại (ngưỡng ${CHARGING_FMT(thresholdKwh)} kWh/kỳ).`;

  return delay({
    district,
    horizon,
    unit: "kWh",
    installedCapacityKw,
    thresholdKwh,
    lastActualKwh,
    peakForecastKwh,
    growthPerYearPct,
    risk,
    points,
    scenarios: [
      { key: "low", label: "Thấp", value: Math.round(peakForecastKwh * 0.92) },
      { key: "base", label: "Cơ sở", value: peakForecastKwh },
      { key: "high", label: "Cao", value: Math.round(peakForecastKwh * 1.08) },
    ],
    method: "Hồi quy tuyến tính + phân rã mùa vụ trên chuỗi nhu cầu sạc (demo deterministic)",
    confidencePct: 86,
    note,
  });
}

// Tâm của các huyện để gợi ý vị trí trạm sạc mới.
const DISTRICT_CENTERS: Record<string, { lat: number; lng: number }> = {
  "TP. Tây Ninh": { lat: 11.3066, lng: 106.0979 },
  "Trảng Bàng": { lat: 11.0272, lng: 106.3792 },
  "Tân Biên": { lat: 11.5956, lng: 106.0985 },
  "Gò Dầu": { lat: 11.1565, lng: 106.2542 },
  "Bến Cầu": { lat: 11.1591, lng: 106.1324 },
  "Châu Thành": { lat: 11.3158, lng: 106.0181 },
};

function districtStats(district: string) {
  const stations = CHARGING_STATIONS.filter((s) => s.district === district);
  const installedKw = stations.reduce((sum, s) => sum + s.powerKw, 0);
  const overloaded = stations.filter((s) => s.status === "Quá tải" || s.freePorts === 0).length;
  const demand = CHARGING_DEMAND_HISTORY.filter((r) => r.district === district);
  const lastEnergy = demand.at(-1)?.energyKwh ?? 0;
  const firstEnergy = demand[0]?.energyKwh ?? lastEnergy;
  const growthPct = firstEnergy ? Math.round(((lastEnergy / firstEnergy - 1) * 100) / 11) : 0;
  const coveragePct =
    lastEnergy > 0
      ? Math.min(
          100,
          Math.round((installedKw * HOURS_PER_PERIOD * UTILIZATION_PCT * 100) / lastEnergy),
        )
      : 0;
  return { stations, installedKw, overloaded, lastEnergy, growthPct, coveragePct };
}

/** Gợi ý vị trí trạm sạc mới từ AI dựa trên phân tích độ phủ & tăng trưởng nhu cầu. */
export async function getChargingStationSuggestions(): Promise<ChargingStationSuggestion[]> {
  const createdAt = new Date().toLocaleDateString("vi-VN");
  const candidates: ChargingStationSuggestion[] = [];

  for (const [district, center] of Object.entries(DISTRICT_CENTERS)) {
    const stats = districtStats(district);
    if (stats.coveragePct >= 100) continue;
    const demandKw =
      stats.lastEnergy > 0
        ? Math.round(((stats.lastEnergy / HOURS_PER_PERIOD) * 1.2) / 10) * 10
        : 60;
    const score = Math.max(
      50,
      Math.min(
        98,
        Math.round(
          100 -
            stats.coveragePct * 0.6 +
            Math.min(20, stats.growthPct * 1.5) -
            stats.overloaded * 5,
        ),
      ),
    );
    const reasons = [
      `Độ phủ hiện tại ~${stats.coveragePct}% nhu cầu (${stats.installedKw} kW lắp đặt)`,
      `Nhu cầu sạc tăng ~${stats.growthPct}%/năm tại ${district}`,
      ...(stats.overloaded > 0 ? [`${stats.overloaded} trạm hiện quá tải/đủ công suất`] : []),
    ];
    candidates.push({
      id: `cs-${district}`,
      kind: stats.coveragePct < 60 ? "new" : "expand",
      title: stats.coveragePct < 60 ? `Trạm sạc mới ${district}` : `Mở rộng trạm sạc ${district}`,
      district,
      latitude: Number(center.lat.toFixed(4)),
      longitude: Number(center.lng.toFixed(4)),
      demandKw,
      score,
      reasons,
      workflowStatus: "DRAFT",
      createdAt,
      nearStation: stats.stations[0]?.name,
    });
  }

  return delay(
    candidates.sort((a, b) => b.score - a.score).map((c, i) => ({ ...c, id: `cs-${i + 1}` })),
  );
}

/** Phân tích vị trí đặt trạm sạc mới do người dùng nhập (tọa độ + công suất dự kiến). */
export async function getChargingLocationAnalysis(
  lat: number,
  lng: number,
  demandKw: number,
): Promise<ChargingLocationAnalysis> {
  let nearest: ChargingStation | null = null;
  let minDist = Infinity;
  CHARGING_STATIONS.forEach((s) => {
    if (!s.latitude || !s.longitude) return;
    if (s.status === "Quy hoạch") return;
    const d = haversineKm([lat, lng], [s.latitude, s.longitude]);
    if (d < minDist) {
      minDist = d;
      nearest = s;
    }
  });

  if (!nearest || minDist === Infinity) {
    return delay({
      lat,
      lng,
      demandKw,
      nearStation: null,
      distanceKm: null,
      spareKw: 0,
      canSupply: false,
      coveragePct: 0,
      recommendation: "Không tìm thấy trạm sạc vận hành gần vị trí yêu cầu.",
    });
  }

  // TypeScript cannot observe the assignment performed inside forEach above.
  const selected = nearest as ChargingStation;
  const spareKw = Math.max(0, selected.supplyCapacityKw - selected.powerKw);
  const canSupply = spareKw >= demandKw;
  const totalPorts = selected.ports.ccs2 + selected.ports.chademo + selected.ports.acType2;
  const coveragePct = totalPorts > 0 ? Math.round((selected.freePorts / totalPorts) * 100) : 0;
  const recommendation = canSupply
    ? `Trạm ${selected.name} còn dư địa ${CHARGING_FMT(spareKw)} kW và ${selected.freePorts} cổng trống — đủ khả năng đáp ứng công suất yêu cầu. Nên khảo sát vị trí để tối ưu phạm vi phủ sóng.`
    : `Trạm gần nhất (${selected.name}) chỉ còn dư địa ${CHARGING_FMT(spareKw)} kW — thiếu khoảng ${CHARGING_FMT(demandKw - spareKw)} kW. Đề xuất đặt trạm mới độc lập hoặc nâng cấp trạm ${selected.district}.`;

  return delay({
    lat,
    lng,
    demandKw,
    nearStation: nearest,
    distanceKm: Math.round(minDist * 10) / 10,
    spareKw,
    canSupply,
    coveragePct,
    recommendation,
  });
}

// ─────────────────────────── GIS (bundle) ───────────────────────────
export async function getEnergyGisData(): Promise<EnergyGisData> {
  if (!USE_MOCK) return delay(ENERGY_GIS_DATA);
  return delay(ENERGY_GIS_DATA);
}

// ─────────────────────────── Phân tích nâng cao (AI) ───────────────────────────
export interface EnergyAnalysisResult {
  available: boolean;
  title: string;
  message: string;
}

// Sẵn sàng nhận API dự báo từ backend. Hiện trả trạng thái "chưa có dữ liệu".
export function getEnergyAnalysis(kind: string): Promise<EnergyAnalysisResult> {
  return delay({
    available: false,
    title: kind,
    message: "Chưa có dữ liệu phân tích. Backend dự báo phụ tải/quá tải sẽ được kết nối sau.",
  });
}
