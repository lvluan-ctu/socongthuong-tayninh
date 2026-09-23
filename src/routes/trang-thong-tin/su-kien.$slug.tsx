import { createFileRoute, notFound } from "@/lib/router-compat";
import { CalendarDays, Clock, Mail, MapPin, Phone, User } from "lucide-react";
import { DetailPageShell } from "@/components/public/DetailPageShell";
import { Button } from "@/components/ui/button";
import {
  getPostBySlug,
  getRelatedPosts,
  formatPortalDate,
  formatPortalRange,
} from "@/lib/portal-service";
import { SITE_CONFIG } from "@/lib/site-config";

export const Route = createFileRoute("/trang-thong-tin/su-kien/$slug")({
  head: () => ({
    meta: [
      { title: "Sự kiện | Sở Công Thương tỉnh Tây Ninh" },
      {
        name: "description",
        content: "Chi tiết sự kiện, hội chợ, triển lãm của ngành Công Thương tỉnh Tây Ninh.",
      },
    ],
  }),
  component: EventDetailPage,
});

function EventDetailPage() {
  const { slug } = Route.useParams();
  const post = getPostBySlug(slug);
  if (!post) throw notFound();
  const related = getRelatedPosts(post);

  const extra = (
    <div>
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-navy">
        <CalendarDays className="size-4 text-gov" /> Thông tin sự kiện
      </h3>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <CalendarDays className="size-3.5" /> Thời gian
          </dt>
          <dd className="mt-1 font-medium text-navy">
            {formatPortalRange(post.eventStartDate, post.eventEndDate)}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Clock className="size-3.5" /> Giờ hoạt động
          </dt>
          <dd className="mt-1 font-medium text-navy">08:00 – 17:00</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <MapPin className="size-3.5" /> Địa điểm
          </dt>
          <dd className="mt-1 font-medium text-navy">{post.location ?? "Tây Ninh"}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <User className="size-3.5" /> Đơn vị tổ chức
          </dt>
          <dd className="mt-1 font-medium text-navy">
            {post.organizer ?? "Sở Công Thương tỉnh Tây Ninh"}
          </dd>
        </div>
        {post.audience ? (
          <div className="sm:col-span-2">
            <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <User className="size-3.5" /> Đối tượng tham gia
            </dt>
            <dd className="mt-1 font-medium text-navy">{post.audience}</dd>
          </div>
        ) : null}
        {post.registrationDeadline ? (
          <div className="sm:col-span-2">
            <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CalendarDays className="size-3.5" /> Thời hạn đăng ký
            </dt>
            <dd className="mt-1 font-medium text-warning">
              {formatPortalDate(post.registrationDeadline)}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-6 rounded-xl border border-border bg-white p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Thông tin liên hệ / đăng ký
        </p>
        <p className="text-sm text-muted-foreground">
          Vui lòng liên hệ{" "}
          <span className="font-semibold text-navy">Sở Công Thương tỉnh Tây Ninh</span> để được
          hướng dẫn đăng ký tham gia.
        </p>
        <p className="mt-2 flex flex-wrap gap-4 text-sm text-navy">
          <span className="flex items-center gap-1.5">
            <Phone className="size-4 text-gov" /> {SITE_CONFIG.contact.phone}
          </span>
          <span className="flex items-center gap-1.5">
            <Mail className="size-4 text-gov" /> {SITE_CONFIG.contact.email}
          </span>
        </p>
        <Button className="mt-4 rounded-full bg-gov px-6 hover:bg-navy">Đăng ký tham gia</Button>
      </div>
    </div>
  );

  return (
    <DetailPageShell
      post={post}
      related={related}
      breadcrumb={{ label: "Sự kiện", muc: "su-kien" }}
      extra={extra}
    />
  );
}
