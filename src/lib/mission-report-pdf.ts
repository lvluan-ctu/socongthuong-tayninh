import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { createFont } from "fonteditor-core";
import type { Content, TableCell, TDocumentDefinitions, TFontDictionary } from "pdfmake/interfaces";
import { buildMissionReportInsights, formatMissionValue } from "@/lib/mission-report-analysis";
import type { MissionReportConfig, MissionSummary } from "@/lib/mission-report-types";

function text(value: unknown) {
  return String(value ?? "")
    .replace(/[–—‑]/g, "-")
    .replace(/\u0000/g, "")
    .trim();
}

function fontSourceFile(fileName: string) {
  return join(process.cwd(), "node_modules", "@fontsource", "noto-serif", "files", fileName);
}

function buildNotoSerifTtf(style: string) {
  const readSubset = (subset: "latin" | "latin-ext" | "vietnamese") =>
    createFont(readFileSync(fontSourceFile(`noto-serif-${subset}-${style}.woff`)), {
      type: "woff",
      compound2simple: true,
      kerning: true,
      inflate: (data) => Array.from(inflateSync(Buffer.from(data))),
    });

  const font = readSubset("latin");
  const knownCodePoints = new Set(font.get().glyf.flatMap((glyph) => glyph.unicode ?? []));

  for (const subsetName of ["latin-ext", "vietnamese"] as const) {
    const subset = readSubset(subsetName);
    const subsetData = subset.get();
    for (const glyph of subsetData.glyf) {
      if (!glyph.unicode) continue;
      glyph.unicode = glyph.unicode.filter((codePoint) => !knownCodePoints.has(codePoint));
      glyph.unicode.forEach((codePoint) => knownCodePoints.add(codePoint));
    }
    subsetData.glyf = subsetData.glyf.filter((glyph) => Boolean(glyph.unicode?.length));
    subset.set(subsetData);
    font.merge(subset, { scale: 1 });
  }

  return font.write({ type: "ttf", toBuffer: true, hinting: true, kerning: true });
}

