import { AlertTriangle, BatteryCharging, CircleParking, Gauge, PlugZap, Zap } from "lucide-react";
import { StatCard } from "@/components/common/StatCard";
import type { ChargingStation } from "@/lib/energy-types";

const fmt = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);

export function ChargingKpiRow({
  stations,
  onFilterOverload,
}: {
  stations: ChargingStation[];
  onFilterOverload?: () => void;
}) {
  const totalPorts = stations.reduce(
    (s, r) => s + r.ports.ccs2 + r.ports.chademo + r.ports.acType2,
    0,
  );
  const freePorts = stations.reduce((s, r) => s + r.freePorts, 0);
  const capacityKw = stations.reduce((s, r) => s + r.powerKw, 0);
  const active = stations.filter((s) => s.status.includes("Hoạt động")).length;
  const maintenance = stations.filter((s) => s.status.includes("Bảo trì")).length;
  const overloaded = stations.filter(
    (s) => s.status.includes("Quá tải") || (s.freePorts === 0 && !s.status.includes("Quy hoạch")),
  ).length;
  const freePct = totalPorts ? Math.round((freePorts / totalPorts) * 100) : 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <StatCard
        label="Tổng trạm sạc"
        value={stations.length}
        delta={`${capacityKw > 0 ? fmt(capacityKw) : 0} kW lắp đặt`}
        icon={BatteryCharging}
        tone="gov"
      />
      <StatCard
        label="Đang hoạt động"
        value={active}
        delta={`${maintenance} trạm bảo trì`}
        icon={Zap}
        tone="success"
      />
      <StatCard
        label="Tổng cổng sạc"
        value={totalPorts}
        delta={`CCS2 + CHAdeMO + AC Type2`}
        icon={PlugZap}
        tone="teal"
      />
      <StatCard
        label="Cổng đang trống"
        value={freePorts}
        delta={`${freePct}% tổng cổng`}
        icon={CircleParking}
        tone="analytics"
      />
      <StatCard
        label="Trạm quá tải / hết cổng"
        value={overloaded}
        delta="Khu vực cần ưu tiên đầu tư"
        icon={AlertTriangle}
        tone="danger"
        onClick={onFilterOverload}
      />
      <StatCard
        label="Tỷ lệ khai thác"
        value={`${100 - freePct}%`}
        delta="Cổng đang sử dụng"
        icon={Gauge}
        tone="navy"
      />
    </div>
  );
}
