import { desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energySafetyInspectionMedia, energySafetyInspections } from '@/db/schema';
import { db } from '@/lib/db';
import { safetyInspectionMediaSchema } from '@/lib/safety-schemas';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ inspectionId: string }> };
const paramsSchema = z.object({ inspectionId: z.string().uuid() });

function parseDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseGeoJson(value: unknown) {
  if (typeof value !== 'string') return value ?? null;
  try { return JSON.parse(value) as unknown; } catch { return null; }
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { inspectionId } = paramsSchema.parse(await context.params);
    const [inspection] = await db.select({ id: energySafetyInspections.id }).from(energySafetyInspections).where(eq(energySafetyInspections.id, inspectionId)).limit(1);
    if (!inspection) return NextResponse.json({ message: 'Inspection not found.' }, { status: 404 });
    const includeArchived = new URL(request.url).searchParams.get('includeArchived') === 'true';
    const rows = await db.select({
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
    }).from(energySafetyInspectionMedia).where(includeArchived ? eq(energySafetyInspectionMedia.inspectionId, inspectionId) : sql`${energySafetyInspectionMedia.inspectionId} = ${inspectionId} AND ${energySafetyInspectionMedia.status} <> 'ARCHIVED'`).orderBy(desc(energySafetyInspectionMedia.createdAt));
    return NextResponse.json({ items: rows.map((row) => ({ ...row, geometry: parseGeoJson(row.geometry) })) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Inspection ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load inspection media.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { inspectionId } = paramsSchema.parse(await context.params);
    const payload = safetyInspectionMediaSchema.parse(await request.json());
    if (!payload.fileRef && !payload.sourceUrl) return NextResponse.json({ message: 'Media needs a file reference or source URL.', issues: [{ path: ['sourceUrl'], message: 'Provide fileRef or sourceUrl.' }] }, { status: 400 });
    const [inspection] = await db.select({ id: energySafetyInspections.id }).from(energySafetyInspections).where(eq(energySafetyInspections.id, inspectionId)).limit(1);
    if (!inspection) return NextResponse.json({ message: 'Inspection not found.' }, { status: 404 });
    const coordinateCount = [payload.latitude, payload.longitude].filter((value) => value != null).length;
    if (coordinateCount === 1) return NextResponse.json({ message: 'Media location needs latitude and longitude together.', issues: [{ path: ['longitude'], message: 'Provide both coordinates.' }] }, { status: 400 });
    const [created] = await db.insert(energySafetyInspectionMedia).values({
      inspectionId,
      mediaType: payload.mediaType,
      title: payload.title,
      fileRef: payload.fileRef ?? null,
      sourceUrl: payload.sourceUrl ?? null,
      checksum: payload.checksum ?? null,
      status: payload.status,
      capturedAt: parseDate(payload.capturedAt),
      bearingDeg: payload.bearingDeg == null ? null : String(payload.bearingDeg),
      assetHint: payload.assetHint ?? null,
      location: payload.latitude != null && payload.longitude != null ? `SRID=4326;POINT(${payload.longitude} ${payload.latitude})` : null,
      notes: payload.notes ?? null,
      metadata: payload.metadata,
      updatedAt: new Date(),
    }).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Inspection media is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not create inspection media.' }, { status: 400 });
  }
}
