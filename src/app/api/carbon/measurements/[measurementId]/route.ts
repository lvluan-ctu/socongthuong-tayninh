import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyEmissionMeasurements, energyEmissionSources } from '@/db/schema';
import { carbonMeasurementPatchSchema } from '@/lib/carbon-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ measurementId: string }> };

async function read(id: string) { const [row] = await db.select().from(energyEmissionMeasurements).where(eq(energyEmissionMeasurements.id, id)).limit(1); return row; }

export async function GET(_request: Request, context: RouteContext) {
  const { measurementId } = await context.params; const row = await read(measurementId);
  return row ? NextResponse.json({ item: { ...row, value: Number(row.value) } }) : NextResponse.json({ message: 'Không tìm thấy measurement.' }, { status: 404 });
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { measurementId } = await context.params; const current = await read(measurementId);
    if (!current) return NextResponse.json({ message: 'Không tìm thấy measurement.' }, { status: 404 });
    const payload = carbonMeasurementPatchSchema.parse(await request.json());
    if (Object.keys(payload).length === 0) return NextResponse.json({ message: 'Không có trường nào được cập nhật.' }, { status: 400 });
    if (payload.sourceId) {
      const [source] = await db.select({ id: energyEmissionSources.id, status: energyEmissionSources.status }).from(energyEmissionSources).where(eq(energyEmissionSources.id, payload.sourceId)).limit(1);
      if (!source) return NextResponse.json({ message: 'Không tìm thấy nguồn phát thải.' }, { status: 404 });
      if (source.status === 'INACTIVE') return NextResponse.json({ message: 'Không thể chuyển measurement sang nguồn INACTIVE.' }, { status: 409 });
    }
    const [updated] = await db.update(energyEmissionMeasurements).set({
      ...(payload.sourceId === undefined ? {} : { sourceId: payload.sourceId }), ...(payload.vbdhRecordId === undefined ? {} : { vbdhRecordId: payload.vbdhRecordId }),
      ...(payload.metricCode === undefined ? {} : { metricCode: payload.metricCode }), ...(payload.periodFrom === undefined ? {} : { periodFrom: dateOrNull(payload.periodFrom) }), ...(payload.periodTo === undefined ? {} : { periodTo: dateOrNull(payload.periodTo) }),
      ...(payload.measuredAt === undefined ? {} : { measuredAt: new Date(payload.measuredAt) }), ...(payload.value === undefined ? {} : { value: String(payload.value) }), ...(payload.unit === undefined ? {} : { unit: payload.unit }),
      ...(payload.measurementMethod === undefined ? {} : { measurementMethod: payload.measurementMethod }), ...(payload.instrumentRef === undefined ? {} : { instrumentRef: payload.instrumentRef }), ...(payload.sourceSystem === undefined ? {} : { sourceSystem: payload.sourceSystem }),
      ...(payload.sourceRecordId === undefined ? {} : { sourceRecordId: payload.sourceRecordId }), ...(payload.sourceDocumentRef === undefined ? {} : { sourceDocumentRef: payload.sourceDocumentRef }), ...(payload.quality === undefined ? {} : { quality: payload.quality }),
      ...(payload.verificationStatus === undefined ? {} : { verificationStatus: payload.verificationStatus }), ...(payload.metadata === undefined ? {} : { metadata: payload.metadata }), updatedAt: new Date(),
    }).where(eq(energyEmissionMeasurements.id, measurementId)).returning();
    return NextResponse.json({ item: updated ? { ...updated, value: Number(updated.value) } : null });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Measurement không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật measurement.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { measurementId } = await context.params;
  const [updated] = await db.update(energyEmissionMeasurements).set({ verificationStatus: 'ARCHIVED', updatedAt: new Date() }).where(eq(energyEmissionMeasurements.id, measurementId)).returning({ id: energyEmissionMeasurements.id, verificationStatus: energyEmissionMeasurements.verificationStatus });
  return updated ? NextResponse.json({ item: updated, archived: true }) : NextResponse.json({ message: 'Không tìm thấy measurement.' }, { status: 404 });
}

function dateOrNull(value: string | null | undefined) { return value ? new Date(value) : null; }
