import { Link } from "@/lib/router-compat";
import { ArrowRight, Bell } from "lucide-react";
import { SectionHeader } from "@/components/public/SectionHeader";
import { formatPortalDate } from "@/lib/portal-service";
import type { PortalPost } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Announcements({ items }: { items: PortalPost[] }) {
  return (
    <section id="thong-bao" className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Cập nhật từ cơ quan"
          title="Thông báo mới"
          description="Các thông báo quan trọng dành cho doanh nghiệp, hợp tác xã và người dân."
        />
        <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-sm">
          <ul className="divide-y divide-border">
            {items.map((a) => (
              <li key={a.id}>
                <Link
                  to="/trang-thong-tin/tin/$slug"
                  params={{ slug: a.slug }}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {a.featured ? (
                        <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                          MỚI
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          a.featured ? "bg-rose-50 text-rose-700" : "bg-gov/10 text-gov",
                        )}
                      >
                        {a.featured ? "QUAN TRỌNG" : "THÔNG BÁO"}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm font-medium text-navy">{a.title}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <Bell className="size-3.5 text-gov" />
                    {formatPortalDate(a.publishedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-5 text-right">
          <Link
            to="/trang-thong-tin"
            search={{ muc: "thong-bao" }}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-gov hover:text-navy"
          >
            Xem tất cả thông báo <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
