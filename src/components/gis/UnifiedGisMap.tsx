import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CircleMarker as LeafletCircle,
  LayerGroup,
  Map as LeafletMap,
  Marker as LeafletMarker,
  Polygon as LeafletPolygon,
} from "leaflet";
import type { Cluster, Factory, WardZone } from "@/lib/types";
import type { Task1GridData } from "@/lib/grid-types";
import { clusterGeometry, wardZoneLatLngs } from "@/lib/gis-geometry";
import { clusterIconAsset } from "@/config/gis-visuals";
import { useGisLayer } from "@/lib/gis-layer-context";
import type { GisLayerId } from "@/lib/gis-catalog";
import {
  ENHANCE_RADIUS,
  LABEL_MIN_DIM,
  MIN_ONSCREEN_DIM,
  TAY_NINH_CENTER,
  TAY_NINH_ZOOM,
  WARD_FIT_MAX_ZOOM,
  ZONE_FIT_MAX_ZOOM,
  ZONE_NEAR_ZOOM,
  buildFactoryPopup,
  buildWardTooltip,
  buildZoneTooltip,
  dimZoneStyle,
  enhanceStyle,
  makeFactoryIcon,
  wardStyle,
  zoneStyle,
  type WardState,
  type ZoomMode,
} from "@/components/gis/IndustrialLayerMap";
import {
  LINE_COLOR,
  buildLinePopup,
  buildSubstationPopup,
  entityKey,
  rowHtml,
  substationColor,
  wirePopupButton,
  type GridEntity,
} from "@/components/grid/GridMap";
import { buildCorridorPolygon, corridorWidthM } from "@/lib/grid-geo";


