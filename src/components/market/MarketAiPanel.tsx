import { useMemo } from "react";
import { Brain, AlertTriangle, FileCheck2, ShieldAlert, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Business } from "@/lib/market-types";
import { FIELD_LABELS } from "@/lib/market-types";
import { cn } from "@/lib/utils";

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function MarketAiPanel({ businesses }: { businesses: Business[] }) {
  const analysis = useMemo(() => {
    // Giấy phép sắp hết hạn
    const expiring = businesses
      .flatMap((b) =>
        b.licenses
          .filter((l) => l.status === "expiring")
          .map((l) => ({ business: b, license: l, days: daysUntil(l.expiryDate) })),
      )
      .sort((a, b) => a.days - b.days);

    // DN có vi phạm
    const withViolations = businesses.filter((b) => b.violations.length > 0);
    const recentViolations = withViolations
      .flatMap((b) => b.violations.map((v) => ({ business: b, violation: v })))
      .sort((a, b) => new Date(b.violation.date).getTime() - new Date(a.violation.date).getTime())
      .slice(0, 5);

    // Thống kê theo lĩnh vực
    const fieldCounts = new Map<string, number>();
    for (const b of businesses) {
      const label = FIELD_LABELS[b.field];
      fieldCounts.set(label, (fieldCounts.get(label) ?? 0) + 1);
    }
    const topFields = Array.from(fieldCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // DN có nguy cơ
    const riskBusinesses = businesses.filter((b) => {
      const expiredGcn = b.gcnExpiryDate && daysUntil(b.gcnExpiryDate) <= 0;
      const suspended = b.status === "suspended";
      const hasViolations = b.violations.length >= 2;
      return expiredGcn || suspended || hasViolations;
    });

    return {
      expiring,
      recentViolations,
      topFields,
      riskBusinesses,
      totalBusinesses: businesses.length,
      totalCompanies: businesses.filter((b) => b.type === "company").length,
      totalHouseholds: businesses.filter((b) => b.type === "household").length,
    };
  }, [businesses]);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-analytics/10 text-analytics">
          <Brain className="size-5" />
        </span>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-navy">
            AI Phân tích thị trường
          </h3>
          <p className="text-xs text-muted-foreground">
            Phân tích tự động từ dữ liệu {analysis.totalBusinesses} thực thể
          </p>
        </div>
      </div>

      {/* Tổng quan */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border border-border bg-surface px-3 py-2.5 text-center">
          <p className="text-lg font-semibold tabular-nums text-navy">{analysis.totalBusinesses}</p>
          <p className="text-[11px] text-muted-foreground">Tổng thực thể</p>
        </div>
        <div className="rounded-md border border-border bg-surface px-3 py-2.5 text-center">
          <p className="text-lg font-semibold tabular-nums text-teal">{analysis.totalCompanies}</p>
          <p className="text-[11px] text-muted-foreground">Doanh nghiệp</p>
        </div>
        <div className="rounded-md border border-border bg-surface px-3 py-2.5 text-center">
          <p className="text-lg font-semibold tabular-nums text-gov">{analysis.totalHouseholds}</p>
          <p className="text-[11px] text-muted-foreground">Hộ kinh doanh</p>
        </div>
      </div>

      {/* Cảnh báo giấy phép sắp hết hạn */}
      {analysis.expiring.length > 0 && (
        <div className="rounded-md border border-warning/30 bg-warning/10 p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0 text-warning" />
            <p className="text-sm font-medium text-warning">
              {analysis.expiring.length} giấy phép sắp hết hạn
            </p>
          </div>
          <div className="mt-2 space-y-1.5">
            {analysis.expiring.slice(0, 3).map(({ business, license, days }) => (
              <div key={license.id} className="flex items-center justify-between text-xs">
                <span className="truncate text-foreground">{business.name}</span>
                <span className="shrink-0 pl-2 font-medium text-warning">
                  {days <= 0 ? "Hết hạn" : `Còn ${days} ngày`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DN có nguy cơ */}
      {analysis.riskBusinesses.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 shrink-0 text-destructive" />
            <p className="text-sm font-medium text-destructive">
              {analysis.riskBusinesses.length} thực thể có nguy cơ
            </p>
          </div>
          <div className="mt-2 space-y-1.5">
            {analysis.riskBusinesses.slice(0, 3).map((b) => (
              <div key={b.id} className="flex items-center justify-between text-xs">
                <span className="truncate text-foreground">{b.name}</span>
                <span className="shrink-0 pl-2 text-muted-foreground">
                  {b.violations.length > 0 ? `${b.violations.length} VP` : ""}
                  {b.status === "suspended" ? " · Tạm ngừng" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phân bố lĩnh vực */}
      <div className="rounded-md border border-border bg-surface p-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 shrink-0 text-gov" />
          <p className="text-sm font-medium text-navy">Phân bố theo lĩnh vực</p>
        </div>
        <div className="mt-2 space-y-1.5">
          {analysis.topFields.map(([field, count]) => (
            <div key={field} className="flex items-center gap-2 text-xs">
              <span className="flex-1 text-foreground">{field}</span>
              <span className="tabular-nums font-medium text-navy">{count}</span>
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gov"
                  style={{ width: `${(count / analysis.totalBusinesses) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vi phạm gần đây */}
      {analysis.recentViolations.length > 0 && (
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="text-sm font-medium text-navy">Vi phạm gần đây</p>
          <div className="mt-2 space-y-1.5">
            {analysis.recentViolations.map(({ business, violation }) => (
              <div key={violation.id} className="flex items-center justify-between text-xs">
                <span className="truncate text-foreground">{business.name}</span>
                <span className="shrink-0 pl-2 text-muted-foreground">{violation.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
