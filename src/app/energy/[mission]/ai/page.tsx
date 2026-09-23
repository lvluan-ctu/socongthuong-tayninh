import { notFound } from "next/navigation";
import { MissionAiWorkspace } from "@/components/energy/MissionAiWorkspace";
import { SafetyAIVisionWorkspace } from "@/features/safety/SafetyAIVisionWorkspace";

export default async function Page({ params }: { params: Promise<{ mission: string }> }) {
  const { mission } = await params;
  const match = /^nhiem-vu-([1-8])$/.exec(mission);
  if (!match) notFound();
  const taskId = Number(match[1]);
  return taskId === 5 ? <SafetyAIVisionWorkspace /> : <MissionAiWorkspace taskId={taskId} />;
}
