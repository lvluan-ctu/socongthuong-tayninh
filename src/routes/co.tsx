import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@/lib/router-compat";
import {
  FileCheck2,
  Plus,
  BarChart3,
  Globe2,
  Landmark,
  Scale,
  TrendingUp,
  FileText,
  Upload,
  Building2,
  ClipboardCheck,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { ChartCard } from "@/components/common/ChartCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CoApplicationList } from "@/features/co/CoApplicationList";
import { CoApplicationDetail } from "@/features/co/CoApplicationDetail";
import { CoIntegrationPanel } from "@/features/co/CoIntegrationPanel";
import { CoVerificationPanel } from "@/features/co/CoVerificationPanel";
import { CoCatalogPanel } from "@/features/co/CoCatalogPanel";
import { CoReportsPanel } from "@/features/co/CoReportsPanel";
import { CoEnterprisePanel } from "@/features/co/CoEnterprisePanel";
import { CoApplicationFormDrawer } from "@/features/co/CoApplicationFormDrawer";
import { CoSelfAssessmentPanel } from "@/features/co/CoSelfAssessmentPanel";
import {
  computeCoKpis,
  buildCoChartData,
  filterApplications,
  formatCurrency,
  formatNumber,
} from "@/lib/co/co-service";
import { CO_STATUS_LABELS, type CoApplicationStatus } from "@/lib/co/co-types";
import type { CoApplication } from "@/lib/co/co-types";

const CHART_COLORS = [
  "oklch(0.513 0.16 255.7)",
  "oklch(0.566 0.101 182.5)",
  "oklch(0.523 0.135 144.2)",
  "oklch(0.743 0.15 72.1)",
  "oklch(0.539 0.194 26.7)",
  "oklch(0.549 0.162 297.7)",
];

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "oklch(0.554 0.041 257.4)",
  SUBMITTED: "oklch(0.549 0.162 297.7)",
  PROCESSING: "oklch(0.743 0.15 72.1)",
  RETURNED: "oklch(0.7 0.15 55)",
  APPROVED: "oklch(0.523 0.135 144.2)",
  REJECTED: "oklch(0.539 0.194 26.7)",
  ISSUED: "oklch(0.513 0.16 255.7)",
  CANCELLED: "oklch(0.6 0.02 250)",
  DEFAULT: "oklch(0.554 0.041 257.4)",
};

const TAB_VALUES = [
  "ho-so",
  "doanh-nghiep",
  "kiem-tra",
  "danh-muc",
  "dieu-kien",
  "tich-hop",
  "bao-cao",
] as const;
type TabValue = (typeof TAB_VALUES)[number];

