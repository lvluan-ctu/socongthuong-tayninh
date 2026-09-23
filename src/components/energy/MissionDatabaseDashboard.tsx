"use client";

import { useMemo } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  Database,
  Gauge,
  FileText,
  Info,
  MapPinned,
  PanelsTopLeft,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Users,
  Zap,
} from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/common/ChartCard";
import { DataTable, type Column } from "@/components/common/DataTable";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard, type Tone } from "@/components/common/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router-compat";
import { cn } from "@/lib/utils";
import { MissionGisMap, type MissionMarker, type MissionPolygon } from "./MissionGisMap";
import { SafetyOutageLookup } from "./SafetyOutageLookup";

type MissionAlert = {
  id: string;
  title: string;
  severity: "danger" | "warning" | "info";
  message: string;
  recommendation: string;
  metric: string;
  status: string;
  lat: number | null;
  lng: number | null;
  imageUrl: string | null;
};

type MissionRecord = {
  id: string;
  code: string;
  name: string;
  category: string;
  status: string;
  metric: string;
  area: string;
};

type MissionSummary = {
  taskId: number;
  title: string;
  description: string;
  coverage: string;
  coverageStatus: "READY" | "EMPTY";
  updatedAt: string;
  kpis: Array<{ label: string; value: number; unit?: string }>;
  breakdown: Array<{ name: string; value: number }>;
  markers: MissionMarker[];
  records: MissionRecord[];
  intelligence: null | {
    trendTitle: string;
    trendUnit: string;
    trend: Array<{ period: string; value: number }>;
    forecast: Array<{ period: string; value: number; min: number; max: number }>;
    forecastMethod: string;
    alerts: MissionAlert[];
    polygons: MissionPolygon[];
    media: Array<{
      id: string;
      title: string;
      url: string;
      caption: string;
      severity: string;
      relatedCode: string;
    }>;
    provenance: {
      sourceRecords: number;
      inferredRecords: number;
      observations: number;
      notes: string[];
    };
  };
};

const KPI_ICONS = [Database, Zap, Gauge, ShieldAlert, Users];
const KPI_TONES: Tone[] = ["gov", "teal", "analytics", "warning", "success"];

const RECORD_COLUMNS: Column<MissionRecord>[] = [
  { key: "code", header: "Mã", sortable: true, className: "font-mono text-xs text-gov" },
  { key: "name", header: "Tên", sortable: true },
  { key: "category", header: "Phân loại", sortable: true },
  { key: "metric", header: "Chỉ tiêu", sortable: true, value: (record) => record.metric || "—" },
  { key: "status", header: "Trạng thái", sortable: true },
  { key: "area", header: "Khu vực / thời điểm", sortable: true },
];

