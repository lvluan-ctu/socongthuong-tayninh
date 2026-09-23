import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyRooftopSystemComponents } from '@/db/schema';
import { rooftopComponentSchema } from '@/lib/solar-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ assetId: string; componentId: string }> };

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
function clean(value: string | null | undefined) { return value?.trim() || null; }
function serialize(row: typeof energyRooftopSystemComponents.$inferSelect) { return { ...row, ratedPower: row.ratedPower == null ? null : Number(row.ratedPower) }; }

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { assetId, componentId } = await context.params;
    const payload = rooftopComponentSchema.partial().parse(await request.json());
    const [existing] = await db.select().from(energyRooftopSystemComponents).where(eq(energyRooftopSystemComponents.id, componentId)).limit(1);
    if (!existing || existing.systemAssetId !== assetId) return NextResponse.json({ message: 'Không tìm thấy thành phần hệ rooftop.' }, { status: 404 });
    const [item] = await db.update(energyRooftopSystemComponents).set({
      ...(payload.componentType ? { componentType: payload.componentType } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'manufacturer') ? { manufacturer: clean(payload.manufacturer) } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'model') ? { model: clean(payload.model) } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'serialNumber') ? { serialNumber: clean(payload.serialNumber) } : {}),
      ...(payload.quantity != null ? { quantity: payload.quantity } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'ratedPower') ? { ratedPower: payload.ratedPower == null ? null : String(payload.ratedPower) } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'unit') ? { unit: clean(payload.unit) } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'commissionedAt') ? { commissionedAt: parseDate(payload.commissionedAt) } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'warrantyUntil') ? { warrantyUntil: parseDate(payload.warrantyUntil) } : {}),
      ...(payload.source ? { source: payload.source } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'sourceRef') ? { sourceRef: clean(payload.sourceRef) } : {}),
      updatedAt: new Date(),
    }).where(eq(energyRooftopSystemComponents.id, componentId)).returning();
    return NextResponse.json({ item: serialize(item) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin thành phần không hợp lệ.', issues: error.issues }, { status: 400 });
    if (error instanceof Error && error.message.includes('duplicate key')) return NextResponse.json({ message: 'Serial của thành phần đã tồn tại trong hệ thống này.' }, { status: 409 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật thành phần.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { assetId, componentId } = await context.params;
    const [existing] = await db.select({ id: energyRooftopSystemComponents.id, systemAssetId: energyRooftopSystemComponents.systemAssetId }).from(energyRooftopSystemComponents).where(eq(energyRooftopSystemComponents.id, componentId)).limit(1);
    if (!existing || existing.systemAssetId !== assetId) return NextResponse.json({ message: 'Không tìm thấy thành phần hệ rooftop.' }, { status: 404 });
    await db.delete(energyRooftopSystemComponents).where(eq(energyRooftopSystemComponents.id, componentId));
    return NextResponse.json({ deleted: true, assetId });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể xóa thành phần.' }, { status: 400 });
  }
}
