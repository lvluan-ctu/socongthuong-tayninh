import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@/lib/router-compat";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarDays,
  Database,
  ExternalLink,
  FileBarChart,
  Globe2,
  Handshake,
  Landmark,
  MapPin,
  Scale,
  Scale3d,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { ChartCard } from "@/components/common/ChartCard";
import { StatCard } from "@/components/common/StatCard";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DetailDrawer } from "@/components/common/DetailDrawer";
import { MiniBarChart, MiniDonutChart } from "@/components/dashboard/MiniCharts";
import { TradePromotionAiPanel } from "@/components/trade-promotion/TradePromotionAiPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PROMOTIONS } from "@/data/mock";
import { formatNumber, formatPercent } from "@/lib/report-service";
import {
  LEGAL_BASIS,
  XTTM_REPORT_ID,
  buildTradePromotionChartData,
  computeTradePromotionKpis,
  formatNghinUsd,
  readBiReportCount,
  syncTradePromotionToBi,
  type TradePromotionKpis,
} from "@/lib/trade-promotion-service";
import type { PromotionProgram } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/trade-promotion")({
  head: () => ({
    meta: [
      { title: "Xúc tiến thương mại | Nền tảng ngành Công Thương" },
      {
        name: "description",
        content:
          "Hội chợ, triển lãm, kết nối giao thương, khuyến mại và căn cứ pháp lý hoạt động xúc tiến thương mại của Sở Công Thương tỉnh Tây Ninh.",
      },
      { property: "og:title", content: "Xúc tiến thương mại" },
      {
        property: "og:description",
        content:
          "Hội chợ, triển lãm, kết nối giao thương, khuyến mại và thống kê hoạt động xúc tiến thương mại liên kết với Báo cáo & BI.",
      },
    ],
  }),
  component: Page,
});

const GOV = "oklch(0.513 0.16 255.7)";
const TEAL = "oklch(0.566 0.101 182.5)";
const SUCCESS = "oklch(0.523 0.135 144.2)";
const WARNING = "oklch(0.743 0.15 72.1)";
const DESTRUCTIVE = "oklch(0.539 0.194 26.7)";
const ANALYTICS = "oklch(0.549 0.162 297.7)";
const MUTED = "oklch(0.554 0.041 257.4)";

const KINDS = [
  "Tất cả",
  "Hội chợ",
  "Triển lãm",
  "Kết nối giao thương",
  "Khuyến mại",
  "Đoàn giao thương",
  "Hội thảo",
  "TMĐT",
] as const;
const YEARS = [2026, 2025] as const;

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-0.5 text-sm font-medium text-navy">{children}</div>
    </div>
  );
}

function KpiGrid({ k }: { k: TradePromotionKpis }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard label="Chương trình 2026" value={k.countYear} icon={FileBarChart} tone="gov" />
      <StatCard
        label="Tổng kinh phí 2026"
        value={formatNghinUsd(k.budget2026)}
        icon={Landmark}
        tone="teal"
      />
      <StatCard label="Lượt DN hỗ trợ" value={k.totalEnterprises} icon={Users} tone="analytics" />
      <StatCard label="Đang triển khai" value={k.ongoing} icon={CalendarDays} tone="warning" />
      <StatCard
        label="Tăng so 2025"
        value={formatPercent(k.growthBudget)}
        icon={k.growthBudget >= 0 ? ArrowUp : ArrowDown}
        tone={k.growthBudget >= 0 ? "success" : "danger"}
      />
    </section>
  );
}

