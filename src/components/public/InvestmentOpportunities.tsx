import { Link } from "@/lib/router-compat";
import { ArrowRight, MapPin } from "lucide-react";
import { SectionHeader } from "@/components/public/SectionHeader";
import { Button } from "@/components/ui/button";
import { CLUSTERS } from "@/data/mock";
import { PORTAL_INVESTMENT_NOTE } from "@/data/portal";

export function InvestmentOpportunities() {
  const zones = CLUSTERS.slice(0, 3);

  return (
    <section id="dau-tu" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <SectionHeader
        eyebrow="Thu hút đầu tư"
        title="Dự án & Cơ hội đầu tư"
        description="Các khu, cụm công nghiệp và cơ hội đầu tư hạ tầng trên địa bàn tỉnh Tây Ninh — đồng bộ từ dữ liệu GIS."
      />
      <div className="grid gap-6 md:grid-cols-3">
        {zones.map((c) => {
          const remaining = c.area - c.leased;
          return (
            <div
              key={c.id}
              className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="relative h-36 overflow-hidden bg-gradient-to-br from-slate-800 via-navy to-teal-600">
                <span className="absolute left-4 top-4 z-10 rounded-full bg-white/90 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-navy shadow">
                  {c.ward}
                </span>
                <span className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.18),transparent_45%)]" />
                <p className="absolute inset-0 flex items-end p-4 text-2xl font-extrabold uppercase tracking-wide text-white/90">
                  {c.name}
                </p>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="size-3.5 text-gov" /> Tây Ninh · {c.ward}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-surface px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Diện tích
                    </p>
                    <p className="font-semibold text-navy">{c.area} ha</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-emerald-700">
                      Đất còn lại
                    </p>
                    <p className="font-semibold text-emerald-700">{Math.round(remaining)} ha</p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Ngành ưu tiên
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {c.sectors
                      .split(/[–\-/]/)
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((s) => (
                        <span
                          key={s}
                          className="rounded-full border border-gov/25 bg-gov/5 px-2 py-0.5 text-[11px] font-medium text-gov"
                        >
                          {s}
                        </span>
                      ))}
                  </div>
                </div>
                <div className="mt-auto flex gap-2 pt-5">
                  <Button asChild size="sm" className="flex-1 rounded-full">
                    <Link to="/trang-thong-tin" search={{ muc: "dau-tu" }}>
                      Xem chi tiết
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-full text-gov"
                  >
                    <a
                      href="/industrial-clusters"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5"
                    >
                      Xem bản đồ <ArrowRight className="size-3.5" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-5 text-center text-xs text-muted-foreground">{PORTAL_INVESTMENT_NOTE}</p>
    </section>
  );
}
