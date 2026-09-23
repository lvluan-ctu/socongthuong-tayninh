import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  energyConsumerClassificationHistory,
  energyConsumers,
  energyCustomerAccounts,
  energyParties,
  energySites,
  energySmartMeters,
} from '@/db/schema';
import { db } from '@/lib/db';
import { consumerPatchSchema } from '@/lib/efficiency-schemas';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ consumerId: string }> };

function nullable(value: string | null | undefined) {
  return value == null || value.trim() === '' ? null : value.trim();
}

function pointFromCoordinates(latitude: number | null | undefined, longitude: number | null | undefined) {
  return latitude != null && longitude != null ? `SRID=4326;POINT(${longitude} ${latitude})` : null;
}

async function loadConsumer(consumerId: string) {
  const [consumer] = await db.select({
    id: energyConsumers.id,
    partyId: energyConsumers.partyId,
    siteId: energyConsumers.siteId,
    customerAccountId: energyConsumers.customerAccountId,
    classification: energyConsumers.classification,
    consumerGroup: energyConsumers.consumerGroup,
    importanceLevel: energyConsumers.importanceLevel,
    sector: energyConsumers.sector,
    industryZoneCode: energyConsumers.industryZoneCode,
    reportingRequired: energyConsumers.reportingRequired,
    status: energyConsumers.status,
    partyCode: energyParties.code,
    partyName: energyParties.name,
    partyAddress: energyParties.address,
    partyAdminAreaCode: energyParties.adminAreaCode,
    siteAddress: energySites.address,
    siteAdminAreaCode: energySites.adminAreaCode,
    latitude: sql<number | null>`CASE WHEN ${energySites.location} IS NULL THEN NULL ELSE ST_Y(${energySites.location}::geometry) END`,
    longitude: sql<number | null>`CASE WHEN ${energySites.location} IS NULL THEN NULL ELSE ST_X(${energySites.location}::geometry) END`,
    customerCode: energyCustomerAccounts.customerCode,
  }).from(energyConsumers)
    .innerJoin(energyParties, eq(energyParties.id, energyConsumers.partyId))
    .leftJoin(energySites, eq(energySites.id, energyConsumers.siteId))
    .leftJoin(energyCustomerAccounts, eq(energyCustomerAccounts.id, energyConsumers.customerAccountId))
    .where(eq(energyConsumers.id, consumerId)).limit(1);
  if (!consumer) return null;
  const [history, meters] = await Promise.all([
    db.select().from(energyConsumerClassificationHistory)
      .where(eq(energyConsumerClassificationHistory.consumerId, consumerId))
      .orderBy(energyConsumerClassificationHistory.validFrom),
    db.select({
      id: energySmartMeters.id,
      meterCode: energySmartMeters.meterCode,
      status: energySmartMeters.status,
      measurementPointId: energySmartMeters.measurementPointId,
    }).from(energySmartMeters).where(eq(energySmartMeters.consumerId, consumerId)),
  ]);
  return { ...consumer, history, meters };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { consumerId } = await context.params;
    z.string().uuid().parse(consumerId);
    const consumer = await loadConsumer(consumerId);
    if (!consumer) return NextResponse.json({ message: 'Không tìm thấy đơn vị sử dụng năng lượng.' }, { status: 404 });
    return NextResponse.json({ consumer });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Mã đơn vị không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải hồ sơ đơn vị.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { consumerId } = await context.params;
    z.string().uuid().parse(consumerId);
    const payload = consumerPatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) return NextResponse.json({ message: 'Không có trường nào để cập nhật.' }, { status: 400 });

    await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(energyConsumers).where(eq(energyConsumers.id, consumerId)).limit(1);
      if (!existing) throw new Error('Không tìm thấy đơn vị sử dụng năng lượng.');

      let nextCustomerAccountId = existing.customerAccountId;
      let nextSiteId = existing.siteId;
      if (Object.prototype.hasOwnProperty.call(payload, 'customerAccountId')) {
        if (payload.customerAccountId) {
          const [account] = await tx.select({ id: energyCustomerAccounts.id, partyId: energyCustomerAccounts.partyId, siteId: energyCustomerAccounts.siteId })
            .from(energyCustomerAccounts).where(eq(energyCustomerAccounts.id, payload.customerAccountId)).limit(1);
          if (!account) throw new Error('Không tìm thấy tài khoản EVN được chọn.');
          const [duplicate] = await tx.select({ id: energyConsumers.id }).from(energyConsumers)
            .where(eq(energyConsumers.customerAccountId, payload.customerAccountId)).limit(1);
          if (duplicate && duplicate.id !== consumerId) throw new Error('Tài khoản EVN này đã thuộc một đơn vị khác.');
          nextCustomerAccountId = account.id;
          nextSiteId = account.siteId ?? null;
        } else {
          nextCustomerAccountId = null;
        }
      }

      const nextGroup = payload.consumerGroup ?? existing.consumerGroup;
      const nextImportance = payload.importanceLevel ?? existing.importanceLevel;
      const classificationChanged = nextGroup !== existing.consumerGroup || nextImportance !== existing.importanceLevel;
      const hasClassificationEvidence = Boolean(payload.classificationSourceDocumentNo || payload.classificationSourceDocumentRef);
      if (classificationChanged && !hasClassificationEvidence) {
        throw new Error('Mọi thay đổi phân loại phải có số hoặc đường dẫn văn bản làm căn cứ.');
      }

      const hasPartyCode = Object.prototype.hasOwnProperty.call(payload, 'partyCode');
      const hasPartyName = Object.prototype.hasOwnProperty.call(payload, 'partyName');
      const hasAddress = Object.prototype.hasOwnProperty.call(payload, 'address');
      const hasAdminAreaCode = Object.prototype.hasOwnProperty.call(payload, 'adminAreaCode');
      const hasCoordinates = Object.prototype.hasOwnProperty.call(payload, 'latitude')
        || Object.prototype.hasOwnProperty.call(payload, 'longitude');
      if (hasPartyCode && !payload.partyCode) throw new Error('Mã đơn vị không được để trống.');
      if (hasPartyCode && payload.partyCode) {
        const [duplicateParty] = await tx.select({ id: energyParties.id }).from(energyParties)
          .where(eq(energyParties.code, payload.partyCode)).limit(1);
        if (duplicateParty && duplicateParty.id !== existing.partyId) throw new Error('Mã đơn vị đã thuộc một party khác.');
      }

      await tx.update(energyConsumers).set({
        ...(Object.prototype.hasOwnProperty.call(payload, 'customerAccountId') ? { customerAccountId: nextCustomerAccountId, siteId: nextSiteId } : {}),
        ...(payload.classification !== undefined ? { classification: payload.classification ?? nextImportance } : (classificationChanged ? { classification: nextImportance } : {})),
        ...(payload.consumerGroup !== undefined ? { consumerGroup: payload.consumerGroup } : {}),
        ...(payload.importanceLevel !== undefined ? { importanceLevel: payload.importanceLevel } : {}),
        ...(payload.sector !== undefined ? { sector: payload.sector } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'industryZoneCode') ? { industryZoneCode: nullable(payload.industryZoneCode) } : {}),
        ...(payload.reportingRequired !== undefined ? { reportingRequired: payload.reportingRequired } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
      }).where(eq(energyConsumers.id, consumerId));

      await tx.update(energyParties).set({
        ...(hasPartyCode && payload.partyCode ? { code: payload.partyCode } : {}),
        ...(hasPartyName && payload.partyName ? { name: payload.partyName } : {}),
        ...(hasAddress ? { address: nullable(payload.address) } : {}),
        ...(hasAdminAreaCode ? { adminAreaCode: nullable(payload.adminAreaCode) } : {}),
        updatedAt: new Date(),
      }).where(eq(energyParties.id, existing.partyId));

      if (nextSiteId && (hasAddress || hasAdminAreaCode || hasCoordinates || payload.status !== undefined)) {
        await tx.update(energySites).set({
          ...(hasAddress ? { address: nullable(payload.address) } : {}),
          ...(hasAdminAreaCode ? { adminAreaCode: nullable(payload.adminAreaCode) } : {}),
          ...(hasCoordinates ? { location: pointFromCoordinates(payload.latitude, payload.longitude) } : {}),
          ...(payload.status ? { status: payload.status === 'ARCHIVED' ? 'INACTIVE' : payload.status } : {}),
          updatedAt: new Date(),
        }).where(eq(energySites.id, nextSiteId));
      }

      if (classificationChanged) {
        const validFrom = payload.classificationValidFrom ? new Date(payload.classificationValidFrom) : new Date();
        await tx.update(energyConsumerClassificationHistory).set({
          status: 'SUPERSEDED',
          validTo: validFrom,
        }).where(and(
          eq(energyConsumerClassificationHistory.consumerId, consumerId),
          eq(energyConsumerClassificationHistory.status, 'ACTIVE'),
        ));
        await tx.insert(energyConsumerClassificationHistory).values({
          consumerId,
          consumerGroup: nextGroup,
          importanceLevel: nextImportance,
          validFrom,
          sourceDocumentNo: nullable(payload.classificationSourceDocumentNo),
          sourceDocumentRef: nullable(payload.classificationSourceDocumentRef),
          issuedBy: nullable(payload.classificationIssuedBy),
          reason: nullable(payload.classificationReason) ?? 'Cập nhật phân loại theo căn cứ mới.',
          status: 'ACTIVE',
        });
      }
    });

    const consumer = await loadConsumer(consumerId);
    return NextResponse.json({ consumer });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin cập nhật không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật đơn vị.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { consumerId } = await context.params;
    z.string().uuid().parse(consumerId);
    const [updated] = await db.update(energyConsumers).set({ status: 'ARCHIVED' })
      .where(eq(energyConsumers.id, consumerId)).returning({ id: energyConsumers.id });
    if (!updated) return NextResponse.json({ message: 'Không tìm thấy đơn vị sử dụng năng lượng.' }, { status: 404 });
    return NextResponse.json({ deleted: true, consumerId, message: 'Đơn vị đã được chuyển sang ARCHIVED để bảo toàn lịch sử.' });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Mã đơn vị không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu trạng thái đơn vị.' }, { status: 400 });
  }
}
