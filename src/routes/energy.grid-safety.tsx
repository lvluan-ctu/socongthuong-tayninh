import { createFileRoute } from "@/lib/router-compat";
import { AlertTriangle, CheckCircle2, Clock, ShieldAlert } from "lucide-react";
import { EnergyCollectionPage } from "@/components/energy/EnergyCollectionPage";
import { FieldGrid } from "@/components/energy/EnergyShared";
import type { Column } from "@/components/common/DataTable";
import { getGridIncidents } from "@/lib/energy-service";
import type { GridIncident } from "@/lib/energy-types";

export const Route = createFileRoute("/energy/grid-safety")({
  head: () => ({ meta: [{ title: "An toàn lưới điện & Sự cố | Năng lượng" }] }),
  component: Page,
});

const columns: Column<GridIncident>[] = [
  { key: "code", header: "Mã sự cố", sortable: true },
  { key: "type", header: "Loại", sortable: true },
  { key: "time", header: "Thời gian", sortable: true },
  { key: "location", header: "Địa điểm", sortable: true },
  { key: "affectedArea", header: "Ảnh hưởng", sortable: true },
  { key: "handler", header: "Đội xử lý", sortable: true },
  { key: "progress", header: "Tiến độ", sortable: true },
];

function Page() {
  const search = Route.useSearch() as { incident?: string };
  return (
    <EnergyCollectionPage
      title="An toàn lưới điện & Sự cố"
      description="Theo dõi vị trí sự cố, hành lang điện, điểm vi phạm, khu vực ảnh hưởng và tiến độ khôi phục."
      icon={ShieldAlert}
      queryKey={["energy", "grid-safety"]}
      queryFn={getGridIncidents}
      columns={columns}
      searchPlaceholder="Tìm sự cố..."
      drawerTitle="Hồ sơ sự cố lưới điện"
      initialSelectedId={search.incident}
      kpis={(rows) => [
        { label: "Tổng sự cố", value: rows.length, icon: AlertTriangle, tone: "gov" },
        {
          label: "Đang xử lý",
          value: rows.filter((r) => (r.progress ?? "").includes("Đang")).length,
          icon: Clock,
          tone: "warning",
        },
        {
          label: "Đã xử lý",
          value: rows.filter(
            (r) => (r.progress ?? "").includes("Hoàn") || (r.progress ?? "").includes("Đã"),
          ).length,
          icon: CheckCircle2,
          tone: "success",
        },
        {
          label: "Sự cố nghiêm trọng",
          value: rows.filter((r) => r.severity === "severe").length,
          icon: ShieldAlert,
          tone: "danger",
        },
        {
          label: "Mất tải",
          value: `${rows.reduce((s, r) => s + (r.lostLoadMw ?? 0), 0)} MW`,
          icon: AlertTriangle,
          tone: "analytics",
        },
      ]}
      renderDetail={(item) => (
        <FieldGrid
          items={[
            { label: "Mã sự cố", value: item.code },
            { label: "Loại", value: item.type },
            { label: "Thời gian", value: item.time },
            { label: "Địa điểm", value: item.location },
            { label: "Ảnh hưởng", value: item.affectedArea },
            { label: "Khách hàng bị ảnh hưởng", value: item.customersAffected },
            { label: "Đội xử lý", value: item.handler },
            { label: "Tiến độ", value: item.progress },
            { label: "Thời gian khôi phục", value: item.recoveryTime },
          ]}
        />
      )}
    />
  );
}
