import { Link } from "@/lib/router-compat";
import {
  ArrowRight,
  Building2,
  CalendarRange,
  Factory,
  Globe,
  Map,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const BUSINESS_LINKS: { label: string; icon: LucideIcon; muc?: string }[] = [
  { label: "Chương trình xúc tiến thương mại", icon: Globe, muc: "xuc-tien-thuong-mai" },
  { label: "Hội chợ & Triển lãm", icon: CalendarRange, muc: "su-kien" },
  { label: "Chương trình khuyến mại", icon: ShoppingBag, muc: "khuyen-mai" },
  { label: "Cơ hội đầu tư", icon: Building2, muc: "dau-tu" },
  { label: "Thông tin thị trường", icon: TrendingUp, muc: "thi-truong" },
  { label: "GIS Khu/Cụm công nghiệp", icon: Map, muc: "gis" },
];

export function BusinessCTA() {
  return (
    <section id="doanh-nghiep" className="bg-surface py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy via-gov to-teal p-8 text-white lg:col-span-2 lg:p-10">
            <span className="absolute -right-10 -top-10 size-40 rounded-full bg-white/10 blur-2xl" />
            <span className="relative grid size-12 place-items-center rounded-2xl bg-white/15">
              <Factory className="size-6" />
            </span>
            <h2 className="relative mt-5 text-2xl font-bold leading-tight">
              Dành cho doanh nghiệp
            </h2>
            <p className="relative mt-3 text-sm leading-relaxed text-white/80">
              Truy cập nhanh các chương trình, thông tin và công cụ hỗ trợ doanh nghiệp trên địa bàn
              tỉnh Tây Ninh.
            </p>
            <Link
              to="/co"
              search={{ tab: "doanh-nghiep" }}
              className="relative mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-white/90"
            >
              <Globe className="size-4" /> Tra cứu doanh nghiệp
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-3">
            {BUSINESS_LINKS.map((l) => {
              const external = l.muc === "gis";
              const Inner = (
                <>
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gov/10 text-gov transition-colors group-hover:bg-gov group-hover:text-white">
                    <l.icon className="size-5" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-navy">
                      {l.label}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-gov">
                      {external ? "Mở tab mới" : "Xem ngay"}
                      <ArrowRight className="size-3" />
                    </span>
                  </span>
                </>
              );
              return external ? (
                <a
                  key={l.label}
                  href="/industrial-clusters"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                >
                  {Inner}
                </a>
              ) : (
                <Link
                  key={l.label}
                  to="/trang-thong-tin"
                  search={l.muc ? { muc: l.muc } : {}}
                  className="group flex items-center gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                >
                  {Inner}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
