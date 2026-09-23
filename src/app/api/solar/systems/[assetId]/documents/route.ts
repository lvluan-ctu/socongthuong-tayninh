import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyRooftopSystemDocuments, energyRooftopSystems } from '@/db/schema';
import { rooftopDocumentSchema } from '@/lib/solar-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ assetId: string }> };

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
function clean(value: string | null | undefined) { return value?.trim() || null; }

async function assertSystem(assetId: string) {
  const [system] = await db.select({ assetId: energyRooftopSystems.assetId }).from(energyRooftopSystems).where(eq(energyRooftopSystems.assetId, assetId)).limit(1);
  return system ?? null;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { assetId } = await context.params;
    if (!await assertSystem(assetId)) return NextResponse.json({ message: 'Không tìm thấy hệ rooftop.' }, { status: 404 });
    const items = await db.select().from(energyRooftopSystemDocuments).where(eq(energyRooftopSystemDocuments.systemAssetId, assetId)).orderBy(desc(energyRooftopSystemDocuments.issuedAt), desc(energyRooftopSystemDocuments.createdAt));
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải hồ sơ hệ rooftop.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { assetId } = await context.params;
    if (!await assertSystem(assetId)) return NextResponse.json({ message: 'Không tìm thấy hệ rooftop.' }, { status: 404 });
    const payload = rooftopDocumentSchema.parse(await request.json());
    const [item] = await db.insert(energyRooftopSystemDocuments).values({
      systemAssetId: assetId,
      documentType: payload.documentType,
      documentNo: clean(payload.documentNo),
      title: payload.title,
      issuedAt: parseDate(payload.issuedAt),
      fileRef: clean(payload.fileRef),
      source: payload.source,
      sourceRef: clean(payload.sourceRef),
      notes: clean(payload.notes),
    }).returning();
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin hồ sơ không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu hồ sơ hệ rooftop.' }, { status: 400 });
  }
}
