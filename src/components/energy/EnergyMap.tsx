import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Layer as LeafletLayer,
  LayerGroup,
  Map as LeafletMap,
  Marker as LeafletMarker,
  Polyline as LeafletPolyline,
} from "leaflet";
import type {
  ChargingStation,
  EmissionSource,
  EnergyGisData,
  GridIncident,
  KeyEnergyConsumer,
  PowerProject,
  RooftopSolar,
  Substation,
} from "@/lib/energy-types";
import { MapPin, Search, X } from "lucide-react";
import {
  BoundaryScopeControl,
  GisMapChrome,
  MapSearchTypeSelect,
  type GisFeatureDetail,
  type GisLayerControl,
  type GisLegendItem,
} from "@/components/gis/GisMapChrome";
import { energyEntityIconAsset, geoServerIconAsset, GIS_ICON_ASSETS, GIS_ICON_FILTER, GIS_VISUALS } from "@/config/gis-visuals";
import type { GeoServerLayerDefinition } from "@/config/geoserver-layers";
import { cn } from "@/lib/utils";
import { isInsideTayNinh, useTayNinhBoundary } from "@/lib/tay-ninh-boundary";

const TAY_NINH_CENTER: [number, number] = [11.3066, 106.15];

export type EnergyMapLayerKey =
  | "substations"
  | "lines500"
  | "lines220"
  | "lines110"
  | "lines22"
  | "poles"
  | "projects"
  | "rooftopSolar"
  | "incidents"
  | "emissions"
  | "chargingStations"
  | "keyConsumers";

const DEFAULT_LAYERS: EnergyMapLayerKey[] = [
  "substations",
  "lines500",
  "lines220",
  "lines110",
  "lines22",
  "projects",
  "rooftopSolar",
  "incidents",
  "emissions",
  "chargingStations",
  "keyConsumers",
];

const LAYER_LABEL: Record<EnergyMapLayerKey, string> = {
  substations: "Trạm biến áp",
  lines500: "Đường dây 500kV",
  lines220: "Đường dây 220kV",
  lines110: "Đường dây 110kV",
  lines22: "Đường dây 22kV",
  poles: "Trụ điện",
  projects: "Dự án nguồn điện",
  rooftopSolar: "Điện mặt trời mái nhà",
  incidents: "Sự cố",
  emissions: "Phát thải Carbon",
  chargingStations: "Trạm sạc",
  keyConsumers: "Phụ tải trọng điểm",
};

/** Nhóm các layer con thành một ô tích trong bảng điều khiển (vd "Lưới điện" gộp 4 cấp điện áp). */
export interface EnergyMapLayerOption {
  id?: string;
  label: string;
  keys: EnergyMapLayerKey[];
  source?: GisLayerControl["source"];
  color?: string;
  glyph?: string;
  icon?: string;
  description?: string;
  defaultVisible?: boolean;
}

// Mặc định: mỗi lớp một ô tích riêng — giữ nguyên hành vi cũ khi không truyền layerOptions.
const DEFAULT_LAYER_OPTIONS: EnergyMapLayerOption[] = (
  Object.keys(LAYER_LABEL) as EnergyMapLayerKey[]
).map((key) => ({ label: LAYER_LABEL[key], keys: [key] }));

type EnergyMapEntity =
  | { kind: "substation"; item: Substation }
  | { kind: "project"; item: PowerProject }
  | { kind: "rooftop"; item: RooftopSolar }
  | { kind: "incident"; item: GridIncident }
  | { kind: "emission"; item: EmissionSource }
  | { kind: "charging"; item: ChargingStation }
  | { kind: "consumer"; item: KeyEnergyConsumer };

export interface EnergyMapChromeConfig {
  statusText?: string;
  extraLayer?: {
    id: string;
    label: string;
    source: GisLayerControl["source"];
    color: string;
    glyph: string;
    description?: string;
    defaultVisible?: boolean;
  };
  managementRoutes?: Partial<
    Record<
      EnergyMapEntity["kind"],
      {
        href: string;
        label?: string;
      }
    >
  >;
}

/** Vùng/circle bổ sung trên bản đồ (khu vực quá tải, vùng nhu cầu sạc cao...). */
export interface EnergyMapExtraCircle {
  id: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  color: string;
  label: string;
  fillOpacity?: number;
  popup?: string;
  interactive?: boolean;
}

/** Marker bổ sung trên bản đồ (vị trí trạm sạc đề xuất, cảnh báo AI...). */
export interface EnergyMapExtraMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  sublabel?: string;
  color: string;
  glyph?: string;
  onSelect?: () => void;
}

type MapSearchItem = {
  key: string;
  label: string;
  sublabel: string;
  lat: number;
  lng: number;
  type: string;
};

function pointKey(entity: EnergyMapEntity) {
  return `${entity.kind}:${entity.item.id}`;
}

function entitySearchLabel(entity: EnergyMapEntity) {
  if (entity.kind === "rooftop") return entity.item.owner;
  if (entity.kind === "incident") return `${entity.item.code} · ${entity.item.type}`;
  if (entity.kind === "emission") return entity.item.unit;
  return entity.item.name;
}

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi-VN")
    .trim();
}

function lineEntityId(key: string) {
  return key.startsWith("line:") ? key.slice("line:".length) : key;
}

function optionControlId(option: EnergyMapLayerOption, index: number) {
  const suffix = option.id ?? option.keys.join("-");
  return `energy:${suffix || index}`;
}

function layerVisual(key: EnergyMapLayerKey) {
  switch (key) {
    case "substations":
      return GIS_VISUALS.substation;
    case "lines500":
      return { color: "#1d4ed8", glyph: "—" };
    case "lines220":
      return { color: "#7c3aed", glyph: "—" };
    case "lines110":
      return GIS_VISUALS.lineHigh;
    case "lines22":
      return GIS_VISUALS.lineMedium;
    case "poles":
      return GIS_VISUALS.pole;
    case "projects":
      return GIS_VISUALS.renewable;
    case "rooftopSolar":
      return GIS_VISUALS.solar;
    case "incidents":
      return GIS_VISUALS.incident;
    case "emissions":
      return { color: "#2e7d32", glyph: "CO₂" };
    case "chargingStations":
      return GIS_VISUALS.charging;
    case "keyConsumers":
      return GIS_VISUALS.consumer;
  }
}

function geoServerGlyph(layer: GeoServerLayerDefinition) {
  if (layer.geometry === "line") return "—";
  if (layer.kind === "boundary") return GIS_VISUALS.boundary.glyph;
  if (layer.kind === "generation") return GIS_VISUALS.renewable.glyph;
  if (layer.kind === "charging") return GIS_VISUALS.charging.glyph;
  if (layer.kind === "oil") return GIS_VISUALS.oil.glyph;
  if (layer.kind === "oilStorage") return GIS_VISUALS.oilStorage.glyph;
  if (layer.kind === "consumer") return GIS_VISUALS.consumer.glyph;
  return GIS_VISUALS.substation.glyph;
}

