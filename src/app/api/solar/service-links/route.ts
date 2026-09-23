import { aliasedTable, and, desc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyAssets, energyCustomerAccounts, energyCustomerGridServiceLinks, energyMeasurementPoints } from '@/db/schema';
import { customerGridServiceLinkSchema } from '@/lib/solar-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const feeder = aliasedTable(energyAssets, 'service_link_feeder');
const bay = aliasedTable(energyAssets, 'service_link_bay');
const transformer = aliasedTable(energyAssets, 'service_link_transformer');
const substation = aliasedTable(energyAssets, 'service_link_substation');

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function selectLinks() {
  return db.select({
    id: energyCustomerGridServiceLinks.id,
    customerAccountId: energyCustomerGridServiceLinks.customerAccountId,
    servicePointCode: energyCustomerGridServiceLinks.servicePointCode,
    measurementPointId: energyCustomerGridServiceLinks.measurementPointId,
    measurementPointCode: energyMeasurementPoints.code,
    measurementPointName: energyMeasurementPoints.name,
    feederAssetId: energyCustomerGridServiceLinks.feederAssetId,
    feederCode: feeder.code,
    feederName: feeder.name,
    bayAssetId: energyCustomerGridServiceLinks.bayAssetId,
    bayCode: bay.code,
    bayName: bay.name,
    transformerAssetId: energyCustomerGridServiceLinks.transformerAssetId,
    transformerCode: transformer.code,
    transformerName: transformer.name,
    substationAssetId: energyCustomerGridServiceLinks.substationAssetId,
    substationCode: substation.code,
    substationName: substation.name,
    validFrom: energyCustomerGridServiceLinks.validFrom,
    validTo: energyCustomerGridServiceLinks.validTo,
    source: energyCustomerGridServiceLinks.source,
    sourceId: energyCustomerGridServiceLinks.sourceId,
    sourceRef: energyCustomerGridServiceLinks.sourceRef,
    confidence: energyCustomerGridServiceLinks.confidence,
    isInferred: energyCustomerGridServiceLinks.isInferred,
    metadata: energyCustomerGridServiceLinks.metadata,
    createdAt: energyCustomerGridServiceLinks.createdAt,
    updatedAt: energyCustomerGridServiceLinks.updatedAt,
  }).from(energyCustomerGridServiceLinks)
    .leftJoin(energyMeasurementPoints, eq(energyMeasurementPoints.id, energyCustomerGridServiceLinks.measurementPointId))
    .leftJoin(feeder, eq(feeder.id, energyCustomerGridServiceLinks.feederAssetId))
    .leftJoin(bay, eq(bay.id, energyCustomerGridServiceLinks.bayAssetId))
    .leftJoin(transformer, eq(transformer.id, energyCustomerGridServiceLinks.transformerAssetId))
    .leftJoin(substation, eq(substation.id, energyCustomerGridServiceLinks.substationAssetId));
}

function serialize(row: Record<string, unknown>) {
  return { ...row, confidence: row.confidence == null ? null : Number(row.confidence) };
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const customerAccountId = params.get('customerAccountId');
    const source = params.get('source');
    const inferred = params.get('isInferred');
    const conditions = [
      customerAccountId ? eq(energyCustomerGridServiceLinks.customerAccountId, customerAccountId) : undefined,
      source ? eq(energyCustomerGridServiceLinks.source, source) : undefined,
      inferred === 'true' ? eq(energyCustomerGridServiceLinks.isInferred, true) : inferred === 'false' ? eq(energyCustomerGridServiceLinks.isInferred, false) : undefined,
    ].filter((item): item is NonNullable<typeof item> => item != null);
    const rows = await selectLinks().where(conditions.length ? and(...conditions) : undefined).orderBy(desc(energyCustomerGridServiceLinks.validFrom), desc(energyCustomerGridServiceLinks.createdAt)).limit(500);
    return NextResponse.json({ items: rows.map((row) => serialize(row as unknown as Record<string, unknown>)) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải liên kết khách hàng–lưới.' }, { status: 500 });
  }
}

async function validateAssetRefs(refs: Array<{ id: string | null | undefined; type: string; label: string }>) {
  const values = Array.from(new Set(refs.map((ref) => ref.id).filter((id): id is string => Boolean(id))));
  if (!values.length) return { ok: true as const };
  const rows = await db.select({ id: energyAssets.id, assetType: energyAssets.assetType }).from(energyAssets).where(inArray(energyAssets.id, values));
  if (rows.length !== values.length) return { ok: false as const, message: 'Một hoặc nhiều tài sản lưới liên kết không tồn tại.' };
  const byId = new Map(rows.map((row) => [row.id, row.assetType]));
  const invalid = refs.find((ref) => ref.id && byId.get(ref.id) !== ref.type);
  return invalid ? { ok: false as const, message: `${invalid.label} phải là tài sản loại ${invalid.type}.` } : { ok: true as const };
}

async function validateMeasurementPointRef(id: string | null | undefined) {
  if (!id) return true;
  const [row] = await db.select({ id: energyMeasurementPoints.id })
    .from(energyMeasurementPoints)
    .where(eq(energyMeasurementPoints.id, id))
    .limit(1);
  return Boolean(row);
}

export async function POST(request: Request) {
  try {
    const payload = customerGridServiceLinkSchema.parse(await request.json());
    const [account] = await db.select({ id: energyCustomerAccounts.id }).from(energyCustomerAccounts).where(eq(energyCustomerAccounts.id, payload.customerAccountId)).limit(1);
    if (!account) return NextResponse.json({ message: 'Không tìm thấy tài khoản khách hàng EVN.' }, { status: 404 });
    const assetValidation = await validateAssetRefs([
      { id: payload.feederAssetId, type: 'FEEDER', label: 'Feeder' },
      { id: payload.bayAssetId, type: 'BAY', label: 'Bay' },
      { id: payload.transformerAssetId, type: 'TRANSFORMER', label: 'Transformer' },
      { id: payload.substationAssetId, type: 'SUBSTATION', label: 'Substation' },
    ]);
    if (!assetValidation.ok || !await validateMeasurementPointRef(payload.measurementPointId)) return NextResponse.json({ message: assetValidation.ok ? 'Điểm đo liên kết không tồn tại.' : assetValidation.message }, { status: 422 });
    const [item] = await db.insert(energyCustomerGridServiceLinks).values({
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
    }).returning();
    return NextResponse.json({ item: serialize(item as unknown as Record<string, unknown>) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin liên kết khách hàng–lưới không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tạo liên kết khách hàng–lưới.' }, { status: 400 });
  }
}
