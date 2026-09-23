"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L, { type FeatureGroup, type Map as LeafletMap } from "leaflet";
import { MapPin, Search, X } from "lucide-react";
import {
  BoundaryScopeControl,
  GisMapChrome,
  MapSearchTypeSelect,
  type GisFeatureDetail,
  type GisLayerControl,
  type GisLegendItem,
} from "@/components/gis/GisMapChrome";
import { GIS_ICON_ASSETS, GIS_ICON_FILTER, GIS_VISUALS, geoServerGlyph, geoServerIconAsset } from "@/config/gis-visuals";
import type { GeoServerLayerDefinition } from "@/config/geoserver-layers";
import { cn } from "@/lib/utils";
import { geometryHasPointInside, isInsideTayNinh, useTayNinhBoundary } from "@/lib/tay-ninh-boundary";

export type MissionMarker = {
  id: string;
  code: string;
  name: string;
  category: string;
  status: string;
  lat: number;
  lng: number;
  customer_code?: string | null;
  annual_consumption_kwh?: number | string | null;
  peak_demand_kw?: number | string | null;
  report_count?: number | string | null;
  meter_count?: number | string | null;
  importance_level?: string | null;
  reporting_required?: string | null;
  address?: string | null;
  outageStartAt?: string | null;
  outageEndAt?: string | null;
  outageReason?: string | null;
  outageCustomers?: number | null;
  outageMethod?: string | null;
};

export type MissionPolygon = {
  id: string;
  name: string;
  category: string;
  color: string;
  geometry: { type?: string; coordinates?: unknown };
  outageCode?: string;
  outageStartAt?: string;
  outageEndAt?: string;
  outageReason?: string;
  outageCustomers?: number;
  outageMethod?: string;
};

export type MissionMapAlert = {
  id: string;
  title: string;
  severity: "danger" | "warning" | "info";
  message: string;
  recommendation: string;
  metric: string;
  lat: number | null;
  lng: number | null;
};

type GeoServerConfig = {
  enabled: boolean;
  proxyWfsUrl: string;
  center: [number, number];
  zoom: number;
  layers: GeoServerLayerDefinition[];
};

type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: GeoJSON.Geometry | null;
    properties?: Record<string, unknown> | null;
  }>;
};

function popupLine(label: string, value: unknown) {
  const row = document.createElement("div");
  row.style.cssText =
    "display:flex;justify-content:space-between;gap:12px;padding:2px 0;font-size:11px";
  const key = document.createElement("span");
  key.style.color = "#64748b";
  key.textContent = label;
  const content = document.createElement("strong");
  content.style.cssText = "max-width:170px;text-align:right;color:#0f2a4a;overflow-wrap:anywhere";
  content.textContent = String(value ?? "—");
  row.append(key, content);
  return row;
}

function popupTimeLine(label: string, value: string, color: string, background: string) {
  const row = document.createElement("div");
  row.style.cssText = `margin:5px 0;border-radius:6px;padding:6px 8px;background:${background};color:${color};font-size:11px;font-weight:700`;
  row.textContent = `${label}: ${new Date(value).toLocaleString("vi-VN")}`;
  return row;
}

function detailButton(root: HTMLElement, onDetail: () => void) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Xem chi tiết";
  button.style.cssText =
    "margin-top:9px;width:100%;border:0;border-radius:7px;background:#1565c0;padding:7px 10px;color:#fff;font-size:12px;font-weight:700;cursor:pointer";
  button.addEventListener("click", onDetail);
  root.append(button);
}

function featurePopup(
  layer: GeoServerLayerDefinition,
  properties: Record<string, unknown>,
  onDetail: () => void,
) {
  const root = document.createElement("div");
  root.style.cssText = "min-width:245px;font-family:Inter,system-ui,sans-serif";
  const title = document.createElement("strong");
  title.style.cssText = `display:block;margin-bottom:7px;color:${layer.color}`;
  title.textContent = layer.label;
  root.append(title);
  const entries = Object.entries(properties)
    .filter(([, value]) => value == null || ["string", "number", "boolean"].includes(typeof value))
    .slice(0, 9);
  if (!entries.length) root.append(popupLine("Nguồn", "GeoServer"));
  entries.forEach(([key, value]) => root.append(popupLine(key, value)));
  const source = document.createElement("div");
  source.style.cssText =
    "margin-top:7px;border-top:1px solid #e2e8f0;padding-top:5px;font-size:10px;color:#64748b";
  source.textContent = `GeoServer · ${layer.name}`;
  root.append(source);
  detailButton(root, onDetail);
  return root;
}