function layerObjectCount(key: EnergyMapLayerKey, data: EnergyGisData) {
  switch (key) {
    case "substations":
      return data.substations.length;
    case "lines500":
      return data.lines.filter((line) => line.voltageLevel === "500kV").length;
    case "lines220":
      return data.lines.filter((line) => line.voltageLevel === "220kV").length;
    case "lines110":
      return data.lines.filter((line) => line.voltageLevel === "110kV").length;
    case "lines22":
      return data.lines.filter((line) => line.voltageLevel === "22kV").length;
    case "poles":
      return data.poles.length;
    case "projects":
      return data.projects.length;
    case "rooftopSolar":
      return data.rooftopSolar.length;
    case "incidents":
      return data.incidents.length;
    case "emissions":
      return data.emissionSources.length;
    case "chargingStations":
      return data.chargingStations.length;
    case "keyConsumers":
      return data.keyConsumers.length;
  }
}

function optionObjectCount(option: EnergyMapLayerOption, data: EnergyGisData) {
  return option.keys.reduce((total, key) => total + layerObjectCount(key, data), 0);
}

function entityFeatureDetail(
  entity: EnergyMapEntity,
  mapChrome?: EnergyMapChromeConfig,
): GisFeatureDetail {
  const management = mapChrome?.managementRoutes?.[entity.kind];
  const common = {
    id: pointKey(entity),
    source: "hệ thống GIS",
    managementHref: management?.href,
    managementLabel: management?.label,
  };

  if (entity.kind === "substation") {
    const item = entity.item;
    const loadFactor = item.loadFactor ?? 0;
    return {
      ...common,
      title: item.name,
      subtitle: `${item.code} · ${item.district}`,
      category: "Trạm biến áp",
      status: item.status,
      severity: loadFactor >= 100 ? "danger" : loadFactor >= 80 ? "warning" : "info",
      fields: [
        { label: "Cấp điện áp", value: item.voltageLevel },
        { label: "Công suất thiết kế", value: `${item.designCapacity ?? 0} MVA` },
        { label: "Công suất vận hành", value: `${item.operatingCapacity ?? 0} MVA` },
        { label: "Dư địa", value: `${item.availableCapacity ?? 0} MVA` },
        { label: "Mức tải", value: `${loadFactor}%` },
        { label: "Đơn vị vận hành", value: item.operator },
        { label: "Địa chỉ", value: item.address },
      ],
      note:
        loadFactor >= 80 ? "Đối tượng cần được lưu ý trong thẩm tra khả năng đấu nối." : undefined,
    };
  }

  if (entity.kind === "project") {
    const item = entity.item;
    return {
      ...common,
      title: item.name,
      subtitle: `${item.code} · ${item.district}`,
      category: "Nguồn năng lượng",
      status: item.status,
      fields: [
        { label: "Loại nguồn", value: item.type },
        { label: "Công suất thiết kế", value: `${item.designCapacityMw ?? 0} MW` },
        { label: "Sản lượng", value: `${item.outputGWh ?? 0} GWh` },
        { label: "Nhà đầu tư", value: item.investor },
        { label: "Đơn vị vận hành", value: item.operator },
        { label: "Địa chỉ", value: item.address },
      ],
    };
  }

  if (entity.kind === "rooftop") {
    const item = entity.item;
    return {
      ...common,
      title: item.owner,
      subtitle: `${item.code} · ${item.district}`,
      category: "Điện mặt trời mái nhà",
      status: item.status,
      fields: [
        { label: "Loại khách hàng", value: item.customerType },
        { label: "Công suất lắp đặt", value: `${item.installedCapacityKw ?? 0} kWp` },
        { label: "Điểm đấu nối", value: item.connection.point },
        { label: "Dư địa tiếp nhận", value: `${item.connection.hostingCapacityKw} kW` },
        { label: "Tình trạng quá tải", value: item.connection.overload },
        { label: "Địa chỉ", value: item.address },
      ],
    };
  }

  if (entity.kind === "incident") {
    const item = entity.item;
    const severity =
      item.severity === "severe" || item.severity === "high"
        ? "danger"
        : item.severity === "medium"
          ? "warning"
          : "info";
    return {
      ...common,
      title: `${item.code} · ${item.type}`,
      subtitle: item.location,
      category: "Sự cố lưới điện",
      status: item.progress ?? item.severity,
      severity,
      fields: [
        { label: "Thời gian", value: item.time },
        { label: "Khu vực ảnh hưởng", value: item.affectedArea },
        { label: "Khách hàng ảnh hưởng", value: item.customersAffected },
        { label: "Phụ tải mất", value: item.lostLoadMw != null ? `${item.lostLoadMw} MW` : null },
        { label: "Đơn vị xử lý", value: item.handler },
        { label: "Tuyến điện", value: item.lineCode },
      ],
      recommendation:
        severity === "danger"
          ? "Kiểm tra ảnh hưởng của sự cố và phương án cấp điện dự phòng trước khi chấp thuận đấu nối."
          : undefined,
    };
  }

  if (entity.kind === "emission") {
    const item = entity.item;
    return {
      ...common,
      title: item.unit,
      subtitle: `${item.code} · ${item.district}`,
      category: "Nguồn phát thải",
      status: item.status,
      fields: [
        { label: "Loại nguồn", value: item.sourceType },
        { label: "CO₂e", value: `${item.co2e.toLocaleString("vi-VN")} tấn` },
        { label: "Cường độ", value: `${item.intensity} gCO₂e/kWh` },
        { label: "Công suất", value: item.capacityMw != null ? `${item.capacityMw} MW` : null },
        { label: "Nhà đầu tư", value: item.investor },
        { label: "Địa chỉ", value: item.address },
      ],
    };
  }

  if (entity.kind === "consumer") {
    const item = entity.item;
    return {
      ...common,
      title: item.name,
      subtitle: `${item.code} · ${item.district}`,
      category: "Phụ tải trọng điểm",
      status: item.savingAssessment,
      fields: [
        { label: "Loại đơn vị", value: item.type },
        { label: "Lĩnh vực", value: item.sector },
        { label: "Tiêu thụ", value: `${item.consumptionKwh.toLocaleString("vi-VN")} kWh` },
        { label: "Công suất cực đại", value: `${item.maxDemandKw.toLocaleString("vi-VN")} kW` },
        { label: "Hiệu suất", value: `${item.efficiencyPct}%` },
        { label: "Địa chỉ", value: item.address },
      ],
    };
  }

  const item = entity.item;
  return {
    ...common,
    title: item.name,
    subtitle: `${item.code} · ${item.district}`,
    category: "Trạm sạc xe điện",
    status: item.status,
    fields: [
      { label: "Loại trạm", value: item.type },
      { label: "Công suất", value: `${item.powerKw} kW` },
      { label: "Tổng số cổng", value: item.ports.ccs2 + item.ports.chademo + item.ports.acType2 },
      { label: "Cổng trống", value: item.freePorts },
      { label: "Dư địa cấp điện", value: `${item.supplyCapacityKw} kW` },
      { label: "Đơn vị vận hành", value: item.operator },
      { label: "Địa chỉ", value: item.address },
    ],
  };
}

