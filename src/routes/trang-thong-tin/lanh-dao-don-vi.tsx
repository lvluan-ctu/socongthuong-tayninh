import { createFileRoute } from "@/lib/router-compat";
import { LeadershipPage } from "@/components/public/LeadershipPage";

export const Route = createFileRoute("/trang-thong-tin/lanh-dao-don-vi")({
  head: () => ({
    meta: [
      { title: "Lãnh đạo đơn vị | Sở Công Thương tỉnh Tây Ninh" },
      {
        name: "description",
        content:
          "Ban lãnh đạo và trưởng các phòng, đơn vị trực thuộc Sở Công Thương tỉnh Tây Ninh.",
      },
    ],
  }),
  component: LeadershipPage,
});
