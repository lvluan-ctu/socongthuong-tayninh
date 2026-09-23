import { asc, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { energyEnergyTypes } from '@/db/schema';
import { energyTypeSchema } from '@/lib/carbon-schemas';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const status = params.get('status');
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const where = status && status !== 'ALL' ? eq(energyEnergyTypes.status, status) : undefined;
    const query = db.select().from(energyEnergyTypes).where(where).orderBy(asc(energyEnergyTypes.name));
    if (!wantsPagination) return NextResponse.json({ items: await query });
    const [rows, totalRows] = await Promise.all([
      query.limit(pagination.pageSize).offset(pagination.offset),
      db.select({ value: count() }).from(energyEnergyTypes).where(where),
    ]);
    return paginatedResponse(rows, pagination, Number(totalRows[0]?.value ?? 0));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải danh mục loại năng lượng.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = energyTypeSchema.parse(await request.json());
    const [created] = await db.insert(energyEnergyTypes).values({
      code: payload.code,
      name: payload.name,
      category: payload.category,
      canonicalUnit: payload.canonicalUnit ?? null,
      description: payload.description ?? null,
      status: payload.status,
      metadata: payload.metadata ?? { source: 'MANUAL' },
    }).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Error && 'issues' in error) return NextResponse.json({ message: 'Loại năng lượng không hợp lệ.', issues: error.issues }, { status: 400 });
    const code = (error as { code?: string }).code;
    if (code === '23505') return NextResponse.json({ message: 'Mã loại năng lượng đã tồn tại.' }, { status: 409 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tạo loại năng lượng.' }, { status: 400 });
  }
}