function rowHtml(label: string, value: string | number | undefined) {
  return `<div style="display:flex;justify-content:space-between;gap:12px;font-size:11px;padding:2px 0"><span style="color:#64748b">${label}</span><span style="font-weight:600;color:#0f2a4a;text-align:right">${value ?? "Đang cập nhật"}</span></div>`;
}

function markerColor(
  kind: EnergyMapEntity["kind"],
  item: EnergyMapEntity["item"],
  chargingColor?: string,
) {
  if (kind === "charging" && chargingColor) return chargingColor;
  if (kind === "incident") return "#C62828";
  if (kind === "charging") return "#7C3AED";
  if (kind === "consumer") return "#0F766E";
  if (kind === "emission") return "#2E7D32";
  if (kind === "rooftop") return "#0EA5E9";
  if (kind === "project") return "#16A34A";
  if ("loadFactor" in item && (item.loadFactor ?? 0) >= 100) return "#C62828";
  return "#1565C0";
}

function iconHtml(
  kind: EnergyMapEntity["kind"],
  color: string,
  selected: boolean,
  ringExtra = false,
  risk = false,
) {
  const asset = energyEntityIconAsset(kind);
  const glyph =
    kind === "substation"
      ? "⚡"
      : kind === "project"
        ? "✦"
        : kind === "rooftop"
          ? "☀"
          : kind === "incident"
            ? "·"
            : kind === "emission"
              ? "CO₂"
              : kind === "consumer"
                ? "kW"
                : "EV";
  const ring = selected
    ? "box-shadow:0 0 0 4px rgba(21,101,192,.25);"
    : ringExtra
      ? "box-shadow:0 0 0 4px rgba(198,40,40,.45);"
      : "";
  const animationClass =
    kind === "incident"
      ? " energy-asset-marker--critical"
      : risk
        ? " energy-asset-marker--warning"
        : "";
  return `<div class="energy-asset-marker${animationClass}" style="width:30px;height:30px;border-radius:999px;background:${color};border:2px solid #fff;color:#fff;display:grid;place-items:center;font-size:10px;font-weight:800;${ring}">${asset ? `<img src="${asset}" alt="" style="width:17px;height:17px;filter:${GIS_ICON_FILTER};" />` : glyph}</div>`;
}

function buildPopup(entity: EnergyMapEntity, onOpen: () => void): HTMLElement {
  const el = document.createElement("div");
  el.style.minWidth = "245px";
  el.style.fontFamily = "Inter, system-ui, sans-serif";

  if (entity.kind === "substation") {
    const s = entity.item;
    el.innerHTML = `<div style="font-weight:700;color:#0f2a4a;margin-bottom:8px">${s.name}</div>
      ${rowHtml("Cấp điện áp", s.voltageLevel)}
      ${rowHtml("Công suất", `${s.designCapacity ?? 0} MVA`)}
      ${rowHtml("Mức tải", `${s.loadFactor ?? 0}%`)}
      ${rowHtml("Hệ số tải", (s.loadFactor ?? 0) / 100)}
      ${rowHtml("Trạng thái", s.status)}
      <button class="energy-open-profile" style="margin-top:10px;width:100%;padding:7px 10px;border:0;border-radius:7px;background:#1565C0;color:#fff;font-size:12px;font-weight:700;cursor:pointer">Xem hồ sơ</button>`;
  } else if (entity.kind === "project") {
    const p = entity.item;
    el.innerHTML = `<div style="font-weight:700;color:#0f2a4a;margin-bottom:8px">${p.name}</div>
      ${rowHtml("Loại nguồn", p.type)}
      ${rowHtml("Công suất", `${p.designCapacityMw ?? 0} MW`)}
      ${rowHtml("Địa bàn", p.district)}
      ${rowHtml("Trạng thái", p.status)}
      <button class="energy-open-profile" style="margin-top:10px;width:100%;padding:7px 10px;border:0;border-radius:7px;background:#1565C0;color:#fff;font-size:12px;font-weight:700;cursor:pointer">Xem hồ sơ</button>`;
  } else if (entity.kind === "rooftop") {
    const r = entity.item;
    el.innerHTML = `<div style="font-weight:700;color:#0f2a4a;margin-bottom:8px">${r.owner}</div>
      ${rowHtml("Mã hệ thống", r.code)}
      ${rowHtml("Loại hình", r.customerType)}
      ${rowHtml("Công suất", `${r.installedCapacityKw ?? 0} kWp`)}
      ${rowHtml("Điểm đấu nối", r.connection.point)}
      ${rowHtml("Tiếp nhận còn lại", `${r.connection.hostingCapacityKw} kW`)}
      ${rowHtml("Trạng thái", r.status)}
      <button class="energy-open-profile" style="margin-top:10px;width:100%;padding:7px 10px;border:0;border-radius:7px;background:#1565C0;color:#fff;font-size:12px;font-weight:700;cursor:pointer">Xem hồ sơ</button>`;
  } else if (entity.kind === "incident") {
    const i = entity.item;
    el.innerHTML = `<div style="font-weight:700;color:#0f2a4a;margin-bottom:8px">${i.code}</div>
      ${rowHtml("Loại", i.type)}
      ${rowHtml("Thời gian", i.time)}
      ${rowHtml("Địa điểm", i.location)}
      ${rowHtml("Tiến độ", i.progress)}
      <button class="energy-open-profile" style="margin-top:10px;width:100%;padding:7px 10px;border:0;border-radius:7px;background:#1565C0;color:#fff;font-size:12px;font-weight:700;cursor:pointer">Xem hồ sơ</button>`;
  } else if (entity.kind === "emission") {
    const e = entity.item;
    el.innerHTML = `<div style="font-weight:700;color:#0f2a4a;margin-bottom:8px">${e.unit}</div>
      ${rowHtml("Nguồn", e.sourceType)}
      ${rowHtml("CO2e", `${e.co2e.toLocaleString("vi-VN")} tấn`)}
      ${rowHtml("Cường độ", `${e.intensity} gCO2e/kWh`)}
      <button class="energy-open-profile" style="margin-top:10px;width:100%;padding:7px 10px;border:0;border-radius:7px;background:#1565C0;color:#fff;font-size:12px;font-weight:700;cursor:pointer">Xem hồ sơ</button>`;
  } else if (entity.kind === "consumer") {
    const k = entity.item;
    el.innerHTML = `<div style="font-weight:700;color:#0f2a4a;margin-bottom:8px">${k.name}</div>
      ${rowHtml("Loại đơn vị", k.type)}
      ${rowHtml("Lĩnh vực", k.sector)}
      ${rowHtml("Tiêu thụ", `${k.consumptionKwh.toLocaleString("vi-VN")} kWh`)}
      ${rowHtml("Cực đại", `${k.maxDemandKw.toLocaleString("vi-VN")} kW`)}
      ${rowHtml("Đánh giá", k.savingAssessment)}
      <button class="energy-open-profile" style="margin-top:10px;width:100%;padding:7px 10px;border:0;border-radius:7px;background:#1565C0;color:#fff;font-size:12px;font-weight:700;cursor:pointer">Xem hồ sơ</button>`;
  } else {
    const c = entity.item;
    el.innerHTML = `<div style="font-weight:700;color:#0f2a4a;margin-bottom:8px">${c.name}</div>
      ${rowHtml("Công suất", `${c.powerKw} kW`)}
      ${rowHtml("Số cổng", c.ports.ccs2 + c.ports.chademo + c.ports.acType2)}
      ${rowHtml("Cổng trống", c.freePorts)}
      ${rowHtml("Trạng thái", c.status)}
      <button class="energy-open-profile" style="margin-top:10px;width:100%;padding:7px 10px;border:0;border-radius:7px;background:#1565C0;color:#fff;font-size:12px;font-weight:700;cursor:pointer">Xem hồ sơ</button>`;
  }

  el.querySelector<HTMLElement>(".energy-open-profile")?.addEventListener("click", onOpen);
  return el;
}

