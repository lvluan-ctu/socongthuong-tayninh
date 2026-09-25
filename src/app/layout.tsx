import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "mantine-datatable/styles.css";
import "leaflet/dist/leaflet.css";
import "../styles/vendor-frappe-gantt.css";
import "../styles.css";

import { mantineHtmlProps } from "@mantine/core";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";

import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nền tảng số hóa dữ liệu ngành Công Thương",
  description:
    "Nền tảng số hóa, chuẩn hóa và điều hành dữ liệu ngành Công Thương: CSDL ngành, GIS, năng lượng, BI và báo cáo.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={inter.variable} {...mantineHtmlProps}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