export const Route = createFileRoute("/co")({
  head: () => ({
    meta: [
      { title: "Giấy chứng nhận xuất xứ (C/O) | Nền tảng ngành Công Thương" },
      {
        name: "description",
        content:
          "Quản lý Giấy chứng nhận xuất xứ hàng hóa (C/O) — hồ sơ doanh nghiệp, mẫu D, E, AK, VK, AHK, AANZ, X, RCEP theo QĐ 34/2025/QĐ-UBND và TT 40/2025/TT-BCT.",
      },
      { property: "og:title", content: "Giấy chứng nhận xuất xứ (C/O)" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  component: Page,
});

function resolveTab(tab: string | undefined): TabValue {
  return (TAB_VALUES as readonly string[]).includes(tab ?? "") ? (tab as TabValue) : "ho-so";
}

async function fetchApplications(): Promise<CoApplication[]> {
  const res = await fetch("/api/co/applications?options=true");
  if (!res.ok) throw new Error("Không thể tải danh sách hồ sơ C/O");
  const body = (await res.json()) as { items?: CoApplication[] };
  return Array.isArray(body.items) ? body.items : [];
}

function Page() {
  const [selectedApp, setSelectedApp] = useState<CoApplication | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const search = Route.useSearch();
  const navigate = useNavigate();
  const tab = resolveTab(search.tab);

  const { data: apps = [], refetch } = useQuery({
    queryKey: ["co-applications"],
    queryFn: fetchApplications,
    retry: 1,
  });

  const kpis = useMemo(() => computeCoKpis(apps), [apps]);
  const chartData = useMemo(() => buildCoChartData(apps), [apps]);
  const applications = useMemo(() => filterApplications({}, apps), [apps]);

  const handleTabChange = (value: string) => {
    const next = resolveTab(value);
    navigate({
      to: "/co",
      search: next === "ho-so" ? {} : { tab: next },
      replace: true,
    });
  };

  return (
    <>
      <PageHeader
        title="Giấy chứng nhận xuất xứ (C/O)"
        description="Quản lý cấp C/O theo mẫu, theo FTA và hồ sơ doanh nghiệp xuất khẩu — theo QĐ 34/2025/QĐ-UBND và TT 40/2025/TT-BCT"
        crumbs={[{ label: "Nghiệp vụ" }, { label: "C/O" }]}
        variant="panel"
        icon={FileCheck2}
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="size-4" /> Hồ sơ mới
          </Button>
        }
      />

      <div className="space-y-5 p-4 sm:p-6">
        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="ho-so">
              <FileCheck2 className="size-3.5 mr-1.5" /> Hồ sơ C/O
            </TabsTrigger>
            <TabsTrigger value="doanh-nghiep">
              <Building2 className="size-3.5 mr-1.5" /> Doanh nghiệp
            </TabsTrigger>
            <TabsTrigger value="kiem-tra">
              <Scale className="size-3.5 mr-1.5" /> Kiểm tra XX
            </TabsTrigger>
            <TabsTrigger value="danh-muc">
              <Globe2 className="size-3.5 mr-1.5" /> Danh mục & Mẫu
            </TabsTrigger>
            <TabsTrigger value="dieu-kien">
              <ClipboardCheck className="size-3.5 mr-1.5" /> Điều kiện cấp (Điều 5)
            </TabsTrigger>
            <TabsTrigger value="tich-hop">
              <Upload className="size-3.5 mr-1.5" /> Tích hợp eCoSys
            </TabsTrigger>
            <TabsTrigger value="bao-cao">
              <BarChart3 className="size-3.5 mr-1.5" /> Báo cáo
            </TabsTrigger>
          </TabsList>

          {/* ===== HỒ SƠ C/O ===== */}
          <TabsContent value="ho-so" className="mt-4 space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Tổng hồ sơ" value={formatNumber(kpis.totalApplications)} icon={FileText} />
              <StatCard label="Tổng giá trị FOB" value={formatCurrency(kpis.totalValue)} icon={TrendingUp} />
              <StatCard label="Tiết kiệm thuế" value={formatCurrency(kpis.totalSavings)} icon={Scale} />
              <StatCard label="Đang chờ xử lý" value={formatNumber(kpis.pendingCount)} icon={Landmark} />
            </div>

            <div className="space-y-4">
              <ChartCard title="Xu hướng theo tháng" subtitle="Số lượng và giá trị C/O theo tháng">
                {chartData.monthlyTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={chartData.monthlyTrend.map((d) => ({ ...d, label: d.month.slice(5).replace("-", "/") }))}
                      margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.918 0.017 250.8)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "oklch(0.554 0.041 257.4)" }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "oklch(0.554 0.041 257.4)" }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "oklch(0.554 0.041 257.4)" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                      <Tooltip
                        formatter={(value: number, name: string) => (name === "value" ? formatCurrency(value) : value)}
                        labelFormatter={(label) => `Tháng: ${label}`}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Bar yAxisId="left" dataKey="count" name="Số hồ sơ" fill="oklch(0.513 0.16 255.7)" radius={[4, 4, 0, 0]} barSize={28} />
                      <Bar yAxisId="right" dataKey="value" name="Giá trị FOB" fill="oklch(0.566 0.101 182.5)" radius={[4, 4, 0, 0]} barSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-8">Chưa có dữ liệu</p>
                )}
              </ChartCard>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ChartCard title="Phân bổ theo FTA" subtitle="Giá trị FOB theo hiệp định thương mại">
                  {chartData.byFta.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={chartData.byFta.slice(0, 8)} layout="vertical" margin={{ top: 4, right: 8, left: 20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.918 0.017 250.8)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: "oklch(0.554 0.041 257.4)" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                        <YAxis type="category" dataKey="fta" tick={{ fontSize: 10, fill: "oklch(0.554 0.041 257.4)" }} width={60} />
                        <Tooltip
                          formatter={(value: number, name: string) => (name === "value" ? formatCurrency(value) : `${value} hồ sơ`)}
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        />
                        <Bar dataKey="value" name="Giá trị FOB" fill="oklch(0.513 0.16 255.7)" radius={[0, 4, 4, 0]} barSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-8">Chưa có dữ liệu</p>
                  )}
                </ChartCard>

                <ChartCard title="Phân bổ theo nước nhập khẩu" subtitle="Giá trị FOB theo thị trường">
                  {chartData.byCountry.length > 0 ? (
                    <div className="flex items-center gap-4">
                      <div className="h-[180px] w-[180px] shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={chartData.byCountry.slice(0, 6)} dataKey="value" nameKey="country" innerRadius={42} outerRadius={72} paddingAngle={2} strokeWidth={0}>
                              {CHART_COLORS.slice(0, chartData.byCountry.slice(0, 6).length).map((c, i) => <Cell key={i} fill={c} />)}
                            </Pie>
                            <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <ul className="min-w-0 flex-1 space-y-1.5">
                        {chartData.byCountry.slice(0, 6).map((d, i) => {
                          const total = chartData.byCountry.reduce((s, c) => s + c.value, 0);
                          const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
                          return (
                            <li key={d.country} className="flex items-center justify-between gap-2 text-xs">
                              <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                                <span className="size-2 shrink-0 rounded-full" style={{ background: CHART_COLORS[i] }} />
                                <span className="truncate">{d.country}</span>
                              </span>
                              <span className="shrink-0 text-right">
                                <span className="font-medium tabular-nums">{formatCurrency(d.value)}</span>
                                <span className="ml-1 text-[10px] text-muted-foreground">({pct}%)</span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-8">Chưa có dữ liệu</p>
                  )}
                </ChartCard>
              </div>

              <ChartCard title="Trạng thái hồ sơ" subtitle="Phân bổ theo trạng thái xử lý">
                {chartData.byStatus.length > 0 ? (
                  <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center">
                    <div className="h-[180px] w-[180px] shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData.byStatus.map((d) => ({ ...d, label: CO_STATUS_LABELS[d.status as CoApplicationStatus] ?? d.status }))}
                            dataKey="count" nameKey="label" innerRadius={42} outerRadius={72} paddingAngle={2} strokeWidth={0}
                          >
                            {chartData.byStatus.map((d, i) => <Cell key={i} fill={STATUS_COLORS[d.status] ?? STATUS_COLORS.DEFAULT} />)}
                          </Pie>
                          <Tooltip formatter={(value: number, name: string) => [`${value} hồ sơ`, name]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3">
                      {chartData.byStatus.map((d) => {
                        const total = chartData.byStatus.reduce((s, x) => s + x.count, 0);
                        const pct = total > 0 ? ((d.count / total) * 100).toFixed(1) : "0";
                        const label = CO_STATUS_LABELS[d.status as CoApplicationStatus] ?? d.status;
                        return (
                          <li key={d.status} className="flex items-center gap-2 text-xs">
                            <span className="size-2 shrink-0 rounded-full" style={{ background: STATUS_COLORS[d.status] ?? STATUS_COLORS.DEFAULT }} />
                            <span className="font-medium text-navy">{label}</span>
                            <span className="tabular-nums">{d.count}</span>
                            <span className="text-[10px] text-muted-foreground">({pct}%)</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-8">Chưa có dữ liệu</p>
                )}
              </ChartCard>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
                  Hồ sơ C/O
                </h2>
                <span className="text-xs text-muted-foreground">
                  {applications.length} hồ sơ đang quản lý
                </span>
              </div>
              <CoApplicationList
                applications={applications}
                onSelect={(app) => { setSelectedApp(app); setDetailOpen(true); }}
              />
            </div>
          </TabsContent>

          {/* ===== DOANH NGHIỆP ===== */}
          <TabsContent value="doanh-nghiep" className="mt-4">
            <CoEnterprisePanel />
          </TabsContent>

          {/* ===== KIỂM TRA XX & THUẾ ===== */}
          <TabsContent value="kiem-tra" className="mt-4">
            <CoVerificationPanel />
          </TabsContent>

          {/* ===== DANH MỤC & MẪU ===== */}
          <TabsContent value="danh-muc" className="mt-4">
            <CoCatalogPanel />
          </TabsContent>

          {/* ===== ĐIỀU KIỆN CẤP (ĐIỀU 5) ===== */}
          <TabsContent value="dieu-kien" className="mt-4">
            <CoSelfAssessmentPanel />
          </TabsContent>

          {/* ===== TÍCH HỢP ===== */}
          <TabsContent value="tich-hop" className="mt-4">
            <CoIntegrationPanel />
          </TabsContent>

          {/* ===== BÁO CÁO ===== */}
          <TabsContent value="bao-cao" className="mt-4">
            <CoReportsPanel />
          </TabsContent>
        </Tabs>
      </div>

      <CoApplicationDetail
        open={detailOpen}
        onOpenChange={(v) => { setDetailOpen(v); if (!v) setSelectedApp(null); }}
        application={selectedApp}
        onUpdated={(app) => {
          setSelectedApp(app);
          void refetch();
        }}
      />

      <CoApplicationFormDrawer
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={() => void refetch()}
      />
    </>
  );
}
