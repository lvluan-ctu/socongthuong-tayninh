// ============================================================
// SERVICE LAYER — BÁO CÁO & BI.
// Pipeline: FILE (Word/Excel/PDF) → TRÍCH XUẤT → CHUẨN HÓA BẢNG
// → KIỂM TRA/PHÊ DUYỆT → CSDL NGÀNH (JSON/localStorage)
// → THỐNG KÊ/BIỂU ĐỒ/DASHBOARD/XUẤT BÁO CÁO.
// Demo: CSV đọc thật; XLSX/DOCX/PDF mô phỏng trích xuất (giống OCR demo).
// ============================================================
import { REPORT_COLUMNS, SAMPLE_XNK_ROWS } from "@/data/report-mock";
import type { DataStatus, ReportAnswer, ReportColumn, ReportDataset, ReportRow } from "@/lib/types";

export const REPORT_STORAGE_KEY = "sct.report.datasets";

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const round2 = (n: number) => Math.round(n * 100) / 100;

export function formatDateTime(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatNumber(n: number, digits = 2): string {
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

export function formatPercent(n: number, digits = 1): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${formatNumber(n, digits)}%`;
}

// ---------------------------------------------------------------------------
// LƯU TRỮ (JSON/localStorage)
// ---------------------------------------------------------------------------
export function readReportDatasets(): ReportDataset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REPORT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ReportDataset[]) : [];
  } catch {
    return [];
  }
}

export function writeReportDatasets(list: ReportDataset[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable — ignore */
  }
}

// ---------------------------------------------------------------------------
// CSV (đọc thật)
// ---------------------------------------------------------------------------
export function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  const normalized = text.replace(/^\uFEFF/, "").trim();
  if (!normalized) return { headers: [], rows: [] };
  const delimiter = normalized.includes(";") ? ";" : ",";
  const lines = normalized.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else inQ = false;
        } else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === delimiter) {
        out.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };

  const parsed = lines.map(parseLine);
  const headers = parsed[0]!;
  return { headers, rows: parsed.slice(1) };
}

function toNumber(value: string): number {
  const s = String(value ?? "")
    .trim()
    .replace(/[%\s]/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

function detectColumns(headers: string[], rows: string[][]): ReportColumn[] {
  return headers.map((h, i) => {
    const headerLower = h.toLowerCase();
    const values = rows.map((r) => r[i]).filter((v) => v !== undefined && v !== "");
    const isPercentHeader =
      headerLower.includes("%") ||
      headerLower.includes("tăng") ||
      headerLower.includes("giảm") ||
      headerLower.includes("tỷ lệ") ||
      headerLower.includes("biến động");
    const numeric =
      values.length > 0 && values.every((v) => /^[-+]?[\d.,\s]+%?$/.test(String(v).trim()));
    if (isPercentHeader) return { key: `col${i}`, header: h, type: "percent" as const };
    if (numeric) return { key: `col${i}`, header: h, type: "number" as const };
    return { key: `col${i}`, header: h, type: "text" as const };
  });
}

function buildReportTable(
  headers: string[],
  rawRows: string[][],
): {
  columns: ReportColumn[];
  rows: ReportRow[];
} {
  const columns = detectColumns(headers, rawRows);
  const rows = rawRows.map((r, i) => {
    const cells: Record<string, string | number> = {};
    columns.forEach((c, ci) => {
      const raw = r[ci] ?? "";
      if (c.type === "text") cells[c.key] = raw.trim();
      else {
        const n = toNumber(raw);
        cells[c.key] = Number.isFinite(n) ? round2(n) : raw.trim();
      }
    });
    return { id: `R-${String(i + 1).padStart(2, "0")}`, cells };
  });
  return { columns, rows };
}

// ---------------------------------------------------------------------------
// TRÍCH XUẤT FILE
// ---------------------------------------------------------------------------
export interface ExtractStep {
  step: string;
  pct: number;
}

const baseName = (name: string) =>
  name
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();

export async function extractFromFile(
  file: File,
  onProgress?: (step: ExtractStep) => void,
): Promise<{ columns: ReportColumn[]; rows: ReportRow[]; name: string; fileType: string }> {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const isCsv = ext === "csv" || ext === "txt";

  if (isCsv) {
    onProgress?.({ step: "Đọc file", pct: 25 });
    await delay(350);
    const text = await file.text();
    const { headers, rows } = parseCsvText(text);
    if (!headers.length || !rows.length) {
      throw new Error("Không tìm thấy bảng dữ liệu trong file CSV. Vui lòng kiểm tra lại file.");
    }
    onProgress?.({ step: "Trích xuất bảng dữ liệu", pct: 65 });
    await delay(250);
    const table = buildReportTable(headers, rows);
    onProgress?.({ step: "Chuẩn hóa dữ liệu", pct: 100 });
    return { ...table, name: baseName(file.name), fileType: "CSV" };
  }

  // XLSX / DOCX / PDF — mô phỏng trích xuất (demo, giống OCR). Trả bảng mẫu XNK.
  onProgress?.({ step: "Đọc file", pct: 20 });
  await delay(600);
  onProgress?.({ step: "Trích xuất bảng dữ liệu", pct: 60 });
  await delay(700);
  onProgress?.({ step: "Chuẩn hóa dữ liệu", pct: 100 });
  const fileType = ext === "pdf" ? "PDF" : ext === "docx" || ext === "doc" ? "DOCX" : "XLSX";
  return {
    columns: REPORT_COLUMNS,
    rows: SAMPLE_XNK_ROWS.map((r) => ({ ...r, cells: { ...r.cells } })),
    name: baseName(file.name),
    fileType,
  };
}

// Tạo bản nháp (draft) từ kết quả trích xuất.
export function createDraftDataset(input: {
  name: string;
  fileName: string;
  fileType: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  period: string;
  year: number;
  quarter?: string;
  source: string;
  via: "upload" | "chatbot" | "sample";
  status?: DataStatus;
}): ReportDataset {
  const now = formatDateTime();
  return {
    id: `BC-${Date.now()}`,
    name: input.name,
    fileName: input.fileName,
    fileType: input.fileType as ReportDataset["fileType"],
    period: input.period,
    year: input.year,
    source: input.source,
    columns: input.columns,
    rows: input.rows,
    status: input.status ?? "draft",
    extractedAt: now,
    savedAt: now,
    via: input.via,
    ...(input.quarter ? { quarter: input.quarter } : {}),
  };
}

// ---------------------------------------------------------------------------
// PHÂN TÍCH: cấu trúc cột + KPI + biểu đồ
// ---------------------------------------------------------------------------
export interface ReportChartData {
  bar: { name: string; value: number }[];
  compare: { name: string; a: number; b: number }[];
  ranking: { name: string; growth: number }[];
  pie: { name: string; value: number }[];
}

export interface ReportKpis {
  count: number;
  totalCurrent: number;
  totalPrev: number;
  growth: number;
  rising: number;
  leader: { name: string; value: number } | null;
  topUp: { name: string; growth: number } | null;
  topDown: { name: string; growth: number } | null;
}

function columnKeys(dataset: ReportDataset): {
  dim: string;
  prev?: string;
  current: string;
  pct?: string;
} {
  const textCols = dataset.columns.filter((c) => c.type === "text");
  const numCols = dataset.columns.filter((c) => c.type === "number");
  const pctCol = dataset.columns.find((c) => c.type === "percent");
  const dim = textCols[0]?.key ?? dataset.columns[0]!.key;
  const current = numCols[numCols.length - 1]?.key ?? dim;
  return {
    dim,
    current,
    ...(numCols.length >= 2 ? { prev: numCols[0]!.key } : {}),
    ...(pctCol ? { pct: pctCol.key } : {}),
  };
}

function rowValue(row: ReportRow, key?: string): number | undefined {
  if (!key) return undefined;
  const v = row.cells[key];
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = toNumber(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function buildRanking(dataset: ReportDataset): { name: string; growth: number }[] {
  const k = columnKeys(dataset);
  return dataset.rows
    .map((r) => {
      const name = String(r.cells[k.dim] ?? "");
      const current = rowValue(r, k.current) ?? 0;
      let growth: number;
      if (k.pct && rowValue(r, k.pct) !== undefined) growth = rowValue(r, k.pct)!;
      else {
        const prev = k.prev ? (rowValue(r, k.prev) ?? 0) : 0;
        growth = prev ? ((current - prev) / prev) * 100 : 0;
      }
      return { name, growth: round2(growth) };
    })
    .filter((r) => r.name)
    .sort((a, b) => b.growth - a.growth);
}

export function computeKpis(dataset: ReportDataset): ReportKpis {
  const k = columnKeys(dataset);
  let totalCurrent = 0;
  let totalPrev = 0;
  let leader: { name: string; value: number } | null = null;
  for (const r of dataset.rows) {
    const cur = rowValue(r, k.current) ?? 0;
    totalCurrent += cur;
    if (k.prev) totalPrev += rowValue(r, k.prev) ?? 0;
    const name = String(r.cells[k.dim] ?? "");
    if (name && (!leader || cur > leader.value)) leader = { name, value: cur };
  }
  const ranking = buildRanking(dataset);
  const growth = k.prev
    ? totalPrev
      ? round2(((totalCurrent - totalPrev) / totalPrev) * 100)
      : 0
    : 0;
  return {
    count: dataset.rows.length,
    totalCurrent: round2(totalCurrent),
    totalPrev: round2(totalPrev),
    growth: round2(growth),
    rising: ranking.filter((r) => r.growth > 0).length,
    leader,
    topUp: ranking[0] ?? null,
    topDown: ranking[ranking.length - 1] ?? null,
  };
}

export function buildChartData(dataset: ReportDataset): ReportChartData {
  const k = columnKeys(dataset);
  const bar = dataset.rows
    .map((r) => ({ name: String(r.cells[k.dim] ?? ""), value: rowValue(r, k.current) ?? 0 }))
    .filter((r) => r.name)
    .sort((a, b) => b.value - a.value);
  const compare = dataset.rows
    .map((r) => ({
      name: String(r.cells[k.dim] ?? ""),
      a: k.prev ? (rowValue(r, k.prev) ?? 0) : 0,
      b: rowValue(r, k.current) ?? 0,
    }))
    .filter((r) => r.name)
    .sort((a, b) => b.b - a.b);
  const ranking = buildRanking(dataset);
  const top = bar.slice(0, 8);
  const rest = bar.slice(8);
  const pie =
    rest.length > 0
      ? [
          ...top.map((r) => ({ name: r.name, value: r.value })),
          { name: "Khác", value: rest.reduce((s, r) => s + r.value, 0) },
        ]
      : top.map((r) => ({ name: r.name, value: r.value }));
  return { bar, compare, ranking, pie };
}

// ---------------------------------------------------------------------------
// AI: TỰ TỔNG HỢP BÁO CÁO & TRẢ LỜI CÂU HỎI (tính toán từ dữ liệu)
// ---------------------------------------------------------------------------
export function summarizeDataset(dataset: ReportDataset): string {
  const k = computeKpis(dataset);
  const fmt = (n: number) => formatNumber(n);
  const lines: string[] = [];
  lines.push(`Báo cáo "${dataset.name}" — kỳ ${dataset.period}, đơn vị ${dataset.source}.`);
  lines.push(
    `Bảng dữ liệu gồm ${k.count} đối tượng. Tổng trị giá kỳ hiện tại đạt ${fmt(k.totalCurrent)} triệu USD` +
      (k.totalPrev
        ? ` (kỳ trước ${fmt(k.totalPrev)} triệu USD, biến động ${formatPercent(k.growth)})`
        : "") +
      ".",
  );
  lines.push(
    `Quốc gia có mức tăng mạnh nhất là ${k.topUp?.name ?? "—"} (+${formatNumber(k.topUp?.growth ?? 0, 1)}%), ` +
      `giảm nhiều nhất là ${k.topDown?.name ?? "—"} (${formatNumber(k.topDown?.growth ?? 0, 1)}%).`,
  );
  const strong = buildRanking(dataset).filter((r) => r.growth >= 10);
  if (strong.length) {
    lines.push(
      `Có ${strong.length} quốc gia tăng trên 10%: ${strong.map((s) => s.name).join(", ")}.`,
    );
  }
  lines.push("Dữ liệu đã được chuẩn hóa, sẵn sàng cho biểu đồ, Dashboard và xuất báo cáo.");
  return lines.join("\n");
}

function findCountry(dataset: ReportDataset, query: string): ReportRow | undefined {
  const k = columnKeys(dataset);
  const q = query.toLowerCase();
  return dataset.rows.find((r) => {
    const name = String(r.cells[k.dim] ?? "").toLowerCase();
    return name.includes(q) || q.includes(name);
  });
}

export function answerQuestion(dataset: ReportDataset, question: string): ReportAnswer {
  const q = question.toLowerCase();
  const k = computeKpis(dataset);
  const ranking = buildRanking(dataset);
  const fmt = (n: number) => formatNumber(n);

  const country = findCountry(dataset, q);
  if (country) {
    const key = columnKeys(dataset);
    const name = String(country.cells[key.dim]);
    const current = rowValue(country, key.current) ?? 0;
    const prev = key.prev ? (rowValue(country, key.prev) ?? 0) : 0;
    const growth =
      key.pct && rowValue(country, key.pct) !== undefined
        ? rowValue(country, key.pct)!
        : prev
          ? ((current - prev) / prev) * 100
          : 0;
    return {
      text:
        `Quốc gia ${name}: trị giá kỳ hiện tại ${fmt(current)} triệu USD` +
        (key.prev
          ? `, kỳ trước ${fmt(prev)} triệu USD, biến động ${formatPercent(growth)}.`
          : ".") +
        (growth > 0 ? " Đang tăng so với kỳ trước." : " Đang giảm so với kỳ trước."),
      rows: [
        { label: "Trị giá kỳ hiện tại", value: `${fmt(current)} tr USD` },
        ...(key.prev ? [{ label: "Trị giá kỳ trước", value: `${fmt(prev)} tr USD` }] : []),
        { label: "Tăng/giảm", value: formatPercent(growth), tone: growth >= 0 ? "up" : "down" },
      ],
    };
  }

  if (
    q.includes("xếp hạng") ||
    q.includes("top") ||
    q.includes("tăng mạnh") ||
    q.includes("giảm")
  ) {
    const up = ranking.slice(0, 5);
    const down = ranking.slice(-5).reverse();
    return {
      text: `Xếp hạng theo biến động %: ${up.length} quốc gia tăng nhiều nhất và ${down.length} quốc gia giảm nhiều nhất.`,
      rows: [
        ...up.map((r) => ({
          label: `▲ ${r.name}`,
          value: formatPercent(r.growth),
          tone: "up" as const,
        })),
        ...down.map((r) => ({
          label: `▼ ${r.name}`,
          value: formatPercent(r.growth),
          tone: "down" as const,
        })),
      ],
    };
  }

  if (q.includes("tổng") || q.includes("toàn bộ") || q.includes("cả kỳ")) {
    return {
      text:
        `Tổng trị giá kỳ hiện tại là ${fmt(k.totalCurrent)} triệu USD` +
        (k.totalPrev
          ? `, so với kỳ trước ${fmt(k.totalPrev)} triệu USD (${formatPercent(k.growth)}).`
          : ".") +
        ` Có ${k.rising}/${k.count} đối tượng tăng trưởng dương.`,
      rows: [
        { label: "Tổng kỳ hiện tại", value: `${fmt(k.totalCurrent)} tr USD` },
        ...(k.totalPrev ? [{ label: "Tổng kỳ trước", value: `${fmt(k.totalPrev)} tr USD` }] : []),
        { label: "Biến động", value: formatPercent(k.growth), tone: k.growth >= 0 ? "up" : "down" },
      ],
    };
  }

  if (q.includes("so sánh") || q.includes("kỳ") || q.includes("2025") || q.includes("2026")) {
    const rows: ReportAnswer["rows"] = buildChartData(dataset)
      .compare.slice(0, 8)
      .map((r) => ({
        label: r.name,
        value: `${fmt(r.a)} → ${fmt(r.b)}`,
        tone: r.b >= r.a ? "up" : "down",
      }));
    return {
      text: `So sánh giữa kỳ trước và kỳ hiện tại (${rows.length} đối tượng lớn nhất).`,
      rows,
    };
  }

  return {
    text: summarizeDataset(dataset),
    rows: ranking.slice(0, 8).map((r) => ({ label: r.name, value: formatPercent(r.growth) })),
  };
}

// ---------------------------------------------------------------------------
// XUẤT BÁO CÁO: CSV (thật) / XLS (HTML) / DOC (HTML) / PDF (in)
// ---------------------------------------------------------------------------
export function datasetToCsv(dataset: ReportDataset): string {
  const header = dataset.columns.map((c) => c.header).join(",");
  const lines = dataset.rows.map((r) =>
    dataset.columns
      .map((c) => {
        const s = String(r.cells[c.key] ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      })
      .join(","),
  );
  return "\uFEFF" + [header, ...lines].join("\n");
}

export function datasetToHtml(dataset: ReportDataset): string {
  const rows = dataset.rows
    .map(
      (r) =>
        `<tr>${dataset.columns.map((c) => `<td>${escapeHtml(String(r.cells[c.key] ?? ""))}</td>`).join("")}</tr>`,
    )
    .join("\n");
  const header = dataset.columns.map((c) => `<th>${escapeHtml(c.header)}</th>`).join("");
  return `<table border="1" cellspacing="0" cellpadding="4">${rows ? `<tr>${header}</tr>` : ""}${rows}</table>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugify(name: string): string {
  const map: Record<string, string> = {
    à: "a",
    á: "a",
    ả: "a",
    ã: "a",
    ạ: "a",
    â: "a",
    ầ: "a",
    ấ: "a",
    ẩ: "a",
    ẫ: "a",
    ậ: "a",
    ă: "a",
    ằ: "a",
    ắ: "a",
    ẳ: "a",
    ẵ: "a",
    ặ: "a",
    è: "e",
    é: "e",
    ẻ: "e",
    ẽ: "e",
    ẹ: "e",
    ê: "e",
    ề: "e",
    ế: "e",
    ể: "e",
    ễ: "e",
    ệ: "e",
    ì: "i",
    í: "i",
    ỉ: "i",
    ĩ: "i",
    ị: "i",
    ò: "o",
    ó: "o",
    ỏ: "o",
    õ: "o",
    ọ: "o",
    ô: "o",
    ồ: "o",
    ố: "o",
    ổ: "o",
    ỗ: "o",
    ộ: "o",
    ơ: "o",
    ờ: "o",
    ớ: "o",
    ở: "o",
    ỡ: "o",
    ợ: "o",
    ù: "u",
    ú: "u",
    ủ: "u",
    ũ: "u",
    ụ: "u",
    ư: "u",
    ừ: "u",
    ứ: "u",
    ử: "u",
    ữ: "u",
    ự: "u",
    ý: "y",
    ỳ: "y",
    ỷ: "y",
    ỹ: "y",
    ỵ: "y",
    đ: "d",
  };
  const lower = name.toLowerCase();
  const ascii = lower.replace(/[^\u0020-\u007E]/g, (ch) => map[ch] ?? ch);
  return ascii
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportReport(dataset: ReportDataset, format: "csv" | "xls" | "doc" | "pdf"): void {
  const base = `bao-cao-${slugify(dataset.name)}-${dataset.year}`;
  if (format === "csv") {
    downloadBlob(
      `${base}.csv`,
      new Blob([datasetToCsv(dataset)], { type: "text/csv;charset=utf-8" }),
    );
  } else if (format === "xls") {
    const html = xlsHtml(dataset);
    downloadBlob(`${base}.xls`, new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel" }));
  } else if (format === "doc") {
    downloadBlob(
      `${base}.doc`,
      new Blob(["\uFEFF" + docHtml(dataset)], { type: "application/msword" }),
    );
  } else {
    printReport(dataset);
  }
}

function reportShell(dataset: ReportDataset, body: string): string {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(dataset.name)}</title>
<style>
  body { font-family: "Times New Roman", Arial, sans-serif; margin: 32px; color: #111; font-size: 13px; }
  h1 { font-size: 20px; text-align: center; margin-bottom: 4px; }
  h2 { font-size: 15px; text-align: center; font-weight: 600; margin-bottom: 14px; }
  .meta { text-align: center; font-size: 11px; color: #444; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { border: 1px solid #333; padding: 5px 8px; text-align: left; }
  th { background: #eef2f7; }
  td.num, th.num { text-align: right; }
  .sign { text-align: right; margin-top: 34px; font-size: 12px; }
  @media print { body { margin: 12mm; } }
</style></head><body>${body}</body></html>`;
}

function reportBody(dataset: ReportDataset, extra?: string): string {
  const k = computeKpis(dataset);
  const summary = dataset.summary || summarizeDataset(dataset);
  const meta = `Kỳ báo cáo: ${dataset.period} · Đơn vị: ${dataset.source} · Ngày tạo: ${dataset.savedAt}`;
  return `<h1>SỞ CÔNG THƯƠNG TỈNH TÂY NINH</h1>
<h2>${escapeHtml(dataset.name)}</h2>
<p class="meta">${escapeHtml(meta)}</p>
<p style="white-space:pre-line">${escapeHtml(summary)}</p>
${datasetToHtml(dataset)}
${extra ? `<p>${extra}</p>` : ""}
<div class="sign"><p><strong>THỦ TRƯỞNG ĐƠN VỊ</strong></p><p>(Ký, ghi rõ họ tên)</p></div>`;
}

function xlsHtml(dataset: ReportDataset): string {
  return `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><title>${escapeHtml(dataset.name)}</title>
<style>table { border-collapse: collapse; } td, th { border: 0.5pt solid #666; padding: 4px; } th { font-weight: bold; }</style></head>
<body><h3>${escapeHtml(dataset.name)}</h3><p>Kỳ: ${escapeHtml(dataset.period)} · ${escapeHtml(dataset.source)}</p>${datasetToHtml(dataset)}</body></html>`;
}

function docHtml(dataset: ReportDataset): string {
  return reportShell(dataset, reportBody(dataset));
}

export function printReport(dataset: ReportDataset): void {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(reportShell(dataset, reportBody(dataset)));
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}
