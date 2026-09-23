import ExcelJS from 'exceljs';
import type {
  EvnCellValue,
  EvnEntityType,
  EvnParsedRecord,
  EvnReportContext,
  EvnSheetPreview,
  ParsedEvnWorkbook,
} from './evn-import.types';

const HEADER_HINTS = [
  'ma thiet bi',
  'ma thiet bi cha',
  'ten',
  'ten thiet bi',
  'thiet bi cha',
  'stt',
  'x',
  'y',
  'thoi gian',
  'ia',
  'ib',
  'ic',
  'p',
  'q',
  'cos',
];

const EXTERNAL_KEY_ALIASES = [
  'ma thiet bi',
  'ma thiet bi cong trinh',
  'ma cong trinh thiet bi',
  'ma duong day',
  'ma',
];

const PARENT_KEY_ALIASES = [
  'ma thiet bi cha',
  'ma cong trinh cha',
  'ma cha',
  'ma thiet bi cong trinh cha',
];

function normalizeText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function cellToPrimitive(value: ExcelJS.CellValue): EvnCellValue {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;

  if (typeof value === 'object') {
    if ('result' in value && value.result != null) return cellToPrimitive(value.result as ExcelJS.CellValue);
    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('');
    }
    if ('hyperlink' in value && typeof value.hyperlink === 'string') {
      return typeof value.text === 'string' ? value.text : value.hyperlink;
    }
  }

  return String(value);
}

function rowValues(worksheet: ExcelJS.Worksheet, rowNumber: number) {
  const values: EvnCellValue[] = [];
  const row = worksheet.getRow(rowNumber);
  const maxColumn = Math.max(worksheet.columnCount, row.cellCount);
  for (let column = 1; column <= maxColumn; column += 1) {
    values.push(cellToPrimitive(row.getCell(column).value));
  }
  return values;
}

function detectHeaderRow(worksheet: ExcelJS.Worksheet) {
  const maxScan = Math.min(40, worksheet.rowCount);
  let best: { rowNumber: number; score: number; nonEmpty: number } | null = null;

  for (let rowNumber = 1; rowNumber <= maxScan; rowNumber += 1) {
    const values = rowValues(worksheet, rowNumber);
    const normalized = values.map(normalizeText).filter(Boolean);
    if (normalized.length < 2) continue;

    const hintScore = HEADER_HINTS.reduce(
      (score, hint) => score + (normalized.some((value) => value === hint || value.includes(hint)) ? 1 : 0),
      0,
    );
    const score = hintScore * 10 + Math.min(normalized.length, 12);

    if (!best || score > best.score) {
      best = { rowNumber, score, nonEmpty: normalized.length };
    }
  }

  if (!best || best.score < 22 || best.nonEmpty < 2) return null;
  return best.rowNumber;
}

function inferEntityType(sheetName: string): EvnEntityType {
  const name = normalizeText(sheetName);
  if (name.includes('thong so') || name.includes('so lieu van hanh') || name.includes('appmeter')) return 'MEASUREMENT_REPORT';
  if (name.includes('tram bien ap')) return 'SUBSTATION';
  if (name.includes('may bien ap')) return 'TRANSFORMER';
  if (name.includes('ngan lo')) return 'BAY';
  if (name.includes('vi tri')) return 'LINE_POSITION';
  if (name.includes('duong day') || name.includes('tuyen')) return 'POWER_LINE';
  if (name.includes('cap ngam') || name.includes('dau cap')) return 'CABLE';
  if (
    name.includes('may cat') ||
    name.includes('dao cach ly') ||
    name.includes('bien dong') ||
    name.includes('bien dien ap') ||
    name.includes('chong set') ||
    name.includes('thanh cai') ||
    name.includes('tu bu') ||
    name.includes('ro le') ||
    name.includes('ac quy') ||
    name.includes('tu hop bo') ||
    name.includes('lbs')
  ) {
    return 'ELECTRICAL_EQUIPMENT';
  }
  return 'UNKNOWN';
}

function buildHeaders(worksheet: ExcelJS.Worksheet, headerRowNumber: number) {
  const rawHeaders = rowValues(worksheet, headerRowNumber);
  const used = new Map<string, number>();

  return rawHeaders.map((rawHeader, index) => {
    const base = String(rawHeader ?? '').trim() || `C${index + 1}`;
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    return count === 1 ? base : `${base}__${count}`;
  });
}

function findByAliases(data: Record<string, EvnCellValue>, aliases: string[]) {
  for (const [key, value] of Object.entries(data)) {
    const normalizedKey = normalizeText(key);
    if (aliases.some((alias) => normalizedKey === alias || normalizedKey.includes(alias))) {
      const text = String(value ?? '').trim();
      if (text) return text;
    }
  }
  return null;
}

