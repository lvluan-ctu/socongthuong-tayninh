import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Download, TrendingUp, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/common/ChartCard";
import { computeCoKpis, buildCoChartData, formatCurrency, formatNumber } from "@/lib/co/co-service";
import { CO_FORMS_MAP, CO_LEGAL_BASIS } from "@/lib/co/co-constants";
import { TT40_CONDITIONS } from "@/lib/co/co-regulation";
import { CO_STATUS_LABELS, type CoApplication } from "@/lib/co/co-types";
import { toast } from "sonner";

async function fetchApplications(): Promise<CoApplication[]> {
  const res = await fetch("/api/co/applications?options=true");
  if (!res.ok) throw new Error("Không thể tải danh sách hồ sơ C/O");
  const body = (await res.json()) as { items?: CoApplication[] };
  return Array.isArray(body.items) ? body.items : [];
}

function downloadCsv(fileName: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(",")).join("\r\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- Kỳ báo cáo (quý/năm) theo Phụ lục IV ----
type PeriodFilter = { key: string; label: string; test: (d: Date) => boolean };

function buildPeriodFilters(apps: CoApplication[]): PeriodFilter[] {
  const yearOf = (a: CoApplication) =>
    Number((a.coIssuedDate ?? a.createdAt).slice(0, 4));
  const years = [...new Set(apps.map(yearOf))].sort((a, b) => b - a);
  const filters: PeriodFilter[] = [
    { key: "all", label: "Tất cả các kỳ", test: () => true },
  ];
  for (const y of years) {
    filters.push({
      key: `y-${y}`,
      label: `Năm ${y}`,
      test: (d) => d.getFullYear() === y,
    });
    for (let q = 4; q >= 1; q--) {
      filters.push({
        key: `q-${y}-q${q}`,
        label: `Quý ${q}/${y}`,
        test: (d) =>
          d.getFullYear() === y && Math.floor(d.getMonth() / 3) + 1 === q,
      });
    }
  }
  return filters;
}

function periodOfApp(a: CoApplication): Date {
  return new Date(a.coIssuedDate ?? a.createdAt);
}

export function CoReportsPanel() {
  const { data: apps = [] } = useQuery({
    queryKey: ["co-applications"],
    queryFn: fetchApplications,
    retry: 1,
  });

  const kpis = useMemo(() => computeCoKpis(apps), [apps]);
  const chartData = useMemo(() => buildCoChartData(apps), [apps]);

  // ---- Kỳ báo cáo (quý/năm) ----
  const periodOptions = useMemo(() => buildPeriodFilters(apps), [apps]);
  const [periodKey, setPeriodKey] = useState("all");
  const period =
    periodOptions.find((p) => p.key === periodKey) ?? periodOptions[0];
  const periodApps = useMemo(
    () => apps.filter((a) => period.test(periodOfApp(a))),
    [apps, period],
  );

  // ---- Báo cáo Phụ lục IV (TT 40/2025) — theo kỳ đã chọn ----
  const appendix4 = useMemo(() => {
    const byForm = new Map<
      string,
      { issued: number; issuedValue: number; cancelled: number; cancelledValue: number }
    >();
    for (const app of periodApps) {
      const entry =
        byForm.get(app.formCode) ?? { issued: 0, issuedValue: 0, cancelled: 0, cancelledValue: 0 };
      const value = app.items.reduce((s, i) => s + i.fobValue, 0);
      if (app.status === "ISSUED") {
        entry.issued += 1;
        entry.issuedValue += value;
      }
      if (app.status === "CANCELLED") {
        entry.cancelled += 1;
        entry.cancelledValue += value;
      }
      byForm.set(app.formCode, entry);
    }
    return Array.from(byForm.entries())
      .map(([formCode, v]) => ({ formCode, ...v }))
      .sort((a, b) => b.issuedValue - a.issuedValue);
  }, [periodApps]);

  const appendix4Totals = appendix4.reduce(
    (acc, r) => ({
      issued: acc.issued + r.issued,
      issuedValue: acc.issuedValue + r.issuedValue,
      cancelled: acc.cancelled + r.cancelled,
      cancelledValue: acc.cancelledValue + r.cancelledValue,
    }),
    { issued: 0, issuedValue: 0, cancelled: 0, cancelledValue: 0 },
  );

  const statusBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    for (const app of periodApps) {
      const e = map.get(app.status) ?? { count: 0, value: 0 };
      e.count += 1;
      e.value += app.items.reduce((s, i) => s + i.fobValue, 0);
      map.set(app.status, e);
    }
    return Array.from(map.entries()).map(([status, v]) => ({ status, ...v }));
  }, [periodApps]);

  const periodSlug = period.key === "all" ? "tat-ca" : period.key;

  const exportMonthlyCsv = () => {
    const rows: (string | number)[][] = [
      ["Tháng", "Số hồ sơ", "Giá trị FOB (USD)"],
      ...chartData.monthlyTrend.map((d) => [d.month, d.count, d.value]),
    ];
    downloadCsv("bao-cao-co-theo-thang.csv", rows);
    toast.success("Đã xuất báo cáo theo tháng (CSV).");
  };

  const exportAppendix4Csv = () => {
    const rows: (string | number)[][] = [
      ["Mẫu C/O", "Đã cấp (số)", "Trị giá đã cấp (USD)", "Hủy/thu hồi (số)", "Trị giá hủy (USD)"],
      ...appendix4.map((r) => [
        CO_FORMS_MAP.get(r.formCode)?.name ?? r.formCode,
        r.issued,
        r.issuedValue,
        r.cancelled,
        r.cancelledValue,
      ]),
      ["Tổng cộng", appendix4Totals.issued, appendix4Totals.issuedValue, appendix4Totals.cancelled, appendix4Totals.cancelledValue],
    ];
    downloadCsv(`phu-luc-iv-bao-cao-cap-co-${periodSlug}.csv`, rows);
    toast.success(
      `Đã xuất báo cáo tình hình cấp C/O (${period.label}, Phụ lục IV, CSV).`,
    );
  };

  const exportFullCsv = () => {
    const rows: (string | number)[][] = [
      ["Số hồ sơ", "Mẫu", "FTA", "Xuất khẩu", "Nhập khẩu", "FOB (USD)", "Trạng thái", "Số C/O", "Ngày tạo"],
      ...apps.map((a) => [
        a.applicationNo,
        a.formCode,
        a.ftaCode,
        a.exporter.name,
        a.consignee.name,
        a.items.reduce((s, i) => s + i.fobValue, 0),
        CO_STATUS_LABELS[a.status] ?? a.status,
        a.coNumber ?? "",
        a.createdAt.slice(0, 10),
      ]),
    ];
    downloadCsv("tong-hop-ho-so-co.csv", rows);
    toast.success(`Đã xuất ${apps.length} hồ sơ ra CSV.`);
  };

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Tổng quan C/O" subtitle="Thống kê chung">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Tổng số hồ sơ</span>
              <span className="text-sm font-bold text-navy">{formatNumber(kpis.totalApplications)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Tổng giá trị FOB</span>
              <span className="text-sm font-bold text-navy">{formatCurrency(kpis.totalValue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Tổng tiết kiệm thuế</span>
              <span className="text-sm font-bold text-success">{formatCurrency(kpis.totalSavings)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Đã cấp C/O tháng này</span>
              <span className="text-sm font-bold text-gov">{kpis.issuedThisMonth}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Đang chờ xử lý</span>
              <span className="text-sm font-bold text-warning">{kpis.pendingCount}</span>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Phân bổ theo FTA" subtitle="Giá trị FOB theo hiệp định">
          <div className="space-y-2">
            {chartData.byFta.map((d) => {
              const pct = kpis.totalValue > 0 ? (d.value / kpis.totalValue) * 100 : 0;
              return (
                <div key={d.fta}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="font-medium text-navy">{d.fta}</span>
                    <span className="text-muted-foreground">{formatCurrency(d.value)}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-gov rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>

        <ChartCard title="Phân bổ theo thị trường" subtitle="Giá trị FOB theo nước nhập khẩu">
          <div className="space-y-2">
            {chartData.byCountry.slice(0, 6).map((d) => {
              const pct = kpis.totalValue > 0 ? (d.value / kpis.totalValue) * 100 : 0;
              return (
                <div key={d.country}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="font-medium text-navy">{d.country}</span>
                    <span className="text-muted-foreground">{formatCurrency(d.value)}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-teal rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>

      {/* ===== BÁO CÁO PHỤ LỤC IV — TT 40/2025 ===== */}
      <ChartCard
        title="Báo cáo tình hình cấp C/O (Phụ lục IV TT 40/2025)"
        subtitle={`Kỳ báo cáo: ${period.label} — số C/O đã cấp, trị giá USD, hủy/thu hồi theo mẫu C/O`}
        actions={
          <div className="flex items-center gap-2">
            <select
              value={periodKey}
              onChange={(e) => setPeriodKey(e.target.value)}
              className="h-8 rounded-md border border-border bg-card px-2 text-xs outline-none focus:border-gov"
              aria-label="Chọn kỳ báo cáo"
            >
              {periodOptions.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={exportAppendix4Csv}>
              <Download className="size-3.5 mr-1" /> Xuất CSV
            </Button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 px-3 text-left font-medium text-muted-foreground">Mẫu C/O</th>
                <th className="py-2 px-3 text-right font-medium text-muted-foreground">Đã cấp (số)</th>
                <th className="py-2 px-3 text-right font-medium text-muted-foreground">Trị giá (USD)</th>
                <th className="py-2 px-3 text-right font-medium text-muted-foreground">Hủy/thu hồi</th>
                <th className="py-2 px-3 text-right font-medium text-muted-foreground">Trị giá hủy (USD)</th>
              </tr>
            </thead>
            <tbody>
              {appendix4.map((r) => (
                <tr key={r.formCode} className="border-b border-border/50 hover:bg-surface/50">
                  <td className="py-2 px-3 font-medium text-navy">
                    {CO_FORMS_MAP.get(r.formCode)?.name ?? r.formCode}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums">{r.issued}</td>
                  <td className="py-2 px-3 text-right font-medium tabular-nums">
                    {formatCurrency(r.issuedValue)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-destructive">{r.cancelled}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                    {r.cancelled > 0 ? formatCurrency(r.cancelledValue) : "—"}
                  </td>
                </tr>
              ))}
              <tr className="bg-surface font-semibold">
                <td className="py-2 px-3 text-navy">Tổng cộng</td>
                <td className="py-2 px-3 text-right tabular-nums">{appendix4Totals.issued}</td>
                <td className="py-2 px-3 text-right tabular-nums">{formatCurrency(appendix4Totals.issuedValue)}</td>
                <td className="py-2 px-3 text-right tabular-nums text-destructive">{appendix4Totals.cancelled}</td>
                <td className="py-2 px-3 text-right tabular-nums">
                  {appendix4Totals.cancelled > 0 ? formatCurrency(appendix4Totals.cancelledValue) : "—"}
                </td>
              </tr>
            </tbody>
          </table>
          {appendix4.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Chưa có C/O được cấp</p>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {statusBreakdown.map((s) => (
            <span
              key={s.status}
              className="rounded-md border border-border bg-surface px-2 py-1 text-[11px]"
            >
              <span className="font-medium text-navy">
                {CO_STATUS_LABELS[s.status as keyof typeof CO_STATUS_LABELS] ?? s.status}
              </span>{" "}
              · {s.count} HS · {formatCurrency(s.value)}
            </span>
          ))}
        </div>
      </ChartCard>

      {/* Monthly trend table */}
      <ChartCard
        title="Xu hướng theo tháng"
        subtitle="Số lượng và giá trị C/O theo tháng"
        actions={
          <Button variant="outline" size="sm" onClick={exportMonthlyCsv}>
            <Download className="size-3.5 mr-1" /> Xuất CSV
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 px-3 text-left font-medium text-muted-foreground">Tháng</th>
                <th className="py-2 px-3 text-right font-medium text-muted-foreground">Số hồ sơ</th>
                <th className="py-2 px-3 text-right font-medium text-muted-foreground">Giá trị FOB</th>
                <th className="py-2 px-3 text-left font-medium text-muted-foreground">Biểu đồ</th>
              </tr>
            </thead>
            <tbody>
              {chartData.monthlyTrend.map((d) => (
                <tr key={d.month} className="border-b border-border/50 hover:bg-surface/50">
                  <td className="py-2 px-3 font-medium text-navy">{d.month}</td>
                  <td className="py-2 px-3 text-right">{d.count}</td>
                  <td className="py-2 px-3 text-right font-medium">{formatCurrency(d.value)}</td>
                  <td className="py-2 px-3">
                    <div className="h-2 bg-muted rounded-full overflow-hidden max-w-[120px]">
                      <div
                        className="h-full bg-gov rounded-full"
                        style={{
                          width: `${Math.min(
                            (d.value / Math.max(...chartData.monthlyTrend.map((x) => x.value), 1)) * 100,
                            100,
                          )}%`,
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {chartData.monthlyTrend.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Chưa có dữ liệu</p>
          )}
        </div>
      </ChartCard>

      {/* Export info */}
      <ChartCard
        title="Xuất báo cáo"
        subtitle="Tổng hợp số liệu để xuất báo cáo (quý/năm theo Phụ lục IV)"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-md border border-border bg-surface p-3 text-center">
            <FileText className="size-6 mx-auto text-muted-foreground mb-1" />
            <p className="text-sm font-medium text-navy">Báo cáo chi tiết hồ sơ</p>
            <p className="text-xs text-muted-foreground">Toàn bộ hồ sơ C/O kèm trạng thái</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={exportFullCsv}>
              <Download className="size-3 mr-1" /> Tải CSV
            </Button>
          </div>
          <div className="rounded-md border border-border bg-surface p-3 text-center">
            <FileCheck2 className="size-6 mx-auto text-muted-foreground mb-1" />
            <p className="text-sm font-medium text-navy">Báo cáo Phụ lục IV</p>
            <p className="text-xs text-muted-foreground">C/O đã cấp, hủy/thu hồi theo mẫu</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={exportAppendix4Csv}>
              <Download className="size-3 mr-1" /> Tải CSV
            </Button>
          </div>
          <div className="rounded-md border border-border bg-surface p-3 text-center">
            <TrendingUp className="size-6 mx-auto text-muted-foreground mb-1" />
            <p className="text-sm font-medium text-navy">Báo cáo theo tháng</p>
            <p className="text-xs text-muted-foreground">Số lượng & giá trị FOB từng tháng</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={exportMonthlyCsv}>
              <Download className="size-3 mr-1" /> Tải CSV
            </Button>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground text-center">
          Định dạng CSV mở được bằng Excel — phù hợp xuất báo cáo quý/năm theo Phụ lục IV TT
          40/2025/TT-BCT.
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground text-center">
          Căn cứ pháp lý: {CO_LEGAL_BASIS.filter((l) => l.number.includes("40/2025") || l.number.includes("34/2025")).map((l) => l.number).join(" · ")} ·{" "}
          {TT40_CONDITIONS.length} điều kiện Điều 5 đang áp dụng.
        </p>
      </ChartCard>
    </div>
  );
}
