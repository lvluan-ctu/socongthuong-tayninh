import { useMemo, useState } from "react";
import { createFileRoute } from "@/lib/router-compat";
import {
  Building2,
  Plus,
  BarChart3,
  MapPin,
  Factory,
  Gauge,
  TrendingUp,
  FileText,
  Layers3,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { ChartCard } from "@/components/common/ChartCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { IndustrialClusterList } from "@/features/industrial-clusters/IndustrialClusterList";
import { IndustrialClusterDetail } from "@/features/industrial-clusters/IndustrialClusterDetail";
import { IndustrialProgressPanel } from "@/features/industrial-clusters/IndustrialProgressPanel";
import { IndustrialReportPanel } from "@/features/industrial-clusters/IndustrialReportPanel";
import { IndustrialCatalogPanel } from "@/features/industrial-clusters/IndustrialCatalogPanel";
import { IndustrialIntegrationPanel } from "@/features/industrial-clusters/IndustrialIntegrationPanel";
import { IndustrialClusterForm } from "@/features/industrial-clusters/IndustrialClusterForm";
import { IndustrialAiPanel } from "@/components/industry/IndustrialAiPanel";
import { IndustrialLayerMap } from "@/components/gis/IndustrialLayerMap";
import { CompanyProfileDrawer } from "@/components/gis/CompanyProfileDrawer";
import { CLUSTERS, CLUSTER_FACTORIES } from "@/data/mock";
import { WARD_ZONES } from "@/data/industrial-zones";
import type { Cluster, Factory as GisFactory } from "@/lib/types";
import {
  getClusterDashboardSnapshot,
  getAllDossiers,
} from "@/lib/industrial-clusters/industrial-cluster-service";
import type { ClusterDossier } from "@/lib/industrial-clusters/industrial-cluster-types";

export const Route = createFileRoute("/industrial-clusters")({
  head: () => ({
    meta: [
      { title: "Quản lý Cụm công nghiệp | Nền tảng ngành Công Thương" },
      {
        name: "description",
        content:
          "Quản lý hồ sơ cụm công nghiệp, tiến độ đầu tư, báo cáo định kỳ theo NĐ 32/2024, NĐ 303/2026, TT 14/2024/TT-BCT. Phân quyền: Xã, Chủ đầu tư, Sở CT.",
      },
      { property: "og:title", content: "Quản lý Cụm công nghiệp" },
    ],
  }),
  component: Page,
});

type ClusterTab =
  | "overview"
  | "dossiers"
  | "progress"
  | "reports"
  | "catalog"
  | "integration"
  | "form";

const TABS: { key: ClusterTab; label: string; icon: typeof Building2; count?: number }[] = [
  { key: "overview", label: "Tổng quan", icon: Building2 },
  { key: "dossiers", label: "Hồ sơ CCN", icon: FileText },
  { key: "progress", label: "Tiến độ đầu tư", icon: Gauge },
  { key: "reports", label: "Báo cáo TT 14/2024", icon: BarChart3 },
  { key: "catalog", label: "Danh mục & Quy hoạch", icon: Layers3 },
  { key: "integration", label: "Tích hợp dữ liệu", icon: Factory },
];

function Page() {
  const [tab, setTab] = useState<ClusterTab>("overview");
  const [selectedCluster, setSelectedCluster] = useState<ClusterDossier | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedMapCluster, setSelectedMapCluster] = useState<Cluster | null>(null);
  const [selectedMapCompany, setSelectedMapCompany] = useState<GisFactory | null>(null);
  const [companyProfileOpen, setCompanyProfileOpen] = useState(false);

  const dashboardStats = useMemo(() => getClusterDashboardSnapshot(), []);
  const allDossiers = useMemo(() => getAllDossiers(), []);
  // Tính 1 lần để tránh O(n²) khi render từng ward
  const maxWardArea = useMemo(
    () => Math.max(...dashboardStats.byWard.map((item) => item.totalArea), 1),
    [dashboardStats],
  );
  const statusBreakdown = [
    { label: "Đang hoạt động", count: dashboardStats.active, color: "bg-success" },
    { label: "Đang đầu tư hạ tầng", count: dashboardStats.constructing, color: "bg-gov" },
    { label: "Xúc tiến đầu tư", count: dashboardStats.planned, color: "bg-warning" },
  ];

  const handleSelectCluster = (cluster: ClusterDossier) => {
    setSelectedCluster(cluster);
    setDetailOpen(true);
  };

  const handleCreateNew = () => {
    setFormMode("create");
    setSelectedCluster(null);
    setTab("form");
  };

  const handleEditCluster = (cluster: ClusterDossier) => {
    setFormMode("edit");
    setSelectedCluster(cluster);
    setTab("form");
  };

  return (
    <>
      <PageHeader
        title="Quản lý Cụm công nghiệp"
        description="Hồ sơ CCN, tiến độ đầu tư, báo cáo định kỳ — NĐ 32/2024, NĐ 303/2026, TT 14/2024/TT-BCT"
        crumbs={[{ label: "Nghiệp vụ" }, { label: "Cụm công nghiệp" }]}
        variant="panel"
        icon={Building2}
        actions={
          <Button onClick={handleCreateNew}>
            <Plus className="size-4" /> Hồ sơ mới
          </Button>
        }
      />

      <div className="space-y-5 p-4 sm:p-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard label="Tổng CCN" value={dashboardStats.total} icon={Building2} />
          <StatCard
            label="Tổng diện tích"
            value={`${dashboardStats.totalArea.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ha`}
            icon={MapPin}
            tone="teal"
          />
          <StatCard
            label="Đã cho thuê"
            value={`${dashboardStats.totalLeased.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ha`}
            icon={TrendingUp}
            tone="success"
          />
          <StatCard
            label="Tổng DN"
            value={dashboardStats.totalEnterprises}
            icon={FileText}
            tone="warning"
          />
          <StatCard
            label="Lấp đầy BQ"
            value={`${dashboardStats.occupancy}%`}
            icon={Gauge}
            tone="analytics"
          />
        </div>

        {/* Status Distribution Chart */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Phân bố theo trạng thái" subtitle={`${dashboardStats.total} CCN theo số liệu công bố`}>
            <div className="space-y-2 p-2">
              {statusBreakdown.map(({ label, count, color }) => {
                return (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="flex-1 font-medium text-navy">{label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{count} hồ sơ</span>
                      <div className="h-1.5 w-[150px] overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${color}`}
                          style={{ width: `${dashboardStats.total ? (count / dashboardStats.total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ChartCard>

          <ChartCard title="CCN theo địa bàn" subtitle="Top 10 xã/phường">
            <div className="space-y-2 p-2">
              {dashboardStats.byWard.slice(0, 10).map((ward) => (
                <div key={ward.wardId} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate font-medium text-navy">{ward.wardName}</span>
                    <span className="shrink-0 text-muted-foreground">{ward.clusterCount} cụm · {ward.occupancy}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-teal" style={{ width: `${ward.occupancy}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(value) => setTab(value as ClusterTab)}>
          <TabsList className="w-full justify-start overflow-x-auto">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger key={t.key} value={t.key}>
                  <Icon className="size-3.5 mr-1.5" />
                  {t.label}
                </TabsTrigger>
              );
            })}
            <TabsTrigger value="form" className="hidden">
              Hồ sơ chi tiết
            </TabsTrigger>
          </TabsList>

          {/* ---- TỔNG QUAN ---- */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <ChartCard
              title="Bản đồ GIS cụm công nghiệp"
              subtitle="Ranh giới KCN/CCN, địa bàn xã/phường và doanh nghiệp"
            >
              <IndustrialLayerMap
                zones={CLUSTERS}
                companies={selectedMapCluster ? CLUSTER_FACTORIES[selectedMapCluster.id] ?? [] : []}
                selectedZoneId={selectedMapCluster?.id}
                selectedCompanyId={selectedMapCompany?.id}
                wards={WARD_ZONES}
                onSelectZone={(cluster) => {
                  setSelectedMapCluster((current) => (current?.id === cluster.id ? null : cluster));
                  setSelectedMapCompany(null);
                }}
                onSelectCompany={(company) => setSelectedMapCompany(company)}
                onOpenProfile={(company) => {
                  setSelectedMapCompany(company);
                  setCompanyProfileOpen(true);
                }}
                height={520}
              />
            </ChartCard>

            <ChartCard title="Thống kê nhanh" subtitle="Tóm tắt toàn tỉnh">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-lg border border-border bg-surface p-4">
                  <p className="text-xs text-muted-foreground">Đang hoạt động</p>
                  <p className="text-2xl font-bold text-success mt-1">{dashboardStats.active}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface p-4">
                  <p className="text-xs text-muted-foreground">Đang xây dựng</p>
                  <p className="text-2xl font-bold text-gov mt-1">{dashboardStats.constructing}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface p-4">
                  <p className="text-xs text-muted-foreground">Quy hoạch/chuẩn bị</p>
                  <p className="text-2xl font-bold text-warning mt-1">{dashboardStats.planned}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface p-4">
                  <p className="text-xs text-muted-foreground">Quỹ đất công nghiệp còn lại</p>
                  <p className="text-2xl font-bold text-muted-foreground mt-1">{dashboardStats.remainingIndustrialLand} ha</p>
                </div>
              </div>
            </ChartCard>

            <IndustrialAiPanel onSelectCluster={setSelectedMapCluster} />

            <ChartCard title="Phân bố diện tích theo khu vực" subtitle={`Chi tiết đã nạp ${dashboardStats.detailCoverage}/${dashboardStats.total} CCN`}>
              <div className="space-y-3 p-2">
                {dashboardStats.byWard
                  .slice()
                  .sort((a, b) => b.totalArea - a.totalArea)
                  .map((ward) => {
                    return (
                      <div key={ward.wardId} className="space-y-1">
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="min-w-0 truncate font-medium text-navy">{ward.wardName}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {ward.totalArea.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ha · {ward.clusterCount} cụm
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gov"
                            style={{ width: `${(ward.totalArea / maxWardArea) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                <p className="border-t border-border pt-2 text-[11px] text-muted-foreground">
                  Tổng quy hoạch toàn tỉnh: {dashboardStats.totalArea.toLocaleString("vi-VN")} ha. Các thanh bên dưới chỉ là phần dữ liệu chi tiết đã có tọa độ.
                </p>
              </div>
            </ChartCard>

            <p className="text-[11px] text-muted-foreground">
              Nguồn: {dashboardStats.source} · cập nhật {dashboardStats.asOf} · {dashboardStats.investmentProjects} dự án, {dashboardStats.fdiProjects} dự án FDI · lấp đầy trên hạ tầng hoàn chỉnh {dashboardStats.completedInfrastructureOccupancy}%.
            </p>
          </TabsContent>

          {/* ---- HỒ SƠ CCN ---- */}
          <TabsContent value="dossiers" className="mt-4">
            <IndustrialClusterList
              applications={allDossiers}
              onSelect={handleSelectCluster}
              onCreateNew={handleCreateNew}
            />
          </TabsContent>

          {/* ---- TIẾN ĐỘ ĐẦU TƯ ---- */}
          <TabsContent value="progress" className="mt-4">
            <IndustrialProgressPanel
              selectedCluster={selectedCluster}
              onSelectCluster={setSelectedCluster}
            />
          </TabsContent>

          {/* ---- BÁO CÁO ---- */}
          <TabsContent value="reports" className="mt-4">
            <IndustrialReportPanel />
          </TabsContent>

          {/* ---- DANH MỤC & QUY HOẠCH ---- */}
          <TabsContent value="catalog" className="mt-4">
            <IndustrialCatalogPanel />
          </TabsContent>

          {/* ---- TÍCH HỢP DỮ LIỆU ---- */}
          <TabsContent value="integration" className="mt-4">
            <IndustrialIntegrationPanel />
          </TabsContent>

          {/* ---- FORM HỒ SƠ ---- */}
          <TabsContent value="form" className="mt-4">
            <IndustrialClusterForm
              mode={formMode}
              cluster={formMode === "edit" ? selectedCluster ?? undefined : undefined}
              onClose={() => {
                setTab("dossiers");
                setDetailOpen(false);
              }}
              onSave={() => {
                setTab("dossiers");
                setDetailOpen(false);
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail Drawer */}
      <IndustrialClusterDetail
        open={detailOpen && tab !== "form"}
        onOpenChange={setDetailOpen}
        cluster={selectedCluster}
        onEdit={handleEditCluster}
      />

      <CompanyProfileDrawer
        open={companyProfileOpen}
        onOpenChange={setCompanyProfileOpen}
        company={selectedMapCompany}
        cluster={selectedMapCluster}
      />
    </>
  );
}