import { and, count, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  energyConsumerReports,
  energyConsumers,
  energyCustomerAccounts,
  energyDataSources,
  energyMeasurementPoints,
  energyMeterEvents,
  energyParties,
  energySites,
  energySmartMeters,
} from '@/db/schema';
import { db } from '@/lib/db';
import { smartMeterSchema } from '@/lib/efficiency-schemas';
import { resolveMeterMeasurementPoint, serializeMeter } from '@/server/efficiency/meter';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

function dateOrNull(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Ngày/giờ công tơ không hợp lệ.');
  return date;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const consumerId = url.searchParams.get('consumerId');
    const status = url.searchParams.get('status');
    const wantsPagination = url.searchParams.get('options') !== 'true' && (url.searchParams.has('page') || url.searchParams.has('pageSize'));
    const pagination = parsePagination(url.searchParams);
    const conditions = [];
    if (consumerId) conditions.push(eq(energySmartMeters.consumerId, consumerId));
    if (status) conditions.push(eq(energySmartMeters.status, status));
    const listQuery = db.select({
      id: energySmartMeters.id,
      consumerId: energySmartMeters.consumerId,
      siteId: energySmartMeters.siteId,
      customerAccountId: energySmartMeters.customerAccountId,
      measurementPointId: energySmartMeters.measurementPointId,
      meterCode: energySmartMeters.meterCode,
      provider: energySmartMeters.provider,
      meterType: energySmartMeters.meterType,
      manufacturer: energySmartMeters.manufacturer,
      model: energySmartMeters.model,
      serialNumber: energySmartMeters.serialNumber,
      phaseType: energySmartMeters.phaseType,
      voltageLevelKv: energySmartMeters.voltageLevelKv,
      installedAt: energySmartMeters.installedAt,
      commissionedAt: energySmartMeters.commissionedAt,
      lastInspectionAt: energySmartMeters.lastInspectionAt,
      nextInspectionDueAt: energySmartMeters.nextInspectionDueAt,
      replacementDueAt: energySmartMeters.replacementDueAt,
      status: energySmartMeters.status,
      communicationType: energySmartMeters.communicationType,
      sourceId: energySmartMeters.sourceId,
      sourceRef: energySmartMeters.sourceRef,
      confidence: energySmartMeters.confidence,
      metadata: energySmartMeters.metadata,
      createdAt: energySmartMeters.createdAt,
      updatedAt: energySmartMeters.updatedAt,
      consumerName: energyParties.name,
      customerCode: energyCustomerAccounts.customerCode,
      siteName: energySites.name,
      measurementPointCode: energyMeasurementPoints.code,
    }).from(energySmartMeters)
      .leftJoin(energyConsumers, eq(energyConsumers.id, energySmartMeters.consumerId))
      .leftJoin(energyParties, eq(energyParties.id, energyConsumers.partyId))
      .leftJoin(energyCustomerAccounts, eq(energyCustomerAccounts.id, energySmartMeters.customerAccountId))
      .leftJoin(energySites, eq(energySites.id, energySmartMeters.siteId))
      .leftJoin(energyMeasurementPoints, eq(energyMeasurementPoints.id, energySmartMeters.measurementPointId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(energySmartMeters.meterCode);
    const rows = wantsPagination
      ? await listQuery.limit(pagination.pageSize).offset(pagination.offset)
      : await listQuery;
    const totalRows = wantsPagination
      ? await db.select({ value: count() }).from(energySmartMeters).where(conditions.length ? and(...conditions) : undefined)
      : [];
    const meterIds = rows.map((row) => row.id);
    const consumerIds = rows.map((row) => row.consumerId).filter((id): id is string => Boolean(id));
    const [eventCounts, reportCounts] = await Promise.all([
      meterIds.length ? db.select({ smartMeterId: energyMeterEvents.smartMeterId, value: count() }).from(energyMeterEvents).where(inArray(energyMeterEvents.smartMeterId, meterIds)).groupBy(energyMeterEvents.smartMeterId) : Promise.resolve([]),
      consumerIds.length ? db.select({ consumerId: energyConsumerReports.consumerId, value: count() }).from(energyConsumerReports).where(inArray(energyConsumerReports.consumerId, consumerIds)).groupBy(energyConsumerReports.consumerId) : Promise.resolve([]),
    ]);
    const eventCountMap = new Map(eventCounts.map((row) => [row.smartMeterId, Number(row.value)]));
    const reportCountMap = new Map(reportCounts.map((row) => [row.consumerId, Number(row.value)]));
    const items = rows.map((row) => serializeMeter({
      ...row,
      eventCount: eventCountMap.get(row.id) ?? 0,
      reportCount: row.consumerId ? reportCountMap.get(row.consumerId) ?? 0 : 0,
    }));
    return wantsPagination
      ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0))
      : NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải danh sách công tơ.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = smartMeterSchema.parse(await request.json());
    const created = await db.transaction(async (tx) => {
      let consumerId = payload.consumerId ?? null;
      let customerAccountId = payload.customerAccountId ?? null;
      let siteId = payload.siteId ?? null;

      if (customerAccountId) {
        const [account] = await tx.select({ id: energyCustomerAccounts.id, siteId: energyCustomerAccounts.siteId }).from(energyCustomerAccounts)
          .where(eq(energyCustomerAccounts.id, customerAccountId)).limit(1);
        if (!account) throw new Error('Không tìm thấy tài khoản EVN của công tơ.');
        siteId ??= account.siteId ?? null;
        const [consumer] = await tx.select({ id: energyConsumers.id }).from(energyConsumers)
          .where(eq(energyConsumers.customerAccountId, customerAccountId)).limit(1);
        if (consumerId && consumer && consumer.id !== consumerId) throw new Error('Tài khoản EVN và đơn vị sử dụng năng lượng không khớp.');
        consumerId ??= consumer?.id ?? null;
      }
      if (consumerId) {
        const [consumer] = await tx.select({ id: energyConsumers.id, customerAccountId: energyConsumers.customerAccountId, siteId: energyConsumers.siteId })
          .from(energyConsumers).where(eq(energyConsumers.id, consumerId)).limit(1);
        if (!consumer) throw new Error('Không tìm thấy đơn vị sử dụng năng lượng của công tơ.');
        if (customerAccountId && consumer.customerAccountId && consumer.customerAccountId !== customerAccountId) throw new Error('Tài khoản EVN và đơn vị sử dụng năng lượng không khớp.');
        customerAccountId ??= consumer.customerAccountId ?? null;
        siteId ??= consumer.siteId ?? null;
      }
      if (siteId) {
        const [site] = await tx.select({ id: energySites.id }).from(energySites).where(eq(energySites.id, siteId)).limit(1);
        if (!site) throw new Error('Không tìm thấy cơ sở/site của công tơ.');
      }
      if (payload.sourceId) {
        const [source] = await tx.select({ id: energyDataSources.id }).from(energyDataSources).where(eq(energyDataSources.id, payload.sourceId)).limit(1);
        if (!source) throw new Error('Không tìm thấy data source của công tơ.');
      }
      const [duplicate] = await tx.select({ id: energySmartMeters.id }).from(energySmartMeters)
        .where(eq(energySmartMeters.meterCode, payload.meterCode)).limit(1);
      if (duplicate) throw new Error(`Mã công tơ ${payload.meterCode} đã tồn tại.`);

      const point = await resolveMeterMeasurementPoint(tx, payload.measurementPointId, payload.meterCode, payload.provider);
      const [row] = await tx.insert(energySmartMeters).values({
        consumerId,
        siteId,
        customerAccountId,
        measurementPointId: point.id,
        meterCode: payload.meterCode,
        provider: payload.provider,
        meterType: payload.meterType,
        manufacturer: payload.manufacturer ?? null,
        model: payload.model ?? null,
        serialNumber: payload.serialNumber ?? null,
        phaseType: payload.phaseType ?? null,
        voltageLevelKv: payload.voltageLevelKv == null ? null : String(payload.voltageLevelKv),
        installedAt: dateOrNull(payload.installedAt),
        commissionedAt: dateOrNull(payload.commissionedAt),
        lastInspectionAt: dateOrNull(payload.lastInspectionAt),
        nextInspectionDueAt: dateOrNull(payload.nextInspectionDueAt),
        replacementDueAt: dateOrNull(payload.replacementDueAt),
        status: payload.status,
        communicationType: payload.communicationType ?? null,
        sourceId: payload.sourceId ?? null,
        sourceRef: payload.sourceRef ?? null,
        confidence: payload.confidence == null ? null : String(payload.confidence),
        metadata: payload.metadata ?? {},
      }).returning();
      return { row, point };
    });
    return NextResponse.json({ item: serializeMeter({ ...created.row, measurementPoint: created.point }) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin công tơ không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tạo công tơ.' }, { status: 400 });
  }
}
