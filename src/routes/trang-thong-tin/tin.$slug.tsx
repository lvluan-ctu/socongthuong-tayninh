import { createFileRoute, notFound } from "@/lib/router-compat";
import { DetailPageShell } from "@/components/public/DetailPageShell";
import { getPostBySlug, getRelatedPosts } from "@/lib/portal-service";

export const Route = createFileRoute("/trang-thong-tin/tin/$slug")({
  head: () => ({
    meta: [
      { title: "Chi tiết tin | Sở Công Thương tỉnh Tây Ninh" },
      {
        name: "description",
        content: "Chi tiết tin tức ngành Công Thương tỉnh Tây Ninh.",
      },
    ],
  }),
  component: NewsDetailPage,
});

function NewsDetailPage() {
  const { slug } = Route.useParams();
  const post = getPostBySlug(slug);
  if (!post) throw notFound();
  const related = getRelatedPosts(post);

  return (
    <DetailPageShell
      post={post}
      related={related}
      breadcrumb={{ label: "Tin tức", muc: "tin-tuc" }}
    />
  );
}
