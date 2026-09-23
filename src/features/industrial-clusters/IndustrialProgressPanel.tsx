"use client";

import { Gauge } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartCard } from "@/components/common/ChartCard";
import { ProgressMilestone } from "@/components/industry/ProgressMilestone";
import { getAllDossiers } from "@/lib/industrial-clusters/industrial-cluster-service";
import type { ClusterDossier } from "@/lib/industrial-clusters/industrial-cluster-types";

export function IndustrialProgressPanel({
  selectedCluster,
  onSelectCluster,
}: {
  selectedCluster: ClusterDossier | null;
  onSelectCluster: (cluster: ClusterDossier | null) => void;
}) {
  const clusters = getAllDossiers();
  const cluster = selectedCluster ?? clusters[0];

  return (
    <ChartCard title="Tiến độ đầu tư" subtitle="Theo dõi các mốc thực hiện của cụm công nghiệp">
      <div className="space-y-4 p-2">
        <Select
          value={cluster?.id}
          onValueChange={(value) => onSelectCluster(clusters.find((item) => item.id === value) ?? null)}
        >
          <SelectTrigger className="max-w-md">
            <SelectValue placeholder="Chọn cụm công nghiệp" />
          </SelectTrigger>
          <SelectContent>
            {clusters.map((item) => (
              <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {cluster ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm font-medium text-navy">
                <Gauge className="size-4 text-gov" /> {cluster.name}
              </div>
              <span className="text-sm font-semibold text-gov">{cluster.overallProgress}%</span>
            </div>
            <Progress value={cluster.overallProgress} className="h-2" />
            <div className="space-y-2">
              {cluster.milestones.map((milestone) => (
                <ProgressMilestone key={milestone.id} milestone={milestone} readOnly onUpdate={() => undefined} />
              ))}
            </div>
          </div>
        ) : <p className="text-sm text-muted-foreground">Chưa có dữ liệu cụm công nghiệp.</p>}
      </div>
    </ChartCard>
  );
}
