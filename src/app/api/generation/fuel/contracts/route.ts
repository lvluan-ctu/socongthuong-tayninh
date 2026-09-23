import { count, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  energyFuelStorages,
  energyFuelSupplyContracts,
  energyGenerationProjects,
  energyParties,
} from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const schema = z.object({
  projectAssetId: z.string().uuid(),
  storageId: z.string().uuid().nullable().optional(),
  supplierCode: z.string().trim().min(1).max(80),
  supplierName: z.string().trim().min(2).max(250),
  contractNo: z.string().trim().min(1).max(150),
  fuelType: z.string().trim().min(1).max(100),
  contractedQuantity: z.number().positive(),
  unit: z.string().trim().min(1).max(30),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  deliveryRatePerDay: z.number().nonnegative().nullable().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'COMPLETED', 'CANCELLED']).default('ACTIVE'),
  documentRef: z.string().trim().min(2).max(1000),
  notes: z.string().max(4000).nullable().optional(),
}).refine((value) => value.endAt >= value.startAt, {
  path: ['endAt'],
  message: 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.',
});

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function ensureSupplier(code: string | null | undefined, name: string | null | undefined) {
  if (!code || !name) return null;
  const [existing] = await db.select().from(energyParties).where(eq(energyParties.code, code)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(energyParties).values({
    partyType: 'SUPPLIER',
    code,
    name,
    status: 'ACTIVE',
    classification: 'INTERNAL',
  }).returning();
  return created;
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const projectAssetId = params.get('projectAssetId');
    if (!projectAssetId) return NextResponse.json({ message: 'Thiếu projectAssetId.' }, { status: 400 });
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);

    const listQuery = db
      .select({
        id: energyFuelSupplyContracts.id,
        projectAssetId: energyFuelSupplyContracts.projectAssetId,
        storageId: energyFuelSupplyContracts.storageId,
        storageName: energyFuelStorages.name,
        storageCode: energyFuelStorages.code,
        supplierPartyId: energyFuelSupplyContracts.supplierPartyId,
        supplierName: energyParties.name,
        supplierCode: energyParties.code,
        contractNo: energyFuelSupplyContracts.contractNo,
        fuelType: energyFuelSupplyContracts.fuelType,
        contractedQuantity: energyFuelSupplyContracts.contractedQuantity,
        unit: energyFuelSupplyContracts.unit,
        startAt: energyFuelSupplyContracts.startAt,
        endAt: energyFuelSupplyContracts.endAt,
        deliveryRatePerDay: energyFuelSupplyContracts.deliveryRatePerDay,
        status: energyFuelSupplyContracts.status,
        documentRef: energyFuelSupplyContracts.documentRef,
        metadata: energyFuelSupplyContracts.metadata,
      })
      .from(energyFuelSupplyContracts)
      .leftJoin(energyFuelStorages, eq(energyFuelStorages.id, energyFuelSupplyContracts.storageId))
      .leftJoin(energyParties, eq(energyParties.id, energyFuelSupplyContracts.supplierPartyId))
      .where(eq(energyFuelSupplyContracts.projectAssetId, projectAssetId))
      .orderBy(desc(energyFuelSupplyContracts.startAt));
    const rows = wantsPagination
      ? await listQuery.limit(pagination.pageSize).offset(pagination.offset)
      : await listQuery.limit(1000);
    const [totalRows, summaryRows] = wantsPagination
      ? await Promise.all([
        db.select({ value: count() }).from(energyFuelSupplyContracts).where(eq(energyFuelSupplyContracts.projectAssetId, projectAssetId)),
        db.select({
          active: sql<number>`COUNT(*) FILTER (WHERE ${energyFuelSupplyContracts.status} = 'ACTIVE')`,
          deliveryRate: sql<number>`COALESCE(SUM(${energyFuelSupplyContracts.deliveryRatePerDay}), 0)`,
          contractedQuantity: sql<number>`COALESCE(SUM(${energyFuelSupplyContracts.contractedQuantity}), 0)`,
        }).from(energyFuelSupplyContracts).where(eq(energyFuelSupplyContracts.projectAssetId, projectAssetId)),
      ])
      : [[], []];

    const items = rows.map((row) => ({
        ...row,
        contractedQuantity: row.contractedQuantity == null ? null : Number(row.contractedQuantity),
        deliveryRatePerDay: row.deliveryRatePerDay == null ? null : Number(row.deliveryRatePerDay),
      }));
    const summary = summaryRows[0]
      ? { active: Number(summaryRows[0].active ?? 0), deliveryRate: Number(summaryRows[0].deliveryRate ?? 0), contractedQuantity: Number(summaryRows[0].contractedQuantity ?? 0) }
      : undefined;
    return wantsPagination
      ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0), { summary })
      : NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải hợp đồng cung ứng nhiên liệu.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const [project] = await db.select({ id: energyGenerationProjects.assetId }).from(energyGenerationProjects).where(eq(energyGenerationProjects.assetId, payload.projectAssetId)).limit(1);
    if (!project) return NextResponse.json({ message: 'Không tìm thấy dự án nguồn.' }, { status: 404 });

    if (payload.storageId) {
      const [storage] = await db.select({ id: energyFuelStorages.id }).from(energyFuelStorages).where(eq(energyFuelStorages.id, payload.storageId)).limit(1);
      if (!storage) return NextResponse.json({ message: 'Không tìm thấy kho nhiên liệu.' }, { status: 404 });
    }

    const supplier = await ensureSupplier(payload.supplierCode, payload.supplierName);
    const [created] = await db.insert(energyFuelSupplyContracts).values({
      projectAssetId: payload.projectAssetId,
      storageId: payload.storageId ?? null,
      supplierPartyId: supplier?.id ?? null,
      contractNo: payload.contractNo,
      fuelType: payload.fuelType,
      contractedQuantity: payload.contractedQuantity == null ? null : String(payload.contractedQuantity),
      unit: payload.unit ?? null,
      startAt: parseDate(payload.startAt),
      endAt: parseDate(payload.endAt),
      deliveryRatePerDay: payload.deliveryRatePerDay == null ? null : String(payload.deliveryRatePerDay),
      status: payload.status,
      documentRef: payload.documentRef ?? null,
      metadata: { notes: payload.notes ?? null },
    }).returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin hợp đồng cung ứng không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu hợp đồng cung ứng nhiên liệu.' }, { status: 400 });
  }
}
