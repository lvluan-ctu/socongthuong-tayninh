import { asc, count } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { energyAdminAreas } from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const query = db.select({
      id: energyAdminAreas.id,
      code: energyAdminAreas.code,
      name: energyAdminAreas.name,
      level: energyAdminAreas.level,
      parentCode: energyAdminAreas.parentCode,
    }).from(energyAdminAreas).orderBy(asc(energyAdminAreas.level), asc(energyAdminAreas.name));
    if (!wantsPagination) return NextResponse.json({ items: await query });
    const [rows, totalRows] = await Promise.all([
      query.limit(pagination.pageSize).offset(pagination.offset),
      db.select({ value: count() }).from(energyAdminAreas),
    ]);
    return paginatedResponse(rows, pagination, Number(totalRows[0]?.value ?? 0));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải địa giới hành chính.' }, { status: 500 });
  }
}