function markerPopup(item: MissionMarker, onDetail: () => void) {
  const root = document.createElement("div");
  root.style.cssText = "min-width:230px;font-family:Inter,system-ui,sans-serif";
  const title = document.createElement("strong");
  title.style.cssText = "display:block;margin-bottom:7px;color:#0f2a4a";
  title.textContent = item.name;
  root.append(
    title,
    popupLine("Mã", item.code),
    popupLine("Phân loại", item.category),
    popupLine("Trạng thái", item.status),
  );
  if (item.customer_code) root.append(popupLine("Mã EVN", item.customer_code));
  if (item.annual_consumption_kwh != null)
    root.append(popupLine("Tiêu thụ 12 tháng", `${Number(item.annual_consumption_kwh).toLocaleString("vi-VN")} kWh`));
  if (item.meter_count != null) root.append(popupLine("Công tơ", item.meter_count));
  if (item.outageStartAt) root.append(popupTimeLine("Cúp điện", item.outageStartAt, "#991b1b", "#fee2e2"));
  if (item.outageEndAt) root.append(popupTimeLine("Có điện lại", item.outageEndAt, "#166534", "#dcfce7"));
  if (item.outageReason) root.append(popupLine("Lý do", item.outageReason));
  if (item.outageCustomers != null) root.append(popupLine("KH dự kiến ảnh hưởng", item.outageCustomers.toLocaleString("vi-VN")));
  if (item.outageMethod) root.append(popupLine("Phương pháp", item.outageMethod));
  detailButton(root, onDetail);
  return root;
}

function alertPopup(alert: MissionMapAlert, onDetail: () => void) {
  const root = document.createElement("div");
  root.style.cssText = "min-width:270px;font-family:Inter,system-ui,sans-serif";
  const title = document.createElement("strong");
  title.style.cssText = `display:block;margin-bottom:7px;color:${alert.severity === "danger" ? "#b91c1c" : "#b45309"}`;
  title.textContent = alert.title;
  const message = document.createElement("p");
  message.style.cssText = "margin:7px 0;font-size:11px;line-height:1.5;color:#475569";
  message.textContent = alert.message;
  const recommendation = document.createElement("p");
  recommendation.style.cssText =
    "margin:0;border-radius:6px;background:#eff6ff;padding:7px;font-size:11px;line-height:1.5;color:#0f2a4a";
  recommendation.textContent = `Đề xuất: ${alert.recommendation}`;
  root.append(title, popupLine("Chỉ tiêu", alert.metric), message, recommendation);
  detailButton(root, onDetail);
  return root;
}

function riskStatus(status: string) {
  const value = status.toUpperCase();
  return [
    "CRITICAL",
    "DANGER",
    "OVERLOAD",
    "OVERLOADED",
    "QUÁ TẢI",
    "SỰ CỐ",
    "REPORTING_REQUIRED",
  ].some((token) =>
    value.includes(token),
  );
}

function missionVisual(missionId?: number) {
  if (missionId === 2) return GIS_VISUALS.renewable;
  if (missionId === 3) return GIS_VISUALS.solar;
  if (missionId === 4) return GIS_VISUALS.consumer;
  if (missionId === 5) return GIS_VISUALS.warning;
  if (missionId === 6) return GIS_VISUALS.renewable;
  if (missionId === 7) return GIS_VISUALS.charging;
  if (missionId === 8) return GIS_VISUALS.oil;
  return GIS_VISUALS.mission;
}

function missionMarkerIcon(missionId?: number) {
  if (missionId === 2 || missionId === 6) return GIS_ICON_ASSETS.powerPlant;
  if (missionId === 3) return GIS_ICON_ASSETS.solar;
  if (missionId === 4) return GIS_ICON_ASSETS.customer;
  if (missionId === 7) return GIS_ICON_ASSETS.charger;
  if (missionId === 8) return undefined;
  return GIS_ICON_ASSETS.substation;
}

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi-VN")
    .trim();
}

