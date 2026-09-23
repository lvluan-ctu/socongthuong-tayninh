import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyCustomerAccounts, energyParties, energySites } from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const schema = z.object({
  customerCode: z.string().trim().min(2).max(100),
  provider: z.string().trim().min(2).max(50).default('EVN'),
  customerName: z.string().trim().min(2).max(250),
  customerType: z.string().trim().max(100).nullable().optional(),
  serviceAddress: z.string().trim().max(500).nullable().optional(),
  adminAreaCode: z.string().trim().max(50).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.trim() ?? '';
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 100)));
    const wantsPagination = url.searchParams.get('options') !== 'true' && (url.searchParams.has('page') || url.searchParams.has('pageSize'));
    const pagination = parsePagination(url.searchParams);

    const base = db.select({
      id: energyCustomerAccounts.id,
      provider: energyCustomerAccounts.provider,
      customerCode: energyCustomerAccounts.customerCode,
      serviceAddress: energyCustomerAccounts.serviceAddress,
      customerType: energyCustomerAccounts.customerType,
      status: energyCustomerAccounts.status,
      partyId: energyCustomerAccounts.partyId,
      partyCode: energyParties.code,
      customerName: energyParties.name,
      phone: energyParties.phone,
      email: energyParties.email,
      adminAreaCode: energySites.adminAreaCode,
      siteId: energyCustomerAccounts.siteId,
      siteName: energySites.name,
      latitude: sql<number | null>`ST_Y(${energySites.location}::geometry)`,
      longitude: sql<number | null>`ST_X(${energySites.location}::geometry)`,
    })
      .from(energyCustomerAccounts)
      .innerJoin(energyParties, eq(energyParties.id, energyCustomerAccounts.partyId))
      .leftJoin(energySites, eq(energySites.id, energyCustomerAccounts.siteId));

    const where = search
      ? or(
          ilike(energyCustomerAccounts.customerCode, `%${search}%`),
          ilike(energyParties.name, `%${search}%`),
          ilike(energyCustomerAccounts.serviceAddress, `%${search}%`),
        )
      : undefined;
    const listQuery = (search ? base.where(where) : base).orderBy(search ? energyParties.name : desc(energyCustomerAccounts.id));
    const [rows, totalRows] = await Promise.all([
      wantsPagination ? listQuery.limit(pagination.pageSize).offset(pagination.offset) : listQuery.limit(limit),
      db.select({ value: count() }).from(energyCustomerAccounts)
        .innerJoin(energyParties, eq(energyParties.id, energyCustomerAccounts.partyId))
        .leftJoin(energySites, eq(energySites.id, energyCustomerAccounts.siteId))
        .where(where),
    ]);

    return wantsPagination ? paginatedResponse(rows, pagination, Number(totalRows[0]?.value ?? 0)) : NextResponse.json({ items: rows });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải danh sách khách hàng điện.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const [existing] = await db.select({ id: energyCustomerAccounts.id }).from(energyCustomerAccounts)
      .where(and(eq(energyCustomerAccounts.provider, payload.provider), eq(energyCustomerAccounts.customerCode, payload.customerCode))).limit(1);
    if (existing) return NextResponse.json({ message: `Mã khách hàng ${payload.customerCode} đã tồn tại.` }, { status: 409 });

    const location = payload.latitude != null && payload.longitude != null
      ? `SRID=4326;POINT(${payload.longitude} ${payload.latitude})`
      : null;

    const result = await db.transaction(async (tx) => {
      const partyCode = `EVN-CUSTOMER:${payload.customerCode}`;
      const [party] = await tx.insert(energyParties).values({
        partyType: 'ELECTRICITY_CUSTOMER',
        code: partyCode,
        name: payload.customerName,
        phone: payload.phone ?? null,
        email: payload.email ?? null,
        address: payload.serviceAddress ?? null,
        adminAreaCode: payload.adminAreaCode ?? null,
        status: 'ACTIVE',
        classification: 'RESTRICTED',
        metadata: { source: 'MANUAL', provider: payload.provider },
      }).returning();

      const [site] = await tx.insert(energySites).values({
        partyId: party.id,
        code: `SITE:${payload.customerCode}`,
        name: `Điểm sử dụng điện ${payload.customerCode}`,
        siteType: 'CUSTOMER_SERVICE_POINT',
        address: payload.serviceAddress ?? null,
        adminAreaCode: payload.adminAreaCode ?? null,
        location,
        classification: 'RESTRICTED',
        status: 'ACTIVE',
        metadata: { source: 'MANUAL' },
      }).returning();

      const [account] = await tx.insert(energyCustomerAccounts).values({
        partyId: party.id,
        provider: payload.provider,
        customerCode: payload.customerCode,
        serviceAddress: payload.serviceAddress ?? null,
        siteId: site.id,
        customerType: payload.customerType ?? null,
        status: 'ACTIVE',
        metadata: { createdBy: 'solar-customer-api' },
      }).returning();

      return { account, party, site };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin khách hàng không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tạo khách hàng.' }, { status: 400 });
  }
}
