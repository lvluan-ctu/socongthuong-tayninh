import { createFileRoute } from "@/lib/router-compat";
import { BatteryCharging, CircleParking, PlugZap, Wrench, Zap } from "lucide-react";
import { EnergyCollectionPage } from "@/components/energy/EnergyCollectionPage";
import { EnergyStatusBadge, FieldGrid } from "@/components/energy/EnergyShared";
import type { Column } from "@/components/common/DataTable";
import { getChargingStations } from "@/lib/energy-service";
import type { ChargingStation } from "@/lib/energy-types";

export const Route = createFileRoute("/energy/charging-stations")({
  head: () => ({ meta: [{ title: "Trạm sạc điện | Năng lượng" }] }),
  component: Page,
});

const columns: Column<ChargingStation>[] = [
  { key: "name", header: "Trạm sạc", sortable: true },
  { key: "powerKw", header: "Công suất", sortable: true },
  {
    key: "ports",
    header: "Số cổng",
    value: (r) => r.ports.ccs2 + r.ports.chademo + r.ports.acType2,
  },
  { key: "freePorts", header: "Cổng trống", sortable: true },
  { key: "type", header: "Loại", sortable: true },
  { key: "district", header: "Địa bàn", sortable: true },
  { key: "status", header: "Trạng thái", render: (r) => <EnergyStatusBadge status={r.status} /> },
];

function Page() {
  return (
    <EnergyCollectionPage
      title="Trạm sạc điện"
      description="Quản lý trạm sạc, công suất, số cổng, chuẩn sạc, tình trạng cổng trống và trạng thái hoạt động."
      icon={BatteryCharging}
      queryKey={["energy", "charging-stations"]}
      queryFn={getChargingStations}
      columns={columns}
      searchPlaceholder="Tìm trạm sạc..."
      drawerTitle="Hồ sơ trạm sạc điện"
      kpis={(rows) => [
        { label: "Tổng trạm", value: rows.length, icon: BatteryCharging, tone: "gov" },
        {
          label: "Đang hoạt động",
          value: rows.filter((r) => r.status.includes("Hoạt động")).length,
          icon: Zap,
          tone: "success",
        },
        {
          label: "Đang bảo trì",
          value: rows.filter((r) => r.status.includes("Bảo trì")).length,
          icon: Wrench,
          tone: "warning",
        },
        {
          label: "Tổng cổng sạc",
          value: rows.reduce((s, r) => s + r.ports.ccs2 + r.ports.chademo + r.ports.acType2, 0),
          icon: PlugZap,
          tone: "teal",
        },
        {
          label: "Cổng đang trống",
          value: rows.reduce((s, r) => s + r.freePorts, 0),
          icon: CircleParking,
          tone: "analytics",
        },
      ]}
      renderDetail={(item) => (
        <FieldGrid
          items={[
            { label: "Mã trạm", value: item.code },
            { label: "Tên trạm", value: item.name },
            { label: "Công suất", value: `${item.powerKw} kW` },
            { label: "Số cổng", value: item.ports.ccs2 + item.ports.chademo + item.ports.acType2 },
            { label: "Cổng trống", value: item.freePorts },
            {
              label: "Chuẩn",
              value: `CCS2: ${item.ports.ccs2}, CHAdeMO: ${item.ports.chademo}, AC Type2: ${item.ports.acType2}`,
            },
            { label: "Loại", value: item.type },
            { label: "Địa chỉ", value: item.address },
            { label: "Trạng thái", value: <EnergyStatusBadge status={item.status} /> },
          ]}
        />
      )}
    />
  );
}