export function MissionGisMap({
  markers,
  polygons = [],
  alerts = [],
  selectedId,
  onSelect,
  missionId,
  height = 560,
}: {
  markers: MissionMarker[];
  polygons?: MissionPolygon[];
  alerts?: MissionMapAlert[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  missionId?: number;
  height?: number;
}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRefs = useRef(new Map<string, L.Marker>());
  const searchRef = useRef<HTMLDivElement>(null);
  const missionLayerRef = useRef<FeatureGroup | null>(null);
  const geoServerLayerRef = useRef<FeatureGroup | null>(null);
  const hasFittedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<GisFeatureDetail | null>(null);
  const [config, setConfig] = useState<GeoServerConfig | null>(null);
  const [visibleGeoLayers, setVisibleGeoLayers] = useState<string[]>([]);
  const [visibleMissionLayers, setVisibleMissionLayers] = useState([
    "mission:alerts",
    "mission:markers",
    "mission:polygons",
  ]);
  const [geoState, setGeoState] = useState<"idle" | "loading" | "ready" | "error">("idle");
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

  const relevantLayers = useMemo(
    () =>
      (config?.layers ?? []).filter(
        (layer) => missionId == null || layer.missionIds.includes(missionId),
      ),
    [config, missionId],
  );

  useEffect(() => {
    if (missionId == null) return;
    let cancelled = false;
    void fetch("/api/gis/geoserver/config", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("GeoServer config unavailable");
        return response.json() as Promise<GeoServerConfig>;
      })
      .then((nextConfig) => {
        if (cancelled) return;
        setConfig(nextConfig);
        setVisibleGeoLayers(
          nextConfig.layers
            .filter((layer) => layer.missionIds.includes(missionId) && layer.defaultVisible)
            .map((layer) => layer.name),
        );
      })
      .catch(() => {
        if (!cancelled) setGeoState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [missionId]);

  useEffect(() => {
    if (!elementRef.current) return;
    const map = L.map(elementRef.current, { zoomControl: false }).setView([11.3066, 106.15], 9);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    missionLayerRef.current = L.featureGroup().addTo(map);
    geoServerLayerRef.current = L.featureGroup().addTo(map);
    mapRef.current = map;
    setReady(true);
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    observer.observe(elementRef.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      missionLayerRef.current = null;
      geoServerLayerRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || !missionLayerRef.current) return;
    const layer = missionLayerRef.current;
    layer.clearLayers();
    markerRefs.current.clear();
    const bounds = L.latLngBounds([]);

    const managementHref = `/energy/nhiem-vu-${missionId ?? 5}/quan-ly`;

    if (visibleMissionLayers.includes("mission:polygons"))
      polygons.forEach((item) => {
        const featureDetail: GisFeatureDetail = {
          id: item.id,
          title: item.name,
          subtitle: item.category,
          source: "Nghiệp vụ",
          category: "Vùng GIS",
          status: "Đang hiển thị",
          fields: [
            { label: "Mã vùng", value: item.id },
            { label: "Phân loại", value: item.category },
            { label: "Nguồn hình học", value: "PostGIS/nghiệp vụ" },
            ...(item.outageCode ? [{ label: "Mã lịch cắt điện", value: item.outageCode }] : []),
            ...(item.outageStartAt ? [{ label: "Cúp điện", value: new Date(item.outageStartAt).toLocaleString("vi-VN") }] : []),
            ...(item.outageEndAt ? [{ label: "Có điện lại", value: new Date(item.outageEndAt).toLocaleString("vi-VN") }] : []),
            ...(item.outageReason ? [{ label: "Lý do", value: item.outageReason }] : []),
            ...(item.outageCustomers != null ? [{ label: "KH dự kiến ảnh hưởng", value: item.outageCustomers.toLocaleString("vi-VN") }] : []),
            ...(item.outageMethod ? [{ label: "Phương pháp", value: item.outageMethod }] : []),
          ],
          managementHref,
        };
        const polygon = L.geoJSON(item.geometry as GeoJSON.GeoJsonObject, {
          style: {
            color:
              item.color?.toLowerCase() === "#f59e0b" || item.color?.toLowerCase() === "#e59a23"
                ? "#0f766e"
                : item.color || "#0f766e",
            fillColor:
              item.color?.toLowerCase() === "#f59e0b" || item.color?.toLowerCase() === "#e59a23"
                ? "#0f766e"
                : item.color || "#0f766e",
            weight: 2,
            fillOpacity: 0.14,
            dashArray: "6 4",
          },
        }).addTo(layer);
        polygon.bindPopup(
          markerPopup(
            {
              id: item.id,
              code: item.id,
              name: item.name,
              category: item.category,
              status: "Vùng GIS",
              lat: 0,
              lng: 0,
              outageStartAt: item.outageStartAt,
              outageEndAt: item.outageEndAt,
              outageReason: item.outageReason,
              outageCustomers: item.outageCustomers,
              outageMethod: item.outageMethod,
            },
            () => setDetail(featureDetail),
          ),
        );
        bounds.extend(polygon.getBounds());
      });

    if (visibleMissionLayers.includes("mission:markers"))
      markers.forEach((item) => {
        if (!isVisibleInBoundary(item.lat, item.lng)) return;
        const selected = item.id === selectedId;
        const outage = item.category === "CẮT ĐIỆN";
        const danger = riskStatus(item.status) || outage;
        const featureDetail: GisFeatureDetail = {
          id: item.id,
          title: item.name,
          subtitle: item.code,
          source: "Nghiệp vụ",
          category: item.category,
          status: item.status,
          severity: danger ? "danger" : "info",
          fields: [
            { label: "Mã", value: item.code },
            { label: "Phân loại", value: item.category },
            { label: "Trạng thái", value: item.status },
            { label: "Vĩ độ", value: item.lat.toFixed(6) },
            { label: "Kinh độ", value: item.lng.toFixed(6) },
              ...(item.customer_code ? [{ label: "Mã liên kết EVN", value: item.customer_code }] : []),
              ...(item.importance_level ? [{ label: "Mức độ trọng điểm", value: item.importance_level }] : []),
              ...(item.reporting_required ? [{ label: "Nghĩa vụ báo cáo", value: item.reporting_required === "YES" ? "Phải báo cáo" : "Không bắt buộc" }] : []),
              ...(item.annual_consumption_kwh != null ? [{ label: "Tiêu thụ 12 tháng", value: `${Number(item.annual_consumption_kwh).toLocaleString("vi-VN")} kWh` }] : []),
              ...(item.peak_demand_kw != null ? [{ label: "Nhu cầu đỉnh", value: `${Number(item.peak_demand_kw).toLocaleString("vi-VN")} kW` }] : []),
              ...(item.report_count != null ? [{ label: "Số báo cáo", value: item.report_count }] : []),
              ...(item.meter_count != null ? [{ label: "Số công tơ", value: item.meter_count }] : []),
              ...(item.address ? [{ label: "Địa chỉ", value: item.address }] : []),
              ...(item.outageStartAt ? [{ label: "Cúp điện", value: new Date(item.outageStartAt).toLocaleString("vi-VN") }] : []),
              ...(item.outageEndAt ? [{ label: "Có điện lại", value: new Date(item.outageEndAt).toLocaleString("vi-VN") }] : []),
              ...(item.outageReason ? [{ label: "Lý do", value: item.outageReason }] : []),
              ...(item.outageCustomers != null ? [{ label: "KH dự kiến ảnh hưởng", value: item.outageCustomers.toLocaleString("vi-VN") }] : []),
              ...(item.outageMethod ? [{ label: "Phương pháp", value: item.outageMethod }] : []),
          ],
          managementHref,
          canOpenDetail: Boolean(onSelect),
        };
        const visual = outage
          ? { color: "#dc2626", glyph: "CĐ" }
          : danger
          ? missionId === 4
            ? { color: "#dc2626", glyph: GIS_VISUALS.consumer.glyph }
            : GIS_VISUALS.incident
          : missionId === 4 && item.category.startsWith("KEY")
            ? { color: "#1d4ed8", glyph: GIS_VISUALS.consumer.glyph }
            : missionId === 4 && item.category.startsWith("NEAR_KEY")
              ? { color: "#7c3aed", glyph: GIS_VISUALS.consumer.glyph }
              : missionId === 4
                ? { color: "#0f766e", glyph: GIS_VISUALS.consumer.glyph }
                : missionVisual(missionId);
        const asset = outage
          ? GIS_ICON_ASSETS.distributionBox
          : danger && missionId !== 4
          ? null
          : missionId === 2 || missionId === 6
            ? GIS_ICON_ASSETS.powerPlant
            : missionId === 3
              ? GIS_ICON_ASSETS.solar
              : missionId === 4
                ? GIS_ICON_ASSETS.customer
                  : missionMarkerIcon(missionId);
        const marker = L.marker([item.lat, item.lng], {
          title: item.name,
          icon: L.divIcon({
            className: "gis-feature-pin",
            html: `<span class="gis-feature-marker${danger ? " gis-feature-marker--danger" : ""}${selected ? " gis-feature-marker--selected" : ""}" style="background:${visual.color}">${asset ? `<img src="${asset}" alt="" style="width:17px;height:17px;filter:${GIS_ICON_FILTER};" />` : visual.glyph}</span>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          }),
        }).addTo(layer);
        markerRefs.current.set(item.id, marker);
        marker.bindPopup(markerPopup(item, () => setDetail(featureDetail)));
        bounds.extend([item.lat, item.lng]);
      });

    if (visibleMissionLayers.includes("mission:alerts"))
      alerts.forEach((alert) => {
        if (alert.lat == null || alert.lng == null) return;
        if (!isVisibleInBoundary(alert.lat, alert.lng)) return;
        const danger = alert.severity === "danger";
        const featureDetail: GisFeatureDetail = {
          id: alert.id,
          title: alert.title,
          subtitle: alert.metric,
          source: "Cảnh báo",
          category: danger ? "Sự cố / cảnh báo khẩn" : "Điểm cần theo dõi",
          status: danger ? "Cần xử lý" : "Theo dõi",
          severity: alert.severity,
          fields: [
            { label: "Chỉ tiêu", value: alert.metric },
            { label: "Mức độ", value: alert.severity },
            { label: "Vĩ độ", value: alert.lat.toFixed(6) },
            { label: "Kinh độ", value: alert.lng.toFixed(6) },
          ],
          note: alert.message,
          recommendation: alert.recommendation,
          managementHref,
          managementLabel: missionId === 5 ? "Đến xử lý sự cố" : "Đến trang quản lý",
        };
        const marker = L.marker([alert.lat, alert.lng], {
          title: alert.title,
          zIndexOffset: danger ? 1_000 : 800,
          icon: L.divIcon({
            className: "mission-alert-pin",
            html: `<span class="mission-alert-marker ${danger ? "mission-alert-marker--danger" : "mission-alert-marker--warning"}"><img src="${GIS_ICON_ASSETS.distributionBox}" alt="" style="width:18px;height:18px;filter:${GIS_ICON_FILTER};" /></span>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          }),
        }).addTo(layer);
        marker.bindPopup(alertPopup(alert, () => setDetail(featureDetail)));
        bounds.extend([alert.lat, alert.lng]);
      });

    if (!hasFittedRef.current && bounds.isValid()) {
      mapRef.current.fitBounds(bounds.pad(0.14), { maxZoom: 14, padding: [28, 28] });
      hasFittedRef.current = true;
    }
  }, [alerts, markers, missionId, onSelect, polygons, ready, selectedId, visibleMissionLayers, isVisibleInBoundary]);

  const searchResults = useMemo(() => {
    const query = normalizeSearchValue(searchQuery);
    return markers
      .filter((item) => isVisibleInBoundary(item.lat, item.lng))
      .filter(() => searchType === "all" || searchType === "marker")
      .filter((item) =>
        !query || normalizeSearchValue(`${item.name} ${item.code} ${item.category}`).includes(query),
      )
      .slice(0, 6);
  }, [markers, searchQuery, searchType, isVisibleInBoundary]);

  const focusMarker = (item: MissionMarker) => {
    setSearchQuery(item.name);
    setSearchOpen(false);
    mapRef.current?.flyTo([item.lat, item.lng], Math.max(mapRef.current.getZoom(), 14), {
      duration: 0.8,
    });
    markerRefs.current.get(item.id)?.openPopup();
    onSelect?.(item.id);
  };

  useEffect(() => {
    if (!ready || !config?.enabled || !geoServerLayerRef.current) return;
    let cancelled = false;
    const target = geoServerLayerRef.current;
    target.clearLayers();
    const selectedLayers = relevantLayers.filter((layer) => visibleGeoLayers.includes(layer.name));
    if (!selectedLayers.length) {
      setGeoState("idle");
      return;
    }
    setGeoState("loading");

    void Promise.allSettled(
      selectedLayers.map(async (layer) => {
        const allowFeatureDetails = layer.allowFeatureDetails !== false;
        const params = new URLSearchParams({
          SERVICE: "WFS",
          VERSION: "2.0.0",
          REQUEST: "GetFeature",
          TYPENAMES: layer.name,
          OUTPUTFORMAT: "application/json",
          SRSNAME: "EPSG:4326",
          COUNT: "750",
        });
        const response = await fetch(`${config.proxyWfsUrl}?${params.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`${layer.name}: HTTP ${response.status}`);
        const data = (await response.json()) as GeoJsonFeatureCollection;
        if (cancelled) return;
        const isSubstationLayer = layer.name.toLowerCase().includes("tba");
        const vector = L.geoJSON(data as GeoJSON.GeoJsonObject, {
          filter: (feature) =>
            boundaryMode === "all" ||
            layer.geometry !== "point" ||
            geometryHasPointInside(feature.geometry, tayNinhBoundary),
          style: {
            color: layer.color,
            fillColor: layer.color,
            weight: layer.style?.weight ?? (layer.geometry === "line" ? 3 : 1.5),
            opacity: layer.style?.opacity ?? (layer.kind === "boundary" ? 0.7 : 0.9),
            fillOpacity:
              layer.style?.fillOpacity ?? (layer.kind === "boundary" ? 0.035 : 0.13),
            dashArray:
              layer.style?.dashArray ?? (layer.kind === "boundary" ? "7 5" : undefined),
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
            const properties = feature.properties ?? {};
            const scalarFields = Object.entries(properties)
              .filter(
                ([, value]) =>
                  value == null || ["string", "number", "boolean"].includes(typeof value),
              )
              .slice(0, 18)
              .map(([label, value]) => ({ label, value }));
            const featureId = String(
              properties.id ??
                properties.code ??
                properties.ma ??
                `${layer.name}:${scalarFields.length}`,
            );
            const featureDetail: GisFeatureDetail = {
              id: `geoserver:${layer.name}:${featureId}`,
              title: String(
                properties.name ?? properties.ten ?? properties.title ?? layer.shortLabel,
              ),
              subtitle: layer.label,
              source: "GeoServer",
              category: layer.kind,
              fields: scalarFields.length
                ? scalarFields
                : [{ label: "Lớp dữ liệu", value: layer.name }],
              managementHref: `/energy/nhiem-vu-${missionId ?? 5}/quan-ly`,
            };
            featureLayer.bindPopup(featurePopup(layer, properties, () => setDetail(featureDetail)));
          },
        });
        target.addLayer(vector);
      }),
    ).then((results) => {
      if (cancelled) return;
      setGeoState(results.some((result) => result.status === "rejected") ? "error" : "ready");
    });
    return () => {
      cancelled = true;
    };
  }, [config, missionId, ready, relevantLayers, visibleGeoLayers, boundaryMode, tayNinhBoundary]);

  useEffect(() => {
    if (!ready || !selectedId) return;
    const item = markers.find((marker) => marker.id === selectedId);
    if (item) mapRef.current?.flyTo([item.lat, item.lng], Math.max(mapRef.current.getZoom(), 13));
  }, [markers, ready, selectedId]);

  useEffect(() => {
    if (!ready) return;
    const frame = requestAnimationFrame(() => mapRef.current?.invalidateSize({ animate: false }));
    return () => cancelAnimationFrame(frame);
  }, [expanded, height, ready]);

  const layerControls = useMemo<GisLayerControl[]>(
    () => [
      {
        id: "mission:alerts",
        label: "Cảnh báo và sự cố",
        source: "Cảnh báo",
        color: GIS_VISUALS.incident.color,
        glyph: GIS_VISUALS.incident.glyph,
        icon: GIS_ICON_ASSETS.distributionBox,
        visible: visibleMissionLayers.includes("mission:alerts"),
        description: `${alerts.filter((item) => item.lat != null && item.lng != null).length} cảnh báo có tọa độ`,
      },
      {
        id: "mission:markers",
        label: "Điểm dữ liệu nghiệp vụ",
        source: "Nghiệp vụ",
        color: missionVisual(missionId).color,
        glyph: missionVisual(missionId).glyph,
        icon: missionMarkerIcon(missionId),
        visible: visibleMissionLayers.includes("mission:markers"),
        description: `${markers.length.toLocaleString("vi-VN")} điểm từ hệ thống GIS`,
      },
      {
        id: "mission:polygons",
        label: "Vùng dữ liệu nghiệp vụ",
        source: "Nghiệp vụ",
        color: GIS_VISUALS.corridor.color,
        glyph: GIS_VISUALS.corridor.glyph,
        visible: visibleMissionLayers.includes("mission:polygons"),
        description: `${polygons.length.toLocaleString("vi-VN")} polygon/vùng phân tích`,
      },
      ...relevantLayers.map((layer) => ({
        id: layer.name,
        label: layer.label,
        source: "GeoServer" as const,
        color: layer.color,
        glyph: geoServerGlyph(layer.kind, layer.name),
        icon: layer.geometry === "point" ? geoServerIconAsset(layer.kind, layer.name) : undefined,
        visible: visibleGeoLayers.includes(layer.name),
        description: `${layer.geometry} · ${layer.kind} · WFS · ${
          layer.allowFeatureDetails !== false ? "Có chi tiết" : "Chỉ xem"
        }`,
      })),
    ],
    [alerts, markers, missionId, polygons, relevantLayers, visibleGeoLayers, visibleMissionLayers],
  );

  const legendItems = useMemo<GisLegendItem[]>(
    () =>
      layerControls
        .filter((layer) => layer.visible)
        .map((layer) => ({
          id: layer.id,
          label: layer.label,
          color: layer.color,
          glyph: layer.glyph,
          icon: layer.icon,
          animated: layer.id === "mission:alerts",
          line: layer.glyph === "—",
        })),
    [layerControls],
  );

  const toggleLayer = (id: string) => {
    if (id.startsWith("mission:")) {
      setVisibleMissionLayers((current) =>
        current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
      );
      return;
    }
    setVisibleGeoLayers((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const setAllLayers = (visible: boolean) => {
    setVisibleMissionLayers(
      visible ? ["mission:alerts", "mission:markers", "mission:polygons"] : [],
    );
    setVisibleGeoLayers(visible ? relevantLayers.map((layer) => layer.name) : []);
  };

  return (
    <div
      className={cn(
        "relative z-0 isolate overflow-hidden rounded-lg border border-border bg-slate-100",
        expanded && "fixed inset-2 z-40 rounded-xl shadow-2xl",
      )}
      style={{ height: expanded ? "calc(100dvh - 1rem)" : `${height}px` }}
    >
      <div ref={elementRef} className="h-full w-full" aria-label="Bản đồ GIS điều hành nhiệm vụ" />
      <div ref={searchRef} className="absolute left-3 top-3 z-[500] w-[min(560px,calc(100%-1.5rem))] sm:w-[min(50%,560px)]">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-2 py-2 shadow-lg backdrop-blur-sm">
          <MapSearchTypeSelect
            value={searchType}
            onChange={setSearchType}
            options={[
              { value: "all", label: "Tất cả" },
              { value: "marker", label: "Điểm nghiệp vụ" },
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
                focusMarker(searchResults[0]);
              }
              if (event.key === "Escape") setSearchOpen(false);
            }}
            placeholder="Tìm địa điểm trên bản đồ..."
            aria-label="Tìm địa điểm trên bản đồ"
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
          {searchQuery && (
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
          )}
        </div>
        {searchOpen && searchResults.length > 0 && (
          <div className="mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            {searchResults.map((item) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => focusMarker(item)}
                className="flex w-full items-start gap-2 border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-blue-50"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800">{item.name}</span>
                  <span className="block truncate text-xs text-slate-500">{item.code} · {item.category}</span>
                </span>
              </button>
            ))}
          </div>
        )}
        {searchOpen && searchQuery && searchResults.length === 0 && (
          <div className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-lg">
            Không tìm thấy địa điểm phù hợp.
          </div>
        )}
      </div>
      <GisMapChrome
        layers={layerControls}
        legendItems={legendItems}
        expanded={expanded}
        detail={detail}
        onToggleLayer={toggleLayer}
        onSetAllLayers={setAllLayers}
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
        onToggleExpanded={() => setExpanded((value) => !value)}
        onCloseDetail={() => setDetail(null)}
        boundaryMode={boundaryMode}
        onBoundaryModeChange={setBoundaryMode}
        boundaryScopeName={`energy-map-boundary-mode-mission-${missionId ?? "default"}`}
        onOpenDetail={(selected) => {
          setDetail(null);
          if (markers.some((item) => item.id === selected.id)) onSelect?.(selected.id);
        }}
        statusText={
          geoState === "loading"
            ? "Đang nạp dữ liệu WFS từ GeoServer…"
            : geoState === "error"
              ? "Một số lớp GeoServer chưa nạp được."
              : "Lớp nền “Chỉ xem” không nhận tương tác; nhấp lớp “Có chi tiết” để xem thông tin."
        }
      />
    </div>
  );
}
