import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyRooftopSystemComponents, energyRooftopSystems } from '@/db/schema';
import { rooftopComponentSchema } from '@/lib/solar-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ assetId: string }> };

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clean(value: string | null | undefined) { return value?.trim() || null; }

function serialize(row: typeof energyRooftopSystemComponents.$inferSelect) {
  return {
    ...row,
    ratedPower: row.ratedPower == null ? null : Number(row.ratedPower),
  };
}

async function assertSystem(assetId: string) {
  const [system] = await db.select({ assetId: energyRooftopSystems.assetId }).from(energyRooftopSystems).where(eq(energyRooftopSystems.assetId, assetId)).limit(1);
  return system ?? null;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { assetId } = await context.params;
    if (!await assertSystem(assetId)) return NextResponse.json({ message: 'Không tìm thấy hệ rooftop.' }, { status: 404 });
    const items = await db.select().from(energyRooftopSystemComponents).where(eq(energyRooftopSystemComponents.systemAssetId, assetId)).orderBy(desc(energyRooftopSystemComponents.createdAt));
    return NextResponse.json({ items: items.map(serialize) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải thành phần hệ rooftop.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { assetId } = await context.params;
    if (!await assertSystem(assetId)) return NextResponse.json({ message: 'Không tìm thấy hệ rooftop.' }, { status: 404 });
    const payload = rooftopComponentSchema.parse(await request.json());
    const [item] = await db.insert(energyRooftopSystemComponents).values({
      systemAssetId: assetId,
      componentType: payload.componentType,
      manufacturer: clean(payload.manufacturer),
      model: clean(payload.model),
      serialNumber: clean(payload.serialNumber),
      quantity: payload.quantity,
      ratedPower: payload.ratedPower == null ? null : String(payload.ratedPower),
      unit: clean(payload.unit),
      commissionedAt: parseDate(payload.commissionedAt),
      warrantyUntil: parseDate(payload.warrantyUntil),
      source: payload.source,
      sourceRef: clean(payload.sourceRef),
    }).returning();
    return NextResponse.json({ item: serialize(item) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin thành phần không hợp lệ.', issues: error.issues }, { status: 400 });
    if (error instanceof Error && error.message.includes('duplicate key')) return NextResponse.json({ message: 'Serial của thành phần đã tồn tại trong hệ thống này.' }, { status: 409 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu thành phần hệ rooftop.' }, { status: 400 });
  }
}
