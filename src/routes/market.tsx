import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@/lib/router-compat";
import {
  Building2,
  Database,
  FileCheck2,
  Plus,
  ShieldAlert,
  Store,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BusinessStats } from "@/components/market/BusinessStats";
import { BusinessFilters, type BusinessFilterState } from "@/components/market/BusinessFilters";
import { BusinessGisMap } from "@/components/market/BusinessGisMap";
import { BusinessFormDrawer } from "@/components/market/BusinessFormDrawer";
import { BusinessDetailDrawer } from "@/components/market/BusinessDetailDrawer";
import { LicensePanel } from "@/components/market/LicensePanel";
import { ViolationPanel } from "@/components/market/ViolationPanel";
import { MarketAiPanel } from "@/components/market/MarketAiPanel";
import { EnterpriseRegistryPanel } from "@/components/market/EnterpriseRegistryPanel";
import type { Business } from "@/lib/market-types";
import { FIELD_LABELS } from "@/lib/market-types";
import { cn } from "@/lib/utils";
import MARKET_BUSINESSES from "@/data/market-businesses.json";

export const Route = createFileRoute("/market")({
  head: () => ({
    meta: [
      { title: "Quản lý thị trường | Nền tảng ngành Công Thương" },
      {
        name: "description",
        content:
          "Quản lý doanh nghiệp, hộ kinh doanh trên nền tảng GIS — giấy phép, vi phạm, AI cảnh báo tỉnh Tây Ninh.",
      },
      { property: "og:title", content: "Quản lý thị trường" },
    ],
  }),
  component: Page,
});

const INITIAL_BUSINESSES = MARKET_BUSINESSES as unknown as Business[];
const MARKET_BUSINESSES_STORAGE_KEY = "sct.market.businesses";

type Row = Business;

