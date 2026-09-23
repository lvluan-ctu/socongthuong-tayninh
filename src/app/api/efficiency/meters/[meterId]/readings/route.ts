import { and, asc, count, desc, eq, gte, lte } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyMeasurements, energyMetricDefinitions } from '@/db/schema';
import { db } from '@/lib/db';
import { meterReadingSchema } from '@/lib/efficiency-schemas';
import { paginationMeta, parsePagination } from '@/lib/pagination';
import { loadMeter } from '@/server/efficiency/meter';
import { ensureCanonicalMetricDefinition } from '@/server/efficiency/metrics';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ meterId: string }> };
type Granularity = 'HOUR' | 'DAY' | 'MONTH' | 'YEAR';
const granularities: Granularity[] = ['HOUR', 'DAY', 'MONTH', 'YEAR'];

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Khoảng thời gian đọc công tơ không hợp lệ.');
  return date;
}

function bucketStart(input: Date, granularity: Granularity) {
  const year = input.getUTCFullYear();
  const month = input.getUTCMonth();
  const day = input.getUTCDate();
  const hour = input.getUTCHours();
  if (granularity === 'HOUR') return new Date(Date.UTC(year, month, day, hour));
  if (granularity === 'DAY') return new Date(Date.UTC(year, month, day));
  if (granularity === 'MONTH') return new Date(Date.UTC(year, month, 1));
  return new Date(Date.UTC(year, 0, 1));
}

function bucketEnd(start: Date, granularity: Granularity) {
  if (granularity === 'HOUR') return new Date(start.getTime() + 60 * 60 * 1000);
  if (granularity === 'DAY') return new Date(start.getTime() + 24 * 60 * 60 * 1000);
  if (granularity === 'MONTH') return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return new Date(Date.UTC(start.getUTCFullYear() + 1, 0, 1));
}

