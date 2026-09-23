import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  energyConsumers,
  energyCustomerAccounts,
  energyDataSources,
  energyMeterEvents,
  energySites,
  energySmartMeters,
} from '@/db/schema';
import { db } from '@/lib/db';
import { smartMeterPatchSchema } from '@/lib/efficiency-schemas';
import { loadMeter, resolveMeterMeasurementPoint, serializeMeter } from '@/server/efficiency/meter';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ meterId: string }> };

function dateOrNull(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Ngày/giờ công tơ không hợp lệ.');
  return date;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { meterId } = await context.params;
    z.string().uuid().parse(meterId);
    const meter = await loadMeter(meterId);
    if (!meter) return NextResponse.json({ message: 'Không tìm thấy công tơ.' }, { status: 404 });
    const events = await db.select().from(energyMeterEvents).where(eq(energyMeterEvents.smartMeterId, meterId)).orderBy(energyMeterEvents.eventAt);
    return NextResponse.json({ item: serializeMeter({ ...meter, events }) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Mã công tơ không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải hồ sơ công tơ.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { meterId } = await context.params;
    z.string().uuid().parse(meterId);
    const payload = smartMeterPatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) return NextResponse.json({ message: 'Không có trường nào để cập nhật.' }, { status: 400 });

    await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(energySmartMeters).where(eq(energySmartMeters.id, meterId)).limit(1);
      if (!existing) throw new Error('Không tìm thấy công tơ.');

      const meterCode = payload.meterCode ?? existing.meterCode;
      if (meterCode !== existing.meterCode) {
        const [duplicate] = await tx.select({ id: energySmartMeters.id }).from(energySmartMeters).where(and(
          eq(energySmartMeters.meterCode, meterCode),
        )).limit(1);
        if (duplicate) throw new Error(`Mã công tơ ${meterCode} đã tồn tại.`);
      }

      let consumerId = existing.consumerId;
      let customerAccountId = existing.customerAccountId;
      let siteId = existing.siteId;
      if (Object.prototype.hasOwnProperty.call(payload, 'customerAccountId')) {
        customerAccountId = payload.customerAccountId ?? null;
        if (customerAccountId) {
          const [account] = await tx.select({ id: energyCustomerAccounts.id, siteId: energyCustomerAccounts.siteId }).from(energyCustomerAccounts)
            .where(eq(energyCustomerAccounts.id, customerAccountId)).limit(1);
          if (!account) throw new Error('Không tìm thấy tài khoản EVN của công tơ.');
          if (!Object.prototype.hasOwnProperty.call(payload, 'siteId')) siteId = account.siteId ?? null;
          if (!Object.prototype.hasOwnProperty.call(payload, 'consumerId')) {
            const [consumer] = await tx.select({ id: energyConsumers.id }).from(energyConsumers)
              .where(eq(energyConsumers.customerAccountId, customerAccountId)).limit(1);
            consumerId = consumer?.id ?? null;
          }
        } else if (!Object.prototype.hasOwnProperty.call(payload, 'consumerId')) {
          consumerId = null;
        }
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'consumerId')) {
        consumerId = payload.consumerId ?? null;
        if (consumerId) {
          const [consumer] = await tx.select({ id: energyConsumers.id, customerAccountId: energyConsumers.customerAccountId }).from(energyConsumers)
            .where(eq(energyConsumers.id, consumerId)).limit(1);
          if (!consumer) throw new Error('Không tìm thấy đơn vị sử dụng năng lượng của công tơ.');
          if (customerAccountId && consumer.customerAccountId && consumer.customerAccountId !== customerAccountId) throw new Error('Tài khoản EVN và đơn vị sử dụng năng lượng không khớp.');
          if (!customerAccountId) customerAccountId = consumer.customerAccountId ?? null;
        }
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'siteId')) {
        siteId = payload.siteId ?? null;
        if (siteId) {
          const [site] = await tx.select({ id: energySites.id }).from(energySites).where(eq(energySites.id, siteId)).limit(1);
          if (!site) throw new Error('Không tìm thấy cơ sở/site của công tơ.');
        }
      }
      if (payload.sourceId) {
        const [source] = await tx.select({ id: energyDataSources.id }).from(energyDataSources).where(eq(energyDataSources.id, payload.sourceId)).limit(1);
        if (!source) throw new Error('Không tìm thấy data source của công tơ.');
      }

      const measurementPointId = Object.prototype.hasOwnProperty.call(payload, 'measurementPointId')
        ? payload.measurementPointId
          ? (await resolveMeterMeasurementPoint(tx, payload.measurementPointId, meterCode, payload.provider ?? existing.provider)).id
          : null
        : existing.measurementPointId;

      await tx.update(energySmartMeters).set({
        ...(Object.prototype.hasOwnProperty.call(payload, 'consumerId') || Object.prototype.hasOwnProperty.call(payload, 'customerAccountId') ? { consumerId, customerAccountId } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'siteId') || Object.prototype.hasOwnProperty.call(payload, 'customerAccountId') ? { siteId } : {}),
        ...(payload.measurementPointId !== undefined ? { measurementPointId } : {}),
        ...(payload.meterCode ? { meterCode: payload.meterCode } : {}),
        ...(payload.provider ? { provider: payload.provider } : {}),
        ...(payload.meterType ? { meterType: payload.meterType } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'manufacturer') ? { manufacturer: payload.manufacturer ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'model') ? { model: payload.model ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'serialNumber') ? { serialNumber: payload.serialNumber ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'phaseType') ? { phaseType: payload.phaseType ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'voltageLevelKv') ? { voltageLevelKv: payload.voltageLevelKv == null ? null : String(payload.voltageLevelKv) } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'installedAt') ? { installedAt: dateOrNull(payload.installedAt) } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'commissionedAt') ? { commissionedAt: dateOrNull(payload.commissionedAt) } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'lastInspectionAt') ? { lastInspectionAt: dateOrNull(payload.lastInspectionAt) } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'nextInspectionDueAt') ? { nextInspectionDueAt: dateOrNull(payload.nextInspectionDueAt) } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'replacementDueAt') ? { replacementDueAt: dateOrNull(payload.replacementDueAt) } : {}),
        ...(payload.status ? { status: payload.status } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'communicationType') ? { communicationType: payload.communicationType ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'sourceId') ? { sourceId: payload.sourceId ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'sourceRef') ? { sourceRef: payload.sourceRef ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'confidence') ? { confidence: payload.confidence == null ? null : String(payload.confidence) } : {}),
        ...(payload.metadata ? { metadata: payload.metadata } : {}),
        updatedAt: new Date(),
      }).where(eq(energySmartMeters.id, meterId));
    });
    const meter = await loadMeter(meterId);
    return NextResponse.json({ item: meter ? serializeMeter(meter) : null });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin công tơ không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật công tơ.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { meterId } = await context.params;
    z.string().uuid().parse(meterId);
    const [updated] = await db.update(energySmartMeters).set({ status: 'ARCHIVED', updatedAt: new Date() })
      .where(eq(energySmartMeters.id, meterId)).returning({ id: energySmartMeters.id });
    if (!updated) return NextResponse.json({ message: 'Không tìm thấy công tơ.' }, { status: 404 });
    return NextResponse.json({ deleted: true, meterId, message: 'Công tơ đã được chuyển sang ARCHIVED để bảo toàn chuỗi đo.' });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Mã công tơ không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu trạng thái công tơ.' }, { status: 400 });
  }
}
