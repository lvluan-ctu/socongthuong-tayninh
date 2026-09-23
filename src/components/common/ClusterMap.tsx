import { useEffect, useRef, useState } from "react";
import type { Cluster } from "@/lib/types";
import { CLUSTER_ICON_ASSETS } from "@/config/gis-visuals";


// Phạm vi tỉnh Tây Ninh mới (sau hợp nhất Tây Ninh + Long An, 1/7/2025)
const TAY_NINH_CENTER: [number, number] = [10.95, 106.25];

function pinColor(c: Cluster): string {
  if (c.occupancy >= 75) return "#2E7D32";
  if (c.occupancy >= 50) return "#1565C0";
  return "#E59A23";
}

function makeIcon(L: typeof import("leaflet"), c: Cluster) {
  const color = pinColor(c);
  const size = 36;
  return L.divIcon({
    className: "cluster-pin",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;border:3px solid ${color};background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.25);display:grid;place-items:center;overflow:hidden"><img src="${CLUSTER_ICON_ASSETS.default}" alt="" style="width:${size - 8}px;height:${size - 8}px;object-fit:contain"/></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -(size / 2 + 2)],
  });
}

function popupHtml(c: Cluster): string {
  const row = (k: string, v: string | number) =>
    `<div style="display:flex;justify-content:space-between;gap:12px"><span style="color:#64748b">${k}</span><span style="font-weight:500">${v}</span></div>`;
  return `<div style="min-width:230px">
    <div style="font-weight:600;font-size:13px;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.01em">${c.name}</div>
    ${row("Địa bàn", c.ward)}
    ${row("Diện tích", `${c.area} ha`)}
    ${row("Đã cho thuê", `${c.leased} ha`)}
    ${row("Tỷ lệ lấp đầy", `${c.occupancy}%`)}
    ${row("Doanh nghiệp", c.enterprises)}
    ${row("Ngành thu hút", c.sectors)}
  </div>`;
}

export function ClusterMap({
  clusters,
  selectedId,
  onSelect,
  height = 480,
}: {
  clusters: Cluster[];
  selectedId?: string | null | undefined;
  onSelect?: ((c: Cluster) => void) | undefined;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ReturnType<(typeof import("leaflet"))["map"]> | null>(null);
  const layerGroupRef = useRef<ReturnType<(typeof import("leaflet"))["layerGroup"]> | null>(null);
  const [mapReady, setMapReady] = useState(false);

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
        zoom: 9,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      layerGroupRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setMapReady(true);

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
      layerGroupRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    const layer = layerGroupRef.current;
    if (!layer) return;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      layer.clearLayers();
      clusters.forEach((c) => {
        const marker = L.marker([c.lat, c.lng], { icon: makeIcon(L, c), title: c.name })
          .addTo(layer)
          .bindPopup(popupHtml(c));
        marker.on("click", () => onSelect?.(c));
        if (selectedId && c.id === selectedId) marker.openPopup();
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [mapReady, clusters, selectedId, onSelect]);

  return (
    <div
      ref={containerRef}
      className="cluster-map z-0 w-full"
      style={{ height: `min(${height}px, 70vh)` }}
      aria-label="Bản đồ cụm công nghiệp tỉnh Tây Ninh (OpenStreetMap)"
    />
  );
}
