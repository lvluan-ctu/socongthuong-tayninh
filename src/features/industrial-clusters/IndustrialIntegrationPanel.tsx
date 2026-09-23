"use client";

import { CheckCircle2, Database, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/common/ChartCard";
import { getAllDossiers, getAllWards } from "@/lib/industrial-clusters/industrial-cluster-service";

export function IndustrialIntegrationPanel() {
  const dossiers = getAllDossiers();
  const wards = getAllWards();

  return (
    <ChartCard title="Tích hợp dữ liệu" subtitle="Trạng thái dữ liệu nghiệp vụ cụm công nghiệp">
      <div className="space-y-3 p-2">
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div className="flex items-center gap-3"><Database className="size-4 text-gov" /><div><p className="text-sm font-medium text-navy">Danh mục cụm công nghiệp</p><p className="text-xs text-muted-foreground">{dossiers.length} hồ sơ · {wards.length} địa bàn</p></div></div>
          <CheckCircle2 className="size-4 text-success" />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div><p className="text-sm font-medium text-navy">Đồng bộ dữ liệu</p><p className="text-xs text-muted-foreground">Dữ liệu mô phỏng đang sẵn sàng</p></div>
          <Button variant="outline" size="sm" disabled><RefreshCw className="mr-1.5 size-3.5" /> Đồng bộ</Button>
        </div>
      </div>
    </ChartCard>
  );
}
