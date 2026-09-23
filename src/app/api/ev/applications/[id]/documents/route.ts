import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyEvApplicationDocuments, energyEvStationApplications } from '@/db/schema';
import { evApplicationDocumentSchema } from '@/lib/ev-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

function invalidId(id: string) {
  return !z.string().uuid().safeParse(id).success;
}

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (invalidId(id)) return NextResponse.json({ message: 'Mã hồ sơ không hợp lệ.' }, { status: 400 });
    const [application] = await db.select({ id: energyEvStationApplications.id }).from(energyEvStationApplications).where(eq(energyEvStationApplications.id, id)).limit(1);
    if (!application) return NextResponse.json({ message: 'Không tìm thấy hồ sơ đăng ký.' }, { status: 404 });
    const items = await db.select().from(energyEvApplicationDocuments).where(eq(energyEvApplicationDocuments.applicationId, id)).orderBy(desc(energyEvApplicationDocuments.createdAt));
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải tài liệu hồ sơ.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (invalidId(id)) return NextResponse.json({ message: 'Mã hồ sơ không hợp lệ.' }, { status: 400 });
    const payload = evApplicationDocumentSchema.parse(await request.json());
    const [application] = await db.select({ id: energyEvStationApplications.id }).from(energyEvStationApplications).where(eq(energyEvStationApplications.id, id)).limit(1);
    if (!application) return NextResponse.json({ message: 'Không tìm thấy hồ sơ đăng ký.' }, { status: 404 });
    const [created] = await db.transaction(async (tx) => {
      if (payload.status === 'ACTIVE') {
        await tx.update(energyEvApplicationDocuments).set({ status: 'SUPERSEDED' }).where(and(eq(energyEvApplicationDocuments.applicationId, id), eq(energyEvApplicationDocuments.documentType, payload.documentType)));
      }
      return tx.insert(energyEvApplicationDocuments).values({
        applicationId: id,
        documentType: payload.documentType,
        documentRef: payload.documentRef,
        title: payload.title ?? null,
        version: payload.version,
        status: payload.status,
        uploadedAt: payload.uploadedAt ? new Date(payload.uploadedAt) : new Date(),
        uploadedBy: payload.uploadedBy ?? null,
        checksum: payload.checksum ?? null,
        notes: payload.notes ?? null,
        metadata: payload.metadata,
      }).returning();
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Tài liệu hồ sơ không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu tài liệu hồ sơ.' }, { status: 400 });
  }
}
