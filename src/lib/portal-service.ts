import { PORTAL_POSTS } from "@/data/portal";
import type { PortalContentType, PortalPost } from "@/lib/types";

// Service layer cho Trang thông tin (public portal).
// MOCK: đọc từ dữ liệu tĩnh. Sau này thay thế bằng REST API từ CMS/backend.
// Quy tắc chung: chỉ xuất bản nội dung có status === "published".

export function getPublishedPosts(): PortalPost[] {
  return PORTAL_POSTS.filter((p) => p.status === "published");
}

export function getPostsByType(type: PortalContentType): PortalPost[] {
  return getPublishedPosts().filter((p) => p.type === type);
}

export function getFeaturedNews(limit = 1): PortalPost[] {
  return getPostsByType("news")
    .filter((p) => p.featured)
    .slice(0, limit);
}

export function getSidebarNews(limit = 3): PortalPost[] {
  const featured = getFeaturedNews();
  const rest = getPostsByType("news").filter((p) => !featured.some((f) => f.id === p.id));
  return [...featured, ...rest].slice(0, limit);
}

export function getUpcomingEvents(limit = 4): PortalPost[] {
  return getPostsByType("event")
    .sort((a, b) => (a.eventStartDate ?? "").localeCompare(b.eventStartDate ?? ""))
    .slice(0, limit);
}

export function getPromotions(): PortalPost[] {
  return getPostsByType("promotion");
}

export function getTradePromotions(limit = 3): PortalPost[] {
  return getPostsByType("trade-promotion").slice(0, limit);
}

export function getMarketInfos(limit = 2): PortalPost[] {
  return getPostsByType("market-info").slice(0, limit);
}

export function getAnnouncements(limit = 5): PortalPost[] {
  return getPostsByType("announcement").slice(0, limit);
}

export function getNewsByCategory(category: string, limit?: number): PortalPost[] {
  const list = getPostsByType("news").filter((p) => p.category === category);
  return limit ? list.slice(0, limit) : list;
}

export function getPostBySlug(slug: string): PortalPost | undefined {
  return getPublishedPosts().find((p) => p.slug === slug);
}

export function getRelatedPosts(post: PortalPost, limit = 3): PortalPost[] {
  return getPublishedPosts()
    .filter(
      (p) =>
        p.id !== post.id &&
        p.type === post.type &&
        (p.category === post.category || p.tags.some((t) => post.tags.includes(t))),
    )
    .slice(0, limit);
}

export function getRecentPosts(limit = 4): PortalPost[] {
  return getPublishedPosts()
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit);
}

export function searchPortal(query: string, limit = 8): PortalPost[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return getPublishedPosts()
    .filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        (p.location ?? "").toLowerCase().includes(q),
    )
    .slice(0, limit);
}

export function formatPortalDate(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatPortalRange(start?: string, end?: string): string {
  const s = formatPortalDate(start);
  const e = formatPortalDate(end);
  if (!s && !e) return "";
  if (!e) return s;
  if (s === e) return s;
  return `${s} → ${e}`;
}

export const PORTAL_TYPE_LABEL: Record<PortalContentType, string> = {
  news: "Tin tức",
  event: "Sự kiện",
  promotion: "Khuyến mại",
  investment: "Cơ hội đầu tư",
  "trade-promotion": "Xúc tiến thương mại",
  "market-info": "Thông tin thị trường",
  announcement: "Thông báo",
};
