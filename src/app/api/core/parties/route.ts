import { and, asc, eq, ilike, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyParties } from '@/db/schema';
import { partySchema } from '@/lib/core-schemas';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const status = query.get('status')?.trim();
    const search = query.get('search')?.trim();
    const wantsPagination = query.get('options') !== 'true' && (query.has('page') || query.has('pageSize'));
    const pagination = parsePagination(query);
    const where = and(
      status && status !== 'ALL' ? eq(energyParties.status, status) : undefined,
      search ? ilike(energyParties.name, `%${search}%`) : undefined,
    );
    const select = {
      id: energyParties.id,
      code: energyParties.code,
      name: energyParties.name,
      partyType: energyParties.partyType,
      taxCode: energyParties.taxCode,
      phone: energyParties.phone,
      email: energyParties.email,
      address: energyParties.address,
      status: energyParties.status,
      classification: energyParties.classification,
      adminAreaCode: energyParties.adminAreaCode,
      createdAt: energyParties.createdAt,
      updatedAt: energyParties.updatedAt,
    };
    const listQuery = db.select(select).from(energyParties).where(where).orderBy(asc(energyParties.name));
    if (!wantsPagination) return NextResponse.json({ items: await listQuery });
    const [rows, totalRows] = await Promise.all([
      listQuery.limit(pagination.pageSize).offset(pagination.offset),
      db.select({ value: sql<number>`count(*)::int` }).from(energyParties).where(where),
    ]);
    return paginatedResponse(rows, pagination, Number(totalRows[0]?.value ?? 0));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải danh sách đơn vị.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = partySchema.parse(await request.json());
    const [duplicate] = await db.select({ id: energyParties.id }).from(energyParties).where(eq(energyParties.code, payload.code)).limit(1);
    if (duplicate) return NextResponse.json({ message: `Mã Party ${payload.code} đã tồn tại.` }, { status: 409 });
    const [created] = await db.insert(energyParties).values({
      partyType: payload.partyType,
      code: payload.code,
      name: payload.name,
      taxCode: payload.taxCode ?? null,
      phone: payload.phone ?? null,
      email: payload.email ?? null,
      address: payload.address ?? null,
      adminAreaCode: payload.adminAreaCode ?? null,
      status: payload.status,
      classification: payload.classification,
      metadata: { ...(payload.metadata ?? {}), source: 'MANUAL', createdBy: 'core-party-api' },
    }).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin Party không hợp lệ.', issues: error.issues }, { status: 400 });
    console.error('Party create failed', error);
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tạo Party.' }, { status: 500 });
  }
}
