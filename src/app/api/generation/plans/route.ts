import { asc, count, eq, inArray, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  energyGenerationPlanDocuments,
  energyGenerationPlanningDocuments,
  energyGenerationPlans,
  energyGenerationProjects,
  energyAssets,
} from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const schema = z.object({
  projectAssetId: z.string().uuid(),
  planLevel: z.enum(['NATIONAL', 'PROVINCIAL', 'SECTOR', 'LOCAL', 'OTHER']),
  planCode: z.string().trim().min(1).max(120),
  planName: z.string().trim().min(2).max(300),
  plannedCapacityMw: z.number().positive(),
  expectedOperationYear: z.number().int().min(2000).max(2200),
  status: z.enum(['PROPOSED', 'UNDER_REVIEW', 'APPROVED', 'ADJUSTED', 'SUSPENDED', 'CANCELLED']).default('PROPOSED'),
  meetingMinutesRef: z.string().trim().max(500).nullable().optional(),
  decisionRef: z.string().trim().max(500).nullable().optional(),
  documentIds: z.array(z.string().uuid()).optional().default([]),
  notes: z.string().max(3000).nullable().optional(),
}).superRefine((value, context) => {
  if (value.status === 'APPROVED' && !value.documentIds.length && !value.decisionRef) context.addIssue({ code: 'custom', path: ['documentIds'], message: 'Kế hoạch đã phê duyệt phải có hồ sơ hoặc quyết định làm căn cứ.' });
});

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const projectAssetId = params.get('projectAssetId');
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const where = projectAssetId ? eq(energyGenerationPlans.projectAssetId, projectAssetId) : undefined;

    const listQuery = db
      .select({
        id: energyGenerationPlans.id,
        projectAssetId: energyGenerationPlans.projectAssetId,
        planLevel: energyGenerationPlans.planLevel,
        planCode: energyGenerationPlans.planCode,
        planName: energyGenerationPlans.planName,
        plannedCapacityMw: energyGenerationPlans.plannedCapacityMw,
        expectedOperationYear: energyGenerationPlans.expectedOperationYear,
        status: energyGenerationPlans.status,
        meetingMinutesRef: energyGenerationPlans.meetingMinutesRef,
        decisionRef: energyGenerationPlans.decisionRef,
        metadata: energyGenerationPlans.metadata,
        projectName: energyAssets.name,
        sourceType: energyGenerationProjects.sourceType,
      })
      .from(energyGenerationPlans)
      .innerJoin(energyGenerationProjects, eq(energyGenerationProjects.assetId, energyGenerationPlans.projectAssetId))
      .innerJoin(energyAssets, eq(energyAssets.id, energyGenerationProjects.assetId))
      .where(where)
      .orderBy(asc(energyGenerationPlans.expectedOperationYear), asc(energyGenerationPlans.planName));
    const rows = wantsPagination ? await listQuery.limit(pagination.pageSize).offset(pagination.offset) : await listQuery.limit(1000);
    const [totalRows, summaryRows] = wantsPagination
      ? await Promise.all([
        db.select({ value: count() }).from(energyGenerationPlans).where(where),
        db.select({
          approved: sql<number>`COUNT(*) FILTER (WHERE ${energyGenerationPlans.status} = 'APPROVED')`,
          nationalProjects: sql<number>`COUNT(DISTINCT ${energyGenerationPlans.projectAssetId}) FILTER (WHERE ${energyGenerationPlans.planLevel} = 'NATIONAL')`,
          provincialProjects: sql<number>`COUNT(DISTINCT ${energyGenerationPlans.projectAssetId}) FILTER (WHERE ${energyGenerationPlans.planLevel} IN ('PROVINCIAL', 'PROVINCE'))`,
          nationalCapacityMw: sql<string>`COALESCE(SUM(${energyGenerationPlans.plannedCapacityMw}::numeric) FILTER (WHERE ${energyGenerationPlans.planLevel} = 'NATIONAL'), 0)`,
          provincialCapacityMw: sql<string>`COALESCE(SUM(${energyGenerationPlans.plannedCapacityMw}::numeric) FILTER (WHERE ${energyGenerationPlans.planLevel} IN ('PROVINCIAL', 'PROVINCE')), 0)`,
        }).from(energyGenerationPlans).where(where),
      ])
      : [[], []];

    const planIds = rows.map((row) => row.id);
    const links = planIds.length
      ? await db
        .select({
          planId: energyGenerationPlanDocuments.planId,
          documentId: energyGenerationPlanDocuments.documentId,
          relationType: energyGenerationPlanDocuments.relationType,
          documentTitle: energyGenerationPlanningDocuments.title,
          documentType: energyGenerationPlanningDocuments.documentType,
          documentNo: energyGenerationPlanningDocuments.documentNo,
        })
        .from(energyGenerationPlanDocuments)
        .innerJoin(energyGenerationPlanningDocuments, eq(energyGenerationPlanningDocuments.id, energyGenerationPlanDocuments.documentId))
        .where(inArray(energyGenerationPlanDocuments.planId, planIds))
      : [];

    const items = rows.map((row) => ({
        ...row,
        plannedCapacityMw: row.plannedCapacityMw == null ? null : Number(row.plannedCapacityMw),
        expectedOperationYear: row.expectedOperationYear == null ? null : Number(row.expectedOperationYear),
        documents: links.filter((link) => link.planId === row.id),
      }));
    const summary = summaryRows[0] ? {
      approved: Number(summaryRows[0].approved ?? 0),
      nationalProjects: Number(summaryRows[0].nationalProjects ?? 0),
      provincialProjects: Number(summaryRows[0].provincialProjects ?? 0),
      nationalCapacityMw: Number(summaryRows[0].nationalCapacityMw ?? 0),
      provincialCapacityMw: Number(summaryRows[0].provincialCapacityMw ?? 0),
    } : undefined;
    return wantsPagination
      ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0), { summary })
      : NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải kế hoạch/quy hoạch.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const [project] = await db.select({ id: energyGenerationProjects.assetId }).from(energyGenerationProjects).where(eq(energyGenerationProjects.assetId, payload.projectAssetId)).limit(1);
    if (!project) return NextResponse.json({ message: 'Không tìm thấy dự án nguồn.' }, { status: 404 });

    const created = await db.transaction(async (tx) => {
      const [plan] = await tx.insert(energyGenerationPlans).values({
        projectAssetId: payload.projectAssetId,
        planLevel: payload.planLevel,
        planCode: payload.planCode ?? null,
        planName: payload.planName,
        plannedCapacityMw: payload.plannedCapacityMw == null ? null : String(payload.plannedCapacityMw),
        expectedOperationYear: payload.expectedOperationYear == null ? null : String(payload.expectedOperationYear),
        status: payload.status,
        meetingMinutesRef: payload.meetingMinutesRef ?? null,
        decisionRef: payload.decisionRef ?? null,
        metadata: { notes: payload.notes ?? null },
      }).returning();

      if (payload.documentIds.length > 0) {
        await tx.insert(energyGenerationPlanDocuments).values(payload.documentIds.map((documentId, index) => ({
          planId: plan.id,
          documentId,
          relationType: 'BASIS',
          sequenceNo: index + 1,
        }))).onConflictDoNothing();
      }
      return plan;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin kế hoạch/quy hoạch không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu kế hoạch/quy hoạch.' }, { status: 400 });
  }
}
