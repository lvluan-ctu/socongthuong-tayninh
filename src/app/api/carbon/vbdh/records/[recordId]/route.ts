import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyVbdhRecords } from '@/db/schema';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ recordId: string }> };
const reviewSchema = z.object({ validationStatus: z.enum(['NEEDS_REVIEW', 'REJECTED']), errorMessage: z.string().trim().max(2000).nullable().optional() });

export async function GET(_request: Request, context: RouteContext) {
  const { recordId } = await context.params;
  const [row] = await db.select().from(energyVbdhRecords).where(eq(energyVbdhRecords.id, recordId)).limit(1);
  return row ? NextResponse.json({ item: row }) : NextResponse.json({ message: 'Không tìm thấy VBDH raw record.' }, { status: 404 });
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { recordId } = await context.params;
    const payload = reviewSchema.parse(await request.json());
    const [current] = await db.select({ id: energyVbdhRecords.id, validationStatus: energyVbdhRecords.validationStatus }).from(energyVbdhRecords).where(eq(energyVbdhRecords.id, recordId)).limit(1);
    if (!current) return NextResponse.json({ message: 'Không tìm thấy VBDH raw record.' }, { status: 404 });
    if (current.validationStatus === 'MAPPED') return NextResponse.json({ message: 'Record đã map, không thể sửa trạng thái trực tiếp.' }, { status: 409 });
    const [updated] = await db.update(energyVbdhRecords).set({ validationStatus: payload.validationStatus, errorMessage: payload.errorMessage ?? null, updatedAt: new Date() }).where(eq(energyVbdhRecords.id, recordId)).returning();
    return NextResponse.json({ item: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Trạng thái VBDH không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật VBDH raw record.' }, { status: 400 });
  }
}
