import { useCallback, useMemo, useState } from "react";
import { createFileRoute } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Map as MapIcon, MapPin, Search, Table2 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { UnifiedGisMap } from "@/components/gis/UnifiedGisMap";
import { GisLegend, UnifiedLayerPanel } from "@/components/gis/UnifiedLayerPanel";
import { ClusterDetail, FactoryList, WardDetail } from "@/components/gis/IndustrialPanels";
import { CompanyProfileDrawer } from "@/components/gis/CompanyProfileDrawer";
import { GridEntityDrawer } from "@/components/grid/GridEntityDrawer";
import { entityKey, type GridEntity } from "@/components/grid/GridMap";
import { Input } from "@/components/ui/input";
import { getTask1GridData } from "@/lib/grid-service";
import { WARD_ZONES, wardZoneOfCluster } from "@/data/industrial-zones";
import { CLUSTERS, CLUSTER_FACTORIES } from "@/data/mock";
import { GIS_LAYERS, type GisLayerId } from "@/lib/gis-catalog";
import { useGisLayer } from "@/lib/gis-layer-context";
import type { Cluster, Factory, WardZone } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gis/map")({
  head: () => ({
    meta: [
      { title: "Bản đồ GIS tổng hợp | Nền tảng ngành Công Thương" },
      {
        name: "description",
        content:
          "Bản đồ GIS tổng hợp tỉnh Tây Ninh: một bản đồ quản lý nhiều lớp — xã/phường, KCN/CCN, doanh nghiệp, trạm biến áp, lưới điện (Nhiệm vụ 1) — bật/tắt và chồng lớp tùy ý.",
      },
      { property: "og:title", content: "Bản đồ GIS tổng hợp" },
      {
        property: "og:description",
        content:
          "Một bản đồ duy nhất cho KCN/CCN và nguồn năng lượng (trạm, lưới, trụ, quy hoạch) với bảng đối tượng đồng bộ hai chiều.",
      },
    ],
  }),
  component: Page,
});

// Hàng của bảng đối tượng — gộp mọi loại đối tượng đang bật trên bản đồ.
interface EntityRow {
  key: string;
  layer: Exclude<GisLayerId, "ward" | "factory">;
  name: string;
  location: string;
  metric: string;
  metricTone?: "success" | "gov" | "warning" | "destructive";
  status: string;
}

const ENTITY_LAYER_LABEL: Record<EntityRow["layer"], string> = {
  kcn: "KCN/CCN",
  substation: "Trạm biến áp",
  lines: "Đường dây",
  poles: "Trụ điện",
  planning: "Quy hoạch",
  corridors: "Hành lang an toàn",
  connectionPoints: "Điểm đấu nối",
  incidents: "Điểm sự cố",
  overloadZones: "Khu vực quá tải",
  renewables: "Nguồn NLTT",
};

