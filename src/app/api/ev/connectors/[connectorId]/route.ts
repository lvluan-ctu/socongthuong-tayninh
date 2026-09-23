import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyAssets, energyEvConnectors } from '@/db/schema';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ connectorId: string }> };
const patchSchema = z.object({ status: z.enum(['AVAILABLE', 'OCCUPIED', 'FAULTED', 'OFFLINE', 'MAINTENANCE']) });
function invalidId(id: string) { return !z.string().uuid().safeParse(id).success; }

export async function GET(_request: Request, context: Context) {
  try { const { connectorId } = await context.params; if (invalidId(connectorId)) return NextResponse.json({ message: 'Mã connector không hợp lệ.' }, { status: 400 }); const [item] = await db.select({ id: energyEvConnectors.id, stationAssetId: energyEvConnectors.stationAssetId, stationName: energyAssets.name, code: energyEvConnectors.code, connectorType: energyEvConnectors.connectorType, chargingMode: energyEvConnectors.chargingMode, powerKw: energyEvConnectors.powerKw, status: energyEvConnectors.status }).from(energyEvConnectors).innerJoin(energyAssets, eq(energyAssets.id, energyEvConnectors.stationAssetId)).where(eq(energyEvConnectors.id, connectorId)).limit(1); if (!item) return NextResponse.json({ message: 'Không tìm thấy connector.' }, { status: 404 }); return NextResponse.json({ ...item, powerKw: Number(item.powerKw) }); } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải connector.' }, { status: 500 }); }
}

export async function PATCH(request: Request, context: Context) {
  try { const { connectorId } = await context.params; if (invalidId(connectorId)) return NextResponse.json({ message: 'Mã connector không hợp lệ.' }, { status: 400 }); const payload = patchSchema.parse(await request.json()); const [updated] = await db.update(energyEvConnectors).set({ status: payload.status }).where(eq(energyEvConnectors.id, connectorId)).returning(); if (!updated) return NextResponse.json({ message: 'Không tìm thấy connector.' }, { status: 404 }); return NextResponse.json(updated); } catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ message: 'Trạng thái connector không hợp lệ.', issues: error.issues }, { status: 400 }); return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật connector.' }, { status: 400 }); }
}

export async function DELETE(request: Request, context: Context) {
  try { const { connectorId } = await context.params; if (invalidId(connectorId)) return NextResponse.json({ message: 'Mã connector không hợp lệ.' }, { status: 400 }); const [updated] = await db.update(energyEvConnectors).set({ status: 'OFFLINE' }).where(and(eq(energyEvConnectors.id, connectorId), eq(energyEvConnectors.status, 'AVAILABLE'))).returning(); if (!updated) return NextResponse.json({ message: 'Connector không tồn tại hoặc đang không ở trạng thái AVAILABLE; không xoá dữ liệu vận hành.' }, { status: 409 }); return NextResponse.json(updated); } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể archive connector.' }, { status: 400 }); }
}
