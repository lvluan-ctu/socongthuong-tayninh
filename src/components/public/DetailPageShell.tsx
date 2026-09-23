import type { ReactNode } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowRight, CalendarDays, ExternalLink, Eye, FileText, User } from "lucide-react";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicThumb, portalDetailTo } from "@/components/public/PublicShared";
import { formatPortalDate } from "@/lib/portal-service";
import type { PortalPost } from "@/lib/types";

export function DetailPageShell({
  post,
  related,
  breadcrumb,
  extra,
}: {
  post: PortalPost;
  related: PortalPost[];
  breadcrumb: { label: string; muc: string };
  extra?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-foreground antialiased">
      <PublicHeader />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-8 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/trang-thong-tin" className="hover:text-gov">
            Trang chủ
          </Link>
          <ArrowRight className="size-3" />
          <Link to="/trang-thong-tin" search={{ muc: breadcrumb.muc }} className="hover:text-gov">
            {breadcrumb.label}
          </Link>
          <ArrowRight className="size-3" />
          <span className="font-medium text-navy">Chi tiết</span>
        </nav>

        <article>
          <header>
            <span className="rounded-full bg-gov px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
              {post.category}
            </span>
            <h1 className="mt-4 text-2xl font-extrabold leading-tight tracking-tight text-navy sm:text-4xl">
              {post.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5 text-gov" />
                {formatPortalDate(post.publishedAt)}
              </span>
              {post.author ? (
                <span className="flex items-center gap-1.5">
                  <User className="size-3.5 text-gov" />
                  {post.author}
                </span>
              ) : null}
              {post.views ? (
                <span className="flex items-center gap-1.5">
                  <Eye className="size-3.5 text-gov" />
                  {post.views.toLocaleString("vi-VN")} lượt xem
                </span>
              ) : null}
              {post.source ? (
                <a
                  href={post.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 font-semibold text-gov hover:underline"
                >
                  <ExternalLink className="size-3.5" />
                  Nguồn: Cổng TTĐT Sở Công Thương Tây Ninh
                </a>
              ) : null}
            </div>
          </header>

          <PublicThumb post={post} className="mt-8 h-72 w-full sm:h-96" />

          <div className="mt-8 space-y-4">
            {post.content.split("\n\n").map((para, i) => (
              <p key={i} className="text-[15px] leading-7 text-slate-700">
                {para}
              </p>
            ))}
          </div>

          {post.tags.length ? (
            <div className="mt-8 flex flex-wrap gap-2">
              {post.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground"
                >
                  #{t}
                </span>
              ))}
            </div>
          ) : null}

          {extra ? (
            <div className="mt-10 rounded-2xl border border-border bg-surface p-6">{extra}</div>
          ) : null}

          {post.attachments && post.attachments.length ? (
            <div className="mt-10">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-navy">
                <FileText className="size-4 text-gov" /> File đính kèm
              </h3>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {post.attachments.map((a) => (
                  <li
                    key={a.name}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                  >
                    <span className="min-w-0 flex-1 break-words font-medium text-navy">
                      {a.name}
                    </span>
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 font-semibold text-gov hover:underline"
                    >
                      Tải xuống
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>

        {/* Related */}
        {related.length ? (
          <section className="mt-14">
            <h3 className="mb-5 text-lg font-bold text-navy">Tin liên quan</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.id}
                  to={portalDetailTo(r)}
                  className="group overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-shadow hover:shadow-lg"
                >
                  <PublicThumb post={r} className="h-28 w-full" />
                  <div className="p-3.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gov">
                      {r.category}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-navy group-hover:text-gov">
                      {r.title}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>
      <PublicFooter />
    </div>
  );
}
