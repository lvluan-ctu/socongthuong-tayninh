import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyRooftopSystemDocuments } from '@/db/schema';
import { rooftopDocumentSchema } from '@/lib/solar-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ assetId: string; documentId: string }> };

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
function clean(value: string | null | undefined) { return value?.trim() || null; }

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { assetId, documentId } = await context.params;
    const payload = rooftopDocumentSchema.partial().parse(await request.json());
    const [existing] = await db.select().from(energyRooftopSystemDocuments).where(eq(energyRooftopSystemDocuments.id, documentId)).limit(1);
    if (!existing || existing.systemAssetId !== assetId) return NextResponse.json({ message: 'Không tìm thấy hồ sơ hệ rooftop.' }, { status: 404 });
    const [item] = await db.update(energyRooftopSystemDocuments).set({
      ...(payload.documentType ? { documentType: payload.documentType } : {}),
      ...(payload.title ? { title: payload.title } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'documentNo') ? { documentNo: clean(payload.documentNo) } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'issuedAt') ? { issuedAt: parseDate(payload.issuedAt) } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'fileRef') ? { fileRef: clean(payload.fileRef) } : {}),
      ...(payload.source ? { source: payload.source } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'sourceRef') ? { sourceRef: clean(payload.sourceRef) } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'notes') ? { notes: clean(payload.notes) } : {}),
      updatedAt: new Date(),
    }).where(eq(energyRooftopSystemDocuments.id, documentId)).returning();
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin hồ sơ không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật hồ sơ.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { assetId, documentId } = await context.params;
    const [existing] = await db.select({ id: energyRooftopSystemDocuments.id, systemAssetId: energyRooftopSystemDocuments.systemAssetId }).from(energyRooftopSystemDocuments).where(eq(energyRooftopSystemDocuments.id, documentId)).limit(1);
    if (!existing || existing.systemAssetId !== assetId) return NextResponse.json({ message: 'Không tìm thấy hồ sơ hệ rooftop.' }, { status: 404 });
    await db.delete(energyRooftopSystemDocuments).where(eq(energyRooftopSystemDocuments.id, documentId));
    return NextResponse.json({ deleted: true, assetId });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể xóa hồ sơ.' }, { status: 400 });
  }
}
