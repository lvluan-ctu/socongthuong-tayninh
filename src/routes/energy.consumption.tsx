import { createFileRoute } from "@/lib/router-compat";
import { Gauge, Leaf, TrendingUp, Zap } from "lucide-react";
import { EnergyCollectionPage } from "@/components/energy/EnergyCollectionPage";
import { FieldGrid } from "@/components/energy/EnergyShared";
import type { Column } from "@/components/common/DataTable";
import { getEnergyConsumers } from "@/lib/energy-service";
import type { EnergyConsumer } from "@/lib/energy-types";

export const Route = createFileRoute("/energy/consumption")({
  head: () => ({ meta: [{ title: "Sử dụng & Tiết kiệm điện | Năng lượng" }] }),
  component: Page,
});

const columns: Column<EnergyConsumer>[] = [
  { key: "name", header: "Đơn vị tiêu thụ", sortable: true },
  { key: "group", header: "Lĩnh vực", sortable: true },
  { key: "district", header: "Địa bàn", sortable: true },
  { key: "annual", header: "Điện năng năm", sortable: true, value: (r) => r.consumption.annual },
  {
    key: "maxDemandKw",
    header: "Cực đại",
    sortable: true,
    value: (r) => r.consumption.maxDemandKw,
  },
  {
    key: "growthPct",
    header: "Tăng trưởng",
    sortable: true,
    value: (r) => r.consumption.growthPct,
  },
];

function Page() {
  return (
    <EnergyCollectionPage
      title="Sử dụng & Tiết kiệm điện"
      description="Phân tích tiêu thụ theo lĩnh vực, địa bàn, cơ sở sử dụng năng lượng trọng điểm và xu hướng phụ tải."
      icon={Leaf}
      queryKey={["energy", "consumption"]}
      queryFn={getEnergyConsumers}
      columns={columns}
      searchPlaceholder="Tìm cơ sở tiêu thụ..."
      drawerTitle="Hồ sơ tiêu thụ năng lượng"
      kpis={(rows) => [
        {
          label: "Tổng điện năng tiêu thụ",
          value: `${rows.reduce((s, r) => s + r.consumption.annual, 0).toLocaleString("vi-VN")} kWh`,
          icon: Zap,
          tone: "gov",
        },
        {
          label: "Công suất cực đại",
          value: `${Math.max(...rows.map((r) => r.consumption.maxDemandKw), 0).toLocaleString("vi-VN")} kW`,
          icon: Gauge,
          tone: "warning",
        },
        {
          label: "Mức tăng trưởng TB",
          value: `${avg(rows.map((r) => r.consumption.growthPct)).toFixed(1)}%`,
          icon: TrendingUp,
          tone: "success",
        },
        { label: "Cơ sở trọng điểm", value: rows.length, icon: Leaf, tone: "teal" },
      ]}
      renderDetail={(item) => (
        <FieldGrid
          items={[
            { label: "Mã", value: item.code },
            { label: "Nhóm", value: item.group },
            { label: "Địa chỉ", value: item.address },
            { label: "Đơn vị quản lý", value: item.operator },
            {
              label: "Điện năng tháng",
              value: `${item.consumption.monthly.toLocaleString("vi-VN")} kWh`,
            },
            {
              label: "Điện năng năm",
              value: `${item.consumption.annual.toLocaleString("vi-VN")} kWh`,
            },
            { label: "Công suất cực đại", value: `${item.consumption.maxDemandKw} kW` },
            { label: "Hệ số tải", value: `${item.consumption.loadFactor}%` },
          ]}
        />
      )}
    />
  );
}

function avg(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
