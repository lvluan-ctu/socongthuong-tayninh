// ============================================================
// AI PHÂN TÍCH & DỰ BÁO XTTM — Trang Xúc tiến thương mại
// Demo: hồi quy tuyến tính + sóng mùa vụ trên chuỗi quý kinh phí
// và lượt doanh nghiệp (gom từ PROMOTIONS). Kết quả deterministic
// để mọi ô AI giải thích được. KHÔNG phải model thật.
// ============================================================
import { useMemo, useState } from "react";
import {
  Activity,
  ArrowUp,
  BrainCircuit,
  Info,
  Landmark,
  Lightbulb,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
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
import {
  computeTradePromotionForecast,
  formatNghinUsd,
  type XttmForecastHorizon,
} from "@/lib/trade-promotion-service";
import { formatNumber } from "@/lib/report-service";
import { cn } from "@/lib/utils";

const HORIZONS: XttmForecastHorizon[] = ["H2/2026", "Năm 2027"];

export function TradePromotionAiPanel() {
  const [horizon, setHorizon] = useState<XttmForecastHorizon>("H2/2026");
  const forecast = useMemo(() => computeTradePromotionForecast(horizon), [horizon]);

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
              <Sparkles className="size-3" /> Bản phân tích AI
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Dự báo kinh phí và lượt doanh nghiệp theo quý nhằm hỗ trợ lập kế hoạch xúc tiến thương
            mại và giải ngân năm 2026.
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
            label="Kinh phí 6T/2026"
            value={formatNghinUsd(forecast.budgetH1)}
            delta={`${formatNumber(forecast.budgetPlanPct < 0 ? 0 : (forecast.budgetH1 / forecast.budgetPlan) * 100, 0)}% kế hoạch năm`}
            icon={Landmark}
            tone="gov"
          />
          <StatCard
            label="Dự báo kinh phí 2026"
            value={formatNghinUsd(forecast.budgetYear)}
            delta={`+${forecast.growthBudgetPct}% so 2025 (${formatNghinUsd(forecast.budget2025)})`}
            icon={TrendingUp}
            tone="success"
          />
          <StatCard
            label="Lượt DN dự báo"
            value={`${formatNumber(forecast.enterprisesYear, 0)} lượt`}
            delta={`+${forecast.growthEnterprisesPct}% so 2025`}
            icon={Users}
            tone="analytics"
          />
          <StatCard
            label="Đạt kế hoạch 2026"
            value={`${formatNumber(forecast.budgetPlanPct, 0)}%`}
            delta={`KH ${formatNghinUsd(forecast.budgetPlan)}`}
            icon={Activity}
            tone={forecast.budgetPlanPct >= 100 ? "success" : "warning"}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="gov-card flex flex-col">
            <header className="flex flex-col gap-1 border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-navy">
                Dự báo kinh phí theo quý
              </h3>
              <p className="text-xs text-muted-foreground">
                Nghìn USD · cột = thực tế · đường = dự báo · đường đứt = bình quân quý theo kế hoạch
                2026
              </p>
            </header>
            <div className="flex-1 p-4">
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart
                  data={forecast.points}
                  margin={{ top: 8, right: 8, left: -14, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="quarter" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: unknown, name: string) => {
                      if (typeof value !== "number") return [String(value ?? ""), name];
                      const label =
                        name === "actual" ? "Thực tế" : name === "forecast" ? "Dự báo" : name;
                      return [`${formatNumber(value, 0)} nghìn USD`, label];
                    }}
                  />
                  <ReferenceLine
                    y={forecast.quarterPlan}
                    stroke="#E59A23"
                    strokeDasharray="5 5"
                    label={{ value: "KH/quý", position: "insideTopRight", fontSize: 10 }}
                  />
                  <Bar
                    dataKey="actual"
                    name="actual"
                    fill="#1565C0"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={34}
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    name="forecast"
                    stroke="#00897B"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
                <LegendDot color="#1565C0" label="Thực tế" />
                <LegendDot color="#00897B" label="Dự báo" />
                <LegendDot color="#E59A23" dashed label="Bình quân quý (KH 2026)" />
                <span className="ml-auto">Đơn vị: nghìn USD</span>
              </div>
            </div>
          </div>

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
                  {forecast.insights}
                </p>
                <p className="text-muted-foreground">
                  Loại hình chiếm kinh phí lớn nhất 2026 là{" "}
                  <span className="font-semibold text-navy">{forecast.topKind}</span>; thị trường có
                  lượt doanh nghiệp nhiều nhất là{" "}
                  <span className="font-semibold text-navy">{forecast.topMarket}</span>.
                </p>
              </div>
            </section>

            <section className="gov-card flex flex-col">
              <header className="flex items-center gap-2 border-b border-border px-4 py-3">
                <span className="flex size-8 items-center justify-center rounded-md bg-teal/15 text-teal">
                  <Lightbulb className="size-4.5" />
                </span>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-navy">
                  Khuyến nghị
                </h3>
              </header>
              <ul className="space-y-2 p-4">
                {forecast.recommendations.map((r) => (
                  <li
                    key={r}
                    className="flex gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs leading-5 text-muted-foreground"
                  >
                    <ArrowUp className="mt-0.5 size-3.5 shrink-0 text-teal" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>

        <p className="flex items-start gap-1.5 text-[11px] leading-5 text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 opacity-60" />
          Kết quả phân tích và dự báo được tạo theo mô hình minh họa (hồi quy tuyến tính + mùa vụ)
          từ dữ liệu demo, chỉ hỗ trợ công tác chuyên môn — không thay thế số liệu chính thức và
          quyết định của cơ quan có thẩm quyền.
        </p>
      </div>
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
