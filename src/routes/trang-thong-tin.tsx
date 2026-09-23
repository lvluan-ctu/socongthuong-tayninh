import { createFileRoute } from "@/lib/router-compat";
import { PublicPortalPage } from "@/components/public/PublicPortalPage";

interface PortalSearch {
  muc?: string;
}

export const Route = createFileRoute("/trang-thong-tin")({
  validateSearch: (search: Record<string, unknown>): PortalSearch => {
    const muc = search["muc"];
    return typeof muc === "string" ? { muc } : {};
  },
  head: () => ({
    meta: [
      { title: "Trang thông tin | Sở Công Thương tỉnh Tây Ninh" },
      {
        name: "description",
        content:
          "Cổng thông tin ngành Công Thương tỉnh Tây Ninh: tin tức, sự kiện, xúc tiến thương mại, cơ hội đầu tư và thông tin thị trường.",
      },
      { property: "og:title", content: "Trang thông tin | Sở Công Thương tỉnh Tây Ninh" },
      {
        property: "og:description",
        content:
          "Cập nhật thông tin – Kết nối doanh nghiệp – Xúc tiến thương mại – Đồng hành cùng nhà đầu tư.",
      },
    ],
  }),
  component: PortalPage,
});

function PortalPage() {
  const { muc } = Route.useSearch();
  return <PublicPortalPage muc={muc ?? ""} />;
}
