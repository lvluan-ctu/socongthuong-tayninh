import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  BrainCircuit,
  Check,
  Database,
  FilePlus2,
  History,
  Loader2,
  Map as MapIcon,
  ScrollText,
  Send,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/common/DataTable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkflowStatusBadge } from "@/components/grid/GridShared";
import { getAiForecast, getAreaForecast } from "@/lib/grid-service";
import { GRID_CONFIG } from "@/lib/grid-types";
import type {
  AiFactorSource,
  AiForecastResult,
  ForecastHorizon,
  ForecastScenarioKey,
  GridPlanProposal,
  GridPowerLine,
  GridSubstation,
  LoadArea,
} from "@/lib/grid-types";
import { cn } from "@/lib/utils";

const SOURCE_META: Record<AiFactorSource, { label: string; icon: typeof Database; tone: string }> =
  {
    history: { label: "Lịch sử", icon: History, tone: "border-gov/30 bg-gov/10 text-gov" },
    gis: { label: "GIS", icon: MapIcon, tone: "border-warning/40 bg-warning/15 text-warning" },
    stats: {
      label: "Thống kê",
      icon: Database,
      tone: "border-border bg-surface text-muted-foreground",
    },
  };

const KIND_LABEL: Record<GridPlanProposal["kind"], string> = {
  upgrade: "Nâng công suất",
  rebalance: "San tải",
  monitor: "Theo dõi",
  new_line: "Đầu tư tuyến mới",
};

