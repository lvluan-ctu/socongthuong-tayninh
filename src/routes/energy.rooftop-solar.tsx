import { createFileRoute } from "@/lib/router-compat";
import { Home, PlugZap, SolarPanel, Zap } from "lucide-react";
import { EnergyCollectionPage } from "@/components/energy/EnergyCollectionPage";
import { EnergyStatusBadge, FieldGrid } from "@/components/energy/EnergyShared";
import type { Column } from "@/components/common/DataTable";
import { getRooftopSolar } from "@/lib/energy-service";
import type { RooftopSolar } from "@/lib/energy-types";

export const Route = createFileRoute("/energy/rooftop-solar")({
  head: () => ({ meta: [{ title: "Điện mặt trời mái nhà | Năng lượng" }] }),
  component: Page,
});

const columns: Column<RooftopSolar>[] = [
  { key: "owner", header: "Đơn vị/chủ hộ", sortable: true },
  {
    key: "installedCapacityKw",
    header: "Công suất",
    sortable: true,
    value: (r) => r.installedCapacityKw ?? 0,
  },
  { key: "district", header: "Địa bàn", sortable: true },
  { key: "customerType", header: "Loại hình", sortable: true },
  { key: "connection", header: "Đấu nối", value: (r) => r.connection.point },
  { key: "status", header: "Trạng thái", render: (r) => <EnergyStatusBadge status={r.status} /> },
];

function Page() {
  return (
    <EnergyCollectionPage
      title="Điện mặt trời mái nhà"
      description="Quản lý hệ thống ĐMT mái nhà, đấu nối, sản lượng, tự tiêu thụ và hòa lưới."
      icon={SolarPanel}
      queryKey={["energy", "rooftop-solar"]}
      queryFn={getRooftopSolar}
      columns={columns}
      searchPlaceholder="Tìm hệ thống ĐMT..."
      drawerTitle="Hồ sơ điện mặt trời mái nhà"
      kpis={(rows) => [
        { label: "Số hệ thống", value: rows.length, icon: SolarPanel, tone: "gov" },
        {
          label: "Tổng công suất",
          value: `${(rows.reduce((s, r) => s + (r.installedCapacityKw ?? 0), 0) / 1000).toFixed(2)} MWp`,
          icon: Zap,
          tone: "success",
        },
        {
          label: "Đang hòa lưới",
          value: rows.filter((r) => r.status.includes("vận hành")).length,
          icon: PlugZap,
          tone: "teal",
        },
        {
          label: "Tự tiêu thụ",
          value: `${rows.reduce((s, r) => s + (r.operation?.selfConsumptionKwh ?? 0), 0).toLocaleString("vi-VN")} kWh`,
          icon: Home,
          tone: "analytics",
        },
      ]}
      renderDetail={(item) => (
        <FieldGrid
          items={[
            { label: "Mã hệ thống", value: item.code },
            { label: "Chủ sở hữu", value: item.owner },
            { label: "Loại hình", value: item.customerType },
            { label: "Công suất", value: `${item.installedCapacityKw ?? 0} kWp` },
            { label: "Điểm đấu nối", value: item.connection.point },
            { label: "Trạm đấu nối", value: item.connection.substationCode },
            { label: "Đấu nối", value: item.connection.overload },
            { label: "Trạng thái", value: <EnergyStatusBadge status={item.status} /> },
          ]}
        />
      )}
    />
  );
}
