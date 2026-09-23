// ============================================================
// MOCK DATA — Báo cáo & BI. Dữ liệu mẫu cho DEMO.
// Sau này thay thế bằng dữ liệu thật từ file báo cáo đã chuẩn hóa.
// ============================================================
import type { ReportColumn, ReportDataset, ReportRow } from "@/lib/types";

export const REPORT_COLUMNS: ReportColumn[] = [
  { key: "country", header: "Quốc gia đầu tư", type: "text" },
  { key: "value2025", header: "XNK 6T/2025 (triệu USD)", type: "number" },
  { key: "value2026", header: "XNK 6T/2026 (triệu USD)", type: "number" },
  { key: "growth", header: "Tăng/giảm (%)", type: "percent" },
];

interface CountryRow {
  country: string;
  v2025: number;
  v2026: number;
}

const COUNTRY_ROWS: CountryRow[] = [
  { country: "China", v2025: 4680.71, v2026: 5554.47 },
  { country: "Viet Nam", v2025: 2164.89, v2026: 2334.2 },
  { country: "Taiwan", v2025: 1332.03, v2026: 1388.67 },
  { country: "Hoa Kỳ", v2025: 968.4, v2026: 1215.3 },
  { country: "Nhật Bản", v2025: 812.15, v2026: 874.22 },
  { country: "Hàn Quốc", v2025: 654.3, v2026: 702.41 },
  { country: "Singapore", v2025: 428.5, v2026: 391.25 },
  { country: "Thái Lan", v2025: 365.2, v2026: 402.8 },
  { country: "Malaysia", v2025: 301.75, v2026: 334.1 },
  { country: "Indonesia", v2025: 287.4, v2026: 265.9 },
  { country: "Hồng Kông", v2025: 245.6, v2026: 228.4 },
  { country: "Úc", v2025: 198.3, v2026: 210.15 },
  { country: "Đức", v2025: 152.4, v2026: 143.9 },
  { country: "Ấn Độ", v2025: 110.25, v2026: 138.7 },
];

function toPercent(v2025: number, v2026: number): number {
  if (!v2025) return 0;
  return Math.round(((v2026 - v2025) / v2025) * 1000) / 10;
}

function buildRows(): ReportRow[] {
  return COUNTRY_ROWS.map((c, i) => ({
    id: `R-${String(i + 1).padStart(2, "0")}`,
    cells: {
      country: c.country,
      value2025: c.v2025,
      value2026: c.v2026,
      growth: toPercent(c.v2025, c.v2026),
    },
  }));
}

export const SAMPLE_XNK_ROWS: ReportRow[] = buildRows();

export const SAMPLE_XNK_DATASET: ReportDataset = {
  id: "BC-MAU-6T",
  name: "Trị giá xuất nhập khẩu theo Quốc gia đầu tư 6 tháng năm 2026",
  fileName: "bao-cao-xnk-theo-quoc-gia-dau-tu-6t2026.csv",
  fileType: "MẪU",
  period: "6 tháng đầu 2026",
  year: 2026,
  quarter: "6T",
  source: "Phòng QLTM",
  columns: REPORT_COLUMNS,
  rows: buildRows(),
  status: "approved",
  extractedAt: "14/08/2026 08:00",
  savedAt: "14/08/2026 08:02",
  via: "sample",
};

// Nội dung file mẫu CSV để người dùng tải về và upload lại kiểm chứng pipeline.
export const SAMPLE_CSV_CONTENT =
  "Quốc gia đầu tư,XNK 6T/2025 (triệu USD),XNK 6T/2026 (triệu USD),Tăng/giảm (%)\n" +
  COUNTRY_ROWS.map((c) => `${c.country},${c.v2025},${c.v2026},${toPercent(c.v2025, c.v2026)}`).join(
    "\n",
  );

// Nội dung file mẫu Word (HTML) để tải về — Excel/Word mở được, pipeline mô phỏng trích xuất.
export const SAMPLE_WORD_HTML = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>Báo cáo mẫu</title></head><body>
<h3>SỞ CÔNG THƯƠNG TỈNH TÂY NINH</h3>
<h2>Trị giá xuất nhập khẩu của các doanh nghiệp theo Quốc gia đầu tư trong 6 tháng năm 2026</h2>
<p><i>Đơn vị tính: triệu USD</i></p>
<table border="1" cellspacing="0" cellpadding="4">
<tr><th>Quốc gia đầu tư</th><th>XNK 6T/2025 (triệu USD)</th><th>XNK 6T/2026 (triệu USD)</th><th>Tăng/giảm (%)</th></tr>
${COUNTRY_ROWS.map(
  (c) =>
    `<tr><td>${c.country}</td><td>${c.v2025.toLocaleString("en-US")}</td><td>${c.v2026.toLocaleString("en-US")}</td><td>${toPercent(c.v2025, c.v2026)}</td></tr>`,
).join("\n")}
</table>
</body></html>`;