export function GridAiForecast({
  substations,
  lines,
  loadAreas,
}: {
  substations: GridSubstation[];
  lines: GridPowerLine[];
  loadAreas?: LoadArea[];
}) {
  const options = useMemo(() => {
    const subs = substations
      .filter((s) => s.status !== "Quy hoạch")
      .map((s) => ({
        id: s.id,
        type: "substation" as const,
        label: `${s.name} (${s.voltageLevel})`,
      }));
    const ls = lines
      .filter((l) => l.status !== "Quy hoạch")
      .map((l) => ({ id: l.id, type: "line" as const, label: `${l.name} (${l.voltageLevel})` }));
    return [...subs, ...ls];
  }, [substations, lines]);

  const [entityId, setEntityId] = useState<string>(options[0]?.id ?? "");
  const [horizon, setHorizon] = useState<ForecastHorizon>(GRID_CONFIG.forecast.horizons[0]);
  const [proposals, setProposals] = useState<GridPlanProposal[]>([]);
  const nextId = useRef(1);

  const selected = options.find((o) => o.id === entityId);
  const forecastQuery = useQuery({
    queryKey: ["grid", "ai-forecast", selected?.type ?? "substation", entityId, horizon],
    queryFn: () => getAiForecast(entityId, selected?.type ?? "substation", horizon),
    enabled: Boolean(entityId && selected),
  });

  const data = forecastQuery.data;
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.points.map((p) => {
      const band =
        p.base !== undefined && p.min !== undefined && p.max !== undefined
          ? p.max - p.min
          : undefined;
      return {
        ...p,
        ...(band !== undefined ? { band } : {}),
      };
    });
  }, [data]);

  const handleCreateProposal = () => {
    if (!data || data.insufficient) return;
    const kind: GridPlanProposal["kind"] =
      data.entityType === "line" && data.risk === "Cao"
        ? "new_line"
        : data.risk === "Cao"
          ? "upgrade"
          : data.risk === "Trung bình"
            ? "rebalance"
            : "monitor";
    const proposal: GridPlanProposal = {
      id: `dx-${nextId.current++}`,
      entityId: data.entityId,
      entityType: data.entityType,
      entityLabel: data.entityLabel,
      title: `${KIND_LABEL[kind]} — ${data.entityLabel}`,
      kind,
      workflowStatus: "DRAFT",
      createdAt: new Date().toLocaleDateString("vi-VN"),
      summary: `Kỳ dự báo: ${data.horizon} · Rủi ro ${data.risk} · Tải dự kiến cao nhất ${Math.max(
        ...data.points.filter((p) => p.base !== undefined).map((p) => p.base ?? 0),
      )} MW`,
    };
    setProposals((prev) => [proposal, ...prev]);
    toast.success(`Đã tạo đề xuất "${proposal.title}" (Nháp).`);
  };

  const setProposalStatus = (id: string, workflowStatus: GridPlanProposal["workflowStatus"]) => {
    const label =
      workflowStatus === "PENDING"
        ? "Đã trình duyệt đề xuất."
        : workflowStatus === "APPROVED"
          ? "Đã duyệt đề xuất."
          : "Đã trả về đề xuất.";
    setProposals((prev) => prev.map((p) => (p.id === id ? { ...p, workflowStatus } : p)));
    toast.success(label);
  };

  return (
    <div className="space-y-4">
      <section className="gov-card flex flex-col overflow-hidden">
        <header className="flex flex-wrap items-center gap-3 border-b border-border bg-grad-gov/60 px-4 py-3">
          <span className="flex size-9 items-center justify-center rounded-md bg-gov/10 text-gov">
            <BrainCircuit className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
                AI hỗ trợ dự báo
              </h2>
              <Badge variant="outline" className="rounded-md border-gov/30 bg-gov/10 text-gov">
                <Sparkles className="size-3" />
                Bản phân tích AI
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Hồi quy tuyến tính + phân rã mùa vụ trên 12 kỳ lịch sử tải, hiệu chỉnh bởi dữ liệu GIS
              và thống kê lưới
            </p>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-3">
          <Select value={entityId} onValueChange={setEntityId}>
            <SelectTrigger className="h-8 w-64 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={horizon} onValueChange={(v) => setHorizon(v as ForecastHorizon)}>
            <SelectTrigger className="h-8 w-28 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GRID_CONFIG.forecast.horizons.map((h) => (
                <SelectItem key={h} value={h}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-2">
            {data && !data.insufficient ? <RiskBadge risk={data.risk} /> : null}
            <Button size="sm" onClick={handleCreateProposal} disabled={!data || data.insufficient}>
              <FilePlus2 />
              Tạo đề xuất
            </Button>
          </div>
        </div>

        <div className="flex-1 p-4">
          {forecastQuery.isLoading || !data ? (
            <div className="grid h-64 place-items-center text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Đang phân tích dữ liệu lịch sử...
              </span>
            </div>
          ) : data.insufficient ? (
            <div className="grid h-64 place-items-center">
              <div className="max-w-md space-y-2 text-center">
                <BrainCircuit className="mx-auto size-8 text-muted-foreground" />
                <p className="text-sm font-semibold text-navy">Chưa đủ dữ liệu để dự báo</p>
                <p className="text-xs leading-5 text-muted-foreground">{data.note}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <InputSummary data={data} />
              <ForecastChart data={data} chartData={chartData} />
              <ScenarioRow scenarios={data.scenarios} horizon={data.horizon} />
              <ForecastTable data={data} />
              <FactorsPanel factors={data.factors} />
              <RecommendationBox data={data} />
            </div>
          )}
        </div>
      </section>

      <section className="gov-card flex flex-col">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="flex size-8 items-center justify-center rounded-md bg-gov/10 text-gov">
            <ScrollText className="size-4.5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
              Đề xuất từ AI
            </h2>
            <p className="text-xs text-muted-foreground">
              Luồng phê duyệt: Nháp → Trình duyệt → Duyệt / Trả về
            </p>
          </div>
          <Badge variant="outline" className="ml-auto shrink-0 rounded-md bg-surface">
            {proposals.length} đề xuất
          </Badge>
        </header>
        <div className="max-h-[320px] space-y-2 overflow-y-auto p-3">
          {proposals.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Chưa có đề xuất. Chọn đối tượng &amp; nhấn <b>Tạo đề xuất</b> để mô phỏng luồng phê
              duyệt.
            </p>
          ) : (
            proposals.map((p) => (
              <article key={p.id} className="rounded-md border border-border bg-surface p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-md bg-background">
                    {KIND_LABEL[p.kind]}
                  </Badge>
                  <span className="text-xs font-semibold text-navy">{p.title}</span>
                  <span className="ml-auto">
                    <WorkflowStatusBadge status={p.workflowStatus} />
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{p.summary}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Tạo {p.createdAt} · {p.entityLabel}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {p.workflowStatus === "DRAFT" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setProposalStatus(p.id, "PENDING")}
                    >
                      <Send />
                      Trình duyệt
                    </Button>
                  ) : null}
                  {p.workflowStatus === "PENDING" ? (
                    <>
                      <Button size="sm" onClick={() => setProposalStatus(p.id, "APPROVED")}>
                        <Check />
                        Duyệt
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setProposalStatus(p.id, "RETURNED")}
                      >
                        <Undo2 />
                        Trả về
                      </Button>
                    </>
                  ) : null}
                  {p.workflowStatus === "RETURNED" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setProposalStatus(p.id, "PENDING")}
                    >
                      <Send />
                      Gửi lại
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      setProposals((prev) => prev.filter((x) => x.id !== p.id));
                      toast.info(`Đã xóa đề xuất "${p.title}".`);
                    }}
                  >
                    <Trash2 />
                    Xoá
                  </Button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <AreaForecastCard loadAreas={loadAreas ?? []} />
    </div>
  );
}

