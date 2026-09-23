import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Layer, LayerGroup, Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { MapPin, Search, X } from "lucide-react";
import {
  GisMapChrome,
  MapSearchTypeSelect,
  type GisFeatureDetail,
  type GisLayerControl,
  type GisLegendItem,
} from "@/components/gis/GisMapChrome";
import { GIS_ICON_ASSETS, GIS_ICON_FILTER, GIS_VISUALS, geoServerGlyph, geoServerIconAsset } from "@/config/gis-visuals";
import type { GeoServerLayerDefinition } from "@/config/geoserver-layers";
import type {
  GridPlanAsset,
  GridPowerLine,
  GridPowerPole,
  GridSubstation,
  Task1GridData,
} from "@/lib/grid-types";
import { GRID_CONFIG, OPERATION_STATUS_LABEL } from "@/lib/grid-types";
import { buildCorridorPolygon, corridorWidthM } from "@/lib/grid-geo";
import { cn } from "@/lib/utils";
import { geometryHasPointInside, isInsideTayNinh, useTayNinhBoundary } from "@/lib/tay-ninh-boundary";

const FALLBACK_CENTER: [number, number] = [10.53, 106.41];

export type GridMode = "station" | "grid" | "all";

export type GridMapEntity =
  | { kind: "substation"; item: GridSubstation }
  | { kind: "line"; item: GridPowerLine }
  | { kind: "pole"; item: GridPowerPole }
  | { kind: "plan"; item: GridPlanAsset };

export type GridLayerKey =
  | "substations"
  | "lines"
  | "poles"
  | "supplyAreas"
  | "loadAreas"
  | "planning"
  | "corridors"
  | "connectionPoints"
  | "incidents"
  | "overloadZones"
  | "renewables";

type GridSearchItem = {
  key: string;
  label: string;
  sublabel: string;
  lat: number;
  lng: number;
};

const LAYER_LABEL: Record<GridLayerKey, string> = {
  substations: "Trạm biến áp",
  lines: "Đường dây",
  poles: "Trụ điện",
  supplyAreas: "Vùng cấp điện",
  loadAreas: "Vùng phụ tải",
  planning: "Quy hoạch",
  corridors: "Hành lang an toàn (NĐ 14/2014)",
  connectionPoints: "Điểm đấu nối",
  incidents: "Điểm sự cố",
  overloadZones: "Khu vực quá tải",
  renewables: "Nguồn NLTT đấu nối",
};

const LAYER_VISUAL: Record<GridLayerKey, { color: string; glyph: string }> = {
  substations: GIS_VISUALS.substation,
  lines: GIS_VISUALS.lineHigh,
  poles: GIS_VISUALS.pole,
  supplyAreas: GIS_VISUALS.supplyArea,
  loadAreas: GIS_VISUALS.loadArea,
  planning: GIS_VISUALS.planning,
  corridors: GIS_VISUALS.corridor,
  connectionPoints: GIS_VISUALS.connection,
  incidents: GIS_VISUALS.incident,
  overloadZones: GIS_VISUALS.overload,
  renewables: GIS_VISUALS.renewable,
};

function layerIcon(key: GridLayerKey) {
  switch (key) {
    case "substations":
      return GIS_ICON_ASSETS.substation;
    case "poles":
      return GIS_ICON_ASSETS.utilityPole;
    case "incidents":
      return GIS_ICON_ASSETS.distributionBox;
    case "renewables":
      return GIS_ICON_ASSETS.powerPlant;
    default:
      return undefined;
  }
}

export const LINE_COLOR: Record<string, string> = {
  "500kV": "#1D4ED8",
  "220kV": "#7C3AED",
  "110kV": "#1565C0",
};

export function rowHtml(label: string, value: string | number | undefined) {
  return `<div style="display:flex;justify-content:space-between;gap:12px;font-size:11px;padding:2px 0"><span style="color:#64748b">${label}</span><span style="font-weight:600;color:#0f2a4a;text-align:right">${value ?? "Đang cập nhật"}</span></div>`;
}

export function entityKey(entity: GridMapEntity) {
  return `${entity.kind}:${entity.item.id}`;
}

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi-VN")
    .trim();
}

export function wirePopupButton(target: Layer, onClick: () => void) {
  target.on("popupopen", () => {
    const btn = target.getPopup()?.getElement()?.querySelector<HTMLElement>(".grid-open-profile");
    btn?.addEventListener("click", onClick);
  });
}

export function substationColor(s: GridSubstation) {
  if (s.status === "Quy hoạch") return "#7C3AED";
  const load = s.loadFactor ?? 0;
  if (load >= GRID_CONFIG.thresholds.substationLoadCriticalPct) return "#C62828";
  if (load >= GRID_CONFIG.thresholds.substationLoadWarnPct) return "#F59E0B";
  return "#1565C0";
}

export function buildSubstationPopup(s: GridSubstation, onOpen: () => void) {
  const el = document.createElement("div");
  el.style.minWidth = "250px";
  el.style.fontFamily = "Inter, system-ui, sans-serif";
  el.innerHTML = `<div style="font-weight:700;color:#0f2a4a;margin-bottom:8px">${s.name}</div>
    ${rowHtml("Mã trạm", s.code)}
    ${rowHtml("Cấp điện áp", s.voltageLevel)}
    ${rowHtml("Công suất TK", `${s.designCapacity ?? 0} MVA`)}
    ${rowHtml("Hệ số tải", `${s.loadFactor ?? 0}%`)}
    ${rowHtml("Đóng/cắt", s.switchingState ? OPERATION_STATUS_LABEL[s.switchingState] : "Đang vận hành")}
    ${rowHtml("Trạng thái", s.status)}
    ${rowHtml("Đơn vị quản lý", s.operator)}
    <button class="grid-open-profile" style="margin-top:10px;width:100%;padding:7px 10px;border:0;border-radius:7px;background:#1565C0;color:#fff;font-size:12px;font-weight:700;cursor:pointer">Xem chi tiết</button>`;
  el.querySelector<HTMLElement>(".grid-open-profile")?.addEventListener("click", onOpen);
  return el;
}

