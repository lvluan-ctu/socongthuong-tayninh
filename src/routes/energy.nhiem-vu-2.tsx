import { MissionDatabaseDashboard } from "@/components/energy/MissionDatabaseDashboard";
import { createFileRoute } from "@/lib/router-compat";

export const Route = createFileRoute("/energy/nhiem-vu-2")({
  head: () => ({ meta: [{ title: "Nhiệm vụ 2 | Năng lượng" }] }),
  component: Page,
});

function Page() {
  return <MissionDatabaseDashboard taskId={2} />;
}