function AreaForecastCard({ loadAreas }: { loadAreas: LoadArea[] }) {
  const [areaId, setAreaId] = useState<string>(loadAreas[0]?.id ?? "");
  const query = useQuery({
    queryKey: ["grid", "area-forecast", areaId],
    queryFn: () => getAreaForecast(areaId),
    enabled: Boolean(areaId),
  });
  const data = query.data;

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.points.map((p) => ({
      period: p.period,
      actual: p.actual,
      base: p.base,
      band: p.min !== undefined && p.max !== undefined ? p.max - p.min : undefined,
    }));
  }, [data]);

  return (
    <section className="gov-card flex flex-col overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-grad-gov/60 px-4 py-3">
        <span className="flex size-9 items-center justify-center rounded-md bg-warning/10 text-warning">
          <MapIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
            Dự báo phụ tải theo khu vực
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            24 tháng · 12 tháng lịch sử + 12 tháng dự báo (tăng trưởng 6%/năm + mùa vụ) · hỗ trợ
            định hướng quy hoạch phát triển lưới điện giai đoạn tới
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-3">
        <label className="text-xs font-semibold text-muted-foreground">Khu vực phụ tải</label>
        <Select value={areaId} onValueChange={setAreaId}>
          <SelectTrigger className="h-8 w-72 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {loadAreas.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {data ? (
            <>
              <SummaryChip label="Phụ tải đỉnh hiện tại" value={`${data.peakMw} MW`} />
              <SummaryChip label="Tăng trưởng/năm" value={`${data.growthPerYearPct}%`} />
              <RiskBadge risk={data.risk} />
            </>
          ) : null}
        </div>
      </div>

      <div className="flex-1 p-4">
        {query.isLoading || !data ? (
          <div className="grid h-64 place-items-center text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Đang tính dự báo theo khu vực...
            </span>
          </div>
        ) : (
          <div className="space-y-4">
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaConfGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E59A23" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#E59A23" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  domain={[
                    0,
                    (dataMax: number) => Math.max(10, Math.ceil((dataMax * 1.1) / 10) * 10),
                  ]}
                />
                <Tooltip
                  formatter={(value: unknown, name: string) => {
                    if (typeof value !== "number") return [String(value ?? ""), name];
                    const label =
                      name === "actual" ? "Thực tế" : name === "base" ? "Dự báo" : "Khoảng tin cậy";
                    return [`${value} MW`, label];
                  }}
                />
                <Area
                  stackId="conf"
                  type="monotone"
                  dataKey="band"
                  stroke="none"
                  fill="url(#areaConfGrad)"
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="actual"
                  stroke="#94A3B8"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="base"
                  name="base"
                  stroke="#E59A23"
                  strokeWidth={2.5}
                  dot={{ r: 2.5 }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="text-[11px] leading-5 text-muted-foreground">
              <span className="font-semibold text-navy">Nhận định: </span>
              {data.note}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────── Các phần con ───────────────────────────

function InputSummary({ data }: { data: AiForecastResult }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <SummaryChip label="Chuỗi lịch sử" value={`${data.inputSummary.nPeriods} kỳ`} />
      <SummaryChip
        label="Tải thực tế gần nhất"
        value={`${data.inputSummary.lastActualMw ?? 0} MW (${data.inputSummary.lastLoadFactorPct ?? 0}%)`}
      />
      <SummaryChip label="Tăng trưởng/năm" value={`${data.inputSummary.growthPerYearPct}%`} />
      <SummaryChip label="Độ tin cậy" value={`${data.confidencePct}%`} />
    </div>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-navy">{value}</p>
    </div>
  );
}

interface ChartDatum {
  period: string;
  actual?: number;
  base?: number;
  min?: number;
  max?: number;
  threshold?: number;
  band?: number;
}

function ForecastChart({ data, chartData }: { data: AiForecastResult; chartData: ChartDatum[] }) {
  const unit = data.unit;
  const threshold = chartData.find((p) => p.threshold !== undefined)?.threshold ?? 0;
  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
          <defs>
            <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1565C0" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#1565C0" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="period" tick={{ fontSize: 10 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            domain={[0, (dataMax: number) => Math.max(10, Math.ceil((dataMax * 1.1) / 10) * 10)]}
          />
          <Tooltip
            formatter={(value: unknown, name: string) => {
              if (typeof value !== "number") return [String(value ?? ""), name];
              const label =
                name === "actual"
                  ? "Thực tế"
                  : name === "base"
                    ? "Dự báo"
                    : name === "min"
                      ? "Cận dưới"
                      : name === "max"
                        ? "Cận trên"
                        : name;
              return [`${value} ${unit}`, label];
            }}
          />
          <ReferenceLine
            y={threshold}
            stroke="#E59A23"
            strokeDasharray="5 5"
            label={{ value: "Ngưỡng", position: "insideTopRight", fontSize: 10 }}
          />
          <Area
            stackId="conf"
            type="monotone"
            dataKey="min"
            stroke="none"
            fill="url(#confGrad)"
            connectNulls
          />
          <Area
            stackId="conf"
            type="monotone"
            dataKey="band"
            stroke="none"
            fill="transparent"
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="actual"
            name="actual"
            stroke="#94A3B8"
            strokeWidth={2}
            dot={{ r: 2 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="base"
            name="base"
            stroke="#1565C0"
            strokeWidth={2.5}
            dot={{ r: 2.5 }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-1 text-[11px] text-muted-foreground">
        <span className="font-semibold text-navy">Phương pháp:</span> {data.method}. Vùng mờ là
        khoảng tin cậy {data.confidencePct}% (dựa trên độ phân tán phần dư của hồi quy).
      </p>
    </div>
  );
}

function ScenarioRow({
  scenarios,
  horizon,
}: {
  scenarios: AiForecastResult["scenarios"];
  horizon: ForecastHorizon;
}) {
  const order: ForecastScenarioKey[] = ["low", "base", "high"];
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy">
        Kịch bản cuối kỳ
      </p>
      <div className="grid grid-cols-3 gap-2">
        {order.map((key) => {
          const s = scenarios[key];
          const tone =
            key === "low"
              ? "border-success/30 bg-success/10 text-success"
              : key === "base"
                ? "border-gov/30 bg-gov/10 text-gov"
                : "border-destructive/30 bg-destructive/10 text-destructive";
          return (
            <div key={key} className={cn("rounded-md border px-3 py-2", tone)}>
              <p className="text-[11px] opacity-80">{s.label}</p>
              <p className="mt-0.5 text-base font-semibold">
                {s.value} <span className="text-[11px] font-normal">MW</span>
              </p>
              <p className="text-[10px] opacity-70">tại kỳ {horizon}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ForecastTable({ data }: { data: AiForecastResult }) {
  type ForecastRow = AiForecastResult["points"][number] & { id: string };
  const rows: ForecastRow[] = data.points
    .slice(data.points.findIndex((point) => point.base !== undefined))
    .map((point, index) => ({ ...point, id: `${point.period}-${index}` }));
  const statusFor = (point: ForecastRow) =>
    (point.base ?? 0) >= data.inputSummary.capacityMw
      ? { label: "Vượt ngưỡng", tone: "border-destructive/30 bg-destructive/10 text-destructive" }
      : (point.base ?? 0) >= (point.threshold ?? 0)
        ? { label: "Gần ngưỡng", tone: "border-warning/40 bg-warning/15 text-warning" }
        : { label: "Trong ngưỡng", tone: "border-success/30 bg-success/10 text-success" };
  const columns: Column<ForecastRow>[] = [
    { key: "period", header: "Kỳ", sortable: true, className: "font-semibold text-navy" },
    { key: "base", header: "Dự báo (MW)", sortable: true, value: (point) => point.base ?? 0, className: "tabular-nums" },
    { key: "interval", header: "Khoảng tin cậy (MW)", value: (point) => `${point.min} – ${point.max}`, className: "tabular-nums text-muted-foreground" },
    { key: "threshold", header: "So ngưỡng", value: (point) => statusFor(point).label, render: (point) => { const status = statusFor(point); return <Badge variant="outline" className={cn("rounded-md", status.tone)}>{status.label}</Badge>; } },
  ];
  return (
    <DataTable columns={columns} rows={rows} pageSize={8} searchable={false} />
  );
}

function FactorsPanel({ factors }: { factors: AiForecastResult["factors"] }) {
  const maxImpact = Math.max(1, ...factors.map((f) => Math.abs(f.impactPct)));
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy">
        Phân tích yếu tố ảnh hưởng
      </p>
      <div className="space-y-2">
        {factors.map((f) => {
          const meta = SOURCE_META[f.source];
          const Icon = meta.icon;
          const positive = f.effect === "up";
          return (
            <div key={f.id} className="rounded-md border border-border bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn("rounded-md", meta.tone)}>
                  <Icon className="size-3" />
                  {meta.label}
                </Badge>
                <span className="flex items-center gap-1 text-xs font-semibold text-navy">
                  {positive ? (
                    <ArrowUp className="size-3.5 text-destructive" />
                  ) : (
                    <ArrowDown className="size-3.5 text-success" />
                  )}
                  {positive ? "+" : "−"}
                  {f.impactPct}%
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{f.label}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", positive ? "bg-destructive" : "bg-success")}
                  style={{ width: `${(Math.abs(f.impactPct) / maxImpact) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecommendationBox({ data }: { data: AiForecastResult }) {
  return (
    <div className="rounded-md border border-gov/30 bg-gov/5 px-4 py-3">
      <p className="flex items-start gap-1.5 text-xs leading-5 text-navy">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-gov" />
        <span>
          <span className="font-semibold">Nhận định AI: </span>
          {data.recommendation}
        </span>
      </p>
      <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">{data.note}</p>
    </div>
  );
}

function RiskBadge({ risk }: { risk: "Thấp" | "Trung bình" | "Cao" }) {
  const tone =
    risk === "Cao"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : risk === "Trung bình"
        ? "border-warning/40 bg-warning/15 text-warning"
        : "border-success/30 bg-success/10 text-success";
  return (
    <Badge variant="outline" className={cn("rounded-md font-medium", tone)}>
      Rủi ro {risk}
    </Badge>
  );
}
