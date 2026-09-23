import { count, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyAssets, energyFuelMovements, energyFuelStorages, energyGenerationProjects } from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const schema = z.object({
  storageId: z.string().uuid(),
  movementType: z.enum(['INBOUND', 'CONSUMPTION', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT_PLUS', 'ADJUSTMENT_MINUS']),
  quantity: z.number().positive(),
  unit: z.string().trim().min(1).max(30),
  occurredAt: z.string().min(1),
  supplierPartyId: z.string().uuid().nullable().optional(),
  referenceNo: z.string().trim().max(150).nullable().optional(),
  documentRef: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const storageId = params.get('storageId');
  const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
  const pagination = parsePagination(params);
  const where = storageId ? eq(energyFuelMovements.storageId, storageId) : undefined;
  const listQuery = db.select({
    id: energyFuelMovements.id,
    storageId: energyFuelMovements.storageId,
    movementType: energyFuelMovements.movementType,
    quantity: energyFuelMovements.quantity,
    unit: energyFuelMovements.unit,
    occurredAt: energyFuelMovements.occurredAt,
    supplierPartyId: energyFuelMovements.supplierPartyId,
    referenceNo: energyFuelMovements.referenceNo,
    documentRef: energyFuelMovements.documentRef,
    notes: energyFuelMovements.notes,
    storageCode: energyFuelStorages.code,
    storageName: energyFuelStorages.name,
    fuelType: energyFuelStorages.fuelType,
    projectAssetId: energyFuelStorages.projectAssetId,
    projectName: energyAssets.name,
  }).from(energyFuelMovements)
    .innerJoin(energyFuelStorages, eq(energyFuelStorages.id, energyFuelMovements.storageId))
    .innerJoin(energyGenerationProjects, eq(energyGenerationProjects.assetId, energyFuelStorages.projectAssetId))
    .innerJoin(energyAssets, eq(energyAssets.id, energyGenerationProjects.assetId))
    .where(where)
    .orderBy(desc(energyFuelMovements.occurredAt));
  const rows = wantsPagination
    ? await listQuery.limit(pagination.pageSize).offset(pagination.offset)
    : await listQuery.limit(500);
  const totalRows = wantsPagination
    ? await db.select({ value: count() }).from(energyFuelMovements).where(where)
    : [];
  const items = rows.map((row) => ({ ...row, quantity: Number(row.quantity) }));
  return wantsPagination
    ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0))
    : NextResponse.json({ items });
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const [storage] = await db.select().from(energyFuelStorages).where(eq(energyFuelStorages.id, payload.storageId)).limit(1);
    if (!storage) return NextResponse.json({ message: 'Không tìm thấy kho nhiên liệu.' }, { status: 404 });
    if (storage.unit !== payload.unit) {
      return NextResponse.json({ message: `Đơn vị giao dịch phải cùng đơn vị kho (${storage.unit}).` }, { status: 400 });
    }
    const occurredAt = new Date(payload.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) return NextResponse.json({ message: 'Thời điểm giao dịch không hợp lệ.' }, { status: 400 });

    const [created] = await db.insert(energyFuelMovements).values({
      storageId: payload.storageId,
      movementType: payload.movementType,
      quantity: String(payload.quantity),
      unit: payload.unit,
      occurredAt,
      supplierPartyId: payload.supplierPartyId ?? null,
      referenceNo: payload.referenceNo ?? null,
      documentRef: payload.documentRef ?? null,
      notes: payload.notes ?? null,
    }).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Dữ liệu nhập/xuất nhiên liệu không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể ghi sổ nhiên liệu.' }, { status: 400 });
  }
}
