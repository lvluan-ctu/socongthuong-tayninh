"use client";

import { useMemo, useState } from "react";
import { Drawer, Modal, ScrollArea, Switch } from "@mantine/core";
import {
  ExternalLink,
  Eye,
  EyeOff,
  Layers3,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GIS_ICON_FILTER } from "@/config/gis-visuals";
import { Link } from "@/lib/router-compat";
import { cn } from "@/lib/utils";

export type GisLayerControl = {
  id: string;
  label: string;
  source: "PostGIS" | "GeoServer" | "Nghiệp vụ" | "Cảnh báo";
  color: string;
  glyph: string;
  icon?: string;
  visible: boolean;
  description?: string;
};

export type GisLegendItem = {
  id: string;
  label: string;
  color: string;
  glyph?: string;
  icon?: string;
  animated?: boolean;
  line?: boolean;
};

export type GisFeatureDetail = {
  id: string;
  title: string;
  subtitle?: string;
  source: string;
  category: string;
  status?: string;
  severity?: "danger" | "warning" | "info";
  fields: Array<{ label: string; value: unknown }>;
  note?: string;
  recommendation?: string;
  managementHref?: string;
  managementLabel?: string;
  canOpenDetail?: boolean;
};

export function MapSearchTypeSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Lọc loại địa điểm trên bản đồ"
      className="max-w-40 shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

const SOURCE_ORDER: GisLayerControl["source"][] = ["Cảnh báo", "Nghiệp vụ", "PostGIS", "GeoServer"];


export function BoundaryScopeControl({
  mode,
  onChange,
  name = "energy-map-boundary-mode",
}: {
  mode: "all" | "tay-ninh";
  onChange: (mode: "all" | "tay-ninh") => void;
  name?: string;
}) {
  return (
    <fieldset className="absolute right-14 top-3 z-[800] max-w-[calc(100%-4.5rem)] rounded-lg border border-border bg-card/95 px-3 py-2 shadow-panel backdrop-blur">
      <legend className="px-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        Phạm vi bản đồ
      </legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-navy">
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="radio" name={name} checked={mode === "all"} onChange={() => onChange("all")} />
          Hiển thị tất cả
        </label>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="radio" name={name} checked={mode === "tay-ninh"} onChange={() => onChange("tay-ninh")} />
          Chỉ hiển thị tỉnh Tây Ninh
        </label>
      </div>
    </fieldset>
  );
}

