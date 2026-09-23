import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Cable,
  Clock,
  Cloud,
  Database,
  Factory,
  Gauge,
  Leaf,
  Map as MapIcon,
  PlugZap,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { ChartCard } from "@/components/common/ChartCard";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatCard, TONE_BG, TONE_TEXT, type Tone } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EnergyEmpty,
  EnergyError,
  EnergyFilterBar,
  EnergyLoading,
  EnergyStatusBadge,
  EntityDetailDrawer,
  FieldGrid,
  ModulePreviewGrid,
  ENERGY_DISTRICTS,
  ENERGY_MODULES,
  ENERGY_PERIODS,
} from "@/components/energy/EnergyShared";
import { EnergyAiPanel, type EnergyAiFocus } from "@/components/energy/EnergyAiPanel";
import { EnergyMap } from "@/components/energy/EnergyMap";
import { OVERVIEW_GIS_CHROME_CONFIG, OVERVIEW_GIS_LAYER_OPTIONS } from "@/config/overview-gis";
import { getEnergyDashboard } from "@/lib/energy-service";
import type { PowerProject, Substation } from "@/lib/energy-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/energy")({
  head: () => ({
    meta: [
      { title: "Tổng quan năng lượng | Nền tảng ngành Công Thương" },
      {
        name: "description",
        content:
          "Dashboard tổng quan phân hệ Nguồn năng lượng tái tạo: nguồn điện, lưới điện, phụ tải, NLTT, an toàn lưới, carbon và trạm sạc.",
      },
    ],
  }),
  component: Page,
});

const CHART_COLORS = ["#1565C0", "#1976D2", "#00897B", "#2E7D32", "#E59A23", "#7C3AED"];
const INCIDENT_COLORS = {
  severe: "#C62828",
  high: "#E59A23",
  medium: "#F2C94C",
  resolved: "#2E7D32",
};

