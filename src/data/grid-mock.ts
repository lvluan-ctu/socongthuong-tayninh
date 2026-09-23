// ============================================================
// MOCK DATA — NHIỆM VỤ 1: CSDL ĐƯỜNG DÂY ĐẤU NỐI & TRẠM BIẾN ÁP
// Dữ liệu DEMO cho development, KHÔNG phải dữ liệu nghiệp vụ thật.
// Khi backend sẵn sàng, chỉ cần đổi adapter trong grid-service.ts.
// Mở rộng từ dữ liệu năng lượng hiện có (energy-mock).
// ============================================================
import { POWER_LINES, SUBSTATIONS } from "@/data/energy-mock";
import type { GridIncident, PowerLine, Substation } from "@/lib/energy-types";
import {
  GRID_CONFIG,
  type ForecastHorizon,
  type ForecastResult,
  type ForecastPoint,
  type GridLoadRecord,
  type GridPlanAsset,
  type GridPowerLine,
  type GridPowerPole,
  type GridSubstation,
  type GridWarning,
  type LoadArea,
  type OperationLog,
  type OperationStatus,
  type OverloadZone,
  type PlanPhase,
  type RenewableSource,
  type SupplyArea,
  type Task1GridData,
} from "@/lib/grid-types";

// ─────────────────────────── Helpers (deterministic) ───────────────────────────
/** Vẽ vòng tròn gần đúng quanh center (đơn vị km) → polygon [lat, lng]. */
function ring(
  center: [number, number],
  radiusKm: number,
  points = 12,
  rotation = 0,
): [number, number][] {
  const out: [number, number][] = [];
  const latCos = Math.max(0.1, Math.cos((center[0] * Math.PI) / 180));
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2 + rotation;
    const dLat = (radiusKm / 111) * Math.sin(a);
    const dLng = (radiusKm / (111 * latCos)) * Math.cos(a);
    out.push([Number((center[0] + dLat).toFixed(4)), Number((center[1] + dLng).toFixed(4))]);
  }
  return out;
}

/** Sinh trụ điện dọc theo tuyến (nội suy, nhích nhẹ ra khỏi đường). */
function buildPoles(line: PowerLine | undefined, count: number): GridPowerPole[] {
  if (!line) return [];
  const route = line.route;
  if (!route || route.length < 2) return [];
  const types = ["Trụ thép", "Trụ thép", "Trụ néo", "Trụ thép", "Trụ đỡ"] as const;
  const heights =
    line.voltageLevel === "500kV"
      ? 62
      : line.voltageLevel === "220kV"
        ? 52
        : line.voltageLevel === "110kV"
          ? 36
          : 15;
  const poles: GridPowerPole[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const seg = Math.min(route.length - 2, Math.floor(t * (route.length - 1)));
    const local = t * (route.length - 1) - seg;
    const a = route[seg]!;
    const b = route[seg + 1]!;
    const lat = a[0] + (b[0] - a[0]) * local;
    const lng = a[1] + (b[1] - a[1]) * local;
    const off = i % 2 === 0 ? 0.0006 : -0.0006;
    poles.push({
      id: `tru-${line.id}-${String(i + 1).padStart(2, "0")}`,
      code: `TRU-${line.code.replace("DD-", "")}-${String(i + 1).padStart(2, "0")}`,
      number: String(i + 1),
      lineCode: line.code,
      type: types[i % types.length] ?? "Trụ thép",
      height: heights,
      yearBuilt: 2014 + (i % 8),
      foundationStatus: i % 9 === 0 ? "Trung bình" : "Tốt",
      technicalStatus: i % 11 === 0 ? "Cần theo dõi" : "Tốt",
      safetyCorridor: i % 7 === 0 ? "Có vi phạm" : "Đạt",
      latitude: Number((lat + off).toFixed(4)),
      longitude: Number((lng - off).toFixed(4)),
      workflowStatus: "APPROVED",
      // Demo: một số trụ có ảnh hiện trạng (yêu cầu NV1).
      ...(i % 3 === 0
        ? {
            images: [
              `https://picsum.photos/seed/tru-${line.id}-${i + 1}-a/640/360`,
              `https://picsum.photos/seed/tru-${line.id}-${i + 1}-b/640/360`,
            ],
          }
        : {}),
    });
  }
  return poles;
}

/** Sinh trụ điện QUY HOẠCH dọc theo tuyến quy hoạch (chưa xây dựng). */
function buildPlannedPoles(line: GridPowerLine | undefined, count: number): GridPowerPole[] {
  if (!line) return [];
  const route = line.route;
  if (!route || route.length < 2) return [];
  const heights = line.voltageLevel === "500kV" ? 62 : line.voltageLevel === "220kV" ? 52 : 36;
  const poles: GridPowerPole[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const seg = Math.min(route.length - 2, Math.floor(t * (route.length - 1)));
    const local = t * (route.length - 1) - seg;
    const a = route[seg]!;
    const b = route[seg + 1]!;
    const lat = a[0] + (b[0] - a[0]) * local;
    const lng = a[1] + (b[1] - a[1]) * local;
    const off = i % 2 === 0 ? 0.0006 : -0.0006;
    poles.push({
      id: `truqh-${line.id}-${String(i + 1).padStart(2, "0")}`,
      code: `TRU-QH-${line.code.replace("DD-", "")}-${String(i + 1).padStart(2, "0")}`,
      number: String(i + 1),
      lineCode: line.code,
      type: i % 3 === 0 ? "Trụ néo" : "Trụ thép",
      height: heights,
      yearBuilt: 0,
      foundationStatus: "Chưa thi công",
      technicalStatus: "Chưa xây dựng",
      safetyCorridor: "Chưa đánh giá",
      latitude: Number((lat + off).toFixed(4)),
      longitude: Number((lng - off).toFixed(4)),
      workflowStatus: "PENDING",
      planning: {
        location: `Khoảng cột ${i + 1}, ${line.name}`,
        spacingKm: Number((line.lengthKm / count).toFixed(1)),
        structureType: i % 3 === 0 ? "Trụ néo thép" : "Trụ thép tròn",
        clearanceStatus: "Chưa giải phóng mặt bằng",
        techDocs: "Thiết kế cơ sở đang thẩm định",
        envDocs: "Hồ sơ môi trường đang lập",
        ...(line.planning?.year !== undefined ? { year: line.planning.year } : {}),
        ...(line.planning?.progress ? { progress: line.planning.progress } : {}),
      },
    });
  }
  return poles;
}

