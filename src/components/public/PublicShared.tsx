import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { PortalPost } from "@/lib/types";

// Bản đồ gradient + icon theo loại nội dung — dùng thay cho ảnh thật (DEMO).
const THUMB_STYLES: Record<string, { grad: string; glyph: ReactNode }> = {
  news: { grad: "from-navy via-gov to-sky-500", glyph: "📰" },
  event: { grad: "from-amber-500 via-orange-500 to-rose-500", glyph: "🎪" },
  promotion: { grad: "from-emerald-500 via-teal-500 to-cyan-500", glyph: "🏷️" },
  investment: { grad: "from-slate-800 via-navy to-teal-600", glyph: "🏭" },
  "trade-promotion": { grad: "from-violet-600 via-fuchsia-500 to-pink-500", glyph: "🤝" },
  "market-info": { grad: "from-gov via-info to-cyan-600", glyph: "📈" },
  announcement: { grad: "from-rose-600 via-red-500 to-amber-500", glyph: "📢" },
};

export function PublicThumb({ post, className }: { post: PortalPost; className?: string }) {
  // Khi có ảnh thật (thumbnail) thì hiển thị ảnh, ngược lại dùng gradient + emoji (fallback demo).
  if (post.thumbnail) {
    return (
      <div className={cn("relative overflow-hidden bg-surface", className)}>
        <img
          src={post.thumbnail}
          alt={post.title}
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {post.featured ? (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-navy shadow">
            Nổi bật
          </span>
        ) : null}
      </div>
    );
  }

  const style = THUMB_STYLES[post.type] ?? THUMB_STYLES["news"]!;
  return (
    <div
      aria-hidden
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-gradient-to-br text-4xl",
        style.grad,
        className,
      )}
    >
      <span className="drop-shadow-lg">{style.glyph}</span>
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_45%)]" />
      {post.featured ? (
        <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-navy shadow">
          Nổi bật
        </span>
      ) : null}
    </div>
  );
}

export function portalDetailTo(p: PortalPost): string {
  switch (p.type) {
    case "event":
      return `/trang-thong-tin/su-kien/${p.slug}`;
    case "investment":
      return `/trang-thong-tin/dau-tu/${p.slug}`;
    default:
      return `/trang-thong-tin/tin/${p.slug}`;
  }
}
