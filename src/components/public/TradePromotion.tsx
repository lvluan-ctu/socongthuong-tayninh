import { Link } from "@/lib/router-compat";
import { ArrowRight } from "lucide-react";
import { PublicThumb, portalDetailTo } from "@/components/public/PublicShared";
import { SectionHeader } from "@/components/public/SectionHeader";
import { formatPortalDate } from "@/lib/portal-service";
import type { PortalPost } from "@/lib/types";

export function TradePromotion({ items }: { items: PortalPost[] }) {
  return (
    <section id="xuc-tien-thuong-mai" className="bg-surface py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Đồng hành doanh nghiệp"
          title="Xúc tiến thương mại"
          description="Hội chợ, triển lãm, kết nối giao thương và hỗ trợ doanh nghiệp mở rộng thị trường trong nước, quốc tế."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {items.map((p) => (
            <Link
              key={p.id}
              to={portalDetailTo(p)}
              className="group overflow-hidden rounded-3xl border border-border bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              <PublicThumb post={p} className="h-40" />
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
      </div>
    </section>
  );
}