const ALERT_META = {
  danger: {
    label: "Khẩn cấp",
    icon: ShieldAlert,
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  warning: {
    label: "Cảnh báo",
    icon: AlertTriangle,
    className: "border-warning/40 bg-warning/10 text-warning",
  },
  info: { label: "Theo dõi", icon: Info, className: "border-gov/30 bg-gov/10 text-gov" },
} as const;

async function loadSummary(taskId: number): Promise<MissionSummary> {
  const response = await fetch(`/api/energy/tasks/${taskId}/summary`, { cache: "no-store" });
  if (!response.ok) throw new Error("Không thể tải dữ liệu nhiệm vụ.");
  return response.json() as Promise<MissionSummary>;
}

function formatValue(value: number, unit?: string) {
  const formatted = new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function MissionDatabaseDashboard({ taskId }: { taskId: number }) {
  const query = useQuery({
    queryKey: ["energy-mission-summary", taskId],
    queryFn: () => loadSummary(taskId),
    staleTime: 60_000,
    refetchOnMount: "always",
  });
  const data = query.data;

  const trendData = useMemo(() => {
    const intelligence = data?.intelligence;
    if (!intelligence) return [];
    const actual = intelligence.trend.map((item) => ({ period: item.period, actual: item.value }));
    const last = intelligence.trend.at(-1);
    const forecast = [
      ...(last ? [{ period: last.period, forecast: last.value }] : []),
      ...intelligence.forecast.map((item) => ({
        period: item.period,
        forecast: item.value,
        forecastMin: item.min,
        confidenceBand: item.max - item.min,
      })),
    ];
    return [...actual, ...forecast];
  }, [data]);

  if (query.isLoading) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Đang truy vấn dữ liệu nhiệm vụ {taskId}…
      </div>
    );
  }
  if (query.isError || !data) {
    return (
      <div className="p-8">
        <div className="gov-card p-6 text-sm text-destructive">Không thể tải dữ liệu nhiệm vụ.</div>
      </div>
    );
  }

  const intelligence = data.intelligence;
  const provenance = intelligence?.provenance;

  return (
    <div className="min-h-full bg-surface">
      <PageHeader
        title={`Nhiệm vụ ${taskId}: ${data.title}`}
        description={data.description}
        variant="panel"
        icon={MapPinned}
        crumbs={[{ label: "Năng lượng", to: "/energy" }, { label: `Nhiệm vụ ${taskId}` }]}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCw className={cn("size-4", query.isFetching && "animate-spin")} />
              Cập nhật
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/energy/nhiem-vu-${taskId}/ai`}>
                <BrainCircuit className="size-4" />
                {taskId === 5 ? "AI an toàn điện" : "Dự báo AI"}
              </Link>
            </Button>
            {taskId === 3 ? (
              <Button variant="outline" size="sm" asChild>
                <Link to="/energy/nhiem-vu-3/tu-van">
                  <PanelsTopLeft className="size-4" />
                  Tư vấn điện mặt trời 3D
                </Link>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <Link to={`/energy/nhiem-vu-${taskId}/bao-cao`}>
                <FileText className="size-4" />
                Báo cáo
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link to={`/energy/nhiem-vu-${taskId}/quan-ly`}>
                <Settings2 className="size-4" />
                Quản lý dữ liệu
              </Link>
            </Button>
          </>
        }
      />

      <main className="space-y-4 px-2 pb-8 sm:px-4 lg:px-6">
        <section className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Database className="size-4 text-success" />
            <strong>Dữ liệu hệ thống GIS:</strong>
            <span>{data.coverage}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              Cập nhật {new Date(data.updatedAt).toLocaleString("vi-VN")}
            </span>
          </div>
          {provenance ? (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{provenance.sourceRecords.toLocaleString("vi-VN")} bản ghi nguồn</span>
              <span>{provenance.observations.toLocaleString("vi-VN")} quan sát/chuỗi kỳ</span>
              <span>
                {provenance.inferredRecords.toLocaleString("vi-VN")} bản ghi suy diễn có gắn cờ
              </span>
            </div>
          ) : null}
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.kpis.map((item, index) => (
            <StatCard
              key={item.label}
              label={item.label}
              value={formatValue(item.value, item.unit)}
              icon={KPI_ICONS[index]}
              tone={KPI_TONES[index]}
            />
          ))}
        </section>

        {intelligence ? (
          <section className="space-y-4">
            <ChartCard
              title="Bản đồ GIS điều hành nhiệm vụ"
              subtitle={`${data.markers.length.toLocaleString("vi-VN")} điểm nghiệp vụ · ${intelligence.polygons.length.toLocaleString("vi-VN")} vùng/polygon · lớp dữ liệu thực từ PostGIS và GeoServer`}
            >
              <MissionGisMap
                missionId={taskId}
                markers={data.markers}
                polygons={intelligence.polygons}
                alerts={intelligence.alerts}
                height={680}
              />
            </ChartCard>
            {taskId === 5 ? <SafetyOutageLookup /> : null}
            <ChartCard
              title={intelligence.trendTitle}
              subtitle={`Lịch sử và dự báo 6 kỳ · ${intelligence.forecastMethod}`}
            >
              <ResponsiveContainer width="100%" height={410}>
                <ComposedChart
                  data={trendData}
                  margin={{ left: 4, right: 14, top: 12, bottom: 35 }}
                >
                  <defs>
                    <linearGradient id={`missionForecast-${taskId}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e59a23" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#e59a23" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 10 }}
                    angle={-28}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    width={68}
                    tickFormatter={(value) =>
                      new Intl.NumberFormat("vi-VN", { notation: "compact" }).format(Number(value))
                    }
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(Number(value))} ${intelligence.trendUnit}`,
                      name === "actual"
                        ? "Thực tế/ước tính kỳ"
                        : name === "forecast"
                          ? "Dự báo"
                          : "Khoảng tin cậy",
                    ]}
                  />
                  <Area dataKey="forecastMin" stackId="forecast" stroke="none" fill="transparent" />
                  <Area
                    dataKey="confidenceBand"
                    stackId="forecast"
                    stroke="none"
                    fill={`url(#missionForecast-${taskId})`}
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="actual"
                    stroke="#0891b2"
                    strokeWidth={2.5}
                    dot={{ r: 2.5 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    name="forecast"
                    stroke="#e59a23"
                    strokeWidth={2.5}
                    strokeDasharray="6 4"
                    dot={{ r: 2.5 }}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <ChartCard
            title="Phân tích cơ cấu"
            subtitle="Tổng hợp trực tiếp từ cơ sở dữ liệu nghiệp vụ"
          >
            {data.breakdown.length ? (
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={data.breakdown} margin={{ left: 4, right: 12, top: 8, bottom: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    angle={-28}
                    textAnchor="end"
                    interval={0}
                    height={70}
                    fontSize={11}
                  />
                  <YAxis fontSize={11} />
                  <Tooltip
                    formatter={(value) => new Intl.NumberFormat("vi-VN").format(Number(value))}
                  />
                  <Bar dataKey="value" name="Giá trị" fill="#0891b2" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[360px] items-center justify-center text-sm text-muted-foreground">
                Chưa có dữ liệu để lập biểu đồ.
              </div>
            )}
          </ChartCard>

          <section className="gov-card overflow-hidden">
            <header className="flex items-center gap-2 border-b border-border px-4 py-3">
              <BrainCircuit className="size-5 text-warning" />
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
                  Cảnh báo và khuyến nghị vận hành
                </h2>
                <p className="text-xs text-muted-foreground">
                  Xếp hạng theo mức độ và chỉ tiêu nghiệp vụ mới nhất
                </p>
              </div>
              <Badge variant="outline" className="ml-auto rounded-md">
                {intelligence?.alerts.length ?? 0} cảnh báo
              </Badge>
            </header>
            <div className="max-h-[410px] space-y-2 overflow-y-auto p-3">
              {intelligence?.alerts.map((alert) => {
                const meta = ALERT_META[alert.severity] ?? ALERT_META.info;
                const Icon = meta.icon;
                return (
                  <article
                    key={alert.id}
                    className="rounded-lg border border-border bg-surface p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={cn("rounded-md", meta.className)}>
                        <Icon className="size-3" /> {meta.label}
                      </Badge>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-navy">
                        {alert.title}
                      </span>
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                        {alert.metric}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{alert.message}</p>
                    <p className="mt-1.5 rounded-md bg-gov/5 px-2 py-1.5 text-xs leading-5 text-navy">
                      <strong>Đề xuất: </strong>
                      {alert.recommendation}
                    </p>
                  </article>
                );
              })}
              {!intelligence?.alerts.length ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Không có cảnh báo vượt ngưỡng ở kỳ hiện tại.
                </p>
              ) : null}
            </div>
          </section>
        </section>

        {intelligence?.media.length ? (
          <section className="gov-card overflow-hidden">
            <header className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
                Hình ảnh minh họa cảnh báo an toàn
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Ảnh tình huống minh họa được gắn cờ; không phải bằng chứng hiện trường chính
                thức.
              </p>
            </header>
            <div className="grid gap-4 p-4 md:grid-cols-3">
              {intelligence.media.map((item) => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-lg border border-border bg-surface"
                >
                  <div className="relative aspect-[3/2] bg-muted">
                    <Image
                      src={item.url}
                      alt={item.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-navy">{item.title}</h3>
                      <Badge variant="outline" className="rounded-md">
                        {item.relatedCode}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.caption}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {provenance?.notes.length ? (
          <section className="rounded-lg border border-gov/20 bg-gov/5 px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-navy">
              Ghi chú nguồn và độ tin cậy
            </h2>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
              {provenance.notes.map((note) => (
                <li key={note}>• {note}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <ChartCard
          title="Dữ liệu nghiệp vụ gần nhất"
          subtitle="Phân trang gọn nhẹ; chỉnh sửa tại trang Quản lý dữ liệu"
        >
          <DataTable
            columns={RECORD_COLUMNS}
            rows={data.records}
            pageSize={8}
            searchPlaceholder="Tìm mã, tên, địa bàn..."
            emptyText="Chưa có bản ghi nghiệp vụ."
          />
        </ChartCard>
      </main>
    </div>
  );
}
