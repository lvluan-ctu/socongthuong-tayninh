import { and, eq, ne, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyCustomerAccounts, energyParties, energySites } from '@/db/schema';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ accountId: string }> };

const customerSchema = z.object({
  customerCode: z.string().trim().min(2).max(100),
  provider: z.string().trim().min(2).max(50),
  customerName: z.string().trim().min(2).max(250),
  customerType: z.string().trim().max(100).nullable().optional(),
  serviceAddress: z.string().trim().max(500).nullable().optional(),
  adminAreaCode: z.string().trim().max(50).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

const customerPatchSchema = customerSchema.partial();

async function loadCustomer(accountId: string) {
  const [row] = await db.select({
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
  }).from(energyCustomerAccounts)
    .innerJoin(energyParties, eq(energyParties.id, energyCustomerAccounts.partyId))
    .leftJoin(energySites, eq(energySites.id, energyCustomerAccounts.siteId))
    .where(eq(energyCustomerAccounts.id, accountId))
    .limit(1);
  return row ?? null;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { accountId } = await context.params;
    const customer = await loadCustomer(accountId);
    if (!customer) return NextResponse.json({ message: 'Không tìm thấy tài khoản khách hàng EVN.' }, { status: 404 });
    return NextResponse.json({ customer });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải hồ sơ khách hàng.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { accountId } = await context.params;
    const payload = customerPatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) return NextResponse.json({ message: 'Không có trường nào để cập nhật.' }, { status: 400 });

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select({
        id: energyCustomerAccounts.id,
        provider: energyCustomerAccounts.provider,
        customerCode: energyCustomerAccounts.customerCode,
        partyId: energyCustomerAccounts.partyId,
        siteId: energyCustomerAccounts.siteId,
      }).from(energyCustomerAccounts).where(eq(energyCustomerAccounts.id, accountId)).limit(1);
      if (!existing) throw new Error('Không tìm thấy tài khoản khách hàng EVN.');

      const provider = payload.provider ?? existing.provider;
      const customerCode = payload.customerCode ?? existing.customerCode;
      const [duplicate] = await tx.select({ id: energyCustomerAccounts.id }).from(energyCustomerAccounts)
        .where(and(eq(energyCustomerAccounts.provider, provider), eq(energyCustomerAccounts.customerCode, customerCode), ne(energyCustomerAccounts.id, accountId)))
        .limit(1);
      if (duplicate) return { duplicate: true as const };

      const hasLatitude = Object.prototype.hasOwnProperty.call(payload, 'latitude');
      const hasLongitude = Object.prototype.hasOwnProperty.call(payload, 'longitude');
      if (hasLatitude !== hasLongitude) throw new Error('Latitude và longitude phải được cập nhật cùng nhau.');
      if (hasLatitude && (payload.latitude == null) !== (payload.longitude == null)) throw new Error('Latitude và longitude phải cùng có giá trị hoặc cùng để trống.');

      const serviceAddress = Object.prototype.hasOwnProperty.call(payload, 'serviceAddress') ? payload.serviceAddress ?? null : undefined;
      const adminAreaCode = Object.prototype.hasOwnProperty.call(payload, 'adminAreaCode') ? payload.adminAreaCode ?? null : undefined;
      const customerType = Object.prototype.hasOwnProperty.call(payload, 'customerType') ? payload.customerType ?? null : undefined;
      const status = payload.status;
      await tx.update(energyCustomerAccounts).set({
        ...(payload.provider ? { provider: payload.provider } : {}),
        ...(payload.customerCode ? { customerCode: payload.customerCode } : {}),
        ...(serviceAddress !== undefined ? { serviceAddress } : {}),
        ...(customerType !== undefined ? { customerType } : {}),
        ...(status ? { status } : {}),
      }).where(eq(energyCustomerAccounts.id, accountId));
      await tx.update(energyParties).set({
        ...(payload.customerName ? { name: payload.customerName } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'phone') ? { phone: payload.phone ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, 'email') ? { email: payload.email ?? null } : {}),
        ...(serviceAddress !== undefined ? { address: serviceAddress } : {}),
        ...(adminAreaCode !== undefined ? { adminAreaCode } : {}),
        ...(status ? { status } : {}),
        ...(payload.customerCode ? { code: `EVN-CUSTOMER:${payload.customerCode}` } : {}),
        updatedAt: new Date(),
      }).where(eq(energyParties.id, existing.partyId));

      if (existing.siteId) {
        await tx.update(energySites).set({
          ...(payload.customerCode ? { code: `SITE:${payload.customerCode}`, name: `Điểm sử dụng điện ${payload.customerCode}` } : {}),
          ...(serviceAddress !== undefined ? { address: serviceAddress } : {}),
          ...(adminAreaCode !== undefined ? { adminAreaCode } : {}),
          ...(hasLatitude ? { location: payload.latitude == null || payload.longitude == null ? null : `SRID=4326;POINT(${payload.longitude} ${payload.latitude})` } : {}),
          ...(status ? { status } : {}),
          updatedAt: new Date(),
        }).where(eq(energySites.id, existing.siteId));
      }
      return { duplicate: false as const };
    });

    if (result.duplicate) return NextResponse.json({ message: `Mã khách hàng ${payload.customerCode} đã tồn tại trong provider ${payload.provider ?? 'hiện tại'}.` }, { status: 409 });
    const customer = await loadCustomer(accountId);
    return NextResponse.json({ customer });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin khách hàng không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật khách hàng.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { accountId } = await context.params;
    const result = await db.transaction(async (tx) => {
      const [account] = await tx.select({ id: energyCustomerAccounts.id, partyId: energyCustomerAccounts.partyId, siteId: energyCustomerAccounts.siteId }).from(energyCustomerAccounts).where(eq(energyCustomerAccounts.id, accountId)).limit(1);
      if (!account) return null;
      await tx.update(energyCustomerAccounts).set({ status: 'INACTIVE' }).where(eq(energyCustomerAccounts.id, accountId));
      await tx.update(energyParties).set({ status: 'INACTIVE', updatedAt: new Date() }).where(eq(energyParties.id, account.partyId));
      if (account.siteId) await tx.update(energySites).set({ status: 'INACTIVE', updatedAt: new Date() }).where(eq(energySites.id, account.siteId));
      return account;
    });
    if (!result) return NextResponse.json({ message: 'Không tìm thấy tài khoản khách hàng EVN.' }, { status: 404 });
    return NextResponse.json({ deleted: true, accountId, message: 'Khách hàng đã được chuyển sang INACTIVE để bảo toàn lịch sử.' });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể vô hiệu hóa khách hàng.' }, { status: 400 });
  }
}
