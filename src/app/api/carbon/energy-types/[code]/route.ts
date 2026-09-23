import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { energyEmissionSources, energyEnergyTypes } from '@/db/schema';
import { energyTypePatchSchema } from '@/lib/carbon-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ code: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { code } = await context.params;
  const [row] = await db.select().from(energyEnergyTypes).where(eq(energyEnergyTypes.code, code)).limit(1);
  return row ? NextResponse.json(row) : NextResponse.json({ message: 'Không tìm thấy loại năng lượng.' }, { status: 404 });
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { code } = await context.params;
    const payload = energyTypePatchSchema.parse(await request.json());
    const [existing] = await db.select().from(energyEnergyTypes).where(eq(energyEnergyTypes.code, code)).limit(1);
    if (!existing) return NextResponse.json({ message: 'Không tìm thấy loại năng lượng.' }, { status: 404 });
    const [updated] = await db.update(energyEnergyTypes).set({
      ...(payload.name === undefined ? {} : { name: payload.name }),
      ...(payload.category === undefined ? {} : { category: payload.category }),
      ...(payload.canonicalUnit === undefined ? {} : { canonicalUnit: payload.canonicalUnit }),
      ...(payload.description === undefined ? {} : { description: payload.description }),
      ...(payload.status === undefined ? {} : { status: payload.status }),
      ...(payload.metadata === undefined ? {} : { metadata: payload.metadata }),
      updatedAt: new Date(),
    }).where(eq(energyEnergyTypes.code, code)).returning();
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && 'issues' in error) return NextResponse.json({ message: 'Thông tin loại năng lượng không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật loại năng lượng.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { code } = await context.params;
    const [existing] = await db.select({ code: energyEnergyTypes.code }).from(energyEnergyTypes).where(eq(energyEnergyTypes.code, code)).limit(1);
    if (!existing) return NextResponse.json({ message: 'Không tìm thấy loại năng lượng.' }, { status: 404 });
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(energyEmissionSources).where(and(eq(energyEmissionSources.energyTypeCode, code), eq(energyEmissionSources.status, 'ACTIVE')));
    if (Number(count) > 0) return NextResponse.json({ message: 'Không thể xoá loại năng lượng đang được nguồn ACTIVE sử dụng; hãy chuyển sang INACTIVE.' }, { status: 409 });
    const [archived] = await db.update(energyEnergyTypes).set({ status: 'INACTIVE', updatedAt: new Date() }).where(eq(energyEnergyTypes.code, code)).returning();
    return NextResponse.json({ item: archived, archived: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu trạng thái loại năng lượng.' }, { status: 400 });
  }
}
