import { Link } from "@/lib/router-compat";
import { ArrowRight, CalendarDays, Clock, MapPin } from "lucide-react";
import { SectionHeader } from "@/components/public/SectionHeader";
import { formatPortalDate } from "@/lib/portal-service";
import type { PortalPost } from "@/lib/types";

function monthDay(dateStr?: string): { day: string; month: string } {
  if (!dateStr) return { day: "--", month: "" };
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return { day: "--", month: "" };
  return { day: String(d.getDate()).padStart(2, "0"), month: `Tháng ${d.getMonth() + 1}` };
}

export function UpcomingEvents({ events }: { events: PortalPost[] }) {
  return (
    <section id="su-kien" className="bg-surface py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Đừng bỏ lỡ"
          title="Sự kiện sắp tới"
          description="Hội chợ, triển lãm, hội nghị và chương trình xúc tiến thương mại do ngành Công Thương tổ chức."
          moreMuc="su-kien"
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {events.map((e) => {
            const { day, month } = monthDay(e.eventStartDate);
            return (
              <div
                key={e.id}
                className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="relative flex items-center gap-4 bg-gradient-to-r from-navy to-gov p-5 text-white">
                  <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                    <div className="text-center">
                      <p className="text-2xl font-extrabold leading-none">{day}</p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider">
                        {month}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold">
                    {e.category}
                  </span>
                  <span className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-white/10 blur-2xl" />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-base font-bold leading-snug text-navy transition-colors group-hover:text-gov">
                    {e.title}
                  </h3>
                  <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    <p className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-gov" /> {e.location ?? "Tây Ninh"}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Clock className="size-3.5 text-gov" /> 08:00 – 17:00
                    </p>
                    <p className="flex items-center gap-1.5">
                      <CalendarDays className="size-3.5 text-gov" />
                      {formatPortalDate(e.eventStartDate)}
                      {e.eventEndDate && e.eventEndDate !== e.eventStartDate
                        ? ` – ${formatPortalDate(e.eventEndDate)}`
                        : ""}
                    </p>
                  </div>
                  <Link
                    to="/trang-thong-tin/su-kien/$slug"
                    params={{ slug: e.slug }}
                    className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-gov transition-colors hover:text-navy"
                  >
                    Xem sự kiện <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
