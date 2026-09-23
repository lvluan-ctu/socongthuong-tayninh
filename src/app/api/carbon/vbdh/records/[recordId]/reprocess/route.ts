import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { energyVbdhRecords } from '@/db/schema';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ recordId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { recordId } = await context.params;
  const [current] = await db.select({ id: energyVbdhRecords.id, validationStatus: energyVbdhRecords.validationStatus }).from(energyVbdhRecords).where(eq(energyVbdhRecords.id, recordId)).limit(1);
  if (!current) return NextResponse.json({ message: 'Không tìm thấy VBDH raw record.' }, { status: 404 });
  if (current.validationStatus === 'MAPPED') return NextResponse.json({ message: 'Record đã map; không reprocess đè lên audit trail.' }, { status: 409 });
  const [updated] = await db.update(energyVbdhRecords).set({ validationStatus: 'NEEDS_REVIEW', errorMessage: null, updatedAt: new Date() }).where(eq(energyVbdhRecords.id, recordId)).returning();
  return NextResponse.json({ item: updated, warnings: ['RAW_REPROCESS_ONLY: raw payload được giữ nguyên; cần map lại có kiểm soát.'] });
}