function Page() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("programs");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("Tất cả");
  const [year, setYear] = useState<(typeof YEARS)[number] | "Tất cả">("Tất cả");
  const [selected, setSelected] = useState<PromotionProgram | null>(null);
  const [biCount, setBiCount] = useState(() => readBiReportCount());

  const kpis = useMemo(() => computeTradePromotionKpis(), []);
  const charts = useMemo(() => buildTradePromotionChartData(), []);

  const filtered = useMemo(
    () =>
      PROMOTIONS.filter(
        (p) => (kind === "Tất cả" || p.kind === kind) && (year === "Tất cả" || p.year === year),
      ),
    [kind, year],
  );

  const syncToBi = () => {
    const ds = syncTradePromotionToBi();
    setBiCount(readBiReportCount());
    toast.success(`Đã đồng bộ "${ds.name}" vào Kho báo cáo.`);
    navigate({ to: "/analytics", search: { ds: ds.id } });
  };

  const columns: Column<PromotionProgram>[] = [
    {
      key: "name",
      header: "Chương trình",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-navy">{r.name}</p>
          <p className="text-[11px] text-muted-foreground">{r.organizer}</p>
        </div>
      ),
    },
    { key: "kind", header: "Loại", sortable: true },
    { key: "time", header: "Thời gian", sortable: true, className: "whitespace-nowrap" },
    {
      key: "market",
      header: "Thị trường",
      sortable: true,
      render: (r) => r.market ?? "—",
    },
    { key: "enterprises", header: "DN tham gia", sortable: true, className: "text-right" },
    {
      key: "budget",
      header: "Kinh phí (nghìn USD)",
      sortable: true,
      className: "text-right",
      render: (r) => formatNumber(r.budget, 1),
    },
    {
      key: "fundSource",
      header: "Nguồn",
      sortable: true,
      render: (r) => (
        <Badge
          variant="outline"
          className={cn(
            "rounded-md font-medium",
            r.fundSource === "NSNN"
              ? "border-gov/25 bg-gov/5 text-gov"
              : "border-teal/25 bg-teal/5 text-teal",
          )}
        >
          {r.fundSource ?? "—"}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (r) => <StatusBadge status={r.status} />,
    },
  ];

  const yearOptions: number[] = [2026, 2025];

  return (
    <>
      <PageHeader
        title="Xúc tiến thương mại"
        description="Hội chợ, triển lãm, kết nối giao thương, khuyến mại và đào tạo TMĐT của Sở Công Thương tỉnh Tây Ninh — số liệu liên kết với Kho báo cáo & BI."
        crumbs={[{ label: "Nghiệp vụ" }, { label: "Xúc tiến thương mại" }]}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setTab("legal");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <Scale className="size-4" /> Căn cứ pháp lý
            </Button>
            <Button onClick={syncToBi}>
              <BarChart3 className="size-4" /> Đưa vào Báo cáo & BI
            </Button>
          </>
        }
      />

      <div className="space-y-5 p-4 sm:p-6">
        <KpiGrid k={kpis} />

        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="programs">Kế hoạch & chương trình</TabsTrigger>
              <TabsTrigger value="stats">Kết quả & thống kê</TabsTrigger>
              <TabsTrigger value="bi">Liên kết dữ liệu & BI</TabsTrigger>
              <TabsTrigger value="legal">Căn cứ pháp lý</TabsTrigger>
              <TabsTrigger value="ai">AI phân tích & dự báo</TabsTrigger>
            </TabsList>
          </div>

          {/* ---------------- KẾ HOẠCH & CHƯƠNG TRÌNH ---------------- */}
          <TabsContent value="programs" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="gap-1 rounded-md border-gov/25 bg-gov/5 font-medium text-gov"
              >
                <FileBarChart className="size-3" /> {filtered.length} chương trình
              </Badge>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])}
                className="h-9 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-gov"
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <select
                value={String(year)}
                onChange={(e) =>
                  setYear(
                    e.target.value === "Tất cả"
                      ? "Tất cả"
                      : (Number(e.target.value) as (typeof YEARS)[number]),
                  )
                }
                className="h-9 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-gov"
              >
                <option value="Tất cả">Tất cả năm</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    Năm {y}
                  </option>
                ))}
              </select>
            </div>

            <DataTable
              columns={columns}
              rows={filtered}
              onRowClick={(r) => setSelected(r)}
              searchPlaceholder="Tìm chương trình theo tên, đơn vị, thị trường..."
            />
          </TabsContent>

          {/* ---------------- KẾT QUẢ & THỐNG KÊ ---------------- */}
          <TabsContent value="stats" className="mt-4 space-y-4">
            <section className="grid gap-4 lg:grid-cols-2">
              <ChartCard
                title="Kinh phí theo loại hình"
                subtitle="Phân bổ kinh phí chương trình (nghìn USD)"
              >
                <MiniBarChart data={charts.budgetByKind} fill={GOV} height={220} />
              </ChartCard>
              <ChartCard
                title="Cơ cấu nguồn kinh phí"
                subtitle="Ngân sách nhà nước so với ngoài ngân sách"
              >
                <MiniDonutChart data={charts.fundSource} colors={[GOV, TEAL]} height={220} />
              </ChartCard>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <ChartCard
                title="So sánh 2025 và 2026"
                subtitle="Số chương trình · kinh phí · lượt doanh nghiệp"
              >
                <div className="h-52">
                  <BarChartInline data={charts.compare2025} />
                </div>
              </ChartCard>
              <ChartCard
                title="Thị trường & địa điểm"
                subtitle="Lượt doanh nghiệp tham gia theo thị trường (top 8)"
              >
                <MiniBarChart data={charts.byMarket.slice(0, 8)} fill={ANALYTICS} height={220} />
              </ChartCard>
            </section>
          </TabsContent>

          {/* ---------------- LIÊN KẾT DỮ LIỆU & BI ---------------- */}
          <TabsContent value="bi" className="mt-4 space-y-4">
            <div className="grid gap-4 lg:grid-cols-5">
              <ChartCard
                title="Pipeline liên kết dữ liệu"
                subtitle="Từ nghiệp vụ XTTM đến báo cáo thống kê"
                className="lg:col-span-3"
              >
                <ol className="space-y-3">
                  {[
                    {
                      icon: Globe2,
                      title: "1. Nghiệp vụ XTTM",
                      desc: "Hội chợ, triển lãm, kết nối giao thương, khuyến mại do Sở Công Thương tổ chức theo Nghị định 81/2018/NĐ-CP.",
                    },
                    {
                      icon: Database,
                      title: "2. Chuẩn hóa & CSDL",
                      desc: "Dữ liệu chương trình (loại hình, kinh phí, lượt DN, thị trường, nguồn ngân sách) được chuẩn hóa theo cấu trúc bảng.",
                    },
                    {
                      icon: BarChart3,
                      title: "3. Kho báo cáo & BI",
                      desc: "Tự sinh ReportDataset đưa vào trang Báo cáo & BI (/analytics): biểu đồ, KPI, so sánh kỳ, xuất báo cáo.",
                    },
                  ].map((s) => {
                    const Icon = s.icon;
                    return (
                      <li
                        key={s.title}
                        className="flex gap-3 rounded-md border border-border bg-surface p-3"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-gov/10 text-gov">
                          <Icon className="size-4.5" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-navy">{s.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{s.desc}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </ChartCard>

              <ChartCard
                title="Đồng bộ vào Kho báo cáo"
                subtitle="Một chạm đưa dữ liệu XTTM sang /analytics"
                className="lg:col-span-2"
              >
                <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-gov/30 bg-gov/5 p-6 text-center">
                  <FileBarChart className="size-10 text-gov" strokeWidth={1.5} />
                  <p className="text-sm font-medium text-navy">
                    Báo cáo kết quả XTTM 6 tháng đầu năm 2026
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Bảng dữ liệu {kpis.count2026} dòng theo chương trình, tự sinh tóm tắt AI và có
                    thể xuất CSV/Excel/Word/PDF.
                  </p>
                  <Badge
                    variant="outline"
                    className="rounded-md border-gov/25 bg-card font-medium text-gov"
                  >
                    <Database className="size-3" /> Kho báo cáo hiện có {biCount} báo cáo
                  </Badge>
                  <Button className="bg-gov text-white hover:bg-gov/90" onClick={syncToBi}>
                    <BarChart3 className="size-4" /> Đồng bộ & mở Báo cáo & BI
                  </Button>
                </div>
                <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
                  Báo cáo sẽ xuất hiện trong Kho báo cáo với mã <code>{XTTM_REPORT_ID}</code>, sẵn
                  sàng cho Dashboard, so sánh kỳ và xuất báo cáo.
                </p>
              </ChartCard>
            </div>
          </TabsContent>

          {/* ---------------- CĂN CỨ PHÁP LÝ ---------------- */}
          <TabsContent value="legal" className="mt-4 space-y-4">
            <ChartCard
              title="Căn cứ pháp lý hoạt động xúc tiến thương mại"
              subtitle="Các văn bản của Chính phủ, Bộ Công Thương và UBND tỉnh Tây Ninh quản lý hoạt động XTTM"
              actions={
                <Badge
                  variant="outline"
                  className="gap-1 rounded-md border-gov/25 bg-gov/5 font-medium text-gov"
                >
                  <Scale3d className="size-3" /> {LEGAL_BASIS.length} văn bản
                </Badge>
              }
            >
              <div className="space-y-3">
                {LEGAL_BASIS.map((l) => (
                  <div
                    key={l.code}
                    className="rounded-md border border-border bg-surface/50 p-3.5 transition-colors hover:border-gov/40"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Scale className="size-4 text-gov" />
                        <p className="text-sm font-semibold text-navy">{l.code}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className="rounded-md font-medium text-muted-foreground"
                        >
                          {l.agency}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="rounded-md font-medium text-muted-foreground"
                        >
                          {l.date}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-foreground">{l.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{l.summary}</p>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gov hover:text-navy"
                    >
                      <ExternalLink className="size-3" /> Xem nguồn văn bản
                    </a>
                  </div>
                ))}
              </div>
            </ChartCard>
          </TabsContent>

          {/* ---------------- AI PHÂN TÍCH & DỰ BÁO ---------------- */}
          <TabsContent value="ai" className="mt-4">
            <TradePromotionAiPanel />
          </TabsContent>
        </Tabs>
      </div>

      <DetailDrawer
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
        title={selected?.name ?? ""}
        description={selected ? `${selected.kind} · ${selected.time}` : ""}
      >
        {selected ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={selected.status} />
              <Badge
                variant="outline"
                className="rounded-md border-gov/25 bg-gov/5 font-medium text-gov"
              >
                {selected.kind}
              </Badge>
              {selected.fundSource ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-md font-medium",
                    selected.fundSource === "NSNN"
                      ? "border-gov/25 bg-gov/5 text-gov"
                      : "border-teal/25 bg-teal/5 text-teal",
                  )}
                >
                  {selected.fundSource}
                </Badge>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <InfoRow label="Đơn vị tổ chức">{selected.organizer}</InfoRow>
              <InfoRow label="Thời gian">{selected.time}</InfoRow>
              <InfoRow label="Thị trường / địa điểm">
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-gov" />
                  {selected.market ?? "—"}
                </span>
              </InfoRow>
              <InfoRow label="Năm thực hiện">
                {selected.year}
                {selected.quarter ? ` · ${selected.quarter}` : ""}
              </InfoRow>
              <InfoRow label="Doanh nghiệp tham gia">
                <span className="flex items-center gap-1.5">
                  <Users className="size-3.5 text-gov" />
                  {selected.enterprises} lượt
                </span>
              </InfoRow>
              <InfoRow label="Kinh phí">
                <span className="flex items-center gap-1.5">
                  <Landmark className="size-3.5 text-gov" />
                  {formatNumber(selected.budget, 1)} nghìn USD
                </span>
              </InfoRow>
            </div>

            {selected.agreements ? (
              <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/5 px-3 py-2.5 text-sm">
                <Handshake className="size-4 shrink-0 text-success" />
                <span className="font-medium text-success">
                  {selected.agreements} hợp đồng / biên bản ghi nhớ
                </span>
              </div>
            ) : null}

            {selected.note ? (
              <div className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-muted-foreground">
                {selected.note}
              </div>
            ) : null}

            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Kết quả
              </p>
              <p className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-navy">
                {selected.result}
              </p>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Căn cứ pháp lý
              </p>
              <p className="rounded-md border border-border bg-surface px-3 py-2.5 text-xs text-navy">
                {selected.legalBasis ?? "—"}
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button className="flex-1 bg-gov text-white hover:bg-gov/90" onClick={syncToBi}>
                <BarChart3 className="size-4" /> Đưa vào Báo cáo & BI
              </Button>
              <Button variant="outline" onClick={() => navigate({ to: "/analytics" })}>
                <FileBarChart className="size-4" /> Mở Báo cáo
              </Button>
            </div>
          </>
        ) : null}
      </DetailDrawer>
    </>
  );
}

function BarChartInline({ data }: { data: { name: string; a: number; b: number }[] }) {
  const max = Math.max(...data.map((d) => Math.max(d.a, d.b)), 1);
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.name}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-navy">{d.name}</span>
            <span className="tabular-nums text-muted-foreground">
              {d.a.toLocaleString("vi-VN")} → {d.b.toLocaleString("vi-VN")}
            </span>
          </div>
          <div className="flex h-4 items-center gap-1">
            <div className="flex-1 overflow-hidden rounded-full bg-surface-strong">
              <div
                className="h-full rounded-full"
                style={{ width: `${(d.a / max) * 100}%`, background: MUTED }}
              />
            </div>
            <div className="flex-1 overflow-hidden rounded-full bg-surface-strong">
              <div
                className="h-full rounded-full"
                style={{ width: `${(d.b / max) * 100}%`, background: GOV }}
              />
            </div>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: MUTED }} /> 2025
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: GOV }} /> 2026
        </span>
      </div>
    </div>
  );
}
