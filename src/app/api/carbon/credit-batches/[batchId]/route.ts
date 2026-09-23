import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyCarbonCreditBatches, energyCarbonCreditTransactions, energyCarbonProjects } from '@/db/schema';
import { carbonCreditBatchPatchSchema } from '@/lib/carbon-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ batchId: string }> };
async function read(batchId: string) { const [row] = await db.select({ batch: energyCarbonCreditBatches, projectName: energyCarbonProjects.name, projectCode: energyCarbonProjects.code }).from(energyCarbonCreditBatches).leftJoin(energyCarbonProjects, eq(energyCarbonProjects.id, energyCarbonCreditBatches.projectId)).where(eq(energyCarbonCreditBatches.id, batchId)).limit(1); if (!row) return null; const [balance] = await db.select({ value: sql<string>`coalesce(sum(${energyCarbonCreditTransactions.balanceDeltaTco2e}), 0)` }).from(energyCarbonCreditTransactions).where(eq(energyCarbonCreditTransactions.creditBatchId, batchId)); return { ...row.batch, projectName: row.projectName, projectCode: row.projectCode, quantityTco2e: Number(row.batch.quantityTco2e), balanceTco2e: Number(balance.value) }; }

export async function GET(_request: Request, context: RouteContext) { const { batchId } = await context.params; const item = await read(batchId); return item ? NextResponse.json({ item }) : NextResponse.json({ message: 'Không tìm thấy credit batch.' }, { status: 404 }); }

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { batchId } = await context.params; const payload = carbonCreditBatchPatchSchema.parse(await request.json()); const current = await read(batchId); if (!current) return NextResponse.json({ message: 'Không tìm thấy credit batch.' }, { status: 404 });
    const immutable = ['registry', 'batchRef', 'serialFrom', 'serialTo', 'vintageYear', 'issuedAt', 'quantityTco2e']; const attempted = immutable.filter((key) => key in payload); if (attempted.length) return NextResponse.json({ message: `Không thể sửa trường bất biến sau khi tạo batch: ${attempted.join(', ')}.` }, { status: 409 });
    if (payload.projectId) { const [project] = await db.select({ id: energyCarbonProjects.id }).from(energyCarbonProjects).where(eq(energyCarbonProjects.id, payload.projectId)).limit(1); if (!project) return NextResponse.json({ message: 'Không tìm thấy carbon project được liên kết.' }, { status: 404 }); }
    const [updated] = await db.update(energyCarbonCreditBatches).set({ ...(payload.projectId === undefined ? {} : { projectId: payload.projectId }), ...(payload.status === undefined ? {} : { status: payload.status }), ...(payload.evidenceRef === undefined ? {} : { evidenceRef: payload.evidenceRef }), ...(payload.metadata === undefined ? {} : { metadata: payload.metadata }), updatedAt: new Date() }).where(eq(energyCarbonCreditBatches.id, batchId)).returning();
    return NextResponse.json({ item: updated });
  } catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin batch không hợp lệ.', issues: error.issues }, { status: 400 }); return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật batch.' }, { status: 400 }); }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { batchId } = await context.params; const item = await read(batchId); if (!item) return NextResponse.json({ message: 'Không tìm thấy credit batch.' }, { status: 404 }); if (item.balanceTco2e > 0) return NextResponse.json({ message: 'Không thể archive batch còn số dư; hãy tạo transaction RETIRE/CANCEL trước.' }, { status: 409 }); const [updated] = await db.update(energyCarbonCreditBatches).set({ status: 'CANCELLED', updatedAt: new Date() }).where(and(eq(energyCarbonCreditBatches.id, batchId))).returning({ id: energyCarbonCreditBatches.id, status: energyCarbonCreditBatches.status }); return NextResponse.json({ item: updated, archived: true });
}