function loadSeries(
  entityId: string,
  entityType: "substation" | "line",
  capacity: number,
  basePct: number,
  seed: number,
): GridLoadRecord[] {
  const periods = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];
  return periods.map((p, i) => {
    const wave = Math.sin((i + seed) * 0.8) * 0.06;
    const pct = Math.round(Math.min(160, Math.max(30, basePct + wave * 100)));
    return {
      id: `${entityId}-${p}`,
      entityType,
      entityId,
      timestamp: p,
      loadMw: Math.round((capacity * pct) / 100),
      capacityMw: capacity,
      loadFactorPct: pct,
    };
  });
}

// ─────────────────────────── Trạm biến áp (mở rộng) ───────────────────────────
function enrichSubstation(
  s: Substation | undefined,
  extra: Partial<GridSubstation>,
): GridSubstation {
  return { ...(s as Substation), workflowStatus: "APPROVED", ...extra };
}

export const GRID_SUBSTATIONS: GridSubstation[] = [
  enrichSubstation(SUBSTATIONS[0], {
    transformers: [
      {
        no: "AT1",
        type: "MBA 3 cuộn dây",
        capacityMva: 900,
        voltageRatio: "500/220/110 kV",
        yearCommissioned: 2015,
        loadFactorPct: 62,
        status: "Vận hành",
      },
      {
        no: "AT2",
        type: "MBA 3 cuộn dây",
        capacityMva: 900,
        voltageRatio: "500/220/110 kV",
        yearCommissioned: 2018,
        loadFactorPct: 58,
        status: "Vận hành",
      },
    ],
    supplyRadiusKm: 45,
  }),
  enrichSubstation(SUBSTATIONS[1], {
    transformers: [
      {
        no: "AT1",
        type: "MBA 220/110/22 kV",
        capacityMva: 250,
        voltageRatio: "220/110/22 kV",
        yearCommissioned: 2012,
        loadFactorPct: 74,
        status: "Vận hành",
      },
      {
        no: "AT2",
        type: "MBA 220/110/22 kV",
        capacityMva: 250,
        voltageRatio: "220/110/22 kV",
        yearCommissioned: 2020,
        loadFactorPct: 70,
        status: "Vận hành",
      },
    ],
    connectionPoints: [
      {
        id: "dn-01",
        name: "Đấu nối DD-220-01",
        type: "Lộ 220kV",
        voltageLevel: "220kV",
        hostSubstationId: "tba-02",
        latitude: 11.026,
        longitude: 106.376,
        status: "Vận hành",
      },
      {
        id: "dn-02",
        name: "Đấu nối KCN Trảng Bàng",
        type: "Xuất tuyến 22kV",
        voltageLevel: "22kV",
        hostSubstationId: "tba-02",
        latitude: 11.024,
        longitude: 106.378,
        status: "Vận hành",
      },
    ],
    supplyRadiusKm: 18,
  }),
  enrichSubstation(SUBSTATIONS[2], {
    transformers: [
      {
        no: "AT1",
        type: "MBA 220/110/22 kV",
        capacityMva: 225,
        voltageRatio: "220/110/22 kV",
        yearCommissioned: 2014,
        loadFactorPct: 116,
        status: "Quá tải",
      },
      {
        no: "AT2",
        type: "MBA 220/110/22 kV",
        capacityMva: 225,
        voltageRatio: "220/110/22 kV",
        yearCommissioned: 2016,
        loadFactorPct: 120,
        status: "Quá tải",
      },
    ],
    supplyRadiusKm: 20,
  }),
  enrichSubstation(SUBSTATIONS[3], {
    transformers: [
      {
        no: "AT1",
        type: "MBA 110/22 kV",
        capacityMva: 63,
        voltageRatio: "110/22 kV",
        yearCommissioned: 2008,
        loadFactorPct: 142,
        status: "Quá tải",
      },
      {
        no: "AT2",
        type: "MBA 110/22 kV",
        capacityMva: 63,
        voltageRatio: "110/22 kV",
        yearCommissioned: 2011,
        loadFactorPct: 148,
        status: "Quá tải",
      },
    ],
    connectionPoints: [
      {
        id: "dn-03",
        name: "Đấu nối DD-110-01",
        type: "Lộ 110kV",
        voltageLevel: "110kV",
        hostSubstationId: "tba-04",
        latitude: 11.3098,
        longitude: 106.0972,
        status: "Vận hành",
      },
      {
        id: "dn-04",
        name: "Đấu nối nội thành",
        type: "Xuất tuyến 22kV",
        voltageLevel: "22kV",
        hostSubstationId: "tba-04",
        latitude: 11.31,
        longitude: 106.0962,
        status: "Vận hành",
      },
    ],
    supplyRadiusKm: 8,
  }),
  enrichSubstation(SUBSTATIONS[4], {
    transformers: [
      {
        no: "AT1",
        type: "MBA 110/22 kV",
        capacityMva: 100,
        voltageRatio: "110/22 kV",
        yearCommissioned: 2016,
        loadFactorPct: 92,
        status: "Vận hành",
      },
    ],
    connectionPoints: [
      {
        id: "dn-05",
        name: "Đấu nối DD-110-01",
        type: "Lộ 110kV",
        voltageLevel: "110kV",
        hostSubstationId: "tba-05",
        latitude: 11.317,
        longitude: 106.022,
        status: "Vận hành",
      },
    ],
    supplyRadiusKm: 12,
  }),
  enrichSubstation(SUBSTATIONS[5], {
    transformers: [
      {
        no: "AT1",
        type: "MBA 110/22 kV",
        capacityMva: 80,
        voltageRatio: "110/22 kV",
        yearCommissioned: 2017,
        loadFactorPct: 132,
        status: "Quá tải",
      },
    ],
    supplyRadiusKm: 14,
  }),
  enrichSubstation(SUBSTATIONS[6], {
    transformers: [
      {
        no: "AT1",
        type: "MBA 110/22 kV",
        capacityMva: 63,
        voltageRatio: "110/22 kV",
        yearCommissioned: 2018,
        loadFactorPct: 94,
        status: "Vận hành",
      },
      {
        no: "AT2",
        type: "MBA 110/22 kV",
        capacityMva: 63,
        voltageRatio: "110/22 kV",
        yearCommissioned: 2024,
        loadFactorPct: 98,
        status: "Vận hành",
      },
    ],
    supplyRadiusKm: 14,
  }),
  enrichSubstation(SUBSTATIONS[7], {
    planned: {
      location: "Xã Đôn Thuận, huyện Trảng Bàng",
      investor: "EVNSPC",
      progress: "Đang thi công, dự kiến đóng điện quý IV/2026",
      year: 2026,
      phase: "constructing",
    },
    workflowStatus: "PENDING",
    transformers: [
      {
        no: "AT1",
        type: "MBA 220/110/22 kV",
        capacityMva: 250,
        voltageRatio: "220/110/22 kV",
        loadFactorPct: 0,
        status: "Chưa đóng điện",
      },
      {
        no: "AT2",
        type: "MBA 220/110/22 kV",
        capacityMva: 250,
        voltageRatio: "220/110/22 kV",
        loadFactorPct: 0,
        status: "Chưa đóng điện",
      },
    ],
    supplyRadiusKm: 20,
  }),
  {
    id: "tba-09",
    code: "TBA-220/QH3",
    name: "Trạm biến áp 220kV Tân Châu (quy hoạch)",
    type: "Trạm phân phối 220kV",
    voltageLevel: "220kV",
    district: "Tân Châu",
    address: "Xã Tân Hưng, Tân Châu",
    latitude: 11.4862,
    longitude: 106.0211,
    operator: "EVNSPC",
    designCapacity: 500,
    status: "Quy hoạch",
    supplyArea: "Huyện Tân Châu, Dương Minh Châu",
    workflowStatus: "PENDING",
    planned: {
      location: "Xã Tân Hưng, huyện Tân Châu",
      investor: "EVNSPC",
      progress: "Thẩm định dự án",
      year: 2028,
      phase: "investment_approved",
    },
    transformers: [
      {
        no: "AT1",
        type: "MBA 220/110/22 kV",
        capacityMva: 250,
        voltageRatio: "220/110/22 kV",
        loadFactorPct: 0,
        status: "Chưa đóng điện",
      },
    ],
    supplyRadiusKm: 22,
  },
  {
    id: "tba-10",
    code: "TBA-110/QH3",
    name: "Trạm biến áp 110kV KCN Phước Đông (quy hoạch)",
    type: "Trạm phân phối 110kV",
    voltageLevel: "110kV",
    district: "Gò Dầu",
    address: "Xã Phước Đông, Gò Dầu",
    latitude: 11.16,
    longitude: 106.26,
    operator: "EVNSPC",
    designCapacity: 125,
    status: "Quy hoạch",
    supplyArea: "KCN Phước Đông – Bời Lời",
    workflowStatus: "PENDING",
    planned: {
      location: "Xã Phước Đông, huyện Gò Dầu",
      investor: "EVNSPC",
      progress: "Lập dự án",
      year: 2027,
      phase: "drafting",
    },
    transformers: [
      {
        no: "AT1",
        type: "MBA 110/22 kV",
        capacityMva: 125,
        voltageRatio: "110/22 kV",
        loadFactorPct: 0,
        status: "Chưa đóng điện",
      },
    ],
    supplyRadiusKm: 12,
  },
];

