import { Link } from "@/lib/router-compat";
import { ArrowRight, CalendarDays, Eye } from "lucide-react";
import { portalDetailTo, PublicThumb } from "@/components/public/PublicShared";
import { SectionHeader } from "@/components/public/SectionHeader";
import { formatPortalDate } from "@/lib/portal-service";
import type { PortalPost } from "@/lib/types";

export function FeaturedNews({ main, sidebar }: { main: PortalPost; sidebar: PortalPost[] }) {
  return (
    <section id="tin-tuc" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <SectionHeader
        eyebrow="Cập nhật liên tục"
        title="Tin nổi bật"
        description="Những thông tin hoạt động, chính sách và sự kiện tiêu biểu của ngành Công Thương tỉnh Tây Ninh."
      />
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Main featured — overlay trên ảnh */}
        <Link
          to={portalDetailTo(main)}
          className="group relative block overflow-hidden rounded-3xl border border-border bg-white shadow-sm transition-shadow hover:shadow-2xl lg:col-span-3"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
          <PublicThumb post={main} className="h-72 w-full sm:h-[26rem]" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-gov px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white shadow">
                {main.category}
              </span>
              <span className="flex items-center gap-1 text-xs text-white/80">
                <CalendarDays className="size-3.5" />
                {formatPortalDate(main.publishedAt)}
              </span>
            </div>
            <h3 className="text-xl font-bold leading-snug drop-shadow sm:text-2xl">{main.title}</h3>
            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-white/80 sm:text-[15px]">
              {main.summary}
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold">
              Xem chi tiết{" "}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </Link>

        {/* Sidebar list */}
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:col-span-2 lg:grid-cols-1 lg:gap-4">
          {sidebar.map((n) => (
            <Link
              key={n.id}
              to={portalDetailTo(n)}
              className="group flex gap-4 rounded-2xl border border-border bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <PublicThumb post={n} className="h-24 w-28 shrink-0 rounded-xl" />
              <div className="min-w-0 flex flex-col justify-center">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gov">
                  {n.category}
                </p>
                <h4 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-navy transition-colors group-hover:text-gov">
                  {n.title}
                </h4>
                <p className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="size-3" />
                    {formatPortalDate(n.publishedAt)}
                  </span>
                  {n.views ? (
                    <span className="flex items-center gap-1">
                      <Eye className="size-3" />
                      {n.views.toLocaleString("vi-VN")}
                    </span>
                  ) : null}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
