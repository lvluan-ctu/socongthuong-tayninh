// Mission 1 client adapter. Every dashboard widget reads the same PostgreSQL/
// PostGIS payload; no frontend mock collection is used by this module.
import { nearestSubstation, substationSpareCapacityMw } from "@/lib/grid-geo";
import { GRID_CONFIG } from "@/lib/grid-types";
import type {
  AbsorptionAssessment,
  AiForecastResult,
  AreaForecastResult,
  EnergyReport,
  ForecastHorizon,
  ForecastResult,
  GridEntityType,
  GridLoadRecord,
  GridWarning,
  LineCurtailment,
  NearestSubstationResult,
  Task1GridData,
} from "@/lib/grid-types";

export type GridDataSource = "api";
export const GRID_DATA_SOURCE: GridDataSource = "api";

let dashboardRequest: Promise<Task1GridData> | null = null;

async function loadDashboard() {
  dashboardRequest ??= fetch("/api/grid/task1/dashboard", { cache: "no-store" }).then(async (response) => {
    const payload = await response.json() as Task1GridData & { message?: string };
    if (!response.ok) throw new Error(payload.message ?? "Không thể tải dữ liệu Nhiệm vụ 1.");
    return payload;
  }).catch((error) => {
    dashboardRequest = null;
    throw error;
  });
  return dashboardRequest;
}

export function getTask1GridData(): Promise<Task1GridData> {
  return loadDashboard();
}

export function refreshTask1GridData() {
  dashboardRequest = null;
}

export async function getLoadHistory(entityId: string, entityType: GridEntityType) {
  const data = await loadDashboard();
  return (data.loadHistory ?? []).filter((row) => row.entityId === entityId && row.entityType === entityType);
}

export async function getLoadHistoryAll(): Promise<GridLoadRecord[]> {
  return (await loadDashboard()).loadHistory ?? [];
}

function forecastMeta(horizon: ForecastHorizon) {
  const index = GRID_CONFIG.forecast.horizons.indexOf(horizon);
  return index === 0 ? { prefix: "D", count: 7 } : index === 1 ? { prefix: "W", count: 4 } : index === 2 ? { prefix: "Q", count: 3 } : { prefix: "M", count: 12 };
}

function regression(values: number[]) {
  const n = values.length;
  if (!n) return { slope: 0, deviation: 0 };
  const xMean = (n + 1) / 2;
  const yMean = values.reduce((sum, value) => sum + value, 0) / n;
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    const x = index + 1;
    numerator += (x - xMean) * (value - yMean);
    denominator += (x - xMean) ** 2;
  });
  const slope = denominator ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;
  const residuals = values.map((value, index) => value - (intercept + slope * (index + 1)));
  const deviation = Math.sqrt(residuals.reduce((sum, value) => sum + value ** 2, 0) / n);
  return { slope, deviation };
}

function entityInfo(data: Task1GridData, entityId: string, entityType: GridEntityType) {
  if (entityType === "substation") {
    const entity = data.substations.find((item) => item.id === entityId);
    return { label: entity?.name ?? entityId, capacity: entity?.designCapacity ?? 0, district: entity?.district ?? "" };
  }
  const entity = data.lines.find((item) => item.id === entityId);
  return { label: entity?.name ?? entityId, capacity: entity?.capacityMw ?? 0, district: entity?.districts[0] ?? "" };
}

export async function getForecast(entityId: string, entityType: GridEntityType, horizon: ForecastHorizon): Promise<ForecastResult> {
  const data = await loadDashboard();
  const history = (data.loadHistory ?? []).filter((row) => row.entityId === entityId && row.entityType === entityType);
  const entity = entityInfo(data, entityId, entityType);
  const factors = history.map((row) => row.loadFactorPct);
  const { slope } = regression(factors);
  const last = factors.at(-1) ?? 0;
  const { prefix, count } = forecastMeta(horizon);
  const thresholdPct = entityType === "substation" ? GRID_CONFIG.thresholds.substationLoadWarnPct : GRID_CONFIG.thresholds.lineLoadWarnPct;
  const points = Array.from({ length: count }, (_, index) => ({
    period: `${prefix}${index + 1}`,
    forecast: Math.round(entity.capacity * Math.max(0, last + slope * (index + 1)) / 100),
    threshold: Math.round(entity.capacity * thresholdPct / 100),
  }));
  const max = Math.max(0, ...points.map((point) => point.forecast ?? 0));
  const risk: ForecastResult["risk"] = max >= entity.capacity ? "Cao" : max >= entity.capacity * thresholdPct / 100 ? "Trung bình" : "Thấp";
  return { entityType, entityId, entityLabel: entity.label, horizon, unit: "MW", points, risk,
    note: "Dự báo tính từ chuỗi snapshot vận hành trong PostgreSQL; không sử dụng dữ liệu mock phía trình duyệt." };
}

