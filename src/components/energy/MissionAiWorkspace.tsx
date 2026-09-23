"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  FileText,
  Gauge,
  History,
  Play,
  RefreshCw,
  Settings2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { ChartCard } from "@/components/common/ChartCard";
import { DataTable, type Column } from "@/components/common/DataTable";
import { MarkdownReport } from "@/components/common/MarkdownReport";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router-compat";
import type {
  MissionAiAlert,
  MissionAiConfig,
  MissionAiHistoryItem,
  MissionAiResult,
  MissionAiScenario,
} from "@/lib/mission-ai";
import { getMissionAiConfig } from "@/lib/mission-ai";
import { cn } from "@/lib/utils";

type RuntimeStatus = { enabled: boolean; mock: boolean; endpointConfigured: boolean };
type HistoryResponse = {
  items?: MissionAiHistoryItem[];
  config?: MissionAiConfig;
  runtime?: RuntimeStatus;
  message?: string;
};
type RunResponse = { jobId?: string; status?: string; result?: MissionAiResult; message?: string };

type StoredResult = {
  generatedAt: string | null;
  dataCutoff: string | null;
  horizonValue: number | null;
  confidenceValue: string | null;
  summary: Record<string, unknown>;
  series: unknown[];
  alerts: unknown[];
  tableData: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

type DetailResponse = {
  job?: MissionAiHistoryItem;
  result?: StoredResult | null;
  message?: string;
};

const SCENARIOS: Array<{ value: MissionAiScenario; label: string; description: string }> = [
  { value: "baseline", label: "Cơ sở", description: "Giữ xu hướng hiện tại" },
  { value: "growth", label: "Tăng trưởng", description: "Tăng 8% so với xu hướng" },
  { value: "efficiency", label: "Hiệu quả", description: "Giảm 5% nhờ tối ưu" },
];

const ALERT_STYLES = {
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  warning: "border-warning/40 bg-warning/10 text-warning",
  info: "border-gov/30 bg-gov/10 text-gov",
};

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function restoreResult(job: MissionAiHistoryItem, stored: StoredResult): MissionAiResult {
  const summary = asRecord(stored.summary);
  const metadata = asRecord(stored.metadata);
  const table = asRecord(stored.tableData);
  const provenance = asRecord(metadata.provenance);
  return {
    requestId: job.requestId,
    generatedAt: stored.generatedAt ?? job.completedAt ?? job.createdAt,
    dataCutoff: stored.dataCutoff ?? job.createdAt,
    mode: metadata.mode === "EXTERNAL" ? "EXTERNAL" : "MOCK",
    model: { name: job.modelName ?? "—", version: job.modelVersion ?? "—" },
    horizon: stored.horizonValue ?? 0,
    confidence: number(stored.confidenceValue),
    metricTitle: String(metadata.metricTitle ?? "Chỉ tiêu dự báo"),
    unit: String(metadata.unit ?? ""),
    summary: {
      headline: String(summary.headline ?? "Kết quả phân tích AI"),
      currentValue: number(summary.currentValue),
      forecastValue: number(summary.forecastValue),
      changePct: number(summary.changePct),
      riskCount: number(summary.riskCount),
      report: String(summary.report ?? "Chưa có nội dung báo cáo."),
    },
    series: Array.isArray(stored.series) ? (stored.series as MissionAiResult["series"]) : [],
    alerts: Array.isArray(stored.alerts) ? (stored.alerts as MissionAiAlert[]) : [],
    recommendations: Array.isArray(table.recommendations) ? table.recommendations.map(String) : [],
    provenance: {
      sourceRecords: number(provenance.sourceRecords),
      inferredRecords: number(provenance.inferredRecords),
      observations: number(provenance.observations),
      notes: Array.isArray(provenance.notes) ? provenance.notes.map(String) : [],
    },
  };
}

function fmt(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits }).format(value);
}

function fmtTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function chartPeriod(value: string) {
  if (!value.includes("T")) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

function statusLabel(status: string) {
  if (status === "SUCCESS") return "Hoàn tất";
  if (status === "FAILED") return "Thất bại";
  if (status === "PROCESSING") return "Đang xử lý";
  return "Đang chờ";
}

export function MissionAiWorkspace({ taskId }: { taskId: number }) {
  const fallbackConfig = getMissionAiConfig(taskId);
  const [config, setConfig] = useState<MissionAiConfig | null>(fallbackConfig);
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [history, setHistory] = useState<MissionAiHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [queryType, setQueryType] = useState(fallbackConfig?.queryTypes[0]?.value ?? "");
  const [horizon, setHorizon] = useState(6);
  const [confidence, setConfidence] = useState(90);
  const [scenario, setScenario] = useState<MissionAiScenario>("baseline");
  const [prompt, setPrompt] = useState(fallbackConfig?.queryTypes[0]?.prompt ?? "");
  const [result, setResult] = useState<MissionAiResult | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const reloadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch(`/api/energy/tasks/${taskId}/ai?limit=30`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as HistoryResponse;
      if (!response.ok) throw new Error(payload.message ?? "Không thể tải lịch sử AI.");
      setHistory(payload.items ?? []);
      if (payload.config) setConfig(payload.config);
      if (payload.runtime) setRuntime(payload.runtime);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải lịch sử AI.");
    } finally {
      setHistoryLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void reloadHistory();
  }, [reloadHistory]);

  const selectQuery = (value: string) => {
    setQueryType(value);
    const selected = config?.queryTypes.find((item) => item.value === value);
    if (selected) setPrompt(selected.prompt);
  };

  const runAnalysis = async () => {
    setRunning(true);
    setError("");
    try {
      const response = await fetch(`/api/energy/tasks/${taskId}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queryType, horizon, confidence, scenario, prompt }),
      });
      const payload = (await response.json()) as RunResponse;
      if (!response.ok || !payload.result)
        throw new Error(payload.message ?? "Không thể thực hiện dự báo AI.");
      setResult(payload.result);
      setActiveJobId(payload.jobId ?? null);
      await reloadHistory();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể thực hiện dự báo AI.");
    } finally {
      setRunning(false);
    }
  };

  const openHistory = async (jobId: string) => {
    setError("");
    setActiveJobId(jobId);
    try {
      const response = await fetch(
        `/api/energy/tasks/${taskId}/ai?jobId=${encodeURIComponent(jobId)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as DetailResponse;
      if (!response.ok || !payload.job || !payload.result)
        throw new Error(payload.message ?? "Lần chạy này chưa có kết quả.");
      setResult(restoreResult(payload.job, payload.result));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể mở kết quả AI.");
    }
  };

  const chartData = useMemo(
    () =>
      result?.series.map((point) => ({
        ...point,
        period: chartPeriod(point.period),
      })) ?? [],
    [result],
  );
  const isComparisonChart = [3, 4, 6].includes(taskId);
  const chartOption = useMemo<EChartsOption>(() => {
    const categories = chartData.map((point) => point.period);
    const baseSeries = isComparisonChart
      ? [
          {
            name: "Dữ liệu hiện có",
            type: "bar" as const,
            data: chartData.map((point) => point.actual),
            itemStyle: { color: "#0891b2", borderRadius: [6, 6, 0, 0] },
            barMaxWidth: 72,
          },
          {
            name: "Dự báo / đề xuất",
            type: "bar" as const,
            data: chartData.map((point) => point.forecast),
            itemStyle: { color: "#e59a23", borderRadius: [6, 6, 0, 0] },
            barMaxWidth: 72,
          },
        ]
      : [
          {
            name: "Thực tế",
            type: "line" as const,
            data: chartData.map((point) => point.actual),
            smooth: true,
            connectNulls: true,
            symbolSize: chartData.length <= 48 ? 6 : 2,
            lineStyle: { width: 3, color: "#0891b2" },
            itemStyle: { color: "#0891b2" },
          },
          {
            name: "Dự báo AI",
            type: "line" as const,
            data: chartData.map((point) => point.forecast),
            smooth: true,
            connectNulls: true,
            symbolSize: chartData.length <= 48 ? 6 : 2,
            lineStyle: { width: 3, type: "dashed" as const, color: "#e59a23" },
            itemStyle: { color: "#e59a23" },
          },
          {
            name: "Cận dưới",
            type: "line" as const,
            data: chartData.map((point) => point.min),
            smooth: true,
            connectNulls: true,
            showSymbol: false,
            lineStyle: { width: 1.5, type: "dotted" as const, color: "#f59e0b" },
            itemStyle: { color: "#f59e0b" },
          },
          {
            name: "Cận trên",
            type: "line" as const,
            data: chartData.map((point) => point.max),
            smooth: true,
            connectNulls: true,
            showSymbol: false,
            lineStyle: { width: 1.5, type: "dotted" as const, color: "#ef4444" },
            itemStyle: { color: "#ef4444" },
          },
        ];
    return {
      animationDuration: 550,
      aria: { enabled: true, decal: { show: true } },
      legend: { top: 4, textStyle: { color: "#475569", fontSize: 12 } },
      grid: {
        left: 76,
        right: 24,
        top: 52,
        bottom: chartData.length > 48 ? 72 : 52,
        containLabel: false,
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(15, 23, 42, 0.94)",
        borderWidth: 0,
        textStyle: { color: "#f8fafc" },
        valueFormatter: (value) => `${fmt(Number(value))}${result?.unit ? ` ${result.unit}` : ""}`,
      },
      xAxis: {
        type: "category",
        data: categories,
        boundaryGap: isComparisonChart,
        axisLabel: {
          color: "#64748b",
          fontSize: 10,
          rotate: categories.length > 8 ? 28 : 0,
          hideOverlap: true,
        },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        axisTick: { alignWithLabel: true },
      },
      yAxis: {
        type: "value",
        name: result?.unit ?? "",
        nameTextStyle: { color: "#64748b", padding: [0, 0, 8, 0] },
        axisLabel: {
          color: "#64748b",
          formatter: (value: number) =>
            new Intl.NumberFormat("vi-VN", { notation: "compact" }).format(value),
        },
        splitLine: { lineStyle: { color: "#e2e8f0", type: "dashed" } },
      },
      dataZoom:
        chartData.length > 48
          ? [
              { type: "inside", start: 0, end: 35 },
              {
                type: "slider",
                height: 20,
                bottom: 12,
                borderColor: "#cbd5e1",
                fillerColor: "rgba(8,145,178,.14)",
              },
            ]
          : undefined,
      series: baseSeries,
    };
  }, [chartData, isComparisonChart, result?.unit]);

  const downloadReport = () => {
    if (!result) return;
    const blob = new Blob([result.summary.report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bao-cao-ai-nhiem-vu-${taskId}-${result.generatedAt.slice(0, 10)}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const historyColumns: Column<MissionAiHistoryItem>[] = [
    {
      key: "createdAt",
      header: "Thời gian",
      sortable: true,
      value: (item) => item.createdAt,
      render: (item) => (
        <>
          <div className="font-medium text-navy">{fmtTime(item.createdAt)}</div>
          <div className="font-mono text-[11px] text-muted-foreground">{item.id.slice(0, 8)}</div>
        </>
      ),
    },
    {
      key: "queryType",
      header: "Loại truy vấn",
      sortable: true,
      value: (item) => String(asRecord(item.inputSnapshot).queryType ?? "—"),
      render: (item) => {
        const input = asRecord(item.inputSnapshot);
        const label =
          config?.queryTypes.find((candidate) => candidate.value === input.queryType)?.label ??
          String(input.queryType ?? "—");
        return (
          <>
            <div>{label}</div>
            <div className="text-xs text-muted-foreground">
              {number(input.horizon)} kỳ · {number(input.confidence)}%
            </div>
          </>
        );
      },
    },
    {
      key: "status",
      header: "Trạng thái",
      sortable: true,
      render: (item) => (
        <Badge
          variant="outline"
          className={cn(
            "rounded-md",
            item.status === "SUCCESS"
              ? "border-success/30 bg-success/10 text-success"
              : item.status === "FAILED"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-warning/30 bg-warning/10 text-warning",
          )}
        >
          {item.status === "SUCCESS" ? (
            <CheckCircle2 className="size-3" />
          ) : (
            <Clock3 className="size-3" />
          )}
          {statusLabel(item.status)}
        </Badge>
      ),
    },
    {
      key: "modelName",
      header: "Mô hình",
      sortable: true,
      value: (item) => item.modelName ?? "—",
      render: (item) => (
        <>
          <div className="font-medium">{item.modelName ?? "—"}</div>
          <div className="text-xs text-muted-foreground">{item.modelVersion ?? "—"}</div>
        </>
      ),
    },
    {
      key: "latencyMs",
      header: "Độ trễ",
      sortable: true,
      value: (item) => item.latencyMs ?? 0,
      render: (item) =>
        item.latencyMs == null ? "—" : `${item.latencyMs.toLocaleString("vi-VN")} ms`,
    },
    {
      key: "isMock",
      header: "Chế độ",
      sortable: true,
      value: (item) => (item.isMock ? "Mô phỏng" : "AI thật"),
      render: (item) => (
        <Badge variant="outline" className="rounded-md">
          {item.isMock ? "Mô phỏng" : "AI thật"}
        </Badge>
      ),
    },
    {
      key: "action",
      header: "",
      render: (item) => (
        <Button
          variant="outline"
          size="sm"
          disabled={item.status !== "SUCCESS"}
          onClick={() => void openHistory(item.id)}
        >
          Mở kết quả
        </Button>
      ),
    },
  ];

  if (!config) return <div className="p-8 text-sm text-destructive">Nhiệm vụ không tồn tại.</div>;

  return (
    <div className="min-h-full bg-surface">
      <PageHeader
        title={config.title}
        description={config.description}
        variant="panel"
        icon={BrainCircuit}
        crumbs={[
          { label: "Năng lượng", to: "/energy" },
          { label: `Nhiệm vụ ${taskId}`, to: `/energy/nhiem-vu-${taskId}` },
          { label: "Dự báo AI" },
        ]}
        actions={
          <>
            <Badge
              variant="outline"
              className={cn(
                "rounded-md",
                runtime?.mock
                  ? "border-warning/40 bg-warning/10 text-warning"
                  : "border-success/30 bg-success/10 text-success",
              )}
            >
              <Sparkles className="size-3" />{" "}
              {runtime?.mock ? "Mô phỏng có kiểm soát" : "AI Service"}
            </Badge>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/energy/nhiem-vu-${taskId}`}>
                <TrendingUp className="size-4" /> Về dashboard
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/energy/nhiem-vu-${taskId}/bao-cao`}>
                <FileText className="size-4" /> Báo cáo
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/energy/nhiem-vu-${taskId}/quan-ly`}>
                <Settings2 className="size-4" /> Quản lý dữ liệu
              </Link>
            </Button>
          </>
        }
      />

      <main className="space-y-4 px-2 pb-8 sm:px-4 lg:px-6">
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[minmax(320px,0.7fr)_minmax(0,1.3fr)]">
          <div className="gov-card overflow-hidden">
            <header className="border-b border-border bg-gradient-to-r from-analytics/15 to-transparent px-4 py-3">
              <div className="flex items-center gap-2">
                <BrainCircuit className="size-5 text-analytics" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
                  Cấu hình truy vấn AI
                </h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Dữ liệu đầu vào được lấy tại thời điểm chạy từ hệ thống GIS.
              </p>
            </header>
            <div className="space-y-4 p-4">
              <label className="block space-y-1.5 text-sm font-medium text-navy">
                Loại phân tích
                <select
                  value={queryType}
                  onChange={(event) => selectQuery(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
                >
                  {config.queryTypes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5 text-sm font-medium text-navy">
                  Số kỳ dự báo
                  <select
                    value={horizon}
                    onChange={(event) => setHorizon(Number(event.target.value))}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal"
                  >
                    {[6, 12, 18, 24].map((value) => (
                      <option key={value} value={value}>
                        {value} kỳ
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1.5 text-sm font-medium text-navy">
                  Mức tin cậy
                  <select
                    value={confidence}
                    onChange={(event) => setConfidence(Number(event.target.value))}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal"
                  >
                    {[80, 90, 95].map((value) => (
                      <option key={value} value={value}>
                        {value}%
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div>
                <span className="text-sm font-medium text-navy">Kịch bản</span>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {SCENARIOS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      title={item.description}
                      onClick={() => setScenario(item.value)}
                      className={cn(
                        "rounded-md border px-2 py-2 text-xs font-semibold",
                        scenario === item.value
                          ? "border-gov bg-gov text-white"
                          : "border-border bg-background text-muted-foreground hover:bg-surface",
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block space-y-1.5 text-sm font-medium text-navy">
                Yêu cầu phân tích / báo cáo
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={5}
                  className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm font-normal leading-5 outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <Button
                className="w-full"
                disabled={running || !runtime?.enabled || prompt.trim().length < 10}
                onClick={() => void runAnalysis()}
              >
                {running ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                {running ? "Đang phân tích dữ liệu…" : "Chạy dự báo AI"}
              </Button>
              {!runtime?.enabled ? (
                <p className="text-xs text-destructive">
                  AI_SERVICE_ENABLED đang tắt. Bật cấu hình để chạy phân tích.
                </p>
              ) : null}
            </div>
          </div>

          <ChartCard
            title={result?.metricTitle ?? config.metricTitle}
            subtitle={
              result
                ? `${result.model.name} ${result.model.version} · mức tin cậy ${result.confidence}%`
                : "Chạy một truy vấn hoặc mở kết quả trong lịch sử"
            }
          >
            {result ? (
              <ReactECharts
                option={chartOption}
                style={{ height: 430, width: "100%" }}
                notMerge
                lazyUpdate
              />
            ) : (
              <div className="flex h-[430px] flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
                <BrainCircuit className="size-12 text-analytics/40" />
                <p>
                  Biểu đồ thực tế, dự báo và khoảng tin cậy
                  <br />
                  sẽ xuất hiện tại đây.
                </p>
              </div>
            )}
          </ChartCard>
        </section>

        {result ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Giá trị gần nhất"
                value={`${fmt(result.summary.currentValue)} ${result.unit}`}
                icon={Database}
                tone="gov"
              />
              <StatCard
                label="Giá trị dự báo / đề xuất"
                value={`${fmt(result.summary.forecastValue)} ${result.unit}`}
                icon={TrendingUp}
                tone="analytics"
              />
              <StatCard
                label="Mức thay đổi"
                value={`${result.summary.changePct >= 0 ? "+" : ""}${fmt(result.summary.changePct)}%`}
                icon={Gauge}
                tone={result.summary.changePct > 5 ? "warning" : "success"}
              />
              <StatCard
                label="Cảnh báo cần theo dõi"
                value={fmt(result.summary.riskCount, 0)}
                icon={AlertTriangle}
                tone={result.summary.riskCount ? "warning" : "success"}
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
              <div className="gov-card overflow-hidden">
                <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="size-5 text-gov" />
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
                        Báo cáo phân tích AI
                      </h2>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{result.summary.headline}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={downloadReport}>
                    <Download className="size-4" /> Tải phiếu tư vấn
                  </Button>
                </header>
                <div className="max-h-[620px] overflow-auto bg-gradient-to-b from-background to-surface/40 p-4 sm:p-6">
                  <MarkdownReport content={result.summary.report} />
                </div>
              </div>
              <div className="space-y-4">
                <section className="gov-card overflow-hidden">
                  <header className="border-b border-border px-4 py-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
                      Cảnh báo và khuyến nghị
                    </h2>
                  </header>
                  <div className="max-h-[370px] space-y-2 overflow-y-auto p-3">
                    {result.alerts.map((alert, index) => (
                      <article
                        key={`${alert.title}-${index}`}
                        className="rounded-lg border border-border p-3"
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn("rounded-md", ALERT_STYLES[alert.severity])}
                          >
                            {alert.severity === "danger"
                              ? "Khẩn cấp"
                              : alert.severity === "warning"
                                ? "Cảnh báo"
                                : "Theo dõi"}
                          </Badge>
                          <strong className="min-w-0 flex-1 truncate text-sm text-navy">
                            {alert.title}
                          </strong>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          {alert.message}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-navy">
                          <strong>Đề xuất:</strong> {alert.recommendation}
                        </p>
                      </article>
                    ))}
                    {!result.alerts.length ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        Không có cảnh báo trong dữ liệu đầu vào.
                      </p>
                    ) : null}
                  </div>
                </section>
                <section className="rounded-lg border border-gov/20 bg-gov/5 p-4 text-xs leading-5 text-muted-foreground">
                  <div className="mb-2 flex items-center gap-2 font-semibold uppercase tracking-wide text-navy">
                    <Database className="size-4" /> Nguồn dữ liệu
                  </div>
                  <p>
                    {result.provenance.sourceRecords.toLocaleString("vi-VN")} bản ghi nguồn ·{" "}
                    {result.provenance.observations.toLocaleString("vi-VN")} quan sát ·{" "}
                    {result.provenance.inferredRecords.toLocaleString("vi-VN")} bản ghi suy diễn.
                  </p>
                  <p className="mt-1">Data cutoff: {fmtTime(result.dataCutoff)}</p>
                </section>
              </div>
            </section>
          </>
        ) : null}

        <section className="gov-card overflow-hidden">
          <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
            <History className="size-5 text-analytics" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
                Lịch sử truy vấn AI
              </h2>
              <p className="text-xs text-muted-foreground">
                Lưu input, model/version, kết quả, trạng thái và độ trễ.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void reloadHistory()}
              disabled={historyLoading}
            >
              <RefreshCw className={cn("size-4", historyLoading && "animate-spin")} /> Làm mới
            </Button>
          </header>
          <div className="p-3">
            <DataTable
              columns={historyColumns}
              rows={history}
              pageSize={8}
              searchPlaceholder="Tìm loại truy vấn, mô hình, trạng thái…"
              emptyText={
                historyLoading ? "Đang tải lịch sử truy vấn…" : "Chưa có lần chạy AI nào được lưu"
              }
            />
          </div>
        </section>
      </main>
    </div>
  );
}
