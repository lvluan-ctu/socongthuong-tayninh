"use client";

import { Badge } from "@/components/ui/badge";
import type { ClusterDossierStatus } from "@/lib/industrial-clusters/industrial-cluster-types";
import { CLUSTER_STATUS_LABELS } from "@/lib/industrial-clusters/industrial-cluster-types";

interface ClusterStatusBadgeProps {
  status: ClusterDossierStatus;
  className?: string;
}

export function ClusterStatusBadge({ status, className }: ClusterStatusBadgeProps) {
  const label = CLUSTER_STATUS_LABELS[status];
  return (
    <Badge
      variant="outline"
      className={`rounded-full text-[11px] font-medium ${label.bgColor} ${label.color} ${className ?? ""}`}
    >
      {label.label}
    </Badge>
  );
}