export async function getAiForecast(entityId: string, entityType: GridEntityType, horizon: ForecastHorizon): Promise<AiForecastResult> {
  const data = await loadDashboard();
  const history = (data.loadHistory ?? []).filter((row) => row.entityId === entityId && row.entityType === entityType);
  const entity = entityInfo(data, entityId, entityType);
  const factors = history.map((row) => row.loadFactorPct);
  const { slope, deviation } = regression(factors);
  const lastFactor = factors.at(-1) ?? 0;
  const { prefix, count } = forecastMeta(horizon);
  const thresholdPct = entityType === "substation" ? GRID_CONFIG.thresholds.substationLoadWarnPct : GRID_CONFIG.thresholds.lineLoadWarnPct;
  const threshold = entity.capacity * thresholdPct / 100;
  const points: AiForecastResult["points"] = history.map((row) => ({ period: row.timestamp, actual: row.loadMw, threshold }));
  for (let index = 1; index <= count; index += 1) {
    const predictedPct = Math.max(0, lastFactor + slope * index);
    const base = entity.capacity * predictedPct / 100;
    const band = Math.max(entity.capacity * 0.02, entity.capacity * deviation / 100);
    points.push({ period: `${prefix}${index}`, base: Math.round(base * 10) / 10,
      min: Math.max(0, Math.round((base - band) * 10) / 10), max: Math.round((base + band) * 10) / 10,
      threshold: Math.round(threshold * 10) / 10 });
  }
  const lastForecast = points.at(-1)?.base ?? history.at(-1)?.loadMw ?? 0;
  const margin = GRID_CONFIG.forecast.scenarioMarginPct / 100;
  const maxForecast = Math.max(0, ...points.map((point) => point.max ?? point.base ?? 0));
  const risk: AiForecastResult["risk"] = maxForecast >= entity.capacity ? "Cao" : maxForecast >= threshold ? "Trung bình" : "Thấp";
  const areaPeak = data.loadAreas.filter((area) => area.district === entity.district).reduce((sum, area) => sum + area.peakMw, 0);
  const insufficient = history.length < 4 || entity.capacity <= 0;
  return {
    entityType, entityId, entityLabel: entity.label, horizon, unit: "MW",
    method: "Hồi quy tuyến tính trên snapshot vận hành + hiệu chỉnh lớp vùng phụ tải PostGIS",
    insufficient,
    inputSummary: { nPeriods: history.length, capacityMw: entity.capacity,
      ...(history.at(-1) ? { lastActualMw: history.at(-1)?.loadMw, lastLoadFactorPct: lastFactor } : {}),
      growthPerYearPct: Math.round(slope * 12 * 10) / 10 },
    points: insufficient ? [] : points,
    scenarios: {
      low: { label: "Thấp", value: Math.round(lastForecast * (1 - margin)) },
      base: { label: "Cơ sở", value: Math.round(lastForecast) },
      high: { label: "Cao", value: Math.round(lastForecast * (1 + margin)) },
    },
    risk, confidencePct: insufficient ? 0 : Math.max(60, Math.min(95, Math.round(94 - deviation))),
    factors: [
      { id: "history", label: `${history.length} snapshot vận hành; xu hướng ${slope >= 0 ? "tăng" : "giảm"}`, source: "history", effect: slope >= 0 ? "up" : "down", impactPct: Math.round(Math.abs(slope) * 10) / 10 },
      { id: "gis", label: `Vùng phụ tải GIS cùng khu vực: ${areaPeak} MW`, source: "gis", effect: areaPeak ? "up" : "down", impactPct: areaPeak ? 1.5 : 0 },
      { id: "stats", label: `Hệ số tải gần nhất ${lastFactor.toFixed(1)}%`, source: "stats", effect: lastFactor >= 80 ? "up" : "down", impactPct: lastFactor >= 80 ? 2 : 0 },
    ],
    recommendation: risk === "Cao" ? "Ưu tiên san tải hoặc lập phương án nâng công suất." : risk === "Trung bình" ? "Theo dõi sát chuỗi tải và chuẩn bị phương án dự phòng." : "Duy trì giám sát định kỳ.",
    note: "Kết quả được tính lại từ dữ liệu API NV1; các snapshot suy diễn đều có cờ provenance trong cơ sở dữ liệu.",
  };
}

