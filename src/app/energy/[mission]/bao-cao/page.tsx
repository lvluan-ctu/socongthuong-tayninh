import { notFound } from "next/navigation";
import { MissionReportWorkspace } from "@/components/energy/MissionReportWorkspace";

export default async function Page({ params }: { params: Promise<{ mission: string }> }) {
  const { mission } = await params;
  const match = /^nhiem-vu-([1-8])$/.exec(mission);
  if (!match) notFound();
  return <MissionReportWorkspace taskId={Number(match[1])} />;
}
