import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyConsumerClassificationHistory, energyConsumers } from '@/db/schema';
import { db } from '@/lib/db';
import { classificationHistoryPatchSchema } from '@/lib/efficiency-schemas';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ consumerId: string; historyId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { consumerId, historyId } = await context.params;
    z.string().uuid().parse(consumerId);
    z.string().uuid().parse(historyId);
    const payload = classificationHistoryPatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) return NextResponse.json({ message: 'Không có trường nào để cập nhật.' }, { status: 400 });

    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(energyConsumerClassificationHistory).where(and(
        eq(energyConsumerClassificationHistory.id, historyId),
        eq(energyConsumerClassificationHistory.consumerId, consumerId),
      )).limit(1);
      if (!existing) throw new Error('Không tìm thấy bản ghi lịch sử phân loại.');
      const nextStatus = payload.status ?? existing.status;
      const nextGroup = payload.consumerGroup ?? existing.consumerGroup;
      const nextImportance = payload.importanceLevel ?? existing.importanceLevel;
      const nextValidFrom = payload.validFrom ? new Date(payload.validFrom) : existing.validFrom;
      const hasEvidence = Boolean(payload.sourceDocumentNo || payload.sourceDocumentRef || existing.sourceDocumentNo || existing.sourceDocumentRef);
      if (nextStatus === 'ACTIVE' && !hasEvidence) throw new Error('Bản ghi ACTIVE phải có văn bản hoặc nguồn làm căn cứ.');
      if (payload.validTo && new Date(payload.validTo).getTime() < nextValidFrom.getTime()) throw new Error('Ngày kết thúc phải sau ngày bắt đầu.');

      if (nextStatus === 'ACTIVE') {
        await tx.update(energyConsumerClassificationHistory).set({ status: 'SUPERSEDED', validTo: nextValidFrom })
          .where(and(eq(energyConsumerClassificationHistory.consumerId, consumerId), eq(energyConsumerClassificationHistory.status, 'ACTIVE')));
      }
      const [row] = await tx.update(energyConsumerClassificationHistory).set({
        ...(payload.consumerGroup ? { consumerGroup: payload.consumerGroup } : {}),
        ...(payload.importanceLevel ? { importanceLevel: payload.importanceLevel } : {}),
        ...(payload.validFrom ? { validFrom: nextValidFrom } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'validTo') ? { validTo: payload.validTo ? new Date(payload.validTo) : null } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'sourceDocumentNo') ? { sourceDocumentNo: payload.sourceDocumentNo ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'sourceDocumentRef') ? { sourceDocumentRef: payload.sourceDocumentRef ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'issuedBy') ? { issuedBy: payload.issuedBy ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'reason') ? { reason: payload.reason ?? null } : {}),
        ...(payload.status ? { status: payload.status } : {}),
      }).where(and(
        eq(energyConsumerClassificationHistory.id, historyId),
        eq(energyConsumerClassificationHistory.consumerId, consumerId),
      )).returning();

      if (nextStatus === 'ACTIVE') {
        await tx.update(energyConsumers).set({
          consumerGroup: nextGroup,
          importanceLevel: nextImportance,
          classification: nextImportance,
        }).where(eq(energyConsumers.id, consumerId));
      }
      return row;
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Bản ghi phân loại không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật lịch sử phân loại.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { consumerId, historyId } = await context.params;
    z.string().uuid().parse(consumerId);
    z.string().uuid().parse(historyId);
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(energyConsumerClassificationHistory).where(and(
        eq(energyConsumerClassificationHistory.id, historyId),
        eq(energyConsumerClassificationHistory.consumerId, consumerId),
      )).limit(1);
      if (!existing) return null;
      if (existing.status === 'ACTIVE') {
        const [fallback] = await tx.select().from(energyConsumerClassificationHistory).where(and(
          eq(energyConsumerClassificationHistory.consumerId, consumerId),
          eq(energyConsumerClassificationHistory.status, 'SUPERSEDED'),
        )).orderBy(desc(energyConsumerClassificationHistory.validFrom)).limit(1);
        if (!fallback) throw new Error('Không thể xóa bản ghi phân loại ACTIVE duy nhất; hãy tạo phân loại thay thế trước.');
        await tx.update(energyConsumers).set({
          consumerGroup: fallback.consumerGroup,
          importanceLevel: fallback.importanceLevel,
          classification: fallback.importanceLevel,
        }).where(eq(energyConsumers.id, consumerId));
      }
      await tx.update(energyConsumerClassificationHistory).set({ status: 'REVOKED', validTo: new Date() })
        .where(eq(energyConsumerClassificationHistory.id, historyId));
      return existing;
    });
    if (!result) return NextResponse.json({ message: 'Không tìm thấy bản ghi lịch sử phân loại.' }, { status: 404 });
    return NextResponse.json({ deleted: true, historyId, message: 'Bản ghi phân loại đã được REVOKED để bảo toàn lịch sử.' });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Mã bản ghi không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể thu hồi bản ghi phân loại.' }, { status: 400 });
  }
}
