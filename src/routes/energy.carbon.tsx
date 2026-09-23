import { createFileRoute } from "@/lib/router-compat";
import { Cloud, Factory, Leaf, WalletCards } from "lucide-react";
import { EnergyCollectionPage } from "@/components/energy/EnergyCollectionPage";
import { EnergyStatusBadge, FieldGrid } from "@/components/energy/EnergyShared";
import type { Column } from "@/components/common/DataTable";
import { getEmissionSources } from "@/lib/energy-service";
import type { EmissionSource } from "@/lib/energy-types";

export const Route = createFileRoute("/energy/carbon")({
  head: () => ({ meta: [{ title: "Phát thải Carbon | Năng lượng" }] }),
  component: Page,
});

const columns: Column<EmissionSource>[] = [
  { key: "unit", header: "Nguồn phát thải", sortable: true },
  { key: "sourceType", header: "Loại nguồn", sortable: true },
  { key: "district", header: "Địa bàn", sortable: true },
  { key: "co2e", header: "CO2e", sortable: true },
  { key: "intensity", header: "Cường độ", sortable: true },
  { key: "status", header: "Trạng thái", render: (r) => <EnergyStatusBadge status={r.status} /> },
];

function Page() {
  return (
    <EnergyCollectionPage
      title="Phát thải Carbon"
      description="Quản lý nguồn phát thải, tính toán CO2e, doanh nghiệp phát thải, dự án giảm phát thải và tín chỉ carbon."
      icon={Cloud}
      queryKey={["energy", "carbon"]}
      queryFn={getEmissionSources}
      columns={columns}
      searchPlaceholder="Tìm nguồn phát thải..."
      drawerTitle="Hồ sơ nguồn phát thải"
      kpis={(rows) => [
        {
          label: "Tổng CO2e",
          value: `${rows.reduce((s, r) => s + r.co2e, 0).toLocaleString("vi-VN")} tấn`,
          icon: Cloud,
          tone: "analytics",
        },
        { label: "Nguồn phát thải", value: rows.length, icon: Factory, tone: "gov" },
        {
          label: "Doanh nghiệp phát thải",
          value: new Set(rows.map((r) => r.investor)).size,
          icon: Factory,
          tone: "warning",
        },
        {
          label: "Dự án giảm phát thải",
          value: rows.filter((r) => r.intensity === 0).length,
          icon: Leaf,
          tone: "success",
        },
        { label: "Tín chỉ Carbon", value: "Đang cập nhật", icon: WalletCards, tone: "teal" },
      ]}
      renderDetail={(item) => (
        <FieldGrid
          items={[
            { label: "Mã", value: item.code },
            { label: "Đơn vị", value: item.unit },
            { label: "Loại nguồn", value: item.sourceType },
            { label: "Chủ đầu tư", value: item.investor },
            { label: "CO2", value: `${item.co2.toLocaleString("vi-VN")} tấn` },
            { label: "CO2e", value: `${item.co2e.toLocaleString("vi-VN")} tấn` },
            { label: "Cường độ", value: `${item.intensity} gCO2e/kWh` },
            { label: "Trạng thái", value: <EnergyStatusBadge status={item.status} /> },
          ]}
        />
      )}
    />
  );
}
