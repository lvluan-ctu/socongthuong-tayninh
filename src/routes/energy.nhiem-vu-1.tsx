import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BrainCircuit,
  Cable,
  Database,
  LayoutDashboard,
  MapPinned,
  Network,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EnergyError, EnergyLoading } from "@/components/energy/EnergyShared";
import { EnergyReportExport } from "@/components/grid/EnergyReportExport";
import { GridAIPanel } from "@/components/grid/GridAIPanel";
import { GridAiForecast } from "@/components/grid/GridAiForecast";
import { GridCharts } from "@/components/grid/GridCharts";
import { GridEntityDrawer } from "@/components/grid/GridEntityDrawer";
import { GridKpiRow } from "@/components/grid/GridKpiRow";
import { GridMap, entityKey } from "@/components/grid/GridMap";
import type { GridEntity, GridMode } from "@/components/grid/GridMap";
import { GridTables } from "@/components/grid/GridTables";
import { NewLoadPointTool } from "@/components/grid/NewLoadPointTool";
import { RenewableAbsorptionPanel } from "@/components/grid/RenewableAbsorptionPanel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getTask1GridData, refreshTask1GridData } from "@/lib/grid-service";
import { createFileRoute, Link } from "@/lib/router-compat";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/energy/nhiem-vu-1")({
  head: () => ({ meta: [{ title: "Nhiệm vụ 1 | Năng lượng" }] }),
  component: Page,
});

type TabKey = "overview" | "ai";

const MAP_MODES: Array<{
  id: GridMode;
  label: string;
  description: string;
  icon: typeof Network;
}> = [
  { id: "all", label: "Tổng hợp", description: "Tất cả lớp dữ liệu", icon: LayoutDashboard },
  { id: "station", label: "Trạm điện", description: "Trạm biến áp", icon: Network },
  { id: "grid", label: "Lưới điện", description: "Tuyến, cột và vùng GIS", icon: Cable },
];

function Page() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [mode, setMode] = useState<GridMode>("all");
  const [selected, setSelected] = useState<GridEntity | null>(null);
  const query = useQuery({
    queryKey: ["grid", "task-1", "dashboard"],
    queryFn: () => {
      refreshTask1GridData();
      return getTask1GridData();
    },
    staleTime: 60_000,
    refetchOnMount: "always",
  });

  if (query.isLoading) return <EnergyLoading />;
  if (query.isError || !query.data) return <EnergyError onRetry={() => void query.refetch()} />;

  const data = query.data;
  const provenance = data.provenance;

  const handleRefresh = async () => {
    refreshTask1GridData();
    await query.refetch();
  };

  return (
    <div className="min-h-full bg-surface">
      <PageHeader
        title="Nhiệm vụ 1: Quản lý lưới điện và trạm biến áp"
        description="Theo dõi vận hành, khả năng mang tải, nguồn năng lượng tái tạo đấu nối và dữ liệu từ hệ thống GIS."
        variant="panel"
        icon={MapPinned}
        crumbs={[{ label: "Năng lượng", to: "/energy" }, { label: "Nhiệm vụ 1" }]}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleRefresh()}
              disabled={query.isFetching}
            >
              <RefreshCw className={cn("size-4", query.isFetching && "animate-spin")} />
              Cập nhật
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/energy/nhiem-vu-1/ai">
                <BrainCircuit className="size-4" />
                Dự báo AI
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/energy/nhiem-vu-1/quan-ly">
                <Settings2 className="size-4" />
                Quản lý dữ liệu
              </Link>
            </Button>
          </>
        }
      />

      <main className="space-y-4 px-2 pb-8 sm:px-4 lg:px-6">
        <section className="flex flex-wrap items-center gap-3 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm">
          <Database className="size-5 shrink-0 text-success" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-navy">
              Dữ liệu dashboard được truy vấn từ cơ sở dữ liệu
            </p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              {provenance
                ? `${provenance.measurements.toLocaleString("vi-VN")} phép đo · ${provenance.gisPositions.toLocaleString("vi-VN")} vị trí GIS · ${provenance.operatingSnapshots.toLocaleString("vi-VN")} snapshot vận hành · ${provenance.planningAssets.toLocaleString("vi-VN")} tài sản quy hoạch.`
                : "hệ thống GIS là nguồn dữ liệu duy nhất của các thành phần trên trang."}
            </p>
          </div>
          {provenance?.latestMeasurementAt ? (
            <span className="text-xs text-muted-foreground">
              Phép đo mới nhất: {new Date(provenance.latestMeasurementAt).toLocaleString("vi-VN")}
            </span>
          ) : null}
        </section>

        <GridKpiRow overview={data.overview} />

        <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="overview" className="gap-1.5">
                <LayoutDashboard className="size-4" /> Tổng quan vận hành
              </TabsTrigger>
              <TabsTrigger value="ai" className="gap-1.5">
                <BrainCircuit className="size-4" /> Dự báo &amp; đề xuất AI
              </TabsTrigger>
            </TabsList>
            {tab === "overview" ? (
              <div className="flex rounded-lg border border-border bg-card p-1">
                {MAP_MODES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    title={item.description}
                    onClick={() => setMode(item.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      mode === item.id
                        ? "bg-gov text-white shadow-sm"
                        : "text-muted-foreground hover:bg-surface hover:text-navy",
                    )}
                  >
                    <item.icon className="size-3.5" /> {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <TabsContent value="overview" className="space-y-4">
            <section className="space-y-4">
              <GridMap
                data={data}
                mode={mode}
                selectedKey={selected ? entityKey(selected) : null}
                onSelectEntity={setSelected}
                height={720}
              />
              <GridAIPanel warnings={data.warnings} onOpenAi={() => setTab("ai")} />
            </section>

            <GridCharts
              substations={data.substations}
              lines={data.lines}
              history={data.loadHistory ?? []}
            />

            <section className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
              <RenewableAbsorptionPanel substations={data.substations} lines={data.lines} />
              <NewLoadPointTool substations={data.substations} />
            </section>

            <GridTables
              substations={data.substations}
              lines={data.lines}
              poles={data.poles}
              planned={data.planned}
              onSelect={setSelected}
            />

            <EnergyReportExport />
          </TabsContent>

          <TabsContent value="ai" className="space-y-4">
            <GridAiForecast
              substations={data.substations}
              lines={data.lines}
              loadAreas={data.loadAreas}
            />
            <section className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
              <RenewableAbsorptionPanel substations={data.substations} lines={data.lines} />
              <NewLoadPointTool substations={data.substations} />
            </section>
          </TabsContent>
        </Tabs>
      </main>

      <GridEntityDrawer entity={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