// ─────────────────────────── Lưới điện (mở rộng) ───────────────────────────
function enrichLine(l: PowerLine | undefined, extra: Partial<GridPowerLine>): GridPowerLine {
  return { ...(l as PowerLine), workflowStatus: "APPROVED", ...extra } as GridPowerLine;
}

export const GRID_POWER_LINES: GridPowerLine[] = [
  enrichLine(POWER_LINES[0], {
    corridorStatus: "Đạt",
    technical: {
      conductorType: "Dây kép AC 4x400",
      crossSectionMm2: "4×400 mm²",
      strands: "ACSR",
      insulation: "Chuỗi cách điện thủy tinh",
      groundingMethod: "Dây chống sét 2 dây OPGW",
      lineCount: 2,
      avgHeightM: 48,
    },
    operation: {
      currentLoadA: 1280,
      voltageDeviationPct: 2.1,
      hotSpot: "Mối nối nhánh rẽ, khoảng cột 23",
      lossPct: 1.2,
      overloadCount: 0,
      faultRatePerYear: 0.6,
    },
  }),
  enrichLine(POWER_LINES[1], {
    corridorStatus: "Đạt",
    technical: {
      conductorType: "Dây kép AC 2x240",
      crossSectionMm2: "2×240 mm²",
      strands: "ACSR",
      insulation: "Chuỗi cách điện sứ",
      groundingMethod: "Dây chống sét 1 dây OPGW",
      lineCount: 2,
      avgHeightM: 38,
    },
    operation: {
      currentLoadA: 610,
      voltageDeviationPct: 3.4,
      hotSpot: "—",
      lossPct: 2.1,
      overloadCount: 1,
      faultRatePerYear: 1.1,
    },
  }),
  enrichLine(POWER_LINES[2], {
    corridorStatus: "Đạt",
    technical: {
      conductorType: "Dây đơn AC 240",
      crossSectionMm2: "240 mm²",
      strands: "ACSR",
      insulation: "Chuỗi cách điện sứ",
      groundingMethod: "Dây chống sét 1 dây OPGW",
      lineCount: 1,
      avgHeightM: 36,
    },
    operation: {
      currentLoadA: 545,
      voltageDeviationPct: 2.9,
      hotSpot: "—",
      lossPct: 2.4,
      overloadCount: 0,
      faultRatePerYear: 0.8,
    },
  }),
  enrichLine(POWER_LINES[3], {
    corridorStatus: "Đạt",
    technical: {
      conductorType: "Dây đơn AC 185",
      crossSectionMm2: "185 mm²",
      strands: "ACSR",
      insulation: "Chuỗi cách điện sứ",
      groundingMethod: "Dây chống sét 1 dây",
      lineCount: 1,
      avgHeightM: 28,
    },
    operation: {
      currentLoadA: 385,
      voltageDeviationPct: 4.2,
      hotSpot: "Khoảng cột 05, gần cây xanh",
      lossPct: 1.8,
      overloadCount: 0,
      faultRatePerYear: 1.6,
    },
  }),
  enrichLine(POWER_LINES[4], {
    corridorStatus: "Đạt",
    technical: {
      conductorType: "Dây đơn AC 185",
      crossSectionMm2: "185 mm²",
      strands: "ACSR",
      insulation: "Chuỗi cách điện sứ",
      groundingMethod: "Dây chống sét 1 dây",
      lineCount: 1,
      avgHeightM: 28,
    },
    operation: {
      currentLoadA: 312,
      voltageDeviationPct: 3.8,
      hotSpot: "—",
      lossPct: 2.6,
      overloadCount: 0,
      faultRatePerYear: 0.9,
    },
  }),
  enrichLine(POWER_LINES[5], {
    workflowStatus: "PENDING",
    corridorStatus: "Chưa đánh giá",
    planning: {
      location: "Tuyến Bến Cầu – Trảng Bàng",
      investor: "EVNSPC",
      progress: "Đang lập thiết kế cơ sở",
      year: 2028,
      investment: "~ 480 tỷ đồng",
      corridorWidthM: 35,
      phase: "drafting",
    },
  }),
  {
    id: "dd-07",
    code: "DD-220-03",
    name: "Đường dây 220kV Tây Ninh 1 – Tân Châu (quy hoạch)",
    voltageLevel: "220kV",
    operator: "EVNSPC",
    fromPoint: "TBA 500kV Tây Ninh 1",
    toPoint: "TBA 220kV Tân Châu (quy hoạch)",
    lengthKm: 62,
    districts: ["Trảng Bàng", "Dương Minh Châu", "Tân Châu"],
    status: "Quy hoạch",
    workflowStatus: "PENDING",
    corridorStatus: "Chưa đánh giá",
    planning: {
      location: "Trảng Bàng – Dương Minh Châu – Tân Châu",
      investor: "EVNSPC",
      progress: "Đang thẩm định",
      year: 2028,
      investment: "~ 720 tỷ đồng",
      corridorWidthM: 45,
      phase: "drafting",
    },
    route: [
      [11.095, 106.325],
      [11.18, 106.3],
      [11.28, 106.24],
      [11.36, 106.15],
      [11.42, 106.06],
      [11.4862, 106.0211],
    ],
  },
  {
    id: "dd-08",
    code: "DD-110-04",
    name: "Đường dây 110kV Châu Thành – Dương Minh Châu (quy hoạch)",
    voltageLevel: "110kV",
    operator: "EVNSPC",
    fromPoint: "TBA 110kV Châu Thành",
    toPoint: "TBA 110kV Dương Minh Châu",
    lengthKm: 24,
    districts: ["Châu Thành", "Dương Minh Châu"],
    status: "Quy hoạch",
    workflowStatus: "PENDING",
    corridorStatus: "Chưa đánh giá",
    planning: {
      location: "Châu Thành – Dương Minh Châu",
      investor: "EVNSPC",
      progress: "Lập dự án",
      year: 2027,
      corridorWidthM: 30,
      phase: "drafting",
    },
    route: [
      [11.3172, 106.0215],
      [11.35, 106.06],
      [11.37, 106.11],
      [11.38, 106.2],
    ],
  },
  {
    id: "dd-09",
    code: "DD-110-05",
    name: "Đường dây 110kV Dương Minh Châu – Tân Biên (quy hoạch)",
    voltageLevel: "110kV",
    operator: "EVNSPC",
    fromPoint: "TBA 110kV Dương Minh Châu",
    toPoint: "TBA 110kV Tân Biên",
    lengthKm: 21,
    districts: ["Dương Minh Châu", "Tân Biên"],
    status: "Quy hoạch",
    workflowStatus: "PENDING",
    corridorStatus: "Chưa đánh giá",
    planning: {
      location: "Dương Minh Châu – Tân Biên",
      investor: "EVNSPC",
      progress: "Lập dự án",
      year: 2028,
      corridorWidthM: 30,
      phase: "drafting",
    },
    route: [
      [11.38, 106.2],
      [11.46, 106.13],
      [11.52, 106.04],
      [11.5894, 105.9591],
    ],
  },
];

