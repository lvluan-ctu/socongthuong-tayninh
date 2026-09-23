import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energySafetyInspectionMedia } from '@/db/schema';
import { db } from '@/lib/db';
import { safetyInspectionMediaPatchSchema } from '@/lib/safety-schemas';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ inspectionId: string; mediaId: string }> };
const paramsSchema = z.object({ inspectionId: z.string().uuid(), mediaId: z.string().uuid() });

function parseDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { inspectionId, mediaId } = paramsSchema.parse(await context.params);
    const [item] = await db.select({
      id: energySafetyInspectionMedia.id,
      inspectionId: energySafetyInspectionMedia.inspectionId,
      mediaType: energySafetyInspectionMedia.mediaType,
      title: energySafetyInspectionMedia.title,
      fileRef: energySafetyInspectionMedia.fileRef,
      sourceUrl: energySafetyInspectionMedia.sourceUrl,
      checksum: energySafetyInspectionMedia.checksum,
      status: energySafetyInspectionMedia.status,
      capturedAt: energySafetyInspectionMedia.capturedAt,
      bearingDeg: energySafetyInspectionMedia.bearingDeg,
      assetHint: energySafetyInspectionMedia.assetHint,
      notes: energySafetyInspectionMedia.notes,
      metadata: energySafetyInspectionMedia.metadata,
      createdAt: energySafetyInspectionMedia.createdAt,
      updatedAt: energySafetyInspectionMedia.updatedAt,
      geometry: sql<string | null>`CASE WHEN ${energySafetyInspectionMedia.location} IS NULL THEN NULL ELSE ST_AsGeoJSON(${energySafetyInspectionMedia.location}::geometry) END`,
    }).from(energySafetyInspectionMedia).where(sql`${energySafetyInspectionMedia.id} = ${mediaId} AND ${energySafetyInspectionMedia.inspectionId} = ${inspectionId}`).limit(1);
    if (!item) return NextResponse.json({ message: 'Inspection media not found.' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Inspection/media ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load inspection media.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { inspectionId, mediaId } = paramsSchema.parse(await context.params);
    const payload = safetyInspectionMediaPatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) return NextResponse.json({ message: 'No fields to update.' }, { status: 400 });
    const [existing] = await db.select().from(energySafetyInspectionMedia).where(sql`${energySafetyInspectionMedia.id} = ${mediaId} AND ${energySafetyInspectionMedia.inspectionId} = ${inspectionId}`).limit(1);
    if (!existing) return NextResponse.json({ message: 'Inspection media not found.' }, { status: 404 });
    const hasLocation = Object.prototype.hasOwnProperty.call(payload, 'latitude') || Object.prototype.hasOwnProperty.call(payload, 'longitude');
    if (hasLocation && ((payload.latitude == null) !== (payload.longitude == null))) return NextResponse.json({ message: 'Media location needs latitude and longitude together.', issues: [{ path: ['longitude'], message: 'Provide both coordinates.' }] }, { status: 400 });
    await db.update(energySafetyInspectionMedia).set({
      ...(payload.mediaType !== undefined ? { mediaType: payload.mediaType } : {}),
      ...(payload.title !== undefined ? { title: payload.title } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'fileRef') ? { fileRef: payload.fileRef ?? null } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'sourceUrl') ? { sourceUrl: payload.sourceUrl ?? null } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'checksum') ? { checksum: payload.checksum ?? null } : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'capturedAt') ? { capturedAt: parseDate(payload.capturedAt) } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'bearingDeg') ? { bearingDeg: payload.bearingDeg == null ? null : String(payload.bearingDeg) } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'assetHint') ? { assetHint: payload.assetHint ?? null } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'notes') ? { notes: payload.notes ?? null } : {}),
      ...(payload.metadata !== undefined ? { metadata: payload.metadata } : {}),
      updatedAt: new Date(),
    }).where(eq(energySafetyInspectionMedia.id, mediaId));
    if (hasLocation) {
      await db.execute(sql`UPDATE energy_safety_inspection_media SET location = CASE WHEN ${payload.latitude == null ? null : `SRID=4326;POINT(${payload.longitude} ${payload.latitude})`}::text IS NULL THEN NULL ELSE ST_GeogFromText(${payload.latitude == null ? null : `SRID=4326;POINT(${payload.longitude} ${payload.latitude})`}::text) END, updated_at = CURRENT_TIMESTAMP WHERE id = ${mediaId}::uuid`);
    }
    return NextResponse.json({ item: mediaId });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Inspection media is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not update inspection media.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { inspectionId, mediaId } = paramsSchema.parse(await context.params);
    const [updated] = await db.update(energySafetyInspectionMedia).set({ status: 'ARCHIVED', updatedAt: new Date() }).where(sql`${energySafetyInspectionMedia.id} = ${mediaId} AND ${energySafetyInspectionMedia.inspectionId} = ${inspectionId}`).returning({ id: energySafetyInspectionMedia.id });
    if (!updated) return NextResponse.json({ message: 'Inspection media not found.' }, { status: 404 });
    return NextResponse.json({ deleted: true, archived: true, mediaId });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Inspection/media ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not archive inspection media.' }, { status: 400 });
  }
}
