import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker, LayerGroup } from "leaflet";
import {
  Eye,
  EyeOff,
  Filter,
  Maximize2,
  Minimize2,
  Layers3,
} from "lucide-react";
import type { Business } from "@/lib/market-types";
import { FIELD_LABELS, type BusinessField } from "@/lib/market-types";
import { useTayNinhBoundary } from "@/lib/tay-ninh-boundary";
import { cn } from "@/lib/utils";

const ALL_FIELDS: BusinessField[] = [
  "xang_dau",
  "gas",
  "phan_bon",
  "hoa_chat",
  "thuc_pham",
  "thuong_mai",
  "xay_dung",
  "dich_vu",
  "khac",
];

const FIELD_COLORS: Record<BusinessField, string> = {
  xang_dau: "#E53935",
  gas: "#FB8C00",
  phan_bon: "#43A047",
  hoa_chat: "#8E24AA",
  thuc_pham: "#00ACC1",
  thuong_mai: "#1E88E5",
  xay_dung: "#FDD835",
  dich_vu: "#5C6BC0",
  khac: "#78909C",
};

const FIELD_DOT_COLORS: Record<BusinessField, string> = {
  xang_dau: "bg-red-500",
  gas: "bg-orange-500",
  phan_bon: "bg-green-500",
  hoa_chat: "bg-purple-500",
  thuc_pham: "bg-teal-500",
  thuong_mai: "bg-blue-500",
  xay_dung: "bg-yellow-500",
  dich_vu: "bg-indigo-500",
  khac: "bg-slate-500",
};

const TAY_NINH_CENTER: [number, number] = [11.31, 106.19];
const TAY_NINH_ZOOM = 10;

function businessIconHtml(b: Business, selected: boolean): string {
  const color = FIELD_COLORS[b.field] ?? "#78909C";
  const size = selected ? 36 : 30;
  const border = selected ? 4 : 3;
  const ring = selected
    ? `box-shadow:0 0 0 3px #1565C0,0 2px 8px rgba(0,0,0,.3);`
    : `box-shadow:0 1px 4px rgba(0,0,0,.25);`;
  const typeIcon = b.type === "company" ? "🏢" : "🏪";
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;border:${border}px solid ${color};background:#fff;${ring}display:grid;place-items:center;font-size:${size - border * 2 - 4}px;line-height:1;cursor:pointer">${typeIcon}</div>`;
}

function businessPopupHtml(b: Business): string {
  const color = FIELD_COLORS[b.field] ?? "#78909C";
  const statusLabel =
    b.status === "active"
      ? "Đang hoạt động"
      : b.status === "suspended"
        ? "Tạm ngừng"
        : "Hết hạn";
  const statusColor =
    b.status === "active" ? "#2E7D32" : b.status === "suspended" ? "#E59A23" : "#E53935";
  return `
    <div style="min-width:220px;font-family:inherit;padding:2px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #e0e0e0">
        <span style="width:12px;height:12px;border-radius:50%;background:${color};flex-shrink:0"></span>
        <div style="flex:1;min-width:0">
          <strong style="font-size:13px;color:#1a237e;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${b.name}</strong>
          <span style="font-size:11px;color:${statusColor};font-weight:600">${statusLabel}</span>
        </div>
      </div>
      <div style="font-size:12px;color:#444;line-height:1.7">
        <div><b style="color:#666">MST:</b> ${b.taxCode}</div>
        <div><b style="color:#666">Loại:</b> ${b.type === "company" ? "Doanh nghiệp" : "Hộ kinh doanh"}</div>
        <div><b style="color:#666">Lĩnh vực:</b> <span style="color:${color};font-weight:600">${FIELD_LABELS[b.field]}</span></div>
        <div><b style="color:#666">Địa chỉ:</b> ${b.ward}, ${b.district}</div>
        <div><b style="color:#666">Đại diện:</b> ${b.representative}</div>
        ${b.phone ? `<div><b style="color:#666">SĐT:</b> ${b.phone}</div>` : ""}
        ${b.mainProduct ? `<div><b style="color:#666">Mặt hàng:</b> ${b.mainProduct}</div>` : ""}
      </div>
    </div>
  `;
}

