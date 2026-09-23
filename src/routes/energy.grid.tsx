import { createFileRoute } from "@/lib/router-compat";
import { Cable, Grid3X3, Map as MapIcon, Network, Zap } from "lucide-react";
import { EnergyCollectionPage } from "@/components/energy/EnergyCollectionPage";
import { EnergyStatusBadge, FieldGrid } from "@/components/energy/EnergyShared";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Column } from "@/components/common/DataTable";
import { getSubstations } from "@/lib/energy-service";
import type { Substation } from "@/lib/energy-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/energy/grid")({
  head: () => ({ meta: [{ title: "Lưới điện & Trạm biến áp | Năng lượng" }] }),
  component: Page,
});

const columns: Column<Substation>[] = [
  { key: "name", header: "Tên trạm", sortable: true },
  { key: "voltageLevel", header: "Cấp điện áp", sortable: true },
  {
    key: "designCapacity",
    header: "Công suất",
    sortable: true,
    value: (r) => r.designCapacity ?? 0,
  },
  {
    key: "loadFactor",
    header: "Mức tải",
    sortable: true,
    render: (r) => (
      <span
        className={cn(
          "font-semibold tabular-nums",
          (r.loadFactor ?? 0) >= 100 ? "text-destructive" : "text-success",
        )}
      >
        {r.loadFactor ?? 0}%
      </span>
    ),
  },
  { key: "status", header: "Trạng thái", render: (r) => <EnergyStatusBadge status={r.status} /> },
  { key: "district", header: "Địa bàn", sortable: true },
  { key: "operator", header: "Đơn vị quản lý", sortable: true },
];

function Page() {
  return (
    <EnergyCollectionPage
      title="Lưới điện & Trạm biến áp"
      description="Quản lý trạm biến áp, tuyến điện, trụ điện, quy hoạch và khả năng mang tải."
      icon={Cable}
      queryKey={["energy", "grid", "substations"]}
      queryFn={getSubstations}
      columns={columns}
      searchPlaceholder="Tìm trạm..."
      drawerTitle="Hồ sơ trạm biến áp"
      kpis={(rows) => [
        { label: "Tổng trạm", value: rows.length, icon: Cable, tone: "gov" },
        {
          label: "Trạm quá tải",
          value: rows.filter((r) => (r.loadFactor ?? 0) >= 100).length,
          icon: Zap,
          tone: "danger",
        },
        {
          label: "Tổng công suất",
          value: `${rows.reduce((s, r) => s + (r.designCapacity ?? 0), 0)} MVA`,
          icon: Grid3X3,
          tone: "teal",
        },
        {
          label: "Đang vận hành",
          value: rows.filter((r) => r.status.includes("Vận hành")).length,
          icon: Network,
          tone: "success",
        },
        {
          label: "Có tọa độ GIS",
          value: rows.filter((r) => r.latitude && r.longitude).length,
          icon: MapIcon,
          tone: "analytics",
        },
      ]}
      renderDetail={(item) => (
        <FieldGrid
          items={[
            { label: "Mã trạm", value: item.code },
            { label: "Loại trạm", value: item.type },
            { label: "Cấp điện áp", value: item.voltageLevel },
            { label: "Địa chỉ", value: item.address },
            { label: "Đơn vị quản lý", value: item.operator },
            { label: "Công suất thiết kế", value: `${item.designCapacity ?? 0} MVA` },
            { label: "Công suất vận hành", value: `${item.operatingCapacity ?? 0} MVA` },
            { label: "Hệ số tải", value: `${item.loadFactor ?? 0}%` },
            { label: "Số MBA", value: item.transformerCount },
            {
              label: "GIS",
              value:
                item.latitude && item.longitude ? `${item.latitude}, ${item.longitude}` : undefined,
            },
          ]}
        />
      )}
    >
      <Tabs defaultValue="stations">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="stations">Trạm biến áp</TabsTrigger>
          <TabsTrigger value="lines">Lưới điện</TabsTrigger>
          <TabsTrigger value="poles">Trụ điện</TabsTrigger>
          <TabsTrigger value="planning">Quy hoạch</TabsTrigger>
          <TabsTrigger value="gis">GIS</TabsTrigger>
        </TabsList>
      </Tabs>
    </EnergyCollectionPage>
  );
}
