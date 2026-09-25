import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@/lib/router-compat";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Database,
  ExternalLink,
  FileBarChart,
  Globe2,
  Landmark,
  MapPin,
  Scale,
  Ship,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { ChartCard } from "@/components/common/ChartCard";
import { StatCard } from "@/components/common/StatCard";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DetailDrawer } from "@/components/common/DetailDrawer";
import { MiniBarChart } from "@/components/dashboard/MiniCharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TRADES, TRADE_PORTS } from "@/data/mock";
import { formatNumber } from "@/lib/report-service";
import {
  LEGAL_BASIS,
  XNK_REPORT_ID,
  buildImportExportChartData,
  computeImportExportKpis,
  formatTrieuUsd,
  formatTyUsd,
  readBiReportCount,
  syncImportExportToBi,
  type ImportExportKpis,
} from "@/lib/import-export-service";
import type { BorderGateRecord, TradeRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/import-export")({
  head: () => ({
    meta: [
      { title: "Xuất nhập khẩu | Nền tảng ngành Công Thương" },
      {
        name: "description",
        content:
          "Quản lý kim ngạch xuất nhập khẩu theo mặt hàng, doanh nghiệp, thị trường và cửa khẩu (Mộc Bài, Xa Mát, Tân Nam, Bình Hiệp) — liên kết với Báo cáo & BI.",
      },
      { property: "og:title", content: "Xuất nhập khẩu" },
      {
        property: "og:description",
        content:
          "Kim ngạch xuất nhập khẩu theo mặt hàng, doanh nghiệp, thị trường, cửa khẩu và thương mại biên giới — kèm căn cứ pháp lý của Bộ Công Thương.",
      },
    ],
  }),
  component: Page,
});

const GOV = "oklch(0.513 0.16 255.7)";
const TEAL = "oklch(0.566 0.101 182.5)";
const INDIGO = "oklch(0.549 0.162 297.7)";
const MUTED = "oklch(0.554 0.041 257.4)";

const DIRECTION_META: Record<string, { label: string; cls: string }> = {
  XK: { label: "Xuất khẩu", cls: "border-success/30 bg-success/10 text-success" },
  NK: { label: "Nhập khẩu", cls: "border-gov/25 bg-gov/10 text-gov" },
  "Quá cảnh": { label: "Quá cảnh", cls: "border-teal/25 bg-teal/10 text-teal" },
};

const GROUPS = [
  "Tất cả",
  "Cao su",
  "Nông sản",
  "Dệt may",
  "Điện tử",
  "Cơ khí",
  "Năng lượng",
  "Gỗ",
  "Quá cảnh",
] as const;

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

function KpiGrid({ k }: { k: ImportExportKpis }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard
        label="Tổng kim ngạch 6T/2026"
        value={formatTyUsd(k.total2026)}
        icon={Globe2}
        tone="gov"
      />
      <StatCard
        label="Xuất khẩu"
        value={formatTyUsd(k.export2026)}
        icon={TrendingUp}
        tone="success"
      />
      <StatCard label="Nhập khẩu" value={formatTyUsd(k.import2026)} icon={Ship} tone="teal" />
      <StatCard
        label="Xuất siêu"
        value={formatTyUsd(k.surplus2026)}
        icon={Landmark}
        tone="analytics"
      />
      <StatCard label="Tăng so cùng kỳ" value={`+${k.growth2026}%`} icon={ArrowUp} tone="success" />
    </section>
  );
}

