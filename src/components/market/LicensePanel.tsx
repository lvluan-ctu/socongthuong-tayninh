import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileCheck2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import type { Business, License, LicenseStatus } from "@/lib/market-types";
import { cn } from "@/lib/utils";

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function LicenseRow({
  license,
  businessName,
}: {
  license: License & { _businessName?: string };
  businessName?: string;
}) {
  const days = daysUntil(license.expiryDate);
  const statusTone =
    license.status === "valid"
      ? "border-success/30 bg-success/10 text-success"
      : license.status === "expiring"
        ? "border-warning/40 bg-warning/15 text-warning"
        : "border-destructive/30 bg-destructive/10 text-destructive";

  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-surface/50 px-3 py-2.5 transition-colors hover:border-gov/40">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md",
          license.status === "valid"
            ? "bg-success/10 text-success"
            : license.status === "expiring"
              ? "bg-warning/15 text-warning"
              : "bg-destructive/10 text-destructive",
        )}
      >
        <FileCheck2 className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-navy">{license.type}</p>
          <Badge variant="outline" className={cn("shrink-0 rounded-md text-[11px]", statusTone)}>
            {license.status === "valid"
              ? "Còn hạn"
              : license.status === "expiring"
                ? `${days} ngày`
                : "Hết hạn"}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Số: {license.number} · Cấp: {license.issuedBy}
        </p>
        {businessName && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">DN: {businessName}</p>
        )}
      </div>
      <div className="text-right text-xs text-muted-foreground">
        <p>HSD: {license.expiryDate}</p>
        {license.status === "expiring" && (
          <p className="mt-0.5 text-[11px] font-medium text-warning">⚠ Sắp hết hạn</p>
        )}
      </div>
    </div>
  );
}

export function LicensePanel({ businesses }: { businesses: Business[] }) {
  const allLicenses = useMemo(() => {
    const result: (License & { _businessName: string })[] = [];
    for (const b of businesses) {
      for (const lic of b.licenses) {
        result.push({ ...lic, _businessName: b.name });
      }
    }
    return result.sort((a, b) => {
      const order = { expiring: 0, expired: 1, valid: 2 };
      return (order[a.status] ?? 2) - (order[b.status] ?? 2);
    });
  }, [businesses]);

  const stats = useMemo(() => {
    const valid = allLicenses.filter((l) => l.status === "valid").length;
    const expiring = allLicenses.filter((l) => l.status === "expiring").length;
    const expired = allLicenses.filter((l) => l.status === "expired").length;
    return { valid, expiring, expired, total: allLicenses.length };
  }, [allLicenses]);

  return (
    <section className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md border border-border bg-surface px-3 py-2.5 text-center">
          <p className="text-xl font-semibold tabular-nums text-navy">{stats.total}</p>
          <p className="text-[11px] font-medium text-muted-foreground">Tổng giấy phép</p>
        </div>
        <div className="rounded-md border border-success/30 bg-success/5 px-3 py-2.5 text-center">
          <p className="text-xl font-semibold tabular-nums text-success">{stats.valid}</p>
          <p className="text-[11px] font-medium text-muted-foreground">Còn hiệu lực</p>
        </div>
        <div className="rounded-md border border-warning/40 bg-warning/5 px-3 py-2.5 text-center">
          <p className="text-xl font-semibold tabular-nums text-warning">{stats.expiring}</p>
          <p className="text-[11px] font-medium text-muted-foreground">Sắp hết hạn</p>
        </div>
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-center">
          <p className="text-xl font-semibold tabular-nums text-destructive">{stats.expired}</p>
          <p className="text-[11px] font-medium text-muted-foreground">Đã hết hạn</p>
        </div>
      </div>

      {/* Warning banner */}
      {stats.expiring > 0 && (
        <div className="flex items-center gap-3 rounded-md border border-warning/30 bg-warning/10 px-4 py-3">
          <AlertTriangle className="size-5 shrink-0 text-warning" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-warning">
              {stats.expiring} giấy phép sắp hết hạn trong 60 ngày
            </p>
            <p className="text-xs text-muted-foreground">
              Cần liên hệ doanh nghiệp để gia hạn đúng hạn
            </p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0">
            <ExternalLink className="size-3.5" /> Xem tất cả
          </Button>
        </div>
      )}

      {/* License list */}
      <div className="space-y-2">
        {allLicenses.map((lic) => (
          <LicenseRow key={lic.id} license={lic} businessName={lic._businessName} />
        ))}
        {allLicenses.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Không có giấy phép nào</p>
        )}
      </div>
    </section>
  );
}
