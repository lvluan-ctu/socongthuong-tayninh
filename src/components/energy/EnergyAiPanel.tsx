// ============================================================
// AI PHÂN TÍCH & DỰ BÁO — Trang tổng quan năng lượng (/energy)
// Demo: hồi quy tuyến tính + mùa vụ trên chuỗi phụ tải toàn tỉnh
// (tổng hợp từ GRID_LOAD_HISTORY), cảnh báo lấy từ GRID_WARNINGS.
// Kết quả deterministic để mọi ô AI giải thích được. KHÔNG phải model thật.
// ============================================================
import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BrainCircuit,
  Gauge,
  Info,
  Map as MapIcon,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
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
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatCard } from "@/components/common/StatCard";
import { GRID_SUBSTATIONS } from "@/data/grid-mock";
import { getGridWarnings, getLoadHistoryAll } from "@/lib/grid-service";
import { GRID_CONFIG } from "@/lib/grid-types";
import type { ForecastHorizon, GridWarning } from "@/lib/grid-types";
import { cn } from "@/lib/utils";

const PERIODS = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];

const HORIZON_N: Record<ForecastHorizon, number> = {
  "7 ngày": 7,
  "1 tháng": 4,
  Quý: 3,
  "1 năm": 12,
};

const HORIZON_LABEL: Record<ForecastHorizon, string> = {
  "7 ngày": "D",
  "1 tháng": "W",
  Quý: "Q",
  "1 năm": "M",
};

const TREND_META = {
  up: { icon: ArrowUp, className: "text-destructive" },
  down: { icon: ArrowDown, className: "text-success" },
  flat: { icon: ArrowRight, className: "text-muted-foreground" },
} as const;

const RISK_TONE: Record<GridWarning["risk"], string> = {
  Cao: "border-destructive/30 bg-destructive/10 text-destructive",
  "Trung bình": "border-warning/40 bg-warning/15 text-warning",
  Thấp: "border-success/30 bg-success/10 text-success",
};

const RISK_BORDER: Record<GridWarning["risk"], string> = {
  Cao: "border-l-destructive",
  "Trung bình": "border-l-warning",
  Thấp: "border-l-success",
};

const fmt = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);

export interface EnergyAiFocus {
  kind: "substation" | "line";
  id: string;
}

