import { and, asc, eq, ilike, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyAdminAreas, energyParties, energySites } from '@/db/schema';
import { siteSchema } from '@/lib/core-schemas';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

function pointFromCoordinates(latitude: number | null | undefined, longitude: number | null | undefined) {
  return latitude != null && longitude != null ? `SRID=4326;POINT(${longitude} ${latitude})` : null;
}

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const status = query.get('status')?.trim();
    const partyId = query.get('partyId')?.trim();
    const search = query.get('search')?.trim();
    const wantsPagination = query.get('options') !== 'true' && (query.has('page') || query.has('pageSize'));
    const pagination = parsePagination(query);
    if (partyId && !z.string().uuid().safeParse(partyId).success) return NextResponse.json({ message: 'partyId không hợp lệ.' }, { status: 400 });
    const where = and(
      status && status !== 'ALL' ? eq(energySites.status, status) : undefined,
      partyId ? eq(energySites.partyId, partyId) : undefined,
      search ? ilike(energySites.name, `%${search}%`) : undefined,
    );
    const select = {
      id: energySites.id,
      code: energySites.code,
      name: energySites.name,
      siteType: energySites.siteType,
      partyId: energySites.partyId,
      partyName: energyParties.name,
      address: energySites.address,
      adminAreaCode: energySites.adminAreaCode,
      adminAreaName: energyAdminAreas.name,
      status: energySites.status,
      classification: energySites.classification,
      latitude: sql<number | null>`ST_Y(${energySites.location}::geometry)`,
      longitude: sql<number | null>`ST_X(${energySites.location}::geometry)`,
      createdAt: energySites.createdAt,
      updatedAt: energySites.updatedAt,
    };
    const listQuery = db.select(select).from(energySites)
      .leftJoin(energyParties, eq(energyParties.id, energySites.partyId))
      .leftJoin(energyAdminAreas, eq(energyAdminAreas.code, energySites.adminAreaCode))
      .where(where)
      .orderBy(asc(energySites.name));
    if (!wantsPagination) return NextResponse.json({ items: await listQuery });
    const [rows, totalRows] = await Promise.all([listQuery
      .limit(pagination.pageSize)
      .offset(pagination.offset),
      db.select({ value: sql<number>`count(*)::int` }).from(energySites).where(where),
    ]);
    return paginatedResponse(rows, pagination, Number(totalRows[0]?.value ?? 0));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải danh sách Site.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = siteSchema.parse(await request.json());
    if (payload.partyId) {
      const [party] = await db.select({ id: energyParties.id }).from(energyParties).where(eq(energyParties.id, payload.partyId)).limit(1);
      if (!party) return NextResponse.json({ message: 'Không tìm thấy Party sở hữu/quản lý Site.' }, { status: 404 });
    }
    const [duplicate] = await db.select({ id: energySites.id }).from(energySites).where(eq(energySites.code, payload.code)).limit(1);
    if (duplicate) return NextResponse.json({ message: `Mã Site ${payload.code} đã tồn tại.` }, { status: 409 });
    const [created] = await db.insert(energySites).values({
      partyId: payload.partyId ?? null,
      code: payload.code,
      name: payload.name,
      siteType: payload.siteType,
      address: payload.address ?? null,
      adminAreaCode: payload.adminAreaCode ?? null,
      location: pointFromCoordinates(payload.latitude, payload.longitude),
      classification: payload.classification,
      status: payload.status,
      metadata: { ...(payload.metadata ?? {}), source: 'MANUAL', createdBy: 'core-site-api' },
    }).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin Site không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tạo Site.' }, { status: 400 });
  }
}