function Page() {
  const [period, setPeriod] = useState(ENERGY_PERIODS[0]!);
  const [district, setDistrict] = useState(ENERGY_DISTRICTS[0]!);
  const [chartMode, setChartMode] = useState("month");
  const [selectedSubstation, setSelectedSubstation] = useState<Substation | null>(null);
  const [selectedProject, setSelectedProject] = useState<PowerProject | null>(null);
  const [aiFocus, setAiFocus] = useState<EnergyAiFocus | null>(null);

  const dashboardQuery = useQuery({
    queryKey: ["energy", "overview", period, district],
    queryFn: getEnergyDashboard,
  });

  const isLoading = dashboardQuery.isLoading;
  const hasError = dashboardQuery.isError;

  const refetchAll = () => {
    void dashboardQuery.refetch();
    toast.success("Đã làm mới dữ liệu năng lượng");
  };

  const dashboard = dashboardQuery.data;
  const overview = dashboard?.overview;
  const gisData = dashboard?.gis;

  const scopedSubstations = useMemo(
    () =>
      filterByDistrict(dashboard?.substations ?? [], district).sort(
        (a, b) => (b.loadFactor ?? 0) - (a.loadFactor ?? 0),
      ),
    [dashboard?.substations, district],
  );
  const scopedProjects = useMemo(
    () => filterByDistrict(dashboard?.projects ?? [], district),
    [dashboard?.projects, district],
  );
  const outputData = useMemo(() => {
    if (!overview) return [];
    if (chartMode === "quarter") {
      return overview.outputByQuarter;
    }
    if (chartMode === "year") {
      return overview.outputByYear;
    }
    return overview.outputComparison;
  }, [chartMode, overview]);

  if (isLoading) return <EnergyLoading />;
  if (hasError || !overview || !gisData) return <EnergyError onRetry={refetchAll} />;

  const totalIncidents = overview.incidentBreakdown.reduce((sum, item) => sum + item.value, 0);
  const overloadedLineCount = gisData.lines.filter(
    (line) =>
      (line.capacityMw ?? 0) > 0 && ((line.actualLoadMw ?? 0) / (line.capacityMw ?? 1)) * 100 >= 90,
  ).length;
  const warningLineCount = gisData.lines.filter((line) => {
    const load =
      (line.capacityMw ?? 0) > 0 ? ((line.actualLoadMw ?? 0) / (line.capacityMw ?? 1)) * 100 : 0;
    return load >= 80 && load < 90;
  }).length;

  const mapSelectedKey = aiFocus?.kind === "substation" ? `substation:${aiFocus.id}` : null;
  const mapSelectedLineKey = aiFocus?.kind === "line" ? aiFocus.id : null;

  return (
    <>
      <PageHeader
        title="Tổng quan năng lượng"
        description="Quản lý toàn diện dữ liệu năng lượng: Nguồn điện - Lưới điện - Phụ tải - Năng lượng tái tạo - Tiết kiệm năng lượng - An toàn lưới điện - Phát thải carbon - Trạm sạc điện"
        crumbs={[{ label: "Nguồn năng lượng tái tạo" }, { label: "Tổng quan năng lượng" }]}
        variant="panel"
        icon={Zap}
        actions={
          <EnergyFilterBar
            period={period}
            district={district}
            onPeriodChange={setPeriod}
            onDistrictChange={setDistrict}
            onRefresh={refetchAll}
          />
        }
      />

      <div className="space-y-5 p-4 sm:p-6">
        {/* 1. Bản đồ GIS năng lượng */}
        <section className="rounded-2xl border border-teal/25 bg-teal/[0.08] p-3 sm:p-4">
          <section className="gov-card overflow-hidden">
            <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-gov/10 text-gov">
                <MapIcon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
                  Bản đồ GIS năng lượng
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Dữ liệu PostGIS thực tế; tuyến tải cao và điểm sự cố được làm nổi bật tự động.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Link
                  to={"/energy/nhiem-vu-1" as never}
                  className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 font-semibold text-destructive hover:bg-destructive/15"
                >
                  <span className="size-2 animate-pulse rounded-full bg-destructive" />
                  {overloadedLineCount} tuyến ≥ 90%
                </Link>
                <Link
                  to={"/energy/nhiem-vu-1" as never}
                  className="inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 font-semibold text-warning hover:bg-warning/15"
                >
                  {warningLineCount} tuyến 80–90%
                </Link>
                <Link
                  to={"/energy/nhiem-vu-5" as never}
                  className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-navy/5 px-2.5 py-1 font-semibold text-navy hover:bg-navy/10"
                >
                  {overview.kpis.incidentsActive} cảnh báo địa bàn
                </Link>
              </div>
            </header>
            <div>
              <EnergyMap
                data={gisData}
                height={580}
                layerOptions={OVERVIEW_GIS_LAYER_OPTIONS}
                mapChrome={OVERVIEW_GIS_CHROME_CONFIG}
                selectedKey={mapSelectedKey}
                selectedLineKey={mapSelectedLineKey}
              />
            </div>
          </section>
        </section>

        {/* 2. Dữ liệu & thống kê năng lượng */}
        <section className="rounded-2xl border border-navy/15 bg-navy/[0.05] p-3 sm:p-4">
          <SectionHeading
            icon={Database}
            title="Dữ liệu & thống kê năng lượng"
            subtitle="Tổng hợp các chỉ số, cơ cấu và tình hình vận hành từ dữ liệu năng lượng."
          />
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_290px]">
            <div className="space-y-4">
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MissionStatCard
                  to="/energy/nhiem-vu-2"
                  label="Tổng công suất nguồn"
                  value={`${fmt(overview.kpis.totalCapacityMw)} MW`}
                  delta={`${overview.kpis.projects} dự án · ${overview.kpis.projectOperating} đang vận hành`}
                  icon={Factory}
                  tone="gov"
                />
                <MissionStatCard
                  to="/energy/nhiem-vu-2"
                  label="Sản lượng điện"
                  value={`${fmt(overview.kpis.electricityOutputGwh)} GWh`}
                  delta="Tổng hợp 12 kỳ dữ liệu gần nhất"
                  icon={Zap}
                  tone="gov"
                />
                <MissionStatCard
                  to="/energy/nhiem-vu-2"
                  label="Tỷ lệ NLTT"
                  value={`${overview.kpis.renewableRatioPct}%`}
                  delta="Theo công suất nguồn đã quản lý"
                  icon={Leaf}
                  tone="success"
                />
                <MissionStatCard
                  to="/energy/nhiem-vu-1"
                  label="Trạm biến áp"
                  value={overview.kpis.substations}
                  delta={`${fmt(overview.kpis.gridLengthKm)} km đường dây`}
                  icon={Cable}
                  tone="teal"
                />
                <MissionStatCard
                  to="/energy/nhiem-vu-1"
                  label="Đường dây ≥ 90% tải"
                  value={overview.kpis.overloadedLines}
                  delta={`${overview.kpis.overloadedSubstations} trạm đang quá tải`}
                  icon={AlertTriangle}
                  tone="danger"
                />
                <MissionStatCard
                  to="/energy/nhiem-vu-5"
                  label="Cảnh báo đang xử lý"
                  value={overview.kpis.incidentsActive}
                  delta="Sự cố và vi phạm hành lang"
                  icon={ShieldAlert}
                  tone="danger"
                />
                <MissionStatCard
                  to="/energy/nhiem-vu-6"
                  label="Phát thải CO2e"
                  value={`${fmt(overview.kpis.co2eTons)} tấn`}
                  delta="Từ hoạt động phát thải đã ghi nhận"
                  icon={Cloud}
                  tone="analytics"
                />
                <MissionStatCard
                  to="/energy/nhiem-vu-7"
                  label="Trạm sạc điện"
                  value={overview.kpis.chargingStations}
                  delta="Trạm có hồ sơ vận hành trong CSDL"
                  icon={PlugZap}
                  tone="success"
                />
              </section>

              <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <ChartCard title="Cơ cấu nguồn điện theo công suất">
                  <div className="grid min-h-64 grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                    <div className="relative min-h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={overview.sourceMix}
                            dataKey="capacityMw"
                            nameKey="name"
                            innerRadius="58%"
                            outerRadius="94%"
                            paddingAngle={2}
                            strokeWidth={1}
                          >
                            {overview.sourceMix.map((item, index) => (
                              <Cell
                                key={item.name}
                                fill={CHART_COLORS[index % CHART_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) => [`${fmt(value)} MW`, "Công suất"]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                        <div>
                          <p className="text-2xl font-bold text-navy">
                            {fmt(overview.kpis.totalCapacityMw)}
                          </p>
                          <p className="text-xs font-semibold uppercase text-muted-foreground">
                            MW
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col justify-center gap-2">
                      {overview.sourceMix.map((item, index) => {
                        const pct = (item.capacityMw / overview.kpis.totalCapacityMw) * 100;
                        return (
                          <p
                            key={item.name}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span
                                className="size-2.5 rounded-sm"
                                style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
                              />
                              <span className="truncate text-navy">{item.name}</span>
                            </span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                              {fmt(item.capacityMw)} MW ({pct.toFixed(1)}%)
                            </span>
                          </p>
                        );
                      })}
                    </div>
                  </div>
                </ChartCard>

                <ChartCard
                  title="Sản lượng điện (GWh)"
                  actions={
                    <Select value={chartMode} onValueChange={setChartMode}>
                      <SelectTrigger className="h-8 w-[120px] bg-card text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="month">Theo tháng</SelectItem>
                        <SelectItem value="quarter">Theo quý</SelectItem>
                        <SelectItem value="year">Theo năm</SelectItem>
                      </SelectContent>
                    </Select>
                  }
                >
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={outputData} margin={{ left: -18, right: 12, top: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
                      <YAxis tickLine={false} axisLine={false} fontSize={11} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="previous"
                        name="Kỳ trước"
                        stroke="#1565C0"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="current"
                        name="Kỳ ghi nhận"
                        stroke="#00897B"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Tiêu thụ điện (GWh)"
                  actions={
                    <Select defaultValue="sector">
                      <SelectTrigger className="h-8 w-[140px] bg-card text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sector">Theo lĩnh vực</SelectItem>
                        <SelectItem value="district">Theo địa bàn</SelectItem>
                      </SelectContent>
                    </Select>
                  }
                >
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={overview.consumptionBySector}
                      margin={{ left: -18, right: 12, top: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="sector"
                        tickLine={false}
                        axisLine={false}
                        fontSize={10}
                        interval={0}
                      />
                      <YAxis tickLine={false} axisLine={false} fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="value" name="Tiêu thụ" fill="#1565C0" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </section>

              <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                <ChartCard
                  title="Top 5 trạm biến áp tải cao"
                  actions={
                    <Button asChild variant="ghost" size="sm" className="text-gov">
                      <Link to={"/energy/nhiem-vu-1" as never}>Xem nhiệm vụ</Link>
                    </Button>
                  }
                >
                  <SimpleSubstationTable
                    rows={scopedSubstations.slice(0, 5)}
                    onSelect={setSelectedSubstation}
                  />
                </ChartCard>

                <ChartCard
                  title="Dự án nổi bật"
                  actions={
                    <Button asChild variant="ghost" size="sm" className="text-gov">
                      <Link to={"/energy/nhiem-vu-2" as never}>Xem nhiệm vụ</Link>
                    </Button>
                  }
                >
                  <ProjectTable rows={scopedProjects.slice(0, 5)} onSelect={setSelectedProject} />
                </ChartCard>

                <ChartCard
                  title="Tình hình sự cố"
                  className="lg:col-span-2 xl:col-span-1"
                  actions={
                    <Button asChild variant="ghost" size="sm" className="text-gov">
                      <Link to={"/energy/nhiem-vu-5" as never}>Xem nhiệm vụ</Link>
                    </Button>
                  }
                >
                  <div className="relative h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={overview.incidentBreakdown}
                          dataKey="value"
                          innerRadius={46}
                          outerRadius={72}
                        >
                          {overview.incidentBreakdown.map((item) => (
                            <Cell key={item.severity} fill={INCIDENT_COLORS[item.severity]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                      <div>
                        <p className="text-2xl font-bold text-navy">{totalIncidents}</p>
                        <p className="text-xs text-muted-foreground">Tổng số</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {overview.incidentBreakdown.map((item) => (
                      <button
                        key={item.severity}
                        type="button"
                        onClick={() => toast.info(`Đã lọc nhóm sự cố: ${item.label}`)}
                        className="flex items-center justify-between rounded-md border border-border px-2 py-1 text-xs hover:bg-surface"
                      >
                        <span>{item.label}</span>
                        <span className="font-semibold text-navy">{item.value}</span>
                      </button>
                    ))}
                  </div>
                </ChartCard>
              </section>
            </div>

            <aside className="hidden space-y-2 2xl:block">
              <div className="gov-card overflow-hidden">
                <h2 className="bg-navy px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-white">
                  Các module chính
                </h2>
                <div className="divide-y divide-border">
                  {ENERGY_MODULES.map((item, index) => (
                    <Link
                      key={item.to}
                      to={item.to as never}
                      className={cn(
                        "flex gap-3 px-3 py-3 transition-colors hover:bg-surface",
                        item.to === "/energy" && "bg-gov/5",
                      )}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-gov/20 bg-gov/10 text-gov">
                        <item.icon className="size-5" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-navy">
                          {index + 1}. {item.label}
                        </span>
                        <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </section>

        {/* 2b. Giám sát vận hành từ dữ liệu thực */}
        <section className="rounded-2xl border border-navy/15 bg-navy/[0.05] p-3 sm:p-4">
          <SectionHeading
            icon={ShieldCheck}
            title="Giám sát vận hành và độ phủ dữ liệu"
            subtitle="Tổng hợp trực tiếp từ snapshot vận hành, báo cáo theo kỳ và các cảnh báo đang mở trong cơ sở dữ liệu."
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Tải lưới bình quân"
              value={`${fmt(overview.operationalTrend.at(-1)?.averageLoadPct ?? 0)}%`}
              delta={`Kỳ ${overview.operationalTrend.at(-1)?.period ?? overview.dataFreshness.latestPeriod}`}
              icon={Gauge}
              tone="gov"
            />
            <StatCard
              label="Điểm tải rủi ro"
              value={overview.operationalTrend.at(-1)?.riskCount ?? 0}
              delta="Snapshot có mức tải từ 80% trở lên"
              icon={Clock}
              tone="warning"
            />
            <StatCard
              label="Cảnh báo vận hành mở"
              value={overview.dataFreshness.activeAlerts}
              delta="Có thể truy vết nguyên nhân và khuyến nghị"
              icon={ShieldAlert}
              tone="danger"
            />
            <StatCard
              label="Quan sát đã tổng hợp"
              value={overview.dataFreshness.observations.toLocaleString("vi-VN")}
              delta={`${overview.dataFreshness.mappedLocations.toLocaleString("vi-VN")} vị trí có tọa độ GIS`}
              icon={Database}
              tone="analytics"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard
              title="Xu hướng mức tải và điểm rủi ro"
              subtitle="Tải bình quân (%) và số snapshot có mức tải từ 80% trở lên theo tháng."
              actions={
                <Button asChild variant="ghost" size="sm" className="text-gov">
                  <Link to={"/energy/nhiem-vu-1" as never}>Xem nhiệm vụ</Link>
                </Button>
              }
            >
              <ResponsiveContainer width="100%" height={240}>
                <LineChart
                  data={overview.operationalTrend}
                  margin={{ left: -14, right: 0, top: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="period" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis
                    yAxisId="load"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    width={44}
                    domain={[0, 120]}
                  />
                  <YAxis
                    yAxisId="risk"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    width={44}
                    allowDecimals={false}
                  />
                  <Tooltip />
                  <Line
                    yAxisId="load"
                    type="monotone"
                    dataKey="averageLoadPct"
                    name="Tải bình quân (%)"
                    stroke="#1565C0"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    yAxisId="risk"
                    type="monotone"
                    dataKey="riskCount"
                    name="Điểm tải rủi ro"
                    stroke="#C62828"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Độ phủ dữ liệu nghiệp vụ"
              subtitle="Số bản ghi thực tế đã được nạp vào database và đang được dashboard tổng hợp."
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {overview.monitoringIndicators.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-md border border-border bg-surface px-3 py-2.5"
                  >
                    <p className="text-lg font-bold tabular-nums text-gov">{item.value}</p>
                    <p className="mt-0.5 text-xs font-medium text-navy">{item.label}</p>
                    {item.detail ? (
                      <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                        {item.detail}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>
        </section>

        {/* 3. AI phân tích & dự báo */}
        <section className="rounded-2xl border border-analytics/30 bg-analytics/[0.08] p-3 sm:p-4">
          <EnergyAiPanel
            focusKey={aiFocus ? `${aiFocus.kind}:${aiFocus.id}` : null}
            onFocusEntity={setAiFocus}
          />
        </section>

        <ModulePreviewGrid />

        <section className="rounded-lg border border-dashed border-teal/60 bg-card px-5 py-4">
          <h2 className="mb-3 text-center text-sm font-semibold uppercase tracking-wide text-navy">
            Giá trị phân hệ mang lại
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            {[
              "Quản lý toàn diện dữ liệu năng lượng trên nền tảng số & GIS",
              "Hỗ trợ ra quyết định nhanh chóng, chính xác dựa trên dữ liệu",
              "Giám sát vận hành, cảnh báo sớm quá tải & sự cố",
              "Thúc đẩy phát triển năng lượng tái tạo, giảm phát thải carbon",
              "Minh bạch thông tin, phục vụ quản lý điều hành hiệu quả",
            ].map((item) => (
              <p
                key={item}
                className="rounded-md bg-surface px-3 py-2 text-center text-xs font-medium text-navy"
              >
                {item}
              </p>
            ))}
          </div>
        </section>
      </div>

      <EntityDetailDrawer
        open={!!selectedSubstation}
        onOpenChange={(value) => !value && setSelectedSubstation(null)}
        title="Hồ sơ trạm biến áp"
        description={selectedSubstation?.name}
      >
        {selectedSubstation ? <SubstationDetail item={selectedSubstation} /> : null}
      </EntityDetailDrawer>

      <EntityDetailDrawer
        open={!!selectedProject}
        onOpenChange={(value) => !value && setSelectedProject(null)}
        title="Hồ sơ dự án nguồn điện"
        description={selectedProject?.name}
      >
        {selectedProject ? <ProjectDetail item={selectedProject} /> : null}
      </EntityDetailDrawer>
    </>
  );
}

function MissionStatCard({
  to,
  label,
  value,
  delta,
  icon,
  tone,
}: {
  to: string;
  label: string;
  value: string | number;
  delta: string;
  icon: LucideIcon;
  tone: Tone;
}) {
  return (
    <Link
      to={to as never}
      className="group block rounded-[0.625rem] outline-none focus-visible:ring-2 focus-visible:ring-gov/50"
      aria-label={`${label}: ${value}. Mở nhiệm vụ liên quan`}
    >
      <div className="transition-transform group-hover:-translate-y-0.5 group-hover:shadow-panel">
        <StatCard
          label={label}
          value={value}
          delta={`${delta} · Xem nhiệm vụ →`}
          icon={icon}
          tone={tone}
        />
      </div>
    </Link>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  subtitle,
  tone = "gov",
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  tone?: Tone;
}) {
  return (
    <header className="mb-3 flex items-center gap-3">
      <span
        className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", TONE_BG[tone])}
      >
        <Icon className={cn("size-5", TONE_TEXT[tone])} strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
    </header>
  );
}

function filterByDistrict<T extends { district?: string }>(rows: T[], district: string) {
  if (district === "Toàn tỉnh") return rows;
  return rows.filter((row) => row.district === district);
}

function fmt(value: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value);
}

function loadColor(value = 0) {
  if (value >= 120) return "text-destructive";
  if (value >= 100) return "text-warning";
  return "text-success";
}

function SimpleSubstationTable({
  rows,
  onSelect,
}: {
  rows: Substation[];
  onSelect: (row: Substation) => void;
}) {
  if (!rows.length) return <EnergyEmpty title="Chưa có dữ liệu trạm biến áp" />;
  const columns: Column<Substation>[] = [
    { key: "name", header: "Trạm biến áp", sortable: true },
    { key: "voltageLevel", header: "Cấp điện áp", sortable: true },
    {
      key: "loadFactor",
      header: "Mức tải",
      sortable: true,
      value: (row) => row.loadFactor ?? 0,
      render: (row) => (
        <span className={cn("font-semibold tabular-nums", loadColor(row.loadFactor))}>
          {row.loadFactor ?? 0}%
        </span>
      ),
    },
    {
      key: "ratio",
      header: "Hệ số tải",
      value: (row) => (row.loadFactor ?? 0) / 100,
      render: (row) => (
        <span className={cn("font-semibold tabular-nums", loadColor(row.loadFactor))}>
          {((row.loadFactor ?? 0) / 100).toFixed(2)}
        </span>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      onRowClick={onSelect}
      searchable={false}
      paginated={false}
    />
  );
}

function ProjectTable({
  rows,
  onSelect,
}: {
  rows: PowerProject[];
  onSelect: (row: PowerProject) => void;
}) {
  if (!rows.length) return <EnergyEmpty title="Chưa có dữ liệu dự án" />;
  const columns: Column<PowerProject>[] = [
    { key: "name", header: "Dự án", sortable: true },
    { key: "type", header: "Loại nguồn", sortable: true },
    {
      key: "designCapacityMw",
      header: "Công suất",
      sortable: true,
      value: (row) => row.designCapacityMw ?? 0,
      render: (row) => (
        <span className="font-semibold tabular-nums">{row.designCapacityMw ?? 0} MW</span>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (row) => <EnergyStatusBadge status={row.status} />,
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      onRowClick={onSelect}
      searchable={false}
      paginated={false}
    />
  );
}

function SubstationDetail({ item }: { item: Substation }) {
  return (
    <div className="space-y-4">
      <EnergyStatusBadge status={item.status} />
      <FieldGrid
        items={[
          { label: "Mã trạm", value: item.code },
          { label: "Loại trạm", value: item.type },
          { label: "Cấp điện áp", value: item.voltageLevel },
          { label: "Địa chỉ", value: item.address },
          { label: "Đơn vị quản lý", value: item.operator },
          { label: "Công suất thiết kế", value: `${item.designCapacity ?? 0} MVA` },
          { label: "Công suất vận hành", value: `${item.operatingCapacity ?? 0} MVA` },
          { label: "Khả năng mang tải", value: `${item.availableCapacity ?? 0} MVA` },
          { label: "Hệ số tải", value: `${item.loadFactor ?? 0}%` },
          { label: "Số MBA", value: item.transformerCount },
          { label: "Loại MBA", value: item.transformerType },
          { label: "Khu vực cấp điện", value: item.supplyArea },
          {
            label: "Tọa độ",
            value:
              item.latitude && item.longitude ? `${item.latitude}, ${item.longitude}` : undefined,
          },
        ]}
      />
    </div>
  );
}

function ProjectDetail({ item }: { item: PowerProject }) {
  return (
    <div className="space-y-4">
      <EnergyStatusBadge status={item.status} />
      <FieldGrid
        items={[
          { label: "Mã dự án", value: item.code },
          { label: "Loại nguồn", value: item.type },
          { label: "Công suất", value: `${item.designCapacityMw ?? 0} MW` },
          { label: "Công suất thực tế", value: `${item.actualOutputMw ?? 0} MW` },
          { label: "Sản lượng", value: `${item.outputGWh ?? 0} GWh` },
          { label: "Chủ đầu tư", value: item.investor },
          { label: "Trạm đấu nối", value: item.substationCode },
          { label: "Điện áp", value: item.gridVoltage },
          { label: "Địa bàn", value: item.district },
          {
            label: "Tọa độ",
            value:
              item.latitude && item.longitude ? `${item.latitude}, ${item.longitude}` : undefined,
          },
        ]}
      />
    </div>
  );
}
