import { parseCsvText } from "@/lib/report-service";
import {
  CO_HS_CODES_MAP,
  CO_FORMS_MAP,
  CO_FTA_MAP,
  CO_COUNTRIES_MAP,
} from "./co-constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CoParsedRow {
  applicationNo: string;
  formCode: string;
  ftaCode: string;
  exporterName: string;
  exporterTaxCode: string;
  consigneeName: string;
  consigneeCountry: string;
  hsCode: string;
  description: string;
  quantity: number;
  unit: string;
  fobValue: number;
  originCriterion: string;
  countryOfOrigin: string;
  departureDate: string;
  vessel: string;
  portLoading: string;
  portDischarge: string;
  raw: Record<string, string>;
}

export interface CoParseError {
  row: number;
  column: string;
  message: string;
}

export interface CoParseResult {
  fileName: string;
  totalRows: number;
  accepted: CoParsedRow[];
  rejected: CoParseError[];
  headers: string[];
}

// ---------------------------------------------------------------------------
// Column mapping — auto-detect từ header row
// ---------------------------------------------------------------------------

const COLUMN_ALIASES: Record<keyof Omit<CoParsedRow, "raw">, string[]> = {
  applicationNo: ["so_hs", "so_ho_so", "số hồ_số", "application_no", "app_no", "mã_hồ_số", "ma_hs", "số_đăng_ký"],
  formCode: ["ma_mẫu", "ma_mau", "mẫu_c/o", "mau_co", "form", "form_code", "loai_co", "loại_co"],
  ftaCode: ["fta", "hiep_dinh", "hiệp_định", "fta_code", "ma_fta"],
  exporterName: ["ten_xuat_khau", "tên_xuất_khẩu", "exporter", "doanh_nghiep", "doanh_nghiệp"],
  exporterTaxCode: ["ma_so_thue", "mã_số_thuế", "tax_code", "mst"],
  consigneeName: ["ten_nhap_khau", "tên_nhập_khẩu", "consignee", "nguoi_mua"],
  consigneeCountry: ["quoc_gia_nhap", "quốc_gia_nhập", "country_import", "nuoc_nhap"],
  hsCode: ["ma_hs", "mã_hs", "hs_code", "hs", "ma_hang", "mã_hàng"],
  description: ["mo_ta", "mô_tả", "description", "ten_hang", "tên_hàng"],
  quantity: ["so_lượng", "số_lượng", "quantity", "sl"],
  unit: ["dvt", "đơn_vị_tính", "unit"],
  fobValue: ["gia_tri_fob", "giá_trị_fob", "fob", "fob_value", "tri_gia"],
  originCriterion: ["tieu_chi_xx", "tiêu_chí_xx", "origin_criterion", "tieu_chi"],
  countryOfOrigin: ["quoc_gia_xx", "quốc_gia_xx", "origin_country", "nuoc_san_xuat"],
  departureDate: ["ngay_xuat_ben", "ngày_xuất_bến", "departure_date", "ngay_van_chuyen"],
  vessel: ["ten_tau", "tên_tàu", "vessel", "phuong_tien"],
  portLoading: ["cang_tai", "cảng_tải", "port_loading", "cang_xuat"],
  portDischarge: ["cang_ra", "cảng_ra", "port_discharge", "cang_nhap"],
};

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function mapColumns(headers: string[]): Map<keyof Omit<CoParsedRow, "raw">, number> {
  const mapping = new Map<keyof Omit<CoParsedRow, "raw">, number>();
  const normalized = headers.map(normalizeHeader);

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as [keyof Omit<CoParsedRow, "raw">, string[]][]) {
    for (const alias of aliases) {
      const idx = normalized.indexOf(alias);
      if (idx !== -1) {
        mapping.set(field, idx);
        break;
      }
    }
  }

  return mapping;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateRow(row: CoParsedRow, rowNum: number): CoParseError[] {
  const errors: CoParseError[] = [];

  if (!row.formCode || !CO_FORMS_MAP.has(row.formCode)) {
    errors.push({ row: rowNum, column: "formCode", message: `Mã mẫu "${row.formCode}" không hợp lệ` });
  }
  if (row.ftaCode && !CO_FTA_MAP.has(row.ftaCode)) {
    errors.push({ row: rowNum, column: "ftaCode", message: `FTA "${row.ftaCode}" không tồn tại` });
  }
  if (!row.hsCode || !CO_HS_CODES_MAP.has(row.hsCode)) {
    errors.push({ row: rowNum, column: "hsCode", message: `Mã HS "${row.hsCode}" không trong danh mục` });
  }
  if (row.countryOfOrigin && !CO_COUNTRIES_MAP.has(row.countryOfOrigin)) {
    errors.push({ row: rowNum, column: "countryOfOrigin", message: `Quốc gia "${row.countryOfOrigin}" không hợp lệ` });
  }
  if (!row.exporterName?.trim()) {
    errors.push({ row: rowNum, column: "exporterName", message: "Thiếu tên đơn vị xuất khẩu" });
  }
  if (!row.fobValue || row.fobValue <= 0) {
    errors.push({ row: rowNum, column: "fobValue", message: "Giá trị FOB phải > 0" });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Parse CSV
// ---------------------------------------------------------------------------

function parseCsvFile(file: File): Promise<CoParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const { headers, rows } = parseCsvText(text);
      const mapping = mapColumns(headers);
      const accepted: CoParsedRow[] = [];
      const rejected: CoParseError[] = [];

      rows.forEach((cells, i) => {
        const rowNum = i + 2;
        const raw: Record<string, string> = {};
        headers.forEach((h, hi) => { raw[h] = cells[hi] ?? ""; });

        const parsed: CoParsedRow = {
          applicationNo: getCell(mapping, cells, "applicationNo", `IMP-${String(rowNum).padStart(4, "0")}`),
          formCode: getCell(mapping, cells, "formCode", ""),
          ftaCode: getCell(mapping, cells, "ftaCode", ""),
          exporterName: getCell(mapping, cells, "exporterName", ""),
          exporterTaxCode: getCell(mapping, cells, "exporterTaxCode", ""),
          consigneeName: getCell(mapping, cells, "consigneeName", ""),
          consigneeCountry: getCell(mapping, cells, "consigneeCountry", ""),
          hsCode: getCell(mapping, cells, "hsCode", ""),
          description: getCell(mapping, cells, "description", ""),
          quantity: parseNum(getCell(mapping, cells, "quantity", "0")),
          unit: getCell(mapping, cells, "unit", ""),
          fobValue: parseNum(getCell(mapping, cells, "fobValue", "0")),
          originCriterion: getCell(mapping, cells, "originCriterion", ""),
          countryOfOrigin: getCell(mapping, cells, "countryOfOrigin", ""),
          departureDate: getCell(mapping, cells, "departureDate", ""),
          vessel: getCell(mapping, cells, "vessel", ""),
          portLoading: getCell(mapping, cells, "portLoading", ""),
          portDischarge: getCell(mapping, cells, "portDischarge", ""),
          raw,
        };

        const errors = validateRow(parsed, rowNum);
        if (errors.length) {
          rejected.push(...errors);
        } else {
          accepted.push(parsed);
        }
      });

      resolve({ fileName: file.name, totalRows: rows.length, accepted, rejected, headers });
    };
    reader.onerror = () => reject(new Error("Không thể đọc file CSV"));
    reader.readAsText(file, "utf-8");
  });
}