// ─────────────────────────── Trụ điện (sinh từ tuyến) ───────────────────────────
export const GRID_POWER_POLES: GridPowerPole[] = [
  ...buildPoles(POWER_LINES[0], 9),
  ...buildPoles(POWER_LINES[1], 7),
  ...buildPoles(POWER_LINES[2], 8),
  ...buildPoles(POWER_LINES[3], 6),
  ...buildPoles(POWER_LINES[4], 6),
];

// ─────────────────────────── Trụ điện quy hoạch (tuyến quy hoạch) ───────────────────────────
export const GRID_PLANNED_POLES: GridPowerPole[] = GRID_POWER_LINES.filter(
  (l) => l.status === "Quy hoạch",
).flatMap((l) => buildPlannedPoles(l, l.lengthKm >= 50 ? 7 : l.lengthKm >= 30 ? 6 : 5));

// ─────────────────────────── Vùng cấp điện & phụ tải ───────────────────────────
export const GRID_SUPPLY_AREAS: SupplyArea[] = GRID_SUBSTATIONS.filter(
  (s) => s.latitude && s.longitude && s.supplyRadiusKm,
).map((s) => ({
  id: `kvc-${s.id}`,
  name: `Vùng cấp điện ${s.name}`,
  substationId: s.id,
  district: s.district,
  polygons: [ring([s.latitude as number, s.longitude as number], s.supplyRadiusKm as number)],
}));

const LOAD_AREA_DEFS: {
  id: string;
  name: string;
  district: string;
  center: [number, number];
  radiusKm: number;
  peakMw: number;
}[] = [
  {
    id: "pt-01",
    name: "Phụ tải nội thành TP. Tây Ninh",
    district: "TP. Tây Ninh",
    center: [11.3095, 106.0967],
    radiusKm: 6,
    peakMw: 96,
  },
  {
    id: "pt-02",
    name: "Phụ tải KCN Trảng Bàng",
    district: "Trảng Bàng",
    center: [11.026, 106.378],
    radiusKm: 7,
    peakMw: 148,
  },
  {
    id: "pt-03",
    name: "Phụ tải KCN Gò Dầu",
    district: "Gò Dầu",
    center: [11.1581, 106.2614],
    radiusKm: 7,
    peakMw: 112,
  },
  {
    id: "pt-04",
    name: "Phụ tải huyện Bến Cầu",
    district: "Bến Cầu",
    center: [11.1321, 106.1187],
    radiusKm: 6,
    peakMw: 42,
  },
  {
    id: "pt-05",
    name: "Phụ tải huyện Châu Thành",
    district: "Châu Thành",
    center: [11.3172, 106.0215],
    radiusKm: 6,
    peakMw: 58,
  },
  {
    id: "pt-06",
    name: "Phụ tải huyện Tân Biên",
    district: "Tân Biên",
    center: [11.5894, 105.9591],
    radiusKm: 7,
    peakMw: 34,
  },
];

export const GRID_LOAD_AREAS: LoadArea[] = LOAD_AREA_DEFS.map((d) => ({
  id: d.id,
  name: d.name,
  district: d.district,
  peakMw: d.peakMw,
  polygons: [ring(d.center, d.radiusKm, 14, 0.3)],
}));

