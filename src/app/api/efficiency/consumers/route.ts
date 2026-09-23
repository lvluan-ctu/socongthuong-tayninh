import { asc, count, eq, inArray, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  energyConsumerClassificationHistory,
  energyConsumerReports,
  energyConsumers,
  energyCustomerAccounts,
  energyCustomerConsumptionMonthly,
  energyParties,
  energySites,
  energySmartMeters,
} from '@/db/schema';
import { db } from '@/lib/db';
import { consumerSchema } from '@/lib/efficiency-schemas';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

function nullable(value: string | null | undefined) {
  return value == null || value.trim() === '' ? null : value.trim();
}

function pointFromCoordinates(latitude: number | null | undefined, longitude: number | null | undefined) {
  return latitude != null && longitude != null ? `SRID=4326;POINT(${longitude} ${latitude})` : null;
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const listQuery = db.select({
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
        address: energySites.address,
        adminAreaCode: energySites.adminAreaCode,
        latitude: sql<number | null>`CASE WHEN ${energySites.location} IS NULL THEN NULL ELSE ST_Y(${energySites.location}::geometry) END`,
        longitude: sql<number | null>`CASE WHEN ${energySites.location} IS NULL THEN NULL ELSE ST_X(${energySites.location}::geometry) END`,
        customerCode: energyCustomerAccounts.customerCode,
      }).from(energyConsumers)
      .innerJoin(energyParties, eq(energyParties.id, energyConsumers.partyId))
      .leftJoin(energySites, eq(energySites.id, energyConsumers.siteId))
      .leftJoin(energyCustomerAccounts, eq(energyCustomerAccounts.id, energyConsumers.customerAccountId))
      .orderBy(asc(energyParties.name));

    const [rows, totalRows, summaryRows] = await Promise.all([
      wantsPagination ? listQuery.limit(pagination.pageSize).offset(pagination.offset) : listQuery,
      db.select({ value: count() }).from(energyConsumers),
      db.execute(sql`
        select
          count(*) filter (where importance_level = 'KEY')::int as key_count,
          count(*) filter (where importance_level = 'NEAR_KEY')::int as near_key_count,
          count(*) filter (where reporting_required = 'YES')::int as required_count,
          coalesce((
            select sum(m.energy_kwh)::numeric
            from energy_customer_consumption_monthly m
            join energy_customer_accounts a on a.id = m.account_id
            join energy_consumers c2 on c2.customer_account_id = a.id
            where c2.status <> 'ARCHIVED'
          ), 0)::numeric as annual_consumption_kwh
        from energy_consumers
        where status <> 'ARCHIVED'
      `),
    ]);
    const consumerIds = rows.map((row) => row.id);
    const accountIds = rows.map((row) => row.customerAccountId).filter((id): id is string => Boolean(id));

    const [consumptionRows, reportRows, historyRows, meterRows] = await Promise.all([
      accountIds.length ? db.select({
      accountId: energyCustomerConsumptionMonthly.accountId,
      energyKwh: energyCustomerConsumptionMonthly.energyKwh,
      peakDemandKw: energyCustomerConsumptionMonthly.peakDemandKw,
      period: energyCustomerConsumptionMonthly.period,
      }).from(energyCustomerConsumptionMonthly).where(inArray(energyCustomerConsumptionMonthly.accountId, accountIds)) : Promise.resolve([]),
      consumerIds.length ? db.select({
      consumerId: energyConsumerReports.consumerId,
      period: energyConsumerReports.period,
      status: energyConsumerReports.status,
      }).from(energyConsumerReports).where(inArray(energyConsumerReports.consumerId, consumerIds)) : Promise.resolve([]),
      consumerIds.length ? db.select({
      consumerId: energyConsumerClassificationHistory.consumerId,
      status: energyConsumerClassificationHistory.status,
      }).from(energyConsumerClassificationHistory).where(inArray(energyConsumerClassificationHistory.consumerId, consumerIds)) : Promise.resolve([]),
      consumerIds.length ? db.select({
      consumerId: energySmartMeters.consumerId,
      status: energySmartMeters.status,
      }).from(energySmartMeters).where(inArray(energySmartMeters.consumerId, consumerIds)) : Promise.resolve([]),
    ]);

    const items = rows.map((row) => {
        const accountConsumption = row.customerAccountId
          ? consumptionRows.filter((item) => item.accountId === row.customerAccountId)
          : [];
        const latest12 = [...accountConsumption].sort((a, b) => b.period.localeCompare(a.period)).slice(0, 12);
        const annualConsumptionKwh = latest12.reduce((sum, item) => sum + Number(item.energyKwh), 0);
        const peakDemandKw = latest12.reduce((max, item) => Math.max(max, item.peakDemandKw == null ? 0 : Number(item.peakDemandKw)), 0);
        const reports = reportRows.filter((item) => item.consumerId === row.id);
        const history = historyRows.filter((item) => item.consumerId === row.id);
        const meters = meterRows.filter((item) => item.consumerId === row.id);
        return {
          ...row,
          annualConsumptionKwh,
          peakDemandKw,
          reportCount: reports.length,
          submittedReportCount: reports.filter((report) => report.status !== 'DRAFT').length,
          classificationHistoryCount: history.length,
          activeClassificationHistoryCount: history.filter((item) => item.status === 'ACTIVE').length,
          meterCount: meters.length,
          activeMeterCount: meters.filter((item) => item.status === 'ACTIVE').length,
        };
      });
    const summary = summaryRows.rows[0] as {
      key_count: number;
      near_key_count: number;
      required_count: number;
      annual_consumption_kwh: string;
    } | undefined;
    const stats = {
      keyCount: Number(summary?.key_count ?? 0),
      nearKeyCount: Number(summary?.near_key_count ?? 0),
      requiredCount: Number(summary?.required_count ?? 0),
      annualConsumptionKwh: Number(summary?.annual_consumption_kwh ?? 0),
    };
    return wantsPagination
      ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0), { stats })
      : NextResponse.json({ items, stats });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải danh sách đơn vị sử dụng năng lượng.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = consumerSchema.parse(await request.json());
    const result = await db.transaction(async (tx) => {
      let partyId: string;
      let siteId: string | null = null;

      if (payload.customerAccountId) {
        const [account] = await tx.select({
          id: energyCustomerAccounts.id,
          partyId: energyCustomerAccounts.partyId,
          siteId: energyCustomerAccounts.siteId,
        }).from(energyCustomerAccounts).where(eq(energyCustomerAccounts.id, payload.customerAccountId)).limit(1);
        if (!account) throw new Error('Không tìm thấy tài khoản EVN được chọn.');
        partyId = account.partyId;
        siteId = account.siteId ?? null;
        const [existingConsumer] = await tx.select({ id: energyConsumers.id }).from(energyConsumers)
          .where(eq(energyConsumers.customerAccountId, payload.customerAccountId)).limit(1);
        if (existingConsumer) throw new Error('Tài khoản EVN này đã được đăng ký trong Consumer Registry.');
      } else {
        if (!payload.partyCode || !payload.partyName) throw new Error('Cần khai báo mã/tên đơn vị khi không liên kết tài khoản EVN.');
        const [existingParty] = await tx.select().from(energyParties).where(eq(energyParties.code, payload.partyCode)).limit(1);
        const party = existingParty ?? (await tx.insert(energyParties).values({
          partyType: 'ENERGY_CONSUMER',
          code: payload.partyCode,
          name: payload.partyName,
          address: nullable(payload.address),
          adminAreaCode: nullable(payload.adminAreaCode),
          status: 'ACTIVE',
          classification: 'INTERNAL',
        }).returning())[0];
        partyId = party.id;

        const [existingConsumer] = await tx.select({ id: energyConsumers.id }).from(energyConsumers)
          .where(eq(energyConsumers.partyId, partyId)).limit(1);
        if (existingConsumer) throw new Error('Đơn vị này đã tồn tại trong Consumer Registry.');

        const siteCode = `CONSUMER-SITE:${payload.partyCode}`;
        const [existingSite] = await tx.select({ id: energySites.id }).from(energySites).where(eq(energySites.code, siteCode)).limit(1);
        if (existingSite) {
          siteId = existingSite.id;
          if (payload.address || payload.adminAreaCode || (payload.latitude != null && payload.longitude != null)) {
            await tx.update(energySites).set({
              ...(payload.address !== undefined ? { address: nullable(payload.address) } : {}),
              ...(payload.adminAreaCode !== undefined ? { adminAreaCode: nullable(payload.adminAreaCode) } : {}),
              ...(payload.latitude != null && payload.longitude != null ? { location: pointFromCoordinates(payload.latitude, payload.longitude) } : {}),
              updatedAt: new Date(),
            }).where(eq(energySites.id, existingSite.id));
          }
        } else if (payload.address || payload.adminAreaCode) {
          const [site] = await tx.insert(energySites).values({
            partyId,
            code: siteCode,
            name: `Cơ sở ${payload.partyName}`,
            siteType: 'ENERGY_CONSUMER_SITE',
            address: nullable(payload.address),
            adminAreaCode: nullable(payload.adminAreaCode),
            location: pointFromCoordinates(payload.latitude, payload.longitude),
            status: 'ACTIVE',
            classification: 'INTERNAL',
          }).returning();
          siteId = site.id;
        }
      }

      const consumerGroup = payload.consumerGroup;
      const importanceLevel = payload.importanceLevel;
      const [created] = await tx.insert(energyConsumers).values({
        partyId,
        siteId,
        customerAccountId: payload.customerAccountId ?? null,
        classification: payload.classification ?? importanceLevel,
        consumerGroup,
        importanceLevel,
        sector: payload.sector,
        industryZoneCode: nullable(payload.industryZoneCode),
        reportingRequired: payload.reportingRequired,
        status: 'ACTIVE',
      }).returning();

      await tx.insert(energyConsumerClassificationHistory).values({
        consumerId: created.id,
        consumerGroup,
        importanceLevel,
        validFrom: payload.classificationValidFrom ? new Date(payload.classificationValidFrom) : new Date(),
        sourceDocumentNo: nullable(payload.classificationSourceDocumentNo),
        sourceDocumentRef: nullable(payload.classificationSourceDocumentRef),
        issuedBy: nullable(payload.classificationIssuedBy),
        reason: nullable(payload.classificationReason) ?? 'Phân loại ban đầu khi đăng ký Consumer Registry.',
        status: 'ACTIVE',
      });
      return created;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin đơn vị sử dụng năng lượng không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tạo đơn vị sử dụng năng lượng.' }, { status: 400 });
  }
}
