import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Leaf, ShieldCheck, Timer, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/common/DataTable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getLineCurtailment, getRenewableAbsorption } from "@/lib/grid-service";
import { GRID_CONFIG } from "@/lib/grid-types";
import type { GridPowerLine, GridSubstation } from "@/lib/grid-types";
import { cn } from "@/lib/utils";

const STATUS_META = {
  available: {
    label: "Còn dư địa tiếp nhận",
    tone: "bg-success/10 text-success",
    icon: ShieldCheck,
  },
  limited: {
    label: "Tiếp nhận hạn chế",
    tone: "bg-warning/10 text-warning",
    icon: TriangleAlert,
  },
  full: {
    label: "Đã đạt giới hạn tiếp nhận",
    tone: "bg-destructive/10 text-destructive",
    icon: TriangleAlert,
  },
} as const;

export function RenewableAbsorptionPanel({
  substations,
  lines,
}: {
  substations: GridSubstation[];
  lines: GridPowerLine[];
}) {
  const operatingSubs = useMemo(
    () => substations.filter((s) => s.status !== "Quy hoạch" && s.latitude && s.longitude),
    [substations],
  );
  const operatingLines = useMemo(() => lines.filter((l) => l.status !== "Quy hoạch"), [lines]);
  const [substationId, setSubstationId] = useState<string>(operatingSubs[0]?.id ?? "");
  const [lineId, setLineId] = useState<string>(operatingLines[0]?.id ?? "");

  const assessmentQuery = useQuery({
    queryKey: ["grid", "absorption", substationId],
    queryFn: () => getRenewableAbsorption(substationId),
    enabled: Boolean(substationId),
  });
  const curtailmentQuery = useQuery({
    queryKey: ["grid", "curtailment", lineId],
    queryFn: () => getLineCurtailment(lineId),
    enabled: Boolean(lineId),
  });

  const assessment = assessmentQuery.data;
  const curtailment = curtailmentQuery.data;
  type SourceRow = NonNullable<typeof assessment>["sources"][number];
  const sourceColumns: Column<SourceRow>[] = [
    { key: "owner", header: "Nguồn", sortable: true, value: (row) => `${row.owner} ${row.code} ${row.type}`, render: (row) => <><p className="font-medium text-navy">{row.owner}</p><p className="text-muted-foreground">{row.code} · {row.type}</p></> },
    { key: "installedKw", header: "Công suất", sortable: true, value: (row) => row.installedKw, render: (row) => `${row.installedKw} / ${row.capacityKw} kW` },
    { key: "overload", header: "Quá tải", sortable: true, render: (row) => <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", row.overload === "Vượt giới hạn" ? "bg-destructive/10 text-destructive" : row.overload === "Cảnh báo" ? "bg-warning/10 text-warning" : "bg-success/10 text-success")}>{row.overload}</span> },
    { key: "status", header: "Trạng thái", sortable: true, className: "text-muted-foreground" },
  ];

  const formulaRows = assessment
    ? [
        {
          label: `P_vận hành cho phép (${assessment.voltageLevel})`,
          value: assessment.allowableMw,
          unit: "MW",
        },
        {
          label: `P_phụ tải cao điểm trưa (${GRID_CONFIG.absorption.peakWindow})`,
          value: assessment.middayLoadMw,
          unit: "MW",
        },
        {
          label: "P_nguồn NLTT đã vận hành",
          value: assessment.operatingMw,
          unit: "MW",
          minus: true,
        },
        {
          label: "P_nguồn NLTT chưa vận hành",
          value: assessment.plannedMw,
          unit: "MW",
          minus: true,
        },
      ]
    : [];

  return (
    <section className="gov-card overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-grad-gov/60 px-4 py-3">
        <span className="flex size-9 items-center justify-center rounded-md bg-success/10 text-success">
          <Leaf className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
            Khả năng tiếp nhận nguồn NLTT
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Công thức EVN: P_tiếp nhận = P_vận hành cho phép + P_phụ tải (11–13h) − P_đã vận hành −
            P_chưa vận hành · lề điện áp +5% (TT 30/2019/TT-BCT)
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
        {/* Đánh giá theo trạm */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground">Trạm biến áp</label>
            <Select value={substationId} onValueChange={setSubstationId}>
              <SelectTrigger className="h-9 w-full max-w-sm text-xs">
                <SelectValue placeholder="Chọn trạm" />
              </SelectTrigger>
              <SelectContent>
                {operatingSubs.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.name} ({s.voltageLevel})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {assessment ? (
            <>
              <div className="rounded-lg border border-border bg-surface p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-navy">{assessment.substationName}</p>
                  <Badge className={STATUS_META[assessment.status].tone}>
                    {STATUS_META[assessment.status].label}
                  </Badge>
                </div>
                <div className="space-y-1">
                  {formulaRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between text-xs text-muted-foreground"
                    >
                      <span>
                        {row.minus ? "− " : ""}
                        {row.label}
                      </span>
                      <span className="font-semibold tabular-nums text-navy">
                        {row.value} {row.unit}
                      </span>
                    </div>
                  ))}
                  <div className="mt-1 flex items-center justify-between border-t border-border pt-2 text-xs">
                    <span className="font-semibold text-navy">Khả năng tiếp nhận còn lại</span>
                    <span
                      className={cn(
                        "font-bold tabular-nums",
                        assessment.absorptionMw <= 0
                          ? "text-destructive"
                          : assessment.status === "limited"
                            ? "text-warning"
                            : "text-success",
                      )}
                    >
                      {assessment.absorptionMw} MW
                    </span>
                  </div>
                </div>
              </div>

              <p className="rounded-md border border-gov/25 bg-gov/5 px-3 py-2 text-xs leading-relaxed text-navy">
                {assessment.recommendation}
              </p>

              {assessment.sources.length ? (
                <DataTable columns={sourceColumns} rows={assessment.sources} searchable={false} pageSize={8} />
              ) : null}
            </>
          ) : null}
        </div>

        {/* Khả năng giải tỏa theo tuyến */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground">Đường dây</label>
            <Select value={lineId} onValueChange={setLineId}>
              <SelectTrigger className="h-9 w-full max-w-sm text-xs">
                <SelectValue placeholder="Chọn tuyến" />
              </SelectTrigger>
              <SelectContent>
                {operatingLines.map((l) => (
                  <SelectItem key={l.id} value={l.id} className="text-xs">
                    {l.name} ({l.voltageLevel})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {curtailment ? (
            <>
              <div className="rounded-lg border border-border bg-surface p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-navy">{curtailment.lineName}</p>
                  <Badge className={STATUS_META[curtailment.status].tone}>
                    {STATUS_META[curtailment.status].label}
                  </Badge>
                </div>
                <div className="space-y-1">
                  {[
                    { label: "Khả năng mang tải tuyến", value: `${curtailment.capacityMw} MW` },
                    { label: "Tải thực tế", value: `${curtailment.currentLoadMw} MW` },
                    {
                      label: "NLTT đang đấu nối",
                      value: `${curtailment.renewablesConnectedMw} MW`,
                    },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between text-xs text-muted-foreground"
                    >
                      <span>{row.label}</span>
                      <span className="font-semibold tabular-nums text-navy">{row.value}</span>
                    </div>
                  ))}
                  <div className="mt-1 flex items-center justify-between border-t border-border pt-2 text-xs">
                    <span className="font-semibold text-navy">Dư địa giải tỏa công suất</span>
                    <span
                      className={cn(
                        "font-bold tabular-nums",
                        curtailment.headroomMw <= 0
                          ? "text-destructive"
                          : curtailment.status === "limited"
                            ? "text-warning"
                            : "text-success",
                      )}
                    >
                      {curtailment.headroomMw} MW
                    </span>
                  </div>
                </div>
              </div>

              <p className="rounded-md border border-gov/25 bg-gov/5 px-3 py-2 text-xs leading-relaxed text-navy">
                {curtailment.recommendation}
              </p>

              <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
                <Timer className="mt-0.5 size-3.5 shrink-0" />
                Nghiệp vụ thẩm định ĐMT mái nhà theo QĐ 2293/QĐ-UBND (27/11/2024): kiểm tra có/không
                gây quá tải trạm biến áp và lưới điện tại khu vực đăng ký, công suất có phù hợp phụ
                tải hiện có (sản lượng tiêu thụ 12 tháng gần nhất).
              </p>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
