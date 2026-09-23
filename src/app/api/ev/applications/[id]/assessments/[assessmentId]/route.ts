import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyAssets, energyEvGridAssessments, energyEvStationApplications } from '@/db/schema';
import { evGridAssessmentPatchSchema } from '@/lib/ev-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string; assessmentId: string }> };

function invalidId(id: string) {
  return !z.string().uuid().safeParse(id).success;
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id, assessmentId } = await context.params;
    if (invalidId(id) || invalidId(assessmentId)) return NextResponse.json({ message: 'Mã hồ sơ hoặc assessment không hợp lệ.' }, { status: 400 });
    const payload = evGridAssessmentPatchSchema.parse(await request.json());
    const [existing] = await db.select().from(energyEvGridAssessments).where(eq(energyEvGridAssessments.id, assessmentId)).limit(1);
    if (!existing || existing.applicationId !== id) return NextResponse.json({ message: 'Không tìm thấy grid assessment.' }, { status: 404 });
    const assetIds = [payload.candidateGridAssetId, payload.confirmedGridAssetId].filter((value): value is string => Boolean(value));
    if (assetIds.length) {
      const assets = await db.select({ id: energyAssets.id }).from(energyAssets).where(eq(energyAssets.id, assetIds[0]));
      if (!assets.length) return NextResponse.json({ message: 'Không tìm thấy tài sản lưới được tham chiếu.' }, { status: 404 });
      if (assetIds[1]) {
        const [confirmed] = await db.select({ id: energyAssets.id }).from(energyAssets).where(eq(energyAssets.id, assetIds[1])).limit(1);
        if (!confirmed) return NextResponse.json({ message: 'Không tìm thấy điểm lưới đã xác nhận.' }, { status: 404 });
      }
    }
    const confirmedGridAssetId = payload.confirmedGridAssetId === undefined ? existing.confirmedGridAssetId : payload.confirmedGridAssetId;
    const status = payload.status ?? existing.status;
    if (status === 'CONFIRMED' && !confirmedGridAssetId) return NextResponse.json({ message: 'Assessment CONFIRMED phải có điểm lưới đã xác nhận.' }, { status: 422 });
    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx.update(energyEvGridAssessments).set({
        assessmentType: payload.assessmentType ?? existing.assessmentType,
        assessedAt: payload.assessedAt === undefined ? existing.assessedAt : payload.assessedAt ? new Date(payload.assessedAt) : new Date(),
        assessedBy: payload.assessedBy === undefined ? existing.assessedBy : payload.assessedBy,
        candidateGridAssetId: payload.candidateGridAssetId === undefined ? existing.candidateGridAssetId : payload.candidateGridAssetId,
        confirmedGridAssetId,
        availableCapacityKw: payload.availableCapacityKw === undefined ? existing.availableCapacityKw : payload.availableCapacityKw == null ? null : String(payload.availableCapacityKw),
        approvedCapacityKw: payload.approvedCapacityKw === undefined ? existing.approvedCapacityKw : payload.approvedCapacityKw == null ? null : String(payload.approvedCapacityKw),
        voltageLevelKv: payload.voltageLevelKv === undefined ? existing.voltageLevelKv : payload.voltageLevelKv == null ? null : String(payload.voltageLevelKv),
        distanceM: payload.distanceM === undefined ? existing.distanceM : payload.distanceM == null ? null : String(payload.distanceM),
        method: payload.method ?? existing.method,
        methodVersion: payload.methodVersion ?? existing.methodVersion,
        sourceRef: payload.sourceRef === undefined ? existing.sourceRef : payload.sourceRef,
        inputSnapshot: payload.inputSnapshot ?? existing.inputSnapshot,
        result: payload.result ?? existing.result,
        constraints: payload.constraints ?? existing.constraints,
        recommendation: payload.recommendation === undefined ? existing.recommendation : payload.recommendation,
        status,
      }).where(eq(energyEvGridAssessments.id, assessmentId)).returning();
      if (status === 'CONFIRMED' && confirmedGridAssetId) await tx.update(energyEvStationApplications).set({ gridAssetId: confirmedGridAssetId, connectionPointAssetId: confirmedGridAssetId, connectionCapacityKw: updated.approvedCapacityKw }).where(eq(energyEvStationApplications.id, id));
      return [row] as const;
    });
    return NextResponse.json({ ...updated, availableCapacityKw: updated.availableCapacityKw == null ? null : Number(updated.availableCapacityKw), approvedCapacityKw: updated.approvedCapacityKw == null ? null : Number(updated.approvedCapacityKw) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Grid assessment không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật grid assessment.' }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { id, assessmentId } = await context.params;
    if (invalidId(id) || invalidId(assessmentId)) return NextResponse.json({ message: 'Mã hồ sơ hoặc assessment không hợp lệ.' }, { status: 400 });
    const actor = new URL(request.url).searchParams.get('actor') ?? 'SYSTEM';
    const [existing] = await db.select().from(energyEvGridAssessments).where(eq(energyEvGridAssessments.id, assessmentId)).limit(1);
    if (!existing || existing.applicationId !== id) return NextResponse.json({ message: 'Không tìm thấy grid assessment.' }, { status: 404 });
    const [updated] = await db.update(energyEvGridAssessments).set({ status: 'SUPERSEDED', recommendation: `Superseded by ${actor}; provenance retained.` }).where(eq(energyEvGridAssessments.id, assessmentId)).returning();
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể archive grid assessment.' }, { status: 400 });
  }
}
