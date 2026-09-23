"use client";

import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ChartCard } from "@/components/common/ChartCard";
import { getAllDossiers } from "@/lib/industrial-clusters/industrial-cluster-service";
import { CLUSTER_STATUS_LABELS } from "@/lib/industrial-clusters/industrial-cluster-types";

export function IndustrialReportPanel() {
  const dossiers = getAllDossiers();
  const reports = dossiers.flatMap((cluster) => cluster.reports.map((report) => ({ cluster, report })));

  return (
    <ChartCard title="Báo cáo định kỳ" subtitle="Danh sách báo cáo theo TT 14/2024/TT-BCT">
      <div className="divide-y divide-border">
        {reports.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Chưa có báo cáo được lập.</p>
        ) : reports.map(({ cluster, report }) => (
          <div key={report.id} className="flex items-center justify-between gap-4 p-3">
            <div className="flex min-w-0 items-center gap-3">
              <FileText className="size-4 shrink-0 text-gov" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-navy">{report.reportType} · {report.period}</p>
                <p className="truncate text-xs text-muted-foreground">{cluster.name} · {report.reportingEntity}</p>
              </div>
            </div>
            <Badge variant="outline">{report.status}</Badge>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}