function buildExtraMarkerPopup(marker: EnergyMapExtraMarker): HTMLElement {
  const el = document.createElement("div");
  el.style.minWidth = "220px";
  el.style.fontFamily = "Inter, system-ui, sans-serif";
  el.innerHTML = `<div style="font-weight:700;color:#0f2a4a;margin-bottom:6px">${marker.label}</div>
    ${
      marker.sublabel
        ? `<div style="color:#64748b;font-size:11px;margin-bottom:8px">${marker.sublabel}</div>`
        : ""
    }
    <button class="energy-open-profile" style="margin-top:8px;width:100%;padding:7px 10px;border:0;border-radius:7px;background:${marker.color};color:#fff;font-size:12px;font-weight:700;cursor:pointer">Xem chi tiết</button>`;
  el.querySelector<HTMLElement>(".energy-open-profile")?.addEventListener("click", () =>
    marker.onSelect?.(),
  );
  return el;
}

export function EnergyMap({
  data,
  selectedKey,
  selectedLineKey,
  selectedExtraKey,
  onSelectEntity,
  height = 560,
  compact = false,
  fill = false,
  layerOptions,
  initialLayers,
  chargingTone,
  extraCircles,
  extraMarkers,
  extraLegend,
  onMapClick,
  mapChrome,
}: {
  data: EnergyGisData;
  selectedKey?: string | null;
  selectedLineKey?: string | null;
  selectedExtraKey?: string | null;
  onSelectEntity?: (entity: EnergyMapEntity) => void;
  height?: number;
  compact?: boolean;
  /** Toàn màn hình: dùng đúng chiều cao pixel (bỏ giới hạn 70vh). */
  fill?: boolean;
  layerOptions?: EnergyMapLayerOption[];
  initialLayers?: EnergyMapLayerKey[];
  /** Màu marker trạm sạc theo trạng thái (mặc định đồng màu tím). */
  chargingTone?: (station: ChargingStation) => { color: string; ring?: boolean } | undefined;
  /** Các vùng bổ sung (quá tải, nhu cầu cao...) — vẽ dưới dạng vòng tròn. */
  extraCircles?: EnergyMapExtraCircle[];
  /** Các marker bổ sung (vị trí đề xuất, cảnh báo AI...). */
  extraMarkers?: EnergyMapExtraMarker[];
  /** Chú giải bổ sung tương ứng extra layer. */
  extraLegend?: { color: string; label: string }[];
  /** Nhận tọa độ khi người dùng chọn một vị trí trống trên bản đồ. */
  onMapClick?: (position: { lat: number; lng: number }) => void;
  /** Bật bộ điều khiển GIS thống nhất với các trang nhiệm vụ. */
  mapChrome?: EnergyMapChromeConfig;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const geoServerLayerRef = useRef<Map<string, LeafletLayer>>(new Map());
  const markerByKeyRef = useRef<Map<string, LeafletMarker>>(new Map());
  const lineRefsRef = useRef<Map<string, LeafletPolyline>>(new Map());
  const hasFittedDataRef = useRef(false);
  const onMapClickRef = useRef(onMapClick);
  const [ready, setReady] = useState(false);
  const [layersOpen, setLayersOpen] = useState(!compact);
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<GisFeatureDetail | null>(null);
  const [extraLayersVisible, setExtraLayersVisible] = useState(
    mapChrome?.extraLayer?.defaultVisible !== false,
  );
  const [visibleGeoServerLayers, setVisibleGeoServerLayers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchType, setSearchType] = useState("all");
  const [boundaryMode, setBoundaryMode] = useState<"all" | "tay-ninh">("tay-ninh");
  const tayNinhBoundary = useTayNinhBoundary();
  const [geoServerConfig, setGeoServerConfig] = useState<{
    proxyWmsUrl: string;
    defaultLayers: string[];
    layers: GeoServerLayerDefinition[];
  } | null>(null);
  const [visibleLayers, setVisibleLayers] = useState<EnergyMapLayerKey[]>(() =>
    initialLayers
      ? initialLayers
      : layerOptions
        ? layerOptions
            .filter((option) => option.defaultVisible !== false)
            .flatMap((option) => option.keys)
        : compact
          ? ["substations", "projects", "incidents", "chargingStations"]
          : DEFAULT_LAYERS,
  );
  const optionList = layerOptions ?? DEFAULT_LAYER_OPTIONS;
  const mapChromeEnabled = Boolean(mapChrome);
  const isVisibleInBoundary = useCallback(
    (lat: number, lng: number) =>
      boundaryMode === "all" || !tayNinhBoundary.length || isInsideTayNinh(tayNinhBoundary, lng, lat),
    [boundaryMode, tayNinhBoundary],
  );

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    if (compact) return;
    let cancelled = false;
    void fetch("/api/gis/geoserver/config", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("GeoServer config unavailable");
        return response.json() as Promise<{
          enabled: boolean;
          proxyWmsUrl: string;
          defaultLayers: string[];
          layers: GeoServerLayerDefinition[];
        }>;
      })
      .then((config) => {
        if (cancelled || !config.enabled) return;
        setGeoServerConfig(config);
        setVisibleGeoServerLayers(
          mapChromeEnabled
            ? config.layers.filter((layer) => layer.defaultVisible).map((layer) => layer.name)
            : config.defaultLayers,
        );
      })
      .catch(() => {
        if (!cancelled) setGeoServerConfig(null);
      });
    return () => {
      cancelled = true;
    };
  }, [compact, mapChromeEnabled]);

  // Khi đổi kích thước (fullscreen / resize), ép Leaflet đo lại container ngay sau khi layout xong.
  useEffect(() => {
    if (!ready) return;
    const id = requestAnimationFrame(() => mapRef.current?.invalidateSize({ animate: false }));
    return () => cancelAnimationFrame(id);
  }, [expanded, fill, height, ready]);

  const points = useMemo<EnergyMapEntity[]>(
    () => [
      ...data.substations
        .filter((item) => item.latitude && item.longitude)
        .map((item) => ({ kind: "substation" as const, item })),
      ...data.projects
        .filter((item) => item.latitude && item.longitude)
        .map((item) => ({ kind: "project" as const, item })),
      ...data.rooftopSolar
        .filter((item) => item.latitude && item.longitude)
        .map((item) => ({ kind: "rooftop" as const, item })),
      ...data.incidents
        .filter((item) => item.latitude && item.longitude)
        .map((item) => ({ kind: "incident" as const, item })),
      ...data.emissionSources
        .filter((item) => item.latitude && item.longitude)
        .map((item) => ({ kind: "emission" as const, item })),
      ...data.chargingStations
        .filter((item) => item.latitude && item.longitude)
        .map((item) => ({ kind: "charging" as const, item })),
      ...data.keyConsumers
        .filter((item) => item.latitude && item.longitude)
        .map((item) => ({ kind: "consumer" as const, item })),
    ],
    [data],
  );

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    const markers = markerByKeyRef.current;
    const lineRefs = lineRefsRef.current;
    const geoServerLayers = geoServerLayerRef.current;
    const onResize = () => {
      if (mapRef.current && containerRef.current) mapRef.current.invalidateSize();
    };
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;
      const map = L.map(containerRef.current, {
        center: TAY_NINH_CENTER,
        zoom: compact ? 9 : 10,
        zoomControl: false,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      map.on("click", (event) => {
        onMapClickRef.current?.({ lat: event.latlng.lat, lng: event.latlng.lng });
      });
      setReady(true);

      // Cập nhật kích thước khi container đổi (xoay màn hình, mở/đóng sidebar, resize).
      window.addEventListener("resize", onResize);
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(onResize);
        observer.observe(containerRef.current);
      }
    })();
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      markers.clear();
      lineRefs.clear();
      geoServerLayers.clear();
      hasFittedDataRef.current = false;
      setReady(false);
    };
  }, [compact]);

  useEffect(() => {
    if (!ready || !geoServerConfig) return;
    let cancelled = false;
    const geoServerLayers = geoServerLayerRef.current;
    void import("leaflet").then((L) => {
      const map = mapRef.current;
      if (cancelled || !map) return;
      geoServerLayers.forEach((layer) => layer.remove());
      geoServerLayers.clear();
      const wmsRequests = mapChromeEnabled
        ? visibleGeoServerLayers.map((layerName) => ({ id: layerName, layers: layerName }))
        : visibleGeoServerLayers.length
          ? [{ id: "combined", layers: visibleGeoServerLayers.join(",") }]
          : [];
      wmsRequests.forEach((request) => {
        const layer = L.tileLayer
          .wms(geoServerConfig.proxyWmsUrl, {
            layers: request.layers,
            format: "image/png",
            transparent: true,
            version: "1.1.1",
            opacity: 0.72,
          })
          .addTo(map);
        geoServerLayers.set(request.id, layer);
      });
    });
    return () => {
      cancelled = true;
      geoServerLayers.forEach((layer) => layer.remove());
      geoServerLayers.clear();
    };
  }, [geoServerConfig, mapChromeEnabled, ready, visibleGeoServerLayers]);

  useEffect(() => {
    if (!ready) return;
    const layer = layerRef.current;
    if (!layer) return;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      layer.clearLayers();
      markerByKeyRef.current.clear();
      lineRefsRef.current.clear();

      data.lines.forEach((line) => {
        if (!line.route?.length) return;
        const layerKey =
          line.voltageLevel === "500kV"
            ? "lines500"
            : line.voltageLevel === "220kV"
              ? "lines220"
              : line.voltageLevel === "110kV"
                ? "lines110"
                : "lines22";
        if (!visibleLayers.includes(layerKey)) return;
        const color =
          line.voltageLevel === "500kV"
            ? "#C62828"
            : line.voltageLevel === "220kV"
                ? "#7C3AED"
              : line.voltageLevel === "110kV"
                ? "#1565C0"
                : "#00897B";
        const loadPct =
          (line.capacityMw ?? 0) > 0
            ? ((line.actualLoadMw ?? 0) / (line.capacityMw ?? 1)) * 100
            : 0;
        const riskClass =
          loadPct >= 90
            ? "energy-line-overloaded"
            : loadPct >= 80
              ? "energy-line-warning"
              : "energy-line-normal";
        const lineColor = loadPct >= 90 ? "#C62828" : loadPct >= 80 ? "#E59A23" : color;
        const polyline = L.polyline(line.route, {
          color: lineColor,
          weight: loadPct >= 90 ? (compact ? 4 : 5) : compact ? 2 : 3,
          opacity: loadPct >= 90 ? 1 : 0.82,
          className: riskClass,
        })
          .addTo(layer)
          .bindPopup(
            `<div style="min-width:230px;font-family:Inter,system-ui,sans-serif">
              <div style="font-weight:700;color:#0f2a4a;margin-bottom:8px">${line.name}</div>
              ${rowHtml("Mã tuyến", line.code)}
              ${rowHtml("Cấp điện áp", line.voltageLevel)}
              ${rowHtml("Điểm đầu", line.fromPoint)}
              ${rowHtml("Điểm cuối", line.toPoint)}
              ${rowHtml("Chiều dài", `${line.lengthKm} km`)}
              ${rowHtml("Khả năng tải", `${line.capacityMw ?? 0} MW`)}
              ${rowHtml("Tải thực tế", `${line.actualLoadMw ?? 0} MW`)}
              ${rowHtml("Tổn thất", `${line.lossPct ?? 0}%`)}
              ${rowHtml(
                "Nguồn hình học",
                line.routeSource === "INFERRED_FOR_VISUALIZATION"
                  ? `Mô phỏng GIS (${line.routeConfidencePct ?? 0}% tin cậy)`
                  : "Hồ sơ nguồn/PostGIS",
              )}
              ${rowHtml("Trạng thái", line.status)}
            </div>`,
          );
        lineRefsRef.current.set(line.id, polyline);
      });

      if (visibleLayers.includes("poles") && !compact) {
        data.poles.forEach((pole) => {
          if (!pole.latitude || !pole.longitude) return;
          L.marker([pole.latitude, pole.longitude], {
            icon: L.divIcon({
              className: "energy-map-pin",
              html: `<div style="width:22px;height:22px;border-radius:50%;background:#334155;border:2px solid #fff;display:grid;place-items:center"><img src="${GIS_ICON_ASSETS.utilityPole}" alt="" style="width:13px;height:13px;filter:${GIS_ICON_FILTER};" /></div>`,
              iconSize: [22, 22],
              iconAnchor: [11, 11],
            }),
          })
            .addTo(layer)
            .bindPopup(
              `<div style="min-width:200px;font-family:Inter,system-ui,sans-serif">
                <div style="font-weight:700;color:#0f2a4a;margin-bottom:8px">${pole.code}</div>
                ${rowHtml("Số trụ", pole.number)}
                ${rowHtml("Tuyến", pole.lineCode)}
                ${rowHtml("Loại", pole.type)}
                ${rowHtml("Hành lang", pole.safetyCorridor)}
              </div>`,
            );
        });
      }

      points.forEach((entity) => {
        const key = pointKey(entity);
        const show =
          (entity.kind === "substation" && visibleLayers.includes("substations")) ||
          (entity.kind === "project" && visibleLayers.includes("projects")) ||
          (entity.kind === "rooftop" && visibleLayers.includes("rooftopSolar")) ||
          (entity.kind === "incident" && visibleLayers.includes("incidents")) ||
          (entity.kind === "emission" && visibleLayers.includes("emissions")) ||
          (entity.kind === "charging" && visibleLayers.includes("chargingStations")) ||
          (entity.kind === "consumer" && visibleLayers.includes("keyConsumers"));
        if (!show) return;
        const lat = entity.item.latitude;
        const lng = entity.item.longitude;
        if (!lat || !lng) return;
        if (!isVisibleInBoundary(lat, lng)) return;
        const selected = key === selectedKey;
        const tone =
          entity.kind === "charging" && chargingTone ? chargingTone(entity.item) : undefined;
        const color = markerColor(entity.kind, entity.item, tone?.color);
        const openProfile = () => {
          if (mapChrome) setDetail(entityFeatureDetail(entity, mapChrome));
          onSelectEntity?.(entity);
        };
        const marker = L.marker([lat, lng], {
          icon: L.divIcon({
            className: "energy-map-pin",
            html: iconHtml(
              entity.kind,
              color,
              selected,
              tone?.ring,
              entity.kind === "substation" && (entity.item.loadFactor ?? 0) >= 80,
            ),
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
          title: "name" in entity.item ? entity.item.name : entity.item.code,
        })
          .addTo(layer)
          .bindPopup(buildPopup(entity, openProfile));
        marker.on("click", () => {
          marker.openPopup();
          onSelectEntity?.(entity);
        });
        markerByKeyRef.current.set(key, marker);
      });

      if (extraLayersVisible) {
        extraCircles?.forEach((circle) => {
          const circleLayer = L.circle([circle.lat, circle.lng], {
            radius: circle.radiusMeters,
            color: circle.color,
            fillColor: circle.color,
            fillOpacity: circle.fillOpacity ?? 0.16,
            weight: 1.5,
            dashArray: "4 4",
            interactive: circle.interactive !== false,
          }).addTo(layer);
          if (circle.interactive !== false) {
            circleLayer.bindPopup(
              `<div style="min-width:200px;font-family:Inter,system-ui,sans-serif"><div style="font-weight:700;color:#0f2a4a;margin-bottom:6px">${circle.label}</div>${
                circle.popup ?? ""
              }</div>`,
            );
          }
        });

        extraMarkers?.forEach((marker) => {
          if (!isVisibleInBoundary(marker.lat, marker.lng)) return;
          const key = `extra:${marker.id}`;
          const selected = key === selectedExtraKey;
          const glyph = marker.glyph ?? "AI";
          const ring = selected ? "box-shadow:0 0 0 4px rgba(21,101,192,.25);" : "";
          const mk = L.marker([marker.lat, marker.lng], {
            icon: L.divIcon({
              className: "energy-map-pin",
              html: `<div style="width:28px;height:28px;border-radius:999px;background:${marker.color};border:2px solid #fff;color:#fff;display:grid;place-items:center;font-size:9px;font-weight:800;${ring}">${glyph}</div>`,
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            }),
            title: marker.label,
          })
            .addTo(layer)
            .bindPopup(buildExtraMarkerPopup(marker));
          mk.on("click", () => {
            mk.openPopup();
          });
          markerByKeyRef.current.set(key, mk);
        });
      }

      if (!hasFittedDataRef.current) {
        const bounds = L.latLngBounds([]);
        points.forEach((entity) => {
          if (entity.item.latitude != null && entity.item.longitude != null && isVisibleInBoundary(entity.item.latitude, entity.item.longitude))
            bounds.extend([entity.item.latitude, entity.item.longitude]);
        });
        extraMarkers?.forEach((marker) => {
          if (isVisibleInBoundary(marker.lat, marker.lng)) bounds.extend([marker.lat, marker.lng]);
        });
        extraCircles?.forEach((circle) => bounds.extend([circle.lat, circle.lng]));
        if (bounds.isValid()) {
          mapRef.current?.fitBounds(bounds.pad(0.12), {
            maxZoom: compact ? 10 : 12,
            padding: [28, 28],
          });
          hasFittedDataRef.current = true;
        }
      }

      if (selectedKey) {
        const selectedMarker = markerByKeyRef.current.get(selectedKey);
        if (selectedMarker) {
          selectedMarker.openPopup();
          // Nếu map đang bay/zoom, mở lại popup sau khi hoàn tất để popup không bị mất.
          mapRef.current?.once("moveend", () => {
            markerByKeyRef.current.get(selectedKey)?.openPopup();
          });
        }
      }

      // Làm nổi bật tuyến điện đang được chọn (từ AI hoặc bảng đối tượng cần quan tâm).
      if (selectedLineKey) {
        const focusLine = lineRefsRef.current.get(lineEntityId(selectedLineKey));
        if (focusLine) {
          focusLine.setStyle({ weight: 7, opacity: 1 });
          focusLine.bringToFront();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    chargingTone,
    compact,
    data,
    extraCircles,
    extraLayersVisible,
    extraMarkers,
    mapChrome,
    onSelectEntity,
    points,
    ready,
    selectedExtraKey,
    selectedKey,
    selectedLineKey,
    visibleLayers,
    boundaryMode,
    tayNinhBoundary,
    isVisibleInBoundary,
  ]);

  const searchResults = useMemo(() => {
    const items: MapSearchItem[] = points.flatMap((entity) => {
      const { latitude, longitude } = entity.item;
      if (latitude == null || longitude == null) return [];
      if (!isVisibleInBoundary(latitude, longitude)) return [];
        const key = entity.kind === "substation" ? "substations" : entity.kind === "project" ? "projects" : entity.kind === "rooftop" ? "rooftopSolar" : entity.kind === "incident" ? "incidents" : entity.kind === "emission" ? "emissions" : entity.kind === "charging" ? "chargingStations" : "keyConsumers";
        if (!visibleLayers.includes(key)) return [];
        return [{
        key: pointKey(entity),
        label: entitySearchLabel(entity),
        sublabel: entity.kind,
        lat: latitude,
        lng: longitude,
        type: entity.kind,
        }];
    });
    if (extraLayersVisible) {
      extraMarkers?.forEach((marker) => {
        if (isVisibleInBoundary(marker.lat, marker.lng)) {
          items.push({
            key: `extra:${marker.id}`,
            label: marker.label,
            sublabel: marker.sublabel ?? "Vị trí bổ sung",
            lat: marker.lat,
            lng: marker.lng,
            type: "extra",
          });
        }
      });
    }
    const query = normalizeSearchValue(searchQuery);
    return items
      .filter((item) => searchType === "all" || item.type === searchType)
      .filter((item) => !query || normalizeSearchValue(`${item.label} ${item.sublabel}`).includes(query))
      .slice(0, 6);
  }, [extraLayersVisible, extraMarkers, points, searchQuery, searchType, visibleLayers, isVisibleInBoundary]);

  const focusSearchItem = (item: MapSearchItem) => {
    setSearchQuery(item.label);
    setSearchOpen(false);
    const map = mapRef.current;
    if (!map) return;
    map.flyTo([item.lat, item.lng], Math.max(map.getZoom(), compact ? 10 : 12), { duration: 0.6 });
    map.once("moveend", () => markerByKeyRef.current.get(item.key)?.openPopup());
    const entity = points.find((candidate) => pointKey(candidate) === item.key);
    if (entity) onSelectEntity?.(entity);
  };

  useEffect(() => {
    if (!ready) return;
    const key = selectedKey ?? selectedExtraKey;
    if (!key) return;
    const marker = markerByKeyRef.current.get(key);
    const map = mapRef.current;
    if (!marker || !map) return;
    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), compact ? 10 : 12), { duration: 0.5 });
    // Mở popup sau khi bay xong: mở ngay trong lúc animation dễ bị Leaflet bỏ qua/mất popup.
    map.once("moveend", () => {
      markerByKeyRef.current.get(key)?.openPopup();
    });
  }, [compact, ready, selectedExtraKey, selectedKey]);

  // Zoom đến tuyến điện được chọn (mở rộng vừa đủ để thấy toàn tuyến).
  useEffect(() => {
    if (!ready || !selectedLineKey) return;
    const selectedLineId = lineEntityId(selectedLineKey);
    const line = lineRefsRef.current.get(selectedLineId);
    const map = mapRef.current;
    if (!line || !map) return;
    map.flyToBounds(line.getBounds(), { padding: [50, 50], maxZoom: 12, duration: 0.5 });
    map.once("moveend", () => {
      lineRefsRef.current.get(selectedLineId)?.openPopup();
    });
  }, [compact, ready, selectedLineKey, visibleLayers]);

  const toggleLayerGroup = (option: EnergyMapLayerOption) => {
    setVisibleLayers((current) => {
      const allOn = option.keys.every((key) => current.includes(key));
      return allOn
        ? current.filter((key) => !option.keys.includes(key))
        : Array.from(new Set([...current, ...option.keys]));
    });
  };

  const layerControls = useMemo<GisLayerControl[]>(() => {
    const configured = optionList.map((option, index) => {
      const visual = layerVisual(option.keys[0] ?? "substations");
      const count = optionObjectCount(option, data);
      return {
        id: optionControlId(option, index),
        label: option.label,
        source: option.source ?? (option.keys.includes("incidents") ? "Cảnh báo" : "PostGIS"),
        color: option.color ?? visual.color,
        glyph: option.glyph ?? visual.glyph,
        icon: option.icon,
        visible: option.keys.every((key) => visibleLayers.includes(key)),
        description:
          option.description != null
            ? `${option.description} · ${count.toLocaleString("vi-VN")} đối tượng`
            : `${count.toLocaleString("vi-VN")} đối tượng từ hệ thống GIS`,
      } satisfies GisLayerControl;
    });

    const geoServer =
      geoServerConfig?.layers.map(
        (layer) =>
          ({
            id: `geoserver:${layer.name}`,
            label: layer.label,
            source: "GeoServer",
            color: layer.color,
            glyph: geoServerGlyph(layer),
            icon: layer.geometry === "point" ? geoServerIconAsset(layer.kind, layer.name) : undefined,
            visible: visibleGeoServerLayers.includes(layer.name),
            description: `${layer.geometry} · ${layer.kind} · WMS từ cấu hình env`,
          }) satisfies GisLayerControl,
      ) ?? [];

    const extra = mapChrome?.extraLayer
      ? [
          {
            ...mapChrome.extraLayer,
            visible: extraLayersVisible,
            description:
              mapChrome.extraLayer.description ??
              `${extraMarkers?.length ?? 0} điểm và ${extraCircles?.length ?? 0} vùng phân tích`,
          } satisfies GisLayerControl,
        ]
      : [];

    return [...extra, ...configured, ...geoServer];
  }, [
    data,
    extraCircles?.length,
    extraLayersVisible,
    extraMarkers?.length,
    geoServerConfig,
    mapChrome,
    optionList,
    visibleGeoServerLayers,
    visibleLayers,
  ]);

  const legendItems = useMemo<GisLegendItem[]>(() => {
    const items: GisLegendItem[] = layerControls
      .filter((layer) => layer.visible)
      .map((layer) => ({
        id: layer.id,
        label: layer.label,
        color: layer.color,
        glyph: layer.glyph,
        icon: layer.icon,
        animated: layer.source === "Cảnh báo",
        line: layer.glyph === "—",
      }));
    const hasVisibleGrid = ["lines500", "lines220", "lines110", "lines22"].some((key) =>
      visibleLayers.includes(key as EnergyMapLayerKey),
    );
    if (hasVisibleGrid) {
      items.push(
        {
          id: "energy:grid-load-warning",
          label: "Đường dây 80–90% tải",
          color: "#e59a23",
          glyph: "—",
          line: true,
          animated: false,
        },
        {
          id: "energy:grid-load-critical",
          label: "Đường dây ≥ 90% tải",
          color: "#c62828",
          glyph: "—",
          line: true,
          animated: true,
        },
      );
    }
    return items;
  }, [layerControls, visibleLayers]);

  const toggleMapControl = (id: string) => {
    if (mapChrome?.extraLayer?.id === id) {
      setExtraLayersVisible((current) => !current);
      return;
    }
    if (id.startsWith("geoserver:")) {
      const name = id.slice("geoserver:".length);
      setVisibleGeoServerLayers((current) =>
        current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
      );
      return;
    }
    const option = optionList.find((item, index) => optionControlId(item, index) === id);
    if (option) toggleLayerGroup(option);
  };

  const setAllMapControls = (visible: boolean) => {
    setVisibleLayers(
      visible ? Array.from(new Set(optionList.flatMap((option) => option.keys))) : [],
    );
    setVisibleGeoServerLayers(
      visible ? (geoServerConfig?.layers.map((layer) => layer.name) ?? []) : [],
    );
    if (mapChrome?.extraLayer) setExtraLayersVisible(visible);
  };

  const boxHeight = expanded
    ? "calc(100dvh - 1rem)"
    : fill || mapChromeEnabled
      ? `${height}px`
      : `min(${height}px, 70vh)`;
  const boxStyle = { height: boxHeight } as const;

  return (
    <div
      className={cn(
        "relative bg-surface",
        mapChromeEnabled &&
          "z-0 isolate overflow-hidden rounded-lg border border-border bg-slate-100",
        expanded && "fixed inset-2 z-40 rounded-xl shadow-2xl",
      )}
      style={boxStyle}
    >
      <div
        ref={containerRef}
        className="energy-map z-0 w-full"
        style={boxStyle}
        aria-label="Bản đồ GIS năng lượng tỉnh Tây Ninh"
      />

      {!compact && !mapChromeEnabled ? (
        <div className="absolute left-3 top-3 z-[500] w-56 max-w-[calc(100%-1.5rem)] rounded-md border border-border bg-card/95 shadow-panel backdrop-blur">
          <button
            type="button"
            onClick={() => setLayersOpen((value) => !value)}
            className="flex w-full items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-wide text-navy"
          >
            Lớp dữ liệu
            <span className="text-muted-foreground">{layersOpen ? "Thu gọn" : "Mở"}</span>
          </button>
          {layersOpen ? (
            <div className="max-h-72 space-y-1 overflow-y-auto border-t border-border p-2">
              {geoServerConfig ? (
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border border-gov/15 bg-gov/5 px-2 py-1.5 text-xs hover:bg-gov/10",
                    visibleGeoServerLayers.length ? "text-navy" : "text-muted-foreground",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={visibleGeoServerLayers.length > 0}
                    onChange={() =>
                      setVisibleGeoServerLayers((current) =>
                        current.length ? [] : geoServerConfig.defaultLayers,
                      )
                    }
                    className="size-3.5 accent-blue-700"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">GeoServer thực tế</span>
                    <span className="block text-[10px] text-muted-foreground">
                      {geoServerConfig.defaultLayers.length} lớp từ cấu hình env
                    </span>
                  </span>
                </label>
              ) : null}
              {optionList.map((option) => {
                const checked = option.keys.every((key) => visibleLayers.includes(key));
                return (
                  <label
                    key={option.label}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-surface",
                      checked ? "text-navy" : "text-muted-foreground",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleLayerGroup(option)}
                      className="size-3.5 accent-blue-700"
                    />
                    <span className="truncate">{option.label}</span>
                  </label>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      <div ref={searchRef} className="absolute left-3 top-3 z-[700] w-[min(560px,calc(100%-1.5rem))] sm:w-[min(50%,560px)]">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-2 py-2 shadow-lg backdrop-blur-sm">
          <MapSearchTypeSelect
            value={searchType}
            onChange={setSearchType}
            options={[
              { value: "all", label: "Tất cả" },
              { value: "substation", label: "Trạm biến áp" },
              { value: "project", label: "Dự án nguồn" },
              { value: "rooftop", label: "Điện mặt trời mái nhà" },
              { value: "incident", label: "Sự cố" },
              { value: "emission", label: "Phát thải carbon" },
              { value: "charging", label: "Trạm sạc" },
              { value: "consumer", label: "Phụ tải trọng điểm" },
              { value: "extra", label: "Điểm bổ sung" },
            ]}
          />
          <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          <input
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && searchResults[0]) {
                event.preventDefault();
                focusSearchItem(searchResults[0]);
              }
              if (event.key === "Escape") setSearchOpen(false);
            }}
            placeholder="Tìm địa điểm trên bản đồ..."
            aria-label="Tìm địa điểm trên bản đồ"
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSearchOpen(true);
              }}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Xóa tìm kiếm"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {searchOpen && searchResults.length ? (
          <div className="mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            {searchResults.map((item) => (
              <button
                key={item.key}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => focusSearchItem(item)}
                className="flex w-full items-start gap-2 border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-blue-50"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800">{item.label}</span>
                  <span className="block truncate text-xs text-slate-500">{item.sublabel}</span>
                </span>
              </button>
            ))}
          </div>
        ) : null}
        {searchOpen && searchQuery && !searchResults.length ? (
          <div className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-lg">
            Không tìm thấy địa điểm phù hợp.
          </div>
        ) : null}
      </div>

      {mapChromeEnabled ? (
        <GisMapChrome
          layers={layerControls}
          legendItems={legendItems}
          expanded={expanded}
          detail={detail}
          onToggleLayer={toggleMapControl}
          onSetAllLayers={setAllMapControls}
          onZoomIn={() => mapRef.current?.zoomIn()}
          onZoomOut={() => mapRef.current?.zoomOut()}
          onToggleExpanded={() => setExpanded((current) => !current)}
          onCloseDetail={() => setDetail(null)}
          boundaryMode={boundaryMode}
          onBoundaryModeChange={setBoundaryMode}
          boundaryScopeName="energy-map-boundary-mode"
          statusText={
            mapChrome?.statusText ?? "Dữ liệu hệ thống GIS kết hợp các lớp WMS từ GeoServer."
          }
        />
      ) : (
        <div className="absolute bottom-3 right-3 z-[500] rounded-md border border-border bg-card/95 p-2 text-xs shadow-panel backdrop-blur">
          <p className="flex items-center gap-1.5 font-semibold text-destructive">
            <span className="energy-legend-line energy-legend-line--critical" /> Đường dây ≥ 90% tải
          </p>
          <p className="flex items-center gap-1.5 font-semibold text-warning">
            <span className="energy-legend-line energy-legend-line--warning" /> Đường dây 80–90% tải
          </p>
          <Legend color="bg-gov" label="Trạm biến áp" />
          <Legend color="bg-warning" label="Dự án nguồn điện" />
          <Legend color="bg-amber-500" label="ĐMT mái nhà" />
          <Legend color="bg-teal" label="Phụ tải trọng điểm" />
          <Legend color="bg-destructive" label="Sự cố" />
          <Legend color="bg-analytics" label="Trạm sạc" />
          {extraLegend?.map((item) => (
            <p key={item.label} className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: item.color }} />{" "}
              {item.label}
            </p>
          ))}
        </div>
      )}
      {!mapChromeEnabled ? (
        <BoundaryScopeControl
          mode={boundaryMode}
          onChange={setBoundaryMode}
          name="energy-map-boundary-mode-investment"
        />
      ) : null}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <p className="flex items-center gap-1.5 text-muted-foreground">
      <span className={cn("size-2 rounded-full", color)} /> {label}
    </p>
  );
}

export type { EnergyMapEntity };
