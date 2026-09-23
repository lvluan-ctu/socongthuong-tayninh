import { Link } from "@/lib/router-compat";
import { ArrowRight } from "lucide-react";
import { PublicThumb, portalDetailTo } from "@/components/public/PublicShared";
import { formatPortalDate } from "@/lib/portal-service";
import type { PortalPost } from "@/lib/types";

export function CategoryNews({ category, items }: { category: string; items: PortalPost[] }) {
  return (
    <section id="tin-theo-linh-vuc" className="bg-surface py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 sm:mb-10">
          <div>
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-gov/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-gov">
              <span className="size-1.5 rounded-full bg-gov" />
              Tin theo lĩnh vực
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">
              Lĩnh vực: {category}
            </h2>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-3xl border border-border bg-white p-10 text-center text-sm text-muted-foreground">
            Hiện chưa có tin tức cho lĩnh vực <strong className="text-navy">{category}</strong>.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <Link
                key={p.id}
                to={portalDetailTo(p)}
                className="group overflow-hidden rounded-3xl border border-border bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                <PublicThumb post={p} className="h-44" />
                <div className="p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gov">
                    {p.category}
                  </p>
                  <h3 className="mt-1.5 line-clamp-2 text-base font-bold leading-snug text-navy transition-colors group-hover:text-gov">
                    {p.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.summary}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                    {formatPortalDate(p.publishedAt)}
                    <ArrowRight className="size-3.5 text-gov transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