// ---------------------------------------------------------------------------
// Parse Excel
// ---------------------------------------------------------------------------

async function parseExcelFile(file: File): Promise<CoParseResult> {
  // Dynamic import để tránh phình bundle client (~1MB exceljs chỉ load khi cần)
  const { default: ExcelJS } = await import("exceljs");
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return { fileName: file.name, totalRows: 0, accepted: [], rejected: [], headers: [] };
  }

  const allRows: CoParsedRow[] = [];
  const allErrors: CoParseError[] = [];
  let headers: string[] = [];

  worksheet.eachRow((row, rowNumber) => {
    const rawValues = Array.isArray(row.values) ? row.values : [];
    const cells = rawValues.map((v) => {
      if (v == null) return "";
      if (typeof v === "object" && "result" in v) return String((v as { result: unknown }).result ?? "");
      return String(v);
    });
    cells.shift(); // ExcelJS row.values is 1-indexed with first element empty

    if (rowNumber === 1) {
      headers = cells;
      return;
    }

    const mapping = mapColumns(headers);
    const raw: Record<string, string> = {};
    headers.forEach((h, hi) => { raw[h] = cells[hi] ?? ""; });

    const parsed: CoParsedRow = {
      applicationNo: getCell(mapping, cells, "applicationNo", `IMP-${String(rowNumber).padStart(4, "0")}`),
      formCode: getCell(mapping, cells, "formCode", ""),
      ftaCode: getCell(mapping, cells, "ftaCode", ""),
      exporterName: getCell(mapping, cells, "exporterName", ""),
      exporterTaxCode: getCell(mapping, cells, "exporterTaxCode", ""),
      consigneeName: getCell(mapping, cells, "consigneeName", ""),
      consigneeCountry: getCell(mapping, cells, "consigneeCountry", ""),
      hsCode: getCell(mapping, cells, "hsCode", ""),
      description: getCell(mapping, cells, "description", ""),
      quantity: parseNum(getCell(mapping, cells, "quantity", "0")),
      unit: getCell(mapping, cells, "unit", ""),
      fobValue: parseNum(getCell(mapping, cells, "fobValue", "0")),
      originCriterion: getCell(mapping, cells, "originCriterion", ""),
      countryOfOrigin: getCell(mapping, cells, "countryOfOrigin", ""),
      departureDate: getCell(mapping, cells, "departureDate", ""),
      vessel: getCell(mapping, cells, "vessel", ""),
      portLoading: getCell(mapping, cells, "portLoading", ""),
      portDischarge: getCell(mapping, cells, "portDischarge", ""),
      raw,
    };

    const errors = validateRow(parsed, rowNumber);
    if (errors.length) {
      allErrors.push(...errors);
    } else {
      allRows.push(parsed);
    }
  });

  return {
    fileName: file.name,
    totalRows: worksheet.rowCount - 1,
    accepted: allRows,
    rejected: allErrors,
    headers,
  };
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function parseCoFile(file: File): Promise<CoParseResult> {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (ext === "csv" || ext === "txt") return parseCsvFile(file);
  if (ext === "xlsx" || ext === "xls") return parseExcelFile(file);
  throw new Error(`Định dạng file không hỗ trợ: .${ext}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCell(
  mapping: Map<keyof Omit<CoParsedRow, "raw">, number>,
  cells: string[],
  field: keyof Omit<CoParsedRow, "raw">,
  fallback: string,
): string {
  const idx = mapping.get(field);
  if (idx === undefined || idx >= cells.length) return fallback;
  return (cells[idx] ?? "").trim() || fallback;
}

function parseNum(v: string): number {
  const n = parseFloat(v.replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
