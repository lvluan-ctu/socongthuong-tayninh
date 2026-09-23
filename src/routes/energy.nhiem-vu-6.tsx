import { MissionDatabaseDashboard } from "@/components/energy/MissionDatabaseDashboard";
import { createFileRoute } from "@/lib/router-compat";

export const Route = createFileRoute("/energy/nhiem-vu-6")({
  head: () => ({ meta: [{ title: "Nhiệm vụ 6 | Năng lượng" }] }),
  component: Page,
});

function Page() {
  return <MissionDatabaseDashboard taskId={6} />;
}
