"use client";

import { MapPin } from "lucide-react";
import { ChartCard } from "@/components/common/ChartCard";
import { getAllWards, getAllDossiers } from "@/lib/industrial-clusters/industrial-cluster-service";

export function IndustrialCatalogPanel() {
  const wards = getAllWards();
  const dossiers = getAllDossiers();

  return (
    <ChartCard title="Danh mục và quy hoạch" subtitle="Phân bố cụm công nghiệp theo xã, phường">
      <div className="grid gap-3 p-2 sm:grid-cols-2 lg:grid-cols-3">
        {wards.map((ward) => {
          const clusters = dossiers.filter((cluster) => cluster.wardId === ward.id);
          return (
            <div key={ward.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 text-gov" />
                <div>
                  <p className="text-sm font-semibold text-navy">{ward.name}</p>
                  <p className="text-xs text-muted-foreground">{clusters.length} cụm công nghiệp</p>
                </div>
              </div>
              {clusters.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{clusters.map((cluster) => cluster.name).join(", ")}</p>}
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}
