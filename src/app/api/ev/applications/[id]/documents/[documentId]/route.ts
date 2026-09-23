import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyEvApplicationDocuments } from '@/db/schema';
import { evApplicationDocumentPatchSchema } from '@/lib/ev-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string; documentId: string }> };

function invalidId(id: string) {
  return !z.string().uuid().safeParse(id).success;
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id, documentId } = await context.params;
    if (invalidId(id) || invalidId(documentId)) return NextResponse.json({ message: 'Mã hồ sơ hoặc tài liệu không hợp lệ.' }, { status: 400 });
    const payload = evApplicationDocumentPatchSchema.parse(await request.json());
    const [existing] = await db.select().from(energyEvApplicationDocuments).where(and(eq(energyEvApplicationDocuments.id, documentId), eq(energyEvApplicationDocuments.applicationId, id))).limit(1);
    if (!existing) return NextResponse.json({ message: 'Không tìm thấy tài liệu hồ sơ.' }, { status: 404 });
    const [updated] = await db.update(energyEvApplicationDocuments).set({
      documentType: payload.documentType ?? existing.documentType,
      documentRef: payload.documentRef ?? existing.documentRef,
      title: payload.title === undefined ? existing.title : payload.title,
      version: payload.version ?? existing.version,
      status: payload.status ?? existing.status,
      uploadedAt: payload.uploadedAt === undefined ? existing.uploadedAt : payload.uploadedAt ? new Date(payload.uploadedAt) : new Date(),
      uploadedBy: payload.uploadedBy === undefined ? existing.uploadedBy : payload.uploadedBy,
      checksum: payload.checksum === undefined ? existing.checksum : payload.checksum,
      notes: payload.notes === undefined ? existing.notes : payload.notes,
      metadata: payload.metadata ?? existing.metadata,
    }).where(and(eq(energyEvApplicationDocuments.id, documentId), eq(energyEvApplicationDocuments.applicationId, id))).returning();
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Tài liệu hồ sơ không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật tài liệu.' }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { id, documentId } = await context.params;
    if (invalidId(id) || invalidId(documentId)) return NextResponse.json({ message: 'Mã hồ sơ hoặc tài liệu không hợp lệ.' }, { status: 400 });
    const actor = new URL(request.url).searchParams.get('actor') ?? 'SYSTEM';
    const [updated] = await db.update(energyEvApplicationDocuments).set({ status: 'ARCHIVED', notes: `Archived by ${actor}.` }).where(and(eq(energyEvApplicationDocuments.id, documentId), eq(energyEvApplicationDocuments.applicationId, id))).returning();
    if (!updated) return NextResponse.json({ message: 'Không tìm thấy tài liệu hồ sơ.' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể archive tài liệu.' }, { status: 400 });
  }
}