function isFooterOrNoise(data: Record<string, EvnCellValue>, entityType: EvnEntityType) {
  const text = Object.values(data)
    .filter((value) => value != null)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join(' ');

  if (!text) return true;
  const normalized = normalizeText(text);
  if (normalized.includes('ban quyen thuoc evn ict')) return true;
  if (/^[A-Za-z0-9+/=]{120,}$/.test(text.replace(/\s+/g, ''))) return true;

  if (entityType === 'MEASUREMENT_REPORT') {
    const first = String(Object.values(data).find((value) => String(value ?? '').trim()) ?? '').trim().toLowerCase();
    if (first === 'max' || first === 'min') return true;
  }

  return false;
}

function inferWarnings(data: Record<string, EvnCellValue>, entityType: EvnEntityType) {
  const warnings: string[] = [];
  const normalizedEntries = Object.entries(data).map(([key, value]) => [normalizeText(key), value] as const);
  const x = normalizedEntries.find(([key]) => key === 'x')?.[1];
  const y = normalizedEntries.find(([key]) => key === 'y')?.[1];

  if (x != null && y != null) {
    const xNumber = Number(x);
    const yNumber = Number(y);
    if (Number.isFinite(xNumber) && Number.isFinite(yNumber)) {
      if (!(xNumber >= -90 && xNumber <= 90 && yNumber >= -180 && yNumber <= 180)) {
        warnings.push('COORDINATE_OUT_OF_WGS84_RANGE');
      }
    }
  }

  if (entityType === 'MEASUREMENT_REPORT') {
    const timeValue = normalizedEntries.find(([key]) => key.includes('thoi gian'))?.[1];
    if (String(timeValue ?? '').trim() === '24:00') warnings.push('TIME_24H_ROLLS_TO_NEXT_DAY');
  }

  const operationDate = normalizedEntries.find(([key]) => key.includes('ngay van hanh') || key.includes('ngay dua vao'))?.[1];
  if (operationDate) {
    const yearMatch = String(operationDate).match(/\b(18|19|20)\d{2}\b/);
    if (yearMatch && Number(yearMatch[0]) < 1950) warnings.push('OPERATION_DATE_SUSPICIOUS');
  }

  return warnings;
}

function detectReportDate(worksheet: ExcelJS.Worksheet) {
  const maxScan = Math.min(25, worksheet.rowCount);
  for (let rowNumber = 1; rowNumber <= maxScan; rowNumber += 1) {
    const text = rowValues(worksheet, rowNumber).map((value) => String(value ?? '')).join(' ');
    const match = text.match(/(?:Ngày|Ngay)\s*:?\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})/i);
    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  return null;
}

function extractReportContext(
  worksheet: ExcelJS.Worksheet,
  headerRowNumber: number | null,
  detectedReportDate: string | null,
): EvnReportContext {
  const endRow = Math.max(1, Math.min((headerRowNumber ?? 20) - 1, 30));
  const rawContextLines: string[] = [];
  const keyValues: Record<string, string> = {};

  for (let rowNumber = 1; rowNumber <= endRow; rowNumber += 1) {
    const values = rowValues(worksheet, rowNumber)
      .map((value) => String(value ?? '').trim())
      .filter(Boolean);
    if (values.length === 0) continue;
    const line = values.join(' ').replace(/\s+/g, ' ').trim();
    if (!line || normalizeText(line).includes('ban quyen thuoc evn ict')) continue;
    rawContextLines.push(line);

    const colonMatch = line.match(/^([^:]{2,80})\s*:\s*(.+)$/);
    if (colonMatch) {
      keyValues[colonMatch[1].trim()] = colonMatch[2].trim();
    }
  }

  const normalizedLines = rawContextLines.map((line) => ({ raw: line, normalized: normalizeText(line) }));
  const transformerLine = normalizedLines.find(({ normalized }) => normalized.includes('may bien ap') || /\bmba\b/.test(normalized));
  const bayOrFeederLine = normalizedLines.find(({ normalized }) =>
    normalized.includes('ngan lo') || normalized.includes('phat tuyen') || normalized.includes('tuyen'),
  );

  const appMeterLine = normalizedLines.find(({ normalized }) => normalized.includes('appmeter') || normalized.includes('diem do'));
  const appMeterFromLabel = appMeterLine?.raw.match(/\b(PB[A-Z0-9._-]{8,})\b/i)?.[1] ?? null;
  const appMeterAnywhere = rawContextLines.join(' ').match(/\b(PB\d{8,})\b/i)?.[1] ?? null;

  let circuitCode: string | null = null;
  for (const { raw, normalized } of normalizedLines) {
    if (/\b(19|20)\d{2}\b/.test(raw) && normalized.includes('ngay')) continue;
    const explicit = normalized.match(/(?:ngan\s*lo|nganlo|phat\s*tuyen|tuyen)\s*[.:-]*\s*(\d{3})\b/);
    if (explicit) {
      circuitCode = explicit[1];
      break;
    }
    const leading = raw.match(/^\s*(\d{3})\s+[A-Za-zÀ-ỹ]/u);
    if (leading) {
      circuitCode = leading[1];
      break;
    }
  }

  let voltageLevelKv: number | null = null;
  for (const { raw } of normalizedLines) {
    const match = raw.match(/\b(500|220|110|35|22|15|10|6)\s*k\s*v\b/i);
    if (match) {
      voltageLevelKv = Number(match[1]);
      break;
    }
  }

  const reportTitle = rawContextLines.find((line) => {
    const normalized = normalizeText(line);
    return line.length >= 5 && !normalized.startsWith('ngay ') && !normalized.includes('thoi gian');
  }) ?? worksheet.name ?? null;

  return {
    reportTitle,
    reportDate: detectedReportDate,
    transformerLabel: transformerLine?.raw ?? null,
    bayOrFeederLabel: bayOrFeederLine?.raw ?? null,
    circuitCode,
    appMeterCode: appMeterFromLabel ?? appMeterAnywhere,
    voltageLevelKv,
    keyValues,
    rawContextLines,
  };
}

