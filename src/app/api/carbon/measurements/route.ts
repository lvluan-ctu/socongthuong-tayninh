import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyEmissionMeasurements, energyEmissionSources, energyEnergyTypes } from '@/db/schema';
import { carbonMeasurementSchema } from '@/lib/carbon-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

function dateOrNull(value: string | null | undefined) { return value ? new Date(value) : null; }
function databaseCode(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : undefined; }

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const sourceId = params.get('sourceId'); const verificationStatus = params.get('verificationStatus');
    const filters = [sourceId ? eq(energyEmissionMeasurements.sourceId, sourceId) : null, verificationStatus ? eq(energyEmissionMeasurements.verificationStatus, verificationStatus) : null].filter((item): item is NonNullable<typeof item> => item !== null);
    const select = {
      id: energyEmissionMeasurements.id, sourceId: energyEmissionMeasurements.sourceId, sourceCode: energyEmissionSources.code, sourceName: energyEmissionSources.name,
      energyTypeCode: energyEmissionSources.energyTypeCode, energyTypeName: energyEnergyTypes.name, vbdhRecordId: energyEmissionMeasurements.vbdhRecordId,
      metricCode: energyEmissionMeasurements.metricCode, periodFrom: energyEmissionMeasurements.periodFrom, periodTo: energyEmissionMeasurements.periodTo, measuredAt: energyEmissionMeasurements.measuredAt,
      value: energyEmissionMeasurements.value, unit: energyEmissionMeasurements.unit, measurementMethod: energyEmissionMeasurements.measurementMethod, instrumentRef: energyEmissionMeasurements.instrumentRef,
      sourceSystem: energyEmissionMeasurements.sourceSystem, sourceRecordId: energyEmissionMeasurements.sourceRecordId, sourceDocumentRef: energyEmissionMeasurements.sourceDocumentRef,
      quality: energyEmissionMeasurements.quality, verificationStatus: energyEmissionMeasurements.verificationStatus, metadata: energyEmissionMeasurements.metadata,
      createdAt: energyEmissionMeasurements.createdAt, updatedAt: energyEmissionMeasurements.updatedAt,
    };
    const query = db.select(select).from(energyEmissionMeasurements).innerJoin(energyEmissionSources, eq(energyEmissionSources.id, energyEmissionMeasurements.sourceId)).leftJoin(energyEnergyTypes, eq(energyEnergyTypes.code, energyEmissionSources.energyTypeCode));
    const rows = filters.length ? await query.where(and(...filters)).orderBy(desc(energyEmissionMeasurements.measuredAt)).limit(500) : await query.orderBy(desc(energyEmissionMeasurements.measuredAt)).limit(500);
    return NextResponse.json({ items: rows.map((row) => ({ ...row, value: Number(row.value) })) });
  } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải measurement.' }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const payload = carbonMeasurementSchema.parse(await request.json());
    const [source] = await db.select({ id: energyEmissionSources.id, status: energyEmissionSources.status }).from(energyEmissionSources).where(eq(energyEmissionSources.id, payload.sourceId)).limit(1);
    if (!source) return NextResponse.json({ message: 'Không tìm thấy nguồn phát thải.' }, { status: 404 });
    if (source.status === 'INACTIVE') return NextResponse.json({ message: 'Không thể ghi measurement mới cho nguồn INACTIVE.' }, { status: 409 });
    const [created] = await db.insert(energyEmissionMeasurements).values({
      sourceId: payload.sourceId, vbdhRecordId: payload.vbdhRecordId ?? null, metricCode: payload.metricCode, periodFrom: dateOrNull(payload.periodFrom), periodTo: dateOrNull(payload.periodTo), measuredAt: new Date(payload.measuredAt),
      value: String(payload.value), unit: payload.unit, measurementMethod: payload.measurementMethod ?? null, instrumentRef: payload.instrumentRef ?? null, sourceSystem: payload.sourceSystem,
      sourceRecordId: payload.sourceRecordId ?? null, sourceDocumentRef: payload.sourceDocumentRef ?? null, quality: payload.quality, verificationStatus: payload.verificationStatus,
      metadata: payload.metadata ?? { source: payload.sourceSystem },
    }).returning();
    return NextResponse.json({ ...created, value: Number(created.value) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Measurement không hợp lệ.', issues: error.issues }, { status: 400 });
    if (databaseCode(error) === '23505') return NextResponse.json({ message: 'Measurement đã tồn tại với cùng source, metric, measuredAt và sourceRecordId.' }, { status: 409 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu measurement.' }, { status: 400 });
  }
}
