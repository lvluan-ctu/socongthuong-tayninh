import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, FileDown, FileText, Loader2, ScrollText } from "lucide-react";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildEnergyReport } from "@/lib/grid-service";
import type { EnergyReportSection } from "@/lib/grid-types";
import { cn } from "@/lib/utils";

const YEARS = [2026, 2025, 2024];

export function EnergyReportExport() {
  const [year, setYear] = useState<number>(YEARS[0] ?? 2026);
  const reportQuery = useQuery({
    queryKey: ["grid", "energy-report", year],
    queryFn: () => buildEnergyReport(year),
  });
  const report = reportQuery.data;
  const [activeId, setActiveId] = useState<string>("");

  const active = useMemo(() => {
    if (!report) return undefined;
    return report.sections.find((s) => s.id === activeId) ?? report.sections[0];
  }, [report, activeId]);

  const handleDownload = () => {
    if (!report) return;
    const blob = new Blob(["\uFEFF" + report.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bao-cao-dien-luc-${report.year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="gov-card overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-grad-gov/60 px-4 py-3">
        <span className="flex size-9 items-center justify-center rounded-md bg-gov/10 text-gov">
          <FileText className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
            Báo cáo định kỳ — CSDL điện lực cấp tỉnh
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Mẫu 1.7a/b, 1.8a/b, 1.6a theo TT 34/2019/TT-BCT · gửi Bộ Công Thương trước 31/3 hàng năm
            (NĐ 56/2025/NĐ-CP, Điều 8.4)
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-3">
        <CalendarClock className="size-4 text-muted-foreground" />
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="h-8 w-36 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>
                Năm {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={handleDownload} disabled={!report}>
          <FileDown />
          Tải CSV
        </Button>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Trạng thái:</span>
          <Badge className="bg-success/10 text-success">
            <CheckCircle2 className="size-3" />
            Sẵn sàng kê khai
          </Badge>
        </div>
      </div>

      <div className="p-4">
        {reportQuery.isLoading || !report ? (
          <div className="grid h-64 place-items-center text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Đang tổng hợp số liệu kỳ báo cáo...
            </span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {report.sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveId(s.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] font-semibold transition-colors",
                    active?.id === s.id
                      ? "border-gov bg-gov/10 text-gov"
                      : "border-border bg-surface text-muted-foreground hover:border-gov/50 hover:text-gov",
                  )}
                >
                  <ScrollText className="size-3" />
                  {s.title}
                </button>
              ))}
            </div>

            <SectionView section={active} />

            <p className="text-[11px] leading-5 text-muted-foreground">
              Số liệu tự tổng hợp từ CSDL điện lực tỉnh (đường dây, trạm biến áp, nguồn NLTT, sản
              lượng truyền tải). File CSV được tạo ngay tại trình duyệt theo cấu trúc kê khai, phục
              vụ cán bộ Sở Công Thương hoàn thiện trước hạn 31/3.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function SectionView({ section }: { section: EnergyReportSection | undefined }) {
  if (!section) return null;
  type ReportRow = { id: string; cells: Array<string | number> };
  const rows: ReportRow[] = section.rows.map((cells, index) => ({ id: `${section.id}-${index}`, cells }));
  const columns: Column<ReportRow>[] = section.columns.map((title, index) => ({
    key: `cell-${index}`,
    header: title,
    sortable: true,
    value: (row) => row.cells[index] ?? "",
    className: index === 0 ? "font-medium text-navy" : "tabular-nums",
  }));
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-navy">{section.title}</p>
      <DataTable columns={columns} rows={rows} pageSize={8} searchPlaceholder="Tìm trong biểu báo cáo…" />
    </div>
  );
}
