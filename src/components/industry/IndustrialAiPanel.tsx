// ============================================================
// AI PHÂN TÍCH & DỰ BÁO — Trang GIS Khu/Cụm công nghiệp
// Demo: hồi quy tuyến tính + sóng mùa vụ trên chuỗi đất CN đã
// cho thuê toàn tỉnh (INDUSTRY_TREND), ngưỡng = 90% quỹ đất CCN
// đang vận hành. Kết quả deterministic để mọi ô AI giải thích
// được. KHÔNG phải model thật.
// ============================================================
import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BrainCircuit,
  Gauge,
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
import { StatCard } from "@/components/common/StatCard";
import { wardZoneOfCluster } from "@/data/industrial-zones";
import { CLUSTERS, INDUSTRY_TREND } from "@/data/mock";
import type { Cluster } from "@/lib/types";
import { cn } from "@/lib/utils";

const HORIZONS = ["Quý", "6 tháng", "1 năm"] as const;
type Horizon = (typeof HORIZONS)[number];

const HORIZON_N: Record<Horizon, number> = { Quý: 1, "6 tháng": 2, "1 năm": 4 };
const HORIZON_LABEL: Record<Horizon, string> = { Quý: "Q", "6 tháng": "H", "1 năm": "N" };

const NEARLY_FULL_PCT = 85; // lấp đầy ≥ 85% → gần đạt ngưỡng, cần theo dõi
const SLOW_PCT = 40; // lấp đầy ≤ 40% → chậm thu hút đầu tư

const fmt = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);

