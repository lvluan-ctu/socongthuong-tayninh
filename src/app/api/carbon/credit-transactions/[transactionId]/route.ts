import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { energyCarbonCreditTransactions } from '@/db/schema';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ transactionId: string }> };

export async function GET(_request: Request, context: RouteContext) { const { transactionId } = await context.params; const [row] = await db.select().from(energyCarbonCreditTransactions).where(eq(energyCarbonCreditTransactions.id, transactionId)).limit(1); return row ? NextResponse.json({ item: { ...row, quantityTco2e: Number(row.quantityTco2e), balanceDeltaTco2e: Number(row.balanceDeltaTco2e) } }) : NextResponse.json({ message: 'Không tìm thấy credit transaction.' }, { status: 404 }); }