function Page() {
  const [businesses, setBusinesses] = useState<Business[]>(INITIAL_BUSINESSES);
  const [tab, setTab] = useState("businesses");
  const [filters, setFilters] = useState<BusinessFilterState>({
    search: "",
    field: "all",
    status: "all",
    type: "all",
    district: "Tất cả địa bàn",
  });
  const [selected, setSelected] = useState<Business | null>(null);
  const [editTarget, setEditTarget] = useState<Business | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [mapSelectedId, setMapSelectedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MARKET_BUSINESSES_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as unknown;
      if (Array.isArray(parsed)) setBusinesses(parsed as Business[]);
    } catch {
      // Giữ dữ liệu JSON gốc nếu localStorage chưa hợp lệ.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(MARKET_BUSINESSES_STORAGE_KEY, JSON.stringify(businesses));
  }, [businesses]);

  const filtered = useMemo(() => {
    let result = businesses;

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.taxCode.toLowerCase().includes(q) ||
          b.representative.toLowerCase().includes(q) ||
          b.mainProduct.toLowerCase().includes(q),
      );
    }

    if (filters.field !== "all") {
      result = result.filter((b) => b.field === filters.field);
    }

    if (filters.status !== "all") {
      result = result.filter((b) => b.status === filters.status);
    }

    if (filters.type !== "all") {
      result = result.filter((b) => b.type === filters.type);
    }

    if (filters.district !== "Tất cả địa bàn") {
      result = result.filter((b) => b.district === filters.district);
    }

    return result;
  }, [businesses, filters]);

  const handleSave = (data: Partial<Business>) => {
    const savedBusiness = data as Business;
    setBusinesses((current) => {
      const exists = current.some((business) => business.id === savedBusiness.id);
      return exists
        ? current.map((business) =>
            business.id === savedBusiness.id ? { ...business, ...savedBusiness } : business,
          )
        : [savedBusiness, ...current];
    });
    setShowForm(false);
    setEditTarget(null);
  };

  const handleEdit = (b: Business) => {
    setEditTarget(b);
    setShowForm(true);
  };

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Tên thực thể",
      sortable: true,
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-navy">{r.name}</p>
          <p className="text-[11px] text-muted-foreground">{r.taxCode}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Loại",
      sortable: true,
      render: (r) => (
        <Badge variant="outline" className="rounded-md font-medium text-[11px]">
          {r.type === "company" ? "🏢 DN" : "🏪 HKD"}
        </Badge>
      ),
    },
    {
      key: "field",
      header: "Lĩnh vực",
      sortable: true,
      render: (r) => (
        <Badge variant="outline" className="rounded-md border-gov/25 bg-gov/5 font-medium text-gov text-[11px]">
          {FIELD_LABELS[r.field]}
        </Badge>
      ),
    },
    { key: "representative", header: "Đại diện", sortable: true },
    {
      key: "district",
      header: "Địa bàn",
      sortable: true,
      render: (r) => (
        <span className="text-xs">
          {r.ward}, {r.district}
        </span>
      ),
    },
    {
      key: "gcnExpiryDate",
      header: "HSD GCN",
      sortable: true,
      render: (r) => {
        if (!r.gcnExpiryDate) return <span className="text-xs text-muted-foreground">—</span>;
        const days = Math.ceil(
          (new Date(r.gcnExpiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );
        return (
          <span
            className={cn(
              "text-xs font-medium",
              days <= 0 ? "text-destructive" : days <= 60 ? "text-warning" : "text-success",
            )}
          >
            {r.gcnExpiryDate}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (r) => (
        <Badge
          variant="outline"
          className={cn(
            "rounded-md font-medium text-[11px]",
            r.status === "active"
              ? "border-success/30 bg-success/10 text-success"
              : r.status === "suspended"
                ? "border-warning/40 bg-warning/15 text-warning"
                : "border-destructive/30 bg-destructive/10 text-destructive",
          )}
        >
          {r.status === "active"
            ? "Đang HT"
            : r.status === "suspended"
              ? "Tạm ngừng"
              : "Hết hạn"}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Quản lý thị trường"
        description="Quản lý doanh nghiệp, hộ kinh doanh trên nền tảng GIS — giấy phép, vi phạm, AI cảnh báo."
        crumbs={[{ label: "Nghiệp vụ" }, { label: "Quản lý thị trường" }]}
        variant="panel"
        icon={Store}
        actions={
          <Button
            onClick={() => {
              setEditTarget(null);
              setShowForm(true);
            }}
          >
            <Plus className="size-4" /> Thêm thực thể
          </Button>
        }
      />

      <div className="space-y-5 p-4 sm:p-6">
        {/* Stats */}
        <BusinessStats businesses={businesses} />

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="businesses">
              <Building2 className="size-3.5 mr-1.5" /> Doanh nghiệp & HKD
            </TabsTrigger>
            <TabsTrigger value="licenses">
              <FileCheck2 className="size-3.5 mr-1.5" /> Giấy phép
            </TabsTrigger>
            <TabsTrigger value="violations">
              <ShieldAlert className="size-3.5 mr-1.5" /> Vi phạm
            </TabsTrigger>
            <TabsTrigger value="ai">
              <span className="mr-1.5">🤖</span> AI Phân tích
            </TabsTrigger>
            <TabsTrigger value="registry">
              <Database className="mr-1.5 size-3.5" /> CSDL doanh nghiệp
            </TabsTrigger>
          </TabsList>

          {/* ---- DOANH NGHIỆP & HỘ KINH DOANH ---- */}
          <TabsContent value="businesses" className="mt-4 space-y-4">
            {/* GIS Map */}
            <BusinessGisMap
              businesses={filtered}
              selectedId={mapSelectedId}
              onSelect={(b) => {
                setMapSelectedId(b.id);
                setSelected(b);
              }}
              expanded={mapExpanded}
              onToggleExpand={() => setMapExpanded((v) => !v)}
            />

            {/* Filters */}
            <BusinessFilters
              filters={filters}
              onChange={setFilters}
              total={businesses.length}
              filtered={filtered.length}
            />

            {/* DataTable */}
            <DataTable
              columns={columns}
              rows={filtered}
              onRowClick={(r) => setSelected(r)}
              searchPlaceholder="Tìm kiếm trong danh sách..."
            />
          </TabsContent>

          {/* ---- GIẤY PHÉP ---- */}
          <TabsContent value="licenses" className="mt-4">
            <LicensePanel businesses={businesses} />
          </TabsContent>

          {/* ---- VI PHẠM ---- */}
          <TabsContent value="violations" className="mt-4">
            <ViolationPanel businesses={businesses} />
          </TabsContent>

          {/* ---- AI PHÂN TÍCH ---- */}
          <TabsContent value="ai" className="mt-4">
            <MarketAiPanel businesses={businesses} />
          </TabsContent>

          {/* ---- DỮ LIỆU DOANH NGHIỆP DÙNG CHUNG ---- */}
          <TabsContent value="registry" className="mt-4">
            <EnterpriseRegistryPanel />
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail Drawer */}
      <BusinessDetailDrawer
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
        business={selected}
        onEdit={handleEdit}
      />

      {/* Form Drawer */}
      <BusinessFormDrawer
        key={editTarget?.id ?? "new-business"}
        open={showForm}
        onOpenChange={(v) => {
          setShowForm(v);
          if (!v) setEditTarget(null);
        }}
        business={editTarget}
        onSave={handleSave}
      />
    </>
  );
}
