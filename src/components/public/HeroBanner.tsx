import { Link } from "@/lib/router-compat";
import { ArrowRight, Building2, Landmark, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const HERO_STATS = [
  { label: "Xuất khẩu 5 tháng", value: "8,13", unit: "tỷ USD", delta: "+16,1%" },
  { label: "Xuất siêu", value: "1,73", unit: "tỷ USD", delta: "giữ vững" },
  { label: "Tổng mức bán lẻ", value: "38.452", unit: "tỷ đồng", delta: "+22,35%" },
  { label: "Thị trường xuất khẩu", value: "150", unit: "quốc gia", delta: "+12 mới" },
];

export function HeroBanner() {
  return (
    <section className="relative overflow-hidden bg-navy text-white">
      {/* Nền: gradient + lưới pattern nhẹ */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(21,101,192,0.45),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(0,137,123,0.32),transparent_50%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:56px_56px]"
      />
      <div
        aria-hidden
        className="absolute -right-24 -top-24 size-96 rounded-full bg-gov/20 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute -bottom-32 -left-16 size-80 rounded-full bg-teal/20 blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="max-w-3xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white/90 backdrop-blur">
            <Landmark className="size-3.5" /> Cổng thông tin ngành Công Thương
          </p>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            THÔNG TIN NGÀNH CÔNG THƯƠNG
            <span className="block bg-gradient-to-r from-sky-300 via-white to-emerald-200 bg-clip-text text-transparent">
              TỈNH TÂY NINH
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
            Cập nhật thông tin – Kết nối doanh nghiệp – Xúc tiến thương mại – Đồng hành cùng nhà đầu
            tư và người dân trên địa bàn tỉnh.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-white px-6 text-navy shadow-lg hover:bg-white/90"
            >
              <Link to="/trang-thong-tin" search={{ muc: "tin-tuc" }}>
                Khám phá thông tin <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-white/40 bg-white/5 px-6 text-white hover:bg-white/15 hover:text-white"
            >
              <Link to="/trang-thong-tin" search={{ muc: "dau-tu" }}>
                <Building2 className="size-4" /> Cơ hội đầu tư
              </Link>
            </Button>
          </div>
        </div>

        {/* Dải thống kê nổi bật của tỉnh */}
        <div className="mt-12 grid grid-cols-2 gap-4 border-t border-white/15 pt-6 sm:mt-14 lg:grid-cols-4">
          {HERO_STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-white/15 bg-white/[0.06] p-4 backdrop-blur-sm"
            >
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/60">
                <TrendingUp className="size-3.5 text-emerald-300" />
                {s.label}
              </p>
              <p className="mt-1.5 text-2xl font-extrabold tabular-nums text-white">
                {s.value}
                <span className="ml-1 text-xs font-semibold text-white/60">{s.unit}</span>
              </p>
              <p className="mt-0.5 text-xs font-semibold text-emerald-300">{s.delta}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