function Page() {
  const { visibleGisLayers } = useGisLayer();
  const [selectedWardId, setSelectedWardId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ company: Factory; cluster: Cluster | null } | null>(
    null,
  );
  const [selectedGrid, setSelectedGrid] = useState<GridEntity | null>(null);
  const [entityQuery, setEntityQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState<EntityRow["layer"] | "all">("all");

  const gridQuery = useQuery({ queryKey: ["grid", "task1"], queryFn: getTask1GridData });
  const grid = gridQuery.data ?? null;

  const activeClusters = CLUSTERS;
  const selectedWard: WardZone | null = WARD_ZONES.find((w) => w.id === selectedWardId) ?? null;
  const selectedCluster = activeClusters.find((c) => c.id === selectedZoneId) ?? null;

  const wardClusters: Cluster[] = useMemo(
    () => (selectedWard ? activeClusters.filter((c) => selectedWard.clusters.includes(c.id)) : []),
    [selectedWard, activeClusters],
  );

  const wardCompanies: Factory[] = useMemo(
    () =>
      selectedWard ? selectedWard.clusters.flatMap((cid) => CLUSTER_FACTORIES[cid] ?? []) : [],
    [selectedWard],
  );

  const zoneFactories: Factory[] = useMemo(
    () => (selectedZoneId ? (CLUSTER_FACTORIES[selectedZoneId] ?? []) : []),
    [selectedZoneId],
  );

  const mapCompanies = selectedZoneId ? zoneFactories : wardCompanies;

  const zoneNameById: Record<string, string> = useMemo(() => {
    const m: Record<string, string> = {};
    wardClusters.forEach((c) => {
      (CLUSTER_FACTORIES[c.id] ?? []).forEach((f) => {
        m[f.id] = c.name;
      });
    });
    return m;
  }, [wardClusters]);

  const selectedGridKey = selectedGrid ? entityKey(selectedGrid) : null;

  const selectWard = useCallback((w?: WardZone) => {
    setSelectedWardId((prev) => (prev && prev === w?.id ? null : (w?.id ?? null)));
    setSelectedZoneId(null);
    setSelectedCompanyId(null);
    setProfile(null);
  }, []);

  const selectZone = useCallback((c?: Cluster) => {
    setSelectedZoneId((prev) => (prev && prev === c?.id ? null : (c?.id ?? null)));
    if (c) setSelectedWardId(wardZoneOfCluster(c.id)?.id ?? null);
    setSelectedCompanyId(null);
    setProfile(null);
  }, []);

  const selectCompany = useCallback((f?: Factory) => {
    setSelectedCompanyId((prev) => (prev && prev === f?.id ? null : (f?.id ?? null)));
  }, []);

  const openProfile = useCallback(
    (f: Factory) => setProfile({ company: f, cluster: selectedCluster }),
    [selectedCluster],
  );

  const resetDrill = useCallback(() => {
    setSelectedWardId(null);
    setSelectedZoneId(null);
    setSelectedCompanyId(null);
    setProfile(null);
  }, []);

  // Số đối tượng từng lớp — hiển thị trên panel "Lớp dữ liệu".
  const layerCounts = useMemo(() => {
    const totalFactories = Object.values(CLUSTER_FACTORIES).reduce((s, arr) => s + arr.length, 0);
    const connectionPointCount = (grid?.substations ?? []).reduce(
      (s, sub) => s + (sub.connectionPoints?.length ?? 0),
      0,
    );
    return {
      ward: WARD_ZONES.length,
      kcn: CLUSTERS.length,
      factory: totalFactories,
      substation: grid?.substations.length ?? 0,
      lines: grid?.lines.length ?? 0,
      poles: grid?.poles.length ?? 0,
      planning: grid?.planned.length ?? 0,
      corridors: grid?.lines.filter((l) => l.route?.length).length ?? 0,
      connectionPoints: connectionPointCount,
      incidents: grid?.incidents.length ?? 0,
      overloadZones: grid?.overloadZones.length ?? 0,
      renewables: grid?.renewables.length ?? 0,
    } as Record<GisLayerId, number>;
  }, [grid]);

  const visibleLayer = (id: GisLayerId) => visibleGisLayers.includes(id);

  // Bảng đối tượng — chỉ gồm các lớp đang bật trên bản đồ.
  const entityRows = useMemo<EntityRow[]>(() => {
    const rows: EntityRow[] = [];

    if (visibleLayer("kcn")) {
      CLUSTERS.forEach((c) => {
        rows.push({
          key: `kcn:${c.id}`,
          layer: "kcn",
          name: c.name,
          location: `${c.ward} · ${c.district}`,
          metric: `${c.occupancy}%`,
          metricTone: c.occupancy >= 75 ? "success" : c.occupancy >= 50 ? "gov" : "warning",
          status: c.status,
        });
      });
    }

    if (grid && visibleLayer("substation")) {
      grid.substations.forEach((s) => {
        const load = s.loadFactor ?? 0;
        rows.push({
          key: entityKey({ kind: "substation", item: s }),
          layer: "substation",
          name: s.name,
          location: `${s.voltageLevel} · ${s.district}`,
          metric: `${load}%`,
          metricTone: load >= 100 ? "destructive" : load >= 90 ? "warning" : "success",
          status: s.status,
        });
      });
    }

    if (grid && visibleLayer("lines")) {
      grid.lines.forEach((l) => {
        rows.push({
          key: entityKey({ kind: "line", item: l }),
          layer: "lines",
          name: l.name,
          location: `${l.voltageLevel} · ${l.fromPoint} → ${l.toPoint}`,
          metric: `${l.lengthKm} km`,
          status: l.status,
        });
      });
    }

    if (grid && visibleLayer("poles")) {
      grid.poles.forEach((p) => {
        rows.push({
          key: entityKey({ kind: "pole", item: p }),
          layer: "poles",
          name: p.code,
          location: `Tuyến ${p.lineCode}`,
          metric: p.type,
          status: p.technicalStatus,
        });
      });
    }

    if (grid && visibleLayer("planning")) {
      grid.planned.forEach((a) => {
        rows.push({
          key: entityKey({ kind: "plan", item: a }),
          layer: "planning",
          name: a.name,
          location: a.voltageLevel,
          metric: a.progress,
          status: `Năm ${a.year}`,
        });
      });
    }

    if (grid && visibleLayer("corridors")) {
      grid.lines
        .filter((l) => l.route?.length)
        .forEach((l) => {
          rows.push({
            key: `corridor:${l.id}`,
            layer: "corridors",
            name: `Hành lang — ${l.name}`,
            location: `${l.voltageLevel} · NĐ 14/2014/NĐ-CP`,
            metric: l.corridorStatus ?? "Chưa đánh giá",
            metricTone: l.corridorStatus === "Đạt" ? "success" : "warning",
            status: l.status,
          });
        });
    }

    if (grid && visibleLayer("connectionPoints")) {
      grid.substations.forEach((s) => {
        s.connectionPoints?.forEach((p) => {
          rows.push({
            key: `cp:${p.id}`,
            layer: "connectionPoints",
            name: p.name,
            location: `${p.voltageLevel} · ${s.name}`,
            metric: p.type,
            status: p.status,
          });
        });
      });
    }

    if (grid && visibleLayer("incidents")) {
      grid.incidents.forEach((inc) => {
        rows.push({
          key: `incident:${inc.id}`,
          layer: "incidents",
          name: `${inc.code} — ${inc.type}`,
          location: `${inc.lineCode} · ${inc.location}`,
          metric: `${inc.lostLoadMw ?? 0} MW`,
          metricTone:
            inc.severity === "high"
              ? "destructive"
              : inc.severity === "medium"
                ? "warning"
                : "success",
          status: inc.progress ?? "—",
        });
      });
    }

    if (grid && visibleLayer("overloadZones")) {
      grid.overloadZones.forEach((z) => {
        rows.push({
          key: `overload:${z.id}`,
          layer: "overloadZones",
          name: z.label,
          location: z.district,
          metric: `${z.loadFactorPct}%`,
          metricTone: z.loadFactorPct >= 100 ? "destructive" : "warning",
          status: "Đang quá tải",
        });
      });
    }

    if (grid && visibleLayer("renewables")) {
      grid.renewables.forEach((r) => {
        rows.push({
          key: `renewable:${r.id}`,
          layer: "renewables",
          name: r.owner,
          location: `${r.type} · ${r.hostSubstationId}`,
          metric: `${r.installedKw} kW`,
          metricTone:
            r.overload === "Không"
              ? "success"
              : r.overload === "Cảnh báo"
                ? "warning"
                : "destructive",
          status: r.status,
        });
      });
    }

    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, visibleGisLayers]);

  const filterOptions = useMemo(() => {
    const present = new Set(entityRows.map((r) => r.layer));
    return (Object.keys(ENTITY_LAYER_LABEL) as EntityRow["layer"][]).filter((l) => present.has(l));
  }, [entityRows]);

  const visibleRows = useMemo(() => {
    const q = entityQuery.trim().toLowerCase();
    return entityRows.filter((r) => {
      if (entityFilter !== "all" && r.layer !== entityFilter) return false;
      if (!q) return true;
      return `${r.name} ${r.location} ${r.status} ${r.metric}`.toLowerCase().includes(q);
    });
  }, [entityRows, entityFilter, entityQuery]);

  const selectRow = useCallback(
    (row: EntityRow) => {
      if (row.layer === "kcn") {
        const c = CLUSTERS.find((item) => `kcn:${item.id}` === row.key);
        if (c) selectZone(c);
        return;
      }
      if (!grid) return;
      const [kind, id] = row.key.split(":") as [string, string];
      if (kind === "substation") {
        const item = grid.substations.find((s) => s.id === id);
        if (item) setSelectedGrid({ kind: "substation", item });
      } else if (kind === "line") {
        const item = grid.lines.find((l) => l.id === id);
        if (item) setSelectedGrid({ kind: "line", item });
      } else if (kind === "pole") {
        const item = grid.poles.find((p) => p.id === id);
        if (item) setSelectedGrid({ kind: "pole", item });
      } else if (kind === "plan") {
        const item = grid.planned.find((a) => a.id === id);
        if (item) setSelectedGrid({ kind: "plan", item });
      }
    },
    [grid, selectZone],
  );

  const drillActive = selectedWardId != null || selectedZoneId != null;
  const metricToneClass: Record<NonNullable<EntityRow["metricTone"]>, string> = {
    success: "bg-success/10 text-success",
    gov: "bg-gov/10 text-gov",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  };

  return (
    <>
      <PageHeader
        title="Bản đồ GIS tổng hợp"
        crumbs={[{ label: "Nghiệp vụ" }, { label: "Bản đồ GIS tổng hợp" }]}
        variant="panel"
        icon={MapIcon}
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="gov-card overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
                Bản đồ GIS tổng hợp — KCN/CCN &amp; Nguồn năng lượng (Nhiệm vụ 1)
              </h2>
              <p className="text-xs text-muted-foreground">
                {selectedCluster
                  ? `Đang xem doanh nghiệp trong ${selectedCluster.name}`
                  : selectedWard
                    ? `Đang xem địa bàn ${selectedWard.name}`
                    : "Bật/tắt lớp dữ liệu ở góc trái · bấm đối tượng để xem chi tiết"}
              </p>
            </div>
            <span className="rounded-full border border-gov/25 bg-gov/5 px-2.5 py-0.5 text-[11px] font-semibold text-gov">
              {visibleGisLayers.length} lớp đang bật
            </span>
          </header>

          <div className="relative bg-surface">
            <UnifiedGisMap
              wards={WARD_ZONES}
              selectedWardId={selectedWardId}
              highlightWardIds={[]}
              wardFilterActive={false}
              wardClusterIds={wardClusters.map((c) => c.id)}
              onSelectWard={selectWard}
              zones={activeClusters}
              selectedZoneId={selectedZoneId}
              onSelectZone={selectZone}
              companies={mapCompanies}
              selectedCompanyId={selectedCompanyId}
              zoneName={selectedCluster?.name ?? null}
              zoneNameById={zoneNameById}
              onSelectCompany={selectCompany}
              onOpenProfile={openProfile}
              grid={grid}
              selectedGridKey={selectedGridKey}
              onSelectGridEntity={setSelectedGrid}
              height={620}
            />

            <UnifiedLayerPanel counts={layerCounts} />
            <GisLegend />

            {/* Đường dẫn đang xem: Xã/Phường → KCN/CCN → Doanh nghiệp */}
            <div className="absolute bottom-3 left-3 z-[500] flex items-center gap-1.5 rounded-md border border-border bg-card/90 px-2.5 py-1.5 text-[11px] shadow-panel backdrop-blur">
              <button
                type="button"
                onClick={drillActive || selectedGrid ? resetDrill : undefined}
                className={cn(
                  "flex items-center gap-1 font-semibold text-gov",
                  (drillActive || selectedGrid) &&
                    "cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-surface hover:text-navy",
                )}
                title={drillActive || selectedGrid ? "Quay lại toàn tỉnh" : undefined}
              >
                <MapPin className="size-3.5" /> Toàn tỉnh
              </button>
              {selectedWard ? (
                <>
                  <ChevronRight className="size-3 text-muted-foreground" />
                  <span className="hidden max-w-44 truncate font-semibold text-teal sm:inline">
                    {selectedWard.name}
                  </span>
                </>
              ) : null}
              {selectedCluster ? (
                <>
                  <ChevronRight className="size-3 text-muted-foreground" />
                  <span className="hidden max-w-44 truncate font-semibold text-navy md:inline">
                    {selectedCluster.name}
                  </span>
                </>
              ) : null}
              {selectedGrid ? (
                <>
                  <ChevronRight className="size-3 text-muted-foreground" />
                  <span className="hidden max-w-44 truncate font-semibold text-navy md:inline">
                    {selectedGrid.kind === "pole" ? selectedGrid.item.code : selectedGrid.item.name}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Bậc 1: Chi tiết xã/phường + danh sách nhà máy trong vùng */}
        {selectedWard && !selectedCluster ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <WardDetail ward={selectedWard} clusters={wardClusters} onSelectCluster={selectZone} />
            <FactoryList
              factories={wardCompanies}
              selectedFactoryId={selectedCompanyId}
              onSelectFactory={selectCompany}
              onOpenProfile={openProfile}
            />
          </div>
        ) : null}

        {/* Bậc 2: Chi tiết khu + danh sách doanh nghiệp */}
        {selectedCluster ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ClusterDetail cluster={selectedCluster} factories={zoneFactories} />
            <FactoryList
              factories={zoneFactories}
              selectedFactoryId={selectedCompanyId}
              onSelectFactory={selectCompany}
              onOpenProfile={openProfile}
            />
          </div>
        ) : null}

        {/* Bảng đối tượng — đồng bộ 2 chiều với bản đồ */}
        <section className="gov-card overflow-hidden">
          <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-teal/10 text-teal">
              <Table2 className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
                Đối tượng trên bản đồ
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Danh sách đối tượng của các lớp đang bật — bấm hàng để khoan xuống bản đồ, bấm trên
                bản đồ để làm nổi bật hàng
              </p>
            </div>
            <form onSubmit={(e) => e.preventDefault()} className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={entityQuery}
                onChange={(e) => setEntityQuery(e.target.value)}
                placeholder="Tìm trong danh sách..."
                className="h-9 w-full pl-8"
              />
            </form>
          </header>

          <div className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setEntityFilter("all")}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
                  entityFilter === "all"
                    ? "border-navy bg-navy text-white"
                    : "border-border bg-surface text-muted-foreground hover:border-navy/40 hover:text-navy",
                )}
              >
                Tất cả ({entityRows.length})
              </button>
              {filterOptions.map((layer) => (
                <button
                  key={layer}
                  type="button"
                  onClick={() => setEntityFilter(entityFilter === layer ? "all" : layer)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
                    entityFilter === layer
                      ? "border-navy bg-navy text-white"
                      : "border-border bg-surface text-muted-foreground hover:border-navy/40 hover:text-navy",
                  )}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ background: GIS_LAYERS[layer].legend.color }}
                  />
                  {ENTITY_LAYER_LABEL[layer]}
                </button>
              ))}
            </div>

            <div className="max-h-[520px] overflow-auto rounded-lg border border-border">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2.5">Loại đối tượng</th>
                    <th className="px-3 py-2.5">Tên</th>
                    <th className="px-3 py-2.5">Địa bàn / Tuyến</th>
                    <th className="px-3 py-2.5">Chỉ số chính</th>
                    <th className="px-3 py-2.5">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {visibleRows.map((row) => {
                    const highlighted =
                      row.layer === "kcn"
                        ? selectedZoneId === row.key.slice(4)
                        : selectedGridKey === row.key;
                    return (
                      <tr
                        key={row.key}
                        onClick={() => selectRow(row)}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-gov/5",
                          highlighted && "bg-gov/10 ring-1 ring-inset ring-gov/30",
                        )}
                      >
                        <td className="px-3 py-2.5">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              borderColor: `${GIS_LAYERS[row.layer].legend.color}33`,
                              color: GIS_LAYERS[row.layer].legend.color,
                              background: `${GIS_LAYERS[row.layer].legend.color}0d`,
                            }}
                          >
                            <span
                              className="size-1.5 rounded-full"
                              style={{ background: GIS_LAYERS[row.layer].legend.color }}
                            />
                            {ENTITY_LAYER_LABEL[row.layer]}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-medium text-navy">{row.name}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{row.location}</td>
                        <td className="px-3 py-2.5 tabular-nums">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              row.metricTone
                                ? metricToneClass[row.metricTone]
                                : "bg-surface text-muted-foreground",
                            )}
                          >
                            {row.metric}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{row.status}</td>
                      </tr>
                    );
                  })}
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-8 text-center text-xs text-muted-foreground"
                      >
                        {gridQuery.isLoading
                          ? "Đang tải dữ liệu lưới điện…"
                          : "Không có đối tượng nào — hãy bật thêm lớp dữ liệu trên bản đồ."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      <CompanyProfileDrawer
        open={profile != null}
        onOpenChange={(v) => !v && setProfile(null)}
        company={profile?.company ?? null}
        cluster={profile?.cluster ?? null}
      />
      <GridEntityDrawer entity={selectedGrid} onOpenChange={(v) => !v && setSelectedGrid(null)} />
    </>
  );
}
