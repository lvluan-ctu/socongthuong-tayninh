import { asc, count, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyGenerationProjects, energyGenerationUnits } from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const schema = z.object({
  projectAssetId: z.string().uuid(),
  code: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(250),
  unitType: z.string().trim().min(1).max(100),
  designedCapacityMw: z.number().positive('Công suất thiết kế phải lớn hơn 0'),
  availableCapacityMw: z.number().nonnegative().nullable().optional(),
  manufacturer: z.string().trim().max(200).nullable().optional(),
  model: z.string().trim().max(200).nullable().optional(),
  serialNumber: z.string().trim().max(200).nullable().optional(),
  commissionedAt: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'OUTAGE', 'PLANNED', 'RETIRED']).default('ACTIVE'),
  technicalSpecs: z.record(z.string(), z.unknown()).optional().default({}),
}).superRefine((value, context) => {
  if (value.status === 'ACTIVE' && !value.commissionedAt) context.addIssue({ code: 'custom', path: ['commissionedAt'], message: 'Tổ máy đang hoạt động phải có ngày vận hành.' });
  if (value.availableCapacityMw != null && value.availableCapacityMw > value.designedCapacityMw * 1.2) context.addIssue({ code: 'custom', path: ['availableCapacityMw'], message: 'Công suất khả dụng vượt 120% thiết kế.' });
});

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const projectAssetId = params.get('projectAssetId');
    if (!projectAssetId) return NextResponse.json({ message: 'Thiếu projectAssetId.' }, { status: 400 });
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);

    const listQuery = db
      .select()
      .from(energyGenerationUnits)
      .where(eq(energyGenerationUnits.projectAssetId, projectAssetId))
      .orderBy(asc(energyGenerationUnits.code));
    const rows = wantsPagination
      ? await listQuery.limit(pagination.pageSize).offset(pagination.offset)
      : await listQuery.limit(1000);
    const [totalRows, summaryRows] = wantsPagination
      ? await Promise.all([
        db.select({ value: count() }).from(energyGenerationUnits).where(eq(energyGenerationUnits.projectAssetId, projectAssetId)),
        db.select({ designed: sql<number>`COALESCE(SUM(${energyGenerationUnits.designedCapacityMw}), 0)`, available: sql<number>`COALESCE(SUM(${energyGenerationUnits.availableCapacityMw}), 0)` }).from(energyGenerationUnits).where(eq(energyGenerationUnits.projectAssetId, projectAssetId)),
      ])
      : [[], []];

    const items = rows.map((row) => ({
        ...row,
        designedCapacityMw: row.designedCapacityMw == null ? null : Number(row.designedCapacityMw),
        availableCapacityMw: row.availableCapacityMw == null ? null : Number(row.availableCapacityMw),
      }));
    const summary = summaryRows[0]
      ? { designed: Number(summaryRows[0].designed ?? 0), available: Number(summaryRows[0].available ?? 0) }
      : undefined;
    return wantsPagination
      ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0), { summary })
      : NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải danh sách tổ máy.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const [project] = await db.select({ id: energyGenerationProjects.assetId }).from(energyGenerationProjects).where(eq(energyGenerationProjects.assetId, payload.projectAssetId)).limit(1);
    if (!project) return NextResponse.json({ message: 'Không tìm thấy dự án nguồn.' }, { status: 404 });
    const commissionedAt = payload.commissionedAt ? new Date(`${payload.commissionedAt}T00:00:00+07:00`) : null;
    if (commissionedAt && Number.isNaN(commissionedAt.getTime())) return NextResponse.json({ message: 'Ngày vận hành tổ máy không hợp lệ.' }, { status: 400 });

    const [created] = await db.insert(energyGenerationUnits).values({
      projectAssetId: payload.projectAssetId,
      code: payload.code,
      name: payload.name,
      unitType: payload.unitType,
      designedCapacityMw: payload.designedCapacityMw == null ? null : String(payload.designedCapacityMw),
      availableCapacityMw: payload.availableCapacityMw == null ? null : String(payload.availableCapacityMw),
      manufacturer: payload.manufacturer ?? null,
      model: payload.model ?? null,
      serialNumber: payload.serialNumber ?? null,
      commissionedAt,
      status: payload.status,
      technicalSpecs: payload.technicalSpecs,
    }).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin tổ máy không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tạo tổ máy.' }, { status: 400 });
  }
}
