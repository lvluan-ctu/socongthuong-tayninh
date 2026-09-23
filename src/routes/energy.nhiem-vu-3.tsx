import { MissionDatabaseDashboard } from "@/components/energy/MissionDatabaseDashboard";
import { createFileRoute } from "@/lib/router-compat";

export const Route = createFileRoute("/energy/nhiem-vu-3")({
  head: () => ({ meta: [{ title: "Nhiệm vụ 3 | Năng lượng" }] }),
  component: Page,
});

function Page() {
  return <MissionDatabaseDashboard taskId={3} />;
}