export function IndustrialAiPanel({
  onSelectCluster,
}: {
  onSelectCluster: (cluster: Cluster) => void;
}) {
  const [horizon, setHorizon] = useState<Horizon>("Quý");

  // Hồi quy tuyến tính (OLS) trên chuỗi lịch sử, thêm sóng mùa vụ cho kỳ dự báo.
  const analysis = useMemo(() => {
    const values = INDUSTRY_TREND.map((row) => row.leasedHa);
    const n = values.length;
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
      points.push({
        period: INDUSTRY_TREND[i]!.period,
        actual: values[i]!,
        threshold: THRESHOLD_HA,
      });
    }
    const forecastCount = HORIZON_N[horizon];
    for (let j = 1; j <= forecastCount; j++) {
      const wave = Math.sin((n + j) * 0.6) * 22;
      points.push({
        period: `${HORIZON_LABEL[horizon]}${j}`,
        base: Math.max(0, Math.round(intercept + slope * (n + j) + wave)),
        threshold: THRESHOLD_HA,
      });
    }
    const lastActual = values[n - 1]!;
    const prevActual = values[n - 2] ?? lastActual;
    const maxBase = Math.max(...points.filter((p) => p.base !== undefined).map((p) => p.base ?? 0));
    return { points, lastActual, prevActual, maxBase, growthPerYearPct: (slope * 4) / lastActual };
  }, [horizon]);

  const nearlyFull = useMemo(
    () => CLUSTERS.filter((c) => c.occupancy >= NEARLY_FULL_PCT).sort((a, b) => b.occupancy - a.occupancy),
    [],
  );
  const slow = useMemo(
    () => CLUSTERS.filter((c) => c.occupancy <= SLOW_PCT).sort((a, b) => a.occupancy - b.occupancy),
    [],
  );

  const riskyRows = useMemo(
    () => [
      ...nearlyFull.map((c) => ({ cluster: c, level: "Cao" as const })),
      ...slow.map((c) => ({ cluster: c, level: "Trung bình" as const })),
    ],
    [nearlyFull, slow],
  );

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
            Phân tích nhu cầu đất công nghiệp nhằm hỗ trợ dự báo quỹ đất cho thuê, nhận diện cụm gần
            đầy và phục vụ xúc tiến đầu tư.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-background p-1">
          {HORIZONS.map((h) => (
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Đất CN đã cho thuê"
            value={`${fmt(analysis.lastActual)} ha`}
            delta={`▲ ${deltaPct(analysis.lastActual, analysis.prevActual).toFixed(1)}% so quý trước`}
            icon={Gauge}
            tone="gov"
          />
          <StatCard
            label="Dự báo cuối kỳ"
            value={`${fmt(analysis.maxBase)} ha`}
            delta={`Cuối kỳ ${horizon}`}
            icon={TrendingUp}
            tone="gov"
          />
          <StatCard
            label="Tăng trưởng nhu cầu"
            value={`+${(analysis.growthPerYearPct * 100).toFixed(1)}%/năm`}
            delta="Kỳ vọng theo xu hướng"
            icon={Activity}
            tone="warning"
          />
          <StatCard
            label="Cụm gần đầy (≥ 85%)"
            value={`${nearlyFull.length} cụm`}
            delta="Cần theo dõi quỹ đất trống"
            icon={AlertTriangle}
            tone="danger"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <ChartCard
            title="Dự báo nhu cầu đất công nghiệp"
            subtitle={`Chuỗi đất cho thuê toàn tỉnh · kỳ dự báo ${horizon}`}
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
                      Math.ceil((Math.max(dataMax, THRESHOLD_HA) * 1.08) / 50) * 50,
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
                    return [`${fmt(value)} ha`, label];
                  }}
                />
                <ReferenceLine
                  y={THRESHOLD_HA}
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
                Ngưỡng = 90% quỹ đất CCN đang vận hành ({fmt(THRESHOLD_HA)} ha)
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
                  Đất công nghiệp toàn tỉnh đã cho thuê ở mức{" "}
                  <span className="font-semibold">{fmt(analysis.lastActual)} ha</span> (lấp đầy
                  ~{Math.round((analysis.lastActual / THRESHOLD_HA) * 100)}%), dự báo đạt{" "}
                  <span className="font-semibold">{fmt(analysis.maxBase)} ha</span> vào cuối kỳ{" "}
                  {horizon} (tăng trưởng kỳ vọng{" "}
                  <span className="font-semibold">
                    +{(analysis.growthPerYearPct * 100).toFixed(1)}%/năm
                  </span>
                  ).
                </p>
                <p className="text-muted-foreground">
                  {nearlyFull.length > 0
                    ? `${nearlyFull.length} cụm gần đạt ngưỡng 90% (${nearlyFull.map((c) => c.name).join(", ")}), sẽ thiếu quỹ đất sạch trong kỳ tới.`
                    : "Chưa có cụm nào gần đạt ngưỡng 90%."}{" "}
                  Nhu cầu đất công nghiệp có xu hướng tăng đều, tập trung tại các khu dọc hành lang
                  cao tốc TP.HCM – Mộc Bài và QL22.
                </p>
                <p className="rounded-md border border-border bg-surface px-3 py-2.5 text-muted-foreground">
                  Gợi ý cán bộ chuyên môn:{" "}
                  {nearlyFull.length > 0
                    ? `rà soát cụm ${nearlyFull[0]!.name} (${nearlyFull[0]!.occupancy}%) gần đầy để quy hoạch mở rộng hoặc bố trí dự án sang cụm còn quỹ đất.`
                    : `không có cụm nào gần đầy, duy trì kế hoạch hiện tại.`}{" "}
                  Ưu tiên xúc tiến các ngành đang có nhu cầu cao.
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
                Chọn một cụm để khoan xuống chi tiết trên bản đồ.
              </p>
            </div>
            <Badge
              variant="outline"
              className="ml-auto shrink-0 rounded-md border-warning/40 bg-warning/15 text-warning"
            >
              {riskyRows.length} cảnh báo
            </Badge>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5">Cụm</th>
                  <th className="px-3 py-2.5">Xã/phường</th>
                  <th className="px-3 py-2.5">Lấp đầy</th>
                  <th className="px-3 py-2.5">Xu hướng</th>
                  <th className="px-3 py-2.5">Mức độ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {riskyRows.map(({ cluster, level }) => {
                  const nearlyFullRow = cluster.occupancy >= NEARLY_FULL_PCT;
                  return (
                    <tr
                      key={cluster.id}
                      onClick={() => onSelectCluster(cluster)}
                      className="cursor-pointer transition-colors hover:bg-gov/5"
                    >
                      <td className="px-4 py-2.5 font-medium text-navy">{cluster.name}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {cluster.ward} ·{" "}
                        {wardZoneOfCluster(cluster.id)?.type === "phuong" ? "phường" : "xã"}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{cluster.occupancy}%</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 font-semibold",
                            nearlyFullRow ? "text-destructive" : "text-warning",
                          )}
                        >
                          {nearlyFullRow ? (
                            <ArrowUp className="size-3.5" />
                          ) : (
                            <ArrowDown className="size-3.5" />
                          )}
                          {nearlyFullRow ? "Gần đầy" : "Chậm thu hút"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                            level === "Cao"
                              ? "border-destructive/30 bg-destructive/10 text-destructive"
                              : "border-warning/40 bg-warning/15 text-warning",
                          )}
                        >
                          {level}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {riskyRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-xs text-muted-foreground">
                      Không có cụm nào trong diện cảnh báo.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <footer className="border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
            Gồm cụm lấp đầy ≥ {NEARLY_FULL_PCT}% (gần đạt ngưỡng) và ≤ {SLOW_PCT}% (chậm thu hút đầu
            tư).
          </footer>
        </section>

        <p className="text-[11px] leading-4 text-muted-foreground">
          Kết quả phân tích và dự báo chỉ hỗ trợ công tác chuyên môn, không thay thế việc kiểm tra,
          đánh giá của cán bộ và cơ quan quản lý. Dữ liệu dự báo được sinh bằng hồi quy tuyến tính
          trên chuỗi lịch sử (deterministic) — chưa phải mô hình AI huấn luyện thực tế.
        </p>
      </div>
    </section>
  );
}

// Ngưỡng cảnh báo: 90% tổng quỹ đất CCN đang vận hành (24 CCN hoạt động · 1.179 ha).
const THRESHOLD_HA = Math.round((1179 * 90) / 100);

function deltaPct(current: number, prev: number) {
  if (!prev) return 0;
  return ((current - prev) / prev) * 100;
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
      <header className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-navy">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
      </header>
      <div className="flex-1 p-4">{children}</div>
    </section>
  );
}

function LegendDot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block size-2.5 rounded-full"
        style={
          dashed
            ? { border: `2px dashed ${color}`, background: "transparent" }
            : { background: color }
        }
      />
      {label}
    </span>
  );
}
