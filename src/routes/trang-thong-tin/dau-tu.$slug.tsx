import { createFileRoute, notFound } from "@/lib/router-compat";
import { Building2, Map as MapIcon, MapPin, Phone } from "lucide-react";
import { DetailPageShell } from "@/components/public/DetailPageShell";
import { Button } from "@/components/ui/button";
import { CLUSTERS } from "@/data/mock";
import { getPostBySlug, getRelatedPosts } from "@/lib/portal-service";
import type { PortalPost } from "@/lib/types";

export const Route = createFileRoute("/trang-thong-tin/dau-tu/$slug")({
  head: () => ({
    meta: [
      { title: "Cơ hội đầu tư | Sở Công Thương tỉnh Tây Ninh" },
      {
        name: "description",
        content: "Thông tin dự án, khu/cụm công nghiệp và cơ hội đầu tư tại tỉnh Tây Ninh.",
      },
    ],
  }),
  component: InvestmentDetailPage,
});

function InvestmentDetailPage() {
  const { slug } = Route.useParams();
  // Cơ hội đầu tư hiện được đồng bộ từ module GIS (CLUSTERS).
  const cluster =
    CLUSTERS.find((c) => c.name.trim().toLowerCase().replace(/\s+/g, "-") === slug) ?? null;
  const post = cluster ? investmentPost(cluster.id) : getPostBySlug(slug);
  if (!post) throw notFound();
  const related = getRelatedPosts(post);

  const extra = (
    <div>
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-navy">
        <Building2 className="size-4 text-gov" /> Mời gọi đầu tư
      </h3>
      <iframe
        title={`Vị trí trên bản đồ: ${post.title}`}
        className="h-72 w-full rounded-xl border border-border"
        loading="lazy"
        src="https://www.openstreetmap.org/export/embed.html?bbox=105.9%2C10.95%2C106.4%2C11.7&layer=mapnik&marker=11.3066%2C106.15"
      />
      <p className="mt-3 text-sm text-muted-foreground">
        Vị trí quy hoạch Khu/Cụm công nghiệp trên bản đồ nền OpenStreetMap (vùng tỉnh Tây Ninh).
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button asChild className="rounded-full bg-gov text-white hover:bg-navy">
          <a href="/industrial-clusters" target="_blank" rel="noopener noreferrer">
            <MapIcon className="size-4" /> Xem vị trí trên bản đồ GIS
          </a>
        </Button>
        <Button asChild variant="outline" className="rounded-full text-gov">
          <a href={`mailto:sct@tayninh.gov.vn`}>
            <Phone className="size-4" /> Liên hệ đầu tư
          </a>
        </Button>
      </div>
    </div>
  );

  return (
    <DetailPageShell
      post={post}
      related={related}
      breadcrumb={{ label: "Cơ hội đầu tư", muc: "dau-tu" }}
      extra={extra}
    />
  );
}

// Trả về mô tả PortalPost từ dữ liệu cluster trong GIS — không duplicate dữ liệu.
function investmentPost(clusterId: string): PortalPost | undefined {
  const c = CLUSTERS.find((x) => x.id === clusterId);
  if (!c) return undefined;
  const remaining = c.area - c.leased;
  return {
    id: `investment-${c.id}`,
    type: "investment",
    title: c.name,
    slug: c.name.trim().toLowerCase().replace(/\s+/g, "-"),
    summary: `Cụm công nghiệp ${c.ward}: diện tích ${c.area} ha, tỷ lệ lấp đầy ${c.occupancy}%, ${c.enterprises} doanh nghiệp đang hoạt động.`,
    content: `Khu/Cụm công nghiệp ${c.name} nằm trên địa bàn ${c.ward}, tỉnh Tây Ninh.\n\nVới vị trí chiến lược kết nối vùng kinh tế trọng điểm phía Nam, khu/cụm đang mời gọi đầu tư vào các ngành ưu tiên: ${c.sectors}.\n\nHạ tầng giao thông, điện, nước, viễn thông và xử lý nước thải được đầu tư đồng bộ, sẵn sàng tiếp nhận các dự án sản xuất kinh doanh.`,
    category: "Khu/Cụm công nghiệp",
    tags: ["đầu tư", c.ward],
    publishedAt: "2026-08-01",
    status: "published",
    featured: true,
    location: `${c.ward}, Tây Ninh`,
    area: `${c.area} ha`,
    availableArea: `${Math.round(remaining)} ha`,
    industries: c.sectors
      .split(/[–\-/]/)
      .map((s) => s.trim())
      .filter(Boolean),
    views: 900,
  };
}