// ─────────────────────────── Tài sản quy hoạch ───────────────────────────
export const GRID_PLAN_ASSETS: GridPlanAsset[] = [
  ...GRID_SUBSTATIONS.filter((s) => s.status === "Quy hoạch").map((s) => ({
    id: `qh-${s.id}`,
    code: s.code,
    name: s.name,
    type: "substation" as const,
    voltageLevel: s.voltageLevel,
    district: s.district,
    location: s.address,
    investor: s.planned?.investor ?? s.operator,
    progress: s.planned?.progress ?? "Lập dự án",
    phase: (s.planned?.phase ?? "not_started") as PlanPhase,
    year: s.planned?.year ?? 2028,
    ...(s.latitude !== undefined ? { latitude: s.latitude } : {}),
    ...(s.longitude !== undefined ? { longitude: s.longitude } : {}),
    description: s.supplyArea,
  })),
  ...GRID_POWER_LINES.filter((l) => l.status === "Quy hoạch").map((l) => ({
    id: `qh-${l.id}`,
    code: l.code,
    name: l.name,
    type: "line" as const,
    voltageLevel: l.voltageLevel,
    district: l.districts.join(", "),
    location: l.planning?.location ?? `${l.fromPoint} – ${l.toPoint}`,
    investor: l.planning?.investor ?? l.operator,
    progress: l.planning?.progress ?? "Lập dự án",
    phase: (l.planning?.phase ?? "not_started") as PlanPhase,
    year: l.planning?.year ?? 2028,
    ...(l.route !== undefined ? { route: l.route } : {}),
    ...(l.planning?.investment !== undefined ? { description: l.planning.investment } : {}),
  })),
];

// ─────────────────────────── Lịch sử tải (time series) ───────────────────────────
export const GRID_LOAD_HISTORY: GridLoadRecord[] = [
  ...loadSeries("tba-01", "substation", 1500, 58, 1),
  ...loadSeries("tba-02", "substation", 380, 70, 2),
  ...loadSeries("tba-03", "substation", 320, 118, 3),
  ...loadSeries("tba-04", "substation", 105, 142, 4),
  ...loadSeries("tba-05", "substation", 78, 92, 5),
  ...loadSeries("tba-06", "substation", 62, 130, 6),
  ...loadSeries("dd-01", "line", 2200, 54, 7),
  ...loadSeries("dd-02", "line", 540, 72, 8),
  ...loadSeries("dd-03", "line", 420, 68, 9),
  ...loadSeries("dd-04", "line", 96, 74, 10),
  ...loadSeries("dd-05", "line", 90, 64, 11),
];

// ─────────────────────────── Dự báo (7 ngày / 1 tháng / Quý / 1 năm) ───────────────────────────
function forecastPoints(
  entityType: "substation" | "line",
  capacityMw: number,
  basePct: number,
  horizon: ForecastHorizon,
  seed: number,
): { points: ForecastPoint[]; risk: ForecastResult["risk"]; note: string } {
  const warnPct =
    entityType === "substation"
      ? GRID_CONFIG.thresholds.substationLoadWarnPct
      : GRID_CONFIG.thresholds.lineLoadWarnPct;
  const threshold = Math.round(capacityMw * (warnPct / 100));
  const counts: Record<ForecastHorizon, { label: string; n: number }> = {
    "7 ngày": { label: "D", n: 7 },
    "1 tháng": { label: "W", n: 4 },
    Quý: { label: "Q", n: 3 },
    "1 năm": { label: "M", n: 12 },
  };
  const { label, n } = counts[horizon];
  const points: ForecastPoint[] = [];
  for (let i = -Math.floor(n / 2); i < n; i++) {
    const drift = i >= 0 ? i * 0.8 : 0;
    const wave = Math.sin((i + seed) * 1.1) * 6;
    const pct = Math.min(160, Math.max(30, basePct + drift + wave));
    const isForecast = i >= 0;
    const pt: ForecastPoint = {
      period: `${label}${i < 0 ? `-${Math.abs(i)}` : i + 1}`,
      threshold,
    };
    if (isForecast) pt.forecast = Math.round((capacityMw * pct) / 100);
    else pt.history = Math.round((capacityMw * pct) / 100);
    points.push(pt);
  }
  const maxForecast = Math.max(
    ...points.filter((p) => p.forecast !== undefined).map((p) => p.forecast ?? 0),
  );
  const risk: ForecastResult["risk"] =
    maxForecast >= capacityMw ? "Cao" : maxForecast >= threshold ? "Trung bình" : "Thấp";
  const note =
    risk === "Cao"
      ? "Dự báo vượt khả năng mang tải. Đề xuất theo dõi sát và xem xét san tải/đầu tư nâng công suất."
      : risk === "Trung bình"
        ? "Dự báo gần ngưỡng cảnh báo. Cần theo dõi tải định kỳ."
        : "Dự báo trong giới hạn an toàn.";
  return { points, risk, note };
}

const FORECAST_SEED: Record<string, number> = {
  "tba-01:substation": 1,
  "tba-02:substation": 2,
  "tba-03:substation": 3,
  "tba-04:substation": 4,
  "tba-05:substation": 5,
  "tba-06:substation": 6,
  "dd-01:line": 7,
  "dd-02:line": 8,
  "dd-03:line": 9,
  "dd-04:line": 10,
  "dd-05:line": 11,
};

export function getForecastMock(
  entityType: "substation" | "line",
  entityId: string,
  horizon: ForecastHorizon,
): ForecastResult {
  const sub =
    entityType === "substation" ? GRID_SUBSTATIONS.find((s) => s.id === entityId) : undefined;
  const line = entityType === "line" ? GRID_POWER_LINES.find((l) => l.id === entityId) : undefined;
  const entity = sub ?? line;
  if (!entity) {
    return {
      entityType,
      entityId,
      entityLabel: entityId,
      horizon,
      unit: "MW",
      points: [],
      risk: "Thấp",
      note: "Chưa đủ dữ liệu để thực hiện dự báo cho đối tượng này.",
    };
  }
  const capacity =
    entityType === "substation"
      ? ((sub as GridSubstation).designCapacity ?? 0)
      : ((line as GridPowerLine).capacityMw ?? 0);
  const loadFactorPct =
    entityType === "substation"
      ? ((sub as GridSubstation).loadFactor ?? 60)
      : (() => {
          const cap = (line as GridPowerLine).capacityMw ?? 0;
          const load = (line as GridPowerLine).actualLoadMw ?? 0;
          return cap > 0 ? Math.round((load / cap) * 100) : 60;
        })();
  const seed = FORECAST_SEED[`${entityId}:${entityType}`] ?? 1;
  const { points, risk, note } = forecastPoints(entityType, capacity, loadFactorPct, horizon, seed);
  return {
    entityType,
    entityId,
    entityLabel: entity.name,
    horizon,
    unit: "MW",
    points,
    risk,
    note,
  };
}