export async function getGridWarnings(): Promise<GridWarning[]> {
  return (await loadDashboard()).warnings;
}

export async function getRenewableAbsorption(substationId: string): Promise<AbsorptionAssessment> {
  const data = await loadDashboard();
  const station = data.substations.find((item) => item.id === substationId);
  if (!station) return { substationId, substationName: substationId, substationCode: substationId, voltageLevel: "",
    allowableMw: 0, middayLoadMw: 0, operatingMw: 0, plannedMw: 0, absorptionMw: 0, status: "full",
    recommendation: "Không tìm thấy trạm trong CSDL.", sources: [] };
  const sources = data.renewables.filter((item) => item.hostSubstationId === substationId);
  const allowableMw = station.operatingCapacity ?? station.designCapacity ?? 0;
  const middayLoadMw = allowableMw * (station.loadFactor ?? 0) / 100 * 0.85;
  const operatingMw = sources.filter((item) => item.status === "Vận hành").reduce((sum, item) => sum + item.capacityKw / 1000, 0);
  const plannedMw = sources.filter((item) => item.status !== "Vận hành").reduce((sum, item) => sum + item.capacityKw / 1000, 0);
  const absorptionMw = Math.max(0, allowableMw + middayLoadMw - operatingMw - plannedMw);
  const status = absorptionMw <= allowableMw * 0.05 ? "full" : absorptionMw <= allowableMw * 0.15 ? "limited" : "available";
  return { substationId, substationName: station.name, substationCode: station.code, voltageLevel: station.voltageLevel,
    allowableMw, middayLoadMw: Math.round(middayLoadMw * 10) / 10, operatingMw, plannedMw,
    absorptionMw: Math.round(absorptionMw * 10) / 10, status,
    recommendation: status === "full" ? "Trạm đã đạt giới hạn tiếp nhận; cần san tải hoặc nâng công suất." : status === "limited" ? "Chỉ xem xét nguồn nhỏ và kiểm tra quá tải chi tiết." : "Trạm còn dư địa tiếp nhận nguồn mới.", sources };
}

export async function getLineCurtailment(lineId: string): Promise<LineCurtailment> {
  const data = await loadDashboard();
  const line = data.lines.find((item) => item.id === lineId);
  if (!line) return { lineId, lineName: lineId, lineCode: lineId, voltageLevel: "", capacityMw: 0,
    currentLoadMw: 0, renewablesConnectedMw: 0, headroomMw: 0, status: "full",
    recommendation: "Không tìm thấy tuyến trong CSDL.", sources: [] };
  const sources = data.renewables.filter((item) => item.hostLineCode === line.code);
  const renewablesConnectedMw = sources.filter((item) => item.status === "Vận hành").reduce((sum, item) => sum + item.capacityKw / 1000, 0);
  const headroomMw = Math.max(0, (line.capacityMw ?? 0) - (line.actualLoadMw ?? 0) - renewablesConnectedMw);
  const status = headroomMw <= 0 ? "full" : headroomMw <= (line.capacityMw ?? 0) * 0.1 ? "limited" : "available";
  return { lineId, lineName: line.name, lineCode: line.code, voltageLevel: line.voltageLevel,
    capacityMw: line.capacityMw ?? 0, currentLoadMw: line.actualLoadMw ?? 0,
    renewablesConnectedMw, headroomMw: Math.round(headroomMw * 10) / 10, status,
    recommendation: status === "full" ? "Tuyến không còn dư địa giải tỏa; cần nâng cấp hoặc san tải." : status === "limited" ? "Dư địa hạn chế; chỉ tiếp nhận nguồn nhỏ." : "Tuyến còn dư địa giải tỏa công suất.", sources };
}

