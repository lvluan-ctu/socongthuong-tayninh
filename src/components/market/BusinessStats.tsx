import { useMemo } from "react";
import { Building2, FileCheck2, MapPin, ShieldAlert, Store } from "lucide-react";
import { StatCard } from "@/components/common/StatCard";
import type { Business, BusinessField } from "@/lib/market-types";
import { FIELD_LABELS } from "@/lib/market-types";

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function BusinessStats({ businesses }: { businesses: Business[] }) {
  const stats = useMemo(() => {
    const total = businesses.length;
    const companies = businesses.filter((b) => b.type === "company").length;
    const households = businesses.filter((b) => b.type === "household").length;
    const active = businesses.filter((b) => b.status === "active").length;
    const suspended = businesses.filter((b) => b.status === "suspended").length;
    const expired = businesses.filter((b) => b.status === "expired").length;

    const expiringGcn = businesses.filter((b) => {
      if (!b.gcnExpiryDate) return false;
      const days = daysUntil(b.gcnExpiryDate);
      return days > 0 && days <= 60;
    }).length;

    const expiredGcn = businesses.filter((b) => {
      if (!b.gcnExpiryDate) return false;
      return daysUntil(b.gcnExpiryDate) <= 0;
    }).length;

    const totalViolations = businesses.reduce((s, b) => s + b.violations.length, 0);

    const byField = new Map<BusinessField, number>();
    for (const b of businesses) {
      byField.set(b.field, (byField.get(b.field) ?? 0) + 1);
    }

    return {
      total,
      companies,
      households,
      active,
      suspended,
      expired,
      expiringGcn,
      expiredGcn,
      totalViolations,
      byField,
    };
  }, [businesses]);

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard
        label="Tổng thực thể"
        value={stats.total}
        delta={`${stats.companies} DN · ${stats.households} hộ KDD`}
        icon={Store}
        tone="gov"
      />
      <StatCard
        label="Đang hoạt động"
        value={stats.active}
        delta={`${stats.suspended} tạm ngừng · ${stats.expired} hết hạn`}
        icon={Building2}
        tone="success"
      />
      <StatCard
        label="Giấy phép sắp hết hạn"
        value={stats.expiringGcn}
        delta={stats.expiredGcn > 0 ? `${stats.expiredGcn} đã hết hạn` : "≤ 60 ngày"}
        icon={FileCheck2}
        tone={stats.expiringGcn > 0 ? "warning" : "success"}
      />
      <StatCard
        label="Tổng vi phạm"
        value={stats.totalViolations}
        delta="Đang theo dõi"
        icon={ShieldAlert}
        tone={stats.totalViolations > 0 ? "danger" : "success"}
      />
      <StatCard
        label="Lĩnh vực"
        value={stats.byField.size}
        delta={Array.from(stats.byField.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([f, n]) => `${FIELD_LABELS[f]}: ${n}`)
          .join(" · ")}
        icon={MapPin}
        tone="teal"
      />
    </section>
  );
}
