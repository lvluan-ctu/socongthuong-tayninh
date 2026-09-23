import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyCarbonProjects, energyParties, energySites } from '@/db/schema';
import { carbonProjectPatchSchema } from '@/lib/carbon-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ projectId: string }> };
function dateOrNull(value: string | null | undefined) { return value ? new Date(value) : null; }
async function read(projectId: string) { const [row] = await db.select({ project: energyCarbonProjects, partyName: energyParties.name, siteName: energySites.name }).from(energyCarbonProjects).leftJoin(energyParties, eq(energyParties.id, energyCarbonProjects.partyId)).leftJoin(energySites, eq(energySites.id, energyCarbonProjects.siteId)).where(eq(energyCarbonProjects.id, projectId)).limit(1); return row ? { ...row.project, partyName: row.partyName, siteName: row.siteName } : null; }

export async function GET(_request: Request, context: RouteContext) { const { projectId } = await context.params; const item = await read(projectId); return item ? NextResponse.json({ item }) : NextResponse.json({ message: 'Không tìm thấy carbon project.' }, { status: 404 }); }

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params; const payload = carbonProjectPatchSchema.parse(await request.json()); const current = await read(projectId); if (!current) return NextResponse.json({ message: 'Không tìm thấy carbon project.' }, { status: 404 }); if (Object.keys(payload).length === 0) return NextResponse.json({ message: 'Không có trường nào được cập nhật.' }, { status: 400 });
    if (payload.partyId) { const [party] = await db.select({ id: energyParties.id }).from(energyParties).where(eq(energyParties.id, payload.partyId)).limit(1); if (!party) return NextResponse.json({ message: 'Không tìm thấy đơn vị của carbon project.' }, { status: 400 }); }
    if (payload.siteId) { const [site] = await db.select({ id: energySites.id }).from(energySites).where(eq(energySites.id, payload.siteId)).limit(1); if (!site) return NextResponse.json({ message: 'Không tìm thấy Site của carbon project.' }, { status: 400 }); }
    const from = payload.creditingPeriodFrom === undefined ? current.creditingPeriodFrom : dateOrNull(payload.creditingPeriodFrom); const to = payload.creditingPeriodTo === undefined ? current.creditingPeriodTo : dateOrNull(payload.creditingPeriodTo); if (from && to && to < from) return NextResponse.json({ message: 'Crediting period không hợp lệ.' }, { status: 400 });
    const [updated] = await db.update(energyCarbonProjects).set({ ...(payload.name === undefined ? {} : { name: payload.name }), ...(payload.partyId === undefined ? {} : { partyId: payload.partyId }), ...(payload.siteId === undefined ? {} : { siteId: payload.siteId }), ...(payload.projectType === undefined ? {} : { projectType: payload.projectType }), ...(payload.methodology === undefined ? {} : { methodology: payload.methodology }), ...(payload.registry === undefined ? {} : { registry: payload.registry }), ...(payload.validationRef === undefined ? {} : { validationRef: payload.validationRef }), ...(payload.verificationRef === undefined ? {} : { verificationRef: payload.verificationRef }), ...(payload.startDate === undefined ? {} : { startDate: dateOrNull(payload.startDate) }), ...(payload.creditingPeriodFrom === undefined ? {} : { creditingPeriodFrom: from }), ...(payload.creditingPeriodTo === undefined ? {} : { creditingPeriodTo: to }), ...(payload.status === undefined ? {} : { status: payload.status }), ...(payload.notes === undefined ? {} : { notes: payload.notes }), ...(payload.metadata === undefined ? {} : { metadata: payload.metadata }), updatedAt: new Date() }).where(and(eq(energyCarbonProjects.id, projectId))).returning();
    return NextResponse.json({ item: updated });
  } catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ message: 'Carbon project không hợp lệ.', issues: error.issues }, { status: 400 }); return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật carbon project.' }, { status: 400 }); }
}

export async function DELETE(_request: Request, context: RouteContext) { const { projectId } = await context.params; const [updated] = await db.update(energyCarbonProjects).set({ status: 'CANCELLED', updatedAt: new Date() }).where(eq(energyCarbonProjects.id, projectId)).returning({ id: energyCarbonProjects.id, status: energyCarbonProjects.status }); return updated ? NextResponse.json({ item: updated, archived: true }) : NextResponse.json({ message: 'Không tìm thấy carbon project.' }, { status: 404 }); }
