import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { energyRooftopGenerationMonthly } from "@/db/schema";
import { rooftopGenerationPatchSchema } from "@/lib/solar-schemas";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ assetId: string; generationId: string }> };

function clean(value: string | null | undefined) {
  return value?.trim() || null;
}
function serialize(row: typeof energyRooftopGenerationMonthly.$inferSelect) {
  return {
    ...row,
    energyGeneratedKwh: Number(row.energyGeneratedKwh),
    energySelfConsumedKwh:
      row.energySelfConsumedKwh == null ? null : Number(row.energySelfConsumedKwh),
    energyExportedKwh: row.energyExportedKwh == null ? null : Number(row.energyExportedKwh),
    energyImportedKwh: row.energyImportedKwh == null ? null : Number(row.energyImportedKwh),
    peakGenerationKw: row.peakGenerationKw == null ? null : Number(row.peakGenerationKw),
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { assetId, generationId } = await context.params;
    const payload = rooftopGenerationPatchSchema.parse(await request.json());
    const [existing] = await db
      .select()
      .from(energyRooftopGenerationMonthly)
      .where(eq(energyRooftopGenerationMonthly.id, generationId))
      .limit(1);
    if (!existing || existing.systemAssetId !== assetId)
      return NextResponse.json({ message: "Không tìm thấy bản ghi sản lượng." }, { status: 404 });
    const [item] = await db
      .update(energyRooftopGenerationMonthly)
      .set({
        ...(payload.period ? { period: payload.period } : {}),
        ...(payload.energyGeneratedKwh != null
          ? { energyGeneratedKwh: String(payload.energyGeneratedKwh) }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, "energySelfConsumedKwh")
          ? {
              energySelfConsumedKwh:
                payload.energySelfConsumedKwh == null
                  ? null
                  : String(payload.energySelfConsumedKwh),
            }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, "energyExportedKwh")
          ? {
              energyExportedKwh:
                payload.energyExportedKwh == null ? null : String(payload.energyExportedKwh),
            }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, "energyImportedKwh")
          ? {
              energyImportedKwh:
                payload.energyImportedKwh == null ? null : String(payload.energyImportedKwh),
            }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, "peakGenerationKw")
          ? {
              peakGenerationKw:
                payload.peakGenerationKw == null ? null : String(payload.peakGenerationKw),
            }
          : {}),
        ...(payload.source ? { source: payload.source } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, "sourceId")
          ? { sourceId: payload.sourceId ?? null }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, "sourceRef")
          ? { sourceRef: clean(payload.sourceRef) }
          : {}),
        ...(payload.quality ? { quality: payload.quality } : {}),
        updatedAt: new Date(),
      })
      .where(eq(energyRooftopGenerationMonthly.id, generationId))
      .returning();
    return NextResponse.json({ item: serialize(item) });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { message: "Dữ liệu sản lượng không hợp lệ.", issues: error.issues },
        { status: 400 },
      );
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể cập nhật sản lượng." },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { assetId, generationId } = await context.params;
    const [existing] = await db
      .select({
        id: energyRooftopGenerationMonthly.id,
        systemAssetId: energyRooftopGenerationMonthly.systemAssetId,
      })
      .from(energyRooftopGenerationMonthly)
      .where(eq(energyRooftopGenerationMonthly.id, generationId))
      .limit(1);
    if (!existing || existing.systemAssetId !== assetId)
      return NextResponse.json({ message: "Không tìm thấy bản ghi sản lượng." }, { status: 404 });
    await db
      .delete(energyRooftopGenerationMonthly)
      .where(eq(energyRooftopGenerationMonthly.id, generationId));
    return NextResponse.json({ deleted: true, assetId });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể xóa bản ghi sản lượng." },
      { status: 400 },
    );
  }
}