export function buildLinePopup(l: GridPowerLine, onOpen: () => void) {
  const el = document.createElement("div");
  el.style.minWidth = "250px";
  el.style.fontFamily = "Inter, system-ui, sans-serif";
  el.innerHTML = `<div style="font-weight:700;color:#0f2a4a;margin-bottom:8px">${l.name}</div>
    ${rowHtml("Mã tuyến", l.code)}
    ${rowHtml("Cấp điện áp", l.voltageLevel)}
    ${rowHtml("Chiều dài", `${l.lengthKm} km`)}
    ${rowHtml("Khả năng tải", `${l.capacityMw ?? 0} MW`)}
    ${rowHtml("Tải thực tế", `${l.actualLoadMw ?? 0} MW`)}
    ${rowHtml("Tổn thất", `${l.lossPct ?? 0}%`)}
    ${rowHtml("Đóng/cắt", l.switchingState ? OPERATION_STATUS_LABEL[l.switchingState] : "Đang vận hành")}
    ${rowHtml("Trạng thái", l.status)}
    <button class="grid-open-profile" style="margin-top:10px;width:100%;padding:7px 10px;border:0;border-radius:7px;background:#1565C0;color:#fff;font-size:12px;font-weight:700;cursor:pointer">Xem chi tiết</button>`;
  el.querySelector<HTMLElement>(".grid-open-profile")?.addEventListener("click", onOpen);
  return el;
}

function buildGeoServerPopup(
  layer: GeoServerLayerDefinition,
  properties: Record<string, unknown>,
  onDetail: () => void,
) {
  const root = document.createElement("div");
  root.style.cssText = "min-width:245px;font-family:Inter,system-ui,sans-serif";
  const title = document.createElement("strong");
  title.style.cssText = `display:block;margin-bottom:7px;color:${layer.color}`;
  title.textContent = String(properties.name ?? properties.ten ?? layer.label);
  root.append(title);
  Object.entries(properties)
    .filter(([, value]) => value == null || ["string", "number", "boolean"].includes(typeof value))
    .slice(0, 8)
    .forEach(([label, value]) => {
      const row = document.createElement("div");
      row.style.cssText =
        "display:flex;justify-content:space-between;gap:12px;padding:2px 0;font-size:11px";
      const key = document.createElement("span");
      key.style.color = "#64748b";
      key.textContent = label;
      const content = document.createElement("strong");
      content.style.cssText =
        "max-width:165px;text-align:right;color:#0f2a4a;overflow-wrap:anywhere";
      content.textContent = String(value ?? "—");
      row.append(key, content);
      root.append(row);
    });
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Xem chi tiết";
  button.style.cssText =
    "margin-top:9px;width:100%;border:0;border-radius:7px;background:#1565c0;padding:7px 10px;color:#fff;font-size:12px;font-weight:700;cursor:pointer";
  button.addEventListener("click", onDetail);
  root.append(button);
  return root;
}