// ─────────────────────────── Cảnh báo đối tượng cần quan tâm ───────────────────────────
export const GRID_WARNINGS: GridWarning[] = [
  {
    id: "cb-01",
    entityId: "tba-04",
    entityType: "substation",
    label: "TBA 110kV TP. Tây Ninh",
    severity: "danger",
    current: 152,
    forecast: 158,
    trend: "up",
    risk: "Cao",
    reason: "Hệ số tải vượt 100% cả hai MBA, dự báo tiếp tục tăng trong giờ cao điểm.",
    recommendation:
      "San tải sang lộ xuất tuyến lân cận; xem xét đẩy nhanh trạm 110kV Dương Minh Châu.",
  },
  {
    id: "cb-02",
    entityId: "tba-03",
    entityType: "substation",
    label: "TBA 220kV Gò Dầu",
    severity: "danger",
    current: 118,
    forecast: 124,
    trend: "up",
    risk: "Cao",
    reason: "Quá tải kéo dài do phụ tải KCN Gò Dầu tăng 6%/năm.",
    recommendation: "Rà soát tải các MBA, đàm phán dịch chuyển phụ tải giờ cao điểm.",
  },
  {
    id: "cb-03",
    entityId: "tba-06",
    entityType: "substation",
    label: "TBA 110kV Bến Cầu",
    severity: "warning",
    current: 132,
    forecast: 129,
    trend: "flat",
    risk: "Trung bình",
    reason: "Hệ số tải cao (>120%), chưa đến mức quá tải nghiêm trọng.",
    recommendation: "Theo dõi sát; chuẩn bị phương án lắp thêm MBA 110/22 kV.",
  },
  {
    id: "cb-04",
    entityId: "dd-02",
    entityType: "line",
    label: "Đường dây 220kV Tây Ninh – Trảng Bàng",
    severity: "warning",
    current: 72,
    forecast: 81,
    trend: "up",
    risk: "Trung bình",
    reason: "Tải tăng do phụ tải KCN Trảng Bàng; 1 lần quá tải ngắn hạn gần nhất.",
    recommendation: "Giám sát nhiệt độ mối nối; lập kế hoạch nâng cấp tiết diện dây.",
  },
  {
    id: "cb-05",
    entityId: "dd-04",
    entityType: "line",
    label: "Đường dây 110kV TP. Tây Ninh – Châu Thành",
    severity: "info",
    current: 74,
    forecast: 76,
    trend: "flat",
    risk: "Thấp",
    reason: "Tải ổn định, hành lang an toàn đạt chuẩn.",
    recommendation: "Tiếp tục theo dõi định kỳ.",
  },
  {
    id: "cb-06",
    entityId: "tba-01",
    entityType: "substation",
    label: "TBA 500kV Tây Ninh",
    severity: "info",
    current: 60,
    forecast: 63,
    trend: "up",
    risk: "Thấp",
    reason: "Khả năng mang tải còn dư địa lớn.",
    recommendation: "Sẵn sàng đấu nối các nguồn điện mới khi được phê duyệt.",
  },
];

// ─────────────────────────── Sự cố tuyến (có tọa độ — bản đồ số) ───────────────────────────
export const GRID_INCIDENTS_NV1: GridIncident[] = [
  {
    id: "sc-01",
    code: "SC-220-01",
    time: "14/05/2026 15:20",
    source: "Rơ le bảo vệ khoảng cách",
    type: "Chạm đất pha B",
    severity: "high",
    location: "Khoảng cột 23–24, xã Phước Lưu, Trảng Bàng",
    lineCode: "DD-220-01",
    substationCode: "TBA-220/1",
    affectedArea: "KCN Trảng Bàng (1 lộ 22kV)",
    customersAffected: 12,
    lostLoadMw: 24,
    outageDuration: "45 phút",
    criticalInfra: "—",
    handler: "PC Tây Ninh – Đội TT Trảng Bàng",
    responseTime: "18 phút",
    progress: "Đã xử lý",
    recoveryTime: "14/05/2026 16:05",
    latitude: 11.052,
    longitude: 106.341,
  },
  {
    id: "sc-02",
    code: "SC-220-02",
    time: "02/07/2026 09:45",
    source: "Giám sát nhiệt độ mối nối (SCADA)",
    type: "Quá nhiệt mối nối nhánh rẽ",
    severity: "medium",
    location: "Khoảng cột 18, xã An Tịnh, Trảng Bàng",
    lineCode: "DD-220-02",
    substationCode: "TBA-220/3",
    affectedArea: "Cụm CN An Tịnh",
    customersAffected: 6,
    lostLoadMw: 9,
    outageDuration: "—",
    criticalInfra: "—",
    handler: "PC Tây Ninh – Đội TT Trảng Bàng",
    responseTime: "35 phút",
    progress: "Đang theo dõi",
    recoveryTime: "—",
    latitude: 11.074,
    longitude: 106.36,
  },
  {
    id: "sc-03",
    code: "SC-110-01",
    time: "21/06/2026 11:05",
    source: "Người dân phản ánh",
    type: "Cây ngã vào đường dây",
    severity: "high",
    location: "Khoảng cột 05, xã Thạnh Đức, Gò Dầu",
    lineCode: "DD-110-01",
    substationCode: "TBA-110/3",
    affectedArea: "Xã Thạnh Đức, Bàu Đồn",
    customersAffected: 41,
    lostLoadMw: 18,
    outageDuration: "2 giờ 10 phút",
    criticalInfra: "—",
    handler: "PC Tây Ninh – Đội TT Gò Dầu",
    responseTime: "22 phút",
    progress: "Đã xử lý",
    recoveryTime: "21/06/2026 13:15",
    latitude: 11.198,
    longitude: 106.235,
  },
  {
    id: "sc-04",
    code: "SC-110-02",
    time: "08/07/2026 18:40",
    source: "Rơ le quá dòng",
    type: "Ngắn mạch tạm thời (sét)",
    severity: "medium",
    location: "Khoảng cột 12, phường Ninh Sơn, TP. Tây Ninh",
    lineCode: "DD-110-02",
    substationCode: "TBA-110/2",
    affectedArea: "Nội thành TP. Tây Ninh",
    customersAffected: 8,
    lostLoadMw: 12,
    outageDuration: "25 phút",
    criticalInfra: "Bệnh viện Đa khoa tỉnh (máy phát dự phòng)",
    handler: "PC Tây Ninh – Đội TT TP",
    responseTime: "15 phút",
    progress: "Đã xử lý",
    recoveryTime: "08/07/2026 19:05",
    latitude: 11.301,
    longitude: 106.087,
  },
  {
    id: "sc-05",
    code: "SC-110-03",
    time: "12/07/2026 14:10",
    source: "Giám sát SCADA",
    type: "Sụt áp thoáng qua",
    severity: "medium",
    location: "Khoảng cột 21, xã Long Thuận, Bến Cầu",
    lineCode: "DD-110-03",
    substationCode: "TBA-110/4",
    affectedArea: "Xã Long Thuận, Long Khánh",
    customersAffected: 0,
    lostLoadMw: 0,
    outageDuration: "—",
    criticalInfra: "—",
    handler: "PC Tây Ninh – Đội TT Bến Cầu",
    responseTime: "30 phút",
    progress: "Đang xác minh",
    recoveryTime: "—",
    latitude: 11.126,
    longitude: 106.087,
  },
  {
    id: "sc-06",
    code: "SC-220-03",
    time: "28/07/2026 08:05",
    source: "Kiểm tra hiện trường định kỳ",
    type: "Vi phạm hành lang (san lấp đất)",
    severity: "medium",
    location: "Khoảng cột 31, xã Phước Vinh, Châu Thành",
    lineCode: "DD-220-01",
    substationCode: "TBA-500kV",
    affectedArea: "—",
    customersAffected: 0,
    lostLoadMw: 0,
    outageDuration: "—",
    criticalInfra: "—",
    handler: "Ban AT-AN PC Tây Ninh",
    responseTime: "—",
    progress: "Lập biên bản xử lý",
    recoveryTime: "—",
    latitude: 11.145,
    longitude: 106.298,
  },
];

