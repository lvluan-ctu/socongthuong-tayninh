import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyAssets, energyEvGridAssessments, energyEvStationApplications } from '@/db/schema';
import { evGridAssessmentSchema } from '@/lib/ev-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

function invalidId(id: string) {
  return !z.string().uuid().safeParse(id).success;
}

function numeric(value: string | number | null) { return value == null ? null : Number(value); }

async function ensureAsset(id: string | null | undefined) {
  if (!id) return null;
  const [asset] = await db.select({ id: energyAssets.id, code: energyAssets.code, name: energyAssets.name, assetType: energyAssets.assetType }).from(energyAssets).where(eq(energyAssets.id, id)).limit(1);
  if (!asset) throw new Error('Không tìm thấy tài sản lưới được tham chiếu.');
  return asset;
}

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (invalidId(id)) return NextResponse.json({ message: 'Mã hồ sơ không hợp lệ.' }, { status: 400 });
    const [application] = await db.select({ id: energyEvStationApplications.id }).from(energyEvStationApplications).where(eq(energyEvStationApplications.id, id)).limit(1);
    if (!application) return NextResponse.json({ message: 'Không tìm thấy hồ sơ đăng ký.' }, { status: 404 });
    const rows = await db.select({
      id: energyEvGridAssessments.id,
      applicationId: energyEvGridAssessments.applicationId,
      assessmentType: energyEvGridAssessments.assessmentType,
      assessedAt: energyEvGridAssessments.assessedAt,
      assessedBy: energyEvGridAssessments.assessedBy,
      requestedPowerKw: energyEvGridAssessments.requestedPowerKw,
      candidateGridAssetId: energyEvGridAssessments.candidateGridAssetId,
      candidateGridAssetCode: energyAssets.code,
      candidateGridAssetName: energyAssets.name,
      confirmedGridAssetId: energyEvGridAssessments.confirmedGridAssetId,
      availableCapacityKw: energyEvGridAssessments.availableCapacityKw,
      approvedCapacityKw: energyEvGridAssessments.approvedCapacityKw,
      voltageLevelKv: energyEvGridAssessments.voltageLevelKv,
      distanceM: energyEvGridAssessments.distanceM,
      method: energyEvGridAssessments.method,
      methodVersion: energyEvGridAssessments.methodVersion,
      sourceRef: energyEvGridAssessments.sourceRef,
      inputSnapshot: energyEvGridAssessments.inputSnapshot,
      result: energyEvGridAssessments.result,
      constraints: energyEvGridAssessments.constraints,
      recommendation: energyEvGridAssessments.recommendation,
      status: energyEvGridAssessments.status,
    }).from(energyEvGridAssessments)
      .leftJoin(energyAssets, eq(energyAssets.id, energyEvGridAssessments.candidateGridAssetId))
      .where(eq(energyEvGridAssessments.applicationId, id))
      .orderBy(desc(energyEvGridAssessments.assessedAt));
    return NextResponse.json({ items: rows.map((row) => ({ ...row, requestedPowerKw: Number(row.requestedPowerKw), availableCapacityKw: numeric(row.availableCapacityKw), approvedCapacityKw: numeric(row.approvedCapacityKw), voltageLevelKv: numeric(row.voltageLevelKv), distanceM: numeric(row.distanceM) })) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải grid assessment.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (invalidId(id)) return NextResponse.json({ message: 'Mã hồ sơ không hợp lệ.' }, { status: 400 });
    const payload = evGridAssessmentSchema.parse(await request.json());
    const [application] = await db.select().from(energyEvStationApplications).where(eq(energyEvStationApplications.id, id)).limit(1);
    if (!application) return NextResponse.json({ message: 'Không tìm thấy hồ sơ đăng ký.' }, { status: 404 });
    if (Math.abs(Number(application.requestedPowerKw) - payload.requestedPowerKw) > 0.001) {
      return NextResponse.json({ message: 'Requested power của assessment phải khớp hồ sơ đăng ký để giữ lineage.' }, { status: 422 });
    }
    const [candidate] = await Promise.all([ensureAsset(payload.candidateGridAssetId), ensureAsset(payload.confirmedGridAssetId)]);
    const [created] = await db.transaction(async (tx) => {
      const [row] = await tx.insert(energyEvGridAssessments).values({
        applicationId: id,
        assessmentType: payload.assessmentType,
        assessedAt: payload.assessedAt ? new Date(payload.assessedAt) : new Date(),
        assessedBy: payload.assessedBy ?? null,
        requestedPowerKw: String(payload.requestedPowerKw),
        candidateGridAssetId: candidate?.id ?? null,
        confirmedGridAssetId: payload.confirmedGridAssetId ?? null,
        availableCapacityKw: payload.availableCapacityKw == null ? null : String(payload.availableCapacityKw),
        approvedCapacityKw: payload.approvedCapacityKw == null ? null : String(payload.approvedCapacityKw),
        voltageLevelKv: payload.voltageLevelKv == null ? null : String(payload.voltageLevelKv),
        distanceM: payload.distanceM == null ? null : String(payload.distanceM),
        method: payload.method,
        methodVersion: payload.methodVersion,
        sourceRef: payload.sourceRef ?? null,
        inputSnapshot: payload.inputSnapshot,
        result: payload.result,
        constraints: payload.constraints,
        recommendation: payload.recommendation ?? null,
        status: payload.status,
      }).returning();
      if (payload.status === 'CONFIRMED' && payload.confirmedGridAssetId) {
        await tx.update(energyEvStationApplications).set({ gridAssetId: payload.confirmedGridAssetId, connectionPointAssetId: payload.confirmedGridAssetId, connectionCapacityKw: payload.approvedCapacityKw == null ? null : String(payload.approvedCapacityKw) }).where(eq(energyEvStationApplications.id, id));
      }
      return [row] as const;
    });
    return NextResponse.json({ ...created, requestedPowerKw: Number(created.requestedPowerKw) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Grid assessment không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tạo grid assessment.' }, { status: 400 });
  }
}
