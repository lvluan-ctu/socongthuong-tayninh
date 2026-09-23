import { count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  energyAssets,
  energyGenerationProjects,
  energyParties,
  energySites,
} from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const payloadSchema = z.object({
  code: z.string().trim().min(2).max(80),
  name: z.string().trim().min(3).max(250),
  sourceType: z.enum(['SOLAR', 'WIND', 'HYDRO', 'BIOMASS', 'WASTE_TO_ENERGY', 'LNG', 'OTHER']),
  designedCapacityMw: z.number().positive(),
  actualCapacityMw: z.number().nonnegative().nullable().optional(),
  operationStatus: z.enum(['PLANNED', 'PREPARING_INVESTMENT', 'CONSTRUCTION', 'OPERATING', 'SUSPENDED', 'DECOMMISSIONED']),
  commissionedAt: z.string().nullable().optional(),
  investorCode: z.string().trim().min(2).max(80),
  investorName: z.string().trim().min(2).max(250),
  operatorCode: z.string().trim().max(80).nullable().optional(),
  operatorName: z.string().trim().max(250).nullable().optional(),
  siteCode: z.string().trim().min(2).max(80),
  siteName: z.string().trim().min(2).max(250),
  address: z.string().trim().min(3).max(500),
  adminAreaCode: z.string().trim().min(1).max(50),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  gridConnectionAssetId: z.string().uuid().nullable().optional(),
  technology: z.string().max(200).nullable().optional(),
  unitCount: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
}).superRefine((value, context) => {
  if (Boolean(value.operatorCode) !== Boolean(value.operatorName)) context.addIssue({ code: 'custom', path: value.operatorCode ? ['operatorName'] : ['operatorCode'], message: 'Phải nhập đồng thời mã và tên đơn vị vận hành.' });
  if (value.operationStatus === 'OPERATING' && !value.commissionedAt) context.addIssue({ code: 'custom', path: ['commissionedAt'], message: 'Dự án đang vận hành phải có ngày vận hành.' });
  if (value.operationStatus === 'OPERATING' && value.actualCapacityMw == null) context.addIssue({ code: 'custom', path: ['actualCapacityMw'], message: 'Dự án đang vận hành phải có công suất thực tế.' });
  if (value.actualCapacityMw != null && value.actualCapacityMw > value.designedCapacityMw * 1.5) context.addIssue({ code: 'custom', path: ['actualCapacityMw'], message: 'Công suất thực tế vượt 150% công suất thiết kế.' });
});

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function ensureParty(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  code: string,
  name: string,
  partyType: string,
) {
  const [existing] = await tx.select().from(energyParties).where(eq(energyParties.code, code)).limit(1);
  if (existing) {
    if (existing.name !== name) {
      const [updated] = await tx.update(energyParties).set({ name, updatedAt: new Date() }).where(eq(energyParties.id, existing.id)).returning();
      return updated;
    }
    return existing;
  }
  const [created] = await tx.insert(energyParties).values({
    partyType,
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
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const listQuery = db
      .select({
        assetId: energyGenerationProjects.assetId,
        code: energyAssets.code,
        name: energyAssets.name,
        status: energyAssets.status,
        commissionedAt: energyAssets.commissionedAt,
        siteId: energyGenerationProjects.siteId,
        siteName: energySites.name,
        address: energySites.address,
        adminAreaCode: energySites.adminAreaCode,
        sourceType: energyGenerationProjects.sourceType,
        designedCapacityMw: energyGenerationProjects.designedCapacityMw,
        actualCapacityMw: energyGenerationProjects.actualCapacityMw,
        operationStatus: energyGenerationProjects.operationStatus,
        investorPartyId: energyGenerationProjects.investorPartyId,
        operatorPartyId: energyGenerationProjects.operatorPartyId,
        gridConnectionAssetId: energyGenerationProjects.gridConnectionAssetId,
        technicalSpecs: energyGenerationProjects.technicalSpecs,
      })
      .from(energyGenerationProjects)
      .innerJoin(energyAssets, eq(energyAssets.id, energyGenerationProjects.assetId))
      .leftJoin(energySites, eq(energySites.id, energyGenerationProjects.siteId))
      .orderBy(energyAssets.name);
    const rows = wantsPagination
      ? await listQuery.limit(pagination.pageSize).offset(pagination.offset)
      : await listQuery;
    const totalRows = wantsPagination
      ? await db.select({ value: count() }).from(energyGenerationProjects)
      : [];

    const partyIds = Array.from(new Set(rows.flatMap((row) => [row.investorPartyId, row.operatorPartyId]).filter((id): id is string => Boolean(id))));
    const parties = partyIds.length
      ? await db.select({ id: energyParties.id, code: energyParties.code, name: energyParties.name }).from(energyParties)
      : [];
    const partyMap = new Map(parties.map((party) => [party.id, party]));

    const items = rows.map((row) => ({
        ...row,
        designedCapacityMw: Number(row.designedCapacityMw),
        actualCapacityMw: row.actualCapacityMw == null ? null : Number(row.actualCapacityMw),
        investor: row.investorPartyId ? partyMap.get(row.investorPartyId) ?? null : null,
        operator: row.operatorPartyId ? partyMap.get(row.operatorPartyId) ?? null : null,
      }));
    return wantsPagination ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0)) : NextResponse.json({ items });
  } catch (error) {
    console.error('Generation project list failed', error);
    return NextResponse.json({ message: 'Không thể tải danh sách dự án nguồn.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = payloadSchema.parse(await request.json());

    const result = await db.transaction(async (tx) => {
      const [duplicateAsset] = await tx.select({ id: energyAssets.id }).from(energyAssets).where(eq(energyAssets.code, payload.code)).limit(1);
      if (duplicateAsset) throw new Error(`Mã dự án ${payload.code} đã tồn tại.`);

      const investor = await ensureParty(tx, payload.investorCode, payload.investorName, 'INVESTOR');
      const operator = payload.operatorCode && payload.operatorName
        ? await ensureParty(tx, payload.operatorCode, payload.operatorName, 'OPERATOR')
        : null;

      let [site] = await tx.select().from(energySites).where(eq(energySites.code, payload.siteCode)).limit(1);
      const location = payload.latitude != null && payload.longitude != null
        ? `SRID=4326;POINT(${payload.longitude} ${payload.latitude})`
        : null;
      if (!site) {
        [site] = await tx.insert(energySites).values({
          partyId: investor.id,
          code: payload.siteCode,
          name: payload.siteName,
          siteType: 'GENERATION_SITE',
          address: payload.address ?? null,
          adminAreaCode: payload.adminAreaCode ?? null,
          location,
          classification: 'INTERNAL',
          status: 'ACTIVE',
          metadata: { createdBy: 'generation-project-api' },
        }).returning();
      } else {
        [site] = await tx.update(energySites).set({
          partyId: investor.id,
          name: payload.siteName,
          address: payload.address ?? site.address,
          adminAreaCode: payload.adminAreaCode ?? site.adminAreaCode,
          location: location ?? site.location,
          updatedAt: new Date(),
        }).where(eq(energySites.id, site.id)).returning();
      }

      const [asset] = await tx.insert(energyAssets).values({
        siteId: site.id,
        ownerPartyId: investor.id,
        assetType: 'GENERATION_PROJECT',
        code: payload.code,
        name: payload.name,
        status: payload.operationStatus === 'OPERATING' ? 'ACTIVE' : payload.operationStatus,
        commissionedAt: parseDate(payload.commissionedAt),
        location,
        classification: 'INTERNAL',
        metadata: { source: 'MANUAL', module: 'generation' },
      }).returning();

      const [project] = await tx.insert(energyGenerationProjects).values({
        assetId: asset.id,
        siteId: site.id,
        investorPartyId: investor.id,
        operatorPartyId: operator?.id ?? null,
        sourceType: payload.sourceType,
        designedCapacityMw: String(payload.designedCapacityMw),
        actualCapacityMw: payload.actualCapacityMw == null ? null : String(payload.actualCapacityMw),
        operationStatus: payload.operationStatus,
        gridConnectionAssetId: payload.gridConnectionAssetId ?? null,
        technicalSpecs: {
          technology: payload.technology,
          unitCount: payload.unitCount,
          notes: payload.notes,
        },
      }).returning();

      return { asset, project, site, investor, operator };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Dữ liệu dự án không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tạo dự án nguồn.' }, { status: 400 });
  }
}
