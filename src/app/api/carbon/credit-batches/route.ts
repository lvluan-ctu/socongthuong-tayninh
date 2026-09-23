import { count, desc, eq, inArray, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyCarbonCreditBatches, energyCarbonCreditTransactions, energyCarbonProjects } from '@/db/schema';
import { carbonCreditBatchSchema } from '@/lib/carbon-schemas';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';
function databaseCode(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : undefined; }

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const projectId = params.get('projectId');
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const condition = projectId ? eq(energyCarbonCreditBatches.projectId, projectId) : undefined;
    const listQuery = db.select({ batch: energyCarbonCreditBatches, projectName: energyCarbonProjects.name, projectCode: energyCarbonProjects.code })
      .from(energyCarbonCreditBatches)
      .leftJoin(energyCarbonProjects, eq(energyCarbonProjects.id, energyCarbonCreditBatches.projectId))
      .where(condition)
      .orderBy(desc(energyCarbonCreditBatches.vintageYear));
    const batches = wantsPagination ? await listQuery.limit(pagination.pageSize).offset(pagination.offset) : await listQuery.limit(1000);
    const totalRows = wantsPagination ? await db.select({ value: count() }).from(energyCarbonCreditBatches).where(condition) : [];
    const batchIds = batches.map(({ batch }) => batch.id);
    const balances = batchIds.length
      ? await db.select({ batchId: energyCarbonCreditTransactions.creditBatchId, balance: sql<string>`coalesce(sum(${energyCarbonCreditTransactions.balanceDeltaTco2e}), 0)` })
        .from(energyCarbonCreditTransactions)
        .where(inArray(energyCarbonCreditTransactions.creditBatchId, batchIds))
        .groupBy(energyCarbonCreditTransactions.creditBatchId)
      : [];
    const balanceByBatch = new Map(balances.map((row) => [row.batchId, Number(row.balance)]));
    const items = batches.map(({ batch, ...related }) => ({ ...batch, ...related, quantityTco2e: Number(batch.quantityTco2e), balanceTco2e: balanceByBatch.get(batch.id) ?? 0 }));
    return wantsPagination
      ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0))
      : NextResponse.json({ items });
  } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải credit batches.' }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const payload = carbonCreditBatchSchema.parse(await request.json());
    if (payload.projectId) { const [project] = await db.select({ id: energyCarbonProjects.id, partyId: energyCarbonProjects.partyId }).from(energyCarbonProjects).where(eq(energyCarbonProjects.id, payload.projectId)).limit(1); if (!project) return NextResponse.json({ message: 'Không tìm thấy carbon project của batch.' }, { status: 404 }); }
    const result = await db.transaction(async (tx) => {
      const [batch] = await tx.insert(energyCarbonCreditBatches).values({ projectId: payload.projectId ?? null, registry: payload.registry, batchRef: payload.batchRef, serialFrom: payload.serialFrom ?? null, serialTo: payload.serialTo ?? null, vintageYear: payload.vintageYear, issuedAt: new Date(payload.issuedAt), quantityTco2e: String(payload.quantityTco2e), status: payload.status, evidenceRef: payload.evidenceRef ?? null, metadata: payload.metadata ?? { source: 'MANUAL' } }).returning();
      if (payload.status !== 'DRAFT') await tx.insert(energyCarbonCreditTransactions).values({ creditBatchId: batch.id, transactionType: 'ISSUE', quantityTco2e: String(payload.quantityTco2e), balanceDeltaTco2e: String(payload.quantityTco2e), occurredAt: new Date(payload.issuedAt), reference: payload.batchRef, certificateRef: payload.serialFrom ?? null, reason: 'Initial registry issuance.', createdBy: 'credit-batch-api' });
      return batch;
    });
    return NextResponse.json({ item: { ...result, quantityTco2e: Number(result.quantityTco2e), balanceTco2e: payload.status === 'DRAFT' ? 0 : payload.quantityTco2e } }, { status: 201 });
  } catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ message: 'Credit batch không hợp lệ.', issues: error.issues }, { status: 400 }); if (databaseCode(error) === '23505') return NextResponse.json({ message: 'Registry/batch reference hoặc serial range đã tồn tại.' }, { status: 409 }); return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tạo credit batch.' }, { status: 400 }); }
}
