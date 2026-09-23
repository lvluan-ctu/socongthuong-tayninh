import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { energyMeasurements, energyMeasurementPoints, energyMetricDefinitions } from '@/db/schema';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const pointId = url.searchParams.get('pointId');
    if (!pointId) return NextResponse.json({ message: 'Thiếu pointId.' }, { status: 400 });

    const [point] = await db
      .select()
      .from(energyMeasurementPoints)
      .where(eq(energyMeasurementPoints.id, pointId))
      .limit(1);
    if (!point) return NextResponse.json({ message: 'Không tìm thấy điểm đo.' }, { status: 404 });

    const to = parseDate(url.searchParams.get('to')) ?? new Date();
    const from = parseDate(url.searchParams.get('from')) ?? new Date(to.getTime() - 48 * 60 * 60 * 1000);

    const rows = await db
      .select({
        id: energyMeasurements.id,
        metricCode: energyMeasurements.metricCode,
        metricName: energyMetricDefinitions.name,
        measuredAt: energyMeasurements.measuredAt,
        value: energyMeasurements.value,
        unit: energyMeasurements.unit,
        quality: energyMeasurements.quality,
        rawValue: energyMeasurements.rawValue,
      })
      .from(energyMeasurements)
      .leftJoin(energyMetricDefinitions, eq(energyMetricDefinitions.code, energyMeasurements.metricCode))
      .where(and(
        eq(energyMeasurements.measurementPointId, pointId),
        gte(energyMeasurements.measuredAt, from),
        lte(energyMeasurements.measuredAt, to),
      ))
      .orderBy(asc(energyMeasurements.measuredAt), asc(energyMeasurements.metricCode));

    const byMetric = new Map<string, Array<{ measuredAt: string; value: number; unit: string; quality: string }>>();
    for (const row of rows) {
      const value = Number(row.value);
      if (!Number.isFinite(value)) continue;
      const list = byMetric.get(row.metricCode) ?? [];
      list.push({
        measuredAt: row.measuredAt.toISOString(),
        value,
        unit: row.unit,
        quality: row.quality,
      });
      byMetric.set(row.metricCode, list);
    }

    const metrics = Array.from(byMetric.entries()).map(([code, values]) => {
      const numbers = values.map((item) => item.value);
      const latest = values.at(-1) ?? null;
      return {
        code,
        name: rows.find((row) => row.metricCode === code)?.metricName ?? code,
        unit: latest?.unit ?? '',
        latest: latest?.value ?? null,
        latestAt: latest?.measuredAt ?? null,
        min: numbers.length ? Math.min(...numbers) : null,
        max: numbers.length ? Math.max(...numbers) : null,
        avg: numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null,
        values,
      };
    });

    return NextResponse.json({
      point,
      from: from.toISOString(),
      to: to.toISOString(),
      rowCount: rows.length,
      metrics,
    });
  } catch (error) {
    console.error('Grid telemetry series failed', error);
    return NextResponse.json({ message: 'Không thể tải chuỗi dữ liệu đo.' }, { status: 500 });
  }
}
