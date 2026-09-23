import { useEffect, useMemo, useState } from "react";
import { Factory as FactoryIcon, MapPin } from "lucide-react";
import { ProgressMetric } from "@/components/dashboard/Metrics";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { FACTORY_STATUS_LABEL } from "@/lib/constants";
import type { Cluster, Factory, WardZone } from "@/lib/types";
import { cn } from "@/lib/utils";

// Các panel dùng chung giữa trang GIS Khu/Cụm công nghiệp (/industrial-clusters)
// và bản đồ GIS tổng hợp (/gis/map).

export function occupancyColor(c: Cluster): string {
  if (c.occupancy >= 75) return "bg-success";
  if (c.occupancy >= 50) return "bg-gov";
  return "bg-warning";
}

export function LegendItem({ dot, label }: { dot: string; label: string }) {
  return (
    <p className="flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", dot)} /> {label}
    </p>
  );
}

// Bậc 1 — Tổng quan địa bàn xã/phường (chính quyền 2 cấp trực thuộc tỉnh)
export function WardDetail({
  ward,
  clusters,
  onSelectCluster,
}: {
  ward: WardZone;
  clusters: Cluster[];
  onSelectCluster: (c: Cluster) => void;
}) {
  const totalArea = clusters.reduce((s, c) => s + c.area, 0);
  const totalEnterprises = clusters.reduce((s, c) => s + c.enterprises, 0);
  const avgOccupancy =
    totalArea > 0
      ? Math.round(clusters.reduce((s, c) => s + c.occupancy * c.area, 0) / totalArea)
      : 0;

  const industries = useMemo(() => {
    const set = new Set<string>();
    clusters.forEach((c) =>
      c.sectors
        .split(/[–\-/]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => set.add(s)),
    );
    return [...set];
  }, [clusters]);

  return (
    <div className="gov-card overflow-hidden">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-teal/10 text-teal">
            <MapPin className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
              Tổng quan địa bàn
            </h2>
            <p className="text-xs text-muted-foreground">
              {ward.type === "phuong" ? "Phường" : "Xã"} · trực thuộc tỉnh (chính quyền 2 cấp)
            </p>
          </div>
        </div>
        <span className="rounded-full border border-gov/25 bg-gov/5 px-2.5 py-0.5 text-[11px] font-semibold text-gov">
          {ward.name}
        </span>
      </header>

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi label="KCN/CCN" value={`${clusters.length} cụm`} />
          <Kpi label="Tổng diện tích" value={`${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(totalArea)} ha`} />
          <Kpi label="Doanh nghiệp" value={`${totalEnterprises} DN`} />
          <Kpi label="Lấp đầy BQ" value={`${avgOccupancy}%`} valueClass="text-success" />
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Ngành chủ đạo
          </p>
          <div className="flex flex-wrap gap-1.5">
            {industries.map((s) => (
              <span
                key={s}
                className="rounded-full border border-gov/25 bg-gov/5 px-2 py-0.5 text-[11px] font-medium text-gov"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            KCN/CCN trong vùng — bấm để khoan xuống
          </p>
          <div className="space-y-2">
            {clusters.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectCluster(c)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-left transition-colors hover:border-gov/40 hover:bg-gov/5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-navy">{c.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {c.area} ha · {c.enterprises} DN
                    {c.investor ? ` · ${c.investor}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    c.occupancy >= 75 && "bg-success/10 text-success",
                    c.occupancy >= 50 && c.occupancy < 75 && "bg-gov/10 text-gov",
                    c.occupancy < 50 && "bg-warning/10 text-warning",
                  )}
                >
                  {c.occupancy}%
                </span>
              </button>
            ))}
            {clusters.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                Không có KCN/CCN phù hợp ngành đang chọn trong vùng này.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ClusterDetail({ cluster, factories }: { cluster: Cluster; factories: Factory[] }) {
  return (
    <div className="gov-card overflow-hidden">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-teal/10 text-teal">
            <MapPin className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
              Chi tiết khu/cụm công nghiệp
            </h2>
            <p className="text-xs text-muted-foreground">{cluster.ward} · Tây Ninh</p>
          </div>
        </div>
        <StatusBadge status={cluster.status} />
      </header>

      <div className="space-y-4 p-4">
        <div>
          <h3 className="text-base font-semibold text-navy">{cluster.name}</h3>
          {cluster.investor ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Chủ đầu tư: <span className="font-medium text-navy">{cluster.investor}</span>
            </p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            Ngành thu hút:{" "}
            {cluster.sectors
              .split(/[–\-/]/)
              .map((s) => s.trim())
              .filter(Boolean)
              .map((s) => (
                <span
                  key={s}
                  className="mr-1 inline-block rounded-full border border-gov/25 bg-gov/5 px-2 py-0.5 text-[11px] font-medium text-gov"
                >
                  {s}
                </span>
              ))}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi label="Diện tích" value={`${cluster.area} ha`} />
          <Kpi label="Đã cho thuê" value={`${cluster.leased} ha`} />
          <Kpi label="Doanh nghiệp" value={`${cluster.enterprises} DN`} />
          <Kpi label="Lấp đầy" value={`${cluster.occupancy}%`} valueClass="text-success" />
        </div>

        <div>
          <p className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wide text-muted-foreground">
              Hạ tầng cụm
            </span>
            <span className="text-muted-foreground">Tỷ lệ hoàn thiện</span>
          </p>
          <div className="space-y-2.5">
            {cluster.infrastructure.map((inf) => (
              <div key={inf.name}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-navy">{inf.name}</span>
                  <span className="truncate text-right text-[11px] text-muted-foreground">
                    {inf.note}
                  </span>
                </div>
                <ProgressMetric label="" value={inf.level} barClass={occupancyColor(cluster)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const FACTORY_PAGE_SIZE = 8;

export function FactoryList({
  factories,
  selectedFactoryId,
  onSelectFactory,
  onOpenProfile,
}: {
  factories: Factory[];
  selectedFactoryId: string | null;
  onSelectFactory: (f?: Factory) => void;
  onOpenProfile: (f: Factory) => void;
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(factories.length / FACTORY_PAGE_SIZE);
  const paged = factories.slice(page * FACTORY_PAGE_SIZE, (page + 1) * FACTORY_PAGE_SIZE);

  // Reset về trang 0 khi danh sách thay đổi
  useEffect(() => { setPage(0); }, [factories]);

  return (
    <div className="gov-card overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gov/10 text-gov">
            <FactoryIcon className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
              Doanh nghiệp / nhà máy
            </h2>
            <p className="text-xs text-muted-foreground">
              {factories.length} nhà máy phù hợp ngành đang chọn · bấm để xem trên bản đồ
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-2 p-3">
        {paged.map((f) => {
          const active = f.id === selectedFactoryId;
          return (
            <div
              key={f.id}
              onClick={() => onSelectFactory(f.id === selectedFactoryId ? undefined : f)}
              className={cn(
                "w-full rounded-lg border border-border bg-surface text-left transition-colors hover:border-gov/40",
                active && "border-gov bg-gov/5 ring-1 ring-gov/30",
              )}
            >
              <div className="flex items-start justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-navy">{f.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {f.address} · {f.products}
                  </p>
                </div>
                <span
                  className={cn(
                    "mt-1 size-2.5 shrink-0 rounded-full",
                    f.status === "active" && "bg-success",
                    f.status === "expanding" && "bg-warning",
                    f.status === "suspended" && "bg-border",
                  )}
                  title={FACTORY_STATUS_LABEL[f.status]}
                />
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-border/70 px-3 py-1.5 text-[11px] text-muted-foreground">
                <span>Ngành: {f.sector}</span>
                <span className="flex items-center gap-2">
                  <span>{f.area} ha</span>
                  <span>{f.employees} lao động</span>
                  <span>{f.revenue} tỷ</span>
                </span>
              </div>
              <div className="border-t border-border/70 px-3 py-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-full justify-center gap-1 text-xs text-gov"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenProfile(f);
                  }}
                >
                  Xem hồ sơ chi tiết
                </Button>
              </div>
            </div>
          );
        })}
        {factories.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            Không có doanh nghiệp nào phù hợp ngành đang chọn trong khu này.
          </p>
        ) : null}
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <span>
            Trang {page + 1}/{totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Sau
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Kpi({
  label,
  value,
  valueClass = "text-navy",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-sm font-semibold tabular-nums", valueClass)}>{value}</p>
    </div>
  );
}
