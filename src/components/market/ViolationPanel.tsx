import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert } from "lucide-react";
import type { Business, Violation, ViolationStatus } from "@/lib/market-types";
import { cn } from "@/lib/utils";

function ViolationRow({ violation, businessName }: { violation: Violation; businessName: string }) {
  const statusTone =
    violation.status === "resolved"
      ? "border-success/30 bg-success/10 text-success"
      : violation.status === "appealing"
        ? "border-warning/40 bg-warning/15 text-warning"
        : "border-gov/30 bg-gov/10 text-gov";

  const statusLabel =
    violation.status === "resolved"
      ? "Đã xử lý"
      : violation.status === "appealing"
        ? "Đang khiếu nại"
        : "Chờ xử lý";

  return (
    <div className="rounded-md border border-border bg-surface/50 px-4 py-3 transition-colors hover:border-gov/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-destructive/10">
              <ShieldAlert className="size-3.5 text-destructive" />
            </span>
            <div>
              <p className="text-sm font-medium text-navy">{businessName}</p>
              <p className="text-xs text-muted-foreground">{violation.date}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-foreground">{violation.content}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              <span className="font-medium">Kết quả:</span> {violation.handlingResult}
            </span>
            {violation.fineAmount && (
              <span className="font-medium text-destructive">
                Phạt: {violation.fineAmount.toLocaleString("vi-VN")}đ
              </span>
            )}
            <span>
              <span className="font-medium">Cán bộ:</span> {violation.inspectorName}
            </span>
          </div>
        </div>
        <Badge variant="outline" className={cn("shrink-0 rounded-md text-[11px]", statusTone)}>
          {statusLabel}
        </Badge>
      </div>
    </div>
  );
}

export function ViolationPanel({ businesses }: { businesses: Business[] }) {
  const allViolations = useMemo(() => {
    const result: (Violation & { _businessName: string })[] = [];
    for (const b of businesses) {
      for (const v of b.violations) {
        result.push({ ...v, _businessName: b.name });
      }
    }
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [businesses]);

  const stats = useMemo(() => {
    const pending = allViolations.filter((v) => v.status === "pending").length;
    const resolved = allViolations.filter((v) => v.status === "resolved").length;
    const appealing = allViolations.filter((v) => v.status === "appealing").length;
    const totalFine = allViolations.reduce((s, v) => s + (v.fineAmount ?? 0), 0);
    return { total: allViolations.length, pending, resolved, appealing, totalFine };
  }, [allViolations]);

  return (
    <section className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md border border-border bg-surface px-3 py-2.5 text-center">
          <p className="text-xl font-semibold tabular-nums text-navy">{stats.total}</p>
          <p className="text-[11px] font-medium text-muted-foreground">Tổng vi phạm</p>
        </div>
        <div className="rounded-md border border-gov/30 bg-gov/5 px-3 py-2.5 text-center">
          <p className="text-xl font-semibold tabular-nums text-gov">{stats.pending}</p>
          <p className="text-[11px] font-medium text-muted-foreground">Chờ xử lý</p>
        </div>
        <div className="rounded-md border border-success/30 bg-success/5 px-3 py-2.5 text-center">
          <p className="text-xl font-semibold tabular-nums text-success">{stats.resolved}</p>
          <p className="text-[11px] font-medium text-muted-foreground">Đã xử lý</p>
        </div>
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-center">
          <p className="text-xl font-semibold tabular-nums text-destructive">
            {stats.totalFine > 0 ? `${(stats.totalFine / 1_000_000).toFixed(0)}tr` : "0"}
          </p>
          <p className="text-[11px] font-medium text-muted-foreground">Tổng tiền phạt</p>
        </div>
      </div>

      {/* Violation list */}
      <div className="space-y-2">
        {allViolations.map((v) => (
          <ViolationRow key={v.id} violation={v} businessName={v._businessName} />
        ))}
        {allViolations.length === 0 && (
          <div className="py-8 text-center">
            <ShieldAlert className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Chưa có vi phạm nào</p>
          </div>
        )}
      </div>
    </section>
  );
}