export function GridMap({
  data,
  mode,
  selectedKey,
  onSelectEntity,
  height = 520,
}: {
  data: Task1GridData;
  mode: GridMode;
  selectedKey?: string | null;
  onSelectEntity?: (entity: GridMapEntity) => void;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const geoServerLayerRefs = useRef<Map<string, Layer>>(new Map());
  const markerByKeyRef = useRef<Map<string, LeafletMarker>>(new Map());
  const searchRef = useRef<HTMLDivElement>(null);
  const hasFittedDataRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<GisFeatureDetail | null>(null);
  const [geoServerConfig, setGeoServerConfig] = useState<{
    proxyWfsUrl: string;
    layers: GeoServerLayerDefinition[];
  } | null>(null);
  const [visibleGeoLayers, setVisibleGeoLayers] = useState<string[]>([]);
  const [visibleLayers, setVisibleLayers] = useState<GridLayerKey[]>([
    "substations",
    "lines",
    "poles",
    "planning",
    "connectionPoints",
    "incidents",
    "overloadZones",
    "renewables",
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchType, setSearchType] = useState("all");
  const [boundaryMode, setBoundaryMode] = useState<"all" | "tay-ninh">("tay-ninh");
  const tayNinhBoundary = useTayNinhBoundary();
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

  const entities = useMemo<GridMapEntity[]>(
    () => [
      ...data.substations
        .filter((s) => s.latitude && s.longitude)
        .map((item) => ({ kind: "substation" as const, item })),
      ...data.lines.map((item) => ({ kind: "line" as const, item })),
      ...data.poles
        .filter((p) => p.latitude && p.longitude)
        .map((item) => ({ kind: "pole" as const, item })),
      ...data.planned
        .filter((a) => a.latitude && a.longitude)
        .map((item) => ({ kind: "plan" as const, item })),
    ],
    [data],
  );

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/gis/geoserver/config", { cache: "no-store" })
      .then((response) => response.json())
      .then(
        (config: { enabled: boolean; proxyWfsUrl: string; layers: GeoServerLayerDefinition[] }) => {
          if (cancelled || !config.enabled) return;
          setGeoServerConfig({
            proxyWfsUrl: config.proxyWfsUrl,
            layers: config.layers.filter((layer) => layer.missionIds.includes(1)),
          });
          setVisibleGeoLayers(
            config.layers
              .filter((layer) => layer.missionIds.includes(1) && layer.defaultVisible)
              .map((layer) => layer.name),
          );
        },
      )
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    const markers = markerByKeyRef.current;
    const geoLayers = geoServerLayerRefs.current;
    const onResize = () => {
      if (mapRef.current && containerRef.current) mapRef.current.invalidateSize();
    };
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;
      const map = L.map(containerRef.current, {
        center: FALLBACK_CENTER,
        zoom: 10,
        zoomControl: false,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);
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
      geoLayers.clear();
      markers.clear();
      hasFittedDataRef.current = false;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    if (!ready || !geoServerConfig) return;
    let cancelled = false;
    const geoLayers = geoServerLayerRefs.current;
    void import("leaflet").then(async (L) => {
      if (cancelled || !mapRef.current) return;
      geoLayers.forEach((layer) => layer.remove());
      geoLayers.clear();
      const selectedLayers = geoServerConfig.layers.filter((layer) =>
        visibleGeoLayers.includes(layer.name),
      );
      await Promise.allSettled(
        selectedLayers.map(async (layer) => {
          const params = new URLSearchParams({
            SERVICE: "WFS",
            VERSION: "2.0.0",
            REQUEST: "GetFeature",
            TYPENAMES: layer.name,
            OUTPUTFORMAT: "application/json",
            SRSNAME: "EPSG:4326",
            COUNT: "750",
          });
          const response = await fetch(`${geoServerConfig.proxyWfsUrl}?${params}`, {
            cache: "no-store",
          });
          if (!response.ok) throw new Error(`Không thể nạp ${layer.name}`);
          const collection = (await response.json()) as GeoJSON.FeatureCollection;
          if (cancelled || !mapRef.current) return;
          const allowFeatureDetails = layer.allowFeatureDetails !== false;
          const vector = L.geoJSON(collection, {
            filter: (feature) =>
              boundaryMode === "all" ||
              layer.geometry !== "point" ||
              geometryHasPointInside(feature.geometry, tayNinhBoundary),
            style: {
              color: layer.color,
              fillColor: layer.color,
              weight: layer.geometry === "line" ? 3 : 1.5,
              opacity: layer.kind === "boundary" ? 0.7 : 0.9,
              fillOpacity: layer.kind === "boundary" ? 0.035 : 0.13,
              dashArray: layer.kind === "boundary" ? "7 5" : undefined,
              interactive: allowFeatureDetails,
            },
            pointToLayer: (_feature, latlng) =>
              L.marker(latlng, {
                interactive: allowFeatureDetails,
                keyboard: allowFeatureDetails,
                icon: L.divIcon({
                  className: "gis-feature-pin",
                  html: `<span class="gis-feature-marker" style="background:${layer.color}">${geoServerIconAsset(layer.kind, layer.name) ? `<img src="${geoServerIconAsset(layer.kind, layer.name)}" alt="" style="width:17px;height:17px;filter:${GIS_ICON_FILTER};" />` : geoServerGlyph(layer.kind, layer.name)}</span>`,
                  iconSize: [28, 28],
                  iconAnchor: [14, 14],
                }),
              }),
            onEachFeature: (feature, featureLayer) => {
              if (!allowFeatureDetails) return;
              const properties = (feature.properties ?? {}) as Record<string, unknown>;
              const fields = Object.entries(properties)
                .filter(
                  ([, value]) =>
                    value == null || ["string", "number", "boolean"].includes(typeof value),
                )
                .slice(0, 18)
                .map(([label, value]) => ({ label, value }));
              const featureDetail: GisFeatureDetail = {
                id: `geoserver:${layer.name}:${String(properties.id ?? properties.code ?? fields.length)}`,
                title: String(properties.name ?? properties.ten ?? layer.shortLabel),
                subtitle: layer.label,
                source: "GeoServer",
                category: layer.kind,
                fields: fields.length ? fields : [{ label: "Lớp dữ liệu", value: layer.name }],
                managementHref: "/energy/nhiem-vu-1/quan-ly",
              };
              featureLayer.bindPopup(
                buildGeoServerPopup(layer, properties, () => setDetail(featureDetail)),
              );
            },
          }).addTo(mapRef.current);
          geoLayers.set(layer.name, vector);
        }),
      );
    });
    return () => {
      cancelled = true;
      geoLayers.forEach((layer) => layer.remove());
      geoLayers.clear();
    };
  }, [boundaryMode, geoServerConfig, ready, tayNinhBoundary, visibleGeoLayers]);

  useEffect(() => {
    if (!ready) return;
    const frame = requestAnimationFrame(() => mapRef.current?.invalidateSize({ animate: false }));
    return () => cancelAnimationFrame(frame);
  }, [expanded, height, ready]);

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

      const drawAreas = mode !== "station";
      const visible = (key: GridLayerKey) => visibleLayers.includes(key);
      if (drawAreas && visible("supplyAreas")) {
        data.supplyAreas.forEach((area) => {
          area.polygons.forEach((ring) => {
            L.polygon(ring, {
              color: "#0F766E",
              weight: 1.5,
              fillColor: "#0F766E",
              fillOpacity: 0.14,
              dashArray: "4 4",
            })
              .addTo(layer)
              .bindPopup(
                `<div style="min-width:220px;font-family:Inter,system-ui,sans-serif"><div style="font-weight:700;color:#0f2a4a;margin-bottom:6px">${area.name}</div>${rowHtml("Trạm nguồn", area.substationId)}${rowHtml("Địa bàn", area.district)}</div>`,
              );
          });
        });
      }

      if (drawAreas && visible("loadAreas")) {
        data.loadAreas.forEach((area) => {
          area.polygons.forEach((ring) => {
            L.polygon(ring, {
              color: "#7C3AED",
              weight: 1.5,
              fillColor: "#7C3AED",
              fillOpacity: 0.1,
              dashArray: "3 4",
            })
              .addTo(layer)
              .bindPopup(
                `<div style="min-width:220px;font-family:Inter,system-ui,sans-serif"><div style="font-weight:700;color:#0f2a4a;margin-bottom:6px">${area.name}</div>${rowHtml("Địa bàn", area.district)}${rowHtml("Phụ tải cực đại", `${area.peakMw} MW`)}</div>`,
              );
          });
        });
      }

      // Hành lang an toàn — bề rộng theo cấp điện áp (Nghị định 14/2014/NĐ-CP).
      if (drawAreas && visible("corridors")) {
        data.lines.forEach((line) => {
          if (!line.route?.length) return;
          const widthM =
            line.status === "Quy hoạch"
              ? (line.planning?.corridorWidthM ?? corridorWidthM(line.voltageLevel))
              : corridorWidthM(line.voltageLevel);
          const poly = buildCorridorPolygon(line.route, widthM);
          if (!poly.length) return;
          L.polygon(poly, {
            color: "#0F766E",
            weight: 1,
            fillColor: "#0F766E",
            fillOpacity: 0.07,
            dashArray: "4 4",
          })
            .addTo(layer)
            .bindPopup(
              `<div style="min-width:230px;font-family:Inter,system-ui,sans-serif"><div style="font-weight:700;color:#0f2a4a;margin-bottom:6px">Hành lang an toàn — ${line.name}</div>${rowHtml("Cấp điện áp", line.voltageLevel)}${rowHtml("Bề rộng mỗi phía", `${widthM} m`)}${rowHtml("Căn cứ", "NĐ 14/2014/NĐ-CP, Điều 11")}${rowHtml("Tình trạng", line.corridorStatus ?? "Chưa đánh giá")}</div>`,
            );
              });
      }

      // Khu vực quá tải — trạm/tuyến vượt ngưỡng.
      if (drawAreas && visible("overloadZones")) {
        data.overloadZones.forEach((zone) => {
          zone.polygons.forEach((ring) => {
            L.polygon(ring, {
              color: "#C62828",
              weight: 2,
              fillColor: "#C62828",
              fillOpacity: 0.12,
              dashArray: "6 4",
            })
              .addTo(layer)
              .bindPopup(
                `<div style="min-width:240px;font-family:Inter,system-ui,sans-serif"><div style="font-weight:700;color:#C62828;margin-bottom:6px">${zone.label}</div>${rowHtml("Địa bàn", zone.district)}${rowHtml("Hệ số tải", `${zone.loadFactorPct}%`)}${rowHtml("Ghi chú", zone.note)}</div>`,
              );
          });
        });
      }

      // Điểm sự cố (bản đồ số).
      if (visible("incidents")) {
        data.incidents.forEach((inc) => {
          if (!inc.latitude || !inc.longitude) return;
          if (!isVisibleInBoundary(inc.latitude, inc.longitude)) return;
          const incidentDetail: GisFeatureDetail = {
            id: inc.id,
            title: `${inc.code} — ${inc.type}`,
            subtitle: inc.location,
            source: "PostGIS",
            category: "Sự cố lưới điện",
            status: inc.progress,
            severity: inc.severity === "resolved" ? "info" : "danger",
            fields: [
              { label: "Thời gian", value: inc.time },
              { label: "Tuyến", value: inc.lineCode },
              { label: "Trạm", value: inc.substationCode },
              { label: "Khu vực ảnh hưởng", value: inc.affectedArea },
              { label: "Khách hàng mất điện", value: inc.customersAffected },
              { label: "Phụ tải mất", value: inc.lostLoadMw ? `${inc.lostLoadMw} MW` : null },
              { label: "Đơn vị xử lý", value: inc.handler },
              { label: "Tiến độ", value: inc.progress },
            ],
            note: inc.criticalInfra,
            recommendation:
              "Mở hồ sơ sự cố để cập nhật xử lý, phạm vi ảnh hưởng và thời gian khôi phục.",
            managementHref: `/energy/grid-safety?incident=${encodeURIComponent(inc.id)}`,
            managementLabel: "Đến xử lý sự cố",
          };
          const icon = L.divIcon({
            className: "grid-incident-pin",
            html: `<div style="width:24px;height:24px;border-radius:50%;background:#C62828;border:2px solid #fff;display:grid;place-items:center;box-shadow:0 1px 4px rgba(0,0,0,.35)"><img src="/images/map/distribution-box.svg" alt="" style="width:14px;height:14px;filter:${GIS_ICON_FILTER};" /></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });
          const marker = L.marker([inc.latitude, inc.longitude], {
            icon,
            title: inc.code,
            zIndexOffset: 1_200,
            riseOnHover: true,
          })
            .addTo(layer)
            .bindPopup(
              `<div style="min-width:240px;font-family:Inter,system-ui,sans-serif"><div style="font-weight:700;color:#C62828;margin-bottom:6px">${inc.code} — ${inc.type}</div>${rowHtml("Thời gian", inc.time)}${rowHtml("Tuyến", inc.lineCode)}${rowHtml("Vị trí", inc.location)}${rowHtml("Mất điện", `${inc.customersAffected ?? 0} khách hàng · ${inc.lostLoadMw ?? 0} MW`)}${rowHtml("Xử lý", inc.handler)}${rowHtml("Tiến độ", inc.progress)}<button class="grid-open-detail" style="margin-top:10px;width:100%;padding:7px 10px;border:0;border-radius:7px;background:#C62828;color:#fff;font-size:12px;font-weight:700;cursor:pointer">Xem chi tiết</button></div>`,
            );
          markerByKeyRef.current.set(`incident:${inc.id}`, marker);
          marker.on("popupopen", () => {
            marker
              .getPopup()
              ?.getElement()
              ?.querySelector<HTMLElement>(".grid-open-detail")
              ?.addEventListener("click", () => setDetail(incidentDetail), { once: true });
          });
        });
      }

      // Điểm đấu nối trạm.
      if (drawAreas && visible("connectionPoints")) {
        data.substations.forEach((s) => {
          s.connectionPoints?.forEach((p) => {
            if (!p.latitude || !p.longitude) return;
            if (!isVisibleInBoundary(p.latitude, p.longitude)) return;
            L.circleMarker([p.latitude, p.longitude], {
              radius: 4,
              color: "#0F766E",
              fillColor: "#0F766E",
              fillOpacity: 1,
              weight: 1.2,
            })
              .addTo(layer)
              .bindPopup(
                `<div style="min-width:220px;font-family:Inter,system-ui,sans-serif"><div style="font-weight:700;color:#0F766E;margin-bottom:6px">${p.name}</div>${rowHtml("Loại", p.type)}${rowHtml("Cấp điện áp", p.voltageLevel)}${rowHtml("Trạm chủ", s.name)}${rowHtml("Trạng thái", p.status)}</div>`,
              );
          });
        });
      }

      // Nguồn NLTT đấu nối lưới.
      if (drawAreas && visible("renewables")) {
        data.renewables.forEach((r) => {
          if (!r.latitude || !r.longitude) return;
          if (!isVisibleInBoundary(r.latitude, r.longitude)) return;
          const renewableDetail: GisFeatureDetail = {
            id: r.id,
            title: r.owner,
            subtitle: r.code,
            source: "PostGIS",
            category: "Nguồn năng lượng tái tạo",
            status: r.status,
            severity:
              r.overload === "Vượt giới hạn"
                ? "danger"
                : r.overload === "Cảnh báo"
                  ? "warning"
                  : "info",
            fields: [
              { label: "Loại nguồn", value: r.type },
              { label: "Công suất", value: `${r.installedKw}/${r.capacityKw} kW` },
              { label: "Khả năng tiếp nhận", value: `${r.hostingCapacityKw} kW` },
              { label: "Trạm đấu nối", value: r.hostSubstationId },
              { label: "Tuyến đấu nối", value: r.hostLineCode },
              { label: "Điểm đấu nối", value: r.connectionPoint },
              { label: "Đánh giá quá tải", value: r.overload },
            ],
            managementHref: "/energy/nhiem-vu-1/quan-ly",
          };
          const color =
            r.overload === "Vượt giới hạn"
              ? "#C62828"
              : r.overload === "Cảnh báo"
                ? "#F59E0B"
                : "#2E7D32";
          const asset = r.type.toLowerCase().includes("mặt trời")
            ? GIS_ICON_ASSETS.solar
            : r.type.toLowerCase().includes("thủy")
              ? GIS_ICON_ASSETS.hydro
              : r.type.toLowerCase().includes("gió")
                ? GIS_ICON_ASSETS.wind
                : GIS_ICON_ASSETS.powerPlant;
          const icon = L.divIcon({
            className: "grid-renewable-pin",
            html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:2px solid #fff;display:grid;place-items:center;box-shadow:0 1px 4px rgba(0,0,0,.3)"><img src="${asset}" alt="" style="width:17px;height:17px;filter:${GIS_ICON_FILTER};" /></div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          });
          const marker = L.marker([r.latitude, r.longitude], { icon, title: r.owner })
            .addTo(layer)
            .bindPopup(
              `<div style="min-width:240px;font-family:Inter,system-ui,sans-serif"><div style="font-weight:700;color:#2E7D32;margin-bottom:6px">${r.owner}</div>${rowHtml("Mã nguồn", r.code)}${rowHtml("Loại", r.type)}${rowHtml("Công suất lắp đặt", `${r.installedKw} / ${r.capacityKw} kW`)}${rowHtml("Trạm đấu nối", r.hostSubstationId)}${rowHtml("Điểm đấu nối", r.connectionPoint)}${rowHtml("Quá tải", r.overload)}${rowHtml("Trạng thái", r.status)}<button class="grid-open-detail" style="margin-top:10px;width:100%;padding:7px 10px;border:0;border-radius:7px;background:#1565C0;color:#fff;font-size:12px;font-weight:700;cursor:pointer">Xem chi tiết</button></div>`,
            );
          markerByKeyRef.current.set(`renewable:${r.id}`, marker);
          marker.on("popupopen", () => {
            marker
              .getPopup()
              ?.getElement()
              ?.querySelector<HTMLElement>(".grid-open-detail")
              ?.addEventListener("click", () => setDetail(renewableDetail), { once: true });
          });
        });
      }

      if (visible("lines")) {
        data.lines.forEach((line) => {
          if (!line.route?.length) return;
          const planned = line.status === "Quy hoạch";
          const switchingOff =
            line.switchingState === "MAINTENANCE" || line.switchingState === "STOPPED";
          const color = planned
            ? "#7C3AED"
            : switchingOff
              ? "#64748B"
              : (LINE_COLOR[line.voltageLevel] ?? "#00897B");
          const polyline = L.polyline(line.route, {
            color,
            weight: 3,
            opacity: 0.82,
            ...(planned || switchingOff ? { dashArray: switchingOff ? "4 3" : "8 8" } : {}),
          })
            .addTo(layer)
            .bindPopup(buildLinePopup(line, () => onSelectEntity?.({ kind: "line", item: line })));
          wirePopupButton(polyline, () => onSelectEntity?.({ kind: "line", item: line }));
        });
      }

      if (visible("planning") && mode !== "station") {
        data.planned
          .filter((a) => a.type === "line" && a.route?.length)
          .forEach((a) => {
            const color = LINE_COLOR[a.voltageLevel] ?? "#00897B";
            const polyline = L.polyline(a.route as [number, number][], {
              color,
              weight: 2.5,
              opacity: 0.6,
              dashArray: "6 6",
            })
              .addTo(layer)
              .bindPopup(
                `<div style="min-width:240px;font-family:Inter,system-ui,sans-serif"><div style="font-weight:700;color:#0f2a4a;margin-bottom:6px">${a.name}</div>${rowHtml("Mã", a.code)}${rowHtml("Cấp điện áp", a.voltageLevel)}${rowHtml("Tiến độ", a.progress)}${rowHtml("Nhà đầu tư", a.investor)}<button class="grid-open-profile" style="margin-top:10px;width:100%;padding:7px 10px;border:0;border-radius:7px;background:#1565C0;color:#fff;font-size:12px;font-weight:700;cursor:pointer">Xem chi tiết</button></div>`,
              );
            wirePopupButton(polyline, () => onSelectEntity?.({ kind: "plan", item: a }));
          });

        // Trụ điện quy hoạch (theo tuyến quy hoạch).
        data.plannedPoles.forEach((pole) => {
          if (!pole.latitude || !pole.longitude) return;
          if (!isVisibleInBoundary(pole.latitude, pole.longitude)) return;
          const entity: GridMapEntity = { kind: "pole", item: pole };
          const marker = L.marker([pole.latitude, pole.longitude], {
            icon: L.divIcon({
              className: "grid-map-pin",
              html: `<div style="width:20px;height:20px;border-radius:50%;background:#7C3AED;border:2px dashed #fff;display:grid;place-items:center"><img src="${GIS_ICON_ASSETS.utilityPole}" alt="" style="width:12px;height:12px;filter:${GIS_ICON_FILTER};" /></div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            }),
          })
            .addTo(layer)
            .bindPopup(
              `<div style="min-width:210px;font-family:Inter,system-ui,sans-serif"><div style="font-weight:700;color:#0f2a4a;margin-bottom:6px">${pole.code}</div>${rowHtml("Số trụ", pole.number)}${rowHtml("Tuyến", pole.lineCode)}${rowHtml("Kết cấu dự kiến", pole.planning?.structureType ?? pole.type)}${rowHtml("Khoảng cột", `${pole.planning?.spacingKm ?? "—"} km`)}${rowHtml("Giải phóng mặt bằng", pole.planning?.clearanceStatus)}<button class="grid-open-profile" style="margin-top:10px;width:100%;padding:7px 10px;border:0;border-radius:7px;background:#1565C0;color:#fff;font-size:12px;font-weight:700;cursor:pointer">Xem chi tiết</button></div>`,
            );
          wirePopupButton(marker, () => onSelectEntity?.(entity));
        });
      }

      if (visible("poles") && mode !== "station") {
        data.poles.forEach((pole) => {
          if (!pole.latitude || !pole.longitude) return;
          if (!isVisibleInBoundary(pole.latitude, pole.longitude)) return;
          const entity: GridMapEntity = { kind: "pole", item: pole };
          const marker = L.marker([pole.latitude, pole.longitude], {
            icon: L.divIcon({
              className: "grid-map-pin",
              html: `<div style="width:20px;height:20px;border-radius:50%;background:#334155;border:2px solid #fff;display:grid;place-items:center"><img src="${GIS_ICON_ASSETS.utilityPole}" alt="" style="width:12px;height:12px;filter:${GIS_ICON_FILTER};" /></div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            }),
          })
            .addTo(layer)
            .bindPopup(
              `<div style="min-width:200px;font-family:Inter,system-ui,sans-serif"><div style="font-weight:700;color:#0f2a4a;margin-bottom:6px">${pole.code}</div>${rowHtml("Số trụ", pole.number)}${rowHtml("Tuyến", pole.lineCode)}${rowHtml("Loại trụ", pole.type)}${rowHtml("Hành lang", pole.safetyCorridor)}<button class="grid-open-profile" style="margin-top:10px;width:100%;padding:7px 10px;border:0;border-radius:7px;background:#1565C0;color:#fff;font-size:12px;font-weight:700;cursor:pointer">Xem chi tiết</button></div>`,
            );
          wirePopupButton(marker, () => onSelectEntity?.(entity));
        });
      }

      entities.forEach((entity) => {
        const show =
          (entity.kind === "substation" && visible("substations")) ||
          (entity.kind === "line" && false) ||
          (entity.kind === "pole" && visible("poles") && mode !== "station") ||
          (entity.kind === "plan" && visible("planning") && mode !== "station");
        if (!show) return;

        if (entity.kind === "substation") {
          const s = entity.item;
          const lat = s.latitude;
          const lng = s.longitude;
          if (!lat || !lng) return;
          if (!isVisibleInBoundary(lat, lng)) return;
          const key = entityKey(entity);
          const selected = key === selectedKey;
          const color = substationColor(s);
          const glyph =
            s.voltageLevel === "500kV"
              ? "500"
              : s.voltageLevel === "220kV"
                ? "220"
                : s.voltageLevel === "110kV"
                  ? "110"
                  : "22";
          const ring = selected ? "box-shadow:0 0 0 4px rgba(21,101,192,.25);" : "";
          const planned = s.status === "Quy hoạch";
          const html = `<div style="width:${planned ? 26 : 30}px;height:${planned ? 26 : 30}px;border-radius:999px;background:${color};border:2px solid #fff;color:#fff;display:grid;place-items:center;font-size:9px;font-weight:800;${ring}${planned ? ";border-style:dashed" : ""}"><img src="/images/map/substation.svg" alt="" style="width:${planned ? 15 : 18}px;height:${planned ? 15 : 18}px;filter:${GIS_ICON_FILTER};" /></div>`;
          const marker = L.marker([lat, lng], {
            icon: L.divIcon({
              className: "grid-map-pin",
              html,
              iconSize: [planned ? 26 : 30, planned ? 26 : 30],
              iconAnchor: [13, 13],
            }),
            title: s.name,
          })
            .addTo(layer)
            .bindPopup(buildSubstationPopup(s, () => onSelectEntity?.(entity)));
          wirePopupButton(marker, () => onSelectEntity?.(entity));
          markerByKeyRef.current.set(key, marker);

          if (s.supplyRadiusKm && mode !== "station" && visible("supplyAreas")) {
            L.circle([lat, lng], {
              radius: s.supplyRadiusKm * 1000,
              color: color,
              weight: 1,
              fillColor: color,
              fillOpacity: 0.06,
            }).addTo(layer);
          }
        }

        if (entity.kind === "plan") {
          const a = entity.item;
          if (a.type !== "substation" || !a.latitude || !a.longitude) return;
          if (!isVisibleInBoundary(a.latitude, a.longitude)) return;
          const key = entityKey(entity);
          const selected = key === selectedKey;
          const ring = selected ? "box-shadow:0 0 0 4px rgba(21,101,192,.25);" : "";
          const html = `<div style="width:26px;height:26px;border-radius:999px;background:#7C3AED;border:2px dashed #fff;color:#fff;display:grid;place-items:center;font-size:9px;font-weight:800;${ring}"><img src="/images/map/substation.svg" alt="" style="width:15px;height:15px;filter:${GIS_ICON_FILTER};" /></div>`;
          const marker = L.marker([a.latitude, a.longitude], {
            icon: L.divIcon({
              className: "grid-map-pin",
              html,
              iconSize: [26, 26],
              iconAnchor: [13, 13],
            }),
            title: a.name,
          })
            .addTo(layer)
            .bindPopup(
              `<div style="min-width:240px;font-family:Inter,system-ui,sans-serif"><div style="font-weight:700;color:#0f2a4a;margin-bottom:6px">${a.name}</div>${rowHtml("Mã", a.code)}${rowHtml("Cấp điện áp", a.voltageLevel)}${rowHtml("Tiến độ", a.progress)}${rowHtml("Năm hoàn thành", a.year)}<button class="grid-open-profile" style="margin-top:10px;width:100%;padding:7px 10px;border:0;border-radius:7px;background:#1565C0;color:#fff;font-size:12px;font-weight:700;cursor:pointer">Xem chi tiết</button></div>`,
            );
          markerByKeyRef.current.set(key, marker);
          wirePopupButton(marker, () => onSelectEntity?.(entity));
        }
      });

      if (!hasFittedDataRef.current) {
        const coordinates: [number, number][] = [
          ...data.substations
            .filter((item) => item.latitude && item.longitude)
            .filter((item) => isVisibleInBoundary(item.latitude!, item.longitude!))
            .map((item) => [item.latitude!, item.longitude!] as [number, number]),
          ...data.poles
            .filter((item) => item.latitude && item.longitude)
            .filter((item) => isVisibleInBoundary(item.latitude!, item.longitude!))
            .map((item) => [item.latitude!, item.longitude!] as [number, number]),
          ...data.lines.flatMap((item) => item.route ?? []),
          ...data.renewables
            .filter((item) => item.latitude && item.longitude)
            .filter((item) => isVisibleInBoundary(item.latitude!, item.longitude!))
            .map((item) => [item.latitude!, item.longitude!] as [number, number]),
          ...data.incidents
            .filter((item) => item.latitude && item.longitude)
            .filter((item) => isVisibleInBoundary(item.latitude!, item.longitude!))
            .map((item) => [item.latitude!, item.longitude!] as [number, number]),
        ];
        if (coordinates.length) {
          mapRef.current?.fitBounds(L.latLngBounds(coordinates), {
            padding: [28, 28],
            maxZoom: 12,
          });
          hasFittedDataRef.current = true;
        }
      }

      if (selectedKey) markerByKeyRef.current.get(selectedKey)?.openPopup();
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, data, entities, onSelectEntity, ready, selectedKey, visibleLayers, isVisibleInBoundary]);

  const searchResults = useMemo(() => {
    const items: GridSearchItem[] = [];
    const add = (key: string, label: string, sublabel: string, lat?: number, lng?: number) => {
      if (lat != null && lng != null && isVisibleInBoundary(lat, lng)) items.push({ key, label, sublabel, lat, lng });
    };

    entities.forEach((entity) => {
      const layerKey = entity.kind === "substation" ? "substations" : entity.kind === "pole" ? "poles" : "planning";
      if (!visibleLayers.includes(layerKey) || (entity.kind === "pole" && mode === "station")) return;
      if (entity.kind === "substation") add(entityKey(entity), entity.item.name, `Trạm biến áp · ${entity.item.code}`, entity.item.latitude, entity.item.longitude);
      if (entity.kind === "pole") add(entityKey(entity), entity.item.code, `Trụ điện · Tuyến ${entity.item.lineCode}`, entity.item.latitude, entity.item.longitude);
      if (entity.kind === "plan" && entity.item.type === "substation") add(entityKey(entity), entity.item.name, `Quy hoạch · ${entity.item.code}`, entity.item.latitude, entity.item.longitude);
    });
    if (visibleLayers.includes("incidents")) {
      data.incidents.forEach((item) => add(`incident:${item.id}`, `${item.code} · ${item.type}`, `Sự cố · ${item.location}`, item.latitude, item.longitude));
    }
    if (visibleLayers.includes("renewables") && mode !== "station") {
      data.renewables.forEach((item) => add(`renewable:${item.id}`, item.owner, `Nguồn NLTT · ${item.code}`, item.latitude, item.longitude));
    }

    const query = normalizeSearchValue(searchQuery);
    return items
      .filter((item) => searchType === "all" || item.key.startsWith(`${searchType}:`))
      .filter((item) => !query || normalizeSearchValue(`${item.label} ${item.sublabel}`).includes(query))
      .slice(0, 6);
  }, [data, entities, mode, searchQuery, searchType, visibleLayers, isVisibleInBoundary]);

  const focusSearchItem = (item: GridSearchItem) => {
    setSearchQuery(item.label);
    setSearchOpen(false);
    const map = mapRef.current;
    if (!map) return;
    map.flyTo([item.lat, item.lng], Math.max(map.getZoom(), 13), { duration: 0.6 });
    map.once("moveend", () => markerByKeyRef.current.get(item.key)?.openPopup());
  };

  useEffect(() => {
    if (!ready || !selectedKey) return;
    const marker = markerByKeyRef.current.get(selectedKey);
    const map = mapRef.current;
    if (!marker || !map) return;
    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 11), { duration: 0.5 });
    marker.openPopup();
  }, [ready, selectedKey]);

  const toggleLayer = (key: GridLayerKey) => {
    setVisibleLayers((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  };

  const localCounts: Record<GridLayerKey, number> = {
    substations: data.substations.length,
    lines: data.lines.length,
    poles: data.poles.length,
    supplyAreas: data.supplyAreas.length,
    loadAreas: data.loadAreas.length,
    planning: data.planned.length,
    corridors: data.lines.length,
    connectionPoints: data.substations.reduce(
      (sum, item) => sum + (item.connectionPoints?.length ?? 0),
      0,
    ),
    incidents: data.incidents.length,
    overloadZones: data.overloadZones.length,
    renewables: data.renewables.length,
  };
  const layerControls: GisLayerControl[] = [
    ...(Object.keys(LAYER_LABEL) as GridLayerKey[]).map((key) => ({
      id: `postgis:${key}`,
      label: LAYER_LABEL[key],
      source: ["incidents", "overloadZones"].includes(key)
        ? ("Cảnh báo" as const)
        : ("PostGIS" as const),
      color: LAYER_VISUAL[key].color,
      glyph: LAYER_VISUAL[key].glyph,
      icon: layerIcon(key),
      visible: visibleLayers.includes(key),
      description: `${localCounts[key].toLocaleString("vi-VN")} đối tượng dữ liệu lưới điện`,
    })),
    ...(geoServerConfig?.layers ?? []).map((layer) => ({
      id: layer.name,
      label: layer.label,
      source: "GeoServer" as const,
      color: layer.color,
      glyph: geoServerGlyph(layer.kind, layer.name),
      icon: layer.geometry === "point" ? geoServerIconAsset(layer.kind, layer.name) : undefined,
      visible: visibleGeoLayers.includes(layer.name),
      description: `${layer.geometry} · ${layer.kind} · WFS tương tác`,
    })),
  ];
  const legendItems: GisLegendItem[] = layerControls
    .filter((layer) => layer.visible)
    .map((layer) => ({
      id: layer.id,
      label: layer.label,
      color: layer.color,
      glyph: layer.glyph,
      icon: layer.icon,
      animated: layer.id === "postgis:incidents" || layer.id === "postgis:overloadZones",
      line: layer.glyph === "—",
    }));

  const toggleUnifiedLayer = (id: string) => {
    if (id.startsWith("postgis:")) {
      toggleLayer(id.slice("postgis:".length) as GridLayerKey);
      return;
    }
    setVisibleGeoLayers((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const setAllLayers = (visible: boolean) => {
    setVisibleLayers(visible ? (Object.keys(LAYER_LABEL) as GridLayerKey[]) : []);
    setVisibleGeoLayers(visible ? (geoServerConfig?.layers ?? []).map((layer) => layer.name) : []);
  };

  return (
    <div
      className={cn(
        "relative z-0 isolate overflow-hidden rounded-xl border border-border bg-surface shadow-panel",
        expanded && "fixed inset-2 z-40 rounded-xl shadow-2xl",
      )}
      style={{ height: expanded ? "calc(100dvh - 1rem)" : `${height}px` }}
    >
      <div
        ref={containerRef}
        className="grid-map z-0 h-full w-full"
        aria-label="Bản đồ lưới điện, trạm biến áp và nguồn năng lượng tái tạo từ cơ sở dữ liệu"
      />
      <div ref={searchRef} className="absolute left-3 top-3 z-[700] w-[min(560px,calc(100%-1.5rem))] sm:w-[min(50%,560px)]">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-2 py-2 shadow-lg backdrop-blur-sm">
          <MapSearchTypeSelect
            value={searchType}
            onChange={setSearchType}
            options={[
              { value: "all", label: "Tất cả" },
              { value: "substation", label: "Trạm biến áp" },
              { value: "pole", label: "Trụ điện" },
              { value: "plan", label: "Quy hoạch" },
              { value: "incident", label: "Sự cố" },
              { value: "renewable", label: "Nguồn NLTT" },
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
      <GisMapChrome
        layers={layerControls}
        legendItems={legendItems}
        expanded={expanded}
        detail={detail}
        onToggleLayer={toggleUnifiedLayer}
        onSetAllLayers={setAllLayers}
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
        onToggleExpanded={() => setExpanded((value) => !value)}
        onCloseDetail={() => setDetail(null)}
        boundaryMode={boundaryMode}
        onBoundaryModeChange={setBoundaryMode}
        boundaryScopeName="energy-map-boundary-mode-grid"
        statusText="Click đối tượng để xem tóm tắt; chọn Xem chi tiết để mở hồ sơ và chức năng xử lý."
      />
    </div>
  );
}

export type { GridMapEntity as GridEntity };
