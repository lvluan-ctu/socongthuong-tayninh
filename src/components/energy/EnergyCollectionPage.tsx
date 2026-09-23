import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatCard, type Tone } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import {
  EnergyEmpty,
  EnergyError,
  EnergyLoading,
  EntityDetailDrawer,
} from "@/components/energy/EnergyShared";

export interface EnergyKpiDef {
  label: string;
  value: string | number;
  delta?: string;
  tone?: Tone;
  icon?: LucideIcon;
}

export function EnergyCollectionPage<T extends { id: string }>({
  title,
  description,
  icon,
  queryKey,
  queryFn,
  columns,
  searchPlaceholder,
  kpis,
  drawerTitle,
  renderDetail,
  initialSelectedId,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  queryKey: unknown[];
  queryFn: () => Promise<T[]>;
  columns: Column<T>[];
  searchPlaceholder: string;
  kpis?: (rows: T[]) => EnergyKpiDef[];
  drawerTitle: string;
  renderDetail: (row: T) => ReactNode;
  initialSelectedId?: string | null;
  children?: ReactNode;
}) {
  const [selected, setSelected] = useState<T | null>(null);
  const query = useQuery({ queryKey, queryFn });

  useEffect(() => {
    if (!initialSelectedId || selected || !query.data?.length) return;
    const match = query.data.find((row) => row.id === initialSelectedId);
    if (match) setSelected(match);
  }, [initialSelectedId, query.data, selected]);

  if (query.isLoading) return <EnergyLoading />;
  if (query.isError) return <EnergyError onRetry={() => void query.refetch()} />;

  const rows = query.data ?? [];
  const stats = kpis?.(rows) ?? [];

  const exportCsv = () => {
    if (!rows.length) {
      toast.info("Không có dữ liệu để xuất.");
      return;
    }
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      columns.map((c) => c.header).join(","),
      ...rows.map((row) =>
        columns
          .map((c) => esc(c.value ? c.value(row) : (row as Record<string, unknown>)[c.key]))
          .join(","),
      ),
    ];
    const blob = new Blob([`\ufeff${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Đã xuất ${rows.length} bản ghi ra file CSV.`);
  };

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        crumbs={[{ label: "Nguồn năng lượng tái tạo", to: "/energy" }, { label: title }]}
        variant="panel"
        icon={icon}
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="size-4" /> Export
          </Button>
        }
      />
      <div className="space-y-4 p-6">
        {stats.length ? (
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {stats.map((item) => (
              <StatCard
                key={item.label}
                label={item.label}
                value={item.value}
                delta={item.delta}
                tone={item.tone}
                icon={item.icon}
              />
            ))}
          </section>
        ) : null}
        {children}
        {rows.length ? (
          <DataTable
            columns={columns}
            rows={rows}
            searchPlaceholder={searchPlaceholder}
            onRowClick={setSelected}
          />
        ) : (
          <EnergyEmpty />
        )}
      </div>
      <EntityDetailDrawer
        open={!!selected}
        onOpenChange={(value) => !value && setSelected(null)}
        title={drawerTitle}
        description={
          selected ? ("name" in selected ? String(selected.name) : selected.id) : undefined
        }
      >
        {selected ? renderDetail(selected) : null}
      </EntityDetailDrawer>
    </>
  );
}
