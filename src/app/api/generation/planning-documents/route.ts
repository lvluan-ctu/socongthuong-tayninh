import { count, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyAssets, energyGenerationPlanningDocuments } from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const schema = z.object({
  projectAssetId: z.string().uuid().nullable().optional(),
  documentType: z.enum(['MEETING_MINUTES', 'DECISION', 'PLAN', 'APPROVAL', 'REPORT', 'PROPOSAL', 'OTHER']),
  documentNo: z.string().trim().min(1).max(150),
  title: z.string().trim().min(2).max(500),
  issuingAuthority: z.string().trim().min(2).max(250),
  issuedAt: z.string().min(1),
  effectiveFrom: z.string().nullable().optional(),
  planLevel: z.enum(['NATIONAL', 'PROVINCIAL', 'SECTOR', 'LOCAL', 'OTHER']).nullable().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'SUPERSEDED', 'EXPIRED', 'CANCELLED']).default('ACTIVE'),
  fileRef: z.string().trim().min(2).max(1000),
  notes: z.string().max(4000).nullable().optional(),
});

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const projectAssetId = params.get('projectAssetId');
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const where = projectAssetId ? eq(energyGenerationPlanningDocuments.projectAssetId, projectAssetId) : undefined;
    const query = db.select({
      id: energyGenerationPlanningDocuments.id,
      projectAssetId: energyGenerationPlanningDocuments.projectAssetId,
      documentType: energyGenerationPlanningDocuments.documentType,
      documentNo: energyGenerationPlanningDocuments.documentNo,
      title: energyGenerationPlanningDocuments.title,
      issuingAuthority: energyGenerationPlanningDocuments.issuingAuthority,
      issuedAt: energyGenerationPlanningDocuments.issuedAt,
      effectiveFrom: energyGenerationPlanningDocuments.effectiveFrom,
      planLevel: energyGenerationPlanningDocuments.planLevel,
      status: energyGenerationPlanningDocuments.status,
      fileRef: energyGenerationPlanningDocuments.fileRef,
      notes: energyGenerationPlanningDocuments.notes,
      metadata: energyGenerationPlanningDocuments.metadata,
      createdAt: energyGenerationPlanningDocuments.createdAt,
      projectName: energyAssets.name,
    }).from(energyGenerationPlanningDocuments)
      .leftJoin(energyAssets, eq(energyAssets.id, energyGenerationPlanningDocuments.projectAssetId))
      .where(where)
      .orderBy(desc(energyGenerationPlanningDocuments.issuedAt), desc(energyGenerationPlanningDocuments.createdAt));
    const rows = wantsPagination ? await query.limit(pagination.pageSize).offset(pagination.offset) : await query.limit(1000);
    const [totalRows, summaryRows] = wantsPagination
      ? await Promise.all([
        db.select({ value: count() }).from(energyGenerationPlanningDocuments).where(where),
        db.select({
          meetings: sql<number>`COUNT(*) FILTER (WHERE ${energyGenerationPlanningDocuments.documentType} = 'MEETING_MINUTES')`,
          decisions: sql<number>`COUNT(*) FILTER (WHERE ${energyGenerationPlanningDocuments.documentType} IN ('DECISION', 'APPROVAL'))`,
        }).from(energyGenerationPlanningDocuments).where(where),
      ])
      : [[], []];
    const summary = summaryRows[0] ? {
      meetings: Number(summaryRows[0].meetings ?? 0),
      decisions: Number(summaryRows[0].decisions ?? 0),
    } : undefined;
    return wantsPagination
      ? paginatedResponse(rows, pagination, Number(totalRows[0]?.value ?? 0), { summary })
      : NextResponse.json({ items: rows });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải hồ sơ quy hoạch.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const [created] = await db.insert(energyGenerationPlanningDocuments).values({
      projectAssetId: payload.projectAssetId ?? null,
      documentType: payload.documentType,
      documentNo: payload.documentNo ?? null,
      title: payload.title,
      issuingAuthority: payload.issuingAuthority ?? null,
      issuedAt: parseDate(payload.issuedAt),
      effectiveFrom: parseDate(payload.effectiveFrom),
      planLevel: payload.planLevel ?? null,
      status: payload.status,
      fileRef: payload.fileRef ?? null,
      notes: payload.notes ?? null,
      metadata: {},
    }).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin tài liệu quy hoạch không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu tài liệu quy hoạch.' }, { status: 400 });
  }
}