export function EnergyAiPanel({
  focusKey,
  onFocusEntity,
}: {
  focusKey?: string | null;
  onFocusEntity: (focus: EnergyAiFocus) => void;
}) {
  const [horizon, setHorizon] = useState<ForecastHorizon>("Quý");

  const warningsQuery = useQuery({
    queryKey: ["grid", "warnings"],
    queryFn: getGridWarnings,
  });
  const historyQuery = useQuery({
    queryKey: ["grid", "load-history-all"],
    queryFn: getLoadHistoryAll,
  });

  const warnings = warningsQuery.data ?? [];
  const warningColumns: Column<GridWarning>[] = [
    { key: "label", header: "Đối tượng", sortable: true, render: (warning) => <span className={cn("font-medium", `${warning.entityType}:${warning.entityId}` === focusKey ? "text-gov" : "text-navy")}>{warning.label}</span> },
    { key: "entityType", header: "Loại", sortable: true, value: (warning) => warning.entityType === "substation" ? "Trạm biến áp" : "Đường dây" },
    { key: "trend", header: "Xu hướng", sortable: true, render: (warning) => { const TrendIcon = TREND_META[warning.trend].icon; return <TrendIcon className={cn("size-4", TREND_META[warning.trend].className)} />; } },
    { key: "risk", header: "Mức độ", sortable: true, render: (warning) => <Badge variant="outline" className={cn("rounded-md", RISK_TONE[warning.risk])}>{warning.risk}</Badge> },
    { key: "recommendation", header: "Gợi ý", value: (warning) => warning.recommendation, render: (warning) => <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">{warning.recommendation}</span> },
  ];

  // Chuỗi phụ tải toàn tỉnh: cộng dồn tải theo kỳ (T1..T12) của mọi trạm + tuyến.
  const aggregate = useMemo(() => {
    const byPeriod = new Map<string, number>();
    for (const record of historyQuery.data ?? []) {
      byPeriod.set(record.timestamp, (byPeriod.get(record.timestamp) ?? 0) + record.loadMw);
    }
    return PERIODS.map((period) => ({ period, load: byPeriod.get(period) ?? 0 })).filter(
      (row) => row.load > 0,
    );
  }, [historyQuery.data]);

  // Ngưỡng cảnh báo toàn tỉnh: 90% tổng công suất thiết kế của các trạm đang vận hành.
  const capacityMw = useMemo(
    () =>
      GRID_SUBSTATIONS.filter((s) => s.status !== "Quy hoạch").reduce(
        (sum, s) => sum + (s.designCapacity ?? 0),
        0,
      ),
    [],
  );
  const thresholdMw = Math.round((capacityMw * GRID_CONFIG.thresholds.substationLoadWarnPct) / 100);

  // Hồi quy tuyến tính (OLS) trên chuỗi lịch sử, thêm sóng mùa vụ cho kỳ dự báo.
  const analysis = useMemo(() => {
    const values = aggregate.map((row) => row.load);
    const n = values.length;
    if (n < 4) return null;
    const xs = values.map((_, i) => i + 1);
    const xMean = xs.reduce((a, b) => a + b, 0) / n;
    const yMean = values.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i]! - xMean) * (values[i]! - yMean);
      den += (xs[i]! - xMean) ** 2;
    }
    const slope = den === 0 ? 0 : num / den;
    const intercept = yMean - slope * xMean;

    const points: { period: string; actual?: number; base?: number; threshold: number }[] = [];
    const historyStart = Math.max(0, n - 8);
    for (let i = historyStart; i < n; i++) {
      points.push({ period: PERIODS[i]!, actual: values[i]!, threshold: thresholdMw });
    }
    const forecastCount = HORIZON_N[horizon];
    for (let j = 1; j <= forecastCount; j++) {
      const wave = Math.sin((n + j) * 0.6) * 36;
      points.push({
        period: `${HORIZON_LABEL[horizon]}${j}`,
        base: Math.max(0, Math.round(intercept + slope * (n + j) + wave)),
        threshold: thresholdMw,
      });
    }
    const lastActual = values[n - 1]!;
    const prevActual = values[n - 2] ?? lastActual;
    const maxBase = Math.max(...points.filter((p) => p.base !== undefined).map((p) => p.base ?? 0));
    return {
      points,
      lastActual,
      prevActual,
      maxBase,
      growthPerYearPct: (slope * 12) / lastActual,
    };
  }, [aggregate, horizon, thresholdMw]);

  const risky = warnings.filter((w) => w.risk !== "Thấp");
  const riskySubstations = risky.filter((w) => w.entityType === "substation").length;
  const riskyLines = risky.filter((w) => w.entityType === "line").length;
  const riskCounts = {
    high: warnings.filter((w) => w.risk === "Cao").length,
    medium: warnings.filter((w) => w.risk === "Trung bình").length,
    low: warnings.filter((w) => w.risk === "Thấp").length,
  };

  const isLoading = warningsQuery.isLoading || historyQuery.isLoading || !analysis;
  const hasError = warningsQuery.isError || historyQuery.isError;

  return (
    <section className="gov-card flex flex-col overflow-hidden">
      <span className="h-1 bg-gradient-to-r from-analytics via-gov to-teal" />
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-gradient-to-r from-analytics/15 via-transparent to-transparent px-4 py-3">
        <span className="flex size-9 items-center justify-center rounded-md bg-analytics/15 text-analytics">
          <BrainCircuit className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
              AI phân tích &amp; dự báo
            </h2>
            <Badge
              variant="outline"
              className="rounded-md border-analytics/30 bg-analytics/10 text-analytics"
            >
              <Sparkles className="size-3" />
              Bản phân tích AI
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Phân tích dữ liệu vận hành nhằm hỗ trợ dự báo phụ tải, nhận diện nguy cơ quá tải và hỗ
            trợ công tác quản lý năng lượng.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-background p-1">
          {GRID_CONFIG.forecast.horizons.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHorizon(h)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                horizon === h
                  ? "bg-gov text-white shadow-sm"
                  : "text-muted-foreground hover:bg-surface hover:text-navy",
              )}
            >
              {h}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 space-y-4 p-4">
        {isLoading || hasError ? (
          hasError ? (
            <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">
              Không tải được dữ liệu phân tích. Vui lòng thử lại sau.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          )
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Phụ tải hiện tại"
                value={`${fmt(analysis.lastActual)} MW`}
                delta={`▲ ${deltaPct(analysis.lastActual, analysis.prevActual)}% so kỳ trước`}
                icon={Gauge}
                tone="gov"
              />
              <StatCard
                label="Phụ tải dự báo"
                value={`${fmt(analysis.maxBase)} MW`}
                delta={`Cuối kỳ ${horizon}`}
                icon={TrendingUp}
                tone="gov"
              />
              <StatCard
                label="Xu hướng phụ tải"
                value={`+${(analysis.growthPerYearPct * 100).toFixed(1)}%/năm`}
                delta="Tăng trưởng kỳ vọng"
                icon={Activity}
                tone="warning"
              />
              <StatCard
                label="Nguy cơ quá tải"
                value={`${risky.length} đối tượng`}
                delta={`${riskySubstations} trạm · ${riskyLines} tuyến`}
                icon={AlertTriangle}
                tone="danger"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1 font-semibold text-destructive">
                <span className="size-2 rounded-full bg-destructive" />
                {riskCounts.high} nguy hiểm
              </span>
              <span className="flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning/15 px-2.5 py-1 font-semibold text-warning">
                <span className="size-2 rounded-full bg-warning" />
                {riskCounts.medium} trung bình
              </span>
              <span className="flex items-center gap-1.5 rounded-md border border-success/30 bg-success/10 px-2.5 py-1 font-semibold text-success">
                <span className="size-2 rounded-full bg-success" />
                {riskCounts.low} trong giới hạn
              </span>
              <span className="ml-auto text-[11px] text-muted-foreground">
                Mức độ cảnh báo phân theo 3 cấp
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <ChartCard
                title="Dự báo phụ tải"
                subtitle={`Chuỗi phụ tải toàn tỉnh · kỳ dự báo ${horizon}`}
              >
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart
                    data={analysis.points}
                    margin={{ top: 8, right: 8, left: -14, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      domain={[
                        0,
                        (dataMax: number) =>
                          Math.ceil((Math.max(dataMax, thresholdMw) * 1.08) / 10) * 10,
                      ]}
                    />
                    <Tooltip
                      formatter={(value: unknown, name: string) => {
                        if (typeof value !== "number") return [String(value ?? ""), name];
                        const label =
                          name === "actual"
                            ? "Thực tế"
                            : name === "base"
                              ? "Dự báo"
                              : name === "threshold"
                                ? "Ngưỡng"
                                : name;
                        return [`${fmt(value)} MW`, label];
                      }}
                    />
                    <ReferenceLine
                      y={thresholdMw}
                      stroke="#E59A23"
                      strokeDasharray="5 5"
                      label={{ value: "Ngưỡng", position: "insideTopRight", fontSize: 10 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      name="actual"
                      stroke="#94A3B8"
                      strokeWidth={2}
                      dot={{ r: 2.5 }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="base"
                      name="base"
                      stroke="#1565C0"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
                  <LegendDot color="#94A3B8" label="Thực tế" />
                  <LegendDot color="#1565C0" label="Dự báo" />
                  <LegendDot color="#E59A23" dashed label="Ngưỡng cảnh báo" />
                  <span className="ml-auto">
                    Ngưỡng = {GRID_CONFIG.thresholds.substationLoadWarnPct}% công suất toàn tỉnh
                  </span>
                </div>
              </ChartCard>

              <div className="space-y-4">
                <section className="gov-card flex flex-col">
                  <header className="flex items-center gap-2 border-b border-border px-4 py-3">
                    <span className="flex size-8 items-center justify-center rounded-md bg-gov/10 text-gov">
                      <Sparkles className="size-4.5" />
                    </span>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-navy">
                      Nhận định AI
                    </h3>
                  </header>
                  <div className="space-y-3 p-4 text-xs leading-5">
                    <p className="rounded-md border border-gov/30 bg-gov/5 px-3 py-2.5 text-navy">
                      Tải toàn tỉnh hiện ở mức{" "}
                      <span className="font-semibold">{fmt(analysis.lastActual)} MW</span>, dự báo
                      đạt <span className="font-semibold">{fmt(analysis.maxBase)} MW</span> vào cuối
                      kỳ {horizon} (tăng trưởng kỳ vọng{" "}
                      <span className="font-semibold">
                        +{(analysis.growthPerYearPct * 100).toFixed(1)}%/năm
                      </span>
                      ).
                    </p>
                    <p className="text-muted-foreground">
                      Phụ tải có xu hướng tăng trong kỳ dự báo. Một số trạm và tuyến điện cần được
                      tiếp tục theo dõi về khả năng mang tải.
                    </p>
                    <p className="rounded-md border border-border bg-surface px-3 py-2.5 text-muted-foreground">
                      Gợi ý cán bộ chuyên môn kiểm tra các đối tượng có mức tải tiến gần ngưỡng cảnh
                      báo.
                    </p>
                  </div>
                </section>
              </div>
            </div>

            <section className="gov-card overflow-hidden">
              <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                <span className="flex size-8 items-center justify-center rounded-md bg-warning/15 text-warning">
                  <MapIcon className="size-4.5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-navy">
                    Đối tượng cần quan tâm
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Chọn một đối tượng để bản đồ zoom đến vị trí tương ứng.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="ml-auto shrink-0 rounded-md border-warning/40 bg-warning/15 text-warning"
                >
                  {risky.length} cảnh báo
                </Badge>
              </header>
              <div className="p-3">
                <DataTable columns={warningColumns} rows={warnings} pageSize={8} searchPlaceholder="Tìm đối tượng cảnh báo…" emptyText="Chưa có cảnh báo nào cho kỳ hiện tại" onRowClick={(warning) => onFocusEntity({ kind: warning.entityType, id: warning.entityId })} />
              </div>
            </section>

            <p className="flex items-start gap-1.5 text-[11px] leading-5 text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0 opacity-60" />
              Kết quả phân tích và dự báo chỉ hỗ trợ công tác chuyên môn, không thay thế việc kiểm
              tra số liệu và quyết định của cơ quan có thẩm quyền.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="gov-card flex flex-col">
      <header className="flex flex-col gap-1 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-navy">{title}</h3>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </header>
      <div className="flex-1 p-4">{children}</div>
    </section>
  );
}

function LegendDot({
  color,
  label,
  dashed = false,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={cn("size-2.5 rounded-full", dashed && "rounded-none")}
        style={dashed ? { borderTop: `2px dashed ${color}`, height: 2 } : { background: color }}
      />
      {label}
    </span>
  );
}

function deltaPct(current: number, previous: number): string {
  if (!previous) return "0,0";
  return ((current / previous - 1) * 100).toFixed(1).replace(".", ",");
}
