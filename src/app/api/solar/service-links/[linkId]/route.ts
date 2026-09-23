import { eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyAssets, energyCustomerAccounts, energyCustomerGridServiceLinks, energyMeasurementPoints } from '@/db/schema';
import { customerGridServiceLinkSchema } from '@/lib/solar-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ linkId: string }> };

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function refsExist(refs: Array<{ id: string | null | undefined; type: string; label: string }>) {
  const values = Array.from(new Set(refs.map((ref) => ref.id).filter((id): id is string => Boolean(id))));
  if (!values.length) return { ok: true as const };
  const rows = await db.select({ id: energyAssets.id, assetType: energyAssets.assetType }).from(energyAssets).where(inArray(energyAssets.id, values));
  if (rows.length !== values.length) return { ok: false as const, message: 'Một hoặc nhiều tài sản lưới liên kết không tồn tại.' };
  const byId = new Map(rows.map((row) => [row.id, row.assetType]));
  const invalid = refs.find((ref) => ref.id && byId.get(ref.id) !== ref.type);
  return invalid ? { ok: false as const, message: `${invalid.label} phải là tài sản loại ${invalid.type}.` } : { ok: true as const };
}

async function measurementPointExists(id: string | null | undefined) {
  if (!id) return true;
  const [row] = await db.select({ id: energyMeasurementPoints.id })
    .from(energyMeasurementPoints)
    .where(eq(energyMeasurementPoints.id, id))
    .limit(1);
  return Boolean(row);
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { linkId } = await context.params;
    const [existing] = await db.select().from(energyCustomerGridServiceLinks).where(eq(energyCustomerGridServiceLinks.id, linkId)).limit(1);
    if (!existing) return NextResponse.json({ message: 'Không tìm thấy liên kết khách hàng–lưới.' }, { status: 404 });
    const current = {
      customerAccountId: existing.customerAccountId,
      servicePointCode: existing.servicePointCode,
      measurementPointId: existing.measurementPointId,
      feederAssetId: existing.feederAssetId,
      bayAssetId: existing.bayAssetId,
      transformerAssetId: existing.transformerAssetId,
      substationAssetId: existing.substationAssetId,
      validFrom: existing.validFrom ? existing.validFrom.toISOString().slice(0, 10) : '',
      validTo: existing.validTo ? existing.validTo.toISOString().slice(0, 10) : '',
      source: existing.source as 'EVN' | 'MANUAL' | 'IMPORT' | 'API' | 'DEMO',
      sourceId: existing.sourceId,
      sourceRef: existing.sourceRef,
      confidence: existing.confidence == null ? null : Number(existing.confidence),
      isInferred: existing.isInferred,
    };
    const payload = customerGridServiceLinkSchema.parse({ ...current, ...await request.json() });
    const [account] = await db.select({ id: energyCustomerAccounts.id }).from(energyCustomerAccounts).where(eq(energyCustomerAccounts.id, payload.customerAccountId)).limit(1);
    if (!account) return NextResponse.json({ message: 'Không tìm thấy tài khoản khách hàng EVN.' }, { status: 404 });
    const assetValidation = await refsExist([
      { id: payload.feederAssetId, type: 'FEEDER', label: 'Feeder' },
      { id: payload.bayAssetId, type: 'BAY', label: 'Bay' },
      { id: payload.transformerAssetId, type: 'TRANSFORMER', label: 'Transformer' },
      { id: payload.substationAssetId, type: 'SUBSTATION', label: 'Substation' },
    ]);
    if (!assetValidation.ok || !await measurementPointExists(payload.measurementPointId)) return NextResponse.json({ message: assetValidation.ok ? 'Điểm đo liên kết không tồn tại.' : assetValidation.message }, { status: 422 });
    const [item] = await db.update(energyCustomerGridServiceLinks).set({
      customerAccountId: payload.customerAccountId,
      servicePointCode: payload.servicePointCode,
      measurementPointId: payload.measurementPointId ?? null,
      feederAssetId: payload.feederAssetId ?? null,
      bayAssetId: payload.bayAssetId ?? null,
      transformerAssetId: payload.transformerAssetId ?? null,
      substationAssetId: payload.substationAssetId ?? null,
      validFrom: parseDate(payload.validFrom),
      validTo: parseDate(payload.validTo),
      source: payload.source,
      sourceId: payload.sourceId ?? null,
      sourceRef: payload.sourceRef?.trim() || null,
      confidence: payload.confidence == null ? null : String(payload.confidence),
      isInferred: payload.isInferred,
      updatedAt: new Date(),
    }).where(eq(energyCustomerGridServiceLinks.id, linkId)).returning();
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin liên kết không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật liên kết.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { linkId } = await context.params;
    const [existing] = await db.select({ id: energyCustomerGridServiceLinks.id }).from(energyCustomerGridServiceLinks).where(eq(energyCustomerGridServiceLinks.id, linkId)).limit(1);
    if (!existing) return NextResponse.json({ message: 'Không tìm thấy liên kết khách hàng–lưới.' }, { status: 404 });
    await db.update(energyCustomerGridServiceLinks).set({ validTo: new Date(), updatedAt: new Date() }).where(eq(energyCustomerGridServiceLinks.id, linkId));
    return NextResponse.json({ deleted: true, archived: true, linkId, message: 'Liên kết đã được kết thúc hiệu lực để bảo toàn lịch sử mapping.' });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể xóa liên kết.' }, { status: 400 });
  }
}