// ─────────────────────────── Lịch sử vận hành (đóng/cắt, bảo trì, sự cố) ───────────────────────────
export const GRID_OPERATION_LOGS: OperationLog[] = [
  {
    id: "log-01",
    time: "08/08/2026 09:30",
    type: "energize",
    reason: "Đóng điện trở lại sau bảo trì định kỳ mùa mưa.",
    affected: "TBA 110kV Bến Cầu · DD-110-03",
    actor: "PC Tây Ninh – Điều độ",
  },
  {
    id: "log-02",
    time: "07/08/2026 07:00",
    type: "deenergize",
    reason: "Cắt điện bảo trì định kỳ máy biến áp AT1 (vệ sinh cách điện, siết mối nối).",
    affected: "TBA 110kV Bến Cầu",
    actor: "PC Tây Ninh – Đội TT Bến Cầu",
  },
  {
    id: "log-03",
    time: "05/08/2026 10:15",
    type: "maintenance",
    reason: "Xử lý điểm phát nhiệt mối nối nhánh rẽ khoảng cột 18.",
    affected: "DD-220-02 (Trảng Bàng – Gò Dầu)",
    actor: "PC Tây Ninh – Đội TT Trảng Bàng",
  },
  {
    id: "log-04",
    time: "28/07/2026 08:05",
    type: "incident",
    reason: "Vi phạm hành lang an toàn: san lấp đất dưới khoảng cột 31.",
    affected: "DD-220-01 (Tây Ninh – Phước Đông)",
    actor: "Ban AT-AN PC Tây Ninh",
  },
  {
    id: "log-05",
    time: "21/07/2026 14:30",
    type: "switch",
    reason: "Chuyển tải lộ 471 sang lộ 472 trong giờ cao điểm trưa (kiểm soát quá tải).",
    affected: "TBA 220kV Gò Dầu · Lộ 471/472",
    actor: "PC Tây Ninh – Điều độ",
  },
  {
    id: "log-06",
    time: "18/07/2026 06:45",
    type: "deenergize",
    reason: "Cắt điện để thay chuỗi cách điện hư hỏng do sét khoảng cột 12.",
    affected: "DD-110-02 (TP. Tây Ninh – Châu Thành)",
    actor: "PC Tây Ninh – Đội TT TP",
  },
  {
    id: "log-07",
    time: "18/07/2026 11:20",
    type: "energize",
    reason: "Đóng điện trở lại sau thay chuỗi cách điện.",
    affected: "DD-110-02 (TP. Tây Ninh – Châu Thành)",
    actor: "PC Tây Ninh – Đội TT TP",
  },
  {
    id: "log-08",
    time: "15/07/2026 09:00",
    type: "maintenance",
    reason: "Kiểm tra, xử lý cây xanh trong hành lang tuyến.",
    affected: "DD-110-01 (Gò Dầu – TP. Tây Ninh)",
    actor: "PC Tây Ninh – Đội TT Gò Dầu",
  },
  {
    id: "log-09",
    time: "02/07/2026 09:45",
    type: "incident",
    reason: "Quá nhiệt mối nối nhánh rẽ khoảng cột 18 — lập kế hoạch xử lý.",
    affected: "DD-220-02 (Trảng Bàng – Gò Dầu)",
    actor: "PC Tây Ninh – Đội TT Trảng Bàng",
  },
  {
    id: "log-10",
    time: "28/06/2026 08:20",
    type: "switch",
    reason:
      "Thao tác đóng/cắt trung hạ áp phục vụ nghiệm thu công trình đấu nối ĐMT mái nhà KCN Trảng Bàng.",
    affected: "TBA 220kV Trảng Bàng · Điểm đấu nối dn-02",
    actor: "PC Tây Ninh – Điều độ",
  },
];

// ─────────────────────────── Nguồn NLTT đấu nối lưới (khả năng tiếp nhận) ───────────────────────────
export const GRID_RENEWABLES: RenewableSource[] = [
  {
    id: "nltt-01",
    code: "ĐMT-02",
    owner: "Công ty TNHH Dệt may Châu Thành",
    type: "ĐMT mái nhà tự sản xuất, tự tiêu thụ",
    capacityKw: 520,
    installedKw: 480,
    gridCapacityKw: 500,
    hostingCapacityKw: 220,
    overload: "Cảnh báo",
    hostSubstationId: "tba-04",
    hostLineCode: "DD-110-02",
    connectionPoint: "Xuất tuyến 22kV nội thành",
    status: "Vận hành",
    energizedYear: 2024,
    latitude: 11.3164,
    longitude: 106.0194,
  },
  {
    id: "nltt-02",
    code: "ĐMT-05",
    owner: "Công ty CP Cao su Tây Ninh Phát",
    type: "ĐMT mái nhà tự sản xuất, tự tiêu thụ",
    capacityKw: 420,
    installedKw: 420,
    gridCapacityKw: 450,
    hostingCapacityKw: 180,
    overload: "Cảnh báo",
    hostSubstationId: "tba-06",
    hostLineCode: "DD-110-03",
    connectionPoint: "Xuất tuyến 22kV Bến Cầu",
    status: "Vận hành",
    energizedYear: 2023,
    latitude: 11.5872,
    longitude: 105.9621,
  },
  {
    id: "nltt-03",
    code: "ĐMT-08",
    owner: "KCN Trảng Bàng (tòa nhà điều hành)",
    type: "ĐMT mái nhà tự sản xuất, tự tiêu thụ",
    capacityKw: 350,
    installedKw: 350,
    gridCapacityKw: 380,
    hostingCapacityKw: 240,
    overload: "Không",
    hostSubstationId: "tba-02",
    hostLineCode: "DD-220-02",
    connectionPoint: "Đấu nối KCN Trảng Bàng (dn-02)",
    status: "Vận hành",
    energizedYear: 2025,
    latitude: 11.0269,
    longitude: 106.3789,
  },
  {
    id: "nltt-04",
    code: "ĐMT-11",
    owner: "Công ty TNHH Thực phẩm Bình Điền",
    type: "ĐMT mái nhà tự sản xuất, tự tiêu thụ",
    capacityKw: 280,
    installedKw: 280,
    gridCapacityKw: 300,
    hostingCapacityKw: 300,
    overload: "Không",
    hostSubstationId: "tba-01",
    hostLineCode: "DD-220-01",
    connectionPoint: "Xuất tuyến 22kV KCN Phước Đông",
    status: "Vận hành",
    energizedYear: 2022,
    latitude: 11.145,
    longitude: 106.262,
  },
  {
    id: "nltt-05",
    code: "ĐMT-12",
    owner: "Cụm CN An Tịnh (quỹ đất 2,5 ha)",
    type: "ĐMT mặt đất nhỏ lẻ",
    capacityKw: 1500,
    installedKw: 0,
    gridCapacityKw: 1500,
    hostingCapacityKw: 200,
    overload: "Vượt giới hạn",
    hostSubstationId: "tba-02",
    hostLineCode: "DD-220-02",
    connectionPoint: "Đề xuất đấu nối lộ 471",
    status: "Chưa vận hành",
    latitude: 11.082,
    longitude: 106.352,
  },
];

