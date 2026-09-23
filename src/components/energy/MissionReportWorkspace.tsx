"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Database,
  FileDown,
  FileText,
  FileSpreadsheet,
  Lightbulb,
  LoaderCircle,
  Settings2,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DataTable, type Column } from "@/components/common/DataTable";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard, type Tone } from "@/components/common/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildMissionReportInsights, formatMissionValue } from "@/lib/mission-report-analysis";
import type {
  MissionAlert,
  MissionRecord,
  MissionReportConfig,
  MissionReportInsights,
  MissionReportKind,
  MissionSummary,
} from "@/lib/mission-report-types";
import { MISSION_REPORTS } from "@/lib/mission-reports";
import { Link } from "@/lib/router-compat";
import { cn } from "@/lib/utils";

type TrendChartPoint = {
  period: string;
  actual?: number;
  forecast?: number;
  lower?: number;
  confidenceBand?: number;
};

const REPORT_KINDS: Array<{
  value: MissionReportKind;
  label: string;
  icon: typeof FileText;
}> = [
  { value: "executive", label: "Tổng hợp điều hành", icon: BarChart3 },
  { value: "trend", label: "Xu hướng và kịch bản", icon: TrendingUp },
  { value: "risk", label: "Cảnh báo và kiến nghị", icon: AlertTriangle },
];

const KPI_ICONS = [Database, TrendingUp, ShieldCheck, BarChart3];
const KPI_TONES: Tone[] = ["gov", "analytics", "success", "warning"];

type ReportPeriodPreset = "day" | "week" | "month" | "quarter" | "year";

const REPORT_PERIOD_PRESETS: Array<{ value: ReportPeriodPreset; label: string }> = [
  { value: "day", label: "Ngày" },
  { value: "week", label: "Tuần" },
  { value: "month", label: "Tháng" },
  { value: "quarter", label: "Quý" },
  { value: "year", label: "Năm" },
];

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function periodDates(preset: ReportPeriodPreset) {
  const today = new Date();
  const end = dateInputValue(today);
  if (preset === "day") return { from: end, to: end };
  if (preset === "week") {
    const monday = new Date(today);
    const daysSinceMonday = (today.getDay() + 6) % 7;
    monday.setDate(today.getDate() - daysSinceMonday);
    return { from: dateInputValue(monday), to: end };
  }
  if (preset === "month") {
    return { from: dateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)), to: end };
  }
  if (preset === "quarter") {
    const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
    return { from: dateInputValue(new Date(today.getFullYear(), quarterStartMonth, 1)), to: end };
  }
  return { from: dateInputValue(new Date(today.getFullYear(), 0, 1)), to: end };
}

async function loadSummary(taskId: number) {
  const response = await fetch(`/api/energy/tasks/${taskId}/summary`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Không thể tải dữ liệu báo cáo.");
  return response.json() as Promise<MissionSummary>;
}

function formatAdministrativeDate(date: Date) {
  const parts = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "...";
  return `Tây Ninh, ngày ${part("day")} tháng ${part("month")} năm ${part("year")}`;
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa xác định";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

function severityLabel(severity: MissionAlert["severity"]) {
  if (severity === "danger") return "Khẩn cấp";
  if (severity === "warning") return "Cảnh báo";
  return "Theo dõi";
}

function filenameFromDisposition(value: string | null, fallback: string) {
  if (!value) return fallback;
  const encoded = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return fallback;
    }
  }
  return value.match(/filename="?([^";]+)"?/i)?.[1] ?? fallback;
}

