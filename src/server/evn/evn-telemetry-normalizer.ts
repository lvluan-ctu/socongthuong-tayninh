import { and, eq, ilike } from 'drizzle-orm';
import {
  energyAssets,
  energyBays,
  energyDataQualityIssues,
  energyFeeders,
  energyImportBatches,
  energyImportRecords,
  energyMeasurementPointMappings,
  energyMeasurementPoints,
  energyMeasurements,
  energyMetricDefinitions,
  energyMetricSourceMappings,
} from '@/db/schema';
import { db } from '@/lib/db';
import type { EvnCellValue, EvnReportContext } from './evn-import.types';

const PROVIDER = 'EVN';

type TelemetryPayload = {
  data: Record<string, EvnCellValue>;
  warnings: string[];
  context?: EvnReportContext;
};

type MetricSpec = {
  canonicalCode: string;
  name: string;
  unit: string;
  aggregation: string;
  aliases: string[];
};

const METRICS: MetricSpec[] = [
  { canonicalCode: 'CURRENT_PHASE_A_A', name: 'Dòng điện pha A', unit: 'A', aggregation: 'AVG', aliases: ['ia', 'i a', 'dong pha a', 'dong dien pha a'] },
  { canonicalCode: 'CURRENT_PHASE_B_A', name: 'Dòng điện pha B', unit: 'A', aggregation: 'AVG', aliases: ['ib', 'i b', 'dong pha b', 'dong dien pha b'] },
  { canonicalCode: 'CURRENT_PHASE_C_A', name: 'Dòng điện pha C', unit: 'A', aggregation: 'AVG', aliases: ['ic', 'i c', 'dong pha c', 'dong dien pha c'] },
  { canonicalCode: 'ACTIVE_POWER_MW', name: 'Công suất tác dụng', unit: 'MW', aggregation: 'AVG', aliases: ['p', 'p mw', 'cong suat p', 'cong suat tac dung'] },
  { canonicalCode: 'REACTIVE_POWER_MVAR', name: 'Công suất phản kháng', unit: 'Mvar', aggregation: 'AVG', aliases: ['q', 'q mvar', 'cong suat q', 'cong suat phan khang'] },
  { canonicalCode: 'POWER_FACTOR', name: 'Hệ số công suất', unit: 'ratio', aggregation: 'AVG', aliases: ['cos', 'cos phi', 'cosfi', 'power factor', 'he so cong suat'] },
  { canonicalCode: 'VOLTAGE_PHASE_A_KV', name: 'Điện áp pha A', unit: 'kV', aggregation: 'AVG', aliases: ['ua', 'u a'] },
  { canonicalCode: 'VOLTAGE_PHASE_B_KV', name: 'Điện áp pha B', unit: 'kV', aggregation: 'AVG', aliases: ['ub', 'u b'] },
  { canonicalCode: 'VOLTAGE_PHASE_C_KV', name: 'Điện áp pha C', unit: 'kV', aggregation: 'AVG', aliases: ['uc', 'u c'] },
  { canonicalCode: 'FREQUENCY_HZ', name: 'Tần số', unit: 'Hz', aggregation: 'AVG', aliases: ['f', 'hz', 'tan so'] },
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

function payloadOf(value: unknown): TelemetryPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  if (payload.entityTypeHint !== 'MEASUREMENT_REPORT') return null;
  if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) return null;
  return {
    data: payload.data as Record<string, EvnCellValue>,
    warnings: Array.isArray(payload.warnings) ? payload.warnings.map(String) : [],
    context: payload.context && typeof payload.context === 'object'
      ? payload.context as EvnReportContext
      : undefined,
  };
}