export function BusinessGisMap({
  businesses,
  selectedId,
  onSelect,
  expanded,
  onToggleExpand,
}: {
  businesses: Business[];
  selectedId?: string | null;
  onSelect?: (b: Business) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const boundaryLayerRef = useRef<LayerGroup | null>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LeafletMarker[]>([]);
  const [ready, setReady] = useState(false);
  const [legendVisible, setLegendVisible] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFields, setSelectedFields] = useState<BusinessField[]>([...ALL_FIELDS]);
  const loadedRef = useRef(false);
  const tayNinhBoundary = useTayNinhBoundary();

  // Load saved filter from JSON file on mount
  useEffect(() => {
    void fetch("/api/market/filter", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!loadedRef.current && data?.selectedFields) {
          setSelectedFields(data.selectedFields as BusinessField[]);
        }
      })
      .catch(() => {})
      .finally(() => {
        loadedRef.current = true;
      });
  }, []);

  // Save filter to JSON file when changed (after initial load)
  useEffect(() => {
    if (!loadedRef.current) return;
    void fetch("/api/market/filter", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedFields }),
    }).catch(() => {});
  }, [selectedFields]);

  const isFiltering = selectedFields.length !== ALL_FIELDS.length;

  // Count businesses per field
  const allFieldCounts = useMemo(() => {
    const m = new Map<BusinessField, number>();
    for (const b of businesses) {
      m.set(b.field, (m.get(b.field) ?? 0) + 1);
    }
    return m;
  }, [businesses]);

  // Filter businesses by selected fields
  const visibleBusinesses = useMemo(
    () => businesses.filter((b) => selectedFields.includes(b.field)),
    [businesses, selectedFields],
  );

  const toggleField = useCallback((field: BusinessField) => {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field],
    );
  }, []);

  const selectAll = useCallback(() => setSelectedFields([...ALL_FIELDS]), []);
  const deselectAll = useCallback(() => setSelectedFields([]), []);

  // Close filter panel when clicking outside
  useEffect(() => {
    if (!filterOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [filterOpen]);

  // Init map
  useEffect(() => {
    let unmounted = false;

    async function initMap() {
      if (!mapRef.current || mapInstanceRef.current) return;
      const L = (await import("leaflet")).default;
      if (unmounted || !mapRef.current) return;

      const map = L.map(mapRef.current, {
        center: TAY_NINH_CENTER,
        zoom: TAY_NINH_ZOOM,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://osm.org/copyright">OSM</a>',
        maxZoom: 18,
      }).addTo(map);

      map.whenReady(() => {
        if (!unmounted) setReady(true);
      });

      mapInstanceRef.current = map;
    }

    initMap();
    return () => {
      unmounted = true;
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Draw Tay Ninh boundary polygon
  useEffect(() => {
    if (!ready || !tayNinhBoundary.length) return;
    const map = mapInstanceRef.current;
    if (!map) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled) return;

      const layer = boundaryLayerRef.current;
      layer?.remove();

      const geo = L.geoJSON(
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

      boundaryLayerRef.current = geo;
    })();

    return () => {
      cancelled = true;
      boundaryLayerRef.current?.remove();
      boundaryLayerRef.current = null;
    };
  }, [ready, tayNinhBoundary]);

  // Update markers
  useEffect(() => {
    if (!ready) return;
    const map = mapInstanceRef.current;
    if (!map) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || mapInstanceRef.current !== map) return;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      for (const b of visibleBusinesses) {
        if (cancelled || mapInstanceRef.current !== map) return;
        const icon = L.divIcon({
          className: "gis-pin gis-pin-factory",
          html: businessIconHtml(b, b.id === selectedId),
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -18],
        });

        const marker = L.marker([b.lat, b.lng], { icon })
          .addTo(map)
          .bindPopup(businessPopupHtml(b), { maxWidth: 320, minWidth: 220 });

        marker.on("click", () => onSelect?.(b));
        markersRef.current.push(marker);
      }
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [ready, visibleBusinesses, selectedId, onSelect]);

  useEffect(() => {
    mapInstanceRef.current?.invalidateSize();
  }, [expanded]);

  useEffect(() => {
    if (selectedId) {
      const b = visibleBusinesses.find((x) => x.id === selectedId);
      if (b && mapInstanceRef.current) {
        mapInstanceRef.current.setView([b.lat, b.lng], 13, { animate: true });
      }
    }
  }, [selectedId, visibleBusinesses]);

  return (
    <div
      className={cn(
        "relative z-0 isolate overflow-hidden rounded-lg border border-border bg-slate-100",
        expanded && "fixed inset-2 z-40 rounded-xl shadow-2xl",
      )}
      style={{ height: expanded ? "calc(100dvh - 1rem)" : 500 }}
    >
      <div ref={mapRef} className="absolute inset-0" />

      {/* Control toolbar — top right */}
      <div className="absolute right-3 top-3 z-[800] flex flex-col gap-1.5 rounded-lg border border-border bg-card/95 p-1.5 shadow-panel backdrop-blur">
        {/* Filter button with red dot indicator */}
        <div className="relative">
          <MapControlButton
            label={filterOpen ? "Đóng bộ lọc ngành" : "Bộ lọc ngành"}
            onClick={() => setFilterOpen((v) => !v)}
            active={filterOpen}
          >
            <Filter className="size-4" />
          </MapControlButton>
          {isFiltering && !filterOpen && (
            <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-card bg-destructive" />
          )}
        </div>
        <MapControlButton
          label={legendVisible ? "Ẩn chú thích" : "Hiện chú thích"}
          onClick={() => setLegendVisible((v) => !v)}
        >
          {legendVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </MapControlButton>
        <MapControlButton
          label={expanded ? "Thoát toàn màn hình" : "Toàn màn hình"}
          onClick={onToggleExpand}
        >
          {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </MapControlButton>
      </div>

      {/* Filter popover — below toolbar, top right */}
      {filterOpen && (
        <div
          ref={filterPanelRef}
          className="absolute right-3 top-16 z-[800] max-h-[65%] w-52 overflow-y-auto rounded-lg border border-border bg-card/95 p-3 text-xs shadow-panel backdrop-blur"
        >
          <div className="mb-2 flex items-center gap-2 border-b border-border pb-2">
            <Filter className="size-3.5 text-gov" />
            <span className="flex-1 font-bold uppercase tracking-wide text-navy">
              Chọn lớp bản đồ
            </span>
            <span className="rounded-full bg-gov/10 px-1.5 py-0.5 text-[10px] font-semibold text-gov">
              {visibleBusinesses.length}/{businesses.length}
            </span>
          </div>

          {/* Select all / Deselect all */}
          <div className="mb-2 flex gap-1.5">
            <button
              type="button"
              onClick={selectAll}
              className={cn(
                "flex-1 rounded border px-1.5 py-1 text-[10px] font-medium transition-colors",
                selectedFields.length === ALL_FIELDS.length
                  ? "border-gov/30 bg-gov/10 text-gov"
                  : "border-border bg-surface text-muted-foreground hover:text-navy",
              )}
            >
              Chọn tất cả
            </button>
            <button
              type="button"
              onClick={deselectAll}
              className={cn(
                "flex-1 rounded border px-1.5 py-1 text-[10px] font-medium transition-colors",
                selectedFields.length === 0
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-border bg-surface text-muted-foreground hover:text-navy",
              )}
            >
              Bỏ chọn
            </button>
          </div>

          {/* Field checkboxes */}
          <div className="space-y-0.5">
            {ALL_FIELDS.map((field) => {
              const count = allFieldCounts.get(field) ?? 0;
              const active = selectedFields.includes(field);
              if (count === 0) return null;
              return (
                <button
                  key={field}
                  type="button"
                  onClick={() => toggleField(field)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-1.5 py-1 transition-colors",
                    active ? "bg-surface" : "opacity-50 hover:bg-surface/50",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-3.5 shrink-0 items-center justify-center rounded border",
                      active ? "border-gov bg-gov text-white" : "border-border bg-card",
                    )}
                  >
                    {active && (
                      <svg className="size-2.5" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  <span
                    className={cn("size-2.5 shrink-0 rounded-full", FIELD_DOT_COLORS[field])}
                  />
                  <span className="flex-1 text-left font-medium text-foreground">
                    {FIELD_LABELS[field]}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend — bottom right, hide when filter is open to avoid overlap */}
      {legendVisible && !filterOpen && (
        <div className="absolute bottom-3 right-3 z-[800] max-h-[40%] w-56 max-w-[calc(100%-1.5rem)] overflow-y-auto rounded-lg border border-border bg-card/95 p-3 text-xs shadow-panel backdrop-blur">
          <div className="mb-2 flex items-center gap-2 border-b border-border pb-2 font-bold uppercase tracking-wide text-navy">
            <Layers3 className="size-4 text-gov" /> Chú thích
          </div>
          <div className="space-y-1">
            {ALL_FIELDS.map((field) => {
              const count = allFieldCounts.get(field) ?? 0;
              if (count === 0) return null;
              return (
                <div
                  key={field}
                  className={cn(
                    "flex items-center gap-2 py-0.5",
                    !selectedFields.includes(field) && "opacity-40",
                  )}
                >
                  <span
                    className={cn("size-2.5 rounded-full shrink-0", FIELD_DOT_COLORS[field])}
                  />
                  <span className="flex-1">{FIELD_LABELS[field]}</span>
                  <span className="tabular-nums text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 border-t border-border pt-2 space-y-1">
            <p className="text-[10px] font-semibold text-navy mb-1">Loại thực thể</p>
            <div className="flex items-center gap-2 py-0.5">
              <span className="text-sm">🏢</span>
              <span>Doanh nghiệp</span>
            </div>
            <div className="flex items-center gap-2 py-0.5">
              <span className="text-sm">🏪</span>
              <span>Hộ kinh doanh</span>
            </div>
          </div>
          <div className="mt-2 border-t border-border pt-2 space-y-1">
            <p className="text-[10px] font-semibold text-navy mb-1">Ranh giới</p>
            <div className="flex items-center gap-2 py-0.5">
              <span className="block h-0 w-4 border-t-2 border-dashed border-[#0E7C6B]" />
              <span>Tỉnh Tây Ninh</span>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen header */}
      {expanded && (
        <div className="absolute left-3 top-14 z-[600] rounded-md border border-border bg-card/90 px-3 py-1.5 text-[11px] shadow-panel backdrop-blur">
          <span className="font-semibold text-navy">Bản đồ Doanh nghiệp / Hộ KDD</span>
          <span className="ml-2 text-muted-foreground">
            · {visibleBusinesses.length} đang hiển thị
          </span>
        </div>
      )}
    </div>
  );
}

function MapControlButton({
  label,
  onClick,
  children,
  active,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "relative grid size-9 place-items-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov",
        active
          ? "bg-gov text-white"
          : "text-navy hover:bg-gov hover:text-white",
      )}
    >
      {children}
    </button>
  );
}
