import { asc, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyCarbonProjects, energyParties, energySites } from '@/db/schema';
import { carbonProjectSchema } from '@/lib/carbon-schemas';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';
function dateOrNull(value: string | null | undefined) { return value ? new Date(value) : null; }
function databaseCode(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : undefined; }

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const listQuery = db.select({ project: energyCarbonProjects, partyName: energyParties.name, siteName: energySites.name })
      .from(energyCarbonProjects)
      .leftJoin(energyParties, eq(energyParties.id, energyCarbonProjects.partyId))
      .leftJoin(energySites, eq(energySites.id, energyCarbonProjects.siteId))
      .orderBy(asc(energyCarbonProjects.name));
    const rows = wantsPagination ? await listQuery.limit(pagination.pageSize).offset(pagination.offset) : await listQuery.limit(1000);
    const totalRows = wantsPagination ? await db.select({ value: count() }).from(energyCarbonProjects) : [];
    const items = rows.map(({ project, ...related }) => ({ ...project, ...related }));
    return wantsPagination
      ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0))
      : NextResponse.json({ items });
  } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải carbon projects.' }, { status: 500 }); }
}

async function validateReferences(partyId: string | null | undefined, siteId: string | null | undefined) {
  if (partyId) { const [party] = await db.select({ id: energyParties.id }).from(energyParties).where(eq(energyParties.id, partyId)).limit(1); if (!party) return 'Không tìm thấy đơn vị của carbon project.'; }
  if (siteId) { const [site] = await db.select({ id: energySites.id }).from(energySites).where(eq(energySites.id, siteId)).limit(1); if (!site) return 'Không tìm thấy Site của carbon project.'; }
  return null;
}

export async function POST(request: Request) {
  try {
    const payload = carbonProjectSchema.parse(await request.json()); const referenceError = await validateReferences(payload.partyId, payload.siteId); if (referenceError) return NextResponse.json({ message: referenceError }, { status: 400 });
    const [created] = await db.insert(energyCarbonProjects).values({ code: payload.code, name: payload.name, partyId: payload.partyId ?? null, siteId: payload.siteId ?? null, projectType: payload.projectType, methodology: payload.methodology, registry: payload.registry ?? null, validationRef: payload.validationRef ?? null, verificationRef: payload.verificationRef ?? null, startDate: dateOrNull(payload.startDate), creditingPeriodFrom: dateOrNull(payload.creditingPeriodFrom), creditingPeriodTo: dateOrNull(payload.creditingPeriodTo), status: payload.status, notes: payload.notes ?? null, metadata: payload.metadata ?? { source: 'MANUAL' } }).returning();
    return NextResponse.json({ item: created }, { status: 201 });
  } catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ message: 'Carbon project không hợp lệ.', issues: error.issues }, { status: 400 }); if (databaseCode(error) === '23505') return NextResponse.json({ message: 'Mã carbon project đã tồn tại.' }, { status: 409 }); return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tạo carbon project.' }, { status: 400 }); }
}
