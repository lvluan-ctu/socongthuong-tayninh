import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyRooftopGenerationMonthly, energyRooftopSystems } from '@/db/schema';
import { rooftopGenerationSchema } from '@/lib/solar-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ assetId: string }> };

function clean(value: string | null | undefined) { return value?.trim() || null; }
function serialize(row: typeof energyRooftopGenerationMonthly.$inferSelect) {
  return {
    ...row,
    energyGeneratedKwh: Number(row.energyGeneratedKwh),
    energySelfConsumedKwh: row.energySelfConsumedKwh == null ? null : Number(row.energySelfConsumedKwh),
    energyExportedKwh: row.energyExportedKwh == null ? null : Number(row.energyExportedKwh),
    energyImportedKwh: row.energyImportedKwh == null ? null : Number(row.energyImportedKwh),
    peakGenerationKw: row.peakGenerationKw == null ? null : Number(row.peakGenerationKw),
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
    const items = await db.select().from(energyRooftopGenerationMonthly).where(eq(energyRooftopGenerationMonthly.systemAssetId, assetId)).orderBy(desc(energyRooftopGenerationMonthly.period));
    return NextResponse.json({ items: items.map(serialize) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải lịch sử sản lượng.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { assetId } = await context.params;
    if (!await assertSystem(assetId)) return NextResponse.json({ message: 'Không tìm thấy hệ rooftop.' }, { status: 404 });
    const payload = rooftopGenerationSchema.parse(await request.json());
    const [item] = await db.insert(energyRooftopGenerationMonthly).values({
      systemAssetId: assetId,
      period: payload.period,
      energyGeneratedKwh: String(payload.energyGeneratedKwh),
      energySelfConsumedKwh: payload.energySelfConsumedKwh == null ? null : String(payload.energySelfConsumedKwh),
      energyExportedKwh: payload.energyExportedKwh == null ? null : String(payload.energyExportedKwh),
      energyImportedKwh: payload.energyImportedKwh == null ? null : String(payload.energyImportedKwh),
      peakGenerationKw: payload.peakGenerationKw == null ? null : String(payload.peakGenerationKw),
      source: payload.source,
      sourceId: payload.sourceId ?? null,
      sourceRef: clean(payload.sourceRef),
      quality: payload.quality,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [energyRooftopGenerationMonthly.systemAssetId, energyRooftopGenerationMonthly.period],
      set: {
        energyGeneratedKwh: String(payload.energyGeneratedKwh),
        energySelfConsumedKwh: payload.energySelfConsumedKwh == null ? null : String(payload.energySelfConsumedKwh),
        energyExportedKwh: payload.energyExportedKwh == null ? null : String(payload.energyExportedKwh),
        energyImportedKwh: payload.energyImportedKwh == null ? null : String(payload.energyImportedKwh),
        peakGenerationKw: payload.peakGenerationKw == null ? null : String(payload.peakGenerationKw),
        source: payload.source,
        sourceId: payload.sourceId ?? null,
        sourceRef: clean(payload.sourceRef),
        quality: payload.quality,
        updatedAt: new Date(),
      },
    }).returning();
    return NextResponse.json({ item: serialize(item), upserted: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Dữ liệu sản lượng không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu sản lượng tháng.' }, { status: 400 });
  }
}
