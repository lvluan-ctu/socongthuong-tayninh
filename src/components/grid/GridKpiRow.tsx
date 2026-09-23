import { Cable, Gauge, Grid3X3, Network, Zap } from "lucide-react";
import { StatCard } from "@/components/common/StatCard";
import type { GridOverview } from "@/lib/grid-types";

export function GridKpiRow({ overview }: { overview: GridOverview }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Trạm biến áp đang vận hành"
        value={overview.totalSubstations}
        delta={`Tổng ${overview.totalSubstationCapacityMva} MVA thiết kế`}
        icon={Network}
        tone="gov"
      />
      <StatCard
        label="Tổng công suất vận hành"
        value={`${overview.totalOperatingCapacityMva} MVA`}
        delta={`Còn trống ${Math.max(0, overview.totalSubstationCapacityMva - overview.totalOperatingCapacityMva)} MVA`}
        icon={Grid3X3}
        tone="teal"
      />
      <StatCard
        label="Trạm quá tải (≥100%)"
        value={overview.overloadedSubstations}
        delta={`${overview.totalSubstations} trạm đang vận hành`}
        icon={Zap}
        tone="danger"
      />
      <StatCard
        label="Lưới truyền tải"
        value={`${overview.totalLineLengthKm} km`}
        delta={`${overview.totalLines} tuyến · tổn thất TB ${overview.avgLossPct}%`}
        icon={Cable}
        tone="navy"
      />
    </div>
  );
}