export function MissionReportWorkspace({ taskId }: { taskId: number }) {
  const config = MISSION_REPORTS[taskId];
  const [kind, setKind] = useState<MissionReportKind>("executive");
  const [periodPreset, setPeriodPreset] = useState<ReportPeriodPreset>("month");
  const [period, setPeriod] = useState(() => periodDates("month"));
  const [appliedPeriod, setAppliedPeriod] = useState(() => periodDates("month"));
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["mission-report", taskId],
    queryFn: () => loadSummary(taskId),
    staleTime: 60_000,
  });
  const data = query.data;
  const intelligence = data?.intelligence;
  const insights = useMemo(
    () => (data && config ? buildMissionReportInsights(data, config) : null),
    [config, data],
  );

  const trendData = useMemo<TrendChartPoint[]>(() => {
    if (!intelligence) return [];
    const history = intelligence.trend.map((point) => ({
      period: point.period,
      actual: point.value,
    }));
    const latest = intelligence.trend.at(-1);
    return [
      ...history,
      ...(latest ? [{ period: latest.period, forecast: latest.value }] : []),
      ...intelligence.forecast.map((point) => ({
        period: point.period,
        forecast: point.value,
        lower: point.min,
        confidenceBand: Math.max(0, point.max - point.min),
      })),
    ];
  }, [intelligence]);

  const recordColumns = useMemo<Column<MissionRecord>[]>(
    () => [
      {
        key: "code",
        header: "Mã",
        sortable: true,
        className: "font-mono text-xs text-gov",
      },
      { key: "name", header: "Đối tượng", sortable: true },
      { key: "category", header: "Phân loại", sortable: true },
      { key: "metric", header: "Chỉ tiêu", sortable: true },
      { key: "status", header: "Trạng thái", sortable: true },
      { key: "area", header: "Địa bàn / thời điểm", sortable: true },
    ],
    [],
  );
  const alertColumns = useMemo<Column<MissionAlert>[]>(
    () => [
      {
        key: "severity",
        header: "Mức độ",
        sortable: true,
        render: (alert) => (
          <Badge
            variant="outline"
            className={cn(
              "rounded-md",
              alert.severity === "danger"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : alert.severity === "warning"
                  ? "border-warning/40 bg-warning/10 text-warning"
                  : "border-gov/30 bg-gov/10 text-gov",
            )}
          >
            {severityLabel(alert.severity)}
          </Badge>
        ),
      },
      {
        key: "title",
        header: "Nội dung",
        sortable: true,
        render: (alert) => (
          <>
            <strong className="text-navy">{alert.title}</strong>
            <p className="mt-1 text-xs text-muted-foreground">{alert.message}</p>
          </>
        ),
      },
      { key: "metric", header: "Chỉ số", sortable: true },
      {
        key: "recommendation",
        header: "Kiến nghị xử lý",
        value: (alert) => alert.recommendation,
        render: (alert) => <span className="text-xs leading-5">{alert.recommendation}</span>,
      },
      { key: "status", header: "Trạng thái", sortable: true },
    ],
    [],
  );

  async function downloadPdf() {
    if (!data || isExporting) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const response = await fetch(`/api/energy/tasks/${taskId}/report`, {
        method: "POST",
        headers: { Accept: "application/pdf" },
      });
      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;
        throw new Error(errorBody?.message ?? errorBody?.error ?? "Máy chủ chưa tạo được tệp PDF.");
      }

      const blob = await response.blob();
      if (!blob.size) throw new Error("Tệp PDF trả về không có dữ liệu.");
      const fallback = `bao-cao-nhiem-vu-${taskId}-so-cong-thuong-tay-ninh.pdf`;
      const filename = filenameFromDisposition(
        response.headers.get("content-disposition"),
        fallback,
      );
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 1_000);
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : "Không thể tải báo cáo PDF. Vui lòng thử lại.",
      );
    } finally {
      setIsExporting(false);
    }
  }

  if (!config) {
    return <div className="p-8 text-sm text-destructive">Nhiệm vụ không tồn tại.</div>;
  }
  if (query.isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-3 p-8 text-sm text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin text-gov" />
        Đang tổng hợp báo cáo từ cơ sở dữ liệu…
      </div>
    );
  }
  if (query.isError || !data || !insights) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-destructive">
        <AlertTriangle className="size-7" />
        <p>Không thể tải dữ liệu báo cáo.</p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          Thử tải lại
        </Button>
      </div>
    );
  }

  const reportTitle =
    kind === "executive"
      ? config.executiveTitle
      : kind === "trend"
        ? config.trendTitle
        : config.riskTitle;
  const administrativeDate = formatAdministrativeDate(new Date());

  const applyPeriodPreset = (preset: ReportPeriodPreset) => {
    setPeriodPreset(preset);
    setPeriod(periodDates(preset));
  };

  const generateReport = () => {
    if (period.from && period.to && period.from <= period.to) setAppliedPeriod(period);
  };

  return (
    <div className="min-h-full bg-surface">
      <div className="report-no-print">
        <PageHeader
          title={`Báo cáo Nhiệm vụ ${taskId}`}
          description={`${config.missionTitle} · Hồ sơ điều hành ngành năng lượng tỉnh Tây Ninh`}
          variant="panel"
          icon={FileText}
          crumbs={[
            { label: "Năng lượng", to: "/energy" },
            { label: `Nhiệm vụ ${taskId}`, to: `/energy/nhiem-vu-${taskId}` },
            { label: "Báo cáo" },
          ]}
          actions={
            <>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/energy/nhiem-vu-${taskId}`}>
                  <ArrowLeft className="size-4" /> Về dashboard
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/energy/nhiem-vu-${taskId}/ai`}>
                  <BrainCircuit className="size-4" /> Phân tích AI
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" disabled={isExporting}>
                    {isExporting ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <FileDown className="size-4" />
                    )}
                    {isExporting ? "Đang tạo PDF…" : "Tải xuống"}
                    <ChevronDown className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => void downloadPdf()} disabled={isExporting}>
                    <FileText /> Tải Word
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void downloadPdf()} disabled={isExporting}>
                    <FileDown /> Tải PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void downloadPdf()} disabled={isExporting}>
                    <FileSpreadsheet /> Tải Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
        />
      </div>

      <main className="space-y-4 px-2 pb-8 sm:px-4 lg:px-6">
        <section className="report-no-print rounded-lg border border-border bg-card p-4 shadow-panel">
          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays className="size-5 text-gov" />
            <div className="mr-auto">
              <h2 className="text-sm font-semibold text-navy">Thời gian lập báo cáo</h2>
              <p className="text-xs text-muted-foreground">
                Dữ liệu hiện tại vẫn được sử dụng để lập báo cáo.
              </p>
            </div>
            <div className="flex flex-wrap gap-1 rounded-md border border-border bg-surface p-1">
              {REPORT_PERIOD_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => applyPeriodPreset(preset.value)}
                  className={cn(
                    "rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
                    periodPreset === preset.value
                      ? "bg-gov text-white"
                      : "text-muted-foreground hover:bg-card hover:text-navy",
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Từ ngày
              <input
                type="date"
                value={period.from}
                onChange={(event) => {
                  setPeriodPreset("day");
                  setPeriod((current) => ({ ...current, from: event.target.value }));
                }}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-navy outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Đến ngày
              <input
                type="date"
                value={period.to}
                min={period.from}
                onChange={(event) => {
                  setPeriodPreset("day");
                  setPeriod((current) => ({ ...current, to: event.target.value }));
                }}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-navy outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
            <Button
              type="button"
              size="sm"
              onClick={generateReport}
              disabled={!period.from || !period.to || period.from > period.to}
            >
              <FileText className="size-4" /> Lập báo cáo
            </Button>
            <span className="text-xs text-muted-foreground">
              Đang lập: {appliedPeriod.from} đến {appliedPeriod.to}
            </span>
          </div>
        </section>
        {exportError ? (
          <div
            role="alert"
            className="report-no-print flex items-start justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <span className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                <strong>Chưa thể xuất PDF.</strong> {exportError}
              </span>
            </span>
            <button
              type="button"
              className="shrink-0 font-semibold underline-offset-2 hover:underline"
              onClick={() => setExportError(null)}
            >
              Đóng
            </button>
          </div>
        ) : null}

        <div className="report-no-print grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
          <nav
            className="flex flex-wrap gap-2 rounded-xl border border-border bg-card p-2 shadow-sm"
            aria-label="Phần báo cáo đang xem"
          >
            {REPORT_KINDS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setKind(item.value)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition",
                    kind === item.value
                      ? "bg-gov text-white shadow-sm"
                      : "text-muted-foreground hover:bg-surface hover:text-navy",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="flex items-center gap-2 rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-xs leading-5 text-success shadow-sm">
            <CheckCircle2 className="size-4 shrink-0" />
            Tệp PDF luôn gồm đầy đủ tổng hợp, xu hướng, cảnh báo và phụ lục dữ liệu.
          </div>
        </div>

        <article
          className="mission-report-print space-y-7 rounded-xl border border-border bg-card p-4 text-[15px] leading-7 text-slate-900 shadow-sm sm:p-7 lg:p-10"
          style={{ fontFamily: '"Times New Roman", "Noto Serif", serif' }}
        >
          <AdministrativeHeader
            taskId={taskId}
            config={config}
            administrativeDate={administrativeDate}
          />

          <ReportSection number="I" title="Thông tin chung và căn cứ tổng hợp">
            <p className="text-justify">{config.executiveLead}</p>
            <p className="mt-3 font-semibold">Căn cứ tổng hợp:</p>
            <ol className="mt-1 space-y-1 pl-6 text-justify">
              {config.managementBasis.map((basis, index) => (
                <li key={basis} className="list-decimal pl-1">
                  {basis}
                  {index === config.managementBasis.length - 1 ? "" : ";"}
                </li>
              ))}
            </ol>
            <div className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <ReportInfo label="Phạm vi dữ liệu" value={data.coverage} />
              <ReportInfo label="Hệ thống tổng hợp" value={formatUpdatedAt(data.updatedAt)} />
              <ReportInfo label="Nguồn lưu trữ" value="PostgreSQL / PostGIS" />
              <ReportInfo
                label="Mức sẵn sàng"
                value={data.coverageStatus === "EMPTY" ? "Chưa đủ dữ liệu" : "Có dữ liệu tổng hợp"}
              />
            </div>
          </ReportSection>

          <ReportSection number="II" title="Kết quả tổng hợp và nhận định chính">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {data.kpis.map((item, index) => {
                const Icon = KPI_ICONS[index % KPI_ICONS.length] ?? Database;
                return (
                  <StatCard
                    key={`${item.label}-${index}`}
                    label={item.label}
                    value={formatMissionValue(item.value, item.unit)}
                    icon={Icon}
                    tone={KPI_TONES[index % KPI_TONES.length] ?? "gov"}
                  />
                );
              })}
            </div>
            <ExecutiveSnapshot data={data} insights={insights} />
          </ReportSection>

          <ReportSection number="III" title={reportTitle}>
            {kind === "executive" ? (
              <ExecutiveReport
                data={data}
                config={config}
                insights={insights}
                recordColumns={recordColumns}
              />
            ) : null}
            {kind === "trend" ? <TrendReport data={data} trendData={trendData} /> : null}
            {kind === "risk" ? (
              <RiskReport alerts={intelligence?.alerts ?? []} columns={alertColumns} />
            ) : null}
          </ReportSection>

          <ReportSection number="IV" title="Hiệu quả đầu tư và ưu tiên triển khai">
            <div className="grid gap-4 lg:grid-cols-2">
              <ReportListCard
                icon={Lightbulb}
                title="Giá trị mang lại cho công tác quản lý"
                items={config.investmentBenefits}
                tone="success"
              />
              <ReportListCard
                icon={Settings2}
                title="Ưu tiên triển khai"
                items={config.implementationPriorities}
                tone="gov"
              />
            </div>
          </ReportSection>

          <ReportSection number="V" title="Kiến nghị">
            <ol className="space-y-2 pl-6 text-justify">
              {config.standingRecommendations.map((recommendation, index) => (
                <li key={recommendation} className="list-decimal pl-1">
                  <strong>Kiến nghị {index + 1}:</strong> {recommendation}
                </li>
              ))}
            </ol>
          </ReportSection>

          <ReportSection number="VI" title="Nguồn dữ liệu và kiểm soát chất lượng">
            <ProvenanceSummary data={data} insights={insights} />
          </ReportSection>

          <AdministrativeSignature />

          <div className="border-t border-dashed border-destructive/30 pt-3 text-center text-xs font-semibold uppercase tracking-wide text-destructive">
            Báo cáo minh họa - Không thay thế văn bản phát hành, số liệu phải được đối soát trước
            khi ký số
          </div>
        </article>
      </main>
    </div>
  );
}

function AdministrativeHeader({
  taskId,
  config,
  administrativeDate,
}: {
  taskId: number;
  config: MissionReportConfig;
  administrativeDate: string;
}) {
  return (
    <header>
      <div className="grid gap-6 text-center sm:grid-cols-2 sm:gap-10">
        <div>
          <p className="font-bold uppercase leading-6">UBND TỈNH TÂY NINH</p>
          <p className="font-bold uppercase leading-6">SỞ CÔNG THƯƠNG</p>
          <span className="mx-auto mt-1 block w-24 border-b border-slate-900" />
          <p className="mt-2 text-sm">Số: .../BC-SCT</p>
        </div>
        <div>
          <p className="font-bold uppercase leading-6">Cộng hòa xã hội chủ nghĩa Việt Nam</p>
          <p className="font-bold leading-6">Độc lập - Tự do - Hạnh phúc</p>
          <span className="mx-auto mt-1 block w-40 border-b border-slate-900" />
          <p className="mt-2 text-sm italic">{administrativeDate}</p>
        </div>
      </div>

      <div className="mt-9 text-center">
        <h1 className="text-2xl font-bold uppercase leading-tight text-slate-950 sm:text-3xl">
          Báo cáo
        </h1>
        <h2 className="mx-auto mt-2 max-w-4xl text-lg font-bold leading-7 sm:text-xl">
          {config.reportSubject}
        </h2>
        <p className="mt-1 text-sm italic">
          Nhiệm vụ {taskId}: {config.missionTitle}
        </p>
        <div className="mt-4 inline-flex rounded-full border border-destructive/35 bg-destructive/10 px-4 py-1 text-xs font-bold uppercase tracking-wide text-destructive">
          Bản minh họa - Chưa có giá trị phát hành
        </div>
      </div>

      <p className="mt-7 text-center font-semibold">Kính gửi: Ủy ban nhân dân tỉnh Tây Ninh.</p>
    </header>
  );
}

function ReportSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="border-b border-slate-300 pb-1 font-bold uppercase leading-7 text-slate-950">
        {number}. {title}
      </h2>
      {children}
    </section>
  );
}

function ReportInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words font-semibold leading-5 text-slate-800">{value}</p>
    </div>
  );
}

function ExecutiveSnapshot({
  data,
  insights,
}: {
  data: MissionSummary;
  insights: MissionReportInsights;
}) {
  const intelligence = data.intelligence;
  const trendUnit = intelligence?.trendUnit;
  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
      <div className="rounded-lg border border-gov/20 bg-gov/5 p-4 sm:p-5">
        <h3 className="flex items-center gap-2 font-bold text-navy">
          <Lightbulb className="size-4 text-warning" /> Nhận định phục vụ điều hành
        </h3>
        <ul className="mt-3 space-y-2 pl-5 text-justify text-sm leading-6">
          {insights.executiveFindings.map((finding) => (
            <li key={finding} className="list-disc pl-1">
              {finding}
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <ReportCounter label="Khẩn cấp" value={insights.dangerCount} tone="danger" compact />
          <ReportCounter label="Cảnh báo" value={insights.warningCount} tone="warning" compact />
          <ReportCounter label="Theo dõi" value={insights.infoCount} tone="info" compact />
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Tín hiệu xu hướng
          </p>
          <dl className="mt-2 space-y-2 text-sm">
            <ReportMetric
              label="Giá trị kỳ gần nhất"
              value={
                insights.latestActual == null
                  ? "Chưa đủ dữ liệu"
                  : formatMissionValue(insights.latestActual, trendUnit)
              }
            />
            <ReportMetric
              label="Biến động chuỗi kỳ"
              value={
                insights.trendDeltaPct == null
                  ? "Chưa đủ dữ liệu"
                  : `${insights.trendDeltaPct > 0 ? "+" : ""}${insights.trendDeltaPct.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`
              }
            />
            <ReportMetric
              label="Kịch bản bình quân"
              value={
                insights.forecastAverage == null
                  ? "Chưa đủ điều kiện lập kịch bản"
                  : formatMissionValue(insights.forecastAverage, trendUnit)
              }
            />
          </dl>
        </div>
      </div>
    </div>
  );
}

function ExecutiveReport({
  data,
  config,
  insights,
  recordColumns,
}: {
  data: MissionSummary;
  config: MissionReportConfig;
  insights: MissionReportInsights;
  recordColumns: Column<MissionRecord>[];
}) {
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="font-bold text-navy">1. Cơ cấu dữ liệu nghiệp vụ</h3>
          {data.breakdown.length ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={data.breakdown}
                layout="vertical"
                margin={{ left: 10, right: 25, top: 15, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={125} />
                <Tooltip formatter={(value) => Number(value).toLocaleString("vi-VN")} />
                <Bar dataKey="value" name="Giá trị" fill="#1167a8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Chưa có dữ liệu cơ cấu.
            </p>
          )}
          {insights.topBreakdown ? (
            <p className="rounded-md bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
              Nhóm có giá trị lớn nhất: <strong>{insights.topBreakdown.name}</strong>, chiếm{" "}
              <strong>
                {insights.topBreakdown.sharePct.toLocaleString("vi-VN", {
                  maximumFractionDigits: 1,
                })}
                %
              </strong>{" "}
              trong cơ cấu tổng hợp.
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-gov/20 bg-gov/5 p-4">
            <h3 className="flex items-center gap-2 font-bold text-navy">
              <Lightbulb className="size-4 text-warning" /> 2. Câu hỏi điều hành
            </h3>
            <ol className="mt-3 space-y-2 text-sm leading-6">
              {config.decisionQuestions.map((question, index) => (
                <li key={question} className="flex gap-2 rounded-md bg-white p-3 shadow-sm">
                  <span className="font-bold text-gov">{index + 1}.</span>
                  <span>{question}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="font-bold text-navy">3. Trọng tâm phân tích</h3>
            <ul className="mt-2 space-y-1 pl-5 text-sm leading-6">
              {config.analyticalFocus.map((focus) => (
                <li key={focus} className="list-disc pl-1">
                  {focus}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-bold text-navy">4. Danh sách đối tượng trọng tâm</h3>
        <DataTable
          columns={recordColumns}
          rows={data.records}
          pageSize={8}
          searchPlaceholder="Tìm đối tượng trong báo cáo…"
        />
      </div>
    </>
  );
}

function TrendReport({ data, trendData }: { data: MissionSummary; trendData: TrendChartPoint[] }) {
  const intelligence = data.intelligence;
  if (!intelligence) {
    return (
      <div className="rounded-lg border border-warning/30 bg-warning/10 p-6 text-sm text-warning">
        Chưa đủ chuỗi dữ liệu để lập báo cáo xu hướng. Cần bổ sung dữ liệu đã xác minh trước khi sử
        dụng cho quyết định đầu tư.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="font-bold text-navy">1. {intelligence.trendTitle}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Đường liền: chuỗi quan sát hiện có · đường nét đứt: kịch bản cơ sở · vùng màu: biên thấp
            - cao (không phải khoảng tin cậy)
          </p>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={trendData} margin={{ left: 0, right: 16, top: 20, bottom: 35 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 10 }}
                angle={-25}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 10 }} width={62} domain={[0, "auto"]} />
              <Tooltip
                formatter={(value) =>
                  `${Number(value).toLocaleString("vi-VN")} ${intelligence.trendUnit}`
                }
              />
              <Legend verticalAlign="top" height={30} />
              <Area
                dataKey="lower"
                stackId="confidence"
                stroke="none"
                fill="transparent"
                legendType="none"
              />
              <Area
                dataKey="confidenceBand"
                name="Biên kịch bản thấp - cao"
                stackId="confidence"
                stroke="none"
                fill="#e59a23"
                fillOpacity={0.18}
              />
              <Line
                dataKey="actual"
                name="Số liệu quan sát"
                stroke="#1167a8"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                connectNulls
              />
              <Line
                dataKey="forecast"
                name="Kịch bản cơ sở"
                stroke="#e59a23"
                strokeWidth={2.5}
                strokeDasharray="6 4"
                dot={{ r: 3 }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="font-bold text-navy">2. Phương pháp lập kịch bản</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {intelligence.forecastMethod}
            </p>
            <p className="mt-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs leading-5 text-warning">
              Kết quả ngoại suy là kịch bản hỗ trợ quyết định; không thay thế số liệu đo đếm, thẩm
              định chuyên môn hoặc hồ sơ pháp lý. Biên thấp - cao không phải khoảng tin cậy thống
              kê.
            </p>
          </div>
          <div className="rounded-lg border border-success/30 bg-success/10 p-4">
            <h3 className="font-bold text-success">3. Khả năng truy vết dữ liệu</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <ReportMetric
                label="Bản ghi có nguồn đối soát"
                value={intelligence.provenance.sourceRecords.toLocaleString("vi-VN")}
              />
              <ReportMetric
                label="Quan sát chuỗi kỳ"
                value={intelligence.provenance.observations.toLocaleString("vi-VN")}
              />
              <ReportMetric
                label="Bản ghi/trường có yếu tố suy diễn"
                value={intelligence.provenance.inferredRecords.toLocaleString("vi-VN")}
              />
            </dl>
            <p className="mt-3 text-xs leading-5 text-success">
              Hai nhóm chất lượng có thể giao nhau; không cộng hai chỉ tiêu để tính tổng dữ liệu.
            </p>
          </div>
          {intelligence.provenance.notes.map((note) => (
            <p
              key={note}
              className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-muted-foreground"
            >
              {note}
            </p>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-bold text-navy">4. Bảng kịch bản theo kỳ</h3>
        {intelligence.forecast.length ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-2 font-bold">Kỳ tham khảo</th>
                  <th className="border-b border-slate-200 px-4 py-2 text-right font-bold">
                    Kịch bản cơ sở
                  </th>
                  <th className="border-b border-slate-200 px-4 py-2 text-right font-bold">
                    Kịch bản thấp
                  </th>
                  <th className="border-b border-slate-200 px-4 py-2 text-right font-bold">
                    Kịch bản cao
                  </th>
                </tr>
              </thead>
              <tbody>
                {intelligence.forecast.map((point) => (
                  <tr key={point.period} className="even:bg-slate-50">
                    <td className="border-b border-slate-100 px-4 py-2 font-semibold">
                      {point.period}
                    </td>
                    <td className="border-b border-slate-100 px-4 py-2 text-right tabular-nums">
                      {formatMissionValue(point.value, intelligence.trendUnit)}
                    </td>
                    <td className="border-b border-slate-100 px-4 py-2 text-right tabular-nums">
                      {formatMissionValue(point.min, intelligence.trendUnit)}
                    </td>
                    <td className="border-b border-slate-100 px-4 py-2 text-right tabular-nums">
                      {formatMissionValue(point.max, intelligence.trendUnit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-lg border border-slate-200 p-4 text-sm text-muted-foreground">
            Chưa có kịch bản ngoại suy vì chuỗi chưa đủ tối thiểu 6 kỳ dữ liệu.
          </p>
        )}
      </div>
    </div>
  );
}

function RiskReport({
  alerts,
  columns,
}: {
  alerts: MissionAlert[];
  columns: Column<MissionAlert>[];
}) {
  const urgent = alerts.filter((alert) => alert.severity === "danger").length;
  const warning = alerts.filter((alert) => alert.severity === "warning").length;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <ReportCounter label="Khẩn cấp" value={urgent} tone="danger" />
        <ReportCounter label="Cảnh báo" value={warning} tone="warning" />
        <ReportCounter
          label="Theo dõi"
          value={Math.max(0, alerts.length - urgent - warning)}
          tone="info"
        />
      </div>
      <div className="space-y-2">
        <h3 className="font-bold text-navy">1. Danh sách cảnh báo nghiệp vụ</h3>
        <DataTable
          columns={columns}
          rows={alerts}
          pageSize={8}
          searchPlaceholder="Tìm cảnh báo, chỉ số, trạng thái…"
          emptyText="Không có cảnh báo trong kỳ báo cáo"
        />
      </div>
      <p className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm leading-6 text-warning">
        Các cảnh báo được hệ thống tổng hợp để sàng lọc ưu tiên. Đơn vị chuyên môn cần xác minh hiện
        trường, nguồn đo và hồ sơ liên quan trước khi ban hành chỉ đạo.
      </p>
    </div>
  );
}

function ReportListCard({
  icon: Icon,
  title,
  items,
  tone,
}: {
  icon: typeof Lightbulb;
  title: string;
  items: string[];
  tone: "success" | "gov";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4 sm:p-5",
        tone === "success" ? "border-success/25 bg-success/5" : "border-gov/20 bg-gov/5",
      )}
    >
      <h3
        className={cn(
          "flex items-center gap-2 font-bold",
          tone === "success" ? "text-success" : "text-navy",
        )}
      >
        <Icon className="size-4" /> {title}
      </h3>
      <ol className="mt-3 space-y-2 pl-6 text-justify text-sm leading-6">
        {items.map((item) => (
          <li key={item} className="list-decimal pl-1">
            {item}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ProvenanceSummary({
  data,
  insights,
}: {
  data: MissionSummary;
  insights: MissionReportInsights;
}) {
  const provenance = data.intelligence?.provenance;
  const sourceCount = provenance?.sourceRecords ?? data.records.length;
  const observations = provenance?.observations ?? 0;
  const inferred = provenance?.inferredRecords ?? 0;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
      <div
        className={cn(
          "rounded-lg border p-4",
          insights.dataConfidence === "high"
            ? "border-success/30 bg-success/10"
            : insights.dataConfidence === "medium"
              ? "border-warning/30 bg-warning/10"
              : "border-destructive/30 bg-destructive/10",
        )}
      >
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Mức tin cậy sử dụng
        </p>
        <p className="mt-2 font-bold text-slate-900">{insights.dataConfidenceLabel}</p>
        <dl className="mt-4 space-y-2 text-sm">
          <ReportMetric
            label="Bản ghi có nguồn đối soát"
            value={sourceCount.toLocaleString("vi-VN")}
          />
          <ReportMetric label="Quan sát" value={observations.toLocaleString("vi-VN")} />
          <ReportMetric
            label="Bản ghi/trường có yếu tố suy diễn / kịch bản"
            value={inferred.toLocaleString("vi-VN")}
          />
        </dl>
      </div>
      <div className="rounded-lg border border-slate-200 p-4">
        <h3 className="font-bold text-navy">Nguyên tắc sử dụng số liệu</h3>
        <ul className="mt-2 space-y-2 pl-5 text-justify text-sm leading-6">
          <li className="list-disc pl-1">
            Bản ghi nguồn được tổng hợp từ cơ sở dữ liệu nghiệp vụ trong phạm vi nêu tại báo cáo.
          </li>
          <li className="list-disc pl-1">
            Bản ghi suy diễn, dữ liệu kịch bản và kết quả ngoại suy phải được gắn cờ, không được
            dùng thay số liệu chính thức.
          </li>
          <li className="list-disc pl-1">
            Nhóm có nguồn đối soát và nhóm có yếu tố suy diễn có thể giao nhau; không cộng hai chỉ
            tiêu để tính tổng dữ liệu.
          </li>
          <li className="list-disc pl-1">
            Số liệu phục vụ phát hành văn bản phải qua đối soát nghiệp vụ, phê duyệt và ký số theo
            quy trình của Sở Công Thương.
          </li>
          {(provenance?.notes ?? []).map((note) => (
            <li key={note} className="list-disc pl-1 text-muted-foreground">
              {note}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AdministrativeSignature() {
  return (
    <section className="grid gap-8 border-t border-slate-300 pt-5 sm:grid-cols-2">
      <div className="text-sm leading-6">
        <p className="font-bold italic">Nơi nhận:</p>
        <p>- Như trên;</p>
        <p>- Lưu: VT, phòng chuyên môn.</p>
        <p className="mt-2 text-xs italic text-muted-foreground">
          Bản minh họa chưa vào sổ văn bản.
        </p>
      </div>
      <div className="min-h-40 text-center">
        <p className="font-bold uppercase">Giám đốc</p>
        <p className="text-sm italic">(Ký, ghi rõ họ tên, đóng dấu)</p>
        <p className="mt-20 text-sm text-muted-foreground">....................................</p>
      </div>
    </section>
  );
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-current/10 pb-2 last:border-b-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold tabular-nums text-navy">{value}</dd>
    </div>
  );
}

function ReportCounter({
  label,
  value,
  tone,
  compact = false,
}: {
  label: string;
  value: number;
  tone: "danger" | "warning" | "info";
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border",
        compact ? "p-2.5" : "p-4",
        tone === "danger"
          ? "border-destructive/30 bg-destructive/10"
          : tone === "warning"
            ? "border-warning/40 bg-warning/10"
            : "border-gov/30 bg-gov/10",
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:text-xs">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-bold tabular-nums",
          compact ? "text-2xl" : "text-3xl",
          tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-gov",
        )}
      >
        {value.toLocaleString("vi-VN")}
      </p>
    </div>
  );
}
