import { useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowRight, CalendarDays, Building2 } from "lucide-react";
import { PublicThumb } from "@/components/public/PublicShared";
import { SectionHeader } from "@/components/public/SectionHeader";
import { formatPortalDate } from "@/lib/portal-service";
import type { PortalPost } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = "all" | "ongoing" | "upcoming" | "ended";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "ongoing", label: "Đang diễn ra" },
  { id: "upcoming", label: "Sắp diễn ra" },
  { id: "ended", label: "Đã kết thúc" },
];

function filterMatch(p: PortalPost, f: Filter): boolean {
  if (f === "all") return true;
  const today = new Date().toISOString().slice(0, 10);
  const start = p.eventStartDate ?? today;
  const end = p.eventEndDate ?? start;
  if (f === "ongoing") return start <= today && today <= end;
  if (f === "upcoming") return start > today;
  return end < today;
}

export function PromotionPrograms({ items }: { items: PortalPost[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => items.filter((p) => filterMatch(p, filter)), [items, filter]);

  return (
    <section id="khuyen-mai" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <SectionHeader
        eyebrow="Ưu đãi cho người tiêu dùng"
        title="Chương trình khuyến mại"
        description="Các chương trình khuyến mại hợp lệ do Sở Công Thương công bố và giám sát trên địa bàn tỉnh."
      />

      <div className="mb-8 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              filter === f.id
                ? "border-gov bg-gov text-white shadow-sm"
                : "border-border bg-white text-muted-foreground hover:border-gov/40 hover:text-gov",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <div
            key={p.id}
            className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
          >
            <PublicThumb post={p} className="h-44" />
            <div className="flex flex-1 flex-col p-5">
              <h3 className="line-clamp-2 text-base font-bold leading-snug text-navy transition-colors group-hover:text-gov">
                {p.title}
              </h3>
              <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Building2 className="size-3.5 text-gov" /> {p.author ?? "Sở Công Thương"}
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5 text-gov" />
                {formatPortalDate(p.eventStartDate)} → {formatPortalDate(p.eventEndDate)}
              </p>
              <Link
                to="/trang-thong-tin/tin/$slug"
                params={{ slug: p.slug }}
                className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-gov transition-colors hover:text-navy"
              >
                Xem chi tiết <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Không có chương trình khuyến mại phù hợp bộ lọc hiện tại.
        </p>
      ) : null}
    </section>
  );
}
