import { asc, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyEmissionSources, energyEnergyTypes, energyParties, energySites } from '@/db/schema';
import { carbonSourceSchema } from '@/lib/carbon-schemas';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

function databaseCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : undefined;
}

async function validateSourceRelations(payload: Pick<z.infer<typeof carbonSourceSchema>, 'partyId' | 'siteId' | 'energyTypeCode'>) {
  if (payload.partyId) {
    const [party] = await db.select({ id: energyParties.id }).from(energyParties).where(eq(energyParties.id, payload.partyId)).limit(1);
    if (!party) return 'Không tìm thấy đơn vị sở hữu/quản lý nguồn phát thải.';
  }
  if (payload.siteId) {
    const [site] = await db.select({ id: energySites.id, partyId: energySites.partyId }).from(energySites).where(eq(energySites.id, payload.siteId)).limit(1);
    if (!site) return 'Không tìm thấy Site của nguồn phát thải.';
    if (payload.partyId && site.partyId && site.partyId !== payload.partyId) return 'Site không thuộc đơn vị đã chọn.';
  }
  if (payload.energyTypeCode) {
    const [energyType] = await db.select({ code: energyEnergyTypes.code, status: energyEnergyTypes.status }).from(energyEnergyTypes).where(eq(energyEnergyTypes.code, payload.energyTypeCode)).limit(1);
    if (!energyType) return 'Không tìm thấy loại năng lượng chuẩn.';
    if (energyType.status !== 'ACTIVE') return 'Loại năng lượng đang INACTIVE/PLANNED, không thể gắn cho nguồn ACTIVE.';
  }
  return null;
}

function withWarnings<T extends { energyTypeCode: string | null; siteId: string | null; partyId: string | null }>(row: T) {
  const warnings: string[] = [];
  if (!row.energyTypeCode) warnings.push('ENERGY_TYPE_MISSING: nguồn chưa được phân loại theo danh mục năng lượng chuẩn.');
  if (!row.partyId) warnings.push('PARTY_MISSING: nguồn chưa gắn đơn vị quản lý.');
  if (!row.siteId) warnings.push('SITE_MISSING: nguồn chưa gắn Site nên chưa thể lập bản đồ chính xác.');
  return { ...row, warnings };
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const status = params.get('status');
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const where = status && status !== 'ALL' ? eq(energyEmissionSources.status, status) : undefined;
    const select = {
      id: energyEmissionSources.id,
      code: energyEmissionSources.code,
      name: energyEmissionSources.name,
      sourceType: energyEmissionSources.sourceType,
      energyTypeCode: energyEmissionSources.energyTypeCode,
      energyTypeName: energyEnergyTypes.name,
      fuelTypeCode: energyEmissionSources.fuelTypeCode,
      processType: energyEmissionSources.processType,
      equipmentRef: energyEmissionSources.equipmentRef,
      meterRef: energyEmissionSources.meterRef,
      sourceCategory: energyEmissionSources.sourceCategory,
      scope: energyEmissionSources.scope,
      sector: energyEmissionSources.sector,
      status: energyEmissionSources.status,
      classification: energyEmissionSources.classification,
      partyId: energyEmissionSources.partyId,
      partyName: energyParties.name,
      siteId: energyEmissionSources.siteId,
      siteName: energySites.name,
      adminAreaCode: energySites.adminAreaCode,
      createdAt: energyEmissionSources.createdAt,
      updatedAt: energyEmissionSources.updatedAt,
    };
    const query = db.select(select).from(energyEmissionSources)
      .leftJoin(energyEnergyTypes, eq(energyEnergyTypes.code, energyEmissionSources.energyTypeCode))
      .leftJoin(energyParties, eq(energyParties.id, energyEmissionSources.partyId))
      .leftJoin(energySites, eq(energySites.id, energyEmissionSources.siteId));
    const listQuery = query.where(where).orderBy(asc(energyEmissionSources.name));
    if (!wantsPagination) return NextResponse.json({ items: (await listQuery).map(withWarnings) });
    const [rows, totalRows] = await Promise.all([
      listQuery.limit(pagination.pageSize).offset(pagination.offset),
      db.select({ value: count() }).from(energyEmissionSources).where(where),
    ]);
    return paginatedResponse(rows.map(withWarnings), pagination, Number(totalRows[0]?.value ?? 0));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải nguồn phát thải.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = carbonSourceSchema.parse(await request.json());
    const relationError = await validateSourceRelations(payload);
    if (relationError) return NextResponse.json({ message: relationError }, { status: 400 });
    const [created] = await db.insert(energyEmissionSources).values({
      partyId: payload.partyId ?? null,
      siteId: payload.siteId ?? null,
      code: payload.code,
      name: payload.name,
      sourceType: payload.sourceType,
      energyTypeCode: payload.energyTypeCode ?? null,
      fuelTypeCode: payload.fuelTypeCode ?? null,
      processType: payload.processType ?? null,
      equipmentRef: payload.equipmentRef ?? null,
      meterRef: payload.meterRef ?? null,
      sourceCategory: payload.sourceCategory ?? null,
      scope: payload.scope,
      sector: payload.sector ?? null,
      status: payload.status,
      classification: payload.classification,
    }).returning();
    return NextResponse.json(withWarnings(created), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Nguồn phát thải không hợp lệ.', issues: error.issues }, { status: 400 });
    if (databaseCode(error) === '23505') return NextResponse.json({ message: 'Mã nguồn phát thải đã tồn tại.' }, { status: 409 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu nguồn phát thải.' }, { status: 400 });
  }
}
