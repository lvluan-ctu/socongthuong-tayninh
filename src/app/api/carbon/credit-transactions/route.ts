import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyCarbonCreditBatches, energyCarbonCreditTransactions, energyCarbonProjects, energyParties } from '@/db/schema';
import { carbonCreditTransactionSchema } from '@/lib/carbon-schemas';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const signedTypes: Record<string, (quantity: number) => number> = {
  ISSUE: (quantity) => quantity, TRANSFER_IN: (quantity) => quantity, TRANSFER_OUT: (quantity) => -quantity,
  RESERVE: (quantity) => -quantity, RELEASE: (quantity) => quantity, RETIRE: (quantity) => -quantity, CANCEL: (quantity) => -quantity,
};
function databaseCode(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : undefined; }

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams; const batchId = params.get('creditBatchId'); const transactionType = params.get('transactionType');
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const filters = [batchId ? eq(energyCarbonCreditTransactions.creditBatchId, batchId) : null, transactionType ? eq(energyCarbonCreditTransactions.transactionType, transactionType) : null].filter((item): item is NonNullable<typeof item> => item !== null);
    const query = db.select({ transaction: energyCarbonCreditTransactions, batchRef: energyCarbonCreditBatches.batchRef, registry: energyCarbonCreditBatches.registry, projectName: energyCarbonProjects.name, fromPartyName: energyParties.name }).from(energyCarbonCreditTransactions).innerJoin(energyCarbonCreditBatches, eq(energyCarbonCreditBatches.id, energyCarbonCreditTransactions.creditBatchId)).leftJoin(energyCarbonProjects, eq(energyCarbonProjects.id, energyCarbonCreditBatches.projectId)).leftJoin(energyParties, eq(energyParties.id, energyCarbonCreditTransactions.fromPartyId));
    const where = filters.length ? and(...filters) : undefined;
    const rowsQuery = query.where(where).orderBy(desc(energyCarbonCreditTransactions.occurredAt));
    const rows = wantsPagination ? await rowsQuery.limit(pagination.pageSize).offset(pagination.offset) : await rowsQuery.limit(500);
    const totalRows = wantsPagination ? await db.select({ value: count() }).from(energyCarbonCreditTransactions).where(where) : [];
    const batchIds = [...new Set(rows.map(({ transaction }) => transaction.creditBatchId))];
    const balances = batchIds.length
      ? await db.select({ batchId: energyCarbonCreditTransactions.creditBatchId, balance: sql<string>`coalesce(sum(${energyCarbonCreditTransactions.balanceDeltaTco2e}), 0)` })
        .from(energyCarbonCreditTransactions)
        .where(inArray(energyCarbonCreditTransactions.creditBatchId, batchIds))
        .groupBy(energyCarbonCreditTransactions.creditBatchId)
      : [];
    const balanceByBatch = new Map(balances.map((row) => [row.batchId, Number(row.balance)]));
    const items = rows.map(({ transaction, ...related }) => ({ ...transaction, ...related, quantityTco2e: Number(transaction.quantityTco2e), balanceDeltaTco2e: Number(transaction.balanceDeltaTco2e), batchBalanceTco2e: balanceByBatch.get(transaction.creditBatchId) ?? 0 }));
    return wantsPagination
      ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0))
      : NextResponse.json({ items });
  } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải credit transactions.' }, { status: 500 }); }
}

async function ensureParty(id: string | null | undefined) { if (!id) return true; const [party] = await db.select({ id: energyParties.id }).from(energyParties).where(eq(energyParties.id, id)).limit(1); return Boolean(party); }

export async function POST(request: Request) {
  try {
    const payload = carbonCreditTransactionSchema.parse(await request.json());
    if (!(await ensureParty(payload.fromPartyId)) || !(await ensureParty(payload.toPartyId))) return NextResponse.json({ message: 'fromPartyId/toPartyId không tồn tại.' }, { status: 400 });
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM energy_carbon_credit_batches WHERE id = ${payload.creditBatchId}::uuid FOR UPDATE`);
      const [batch] = await tx.select().from(energyCarbonCreditBatches).where(eq(energyCarbonCreditBatches.id, payload.creditBatchId)).limit(1);
      if (!batch) return { error: 'Không tìm thấy credit batch.' as const, status: 404 as const };
      const [balanceRow] = await tx.select({ balance: sql<string>`coalesce(sum(${energyCarbonCreditTransactions.balanceDeltaTco2e}), 0)` }).from(energyCarbonCreditTransactions).where(eq(energyCarbonCreditTransactions.creditBatchId, payload.creditBatchId));
      const currentBalance = Number(balanceRow.balance);
      if (payload.transactionType === 'ISSUE' && (batch.status !== 'DRAFT' || currentBalance !== 0)) return { error: 'ISSUE chỉ được thực hiện một lần cho batch DRAFT chưa có số dư.' as const, status: 409 as const };
      const delta = payload.transactionType === 'ADJUSTMENT' ? payload.balanceDeltaTco2e! : signedTypes[payload.transactionType](payload.quantityTco2e);
      if (currentBalance + delta < -1e-9) return { error: `Số dư không đủ: hiện có ${currentBalance} tCO2e, transaction cần ${Math.abs(delta)} tCO2e.` as const, status: 409 as const, balance: currentBalance };
      const [created] = await tx.insert(energyCarbonCreditTransactions).values({ creditBatchId: payload.creditBatchId, transactionType: payload.transactionType, quantityTco2e: String(payload.quantityTco2e), balanceDeltaTco2e: String(delta), fromPartyId: payload.fromPartyId ?? null, toPartyId: payload.toPartyId ?? null, occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : new Date(), reference: payload.reference ?? null, certificateRef: payload.certificateRef ?? null, reason: payload.reason ?? null, createdBy: payload.createdBy ?? null }).returning();
      const nextStatus = currentBalance + delta <= 1e-9 ? (payload.transactionType === 'RETIRE' ? 'RETIRED' : payload.transactionType === 'CANCEL' ? 'CANCELLED' : batch.status) : payload.transactionType === 'RESERVE' ? 'RESERVED' : 'AVAILABLE';
      await tx.update(energyCarbonCreditBatches).set({ status: nextStatus, updatedAt: new Date() }).where(eq(energyCarbonCreditBatches.id, payload.creditBatchId));
      return { transaction: created, balanceTco2e: currentBalance + delta };
    });
    if ('error' in result) return NextResponse.json({ message: result.error, ...(result.balance == null ? {} : { balanceTco2e: result.balance }) }, { status: result.status });
    return NextResponse.json({ ...result, transaction: { ...result.transaction, quantityTco2e: Number(result.transaction.quantityTco2e), balanceDeltaTco2e: Number(result.transaction.balanceDeltaTco2e) } }, { status: 201 });
  } catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ message: 'Credit transaction không hợp lệ.', issues: error.issues }, { status: 400 }); if (databaseCode(error) === '23505') return NextResponse.json({ message: 'Transaction trùng dữ liệu không hợp lệ.' }, { status: 409 }); return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể ghi credit transaction.' }, { status: 400 }); }
}
