import { createFileRoute } from "@/lib/router-compat";
import { Factory, Leaf, Zap } from "lucide-react";
import { EnergyCollectionPage } from "@/components/energy/EnergyCollectionPage";
import { EnergyStatusBadge, FieldGrid } from "@/components/energy/EnergyShared";
import type { Column } from "@/components/common/DataTable";
import { getPowerProjects } from "@/lib/energy-service";
import type { PowerProject } from "@/lib/energy-types";

export const Route = createFileRoute("/energy/projects")({
  head: () => ({ meta: [{ title: "Dự án nguồn điện | Năng lượng" }] }),
  component: Page,
});

const columns: Column<PowerProject>[] = [
  { key: "name", header: "Tên dự án", sortable: true },
  { key: "type", header: "Loại nguồn", sortable: true },
  { key: "investor", header: "Chủ đầu tư", sortable: true },
  {
    key: "designCapacityMw",
    header: "Công suất",
    sortable: true,
    value: (r) => r.designCapacityMw ?? 0,
  },
  { key: "district", header: "Địa bàn", sortable: true },
  { key: "status", header: "Trạng thái", render: (r) => <EnergyStatusBadge status={r.status} /> },
];

function Page() {
  return (
    <EnergyCollectionPage
      title="Dự án nguồn điện"
      description="Theo dõi nguồn điện mặt trời, gió, sinh khối, thủy điện, điện rác và LNG."
      icon={Zap}
      queryKey={["energy", "projects"]}
      queryFn={getPowerProjects}
      columns={columns}
      searchPlaceholder="Tìm dự án..."
      drawerTitle="Hồ sơ dự án"
      kpis={(rows) => [
        { label: "Tổng dự án", value: rows.length, icon: Zap, tone: "gov" },
        {
          label: "Đang vận hành",
          value: rows.filter((r) => r.status.includes("vận hành")).length,
          icon: Factory,
          tone: "success",
        },
        {
          label: "Đang đầu tư",
          value: rows.filter((r) => r.status.includes("đầu tư")).length,
          icon: Factory,
          tone: "warning",
        },
        {
          label: "Đang quy hoạch",
          value: rows.filter((r) => r.status.includes("quy hoạch")).length,
          icon: Leaf,
          tone: "teal",
        },
        {
          label: "Tổng công suất",
          value: `${rows.reduce((s, r) => s + (r.designCapacityMw ?? 0), 0)} MW`,
          icon: Zap,
          tone: "analytics",
        },
      ]}
      renderDetail={(item) => (
        <FieldGrid
          items={[
            { label: "Mã dự án", value: item.code },
            { label: "Loại nguồn", value: item.type },
            { label: "Chủ đầu tư", value: item.investor },
            { label: "Công suất thiết kế", value: `${item.designCapacityMw ?? 0} MW` },
            { label: "Công suất thực tế", value: `${item.actualOutputMw ?? 0} MW` },
            { label: "Sản lượng", value: `${item.outputGWh ?? 0} GWh` },
            { label: "Trạm đấu nối", value: item.substationCode },
            { label: "Điện áp", value: item.gridVoltage },
            { label: "Trạng thái", value: <EnergyStatusBadge status={item.status} /> },
            {
              label: "Bản đồ vị trí",
              value:
                item.latitude && item.longitude ? `${item.latitude}, ${item.longitude}` : undefined,
            },
          ]}
        />
      )}
    />
  );
}