function Page() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("items");
  const [group, setGroup] = useState<(typeof GROUPS)[number]>("Tất cả");
  const [selected, setSelected] = useState<TradeRecord | null>(null);
  const [selectedGate, setSelectedGate] = useState<BorderGateRecord | null>(null);
  const [biCount, setBiCount] = useState(() => readBiReportCount());

  const kpis = useMemo(() => computeImportExportKpis(), []);
  const charts = useMemo(() => buildImportExportChartData(), []);

  const filtered = useMemo(
    () => TRADES.filter((t) => group === "Tất cả" || t.hsGroup === group),
    [group],
  );

  const syncToBi = () => {
    const ds = syncImportExportToBi();
    setBiCount(readBiReportCount());
    toast.success(`Đã đồng bộ "${ds.name}" vào Kho báo cáo.`);
    navigate({ to: "/analytics", search: { ds: ds.id } });
  };

  const columns: Column<TradeRecord>[] = [
    {
      key: "name",
      header: "Hàng hóa",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-navy">{r.name}</p>
          <p className="text-[11px] text-muted-foreground">{r.hsGroup ?? "—"}</p>
        </div>
      ),
    },
    { key: "hs", header: "Mã HS", sortable: true, className: "whitespace-nowrap" },
    {
      key: "direction",
      header: "Hướng",
      sortable: true,
      render: (r) =>
        r.direction ? (
          <Badge
            variant="outline"
            className={cn("rounded-md font-medium", DIRECTION_META[r.direction]?.cls)}
          >
            {DIRECTION_META[r.direction]?.label ?? r.direction}
          </Badge>
        ) : (
          "—"
        ),
    },
    { key: "market", header: "Thị trường", sortable: true },
    {
      key: "gate",
      header: "Cửa khẩu",
      sortable: true,
      render: (r) => <span className="whitespace-nowrap">{r.gate ?? "—"}</span>,
    },
    {
      key: "exportValue",
      header: "Giá trị (triệu USD)",
      sortable: true,
      className: "text-right",
      render: (r) => formatNumber(r.value2026 ?? r.exportValue, 1),
    },
    {
      key: "growth",
      header: "Tăng/giảm",
      sortable: true,
      className: "text-right",
      render: (r) =>
        typeof r.growth === "number" ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 font-medium tabular-nums",
              r.growth >= 0 ? "text-success" : "text-destructive",
            )}
          >
            {r.growth >= 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            {r.growth >= 0 ? "+" : ""}
            {r.growth}%
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (r) =>
        r.status ? (
          <StatusBadge status={r.status} />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  const gateColumns: Column<BorderGateRecord>[] = [
    {
      key: "name",
      header: "Cửa khẩu",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-navy">
            {r.name.replace("Cửa khẩu quốc tế ", "").replace("Cửa khẩu chính ", "")}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {r.level} · {r.district}
          </p>
        </div>
      ),
    },
    {
      key: "value2026",
      header: "Kim ngạch 6T/2026 (tr.USD)",
      sortable: true,
      className: "text-right",
      render: (r) => formatNumber(r.value2026),
    },
    {
      key: "growth",
      header: "Tăng/giảm",
      sortable: true,
      className: "text-right",
      render: (r) => (
        <span
          className={cn(
            "font-medium tabular-nums",
            r.growth >= 0 ? "text-success" : "text-destructive",
          )}
        >
          {r.growth >= 0 ? "+" : ""}
          {r.growth}%
        </span>
      ),
    },
    {
      key: "fee2026",
      header: "Phí hạ tầng (tỷ đồng)",
      sortable: true,
      className: "text-right",
      render: (r) => formatNumber(r.fee2026),
    },
    {
      key: "declarations",
      header: "Tờ khai (tờ)",
      sortable: true,
      className: "text-right",
      render: (r) => r.declarations.toLocaleString("vi-VN"),
    },
    {
      key: "transit2026",
      header: "Quá cảnh (tr.USD)",
      sortable: true,
      className: "text-right",
      render: (r) => (r.transit2026 > 0 ? formatNumber(r.transit2026) : "—"),
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (r) => <StatusBadge status={r.status} />,
    },
  ];

  const feeTotal = TRADE_PORTS.reduce((s, g) => s + g.fee2026, 0);

  return (
    <>
      <PageHeader
        title="Xuất nhập khẩu"
        description="Quản lý kim ngạch xuất nhập khẩu theo mặt hàng, doanh nghiệp, thị trường và hệ thống cửa khẩu biên giới Tây Ninh — liên kết với Kho báo cáo & BI."
        crumbs={[{ label: "Nghiệp vụ" }, { label: "Xuất nhập khẩu" }]}
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
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="items">Kim ngạch theo mặt hàng</TabsTrigger>
            <TabsTrigger value="gates">Cửa khẩu & thương mại biên giới</TabsTrigger>
            <TabsTrigger value="bi">Liên kết dữ liệu & BI</TabsTrigger>
            <TabsTrigger value="legal">Căn cứ pháp lý</TabsTrigger>
          </TabsList>

          {/* ---------------- KIM NGẠCH THEO MẶT HÀNG ---------------- */}
          <TabsContent value="items" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="gap-1 rounded-md border-gov/25 bg-gov/5 font-medium text-gov"
              >
                <FileBarChart className="size-3" /> {filtered.length} mặt hàng
              </Badge>
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value as (typeof GROUPS)[number])}
                className="h-9 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-gov"
              >
                {GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <DataTable
              columns={columns}
              rows={filtered}
              onRowClick={(r) => setSelected(r)}
              searchPlaceholder="Tìm mặt hàng, mã HS, doanh nghiệp, thị trường..."
            />
          </TabsContent>

          {/* ---------------- CỬA KHẨU & THƯƠNG MẠI BIÊN GIỚI ---------------- */}
          <TabsContent value="gates" className="mt-4 space-y-4">
            <section className="grid gap-4 lg:grid-cols-2">
              <ChartCard
                title="Kim ngạch theo cửa khẩu 6T/2026"
                subtitle="Đơn vị: triệu USD · do Trung tâm Quản lý cửa khẩu Tây Ninh quản lý"
              >
                <MiniBarChart data={charts.gates} fill={INDIGO} height={220} />
              </ChartCard>
              <ChartCard
                title="Hàng hóa quá cảnh"
                subtitle="Triệu USD · quần áo, lốp xe, xe đạp, hàng tiêu dùng, thực phẩm"
              >
                {charts.gateTransit.length > 0 ? (
                  <MiniBarChart data={charts.gateTransit} fill={TEAL} height={220} />
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Chưa có số liệu quá cảnh.
                  </p>
                )}
              </ChartCard>
            </section>

            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="gap-1 rounded-md border-gov/25 bg-gov/5 font-medium text-gov"
              >
                <MapPin className="size-3" /> 4 cửa khẩu quốc tế · 4 cửa khẩu chính · 13 cửa khẩu
                phụ
              </Badge>
              <Badge
                variant="outline"
                className="gap-1 rounded-md border-success/25 bg-success/10 font-medium text-success"
              >
                Phí hạ tầng 6T/2026: {formatNumber(feeTotal)} tỷ đồng (+56%)
              </Badge>
            </div>

            <DataTable
              columns={gateColumns}
              rows={TRADE_PORTS}
              onRowClick={(r) => setSelectedGate(r)}
              searchPlaceholder="Tìm cửa khẩu, huyện, mặt hàng..."
            />
          </TabsContent>

          {/* ---------------- LIÊN KẾT DỮ LIỆU & BI ---------------- */}
          <TabsContent value="bi" className="mt-4 space-y-4">
            <div className="grid gap-4 lg:grid-cols-5">
              <ChartCard
                title="Pipeline liên kết dữ liệu"
                subtitle="Từ nghiệp vụ XNK đến báo cáo thống kê"
                className="lg:col-span-3"
              >
                <ol className="space-y-3">
                  {[
                    {
                      icon: Globe2,
                      title: "1. Nghiệp vụ XNK & biên mậu",
                      desc: "Kim ngạch theo mặt hàng, doanh nghiệp, thị trường và hoạt động tại 5 cửa khẩu theo Nghị định 69/2018/NĐ-CP và 14/2018/NĐ-CP.",
                    },
                    {
                      icon: Database,
                      title: "2. Chuẩn hóa & CSDL",
                      desc: "Dữ liệu kim ngạch (mặt hàng, mã HS, hướng XK/NK, cửa khẩu, thị trường) được chuẩn hóa theo cấu trúc bảng.",
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
                subtitle="Một chạm đưa dữ liệu XNK sang /analytics"
                className="lg:col-span-2"
              >
                <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-gov/30 bg-gov/5 p-6 text-center">
                  <FileBarChart className="size-10 text-gov" strokeWidth={1.5} />
                  <p className="text-sm font-medium text-navy">
                    Báo cáo kim ngạch XNK 6 tháng đầu năm 2026
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Bảng dữ liệu {TRADES.length} mặt hàng theo mã HS, hướng XK/NK, cửa khẩu, thị
                    trường — tự sinh tóm tắt AI, xuất CSV/Excel/Word/PDF.
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
                  Báo cáo sẽ xuất hiện trong Kho báo cáo với mã <code>{XNK_REPORT_ID}</code>, sẵn
                  sàng cho Dashboard, so sánh kỳ và xuất báo cáo.
                </p>
              </ChartCard>
            </div>
          </TabsContent>

          {/* ---------------- CĂN CỨ PHÁP LÝ ---------------- */}
          <TabsContent value="legal" className="mt-4 space-y-4">
            <ChartCard
              title="Căn cứ pháp lý quản lý xuất nhập khẩu"
              subtitle="Văn bản của Quốc hội, Chính phủ, Bộ Công Thương và UBND tỉnh Tây Ninh"
              actions={
                <Badge
                  variant="outline"
                  className="gap-1 rounded-md border-gov/25 bg-gov/5 font-medium text-gov"
                >
                  <Scale className="size-3" /> {LEGAL_BASIS.length} văn bản
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
        </Tabs>
      </div>

      {/* ---------------- DRAWER: MẶT HÀNG ---------------- */}
      <DetailDrawer
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
        title={selected?.name ?? ""}
        description={selected ? `${selected.hs} · ${selected.market}` : ""}
      >
        {selected ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {selected.status ? <StatusBadge status={selected.status} /> : null}
              {selected.direction ? (
                <Badge
                  variant="outline"
                  className={cn("rounded-md font-medium", DIRECTION_META[selected.direction]?.cls)}
                >
                  {DIRECTION_META[selected.direction]?.label ?? selected.direction}
                </Badge>
              ) : null}
              {selected.hsGroup ? (
                <Badge
                  variant="outline"
                  className="rounded-md border-teal/25 bg-teal/10 font-medium text-teal"
                >
                  {selected.hsGroup}
                </Badge>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <InfoRow label="Mã HS">{selected.hs}</InfoRow>
              <InfoRow label="Doanh nghiệp">{selected.enterprise}</InfoRow>
              <InfoRow label="Thị trường">{selected.market}</InfoRow>
              <InfoRow label="Cửa khẩu / cảng">{selected.gate ?? "—"}</InfoRow>
              <InfoRow label="Giá trị 6T/2025">
                {selected.value2025 !== undefined ? formatTrieuUsd(selected.value2025) : "—"}
              </InfoRow>
              <InfoRow label="Giá trị 6T/2026">
                {selected.value2026 !== undefined ? formatTrieuUsd(selected.value2026) : "—"}
              </InfoRow>
            </div>

            {selected.note ? (
              <div className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-muted-foreground">
                {selected.note}
              </div>
            ) : null}

            {selected.legalBasis ? (
              <div>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Căn cứ pháp lý
                </p>
                <p className="rounded-md border border-border bg-surface px-3 py-2.5 text-xs text-navy">
                  {selected.legalBasis}
                </p>
              </div>
            ) : null}

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

      {/* ---------------- DRAWER: CỬA KHẨU ---------------- */}
      <DetailDrawer
        open={!!selectedGate}
        onOpenChange={(v) => !v && setSelectedGate(null)}
        title={selectedGate?.name ?? ""}
        description={selectedGate ? `${selectedGate.level} · ${selectedGate.district}` : ""}
      >
        {selectedGate ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={selectedGate.status} />
              <Badge
                variant="outline"
                className="rounded-md border-gov/25 bg-gov/5 font-medium text-gov"
              >
                {selectedGate.level}
              </Badge>
              <Badge
                variant="outline"
                className="rounded-md border-teal/25 bg-teal/10 font-medium text-teal"
              >
                {selectedGate.country}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <InfoRow label="Địa bàn (huyện)">{selectedGate.district}</InfoRow>
              <InfoRow label="Kim ngạch 6T/2026">{formatTrieuUsd(selectedGate.value2026)}</InfoRow>
              <InfoRow label="Tăng/giảm so cùng kỳ">
                <span className={selectedGate.growth >= 0 ? "text-success" : "text-destructive"}>
                  {selectedGate.growth >= 0 ? "+" : ""}
                  {selectedGate.growth}%
                </span>
              </InfoRow>
              <InfoRow label="Phí hạ tầng 6T/2026">
                {formatNumber(selectedGate.fee2026)} tỷ đồng
              </InfoRow>
              <InfoRow label="Tờ khai (6T/2026)">
                {selectedGate.declarations.toLocaleString("vi-VN")} tờ
              </InfoRow>
              <InfoRow label="Hàng quá cảnh">
                {selectedGate.transit2026 > 0 ? formatTrieuUsd(selectedGate.transit2026) : "—"}
              </InfoRow>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Mặt hàng chủ lực
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedGate.goods.map((g) => (
                  <Badge
                    key={g}
                    variant="outline"
                    className="rounded-md border-gov/25 bg-gov/5 font-medium text-gov"
                  >
                    {g}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Điểm nổi bật
              </p>
              <p className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-navy">
                {selectedGate.highlight}
              </p>
            </div>

            {selectedGate.legalBasis ? (
              <div>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Căn cứ pháp lý
                </p>
                <p className="rounded-md border border-border bg-surface px-3 py-2.5 text-xs text-navy">
                  {selectedGate.legalBasis}
                </p>
              </div>
            ) : null}
          </>
        ) : null}
      </DetailDrawer>
    </>
  );
}