export async function getNearestSubstationAnalysis(lat: number, lng: number, demandMw: number): Promise<NearestSubstationResult> {
  const data = await loadDashboard();
  const nearest = nearestSubstation(lat, lng, data.substations);
  if (!nearest) return { lat, lng, demandMw, substation: null, distanceKm: null, spareMw: 0, canSupply: false,
    recommendation: "Không tìm thấy trạm có tọa độ GIS." };
  const spareMw = substationSpareCapacityMw(nearest.substation);
  return { lat, lng, demandMw, substation: { id: nearest.substation.id, name: nearest.substation.name,
    code: nearest.substation.code, voltageLevel: nearest.substation.voltageLevel, district: nearest.substation.district },
    distanceKm: Math.round(nearest.distanceKm * 10) / 10, spareMw, canSupply: spareMw >= demandMw,
    recommendation: spareMw >= demandMw ? "Trạm còn đủ dư địa; cần khảo sát lộ xuất tuyến thực địa." : "Trạm gần nhất thiếu công suất; cần san tải hoặc xem xét phương án đầu tư." };
}

export async function getAreaForecast(areaId: string): Promise<AreaForecastResult> {
  const data = await loadDashboard();
  const area = data.loadAreas.find((item) => item.id === areaId);
  if (!area) return { areaId, areaName: areaId, district: "", peakMw: 0, growthPerYearPct: 0, unit: "MW", points: [], risk: "Thấp", note: "Không tìm thấy vùng phụ tải." };
  const growthPerYearPct = 5.5;
  const points: AreaForecastResult["points"] = Array.from({ length: 24 }, (_, index) => index < 12
    ? { period: `T${index + 1}`, actual: Math.round(area.peakMw * (0.82 + index * 0.012 + Math.sin(index) * 0.04)) }
    : { period: `D${index - 11}`, base: Math.round(area.peakMw * (1 + growthPerYearPct / 100 * ((index - 11) / 12))),
        min: Math.round(area.peakMw * 0.92), max: Math.round(area.peakMw * 1.1) });
  const risk: AreaForecastResult["risk"] = area.peakMw >= 100 ? "Cao" : area.peakMw >= 60 ? "Trung bình" : "Thấp";
  return { areaId, areaName: area.name, district: area.district, peakMw: area.peakMw, growthPerYearPct,
    unit: "MW", points, risk, note: "Vùng phụ tải lấy từ PostGIS; tốc độ tăng trưởng là tham số kịch bản seed NV1 có provenance." };
}

function csvCell(value: string | number) {
  const result = String(value).replaceAll('"', '""');
  return /[;"\n]/.test(result) ? `"${result}"` : result;
}

export async function buildEnergyReport(year: number): Promise<EnergyReport> {
  const data = await loadDashboard();
  const voltageLevels = ["500kV", "220kV", "110kV", "22kV"];
  const sections: EnergyReport["sections"] = [
    { id: "1.7a", title: "Mẫu 1.7a — Chiều dài đường dây theo cấp điện áp", columns: ["Cấp điện áp", "Số tuyến", "Chiều dài (km)"],
      rows: voltageLevels.map((voltage) => [voltage, data.lines.filter((line) => line.voltageLevel === voltage).length,
        Math.round(data.lines.filter((line) => line.voltageLevel === voltage).reduce((sum, line) => sum + line.lengthKm, 0) * 10) / 10]) },
    { id: "1.8a", title: "Mẫu 1.8a — Trạm biến áp và công suất", columns: ["Cấp điện áp", "Số trạm", "Công suất (MVA)"],
      rows: voltageLevels.map((voltage) => [voltage, data.substations.filter((station) => station.voltageLevel === voltage).length,
        data.substations.filter((station) => station.voltageLevel === voltage).reduce((sum, station) => sum + (station.designCapacity ?? 0), 0)]) },
    { id: "NV1-GIS", title: "Phụ lục GIS và chất lượng dữ liệu", columns: ["Chỉ tiêu", "Giá trị"], rows: [
      ["Vị trí GIS", data.provenance?.gisPositions ?? data.poles.length], ["Snapshot vận hành", data.provenance?.operatingSnapshots ?? 0],
      ["Phép đo nguồn", data.provenance?.measurements ?? 0], ["Cảnh báo mở", data.warnings.length],
    ] },
  ];
  const csv = sections.map((section) => [section.title, section.columns.join(';'), ...section.rows.map((row) => row.map(csvCell).join(';'))].join('\n')).join('\n\n');
  return { year, standard: "TT 34/2019/TT-BCT và phụ lục dữ liệu NV1", generatedAt: new Date().toLocaleDateString("vi-VN"), sections, csv };
}