function parseNumber(value: EvnCellValue) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const raw = String(value).trim().replace(/\s+/g, '');
  if (!raw) return null;

  // Customer EVN reports use decimal dots in the supplied samples. If a value
  // contains only a decimal comma, normalize it; otherwise preserve dot semantics.
  const normalized = raw.includes(',') && !raw.includes('.')
    ? raw.replace(',', '.')
    : raw.replace(/,/g, '');
  const numeric = Number(normalized.replace(/[^0-9+\-.Ee]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function findTimeValue(data: Record<string, EvnCellValue>) {
  for (const [key, value] of Object.entries(data)) {
    const normalized = normalizeText(key);
    if (normalized === 'thoi gian' || normalized === 'time' || normalized.includes('thoi gian')) return value;
  }
  return null;
}

function parseTimeOfDay(value: EvnCellValue) {
  if (value == null) return null;

  if (typeof value === 'number' && value >= 0 && value <= 1.000001) {
    let totalMinutes = Math.round(value * 24 * 60);
    const dayOffset = totalMinutes >= 1440 ? 1 : 0;
    totalMinutes %= 1440;
    return { hour: Math.floor(totalMinutes / 60), minute: totalMinutes % 60, dayOffset };
  }

  const text = String(value).trim();
  const hhmm = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (hhmm) {
    const hour = Number(hhmm[1]);
    const minute = Number(hhmm[2]);
    if (minute < 0 || minute > 59 || hour < 0 || hour > 24) return null;
    if (hour === 24) return minute === 0 ? { hour: 0, minute: 0, dayOffset: 1 } : null;
    return { hour, minute, dayOffset: 0 };
  }

  const isoDate = new Date(text);
  if (!Number.isNaN(isoDate.getTime())) {
    return { hour: isoDate.getUTCHours(), minute: isoDate.getUTCMinutes(), dayOffset: 0 };
  }

  return null;
}

function dateInVietnam(value: Date | null) {
  if (!value) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function measuredAtFrom(
  batchDate: Date | null,
  context: EvnReportContext | undefined,
  timeValue: EvnCellValue,
) {
  const baseDate = context?.reportDate ?? dateInVietnam(batchDate);
  if (!baseDate) return null;
  const time = parseTimeOfDay(timeValue);
  if (!time) return null;

  const base = new Date(`${baseDate}T${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}:00+07:00`);
  if (Number.isNaN(base.getTime())) return null;
  if (time.dayOffset) base.setTime(base.getTime() + time.dayOffset * 24 * 60 * 60 * 1000);
  return base;
}

function matchMetric(header: string) {
  const normalized = normalizeText(header);
  return METRICS.find((metric) => metric.aliases.some((alias) => normalized === alias || normalized.startsWith(`${alias} `))) ?? null;
}

function compactLabel(value: string | null | undefined) {
  if (!value) return null;
  return value
    .replace(/^(ngăn\s*lộ|ngan\s*lo|phát\s*tuyến|phat\s*tuyen|tuyến|tuyen|máy\s*biến\s*áp|may\s*bien\s*ap)\s*:?\s*/i, '')
    .trim();
}

async function ensureMetricDefinitions() {
  for (const metric of METRICS) {
    await db.insert(energyMetricDefinitions).values({
      code: metric.canonicalCode,
      name: metric.name,
      unit: metric.unit,
      aggregation: metric.aggregation,
      metadata: { domain: 'grid', canonical: true },
    }).onConflictDoNothing();
  }
}

async function findMappedPoint(sourceId: string, sourceKey: string) {
  const [mapping] = await db
    .select({
      measurementPointId: energyMeasurementPointMappings.measurementPointId,
      assetId: energyMeasurementPointMappings.assetId,
    })
    .from(energyMeasurementPointMappings)
    .where(and(
      eq(energyMeasurementPointMappings.sourceId, sourceId),
      eq(energyMeasurementPointMappings.sourceKey, sourceKey),
    ))
    .limit(1);
  return mapping ?? null;
}

async function resolveAssetFromContext(context: EvnReportContext | undefined) {
  if (!context) return null;

  if (context.circuitCode) {
    const circuitPattern = `%${context.circuitCode}%`;
    const [bay] = await db
      .select({ assetId: energyBays.assetId, label: energyBays.bayCode })
      .from(energyBays)
      .where(ilike(energyBays.bayCode, circuitPattern))
      .limit(1);
    if (bay) return { assetId: bay.assetId, matchedBy: 'BAY_CODE', label: bay.label };

    const [feeder] = await db
      .select({ assetId: energyFeeders.assetId, label: energyFeeders.feederCode })
      .from(energyFeeders)
      .where(ilike(energyFeeders.feederCode, circuitPattern))
      .limit(1);
    if (feeder) return { assetId: feeder.assetId, matchedBy: 'FEEDER_CODE', label: feeder.label };
  }

  const contextLabels = [
    compactLabel(context.bayOrFeederLabel),
    compactLabel(context.transformerLabel),
    compactLabel(context.reportTitle),
  ].filter((value): value is string => Boolean(value && value.length >= 3));

  for (const label of contextLabels) {
    const [asset] = await db
      .select({ id: energyAssets.id, name: energyAssets.name })
      .from(energyAssets)
      .where(ilike(energyAssets.name, `%${label}%`))
      .limit(1);
    if (asset) return { assetId: asset.id, matchedBy: 'ASSET_NAME', label: asset.name };
  }

  return null;
}

async function ensureMeasurementPoint(
  sourceId: string,
  context: EvnReportContext | undefined,
  assetId: string,
  matchedBy: string,
  matchedLabel: string,
) {
  const sourceKey = context?.appMeterCode
    ?? (context?.circuitCode ? `CIRCUIT:${context.circuitCode}` : null)
    ?? `ASSET:${assetId}`;

  const mapped = await findMappedPoint(sourceId, sourceKey);
  if (mapped) return { measurementPointId: mapped.measurementPointId, sourceKey };

  if (context?.appMeterCode) {
    const [existing] = await db
      .select({ id: energyMeasurementPoints.id })
      .from(energyMeasurementPoints)
      .where(and(
        eq(energyMeasurementPoints.provider, PROVIDER),
        eq(energyMeasurementPoints.externalCode, context.appMeterCode),
      ))
      .limit(1);
    if (existing) {
      await db.insert(energyMeasurementPointMappings).values({
        sourceId,
        sourceKey,
        sourceLabel: matchedLabel,
        measurementPointId: existing.id,
        assetId,
        matchMethod: 'EXISTING_APPMETER',
        confidencePct: '100',
        metadata: { context },
      }).onConflictDoNothing();
      return { measurementPointId: existing.id, sourceKey };
    }
  }

  const pointCode = context?.appMeterCode
    ? `EVN:${context.appMeterCode}`
    : context?.circuitCode
      ? `EVN:CIRCUIT:${context.circuitCode}`
      : `EVN:ASSET:${assetId}`;

  let [point] = await db
    .select({ id: energyMeasurementPoints.id })
    .from(energyMeasurementPoints)
    .where(eq(energyMeasurementPoints.code, pointCode))
    .limit(1);

  if (!point) {
    [point] = await db.insert(energyMeasurementPoints).values({
      assetId,
      code: pointCode,
      name: context?.appMeterCode
        ? `${matchedLabel} • AppMeter ${context.appMeterCode}`
        : `${matchedLabel} • Điểm đo vận hành`,
      provider: PROVIDER,
      externalCode: context?.appMeterCode ?? context?.circuitCode ?? null,
      voltageLevelKv: context?.voltageLevelKv != null ? String(context.voltageLevelKv) : null,
      status: 'ACTIVE',
      metadata: {
        context,
        createdBy: 'evn-telemetry-normalizer-v1',
      },
    }).returning({ id: energyMeasurementPoints.id });
  }

  await db.insert(energyMeasurementPointMappings).values({
    sourceId,
    sourceKey,
    sourceLabel: matchedLabel,
    measurementPointId: point.id,
    assetId,
    matchMethod: matchedBy,
    confidencePct: matchedBy === 'BAY_CODE' || matchedBy === 'FEEDER_CODE' ? '95' : '80',
    metadata: { context },
  }).onConflictDoNothing();

  return { measurementPointId: point.id, sourceKey };
}

async function addQualityIssue(args: {
  batchId: string;
  recordId?: string | null;
  assetId?: string | null;
  severity?: string;
  issueCode: string;
  fieldName?: string | null;
  rawValue?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(energyDataQualityIssues).values({
    batchId: args.batchId,
    recordId: args.recordId ?? null,
    assetId: args.assetId ?? null,
    severity: args.severity ?? 'WARNING',
    issueCode: args.issueCode,
    fieldName: args.fieldName ?? null,
    rawValue: args.rawValue ?? null,
    message: args.message,
    metadata: args.metadata ?? {},
  });
}

export type EvnTelemetryImportResult = {
  batchId: string;
  reportRows: number;
  measurementPoints: number;
  measurementsInserted: number;
  duplicatesSkipped: number;
  unresolvedRows: number;
  invalidRows: number;
  qualityIssues: number;
  targetSummary: Array<{ sourceKey: string; assetId: string; measurementPointId: string; label: string }>;
};

export async function normalizeEvnTelemetryBatch(batchId: string): Promise<EvnTelemetryImportResult> {
  const [batch] = await db.select().from(energyImportBatches).where(eq(energyImportBatches.id, batchId)).limit(1);
  if (!batch) throw new Error('Không tìm thấy EVN import batch.');
  if (!batch.sourceId) throw new Error('Batch không có data source để ánh xạ telemetry.');

  await ensureMetricDefinitions();

  const rows = await db
    .select()
    .from(energyImportRecords)
    .where(eq(energyImportRecords.batchId, batchId))
    .orderBy(energyImportRecords.sheetName, energyImportRecords.rowNumber);

  const telemetryRows = rows
    .map((row) => ({ row, payload: payloadOf(row.payload) }))
    .filter((item): item is { row: typeof rows[number]; payload: TelemetryPayload } => Boolean(item.payload));

  const result: EvnTelemetryImportResult = {
    batchId,
    reportRows: telemetryRows.length,
    measurementPoints: 0,
    measurementsInserted: 0,
    duplicatesSkipped: 0,
    unresolvedRows: 0,
    invalidRows: 0,
    qualityIssues: 0,
    targetSummary: [],
  };

  if (telemetryRows.length === 0) return result;

  const targetCache = new Map<string, Awaited<ReturnType<typeof ensureMeasurementPoint>> & { assetId: string; label: string }>();
  const seenTargets = new Set<string>();

  for (const { row, payload } of telemetryRows) {
    const context = payload.context;
    const cacheKey = `${row.sheetName ?? 'sheet'}:${context?.appMeterCode ?? context?.circuitCode ?? context?.bayOrFeederLabel ?? 'unknown'}`;
    let target = targetCache.get(cacheKey);

    if (!target) {
      const resolvedAsset = await resolveAssetFromContext(context);
      if (!resolvedAsset) {
        result.unresolvedRows += 1;
        if (!seenTargets.has(`UNRESOLVED:${cacheKey}`)) {
          await addQualityIssue({
            batchId,
            recordId: row.id,
            severity: 'ERROR',
            issueCode: 'TELEMETRY_TARGET_UNRESOLVED',
            message: `Không xác định được ngăn lộ/feeder/tài sản nhận dữ liệu đo cho sheet ${row.sheetName ?? ''}.`,
            metadata: { context },
          });
          result.qualityIssues += 1;
          seenTargets.add(`UNRESOLVED:${cacheKey}`);
        }
        continue;
      }

      const point = await ensureMeasurementPoint(
        batch.sourceId,
        context,
        resolvedAsset.assetId,
        resolvedAsset.matchedBy,
        resolvedAsset.label,
      );
      target = { ...point, assetId: resolvedAsset.assetId, label: resolvedAsset.label };
      targetCache.set(cacheKey, target);
      result.measurementPoints += 1;
      result.targetSummary.push({
        sourceKey: target.sourceKey,
        assetId: target.assetId,
        measurementPointId: target.measurementPointId,
        label: target.label,
      });
    }

    const timeValue = findTimeValue(payload.data);
    const measuredAt = measuredAtFrom(batch.observationDate, context, timeValue);
    if (!measuredAt) {
      result.invalidRows += 1;
      await addQualityIssue({
        batchId,
        recordId: row.id,
        assetId: target.assetId,
        severity: 'ERROR',
        issueCode: 'TELEMETRY_TIME_INVALID',
        fieldName: 'Thời gian',
        rawValue: timeValue == null ? null : String(timeValue),
        message: 'Không thể xác định timestamp đo. Cần ngày dữ liệu hợp lệ và giá trị thời gian HH:mm.',
        metadata: { context },
      });
      result.qualityIssues += 1;
      continue;
    }

    for (const warning of payload.warnings) {
      if (warning === 'TIME_24H_ROLLS_TO_NEXT_DAY') continue;
      await addQualityIssue({
        batchId,
        recordId: row.id,
        assetId: target.assetId,
        issueCode: warning,
        message: `Cảnh báo dữ liệu nguồn EVN: ${warning}`,
        metadata: { context, sheetName: row.sheetName },
      });
      result.qualityIssues += 1;
    }

    let rowMetricCount = 0;
    for (const [sourceHeader, rawValue] of Object.entries(payload.data)) {
      const metric = matchMetric(sourceHeader);
      if (!metric) continue;
      rowMetricCount += 1;
      const value = parseNumber(rawValue);
      if (value == null) {
        await addQualityIssue({
          batchId,
          recordId: row.id,
          assetId: target.assetId,
          severity: 'WARNING',
          issueCode: 'TELEMETRY_VALUE_INVALID',
          fieldName: sourceHeader,
          rawValue: rawValue == null ? null : String(rawValue),
          message: `Giá trị ${sourceHeader} không chuyển được sang số.`,
          metadata: { context },
        });
        result.qualityIssues += 1;
        continue;
      }

      await db.insert(energyMetricSourceMappings).values({
        sourceId: batch.sourceId,
        sourceMetricCode: sourceHeader,
        canonicalMetricCode: metric.canonicalCode,
        sourceUnit: metric.unit,
        canonicalUnit: metric.unit,
        multiplier: '1',
        signConvention: 'SOURCE_AS_IS',
        metadata: {
          provider: PROVIDER,
          note: 'Giữ nguyên dấu P/Q của báo cáo EVN; semantics chiều công suất chỉ bổ sung sau khi nguồn xác nhận.',
        },
      }).onConflictDoNothing();

      const inserted = await db.insert(energyMeasurements).values({
        measurementPointId: target.measurementPointId,
        metricCode: metric.canonicalCode,
        measuredAt,
        value: String(value),
        unit: metric.unit,
        quality: payload.warnings.length > 0 ? 'SOURCE_WARNING' : 'GOOD',
        sourceId: batch.sourceId,
        batchId,
        rawValue: rawValue == null ? null : String(rawValue),
        metadata: {
          sourceHeader,
          sheetName: row.sheetName,
          sourceRowNumber: row.rowNumber,
          signConvention: 'SOURCE_AS_IS',
          context,
        },
      }).onConflictDoNothing().returning({ id: energyMeasurements.id });

      if (inserted.length > 0) result.measurementsInserted += 1;
      else result.duplicatesSkipped += 1;
    }

    if (rowMetricCount === 0) {
      result.invalidRows += 1;
      await addQualityIssue({
        batchId,
        recordId: row.id,
        assetId: target.assetId,
        severity: 'WARNING',
        issueCode: 'TELEMETRY_METRICS_NOT_FOUND',
        message: 'Dòng đo không có cột Ia/Ib/Ic/P/Q/Cosφ hoặc metric được hỗ trợ.',
        metadata: { headers: Object.keys(payload.data), context },
      });
      result.qualityIssues += 1;
    } else {
      await db.update(energyImportRecords).set({
        validationStatus: payload.warnings.length > 0 ? 'TELEMETRY_IMPORTED_WITH_WARNING' : 'TELEMETRY_IMPORTED',
        resolvedAssetId: target.assetId,
      }).where(eq(energyImportRecords.id, row.id));
    }
  }

  const previousMetadata = batch.metadata && typeof batch.metadata === 'object' && !Array.isArray(batch.metadata)
    ? batch.metadata as Record<string, unknown>
    : {};
  await db.update(energyImportBatches).set({
    metadata: {
      ...previousMetadata,
      telemetryImport: {
        version: 'evn-telemetry-normalizer-v1',
        importedAt: new Date().toISOString(),
        reportRows: result.reportRows,
        measurementsInserted: result.measurementsInserted,
        duplicatesSkipped: result.duplicatesSkipped,
        unresolvedRows: result.unresolvedRows,
        invalidRows: result.invalidRows,
        qualityIssues: result.qualityIssues,
        targetSummary: result.targetSummary,
      },
    },
  }).where(eq(energyImportBatches.id, batchId));

  return result;
}
