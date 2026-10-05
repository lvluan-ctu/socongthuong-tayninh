import { useEffect, useRef, useState } from "react";
import type {
  CircleMarker as LeafletCircle,
  CircleMarkerOptions,
  LayerGroup,
  Map as LeafletMap,
  Marker as LeafletMarker,
  PathOptions,
  Polygon as LeafletPolygon,
} from "leaflet";
import type { Cluster, Factory, WardZone } from "@/lib/types";
import { FACTORY_STATUS_LABEL } from "@/lib/constants";
import {
  clusterGeometry,
  wardZoneLatLngs,
  zoneBorderColor,
  zoneFillColor,
} from "@/lib/gis-geometry";
import { clusterIconAsset } from "@/config/gis-visuals";
import { useTayNinhBoundary } from "@/lib/tay-ninh-boundary";


// Phạm vi tỉnh Tây Ninh mới (sau hợp nhất Tây Ninh + Long An, 1/7/2025):
// trải dài từ Cần Giuộc/Long An (106.68) tới biên giới Tây Ninh (105.9).
export const TAY_NINH_CENTER: [number, number] = [10.95, 106.25];
export const TAY_NINH_ZOOM = 9;
export const ZONE_FIT_MAX_ZOOM = 13.2;
export const WARD_FIT_MAX_ZOOM = 12.6;
export const ZONE_NEAR_ZOOM = 11.8; // zoom >= này hiển thị sát ranh giới thật
export const MIN_ONSCREEN_DIM = 22; // px tối thiểu trên màn hình trước khi cần "display enhancement"
export const ENHANCE_RADIUS = 15; // px vòng tròn hiển thị/hit area cho polygon quá nhỏ
export const LABEL_MIN_DIM = 72; // px để hiện label tên KCN trên polygon đủ diện tích

const FACTORY_STATUS_COLOR: Record<Factory["status"], string> = {
  active: "#2E7D32",
  expanding: "#E59A23",
  suspended: "#64748B",
};

// ─────────────────────────── Marker doanh nghiệp ───────────────────────────
function factoryIconHtml(f: Factory, selected: boolean): string {
  const color = FACTORY_STATUS_COLOR[f.status];
  const img = clusterIconAsset(f.sector);
  const size = 32;
  const ring = selected
    ? `box-shadow:0 0 0 3px #1565C0,0 2px 8px rgba(0,0,0,.3);`
    : `box-shadow:0 1px 4px rgba(0,0,0,.25);`;
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;border:3px solid ${color};background:#fff;${ring}display:grid;place-items:center;overflow:hidden"><img src="${img}" alt="" style="width:${size - 8}px;height:${size - 8}px;object-fit:contain"/></div>`;
}