// ─────────────────────────── Khu vực quá tải (bản đồ số) ───────────────────────────
export const GRID_OVERLOAD_ZONES: OverloadZone[] = [
  {
    id: "qt-01",
    label: "Khu vực quá tải TBA 220kV Gò Dầu",
    kind: "substation",
    refId: "tba-03",
    district: "Gò Dầu",
    loadFactorPct: 118,
    note: "Quá tải kéo dài do phụ tải KCN Gò Dầu tăng ~6%/năm. Đề xuất nâng công suất AT1.",
    polygons: [ring([11.1301, 106.2531], 20, 14, 0.2)],
  },
  {
    id: "qt-02",
    label: "Khu vực quá tải TBA 110kV TP. Tây Ninh",
    kind: "substation",
    refId: "tba-04",
    district: "TP. Tây Ninh",
    loadFactorPct: 142,
    note: "Hệ số tải vượt 100% cả hai MBA; cần san tải + đẩy nhanh TBA 110kV Dương Minh Châu.",
    polygons: [ring([11.3095, 106.0967], 8, 14, 0.4)],
  },
  {
    id: "qt-03",
    label: "Khu vực quá tải TBA 110kV Bến Cầu",
    kind: "substation",
    refId: "tba-06",
    district: "Bến Cầu",
    loadFactorPct: 132,
    note: "Tải cao (>120%) trong giờ cao điểm; chuẩn bị lắp thêm MBA 110/22 kV.",
    polygons: [ring([11.1321, 106.1187], 14, 14, 0.6)],
  },
  {
    id: "qt-04",
    label: "Đoạn quá tải ngắn hạn DD-220-02 (Trảng Bàng – Gò Dầu)",
    kind: "line",
    refId: "dd-02",
    district: "Trảng Bàng",
    loadFactorPct: 72,
    note: "1 lần quá tải ngắn hạn gần nhất (mùa khô). Dự báo tải tăng do KCN Trảng Bàng mở rộng.",
    polygons: [ring([11.026, 106.378], 7, 14, 0.8)],
  },
];

// ─────────────────────────── Gắn trạng thái vận hành vào đối tượng ───────────────────────────
// Gán đóng/cắt, lịch sử vận hành và sự cố tuyến cho từng trạm/tuyến (demo).
GRID_POWER_LINES.forEach((l) => {
  l.switchingState = l.switchingState ?? (l.id === "dd-04" ? "MAINTENANCE" : "OPERATING");
  l.operationLogs = GRID_OPERATION_LOGS.filter((log) => log.affected.includes(l.code));
  l.incidentRecords = GRID_INCIDENTS_NV1.filter((inc) => inc.lineCode === l.code);
  if (l.status === "Quy hoạch") {
    l.planningPoles = GRID_PLANNED_POLES.filter((p) => p.lineCode === l.code);
  }
});

GRID_SUBSTATIONS.forEach((s) => {
  s.switchingState = s.switchingState ?? (s.status === "Quy hoạch" ? "CONSTRUCTION" : "OPERATING");
  s.operationLogs = GRID_OPERATION_LOGS.filter((log) => log.affected.includes(s.code));
});

export function buildTask1GridData(): Task1GridData {
  const operatingSubs = GRID_SUBSTATIONS.filter((s) => s.status !== "Quy hoạch");
  const operatingLines = GRID_POWER_LINES.filter((l) => l.status !== "Quy hoạch");
  const overloaded = operatingSubs.filter((s) => (s.loadFactor ?? 0) >= 100).length;
  const highLoadLines = operatingLines.filter((l) => {
    const cap = l.capacityMw ?? 0;
    return cap > 0 && ((l.actualLoadMw ?? 0) / cap) * 100 >= GRID_CONFIG.thresholds.lineLoadWarnPct;
  }).length;
  const withLoss = operatingLines.filter((l) => l.lossPct !== undefined);

  return {
    substations: GRID_SUBSTATIONS,
    lines: GRID_POWER_LINES,
    poles: GRID_POWER_POLES,
    plannedPoles: GRID_PLANNED_POLES,
    planned: GRID_PLAN_ASSETS,
    supplyAreas: GRID_SUPPLY_AREAS,
    loadAreas: GRID_LOAD_AREAS,
    incidents: GRID_INCIDENTS_NV1,
    overloadZones: GRID_OVERLOAD_ZONES,
    renewables: GRID_RENEWABLES,
    operationLogs: GRID_OPERATION_LOGS,
    warnings: GRID_WARNINGS,
    overview: {
      totalSubstations: operatingSubs.length,
      totalSubstationCapacityMva: operatingSubs.reduce((s, x) => s + (x.designCapacity ?? 0), 0),
      totalOperatingCapacityMva: operatingSubs.reduce((s, x) => s + (x.operatingCapacity ?? 0), 0),
      overloadedSubstations: overloaded,
      totalLines: operatingLines.length,
      totalLineLengthKm: Math.round(operatingLines.reduce((s, x) => s + x.lengthKm, 0) * 10) / 10,
      highLoadLines,
      avgLossPct: withLoss.length
        ? Math.round((withLoss.reduce((s, x) => s + (x.lossPct ?? 0), 0) / withLoss.length) * 10) /
          10
        : 0,
    },
  };
}
