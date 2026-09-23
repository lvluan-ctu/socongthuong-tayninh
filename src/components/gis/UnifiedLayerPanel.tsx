import { useState } from "react";
import { GIS_LAYERS, GIS_LAYER_GROUPS, type GisLayerId } from "@/lib/gis-catalog";
import { useGisLayer } from "@/lib/gis-layer-context";
import { cn } from "@/lib/utils";

// Panel "Lớp dữ liệu" trên bản đồ GIS tổng hợp — đọc trạng thái từ registry
// (gis-layer-context), không giữ trạng thái riêng để đồng bộ 1 chiều với map.
export function UnifiedLayerPanel({
  counts,
  open: initialOpen = true,
}: {
  counts: Record<GisLayerId, number>;
  open?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const { visibleGisLayers, toggleGisLayer, setVisibleGisLayers } = useGisLayer();

  const toggleGroup = (group: (typeof GIS_LAYER_GROUPS)[number]) => {
    const allOn = group.layers.every((id) => visibleGisLayers.includes(id));
    setVisibleGisLayers(
      allOn
        ? visibleGisLayers.filter((id) => !group.layers.includes(id))
        : [...new Set([...visibleGisLayers, ...group.layers])],
    );
  };

  return (
    <div className="absolute left-3 top-3 z-[500] w-64 max-w-[calc(100%-1.5rem)] rounded-md border border-border bg-card/95 shadow-panel backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-wide text-navy"
      >
        Lớp dữ liệu
        <span className="text-muted-foreground">{open ? "Thu gọn" : "Mở"}</span>
      </button>
      {open ? (
        <div className="max-h-80 space-y-3 overflow-y-auto border-t border-border p-2">
          {GIS_LAYER_GROUPS.map((group) => {
            const groupOn = group.layers.every((id) => visibleGisLayers.includes(id));
            return (
              <div key={group.id}>
                <div className="flex items-center justify-between gap-2 px-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group)}
                    className="shrink-0 text-[10px] font-semibold text-gov hover:underline"
                  >
                    {groupOn ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                  </button>
                </div>
                <div className="mt-1 space-y-0.5">
                  {group.layers.map((id) => {
                    const def = GIS_LAYERS[id];
                    const on = visibleGisLayers.includes(id);
                    return (
                      <label
                        key={id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-surface",
                          on ? "text-navy" : "text-muted-foreground",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleGisLayer(id)}
                          className="size-3.5 accent-blue-700"
                        />
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: def.legend.color }}
                        />
                        <span className="min-w-0 flex-1 truncate">{def.label}</span>
                        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                          {counts[id] ?? 0}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// Chú giải tự sinh từ catalog theo các lớp đang bật trên bản đồ.
export function GisLegend() {
  const { visibleGisLayers } = useGisLayer();
  if (visibleGisLayers.length === 0) return null;
  return (
    <div className="absolute bottom-3 right-3 z-[500] max-w-60 rounded-md border border-border bg-card/95 p-2 text-xs shadow-panel backdrop-blur">
      <p className="mb-1.5 font-semibold text-navy">Chú giải lớp dữ liệu</p>
      <div className="space-y-1">
        {visibleGisLayers.map((id) => {
          const def = GIS_LAYERS[id];
          return (
            <p key={id} className="flex items-center gap-1.5 text-muted-foreground">
              {def.legend.style === "point" ? (
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: def.legend.color }}
                />
              ) : def.legend.style === "dash" ? (
                <span
                  className="inline-block w-4 shrink-0 border-t-2 border-dashed"
                  style={{ borderColor: def.legend.color }}
                />
              ) : def.legend.style === "line" ? (
                <span
                  className="inline-block w-4 shrink-0 border-t-2"
                  style={{ borderColor: def.legend.color }}
                />
              ) : (
                <span
                  className="inline-block size-3 shrink-0 rounded-[3px]"
                  style={{ background: def.legend.color }}
                />
              )}
              <span className="truncate">{def.label}</span>
            </p>
          );
        })}
      </div>
    </div>
  );
}
