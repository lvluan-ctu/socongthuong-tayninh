import { useCallback, useMemo, useState } from "react";
import { Cable, Grid3X3, Hammer, Network } from "lucide-react";
import { DataTable } from "@/components/common/DataTable";
import type { Column } from "@/components/common/DataTable";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EnergyStatusBadge } from "@/components/energy/EnergyShared";
import { WorkflowStatusBadge } from "@/components/grid/GridShared";
import type { GridEntity } from "@/components/grid/GridMap";
import type { GridPlanAsset, GridPowerLine, GridPowerPole, GridSubstation } from "@/lib/grid-types";
import { GRID_CONFIG } from "@/lib/grid-types";
import { cn } from "@/lib/utils";

const ALL_DISTRICTS = "Toàn tỉnh";

export const GRID_VOLTAGES = ["Toàn bộ", "500kV", "220kV", "110kV", "22kV"];

const TABS = [
  { id: "stations", label: "Trạm biến áp", icon: Network },
  { id: "lines", label: "Đường dây", icon: Cable },
  { id: "poles", label: "Trụ điện", icon: Grid3X3 },
  { id: "planning", label: "Quy hoạch", icon: Hammer },
] as const;

export type GridTabId = (typeof TABS)[number]["id"];

export function GridTables({
  substations,
  lines,
  poles,
  planned,
  onSelect,
}: {
  substations: GridSubstation[];
  lines: GridPowerLine[];
  poles: GridPowerPole[];
  planned: GridPlanAsset[];
  onSelect: (entity: GridEntity) => void;
}) {
  const [tab, setTab] = useState<GridTabId>("stations");
  const [district, setDistrict] = useState(ALL_DISTRICTS);
  const [voltage, setVoltage] = useState(GRID_VOLTAGES[0]!);

  const scope = useCallback(
    <T extends { district?: string; voltageLevel?: string }>(items: T[]): T[] =>
      items.filter(
        (item) =>
          (district === ALL_DISTRICTS || item.district === district) &&
          (voltage === "Toàn bộ" || item.voltageLevel === voltage),
      ),
    [district, voltage],
  );

  const scopedSubs = useMemo(() => scope(substations), [scope, substations]);
  const scopedLines = useMemo(() => scope(lines), [scope, lines]);
  const scopedPoles = useMemo(() => poles, [poles]);
  const scopedPlanned = useMemo(() => scope(planned), [scope, planned]);
  const districts = useMemo(
    () => [
      ALL_DISTRICTS,
      ...Array.from(
        new Set(
          [...substations, ...planned]
            .map((item) => item.district)
            .filter((item): item is string => Boolean(item)),
        ),
      ).sort((a, b) => a.localeCompare(b, "vi")),
    ],
    [planned, substations],
  );

  return (
    <div className="gov-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as GridTabId)}>
          <TabsList className="flex h-auto flex-wrap justify-start">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="gap-1.5">
                <t.icon className="size-3.5" /> {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={district} onValueChange={setDistrict}>
            <SelectTrigger className="h-8 w-[150px] bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {districts.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={voltage} onValueChange={setVoltage}>
            <SelectTrigger className="h-8 w-[110px] bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GRID_VOLTAGES.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="p-3">
        {tab === "stations" ? (
          <SubstationTable
            rows={scopedSubs}
            onSelect={(s) => onSelect({ kind: "substation", item: s })}
          />
        ) : tab === "lines" ? (
          <LineTable rows={scopedLines} onSelect={(l) => onSelect({ kind: "line", item: l })} />
        ) : tab === "poles" ? (
          <PoleTable rows={scopedPoles} onSelect={(p) => onSelect({ kind: "pole", item: p })} />
        ) : (
          <PlanTable rows={scopedPlanned} onSelect={(a) => onSelect({ kind: "plan", item: a })} />
        )}
      </div>
    </div>
  );
}

function SubstationTable({
  rows,
  onSelect,
}: {
  rows: GridSubstation[];
  onSelect: (s: GridSubstation) => void;
}) {
  const columns: Column<GridSubstation>[] = [
    { key: "name", header: "Tên trạm", sortable: true },
    { key: "voltageLevel", header: "Cấp điện áp", sortable: true },
    {
      key: "designCapacity",
      header: "Công suất",
      sortable: true,
      value: (r) => r.designCapacity ?? 0,
      render: (r) => <span className="tabular-nums">{r.designCapacity ?? 0} MVA</span>,
    },
    {
      key: "loadFactor",
      header: "Mức tải",
      sortable: true,
      render: (r) => (
        <span
          className={cn(
            "font-semibold tabular-nums",
            (r.loadFactor ?? 0) >= GRID_CONFIG.thresholds.substationLoadCriticalPct
              ? "text-destructive"
              : (r.loadFactor ?? 0) >= GRID_CONFIG.thresholds.substationLoadWarnPct
                ? "text-warning"
                : "text-success",
          )}
        >
          {r.loadFactor ?? 0}%
        </span>
      ),
    },
    { key: "status", header: "Trạng thái", render: (r) => <EnergyStatusBadge status={r.status} /> },
    {
      key: "workflowStatus",
      header: "Phê duyệt",
      render: (r) => (r.workflowStatus ? <WorkflowStatusBadge status={r.workflowStatus} /> : null),
    },
    { key: "district", header: "Địa bàn", sortable: true },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      searchPlaceholder="Tìm trạm theo tên, mã..."
      onRowClick={onSelect}
      emptyText="Không có trạm phù hợp với bộ lọc"
    />
  );
}

function LineTable({
  rows,
  onSelect,
}: {
  rows: GridPowerLine[];
  onSelect: (l: GridPowerLine) => void;
}) {
  const columns: Column<GridPowerLine>[] = [
    { key: "name", header: "Tên tuyến", sortable: true },
    { key: "voltageLevel", header: "Cấp điện áp", sortable: true },
    {
      key: "lengthKm",
      header: "Dài",
      sortable: true,
      value: (r) => r.lengthKm,
      render: (r) => `${r.lengthKm} km`,
    },
    {
      key: "loadPct",
      header: "Tải",
      sortable: true,
      value: (r) => (r.capacityMw ? Math.round(((r.actualLoadMw ?? 0) / r.capacityMw) * 100) : 0),
      render: (r) => {
        const pct = r.capacityMw ? Math.round(((r.actualLoadMw ?? 0) / r.capacityMw) * 100) : 0;
        return (
          <span
            className={cn(
              "font-semibold tabular-nums",
              pct >= GRID_CONFIG.thresholds.lineLoadWarnPct ? "text-warning" : "text-success",
            )}
          >
            {pct}%
          </span>
        );
      },
    },
    {
      key: "lossPct",
      header: "Tổn thất",
      sortable: true,
      value: (r) => r.lossPct ?? 0,
      render: (r) => (
        <span
          className={cn(
            "tabular-nums",
            (r.lossPct ?? 0) >= GRID_CONFIG.thresholds.lineLossHighPct
              ? "font-semibold text-destructive"
              : "text-navy",
          )}
        >
          {r.lossPct ?? 0}%
        </span>
      ),
    },
    { key: "status", header: "Trạng thái", render: (r) => <EnergyStatusBadge status={r.status} /> },
    {
      key: "workflowStatus",
      header: "Phê duyệt",
      render: (r) => (r.workflowStatus ? <WorkflowStatusBadge status={r.workflowStatus} /> : null),
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      searchPlaceholder="Tìm tuyến theo tên, mã..."
      onRowClick={onSelect}
      emptyText="Không có tuyến phù hợp với bộ lọc"
    />
  );
}

function PoleTable({
  rows,
  onSelect,
}: {
  rows: GridPowerPole[];
  onSelect: (p: GridPowerPole) => void;
}) {
  const columns: Column<GridPowerPole>[] = [
    { key: "code", header: "Mã trụ", sortable: true },
    { key: "lineCode", header: "Tuyến", sortable: true },
    { key: "type", header: "Loại trụ", sortable: true },
    {
      key: "height",
      header: "Chiều cao",
      sortable: true,
      value: (r) => r.height,
      render: (r) => `${r.height} m`,
    },
    { key: "yearBuilt", header: "Năm XD", sortable: true },
    {
      key: "foundationStatus",
      header: "Nền móng",
      render: (r) => <EnergyStatusBadge status={r.foundationStatus} />,
    },
    {
      key: "technicalStatus",
      header: "Kỹ thuật",
      render: (r) => <EnergyStatusBadge status={r.technicalStatus} />,
    },
    {
      key: "safetyCorridor",
      header: "Hành lang",
      render: (r) => <EnergyStatusBadge status={r.safetyCorridor} />,
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      searchPlaceholder="Tìm trụ theo mã, tuyến..."
      pageSize={10}
      onRowClick={onSelect}
      emptyText="Không có trụ phù hợp với bộ lọc"
    />
  );
}

function PlanTable({
  rows,
  onSelect,
}: {
  rows: GridPlanAsset[];
  onSelect: (a: GridPlanAsset) => void;
}) {
  const columns: Column<GridPlanAsset>[] = [
    { key: "name", header: "Hạng mục", sortable: true },
    {
      key: "type",
      header: "Loại",
      sortable: true,
      render: (r) => (r.type === "substation" ? "Trạm biến áp" : "Đường dây"),
    },
    { key: "voltageLevel", header: "Cấp điện áp", sortable: true },
    { key: "district", header: "Địa bàn", sortable: true },
    { key: "investor", header: "Nhà đầu tư", sortable: true },
    {
      key: "progress",
      header: "Tiến độ",
      render: (r) => <EnergyStatusBadge status={r.progress} />,
    },
    { key: "year", header: "Năm dự kiến", sortable: true },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      searchPlaceholder="Tìm hạng mục quy hoạch..."
      pageSize={6}
      onRowClick={onSelect}
      emptyText="Không có hạng mục quy hoạch phù hợp"
    />
  );
}
