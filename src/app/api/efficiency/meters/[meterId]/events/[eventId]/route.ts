import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyMeterEvents } from '@/db/schema';
import { db } from '@/lib/db';
import { meterEventPatchSchema } from '@/lib/efficiency-schemas';
import { loadMeter } from '@/server/efficiency/meter';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ meterId: string; eventId: string }> };

function eventDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Thời điểm sự kiện không hợp lệ.');
  return date;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { meterId, eventId } = await context.params;
    z.string().uuid().parse(meterId);
    z.string().uuid().parse(eventId);
    const payload = meterEventPatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) return NextResponse.json({ message: 'Không có trường nào để cập nhật.' }, { status: 400 });
    if (!await loadMeter(meterId)) return NextResponse.json({ message: 'Không tìm thấy công tơ.' }, { status: 404 });
    const [updated] = await db.update(energyMeterEvents).set({
      ...(payload.eventType ? { eventType: payload.eventType } : {}),
      ...(payload.eventAt ? { eventAt: eventDate(payload.eventAt) } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'description') ? { description: payload.description ?? null } : {}),
      ...(payload.source ? { source: payload.source } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'sourceRef') ? { sourceRef: payload.sourceRef ?? null } : {}),
      ...(payload.metadata ? { metadata: payload.metadata } : {}),
    }).where(and(eq(energyMeterEvents.id, eventId), eq(energyMeterEvents.smartMeterId, meterId))).returning();
    if (!updated) return NextResponse.json({ message: 'Không tìm thấy sự kiện công tơ.' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Sự kiện công tơ không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật sự kiện công tơ.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { meterId, eventId } = await context.params;
    z.string().uuid().parse(meterId);
    z.string().uuid().parse(eventId);
    const [deleted] = await db.delete(energyMeterEvents).where(and(
      eq(energyMeterEvents.id, eventId),
      eq(energyMeterEvents.smartMeterId, meterId),
    )).returning({ id: energyMeterEvents.id });
    if (!deleted) return NextResponse.json({ message: 'Không tìm thấy sự kiện công tơ.' }, { status: 404 });
    return NextResponse.json({ deleted: true, eventId });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Mã sự kiện không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể xóa sự kiện công tơ.' }, { status: 400 });
  }
}
