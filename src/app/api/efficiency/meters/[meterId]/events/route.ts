import { and, count, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyMeterEvents } from '@/db/schema';
import { db } from '@/lib/db';
import { meterEventSchema } from '@/lib/efficiency-schemas';
import { paginatedResponse, parsePagination } from '@/lib/pagination';
import { loadMeter } from '@/server/efficiency/meter';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ meterId: string }> };

function eventDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Thời điểm sự kiện không hợp lệ.');
  return date;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { meterId } = await context.params;
    z.string().uuid().parse(meterId);
    if (!await loadMeter(meterId)) return NextResponse.json({ message: 'Không tìm thấy công tơ.' }, { status: 404 });
    const params = new URL(request.url).searchParams;
    const eventType = params.get('eventType');
    const wantsPagination = params.has('page') || params.has('pageSize');
    const pagination = parsePagination(params);
    const where = and(
      eq(energyMeterEvents.smartMeterId, meterId),
      ...(eventType ? [eq(energyMeterEvents.eventType, eventType)] : []),
    );
    const listQuery = db.select().from(energyMeterEvents).where(where).orderBy(desc(energyMeterEvents.eventAt));
    const [items, totalRows] = await Promise.all([
      wantsPagination ? listQuery.limit(pagination.pageSize).offset(pagination.offset) : listQuery,
      db.select({ value: count() }).from(energyMeterEvents).where(where),
    ]);
    return wantsPagination
      ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0))
      : NextResponse.json({ items });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Mã công tơ không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải lịch sử sự kiện công tơ.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { meterId } = await context.params;
    z.string().uuid().parse(meterId);
    const payload = meterEventSchema.parse(await request.json());
    if (!await loadMeter(meterId)) return NextResponse.json({ message: 'Không tìm thấy công tơ.' }, { status: 404 });
    const [created] = await db.insert(energyMeterEvents).values({
      smartMeterId: meterId,
      eventType: payload.eventType,
      eventAt: eventDate(payload.eventAt),
      description: payload.description ?? null,
      source: payload.source,
      sourceRef: payload.sourceRef ?? null,
      metadata: payload.metadata ?? {},
    }).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Sự kiện công tơ không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể ghi sự kiện công tơ.' }, { status: 400 });
  }
}
