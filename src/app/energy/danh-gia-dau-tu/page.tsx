import type { Metadata } from "next";

import { InvestmentAssessmentWorkspace } from "@/components/energy/InvestmentAssessmentWorkspace";

export const metadata: Metadata = {
  title: "Đánh giá đầu tư năng lượng | Nền tảng ngành Công Thương",
  description:
    "Sàng lọc vị trí đầu tư tại Tây Ninh theo hạ tầng lưới điện, nguồn năng lượng, an toàn, phát thải, trạm sạc và dữ liệu GIS.",
};

export default function Page() {
  return <InvestmentAssessmentWorkspace />;
}
