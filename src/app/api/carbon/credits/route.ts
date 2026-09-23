import { count, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyCarbonCredits, energyParties } from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const schema = z.object({
  partyId: z.string().uuid().nullable().optional(),
  registry: z.string().trim().min(2).max(120),
  reference: z.string().trim().min(2).max(200),
  vintageYear: z.number().int().min(2000).max(2100),
  quantityTco2e: z.number().positive(),
  status: z.enum(['AVAILABLE', 'RESERVED', 'TRANSFERRED', 'RETIRED', 'CANCELLED']).default('AVAILABLE'),
});

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const query = db.select({
      id: energyCarbonCredits.id,
      partyId: energyCarbonCredits.partyId,
      partyName: energyParties.name,
      registry: energyCarbonCredits.registry,
      reference: energyCarbonCredits.reference,
      vintageYear: energyCarbonCredits.vintageYear,
      quantityTco2e: energyCarbonCredits.quantityTco2e,
      status: energyCarbonCredits.status,
    }).from(energyCarbonCredits)
      .leftJoin(energyParties, eq(energyParties.id, energyCarbonCredits.partyId))
      .orderBy(desc(energyCarbonCredits.vintageYear));
    const [rows, totalRows, availableRows] = await Promise.all([
      wantsPagination ? query.limit(pagination.pageSize).offset(pagination.offset) : query,
      wantsPagination ? db.select({ value: count() }).from(energyCarbonCredits) : Promise.resolve([]),
      db.select({ quantity: sql<number>`COALESCE(SUM(${energyCarbonCredits.quantityTco2e}), 0)` }).from(energyCarbonCredits).where(eq(energyCarbonCredits.status, 'AVAILABLE')),
    ]);
    const items = rows.map((row) => ({ ...row, vintageYear: Number(row.vintageYear), quantityTco2e: Number(row.quantityTco2e) }));
    const summary = { availableQuantityTco2e: Number(availableRows[0]?.quantity ?? 0) };
    return wantsPagination
      ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0), { summary })
      : NextResponse.json({ items, summary });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải tín chỉ carbon.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const [created] = await db.insert(energyCarbonCredits).values({
      partyId: payload.partyId ?? null,
      registry: payload.registry,
      reference: payload.reference,
      vintageYear: String(payload.vintageYear),
      quantityTco2e: String(payload.quantityTco2e),
      status: payload.status,
    }).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Tín chỉ carbon không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu tín chỉ carbon.' }, { status: 400 });
  }
}