function dateTime(value: string | Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function administrativeDate(value: Date) {
  const parts = new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "...";
  return `Tây Ninh, ngày ${get("day")} tháng ${get("month")} năm ${get("year")}`;
}

function sectionTitle(title: string): Content {
  return { text: text(title), style: "sectionTitle", margin: [0, 10, 0, 5] };
}

function bulletList(items: string[], color = "#111827"): Content {
  return {
    ul: items.map((item) => ({ text: text(item), color, margin: [0, 1, 0, 1] })),
    margin: [12, 0, 0, 4],
  };
}

function keyValueTable(rows: Array<[string, string]>): Content {
  return {
    table: {
      widths: [145, "*"],
      body: rows.map(([label, value]) => [
        { text: text(label), bold: true, fillColor: "#eef5fb" },
        { text: text(value) },
      ]),
    },
    layout: {
      hLineColor: () => "#cbd5e1",
      vLineColor: () => "#cbd5e1",
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 5,
      paddingBottom: () => 5,
    },
    margin: [0, 3, 0, 6],
  };
}

function kpiTable(data: MissionSummary): Content {
  const cells: TableCell[] = data.kpis.map((item) => ({
    stack: [
      { text: text(item.label), fontSize: 9.5, color: "#475569", bold: true },
      {
        text: text(formatMissionValue(item.value, item.unit)),
        fontSize: 16,
        color: "#0b4f78",
        bold: true,
        margin: [0, 3, 0, 0],
      },
    ],
    fillColor: "#f5f9fc",
    margin: [4, 4, 4, 4],
  }));
  while (cells.length % 2) cells.push({ text: "", fillColor: "#f5f9fc" });
  const body: TableCell[][] = [];
  for (let index = 0; index < cells.length; index += 2)
    body.push([cells[index]!, cells[index + 1]!]);
  return {
    table: { widths: ["*", "*"], body },
    layout: {
      hLineColor: () => "#bfd2e2",
      vLineColor: () => "#bfd2e2",
      paddingLeft: () => 7,
      paddingRight: () => 7,
      paddingTop: () => 6,
      paddingBottom: () => 6,
    },
    margin: [0, 4, 0, 8],
  };
}

function escapeXml(value: unknown) {
  return text(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function compactChartValue(value: number) {
  const absolute = Math.abs(value);
  const compact = (divisor: number, suffix: string) =>
    `${(value / divisor).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ${suffix}`;
  if (absolute >= 1_000_000_000) return compact(1_000_000_000, "tỷ");
  if (absolute >= 1_000_000) return compact(1_000_000, "triệu");
  if (absolute >= 1_000) return compact(1_000, "nghìn");
  return value.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
}

function barChartSvg(data: MissionSummary["breakdown"]) {
  const rows = data.slice(0, 10);
  const width = 430;
  const barStart = 166;
  const plotWidth = 175;
  const height = Math.max(90, rows.length * 25 + 12);
  const max = Math.max(1, ...rows.map((item) => item.value));
  const bars = rows
    .map((item, index) => {
      const barWidth = Math.max(2, (item.value / max) * plotWidth);
      const y = 8 + index * 25;
      const color = ["#1167a8", "#0891b2", "#0f766e", "#16a34a", "#f59e0b"][index % 5];
      const label = item.name.length > 27 ? `${item.name.slice(0, 26)}…` : item.name;
      return [
        `<text x="4" y="${y + 11}" font-size="8" fill="#334155">${escapeXml(label)}</text>`,
        `<rect x="${barStart}" y="${y}" width="${barWidth.toFixed(2)}" height="14" rx="2" fill="${color}"/>`,
        `<text x="${barStart + plotWidth + 8}" y="${y + 11}" font-size="8" fill="#0f172a">${escapeXml(compactChartValue(item.value))}</text>`,
      ].join("");
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><line x1="${barStart}" y1="4" x2="${barStart}" y2="${height - 4}" stroke="#94a3b8" stroke-width="1"/>${bars}</svg>`;
}

function trendChartSvg(data: MissionSummary) {
  const actual = data.intelligence?.trend ?? [];
  const forecast = data.intelligence?.forecast ?? [];
  const values = [
    ...actual.map((item) => item.value),
    ...forecast.flatMap((item) => [item.value, item.min, item.max]),
  ];
  const width = 430;
  const height = 190;
  const left = 58;
  const right = 12;
  const top = 14;
  const bottom = 35;
  if (values.length < 2) return "";
  const max = Math.max(1, ...values) * 1.05;
  const allCount = actual.length + forecast.length;
  const xAt = (index: number) =>
    left + (index / Math.max(1, allCount - 1)) * (width - left - right);
  const yAt = (value: number) =>
    height - bottom - (Math.max(0, value) / max) * (height - top - bottom);
  const pointAt = (value: number, index: number) =>
    `${xAt(index).toFixed(2)},${yAt(value).toFixed(2)}`;

  const yGrid = Array.from({ length: 5 }, (_, index) => {
    const value = (max / 4) * index;
    const y = yAt(value);
    return `<line x1="${left}" y1="${y.toFixed(2)}" x2="${width - right}" y2="${y.toFixed(2)}" stroke="#dbe4ec" stroke-width="0.7"/><text x="${left - 5}" y="${(y + 3).toFixed(2)}" text-anchor="end" font-size="7.2" fill="#475569">${escapeXml(compactChartValue(value))}</text>`;
  }).join("");

  const periods = [...actual.map((item) => item.period), ...forecast.map((item) => item.period)];
  const labelStep = Math.max(1, Math.ceil(periods.length / 6));
  const xLabels = periods
    .map((period, index) =>
      index % labelStep === 0 || index === periods.length - 1
        ? `<text x="${xAt(index).toFixed(2)}" y="${height - 13}" text-anchor="middle" font-size="7" fill="#475569">${escapeXml(period)}</text>`
        : "",
    )
    .join("");

  const actualLine = actual.map((item, index) => pointAt(item.value, index)).join(" ");
  const actualDots = actual
    .map(
      (item, index) =>
        `<circle cx="${xAt(index).toFixed(2)}" cy="${yAt(item.value).toFixed(2)}" r="2.3" fill="#1167a8"/>`,
    )
    .join("");
  const forecastStart = actual.at(-1)?.value;
  const forecastValues = forecastStart == null ? forecast : [{ value: forecastStart }, ...forecast];
  const forecastLine = forecastValues
    .map((item, index) => pointAt(item.value, Math.max(0, actual.length - 1) + index))
    .join(" ");
  const forecastDots = forecast
    .map(
      (item, index) =>
        `<circle cx="${xAt(actual.length + index).toFixed(2)}" cy="${yAt(item.value).toFixed(2)}" r="2.3" fill="#e59a23"/>`,
    )
    .join("");
  const band = forecast.length
    ? `<polygon points="${[
        ...forecast.map((item, index) => pointAt(item.max, actual.length + index)),
        ...[...forecast]
          .reverse()
          .map((item, reverseIndex) => pointAt(item.min, allCount - 1 - reverseIndex)),
      ].join(" ")}" fill="#fbbf24" fill-opacity="0.18" stroke="none"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect x="0" y="0" width="${width}" height="${height}" rx="6" fill="#f8fafc"/>${yGrid}${band}<line x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}" stroke="#64748b"/><polyline points="${actualLine}" fill="none" stroke="#1167a8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${actualDots}${forecastLine ? `<polyline points="${forecastLine}" fill="none" stroke="#e59a23" stroke-width="2.5" stroke-dasharray="7 5" stroke-linecap="round" stroke-linejoin="round"/>${forecastDots}` : ""}${xLabels}</svg>`;
}

function breakdownTable(data: MissionSummary): Content {
  const total = data.breakdown.reduce((sum, item) => sum + item.value, 0);
  return {
    table: {
      headerRows: 1,
      widths: [28, "*", 80, 70],
      body: [
        ["STT", "Nhóm dữ liệu", "Giá trị", "Tỷ trọng"].map((value) => ({
          text: value,
          style: "tableHeader",
        })),
        ...data.breakdown.map((item, index) => [
          { text: String(index + 1), alignment: "center" as const },
          { text: text(item.name) },
          { text: text(formatMissionValue(item.value)), alignment: "right" as const },
          {
            text: total > 0 ? `${((item.value / total) * 100).toFixed(1)}%` : "0%",
            alignment: "right" as const,
          },
        ]),
      ] as TableCell[][],
    },
    layout: "lightHorizontalLines",
    margin: [0, 4, 0, 8],
  };
}

function forecastTable(data: MissionSummary): Content {
  const forecast = data.intelligence?.forecast ?? [];
  if (!forecast.length) return { text: "Chưa đủ dữ liệu lập bảng dự báo.", italics: true };
  return {
    table: {
      headerRows: 1,
      widths: ["*", 90, 90, 90],
      body: [
        ["Kỳ tham khảo", "Kịch bản cơ sở", "Kịch bản thấp", "Kịch bản cao"].map((value) => ({
          text: value,
          style: "tableHeader",
        })),
        ...forecast.map((item) => [
          { text: text(item.period) },
          { text: text(formatMissionValue(item.value)), alignment: "right" as const },
          { text: text(formatMissionValue(item.min)), alignment: "right" as const },
          { text: text(formatMissionValue(item.max)), alignment: "right" as const },
        ]),
      ] as TableCell[][],
    },
    layout: "lightHorizontalLines",
    margin: [0, 4, 0, 8],
  };
}

function alertTable(data: MissionSummary): Content {
  const alerts = data.intelligence?.alerts ?? [];
  if (!alerts.length) return { text: "Không có cảnh báo trong kỳ báo cáo.", italics: true };
  return {
    table: {
      headerRows: 1,
      widths: [45, 105, 70, "*"],
      body: [
        ["Mức độ", "Đối tượng", "Chỉ số", "Nhận định và kiến nghị"].map((value) => ({
          text: value,
          style: "tableHeader",
        })),
        ...alerts.slice(0, 15).map((item) => [
          {
            text:
              item.severity === "danger"
                ? "KHẨN"
                : item.severity === "warning"
                  ? "CẢNH BÁO"
                  : "THEO DÕI",
            color:
              item.severity === "danger"
                ? "#b91c1c"
                : item.severity === "warning"
                  ? "#b45309"
                  : "#1167a8",
            bold: true,
            fontSize: 8.5,
          },
          { text: text(item.title), bold: true },
          { text: text(item.metric), fontSize: 9 },
          {
            stack: [
              { text: text(item.message), fontSize: 9 },
              {
                text: text(item.recommendation),
                fontSize: 9,
                italics: true,
                color: "#475569",
                margin: [0, 2, 0, 0],
              },
            ],
          },
        ]),
      ] as TableCell[][],
    },
    layout: "lightHorizontalLines",
    margin: [0, 4, 0, 8],
  };
}

function recordsTable(data: MissionSummary): Content {
  return {
    table: {
      headerRows: 1,
      widths: [26, 72, 150, 98, 78, 90, "*"],
      body: [
        ["STT", "Mã", "Đối tượng", "Phân loại", "Trạng thái", "Chỉ tiêu", "Địa bàn / kỳ"].map(
          (value) => ({ text: value, style: "tableHeader" }),
        ),
        ...data.records.slice(0, 50).map((item, index) => [
          { text: String(index + 1), alignment: "center" as const },
          { text: text(item.code), fontSize: 8.5 },
          { text: text(item.name), fontSize: 8.5 },
          { text: text(item.category), fontSize: 8.5 },
          { text: text(item.status), fontSize: 8.5 },
          { text: text(item.metric), fontSize: 8.5 },
          { text: text(item.area), fontSize: 8.5 },
        ]),
      ],
    },
    layout: {
      hLineColor: () => "#cbd5e1",
      vLineColor: () => "#e2e8f0",
      paddingLeft: () => 3,
      paddingRight: () => 3,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
    margin: [0, 4, 0, 8],
  };
}

export function missionReportFilename(taskId: number) {
  return `bao-cao-nhiem-vu-${taskId}-so-cong-thuong-tay-ninh.pdf`;
}

export function buildMissionReportDocument(
  data: MissionSummary,
  config: MissionReportConfig,
  generatedAt: Date,
  font = "NotoSerif",
): TDocumentDefinitions {
  const insights = buildMissionReportInsights(data, config);
  const intelligence = data.intelligence;
  const reportCode = `NV${data.taskId.toString().padStart(2, "0")}`;
  const content: Content[] = [
    {
      table: {
        widths: ["42%", "58%"],
        body: [
          [
            {
              stack: [
                { text: "UBND TỈNH TÂY NINH", alignment: "center", bold: true, fontSize: 12 },
                { text: "SỞ CÔNG THƯƠNG", alignment: "center", bold: true, fontSize: 13 },
                { text: "____________", alignment: "center", margin: [0, 1, 0, 4] },
                { text: "Số: .../BC-SCT", alignment: "center", fontSize: 13 },
              ],
            },
            {
              stack: [
                {
                  text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
                  alignment: "center",
                  bold: true,
                  fontSize: 12,
                },
                {
                  text: "Độc lập - Tự do - Hạnh phúc",
                  alignment: "center",
                  bold: true,
                  fontSize: 13,
                },
                { text: "________________________", alignment: "center", margin: [0, 1, 0, 4] },
                {
                  text: administrativeDate(generatedAt),
                  alignment: "center",
                  italics: true,
                  fontSize: 13,
                },
              ],
            },
          ],
        ],
      },
      layout: "noBorders",
      margin: [0, 0, 0, 12],
    },
    { text: "BÁO CÁO", alignment: "center", bold: true, fontSize: 16, margin: [0, 3, 0, 3] },
    {
      text: text(config.reportSubject),
      alignment: "center",
      bold: true,
      fontSize: 14,
      margin: [25, 0, 25, 7],
    },
    {
      table: {
        widths: ["*"],
        body: [
          [
            {
              text: "BÁO CÁO MINH HỌA - CHƯA PHẢI VĂN BẢN PHÁT HÀNH",
              alignment: "center",
              bold: true,
              color: "#b91c1c",
              fillColor: "#fef2f2",
              fontSize: 9.5,
              margin: [4, 3, 4, 3],
            },
          ],
        ],
      },
      layout: { hLineColor: () => "#fecaca", vLineColor: () => "#fecaca" },
      margin: [55, 0, 55, 10],
    },
    { text: "Kính gửi: Ủy ban nhân dân tỉnh Tây Ninh.", bold: true, margin: [0, 3, 0, 8] },
    {
      text: text(
        `Sở Công Thương báo cáo kết quả tổng hợp Nhiệm vụ ${data.taskId} - ${config.missionTitle} từ Hệ thống thông tin ngành Công Thương tại thời điểm ${dateTime(data.updatedAt)}. Báo cáo phục vụ trình diễn năng lực quản trị số, hỗ trợ theo dõi, cảnh báo và ra quyết định; các số liệu suy diễn hoặc mô phỏng được công khai riêng và không thay thế số liệu đã được cơ quan có thẩm quyền xác nhận.`,
      ),
      alignment: "justify",
      leadingIndent: 28,
      margin: [0, 0, 0, 5],
    },
    {
      text: text(config.executiveLead),
      alignment: "justify",
      leadingIndent: 28,
      margin: [0, 0, 0, 5],
    },
    sectionTitle("I. THÔNG TIN CHUNG VÀ CƠ SỞ LẬP BÁO CÁO"),
    bulletList(config.managementBasis),
    keyValueTable([
      ["Mã phiên trình diễn", `DEMO-${reportCode}`],
      ["Phạm vi", data.coverage],
      ["Thời điểm hệ thống tổng hợp", dateTime(data.updatedAt)],
      ["Nguồn tổng hợp", "hệ thống GIS và các bảng nghiệp vụ có truy vết nguồn"],
      ["Mức tin cậy", insights.dataConfidenceLabel],
      [
        "Phương pháp",
        intelligence?.forecast.length
          ? intelligence.forecastMethod
          : "Thống kê mô tả; chưa ngoại suy khi chuỗi có dưới 6 kỳ đủ dữ liệu.",
      ],
    ]),
    {
      text: "Thể thức trình bày tham chiếu Nghị định số 30/2020/NĐ-CP về công tác văn thư. Số văn bản, người ký và dấu cơ quan chỉ được bổ sung qua quy trình văn thư chính thức.",
      fontSize: 9,
      italics: true,
      color: "#475569",
      margin: [0, 2, 0, 5],
    },
    sectionTitle("II. KẾT QUẢ TỔNG HỢP VÀ CHỈ TIÊU ĐIỀU HÀNH"),
    kpiTable(data),
    { text: "Nhận định nổi bật", style: "subTitle" },
    bulletList(insights.executiveFindings),
    { text: "Câu hỏi điều hành cần quyết định", style: "subTitle", margin: [0, 7, 0, 2] },
    bulletList(config.decisionQuestions, "#7c2d12"),
    { text: "Cơ cấu dữ liệu nghiệp vụ", style: "subTitle", margin: [0, 7, 0, 2] },
    ...(data.breakdown.length
      ? ([
          {
            svg: barChartSvg(data.breakdown),
            width: 430,
            alignment: "center",
            margin: [0, 2, 0, 2],
          },
          breakdownTable(data),
        ] satisfies Content[])
      : ([{ text: "Chưa có dữ liệu cơ cấu để trình bày.", italics: true }] satisfies Content[])),
    sectionTitle("III. PHÂN TÍCH XU HƯỚNG VÀ KỊCH BẢN THAM KHẢO"),
    ...(intelligence?.trend.length
      ? ([
          { text: text(intelligence.trendTitle), style: "subTitle" },
          { svg: trendChartSvg(data), width: 430, alignment: "center", margin: [0, 4, 0, 3] },
          {
            columns: [
              { text: "Đường liền: chuỗi quan sát hiện có", color: "#1167a8", bold: true },
              {
                text: intelligence.forecast.length
                  ? "Nét đứt/vùng màu: kịch bản cơ sở và biên thấp - cao"
                  : "Chưa lập kịch bản: chuỗi dưới 6 kỳ đủ dữ liệu",
                color: intelligence.forecast.length ? "#b45309" : "#64748b",
                bold: true,
              },
              { text: `Đơn vị: ${text(intelligence.trendUnit)}`, alignment: "right" },
            ],
            fontSize: 9,
            margin: [0, 0, 0, 5],
          },
          forecastTable(data),
          {
            text: "Trục tung bắt đầu từ 0. Dải thấp - cao (nếu có) chỉ là biên kịch bản, không phải khoảng tin cậy thống kê.",
            fontSize: 9.5,
            italics: true,
            color: "#475569",
            margin: [0, 1, 0, 2],
          },
          {
            text: text(`Phương pháp: ${intelligence.forecastMethod}`),
            fontSize: 9.5,
            italics: true,
            color: "#475569",
          },
        ] satisfies Content[])
      : ([
          { text: "Chưa đủ chuỗi dữ liệu để lập phân tích xu hướng và dự báo.", italics: true },
        ] satisfies Content[])),
    sectionTitle("IV. CẢNH BÁO, RỦI RO VÀ VẤN ĐỀ CẦN XỬ LÝ"),
    keyValueTable([
      ["Khẩn cấp", `${insights.dangerCount} cảnh báo`],
      ["Cảnh báo", `${insights.warningCount} cảnh báo`],
      ["Theo dõi", `${insights.infoCount} nội dung`],
    ]),
    alertTable(data),
    sectionTitle("V. ĐÁNH GIÁ GIÁ TRỊ ĐẦU TƯ NỀN TẢNG"),
    {
      text: "Các giá trị quản trị dự kiến",
      style: "subTitle",
    },
    bulletList(config.investmentBenefits, "#0f5132"),
    {
      text: "Trọng tâm phân tích cần duy trì",
      style: "subTitle",
      margin: [0, 7, 0, 2],
    },
    bulletList(config.analyticalFocus),
    sectionTitle("VI. NHIỆM VỤ, GIẢI PHÁP VÀ KIẾN NGHỊ"),
    { text: "Kiến nghị điều hành thường trực", style: "subTitle" },
    {
      ol: config.standingRecommendations.map((item) => ({
        text: text(item),
        margin: [0, 1, 0, 1],
      })),
      margin: [12, 0, 0, 5],
    },
    { text: "Ưu tiên triển khai tiếp theo", style: "subTitle", margin: [0, 7, 0, 2] },
    {
      ol: config.implementationPriorities.map((item) => ({
        text: text(item),
        margin: [0, 1, 0, 1],
      })),
      margin: [12, 0, 0, 5],
    },
    sectionTitle("VII. KIỂM SOÁT CHẤT LƯỢNG VÀ GIỚI HẠN SỬ DỤNG"),
    keyValueTable([
      [
        "Bản ghi có nguồn đối soát",
        (intelligence?.provenance.sourceRecords ?? data.records.length).toLocaleString("vi-VN"),
      ],
      [
        "Bản ghi/trường có yếu tố suy diễn/kịch bản",
        (intelligence?.provenance.inferredRecords ?? 0).toLocaleString("vi-VN"),
      ],
      ["Quan sát chuỗi kỳ", (intelligence?.provenance.observations ?? 0).toLocaleString("vi-VN")],
      [
        "Bản ghi trong phụ lục",
        `${Math.min(data.records.length, 50).toLocaleString("vi-VN")} bản ghi (trích tối đa 50)`,
      ],
    ]),
    {
      text: "Lưu ý: Hai nhóm chất lượng trên có thể giao nhau; không cộng hai chỉ tiêu để tính tổng dữ liệu.",
      italics: true,
      color: "#7c2d12",
      margin: [0, 2, 0, 4],
    },
    bulletList(
      intelligence?.provenance.notes ?? ["Chưa có ghi chú provenance cho nhiệm vụ này."],
      "#7c2d12",
    ),
    {
      text: "Kết luận: Nền tảng đã thể hiện khả năng hợp nhất dữ liệu, trực quan hóa, cảnh báo, lập kịch bản khi đủ điều kiện và xuất báo cáo có truy vết. Trước khi sử dụng làm văn bản chính thức, đơn vị chuyên môn cần xác nhận nguồn, kỳ số liệu, căn cứ nhiệm vụ và thực hiện quy trình trình ký theo quy định.",
      alignment: "justify",
      leadingIndent: 28,
      bold: true,
      margin: [0, 8, 0, 14],
    },
    {
      table: {
        widths: ["52%", "48%"],
        body: [
          [
            {
              stack: [
                { text: "Nơi nhận:", bold: true },
                { text: "- Như trên;" },
                { text: "- Các phòng, đơn vị liên quan (phối hợp);" },
                { text: "- Lưu: VT, đơn vị lập báo cáo." },
              ],
              fontSize: 9.5,
            },
            {
              stack: [
                { text: "GIÁM ĐỐC", alignment: "center", bold: true },
                {
                  text: "(Ký, ghi rõ họ tên, đóng dấu)",
                  alignment: "center",
                  italics: true,
                  fontSize: 9,
                  margin: [0, 4, 0, 42],
                },
                { text: "................................", alignment: "center", color: "#64748b" },
              ],
            },
          ],
        ],
      },
      layout: "noBorders",
    },
    {
      text: "PHỤ LỤC",
      pageBreak: "before",
      pageOrientation: "landscape",
      alignment: "center",
      bold: true,
      fontSize: 15,
      margin: [0, 0, 0, 3],
    },
    {
      text: text(
        `Trích danh sách đối tượng thuộc Nhiệm vụ ${data.taskId} - ${config.missionTitle} (tối đa 50 bản ghi gần nhất)`,
      ),
      alignment: "center",
      bold: true,
      margin: [0, 0, 0, 8],
    },
    recordsTable(data),
    {
      text: text(
        `Nguồn: Hệ thống thông tin ngành Công Thương; thời điểm hệ thống tổng hợp ${dateTime(data.updatedAt)}.`,
      ),
      fontSize: 8.5,
      italics: true,
      color: "#475569",
      margin: [0, 3, 0, 0],
    },
  ];

  return {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [86, 70, 51, 62],
    watermark: {
      text: "BẢN MINH HỌA",
      color: "#64748b",
      opacity: 0.07,
      bold: true,
      fontSize: 52,
      angle: -35,
    },
    header: (currentPage) =>
      currentPage === 1
        ? { text: "" }
        : {
            text: String(currentPage),
            alignment: "center",
            margin: [0, 20, 0, 0],
            fontSize: 9,
            color: "#475569",
          },
    content,
    defaultStyle: {
      font,
      fontSize: 13,
      lineHeight: 1.22,
      color: "#111827",
    },
    styles: {
      sectionTitle: {
        fontSize: 13,
        bold: true,
        color: "#0f2a4a",
      },
      subTitle: {
        fontSize: 12.5,
        bold: true,
        color: "#0b4f78",
      },
      tableHeader: {
        bold: true,
        color: "#ffffff",
        fillColor: "#0b4f78",
        fontSize: 9,
        alignment: "center",
      },
    },
    info: {
      title: text(`Báo cáo Nhiệm vụ ${data.taskId} - ${config.missionTitle}`),
      author: "Sở Công Thương tỉnh Tây Ninh",
      subject: text(config.reportSubject),
      keywords: `Tây Ninh, Sở Công Thương, năng lượng, nhiệm vụ ${data.taskId}, báo cáo minh họa`,
      creator: "Hệ thống thông tin ngành Công Thương tỉnh Tây Ninh",
      producer: "pdfmake",
      creationDate: generatedAt,
    },
  };
}

async function loadPdfRuntime() {
  const [pdfMakeModule, defaultFontsModule] = await Promise.all([
    import("pdfmake/build/pdfmake.js"),
    import("pdfmake/build/vfs_fonts.js"),
  ]);
  const pdfMake = pdfMakeModule.default as unknown as typeof pdfMakeModule.default & {
    addVirtualFileSystem: (vfs: Record<string, string>) => void;
    addFonts: (fonts: TFontDictionary) => void;
  };
  const defaultFonts = defaultFontsModule.default as Record<string, string>;
  const fontFiles: Array<[string, string]> = [
    ["NotoSerif-Regular.ttf", "400-normal"],
    ["NotoSerif-Bold.ttf", "700-normal"],
    ["NotoSerif-Italic.ttf", "400-italic"],
    ["NotoSerif-BoldItalic.ttf", "700-italic"],
  ];
  const vfs = { ...defaultFonts };
  for (const [targetName, style] of fontFiles) {
    vfs[targetName] = buildNotoSerifTtf(style).toString("base64");
  }
  pdfMake.addVirtualFileSystem(vfs);
  pdfMake.addFonts({
    NotoSerif: {
      normal: "NotoSerif-Regular.ttf",
      bold: "NotoSerif-Bold.ttf",
      italics: "NotoSerif-Italic.ttf",
      bolditalics: "NotoSerif-BoldItalic.ttf",
    },
  });
  return pdfMake;
}

export async function renderMissionReportPdf(
  data: MissionSummary,
  config: MissionReportConfig,
  generatedAt = new Date(),
) {
  const pdfMake = await loadPdfRuntime();
  const definition = buildMissionReportDocument(data, config, generatedAt);
  return new Promise<Buffer>((resolve) => {
    pdfMake.createPdf(definition).getBuffer((buffer) => resolve(Buffer.from(buffer)));
  });
}