function parseGranularities(value: string | null) {
  if (!value) return granularities;
  const values = value.split(',').map((item) => item.trim().toUpperCase()).filter((item): item is Granularity => granularities.includes(item as Granularity));
  if (!values.length) throw new Error('Granularity phải là HOUR, DAY, MONTH hoặc YEAR.');
  return Array.from(new Set(values));
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { meterId } = await context.params;
    z.string().uuid().parse(meterId);
    const meter = await loadMeter(meterId);
    if (!meter) return NextResponse.json({ message: 'Không tìm thấy công tơ.' }, { status: 404 });
    if (!meter.measurementPointId) return NextResponse.json({ message: 'Công tơ chưa được liên kết điểm đo nên chưa có chuỗi thời gian.' }, { status: 422 });

    const url = new URL(request.url);
    const now = new Date();
    const from = parseDate(url.searchParams.get('from'), new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    const to = parseDate(url.searchParams.get('to'), now);
    if (from > to) return NextResponse.json({ message: 'from phải nhỏ hơn hoặc bằng to.' }, { status: 400 });
    const metricCode = url.searchParams.get('metricCode');
    const selectedGranularities = parseGranularities(url.searchParams.get('granularity'));
    const wantsPagination = url.searchParams.has('page') || url.searchParams.has('pageSize');
    const pagination = parsePagination(url.searchParams);
    const measurementWhere = and(
      eq(energyMeasurements.measurementPointId, meter.measurementPointId),
      ...(metricCode ? [eq(energyMeasurements.metricCode, metricCode)] : []),
      gte(energyMeasurements.measuredAt, from),
      lte(energyMeasurements.measuredAt, to),
    );
    const buildReadingsQuery = () => db.select({
      id: energyMeasurements.id,
      metricCode: energyMeasurements.metricCode,
      measuredAt: energyMeasurements.measuredAt,
      value: energyMeasurements.value,
      unit: energyMeasurements.unit,
      quality: energyMeasurements.quality,
      rawValue: energyMeasurements.rawValue,
      metadata: energyMeasurements.metadata,
      metricName: energyMetricDefinitions.name,
      aggregation: energyMetricDefinitions.aggregation,
    }).from(energyMeasurements)
      .leftJoin(energyMetricDefinitions, eq(energyMetricDefinitions.code, energyMeasurements.metricCode))
      .where(measurementWhere)
      .orderBy(desc(energyMeasurements.measuredAt), asc(energyMeasurements.metricCode));
    const [rows, totalRows, aggregateRows] = await Promise.all([
      wantsPagination ? buildReadingsQuery().limit(pagination.pageSize).offset(pagination.offset) : buildReadingsQuery(),
      db.select({ value: count() }).from(energyMeasurements).where(measurementWhere),
      wantsPagination ? buildReadingsQuery() : Promise.resolve(null),
    ]);
    const rowsForAggregation = aggregateRows ?? rows;

    const readings = rows.map((row) => ({
      ...row,
      measuredAt: row.measuredAt.toISOString(),
      value: Number(row.value),
    }));
    const aggregates: Array<Record<string, unknown>> = [];
    for (const granularity of selectedGranularities) {
      const groups = new Map<string, { metricCode: string; metricName: string; unit: string; aggregation: string; start: Date; values: number[]; qualities: string[] }>();
      for (const row of rowsForAggregation) {
        const value = Number(row.value);
        if (!Number.isFinite(value) || row.quality === 'INVALID' || row.quality === 'MISSING') continue;
        const start = bucketStart(row.measuredAt, granularity);
        const key = `${row.metricCode}:${start.toISOString()}`;
        const group = groups.get(key) ?? {
          metricCode: row.metricCode,
          metricName: row.metricName ?? row.metricCode,
          unit: row.unit,
          aggregation: row.aggregation ?? 'AVG',
          start,
          values: [],
          qualities: [],
        };
        group.values.push(value);
        group.qualities.push(row.quality);
        groups.set(key, group);
      }
      for (const group of groups.values()) {
        const sum = group.values.reduce((total, value) => total + value, 0);
        const average = sum / group.values.length;
        const value = group.aggregation === 'SUM'
          ? sum
          : group.aggregation === 'MAX'
            ? Math.max(...group.values)
            : group.aggregation === 'MIN'
              ? Math.min(...group.values)
              : average;
        aggregates.push({
          metricCode: group.metricCode,
          metricName: group.metricName,
          unit: group.unit,
          granularity,
          periodStart: group.start.toISOString(),
          periodEnd: bucketEnd(group.start, granularity).toISOString(),
          value,
          sum,
          average,
          min: Math.min(...group.values),
          max: Math.max(...group.values),
          count: group.values.length,
          quality: group.qualities.includes('ESTIMATED') ? 'ESTIMATED' : 'GOOD',
        });
      }
    }
    aggregates.sort((a, b) => String(a.periodStart).localeCompare(String(b.periodStart)) || String(a.metricCode).localeCompare(String(b.metricCode)));
    return NextResponse.json({
      meter,
      from: from.toISOString(),
      to: to.toISOString(),
      rowCount: Number(totalRows[0]?.value ?? 0),
      readings,
      aggregates,
      granularities: selectedGranularities,
      ...(wantsPagination ? { pagination: paginationMeta(pagination, Number(totalRows[0]?.value ?? 0)) } : {}),
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Mã công tơ không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải chuỗi thời gian công tơ.' }, { status: 400 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { meterId } = await context.params;
    z.string().uuid().parse(meterId);
    const payload = meterReadingSchema.parse(await request.json());
    const meter = await loadMeter(meterId);
    if (!meter) return NextResponse.json({ message: 'Không tìm thấy công tơ.' }, { status: 404 });
    if (!meter.measurementPointId) return NextResponse.json({ message: 'Công tơ chưa có measurement point.' }, { status: 422 });
    const measuredAt = new Date(payload.measuredAt);
    const result = await db.transaction(async (tx) => {
      await ensureCanonicalMetricDefinition(tx, payload.metricCode);
      const [row] = await tx.insert(energyMeasurements).values({
        measurementPointId: meter.measurementPointId as string,
        metricCode: payload.metricCode,
        measuredAt,
        value: String(payload.value),
        unit: payload.unit,
        quality: payload.quality,
        sourceId: payload.sourceId ?? meter.sourceId ?? null,
        rawValue: payload.rawValue ?? null,
        metadata: { ...(payload.metadata ?? {}), smartMeterId: meterId },
      }).onConflictDoUpdate({
        target: [energyMeasurements.measurementPointId, energyMeasurements.metricCode, energyMeasurements.measuredAt],
        set: {
          value: String(payload.value),
          unit: payload.unit,
          quality: payload.quality,
          sourceId: payload.sourceId ?? meter.sourceId ?? null,
          rawValue: payload.rawValue ?? null,
          metadata: { ...(payload.metadata ?? {}), smartMeterId: meterId },
        },
      }).returning();
      return row;
    });
    return NextResponse.json({ item: { ...result, value: Number(result.value) } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Bản ghi đo không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể ghi bản ghi đo.' }, { status: 400 });
  }
}
