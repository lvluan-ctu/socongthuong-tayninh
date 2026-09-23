import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyEmissionSources, energyEnergyTypes, energyParties, energySites } from '@/db/schema';
import { carbonSourcePatchSchema, carbonSourceSchema } from '@/lib/carbon-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ sourceId: string }> };

function databaseCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : undefined;
}

async function selectSource(sourceId: string) {
  const [row] = await db.select({
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
  }).from(energyEmissionSources)
    .leftJoin(energyEnergyTypes, eq(energyEnergyTypes.code, energyEmissionSources.energyTypeCode))
    .leftJoin(energyParties, eq(energyParties.id, energyEmissionSources.partyId))
    .leftJoin(energySites, eq(energySites.id, energyEmissionSources.siteId))
    .where(eq(energyEmissionSources.id, sourceId)).limit(1);
  return row;
}

function warnings(row: { energyTypeCode: string | null; siteId: string | null; partyId: string | null }) {
  return [
    !row.energyTypeCode ? 'ENERGY_TYPE_MISSING: nguồn chưa được phân loại theo danh mục năng lượng chuẩn.' : null,
    !row.partyId ? 'PARTY_MISSING: nguồn chưa gắn đơn vị quản lý.' : null,
    !row.siteId ? 'SITE_MISSING: nguồn chưa gắn Site nên chưa thể lập bản đồ chính xác.' : null,
  ].filter((item): item is string => Boolean(item));
}

async function validateReferences(payload: Pick<z.infer<typeof carbonSourceSchema>, 'partyId' | 'siteId' | 'energyTypeCode'>) {
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

export async function GET(_request: Request, context: RouteContext) {
  const { sourceId } = await context.params;
  const row = await selectSource(sourceId);
  if (!row) return NextResponse.json({ message: 'Không tìm thấy nguồn phát thải.' }, { status: 404 });
  return NextResponse.json({ item: row, warnings: warnings(row) });
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { sourceId } = await context.params;
    const current = await selectSource(sourceId);
    if (!current) return NextResponse.json({ message: 'Không tìm thấy nguồn phát thải.' }, { status: 404 });
    const patch = carbonSourcePatchSchema.parse(await request.json());
    if (Object.keys(patch).length === 0) return NextResponse.json({ message: 'Không có trường nào được cập nhật.' }, { status: 400 });
    const merged = carbonSourceSchema.parse({
      ...current,
      ...patch,
      partyId: patch.partyId === undefined ? current.partyId : patch.partyId,
      siteId: patch.siteId === undefined ? current.siteId : patch.siteId,
      energyTypeCode: patch.energyTypeCode === undefined ? current.energyTypeCode : patch.energyTypeCode,
      fuelTypeCode: patch.fuelTypeCode === undefined ? current.fuelTypeCode : patch.fuelTypeCode,
      processType: patch.processType === undefined ? current.processType : patch.processType,
      equipmentRef: patch.equipmentRef === undefined ? current.equipmentRef : patch.equipmentRef,
      meterRef: patch.meterRef === undefined ? current.meterRef : patch.meterRef,
      sourceCategory: patch.sourceCategory === undefined ? current.sourceCategory : patch.sourceCategory,
      sector: patch.sector === undefined ? current.sector : patch.sector,
      status: patch.status === undefined ? current.status : patch.status,
      classification: patch.classification === undefined ? current.classification : patch.classification,
      code: patch.code === undefined ? current.code : patch.code,
      name: patch.name === undefined ? current.name : patch.name,
      sourceType: patch.sourceType === undefined ? current.sourceType : patch.sourceType,
      scope: patch.scope === undefined ? current.scope : patch.scope,
    });
    const relationError = await validateReferences(merged);
    if (relationError) return NextResponse.json({ message: relationError }, { status: 400 });
    await db.update(energyEmissionSources).set({
      partyId: merged.partyId ?? null,
      siteId: merged.siteId ?? null,
      code: merged.code,
      name: merged.name,
      sourceType: merged.sourceType,
      energyTypeCode: merged.energyTypeCode ?? null,
      fuelTypeCode: merged.fuelTypeCode ?? null,
      processType: merged.processType ?? null,
      equipmentRef: merged.equipmentRef ?? null,
      meterRef: merged.meterRef ?? null,
      sourceCategory: merged.sourceCategory ?? null,
      scope: merged.scope,
      sector: merged.sector ?? null,
      status: merged.status,
      classification: merged.classification,
      updatedAt: new Date(),
    }).where(eq(energyEmissionSources.id, sourceId));
    const row = await selectSource(sourceId);
    return NextResponse.json({ item: row, warnings: row ? warnings(row) : [] });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin nguồn phát thải không hợp lệ.', issues: error.issues }, { status: 400 });
    if (databaseCode(error) === '23505') return NextResponse.json({ message: 'Mã nguồn phát thải đã tồn tại.' }, { status: 409 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật nguồn phát thải.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { sourceId } = await context.params;
    const [updated] = await db.update(energyEmissionSources).set({ status: 'INACTIVE', updatedAt: new Date() }).where(eq(energyEmissionSources.id, sourceId)).returning({ id: energyEmissionSources.id, status: energyEmissionSources.status });
    if (!updated) return NextResponse.json({ message: 'Không tìm thấy nguồn phát thải.' }, { status: 404 });
    return NextResponse.json({ item: updated, archived: true, message: 'Nguồn phát thải đã được chuyển sang INACTIVE để giữ nguyên lịch sử.' });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu trạng thái nguồn phát thải.' }, { status: 400 });
  }
}
