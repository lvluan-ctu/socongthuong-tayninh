import { count, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  energyConstructionCaseDocuments,
  energyConstructionCaseReviews,
  energyConstructionCases,
  energyConstructionCaseStatusHistory,
  energyConstructionClearanceChecks,
} from '@/db/schema';
import { db } from '@/lib/db';
import { constructionCaseSchema } from '@/lib/safety-schemas';
import { paginatedResponse, parsePagination } from '@/lib/pagination';
import { readConstructionCase } from '@/lib/construction-case-api';

export const dynamic = 'force-dynamic';

function parseGeoJson(value: unknown) {
  if (typeof value !== 'string') return value ?? null;
  try { return JSON.parse(value) as unknown; } catch { return null; }
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const includeArchived = params.get('includeArchived') === 'true';
    const wantsPagination = params.has('page') || params.has('pageSize');
    const pagination = parsePagination(params);
    const where = includeArchived ? undefined : ne(energyConstructionCases.status, 'ARCHIVED');
    const listQuery = db.select().from(energyConstructionCases)
      .where(where)
      .orderBy(desc(energyConstructionCases.updatedAt));
    const rows = wantsPagination
      ? await listQuery.limit(pagination.pageSize).offset(pagination.offset)
      : await listQuery.limit(1000);
    const ids = rows.map((row) => row.id);
    const checks = ids.length
      ? await db.select({ id: energyConstructionClearanceChecks.id, caseId: energyConstructionClearanceChecks.caseId }).from(energyConstructionClearanceChecks).where(inArray(energyConstructionClearanceChecks.caseId, ids))
      : [];
    const checkCounts = new Map<string, number>();
    for (const check of checks) if (check.caseId) checkCounts.set(check.caseId, (checkCounts.get(check.caseId) ?? 0) + 1);
    const totalRows = wantsPagination
      ? await db.select({ value: count() }).from(energyConstructionCases).where(where)
      : [];
    const totalCheckRows = wantsPagination
      ? await db.select({ value: count() }).from(energyConstructionClearanceChecks).innerJoin(energyConstructionCases, eq(energyConstructionClearanceChecks.caseId, energyConstructionCases.id)).where(where)
      : [];
    const items = rows.map((row) => ({ ...row, geometry: parseGeoJson(row.proposedGeometry), checkCount: checkCounts.get(row.id) ?? 0 }));
    const summary = wantsPagination ? { checks: Number(totalCheckRows[0]?.value ?? 0) } : undefined;
    return wantsPagination
      ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0), { summary })
      : NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load construction cases.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = constructionCaseSchema.parse(await request.json());
    const geometryJson = payload.proposedGeometry ? JSON.stringify(payload.proposedGeometry) : null;
    const created = await db.transaction(async (tx) => {
      const result = await tx.execute(sql`
        INSERT INTO energy_construction_cases
          (id, case_code, applicant_name, applicant_organization, address, project_type, description,
           site_id, proposed_geometry, geometry_source, status, source_ref, metadata)
        VALUES
          (gen_random_uuid(), ${payload.caseCode}, ${payload.applicantName ?? null}, ${payload.applicantOrganization ?? null},
           ${payload.address ?? null}, ${payload.projectType}, ${payload.description ?? null}, ${payload.siteId ?? null},
           CASE WHEN ${geometryJson}::text IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON(${geometryJson}::text), 4326) END,
           ${payload.geometrySource}, ${payload.status}, ${payload.sourceRef ?? null}, ${JSON.stringify(payload.metadata ?? {})}::jsonb)
        RETURNING id
      `);
      const row = result.rows[0] as { id?: string } | undefined;
      if (!row?.id) throw new Error('Could not create construction case; geometry may be invalid.');
      await tx.insert(energyConstructionCaseStatusHistory).values({ caseId: row.id, fromStatus: null, toStatus: payload.status, changedBy: null, reason: 'CASE_CREATED' });
      return row.id;
    });
    return NextResponse.json({ item: await readConstructionCase(created) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Construction case is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not create construction case.' }, { status: 400 });
  }
}