export function GisMapChrome({
  layers,
  legendItems,
  expanded,
  detail,
  onToggleLayer,
  onSetAllLayers,
  onZoomIn,
  onZoomOut,
  onToggleExpanded,
  onCloseDetail,
  onOpenDetail,
  statusText,
  boundaryMode,
  onBoundaryModeChange,
}: {
  layers: GisLayerControl[];
  legendItems: GisLegendItem[];
  expanded: boolean;
  detail?: GisFeatureDetail | null;
  onToggleLayer: (id: string) => void;
  onSetAllLayers?: (visible: boolean) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleExpanded: () => void;
  onCloseDetail?: () => void;
  onOpenDetail?: (detail: GisFeatureDetail) => void;
  statusText?: string;
  boundaryMode?: "all" | "tay-ninh";
  onBoundaryModeChange?: (mode: "all" | "tay-ninh") => void;
  boundaryScopeName?: string;
}) {
  const [settingsOpened, setSettingsOpened] = useState(false);
  const [legendVisible, setLegendVisible] = useState(true);
  const visibleCount = layers.filter((layer) => layer.visible).length;
  const groups = useMemo(
    () =>
      SOURCE_ORDER.map((source) => ({
        source,
        layers: layers.filter((layer) => layer.source === source),
      })).filter((group) => group.layers.length),
    [layers],
  );

  return (
    <>
      <div className="absolute right-3 top-3 z-[800] flex flex-col gap-1.5 rounded-lg border border-border bg-card/95 p-1.5 shadow-panel backdrop-blur">
        <ControlButton label="Phóng to" onClick={onZoomIn}>
          <Plus className="size-4" />
        </ControlButton>
        <ControlButton label="Thu nhỏ" onClick={onZoomOut}>
          <Minus className="size-4" />
        </ControlButton>
        <div className="my-0.5 border-t border-border" />
        <ControlButton label="Cấu hình lớp bản đồ" onClick={() => setSettingsOpened(true)}>
          <Settings2 className="size-4" />
          <span className="absolute -right-1.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-gov px-1 text-[9px] font-bold leading-4 text-white">
            {visibleCount}
          </span>
        </ControlButton>
        <ControlButton
          label={legendVisible ? "Ẩn chú thích" : "Hiện chú thích"}
          onClick={() => setLegendVisible((value) => !value)}
        >
          {legendVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </ControlButton>
        <ControlButton
          label={expanded ? "Thoát toàn màn hình" : "Toàn màn hình"}
          onClick={onToggleExpanded}
        >
          {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </ControlButton>
      </div>

      {boundaryMode && onBoundaryModeChange ? (
        <fieldset className="absolute right-14 top-3 z-[800] max-w-[calc(100%-4.5rem)] rounded-lg border border-border bg-card/95 px-3 py-2 shadow-panel backdrop-blur">
          <legend className="px-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Phạm vi bản đồ
          </legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-navy">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="energy-map-boundary-mode"
                value="all"
                checked={boundaryMode === "all"}
                onChange={() => onBoundaryModeChange("all")}
              />
              Hiển thị tất cả
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="energy-map-boundary-mode"
                value="tay-ninh"
                checked={boundaryMode === "tay-ninh"}
                onChange={() => onBoundaryModeChange("tay-ninh")}
              />
              Chỉ hiển thị tỉnh Tây Ninh
            </label>
          </div>
        </fieldset>
      ) : null}

      {legendVisible ? (
        <div className="absolute bottom-3 right-3 z-[800] max-h-[45%] w-64 max-w-[calc(100%-1.5rem)] overflow-y-auto rounded-lg border border-border bg-card/95 p-3 text-xs shadow-panel backdrop-blur">
          <div className="mb-2 flex items-center gap-2 border-b border-border pb-2 font-bold uppercase tracking-wide text-navy">
            <Layers3 className="size-4 text-gov" /> Chú thích bản đồ
          </div>
          <div className="space-y-1.5">
            {legendItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-muted-foreground">
                <span
                  className={cn(
                    "grid shrink-0 place-items-center text-[8px] font-black text-white",
                    item.line ? "h-1 w-7 rounded-full" : "size-3.5 rounded-full",
                    item.animated && "gis-legend-alert",
                  )}
                  style={{ backgroundColor: item.color }}
                >
                  {!item.line ? item.icon ? <img src={item.icon} alt="" className="size-3.5 object-contain" style={{ filter: GIS_ICON_FILTER }} /> : item.glyph : null}
                </span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          {statusText ? (
            <p className="mt-2 border-t border-border pt-2 text-[10px] leading-4 text-muted-foreground">
              {statusText}
            </p>
          ) : null}
        </div>
      ) : null}

      <Modal
        opened={settingsOpened}
        onClose={() => setSettingsOpened(false)}
        title="Cấu hình lớp bản đồ"
        size="lg"
        centered
        zIndex={3000}
        overlayProps={{ backgroundOpacity: 0.5, blur: 3 }}
      >
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-gov/20 bg-gov/5 p-3">
          <Layers3 className="size-5 text-gov" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-navy">
              Đang hiển thị {visibleCount}/{layers.length} lớp
            </p>
            <p className="text-xs text-muted-foreground">
              Các lớp được nhóm theo nguồn nhưng có thể bật/tắt độc lập.
            </p>
          </div>
          {onSetAllLayers ? (
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" onClick={() => onSetAllLayers(true)}>
                Hiện tất cả
              </Button>
              <Button variant="outline" size="sm" onClick={() => onSetAllLayers(false)}>
                Ẩn tất cả
              </Button>
            </div>
          ) : null}
        </div>
        <ScrollArea.Autosize mah="65vh" offsetScrollbars>
          <div className="space-y-5 pr-2">
            {groups.map((group) => (
              <section key={group.source}>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  {group.source}
                  <span className="h-px flex-1 bg-border" />
                </div>
                <div className="space-y-2">
                  {group.layers.map((layer) => (
                    <label
                      key={layer.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition",
                        layer.visible
                          ? "border-gov/25 bg-gov/5"
                          : "border-border bg-background hover:bg-surface",
                      )}
                    >
                      <span
                        className="grid size-9 shrink-0 place-items-center rounded-lg text-xs font-black text-white shadow-sm"
                        style={{ backgroundColor: layer.color }}
                      >
                        {layer.icon ? <img src={layer.icon} alt="" className="size-5 object-contain" style={{ filter: GIS_ICON_FILTER }} /> : layer.glyph}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-navy">{layer.label}</span>
                        {layer.description ? (
                          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                            {layer.description}
                          </span>
                        ) : null}
                      </span>
                      <Switch
                        checked={layer.visible}
                        onChange={() => onToggleLayer(layer.id)}
                        aria-label={`Hiển thị ${layer.label}`}
                        color="blue"
                      />
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </ScrollArea.Autosize>
      </Modal>

      <Drawer
        opened={Boolean(detail)}
        onClose={() => onCloseDetail?.()}
        title="Thông tin đối tượng GIS"
        position="right"
        size="md"
        zIndex={3000}
        overlayProps={{ backgroundOpacity: 0.42, blur: 2 }}
      >
        {detail ? (
          <div className="space-y-4">
            <div
              className={cn(
                "rounded-xl border p-4",
                detail.severity === "danger"
                  ? "border-destructive/30 bg-destructive/10"
                  : detail.severity === "warning"
                    ? "border-warning/35 bg-warning/10"
                    : "border-gov/20 bg-gov/5",
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-full text-sm font-black text-white",
                    detail.severity === "danger"
                      ? "bg-destructive"
                      : detail.severity === "warning"
                        ? "bg-warning"
                        : "bg-gov",
                  )}
                >
                  {detail.severity === "danger" ? "!" : detail.severity === "warning" ? "⚠" : "i"}
                </span>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-navy">{detail.title}</h3>
                  {detail.subtitle ? (
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                      {detail.subtitle}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
                    <span className="rounded-full bg-card px-2 py-1 text-gov">
                      {detail.category}
                    </span>
                    <span className="rounded-full bg-card px-2 py-1 text-muted-foreground">
                      {detail.source}
                    </span>
                    {detail.status ? (
                      <span className="rounded-full bg-card px-2 py-1 text-navy">
                        {detail.status}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <dl className="overflow-hidden rounded-lg border border-border bg-background">
              {detail.fields
                .filter((field) => field.value != null && field.value !== "")
                .map((field) => (
                  <div
                    key={field.label}
                    className={cn(
                      "grid grid-cols-[minmax(110px,0.8fr)_minmax(0,1.2fr)] gap-3 border-b border-border px-3 py-2.5 text-xs last:border-b-0",
                      field.label.includes("Cúp điện") && "bg-red-50",
                      field.label.includes("Có điện lại") && "bg-green-50",
                    )}
                  >
                    <dt className={cn(
                      "text-muted-foreground",
                      field.label.includes("Cúp điện") && "font-bold text-red-700",
                      field.label.includes("Có điện lại") && "font-bold text-green-700",
                    )}>{field.label}</dt>
                    <dd className={cn(
                      "break-words text-right font-semibold text-navy",
                      field.label.includes("Cúp điện") && "text-red-800",
                      field.label.includes("Có điện lại") && "text-green-800",
                    )}>
                      {String(field.value)}
                    </dd>
                  </div>
                ))}
            </dl>

            {detail.note ? (
              <div className="rounded-lg border border-border bg-surface p-3 text-sm leading-6 text-foreground">
                {detail.note}
              </div>
            ) : null}
            {detail.recommendation ? (
              <div className="rounded-lg border border-gov/20 bg-gov/5 p-3 text-sm leading-6 text-navy">
                <strong>Đề xuất xử lý: </strong>
                {detail.recommendation}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              {onOpenDetail && detail.canOpenDetail ? (
                <Button variant="outline" onClick={() => onOpenDetail(detail)}>
                  Xem hồ sơ đầy đủ
                </Button>
              ) : null}
              {detail.managementHref ? (
                <Button asChild className="ml-auto">
                  <Link to={detail.managementHref}>
                    {detail.managementLabel ?? "Đến trang quản lý"}
                    <ExternalLink className="size-4" />
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="relative grid size-9 place-items-center rounded-md text-navy transition hover:bg-gov hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov"
    >
      {children}
    </button>
  );
}
