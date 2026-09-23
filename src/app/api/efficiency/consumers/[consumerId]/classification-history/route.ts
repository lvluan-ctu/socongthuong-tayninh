import { and, asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyConsumerClassificationHistory, energyConsumers } from '@/db/schema';
import { db } from '@/lib/db';
import { classificationHistorySchema } from '@/lib/efficiency-schemas';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ consumerId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { consumerId } = await context.params;
    z.string().uuid().parse(consumerId);
    const [consumer] = await db.select({ id: energyConsumers.id }).from(energyConsumers).where(eq(energyConsumers.id, consumerId)).limit(1);
    if (!consumer) return NextResponse.json({ message: 'Không tìm thấy đơn vị sử dụng năng lượng.' }, { status: 404 });
    const items = await db.select().from(energyConsumerClassificationHistory)
      .where(eq(energyConsumerClassificationHistory.consumerId, consumerId))
      .orderBy(asc(energyConsumerClassificationHistory.validFrom));
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Mã đơn vị không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải lịch sử phân loại.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { consumerId } = await context.params;
    z.string().uuid().parse(consumerId);
    const payload = classificationHistorySchema.parse(await request.json());
    const result = await db.transaction(async (tx) => {
      const [consumer] = await tx.select({ id: energyConsumers.id }).from(energyConsumers).where(eq(energyConsumers.id, consumerId)).limit(1);
      if (!consumer) throw new Error('Không tìm thấy đơn vị sử dụng năng lượng.');
      if (payload.status === 'ACTIVE') {
        await tx.update(energyConsumerClassificationHistory).set({
          status: 'SUPERSEDED',
          validTo: new Date(payload.validFrom),
        }).where(and(
          eq(energyConsumerClassificationHistory.consumerId, consumerId),
          eq(energyConsumerClassificationHistory.status, 'ACTIVE'),
        ));
      }
      const [created] = await tx.insert(energyConsumerClassificationHistory).values({
        consumerId,
        consumerGroup: payload.consumerGroup,
        importanceLevel: payload.importanceLevel,
        validFrom: new Date(payload.validFrom),
        validTo: payload.validTo ? new Date(payload.validTo) : null,
        sourceDocumentNo: payload.sourceDocumentNo ?? null,
        sourceDocumentRef: payload.sourceDocumentRef ?? null,
        issuedBy: payload.issuedBy ?? null,
        reason: payload.reason ?? null,
        status: payload.status,
      }).returning();
      if (payload.status === 'ACTIVE') {
        await tx.update(energyConsumers).set({
          consumerGroup: payload.consumerGroup,
          importanceLevel: payload.importanceLevel,
          classification: payload.importanceLevel,
        }).where(eq(energyConsumers.id, consumerId));
      }
      return created;
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Căn cứ phân loại không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể ghi lịch sử phân loại.' }, { status: 400 });
  }
}
