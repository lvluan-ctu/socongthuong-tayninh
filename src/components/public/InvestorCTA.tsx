import { Link } from "@/lib/router-compat";
import { ArrowRight, Map, TrendingUp } from "lucide-react";

export function InvestorCTA() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-3xl bg-navy text-white">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(21,101,192,0.5),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(0,137,123,0.4),transparent_55%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:48px_48px]"
        />
        <div className="relative flex flex-col items-start gap-8 p-8 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest">
              <TrendingUp className="size-3.5" /> Nhà đầu tư
            </p>
            <h2 className="mt-4 text-2xl font-extrabold leading-tight sm:text-3xl">
              BẠN ĐANG TÌM KIẾM CƠ HỘI ĐẦU TƯ TẠI TÂY NINH?
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
              Khám phá các khu, cụm công nghiệp, dự án và cơ hội đầu tư hạ tầng trên địa bàn — với
              vị trí chiến lược kết nối vùng kinh tế trọng điểm phía Nam.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/trang-thong-tin"
              search={{ muc: "dau-tu" }}
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-navy transition-colors hover:bg-white/90"
            >
              Xem cơ hội đầu tư <ArrowRight className="size-4" />
            </Link>
            <a
              href="/industrial-clusters"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              <Map className="size-4" /> Xem bản đồ GIS
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
