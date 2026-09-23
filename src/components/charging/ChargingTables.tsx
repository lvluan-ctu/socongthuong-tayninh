import { useMemo, useState } from "react";
import { BatteryCharging } from "lucide-react";
import { DataTable, type Column } from "@/components/common/DataTable";
import { EnergyStatusBadge } from "@/components/energy/EnergyShared";
import type { ChargingStation } from "@/lib/energy-types";
import { cn } from "@/lib/utils";

export function ChargingTables({ stations, selectedId, onSelect }: {
  stations: ChargingStation[];
  selectedId?: string | null;
  onSelect: (station: ChargingStation) => void;
}) {
  const [typeFilter, setTypeFilter] = useState("Tất cả");
  const types = useMemo(() => ["Tất cả", ...Array.from(new Set(stations.map((station) => station.type)))], [stations]);
  const rows = useMemo(
    () => typeFilter === "Tất cả" ? stations : stations.filter((station) => station.type === typeFilter),
    [stations, typeFilter],
  );
  const totalPorts = (station: ChargingStation) => station.ports.ccs2 + station.ports.chademo + station.ports.acType2;
  const columns = useMemo<Column<ChargingStation>[]>(() => [
    {
      key: "name", header: "Trạm sạc", sortable: true,
      render: (station) => <><span className={cn("font-semibold", selectedId === station.id ? "text-gov" : "text-navy")}>{station.name}</span><span className="block text-[11px] text-muted-foreground">{station.code}</span></>,
      value: (station) => `${station.name} ${station.code}`,
    },
    { key: "powerKw", header: "Công suất", sortable: true, value: (station) => station.powerKw, render: (station) => <span className="tabular-nums text-navy">{station.powerKw} kW</span> },
    { key: "ports", header: "Số cổng", sortable: true, value: totalPorts },
    {
      key: "freePorts", header: "Cổng trống", sortable: true,
      render: (station) => {
        const ratio = totalPorts(station) ? station.freePorts / totalPorts(station) * 100 : 0;
        return <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold", ratio <= 10 ? "border-destructive/30 bg-destructive/10 text-destructive" : ratio <= 40 ? "border-warning/40 bg-warning/15 text-warning" : "border-success/30 bg-success/10 text-success")}>{station.freePorts}</span>;
      },
    },
    { key: "standards", header: "Chuẩn sạc", value: (station) => `CCS2 ${station.ports.ccs2} · CHAdeMO ${station.ports.chademo} · AC ${station.ports.acType2}` },
    { key: "type", header: "Loại", sortable: true },
    { key: "district", header: "Địa bàn", sortable: true },
    { key: "status", header: "Trạng thái", sortable: true, render: (station) => <EnergyStatusBadge status={station.status} /> },
  ], [selectedId]);

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-md bg-gov/10 text-gov"><BatteryCharging className="size-4.5" /></span>
        <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold uppercase tracking-wide text-navy">Danh sách trạm sạc điện</h2><p className="text-xs text-muted-foreground">Bấm vào một trạm để xem hồ sơ và định vị trên bản đồ.</p></div>
      </header>
      <DataTable
        columns={columns}
        rows={rows}
        pageSize={8}
        onRowClick={onSelect}
        searchPlaceholder="Tìm trạm sạc, mã, địa bàn…"
        toolbar={<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-9 rounded-md border border-input bg-surface px-2 text-xs outline-none focus:ring-1 focus:ring-ring">{types.map((type) => <option key={type} value={type}>{type}</option>)}</select>}
        emptyText="Không có trạm sạc phù hợp"
      />
    </section>
  );
}