export function makeFactoryIcon(L: typeof import("leaflet"), f: Factory, selected: boolean) {
  const size = 32;
  return L.divIcon({
    className: "gis-pin gis-pin-factory",
    html: factoryIconHtml(f, selected),
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

// ─────────────────────────── HTML helpers ───────────────────────────
function escapeHtml(input: string | number): string {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function rowHtml(k: string, v: string | number): string {
  return `<div style="display:flex;justify-content:space-between;gap:12px;font-size:11px;padding:2px 0"><span style="color:#64748B">${escapeHtml(k)}</span><span style="font-weight:500;color:#0F2A4A;text-align:right">${escapeHtml(v)}</span></div>`;
}

// Tooltip nhanh khi hover Polygon KCN/CCN
export function buildZoneTooltip(c: Cluster): string {
  return `<div style="min-width:180px">
    <div style="font-weight:600;font-size:12px;color:#0F2A4A;margin-bottom:6px">${escapeHtml(c.name)}</div>
    ${rowHtml("Diện tích", `${c.area} ha`)}
    ${rowHtml("Doanh nghiệp", c.enterprises)}
    ${rowHtml("Tỷ lệ lấp đầy", `${c.occupancy}%`)}
  </div>`;
}

// Tooltip nhanh khi hover Polygon xã/phường (lớp ngoài cùng)
export function buildWardTooltip(w: WardZone): string {
  const type = w.type === "phuong" ? "Phường" : "Xã";
  return `<div style="min-width:200px">
    <div style="font-weight:600;font-size:12px;color:#0F2A4A;margin-bottom:4px">${escapeHtml(w.name)}</div>
    <div style="font-size:11px;color:#64748B;margin-bottom:6px">${type} · trực thuộc tỉnh (chính quyền 2 cấp)</div>
    ${rowHtml("KCN/CCN trong vùng", w.clusters.length)}
    ${rowHtml("Bấm để", "xem tổng quan địa bàn")}
  </div>`;
}

// Popup nhỏ gọn khi click Marker doanh nghiệp
export function buildFactoryPopup(
  f: Factory,
  zoneName: string | undefined,
  onOpen: () => void,
): HTMLElement {
  const el = document.createElement("div");
  el.style.minWidth = "250px";
  el.style.fontFamily = "inherit";
  el.innerHTML = `
    <div style="font-weight:600;font-size:13px;line-height:1.35;color:#0F2A4A;margin-bottom:8px">${escapeHtml(f.name)}</div>
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap">
      <span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#E8F0FA;color:#1565C0;font-size:11px;font-weight:600">${escapeHtml(f.sector)}</span>
      <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#2E7D32"><span style="width:8px;height:8px;border-radius:999px;background:${FACTORY_STATUS_COLOR[f.status]};display:inline-block"></span>${FACTORY_STATUS_LABEL[f.status]}</span>
    </div>
    ${rowHtml("Khu/Cụm", zoneName ?? "—")}
    ${rowHtml("Địa chỉ", f.address)}
    ${rowHtml("Đại diện", f.representative)}
    <button class="gis-open-profile" style="margin-top:10px;width:100%;padding:7px 12px;border:none;border-radius:8px;background:#1565C0;color:#fff;font-size:12px;font-weight:600;cursor:pointer">XEM CHI TIẾT</button>
  `;
  el.querySelector<HTMLElement>(".gis-open-profile")?.addEventListener("click", onOpen);
  return el;
}

// ─────────────────────────── Style Polygon theo state ───────────────────────────
export type ZoomMode = "far" | "near";

// Trạng thái vùng xã/phường theo bộ lọc ngành + lựa chọn drill-down
export type WardState = "selected" | "highlight" | "dim" | "base";

export function wardStyle(state: WardState, mode: ZoomMode): PathOptions {
  const far = mode === "far";
  switch (state) {
    case "selected":
      return {
        pane: "wardPane",
        color: "#1565C0",
        weight: far ? 3.5 : 3,
        opacity: 1,
        fillColor: "#1565C0",
        fillOpacity: 0.28,
        dashArray: "7 4",
        lineCap: "round",
        lineJoin: "round",
        className: "gis-ward-path",
      };
    case "highlight":
      return {
        pane: "wardPane",
        color: "#1565C0",
        weight: far ? 2.5 : 2,
        opacity: 0.95,
        fillColor: "#1565C0",
        fillOpacity: 0.15,
        dashArray: "6 4",
        lineCap: "round",
        lineJoin: "round",
        className: "gis-ward-path",
      };
    case "dim":
      return {
        pane: "wardPane",
        color: "#94A3B8",
        weight: 1.2,
        opacity: 0.45,
        fillColor: "#64748B",
        fillOpacity: 0.04,
        dashArray: "4 4",
        lineCap: "round",
        lineJoin: "round",
        className: "gis-ward-path",
      };
    default:
      return {
        pane: "wardPane",
        color: "#64748B",
        weight: far ? 2 : 1.5,
        opacity: 0.6,
        fillColor: "#64748B",
        fillOpacity: 0.05,
        dashArray: "4 4",
        lineCap: "round",
        lineJoin: "round",
        className: "gis-ward-path",
      };
  }
}

export function zoneStyle(
  c: Cluster,
  selected: boolean,
  hover: boolean,
  mode: ZoomMode,
): PathOptions {
  const far = mode === "far";
  return {
    pane: "zonePane",
    color: zoneBorderColor(c),
    weight: selected ? (far ? 5 : 4) : hover ? (far ? 4 : 3) : far ? 3 : 2,
    opacity: selected ? 1 : hover ? 0.95 : far ? 0.9 : 0.8,
    fillColor: zoneFillColor(c),
    fillOpacity: selected ? (far ? 0.5 : 0.45) : hover ? (far ? 0.35 : 0.3) : far ? 0.28 : 0.2,
    lineCap: "round",
    lineJoin: "round",
    className: "gis-zone-path",
  };
}

export function dimZoneStyle(c: Cluster, mode: ZoomMode): PathOptions {
  const far = mode === "far";
  return {
    pane: "zonePane",
    color: zoneBorderColor(c),
    weight: far ? 2 : 1.5,
    opacity: 0.55,
    fillColor: zoneFillColor(c),
    fillOpacity: 0.07,
    lineCap: "round",
    lineJoin: "round",
    className: "gis-zone-path",
  };
}

// Lớp hiển thị/hit area hỗ trợ cho polygon nhỏ ở mức zoom xa — chỉ phục vụ UX.
export function enhanceStyle(c: Cluster, selected: boolean, hover: boolean): CircleMarkerOptions {
  return {
    pane: "zoneEnhancePane",
    radius: ENHANCE_RADIUS,
    color: "#ffffff",
    weight: selected ? 3 : 2,
    opacity: 1,
    fillColor: zoneFillColor(c),
    fillOpacity: selected ? 0.75 : hover ? 0.6 : 0.45,
    className: "gis-zone-enhance",
  };
}

// ─────────────────────────── Component ───────────────────────────
export function IndustrialLayerMap({
  zones,
  selectedZoneId,
  companies,
  selectedCompanyId,
  zoneName,
  wards,
  selectedWardId,
  highlightWardIds,
  wardFilterActive,
  wardClusterIds,
  zoneNameById,
  onSelectZone,
  onSelectWard,
  onSelectCompany,
  onOpenProfile,
  height = 560,
}: {
  zones: Cluster[];
  selectedZoneId?: string | null;
  companies: Factory[];
  selectedCompanyId?: string | null;
  zoneName?: string | null;
  wards?: WardZone[];
  selectedWardId?: string | null;
  highlightWardIds?: string[];
  wardFilterActive?: boolean;
  wardClusterIds?: string[];
  zoneNameById?: Record<string, string>;
  onSelectZone?: ((c: Cluster) => void) | undefined;
  onSelectWard?: ((w: WardZone) => void) | undefined;
  onSelectCompany?: ((f: Factory) => void) | undefined;
  onOpenProfile?: ((f: Factory) => void) | undefined;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const wardLayerRef = useRef<LayerGroup | null>(null);
  const boundaryLayerRef = useRef<LayerGroup | null>(null);
  const zoneLayerRef = useRef<LayerGroup | null>(null);
  const enhanceLayerRef = useRef<LayerGroup | null>(null);
  const companyLayerRef = useRef<LayerGroup | null>(null);
  const markerByIdRef = useRef<Map<string, LeafletMarker>>(new Map());
  const lastZoneIdRef = useRef<string | null>(null);
  const lastWardIdRef = useRef<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [zoom, setZoom] = useState(TAY_NINH_ZOOM);
  const tayNinhBoundary = useTayNinhBoundary();

  // Khởi tạo bản đồ một lần — không bao giờ recreate khi đổi ngành/chọn KCN/mở drawer.
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    const onResize = () => {
      if (mapRef.current && containerRef.current) mapRef.current.invalidateSize();
    };
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;
      const map = L.map(containerRef.current, {
        center: TAY_NINH_CENTER,
        zoom: TAY_NINH_ZOOM,
        zoomControl: false,
      });
      // Nút phóng to/thu nhỏ kiểu chuẩn Leaflet (giống trang Nguồn năng lượng),
      // đặt góc phải trên — góc trái trên đã có breadcrumb đường dẫn.
      L.control.zoom({ position: "topright" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Phân lớp z-index: Base Map < Xã/Phường < Polygon KCN < Enhancement (hit area) < Marker doanh nghiệp < Popup
      const wardPane = map.createPane("wardPane");
      wardPane.style.zIndex = "440";
      const zonePane = map.createPane("zonePane");
      zonePane.style.zIndex = "450";
      const enhancePane = map.createPane("zoneEnhancePane");
      enhancePane.style.zIndex = "460";
      const companyPane = map.createPane("companyPane");
      companyPane.style.zIndex = "620";

      wardLayerRef.current = L.layerGroup().addTo(map);
      zoneLayerRef.current = L.layerGroup().addTo(map);
      enhanceLayerRef.current = L.layerGroup().addTo(map);
      companyLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setMapReady(true);
      void enhancePane;
      setZoom(map.getZoom());
      map.on("zoomend", () => setZoom(map.getZoom()));

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
      boundaryLayerRef.current = null;
      wardLayerRef.current = null;
      zoneLayerRef.current = null;
      enhanceLayerRef.current = null;
      companyLayerRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Ranh giới tỉnh Tây Ninh — dùng cùng nguồn GeoServer với bản đồ Quản lý thị trường.
  useEffect(() => {
    if (!mapReady || !tayNinhBoundary.length) return;
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;

      boundaryLayerRef.current?.remove();
      const layer = L.geoJSON(
        { type: "GeometryCollection", geometries: tayNinhBoundary } as GeoJSON.GeoJsonObject,
        {
          style: {
            color: "#0E7C6B",
            weight: 2.5,
            dashArray: "8 6",
            fillColor: "#0E7C6B",
            fillOpacity: 0.04,
            opacity: 0.8,
          },
          interactive: false,
        },
      ).addTo(map);
      boundaryLayerRef.current = layer;
    })();

    return () => {
      cancelled = true;
      boundaryLayerRef.current?.remove();
      boundaryLayerRef.current = null;
    };
  }, [mapReady, tayNinhBoundary]);

  // Lớp Polygon xã/phường (lớp ngoài cùng) — render lại khi bộ lọc ngành,
  // vùng được chọn hoặc mức zoom thay đổi.
  useEffect(() => {
    if (!mapReady) return;
    const layer = wardLayerRef.current;
    if (!layer) return;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      layer.clearLayers();
      const map = mapRef.current;
      if (!map) return;
      const currentZoom = map.getZoom();
      const mode: ZoomMode = currentZoom < ZONE_NEAR_ZOOM ? "far" : "near";

      (wards ?? []).forEach((w) => {
        const latlngs = wardZoneLatLngs(w);
        const bounds = L.latLngBounds(latlngs);
        const ne = map.project(bounds.getNorthEast(), currentZoom);
        const sw = map.project(bounds.getSouthWest(), currentZoom);
        const pixelSize = Math.max(Math.abs(ne.x - sw.x), Math.abs(ne.y - sw.y));
        const center = bounds.getCenter();
        const selected = w.id === selectedWardId;
        const highlighted = wardFilterActive && (highlightWardIds ?? []).includes(w.id);
        const dimmed = wardFilterActive && !highlighted && !selected;
        const state: WardState = selected
          ? "selected"
          : highlighted
            ? "highlight"
            : dimmed
              ? "dim"
              : "base";

        const poly = L.polygon(latlngs, wardStyle(state, mode))
          .addTo(layer)
          .bindTooltip(buildWardTooltip(w), { direction: "top", className: "gis-zone-tooltip" });

        poly.on("click", () => onSelectWard?.(w));
        poly.on("mouseover", () => {
          if (state !== "selected") {
            poly.setStyle({
              ...wardStyle(state, mode),
              weight: (wardStyle(state, mode).weight ?? 1.5) + 1,
              opacity: 1,
            });
          }
        });
        poly.on("mouseout", () => poly.setStyle(wardStyle(state, mode)));

        const el = poly.getElement();
        if (selected) {
          poly.bringToFront();
          el?.classList.add("gis-zone-glow-strong");
        } else if (highlighted) {
          el?.classList.add("gis-zone-glow");
        }

        // Label tên xã/phường — khi chọn luôn hiện, còn lại hiện khi đủ gần.
        if (selected || (mode === "near" && pixelSize >= 130)) {
          L.tooltip({
            permanent: true,
            direction: "center",
            className: "gis-ward-label",
            interactive: false,
            opacity: 1,
          })
            .setLatLng(center)
            .setContent(w.name)
            .addTo(layer);
        }
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [mapReady, wards, selectedWardId, highlightWardIds, wardFilterActive, zoom, onSelectWard]);

  // Lớp Polygon KCN/CCN — render lại khi bộ lọc ngành, khu được chọn hoặc mức zoom thay đổi.
  useEffect(() => {
    if (!mapReady) return;
    const layer = zoneLayerRef.current;
    const enhanceLayer = enhanceLayerRef.current;
    if (!layer || !enhanceLayer) return;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      layer.clearLayers();
      enhanceLayer.clearLayers();
      const map = mapRef.current;
      if (!map) return;
      const currentZoom = map.getZoom();
      const mode: ZoomMode = currentZoom < ZONE_NEAR_ZOOM ? "far" : "near";
      const selectedId = selectedZoneId ?? null;
      const selectedPolys: LeafletPolygon[] = [];
      const selectedEnhance: LeafletCircle[] = [];

      // Bật/tắt hiệu ứng halo (viền sáng) theo trạng thái.
      const applyGlow = (poly: LeafletPolygon, level: 0 | 1 | 2) => {
        const el = poly.getElement();
        if (!el) return;
        el.classList.toggle("gis-zone-glow", level >= 1);
        el.classList.toggle("gis-zone-glow-strong", level === 2);
      };

      zones.forEach((c) => {
        const selected = c.id === selectedId;
        const latlngs = clusterGeometry(c).coordinates[0]!.map(
          ([lng, lat]) => [lat, lng] as [number, number],
        );

        // Đo kích thước thật trên màn hình (px) ở mức zoom hiện tại — không đổi geometry.
        const bounds = L.latLngBounds(latlngs);
        const ne = map.project(bounds.getNorthEast(), currentZoom);
        const sw = map.project(bounds.getSouthWest(), currentZoom);
        const pixelSize = Math.max(Math.abs(ne.x - sw.x), Math.abs(ne.y - sw.y));
        const center = bounds.getCenter();

        // Polygon thật — luôn có, giữ ranh giới thực tế.
        const polygon = L.polygon(latlngs, zoneStyle(c, selected, false, mode))
          .addTo(layer)
          .bindTooltip(buildZoneTooltip(c), { direction: "top", className: "gis-zone-tooltip" });

        if (selected) selectedPolys.push(polygon);

        // Lớp hiển thị/hit area cho polygon quá nhỏ ở mức zoom xa (minimum visual size).
        let enhance: LeafletCircle | null = null;
        if (mode === "far" && pixelSize < MIN_ONSCREEN_DIM) {
          enhance = L.circleMarker([center.lat, center.lng], enhanceStyle(c, selected, false))
            .addTo(enhanceLayer)
            .bindTooltip(buildZoneTooltip(c), { direction: "top", className: "gis-zone-tooltip" });
          if (selected) selectedEnhance.push(enhance);
          enhance.on("click", () => onSelectZone?.(c));
        }

        // Label tên KCN trên polygon đủ diện tích — chỉ hiện khi zoom gần đủ rõ.
        if (mode === "near" && pixelSize >= LABEL_MIN_DIM && !enhance) {
          L.tooltip({
            permanent: true,
            direction: "center",
            className: "gis-zone-label",
            interactive: false,
            opacity: 1,
          })
            .setLatLng(center)
            .setContent(c.name)
            .addTo(enhanceLayer);

          // Icon ngành nghề ở tâm polygon KCN/CCN
          const primarySector = c.sectors.split(/[–\-/]/)[0]?.trim() ?? "";
          const iconSrc = clusterIconAsset(primarySector);
          L.marker([center.lat, center.lng], {
            icon: L.divIcon({
              className: "gis-zone-icon",
              html: `<img src="${iconSrc}" alt="" style="width:22px;height:22px;object-fit:contain;opacity:.85"/>`,
              iconSize: [22, 22],
              iconAnchor: [11, 11],
            }),
            pane: "zoneEnhancePane",
            interactive: false,
          }).addTo(enhanceLayer);
        }

        polygon.on("click", () => onSelectZone?.(c));

        // Khi đã khoan xuống cấp xã/phường (chưa chọn KCN), các KCN ngoài vùng bị mờ.
        const wardDimIds = selectedWardId && !selectedId ? (wardClusterIds ?? []) : null;
        const restyle = (hover: boolean) => {
          const inWard = wardDimIds ? wardDimIds.includes(c.id) : true;
          if ((selectedId && c.id !== selectedId) || !inWard) {
            polygon.setStyle(dimZoneStyle(c, mode));
            applyGlow(polygon, 0);
            if (!hover) polygon.bringToBack();
            enhance?.setStyle(enhanceStyle(c, false, false));
            if (!hover) enhance?.bringToBack();
          } else {
            const glowLevel = selected ? 2 : wardDimIds ? 1 : hover || mode === "far" ? 1 : 0;
            polygon.setStyle(zoneStyle(c, selected, hover, mode));
            applyGlow(polygon, glowLevel);
            if (selected) polygon.bringToFront();
            enhance?.setStyle(enhanceStyle(c, selected, hover));
            if (selected) enhance?.bringToFront();
          }
        };
        polygon.on("mouseover", () => restyle(true));
        polygon.on("mouseout", () => restyle(false));
        enhance?.on("mouseover", () => restyle(true));
        enhance?.on("mouseout", () => restyle(false));
      });

      // Đảm bảo Polygon được chọn luôn nổi trên các Polygon khác.
      selectedPolys.forEach((p) => p.bringToFront());
      selectedEnhance.forEach((e) => e.bringToFront());
    })();
    return () => {
      cancelled = true;
    };
  }, [mapReady, zones, selectedZoneId, selectedWardId, wardClusterIds, onSelectZone, zoom]);

  // Fit bounds khi chọn/chuyển xã/phường — zoom vừa đủ để thấy các KCN/CCN trong vùng.
  useEffect(() => {
    if (!mapReady || !selectedWardId || selectedZoneId) return;
    const map = mapRef.current;
    if (!map) return;
    const ward = (wards ?? []).find((w) => w.id === selectedWardId);
    if (!ward) return;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      map.fitBounds(L.latLngBounds(wardZoneLatLngs(ward)), {
        padding: [60, 60],
        maxZoom: WARD_FIT_MAX_ZOOM,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [mapReady, selectedWardId, selectedZoneId, wards]);

  // Fit bounds khi chọn/chuyển KCN — zoom vừa đủ, không quá sát.
  useEffect(() => {
    if (!mapReady || !selectedZoneId) return;
    const map = mapRef.current;
    if (!map) return;
    const zone = zones.find((z) => z.id === selectedZoneId);
    if (!zone) return;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      const coords = clusterGeometry(zone).coordinates[0]!.map(
        ([lng, lat]) => [lat, lng] as [number, number],
      );
      map.fitBounds(L.latLngBounds(coords), { padding: [48, 48], maxZoom: ZONE_FIT_MAX_ZOOM });
    })();
    return () => {
      cancelled = true;
    };
  }, [mapReady, zones, selectedZoneId]);

  // Quay về toàn tỉnh khi hủy chọn KCN/xã (vẫn giữ bộ lọc ngành).
  useEffect(() => {
    if (!mapReady) return;
    const prevZone = lastZoneIdRef.current;
    const prevWard = lastWardIdRef.current;
    if (selectedZoneId === prevZone && selectedWardId === prevWard) return;
    lastZoneIdRef.current = selectedZoneId ?? null;
    lastWardIdRef.current = selectedWardId ?? null;
    if (selectedZoneId || selectedWardId) return; // fit bounds do effect riêng xử lý
    if (prevZone != null || prevWard != null) {
      mapRef.current?.flyTo(TAY_NINH_CENTER, TAY_NINH_ZOOM, { duration: 0.6 });
    }
  }, [mapReady, selectedZoneId, selectedWardId]);

  // Marker doanh nghiệp — hiển thị khi đã chọn KCN hoặc xã/phường, lọc theo ngành ở phía parent.
  useEffect(() => {
    if (!mapReady) return;
    const layer = companyLayerRef.current;
    if (!layer) return;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      layer.clearLayers();
      markerByIdRef.current.clear();
      if (!selectedZoneId && !selectedWardId) return;

      companies.forEach((f) => {
        const selected = f.id === selectedCompanyId;
        const marker = L.marker([f.lat, f.lng], {
          icon: makeFactoryIcon(L, f, selected),
          title: f.name,
          pane: "companyPane",
        }).addTo(layer);
        markerByIdRef.current.set(f.id, marker);
        marker.on("click", () => onSelectCompany?.(f));
        marker.bindPopup(
          buildFactoryPopup(f, zoneNameById?.[f.id] ?? zoneName ?? undefined, () =>
            onOpenProfile?.(f),
          ),
          {
            autoPanPadding: [40, 40],
          },
        );
      });

      if (selectedCompanyId) {
        const m = markerByIdRef.current.get(selectedCompanyId);
        if (m) m.openPopup();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    mapReady,
    companies,
    selectedZoneId,
    selectedWardId,
    selectedCompanyId,
    zoneName,
    zoneNameById,
    onSelectCompany,
    onOpenProfile,
  ]);

  return (
    <div
      ref={containerRef}
      className="gis-map z-0 w-full"
      style={{ height: `min(${height}px, 70vh)` }}
      aria-label="Bản đồ GIS khu/cụm công nghiệp tỉnh Tây Ninh (OpenStreetMap)"
    />
  );
}