// Bản đồ GIS tổng hợp: 1 bản đồ duy nhất chồng nhiều lớp (KCN/CCN + Nguồn năng
// lượng NV1). Trạng thái lớp đọc từ registry (gis-layer-context); mỗi nhóm layer
// render theo pane cố định: Xã/Phường < Polygon KCN < hit-area < Lưới & Trạm < DN.
export function UnifiedGisMap({
  wards,
  selectedWardId,
  highlightWardIds,
  wardFilterActive,
  wardClusterIds,
  onSelectWard,
  zones,
  selectedZoneId,
  onSelectZone,
  companies,
  selectedCompanyId,
  zoneName,
  zoneNameById,
  onSelectCompany,
  onOpenProfile,
  grid,
  selectedGridKey,
  onSelectGridEntity,
  height = 600,
}: {
  wards: WardZone[];
  selectedWardId?: string | null;
  highlightWardIds?: string[];
  wardFilterActive?: boolean;
  wardClusterIds?: string[];
  onSelectWard?: (w: WardZone) => void;
  zones: Cluster[];
  selectedZoneId?: string | null;
  onSelectZone?: (c: Cluster) => void;
  companies: Factory[];
  selectedCompanyId?: string | null;
  zoneName?: string | null;
  zoneNameById?: Record<string, string>;
  onSelectCompany?: (f: Factory) => void;
  onOpenProfile?: (f: Factory) => void;
  grid: Task1GridData | null;
  selectedGridKey?: string | null;
  onSelectGridEntity?: (entity: GridEntity) => void;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const wardLayerRef = useRef<LayerGroup | null>(null);
  const zoneLayerRef = useRef<LayerGroup | null>(null);
  const enhanceLayerRef = useRef<LayerGroup | null>(null);
  const energyLineLayerRef = useRef<LayerGroup | null>(null);
  const energyMarkerLayerRef = useRef<LayerGroup | null>(null);
  const companyLayerRef = useRef<LayerGroup | null>(null);
  const markerByIdRef = useRef<Map<string, LeafletMarker>>(new Map());
  const gridMarkerByKeyRef = useRef<Map<string, LeafletMarker>>(new Map());
  const lastZoneIdRef = useRef<string | null>(null);
  const lastWardIdRef = useRef<string | null>(null);
  const lastGridKeyRef = useRef<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [zoom, setZoom] = useState(TAY_NINH_ZOOM);

  const { visibleGisLayers } = useGisLayer();
  const visible = useCallback(
    (id: GisLayerId) => visibleGisLayers.includes(id),
    [visibleGisLayers],
  );

  // Khởi tạo bản đồ một lần — pane tạo trước, thứ tự z-index cố định.
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
      L.control.zoom({ position: "topright" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Base Map < Xã/Phường < Polygon KCN < hit-area < Lưới & Trạm < Marker DN < Popup
      map.createPane("wardPane").style.zIndex = "440";
      map.createPane("zonePane").style.zIndex = "450";
      map.createPane("zoneEnhancePane").style.zIndex = "460";
      map.createPane("energyPane").style.zIndex = "480";
      map.createPane("energyMarkerPane").style.zIndex = "500";
      map.createPane("companyPane").style.zIndex = "620";

      wardLayerRef.current = L.layerGroup().addTo(map);
      zoneLayerRef.current = L.layerGroup().addTo(map);
      enhanceLayerRef.current = L.layerGroup().addTo(map);
      energyLineLayerRef.current = L.layerGroup().addTo(map);
      energyMarkerLayerRef.current = L.layerGroup().addTo(map);
      companyLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setMapReady(true);
      setZoom(map.getZoom());
      map.on("zoomend", () => setZoom(map.getZoom()));

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
      wardLayerRef.current = null;
      zoneLayerRef.current = null;
      enhanceLayerRef.current = null;
      energyLineLayerRef.current = null;
      energyMarkerLayerRef.current = null;
      companyLayerRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Lớp Polygon xã/phường — tắt/bật theo registry.
  useEffect(() => {
    if (!mapReady) return;
    const layer = wardLayerRef.current;
    if (!layer) return;
    if (!visible("ward")) {
      layer.clearLayers();
      return;
    }
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      layer.clearLayers();
      const map = mapRef.current;
      if (!map) return;
      const currentZoom = map.getZoom();
      const mode: ZoomMode = currentZoom < ZONE_NEAR_ZOOM ? "far" : "near";

      wards.forEach((w) => {
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
  }, [
    mapReady,
    visible,
    wards,
    selectedWardId,
    highlightWardIds,
    wardFilterActive,
    zoom,
    onSelectWard,
  ]);

  // Lớp Polygon KCN/CCN + hit-area — tắt/bật theo registry.
  useEffect(() => {
    if (!mapReady) return;
    const layer = zoneLayerRef.current;
    const enhanceLayer = enhanceLayerRef.current;
    if (!layer || !enhanceLayer) return;
    if (!visible("kcn")) {
      layer.clearLayers();
      enhanceLayer.clearLayers();
      return;
    }
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

        const bounds = L.latLngBounds(latlngs);
        const ne = map.project(bounds.getNorthEast(), currentZoom);
        const sw = map.project(bounds.getSouthWest(), currentZoom);
        const pixelSize = Math.max(Math.abs(ne.x - sw.x), Math.abs(ne.y - sw.y));
        const center = bounds.getCenter();

        const polygon = L.polygon(latlngs, zoneStyle(c, selected, false, mode))
          .addTo(layer)
          .bindTooltip(buildZoneTooltip(c), { direction: "top", className: "gis-zone-tooltip" });

        if (selected) selectedPolys.push(polygon);

        let enhance: LeafletCircle | null = null;
        if (mode === "far" && pixelSize < MIN_ONSCREEN_DIM) {
          enhance = L.circleMarker([center.lat, center.lng], enhanceStyle(c, selected, false))
            .addTo(enhanceLayer)
            .bindTooltip(buildZoneTooltip(c), { direction: "top", className: "gis-zone-tooltip" });
          if (selected) selectedEnhance.push(enhance);
          enhance.on("click", () => onSelectZone?.(c));
        }

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

      selectedPolys.forEach((p) => p.bringToFront());
      selectedEnhance.forEach((e) => e.bringToFront());
    })();
    return () => {
      cancelled = true;
    };
  }, [
    mapReady,
    visible,
    zones,
    selectedZoneId,
    selectedWardId,
    wardClusterIds,
    onSelectZone,
    zoom,
  ]);

  // Lớp năng lượng (NV1): trạm, tuyến, trụ, quy hoạch, hành lang, sự cố, NLTT.
  useEffect(() => {
    if (!mapReady || !grid) return;
    const lineLayer = energyLineLayerRef.current;
    const markerLayer = energyMarkerLayerRef.current;
    if (!lineLayer || !markerLayer) return;
    const anyVisible = [
      "substation",
      "lines",
      "poles",
      "planning",
      "corridors",
      "connectionPoints",
      "incidents",
      "overloadZones",
      "renewables",
    ].some((id) => visible(id as GisLayerId));
    if (!anyVisible) {
      lineLayer.clearLayers();
      markerLayer.clearLayers();
      gridMarkerByKeyRef.current.clear();
      return;
    }
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      lineLayer.clearLayers();
      markerLayer.clearLayers();
      gridMarkerByKeyRef.current.clear();
      const map = mapRef.current;
      if (!map) return;

      // Hành lang an toàn — bề rộng theo cấp điện áp (Nghị định 14/2014/NĐ-CP).
      if (visible("corridors")) {
        grid.lines.forEach((line) => {
          if (!line.route?.length) return;
          const widthM =
            line.status === "Quy hoạch"
              ? (line.planning?.corridorWidthM ?? corridorWidthM(line.voltageLevel))
              : corridorWidthM(line.voltageLevel);
          const poly = buildCorridorPolygon(line.route, widthM);
          if (!poly.length) return;
          L.polygon(poly, {
            pane: "energyPane",
            color: "#F59E0B",
            weight: 1,
            fillColor: "#F59E0B",
            fillOpacity: 0.07,
            dashArray: "4 4",
          })
            .addTo(lineLayer)
            .bindPopup(
              `<div style="min-width:230px;font-family:Inter,system-ui,sans-serif"><div style="font-weight:700;color:#0f2a4a;margin-bottom:6px">Hành lang an toàn — ${line.name}</div>${rowHtml("Cấp điện áp", line.voltageLevel)}${rowHtml("Bề rộng mỗi phía", `${widthM} m`)}${rowHtml("Căn cứ", "NĐ 14/2014/NĐ-CP, Điều 11")}${rowHtml("Tình trạng", line.corridorStatus ?? "Chưa đánh giá")}</div>`,
            );
        });
      }

      // Khu vực quá tải.
      if (visible("overloadZones")) {
        grid.overloadZones.forEach((zone) => {
          zone.polygons.forEach((ring) => {
            L.polygon(ring, {
              pane: "energyPane",
              color: "#C62828",
              weight: 2,
              fillColor: "#C62828",
              fillOpacity: 0.12,
              dashArray: "6 4",
            })
              .addTo(lineLayer)
              .bindPopup(
                `<div style="min-width:240px;font-family:Inter,system-ui,sans-serif"><div style="font-weight:700;color:#C62828;margin-bottom:6px">${zone.label}</div>${rowHtml("Địa bàn", zone.district)}${rowHtml("Hệ số tải", `${zone.loadFactorPct}%`)}${rowHtml("Ghi chú", zone.note)}</div>`,
              );
          });
        });
      }

      if (visible("lines")) {
        grid.lines.forEach((line) => {
          if (!line.route?.length) return;
          const planned = line.status === "Quy hoạch";
          const switchingOff =
            line.switchingState === "MAINTENANCE" || line.switchingState === "STOPPED";
          const color = planned
            ? "#94A3B8"
            : switchingOff
              ? "#64748B"
              : (LINE_COLOR[line.voltageLevel] ?? "#00897B");
          const polyline = L.polyline(line.route, {
            pane: "energyPane",
            color,
            weight: 3,
            opacity: 0.82,
            ...(planned || switchingOff ? { dashArray: switchingOff ? "4 3" : "8 8" } : {}),
          })
            .addTo(lineLayer)
            .bindPopup(
              buildLinePopup(line, () => onSelectGridEntity?.({ kind: "line", item: line })),
            );
          wirePopupButton(polyline, () => onSelectGridEntity?.({ kind: "line", item: line }));
          polyline.on("click", () => onSelectGridEntity?.({ kind: "line", item: line }));
        });
      }

      if (visible("planning")) {
        grid.planned
          .filter((a) => a.type === "line" && a.route?.length)
          .forEach((a) => {
            const color = LINE_COLOR[a.voltageLevel] ?? "#00897B";
            const polyline = L.polyline(a.route as [number, number][], {
              pane: "energyPane",
              color,
              weight: 2.5,
              opacity: 0.6,
              dashArray: "6 6",
            })
              .addTo(lineLayer)
              .bindPopup(
                `<div style="min-width:240px;font-family:Inter,system-ui,sans-serif"><div style="font-weight:700;color:#0f2a4a;margin-bottom:6px">${a.name}</div>${rowHtml("Mã", a.code)}${rowHtml("Cấp điện áp", a.voltageLevel)}${rowHtml("Tiến độ", a.progress)}${rowHtml("Nhà đầu tư", a.investor)}<button class="grid-open-profile" style="margin-top:10px;width:100%;padding:7px 10px;border:0;border-radius:7px;background:#1565C0;color:#fff;font-size:12px;font-weight:700;cursor:pointer">Xem hồ sơ</button></div>`,
              );
            polyline.on("click", () => onSelectGridEntity?.({ kind: "plan", item: a }));
            wirePopupButton(polyline, () => onSelectGridEntity?.({ kind: "plan", item: a }));
          });

        // Trụ điện quy hoạch (theo tuyến quy hoạch).
        grid.plannedPoles.forEach((pole) => {
          if (!pole.latitude || !pole.longitude) return;
          L.circleMarker([pole.latitude, pole.longitude], {
            pane: "energyPane",
            radius: 3,
            color: "#94A3B8",
            fillColor: "#ffffff",
            fillOpacity: 1,
            weight: 1.2,
            dashArray: "2 2",
          })
            .addTo(lineLayer)
            .bindPopup(
              `<div style="min-width:210px;font-family:Inter,system-ui,sans-serif"><div style="font-weight:700;color:#0f2a4a;margin-bottom:6px">${pole.code}</div>${rowHtml("Số trụ", pole.number)}${rowHtml("Tuyến", pole.lineCode)}${rowHtml("Kết cấu dự kiến", pole.planning?.structureType ?? pole.type)}${rowHtml("Khoảng cột", `${pole.planning?.spacingKm ?? "—"} km`)}${rowHtml("Giải phóng mặt bằng", pole.planning?.clearanceStatus)}</div>`,
            );
        });
      }

      // Điểm sự cố (bản đồ số).
      if (visible("incidents")) {
        grid.incidents.forEach((inc) => {
          if (!inc.latitude || !inc.longitude) return;
          const icon = L.divIcon({
            className: "grid-incident-pin",
            html: `<div style="width:16px;height:16px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#C62828;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 14],
          });
          L.marker([inc.latitude, inc.longitude], {
            icon,
            title: inc.code,
            pane: "energyMarkerPane",
          })
            .addTo(markerLayer)
            .bindPopup(
              `<div style="min-width:240px;font-family:Inter,system-ui,sans-serif"><div style="font-weight:700;color:#C62828;margin-bottom:6px">${inc.code} — ${inc.type}</div>${rowHtml("Thời gian", inc.time)}${rowHtml("Tuyến", inc.lineCode)}${rowHtml("Vị trí", inc.location)}${rowHtml("Mất điện", `${inc.customersAffected ?? 0} khách hàng · ${inc.lostLoadMw ?? 0} MW`)}${rowHtml("Xử lý", inc.handler)}${rowHtml("Tiến độ", inc.progress)}</div>`,
            );
        });
      }

      // Điểm đấu nối trạm.
      if (visible("connectionPoints")) {
        grid.substations.forEach((s) => {
          s.connectionPoints?.forEach((p) => {
            if (!p.latitude || !p.longitude) return;
            L.circleMarker([p.latitude, p.longitude], {
              pane: "energyMarkerPane",
              radius: 4,
              color: "#0F766E",
              fillColor: "#0F766E",
              fillOpacity: 1,
              weight: 1.2,
            })
              .addTo(markerLayer)
              .bindPopup(
                `<div style="min-width:220px;font-family:Inter,system-ui,sans-serif"><div style="font-weight:700;color:#0F766E;margin-bottom:6px">${p.name}</div>${rowHtml("Loại", p.type)}${rowHtml("Cấp điện áp", p.voltageLevel)}${rowHtml("Trạm chủ", s.name)}${rowHtml("Trạng thái", p.status)}</div>`,
              );
          });
        });
      }

      // Nguồn NLTT đấu nối lưới.
      if (visible("renewables")) {
        grid.renewables.forEach((r) => {
          if (!r.latitude || !r.longitude) return;
          const color =
            r.overload === "Vượt giới hạn"
              ? "#C62828"
              : r.overload === "Cảnh báo"
                ? "#F59E0B"
                : "#2E7D32";
          const icon = L.divIcon({
            className: "grid-renewable-pin",
            html: `<div style="width:14px;height:14px;border-radius:2px;background:${color};border:2px solid #fff;transform:rotate(45deg);box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });
          L.marker([r.latitude, r.longitude], {
            icon,
            title: r.owner,
            pane: "energyMarkerPane",
          })
            .addTo(markerLayer)
            .bindPopup(
              `<div style="min-width:240px;font-family:Inter,system-ui,sans-serif"><div style="font-weight:700;color:#2E7D32;margin-bottom:6px">${r.owner}</div>${rowHtml("Mã nguồn", r.code)}${rowHtml("Loại", r.type)}${rowHtml("Công suất lắp đặt", `${r.installedKw} / ${r.capacityKw} kW`)}${rowHtml("Trạm đấu nối", r.hostSubstationId)}${rowHtml("Điểm đấu nối", r.connectionPoint)}${rowHtml("Quá tải", r.overload)}${rowHtml("Trạng thái", r.status)}</div>`,
            );
        });
      }

      if (visible("poles")) {
        grid.poles.forEach((pole) => {
          if (!pole.latitude || !pole.longitude) return;
          L.circleMarker([pole.latitude, pole.longitude], {
            pane: "energyPane",
            radius: 3.5,
            color: "#0f2a4a",
            fillColor: "#ffffff",
            fillOpacity: 1,
            weight: 1.2,
          })
            .addTo(lineLayer)
            .bindPopup(
              `<div style="min-width:200px;font-family:Inter,system-ui,sans-serif"><div style="font-weight:700;color:#0f2a4a;margin-bottom:6px">${pole.code}</div>${rowHtml("Số trụ", pole.number)}${rowHtml("Tuyến", pole.lineCode)}${rowHtml("Loại trụ", pole.type)}${rowHtml("Hành lang", pole.safetyCorridor)}</div>`,
            );
        });
      }

      if (visible("substation")) {
        grid.substations.forEach((s) => {
          const lat = s.latitude;
          const lng = s.longitude;
          if (!lat || !lng) return;
          const key = entityKey({ kind: "substation", item: s });
          const selected = key === selectedGridKey;
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
          const html = `<div style="width:${planned ? 26 : 30}px;height:${planned ? 26 : 30}px;border-radius:999px;background:${color};border:2px solid #fff;color:#fff;display:grid;place-items:center;font-size:9px;font-weight:800;${ring}${planned ? ";border-style:dashed" : ""}">${glyph}</div>`;
          const marker = L.marker([lat, lng], {
            icon: L.divIcon({
              className: "grid-map-pin",
              html,
              iconSize: [planned ? 26 : 30, planned ? 26 : 30],
              iconAnchor: [13, 13],
            }),
            title: s.name,
            pane: "energyMarkerPane",
          })
            .addTo(markerLayer)
            .bindPopup(
              buildSubstationPopup(s, () => onSelectGridEntity?.({ kind: "substation", item: s })),
            );
          wirePopupButton(marker, () => onSelectGridEntity?.({ kind: "substation", item: s }));
          marker.on("click", () => onSelectGridEntity?.({ kind: "substation", item: s }));
          gridMarkerByKeyRef.current.set(key, marker);
        });
      }

      if (visible("planning")) {
        grid.planned
          .filter((a) => a.type === "substation" && a.latitude && a.longitude)
          .forEach((a) => {
            const key = entityKey({ kind: "plan", item: a });
            const selected = key === selectedGridKey;
            const ring = selected ? "box-shadow:0 0 0 4px rgba(21,101,192,.25);" : "";
            const html = `<div style="width:26px;height:26px;border-radius:999px;background:#94A3B8;border:2px dashed #fff;color:#fff;display:grid;place-items:center;font-size:9px;font-weight:800;${ring}">QH</div>`;
            const marker = L.marker([a.latitude!, a.longitude!], {
              icon: L.divIcon({
                className: "grid-map-pin",
                html,
                iconSize: [26, 26],
                iconAnchor: [13, 13],
              }),
              title: a.name,
              pane: "energyMarkerPane",
            })
              .addTo(markerLayer)
              .bindPopup(
                `<div style="min-width:240px;font-family:Inter,system-ui,sans-serif"><div style="font-weight:700;color:#0f2a4a;margin-bottom:6px">${a.name}</div>${rowHtml("Mã", a.code)}${rowHtml("Cấp điện áp", a.voltageLevel)}${rowHtml("Tiến độ", a.progress)}${rowHtml("Năm hoàn thành", a.year)}<button class="grid-open-profile" style="margin-top:10px;width:100%;padding:7px 10px;border:0;border-radius:7px;background:#1565C0;color:#fff;font-size:12px;font-weight:700;cursor:pointer">Xem hồ sơ</button></div>`,
              );
            marker.on("click", () => onSelectGridEntity?.({ kind: "plan", item: a }));
            wirePopupButton(marker, () => onSelectGridEntity?.({ kind: "plan", item: a }));
            gridMarkerByKeyRef.current.set(key, marker);
          });
      }

      if (selectedGridKey) gridMarkerByKeyRef.current.get(selectedGridKey)?.openPopup();
    })();
    return () => {
      cancelled = true;
    };
  }, [mapReady, visible, grid, selectedGridKey, onSelectGridEntity]);

  // Marker doanh nghiệp — hiển thị khi đã khoan xuống xã/phường hoặc KCN.
  useEffect(() => {
    if (!mapReady) return;
    const layer = companyLayerRef.current;
    if (!layer) return;
    if (!visible("factory")) {
      layer.clearLayers();
      markerByIdRef.current.clear();
      return;
    }
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
    visible,
    companies,
    selectedZoneId,
    selectedWardId,
    selectedCompanyId,
    zoneName,
    zoneNameById,
    onSelectCompany,
    onOpenProfile,
  ]);

  // Fit bounds khi chọn xã/phường.
  useEffect(() => {
    if (!mapReady || !selectedWardId || selectedZoneId) return;
    const map = mapRef.current;
    if (!map) return;
    const ward = wards.find((w) => w.id === selectedWardId);
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

  // Fit bounds khi chọn KCN.
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

  // Quay về toàn tỉnh khi hủy chọn KCN/xã/đối tượng năng lượng.
  useEffect(() => {
    if (!mapReady) return;
    const prevZone = lastZoneIdRef.current;
    const prevWard = lastWardIdRef.current;
    const prevGrid = lastGridKeyRef.current;
    if (selectedZoneId === prevZone && selectedWardId === prevWard && selectedGridKey === prevGrid)
      return;
    lastZoneIdRef.current = selectedZoneId ?? null;
    lastWardIdRef.current = selectedWardId ?? null;
    lastGridKeyRef.current = selectedGridKey ?? null;
    if (selectedZoneId || selectedWardId || selectedGridKey) return;
    if (prevZone != null || prevWard != null || prevGrid != null) {
      mapRef.current?.flyTo(TAY_NINH_CENTER, TAY_NINH_ZOOM, { duration: 0.6 });
    }
  }, [mapReady, selectedZoneId, selectedWardId, selectedGridKey]);

  // Bay đến đối tượng năng lượng được chọn từ bảng dữ liệu bên dưới.
  useEffect(() => {
    if (!mapReady || !selectedGridKey) return;
    const map = mapRef.current;
    if (!map) return;
    const marker = gridMarkerByKeyRef.current.get(selectedGridKey);
    if (marker) {
      map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 11), { duration: 0.5 });
      marker.openPopup();
      return;
    }
    let cancelled = false;
    if (selectedGridKey.startsWith("line:") && grid) {
      const id = selectedGridKey.slice("line:".length);
      const line = grid.lines.find((l) => l.id === id);
      if (line?.route?.length) {
        void import("leaflet").then((L) => {
          if (cancelled) return;
          map.flyToBounds(L.latLngBounds(line.route!), { padding: [48, 48], maxZoom: 12 });
        });
      }
    }
    return () => {
      cancelled = true;
    };
  }, [mapReady, selectedGridKey, grid]);

  return (
    <div
      ref={containerRef}
      className="gis-map z-0 w-full"
      style={{ height: `min(${height}px, 70vh)` }}
      aria-label="Bản đồ GIS tổng hợp tỉnh Tây Ninh: KCN/CCN và lưới điện (OpenStreetMap)"
    />
  );
}