function parseSheet(worksheet: ExcelJS.Worksheet) {
  const entityType = inferEntityType(worksheet.name);
  const headerRowNumber = detectHeaderRow(worksheet);
  const detectedReportDate = detectReportDate(worksheet);
  const context = entityType === 'MEASUREMENT_REPORT'
    ? extractReportContext(worksheet, headerRowNumber, detectedReportDate)
    : undefined;
  const records: EvnParsedRecord[] = [];
  let skippedRows = 0;
  let warningCount = 0;

  if (!headerRowNumber) {
    return {
      records,
      preview: {
        sheetName: worksheet.name,
        entityType,
        headerRowNumber: null,
        totalDataRows: 0,
        acceptedRows: 0,
        skippedRows: worksheet.rowCount,
        warningCount: 1,
        detectedReportDate,
        context,
        sampleRows: [],
      } satisfies EvnSheetPreview,
    };
  }

  const headers = buildHeaders(worksheet, headerRowNumber);

  for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const values = rowValues(worksheet, rowNumber);
    const data: Record<string, EvnCellValue> = {};
    headers.forEach((header, index) => {
      const value = values[index] ?? null;
      if (value !== null && String(value).trim() !== '') data[header] = value;
    });

    if (isFooterOrNoise(data, entityType)) {
      skippedRows += 1;
      continue;
    }

    const warnings = inferWarnings(data, entityType);
    warningCount += warnings.length;
    records.push({
      sheetName: worksheet.name,
      rowNumber,
      headerRowNumber,
      entityType,
      externalKey: findByAliases(data, EXTERNAL_KEY_ALIASES),
      parentExternalKey: findByAliases(data, PARENT_KEY_ALIASES),
      data,
      warnings,
      context,
    });
  }

  return {
    records,
    preview: {
      sheetName: worksheet.name,
      entityType,
      headerRowNumber,
      totalDataRows: records.length + skippedRows,
      acceptedRows: records.length,
      skippedRows,
      warningCount,
      detectedReportDate,
      context,
      sampleRows: records.slice(0, 3).map(({ rowNumber, externalKey, parentExternalKey, data, warnings }) => ({
        rowNumber,
        externalKey,
        parentExternalKey,
        data,
        warnings,
      })),
    } satisfies EvnSheetPreview,
  };
}

export async function parseEvnWorkbook(buffer: Buffer, fileName: string): Promise<ParsedEvnWorkbook> {
  const workbook = new ExcelJS.Workbook();
  const workbookBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  await workbook.xlsx.load(workbookBuffer);

  const records: EvnParsedRecord[] = [];
  const sheets: EvnSheetPreview[] = [];

  workbook.eachSheet((worksheet) => {
    const parsed = parseSheet(worksheet);
    records.push(...parsed.records);
    sheets.push(parsed.preview);
  });

  const acceptedRows = sheets.reduce((sum, sheet) => sum + sheet.acceptedRows, 0);
  const skippedRows = sheets.reduce((sum, sheet) => sum + sheet.skippedRows, 0);
  const warningCount = sheets.reduce((sum, sheet) => sum + sheet.warningCount, 0);
  const requiresObservationDate = sheets.some(
    (sheet) => sheet.entityType === 'MEASUREMENT_REPORT' && sheet.acceptedRows > 0 && !sheet.detectedReportDate,
  );

  return {
    records,
    preview: {
      fileName,
      sheetCount: sheets.length,
      acceptedRows,
      skippedRows,
      warningCount,
      requiresObservationDate,
      sheets,
    },
  };
}
