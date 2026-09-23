import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  energyAssets,
  energyEvApplicationHistory,
  energyEvApplicationReviews,
  energyEvApplicationDocuments,
  energyEvGridAssessments,
  energyEvStationApplications,
  energyEvStations,
  energyParties,
  energySites,
} from '@/db/schema';
import { evApplicationPatchSchema } from '@/lib/ev-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

function invalidId(id: string) {
  return !z.string().uuid().safeParse(id).success;
}

function numberOrNull(value: string | number | null) {
  return value == null ? null : Number(value);
}

async function getApplication(id: string) {
  const [application] = await db.select({
    id: energyEvStationApplications.id,
    code: energyEvStationApplications.code,
    applicantPartyId: energyEvStationApplications.applicantPartyId,
    applicantCode: energyParties.code,
    applicantName: energyParties.name,
    applicantTaxCode: energyParties.taxCode,
    applicantPhone: energyParties.phone,
    applicantEmail: energyParties.email,
    siteId: energyEvStationApplications.siteId,
    siteName: energySites.name,
    siteAddress: energySites.address,
    adminAreaCode: energySites.adminAreaCode,
    address: energyEvStationApplications.address,
    location: energyEvStationApplications.location,
    requestedPowerKw: energyEvStationApplications.requestedPowerKw,
    requestedConnectorCount: energyEvStationApplications.requestedConnectorCount,
    requestedConnectorTypes: energyEvStationApplications.requestedConnectorTypes,
    gridAssetId: energyEvStationApplications.gridAssetId,
    availableGridCapacityKw: energyEvStationApplications.availableGridCapacityKw,
    approvedPowerKw: energyEvStationApplications.approvedPowerKw,
    approvedAt: energyEvStationApplications.approvedAt,
    approvalNo: energyEvStationApplications.approvalNo,
    connectionCapacityKw: energyEvStationApplications.connectionCapacityKw,
    connectionPointAssetId: energyEvStationApplications.connectionPointAssetId,
    connectionMethod: energyEvStationApplications.connectionMethod,
    connectionSourceRef: energyEvStationApplications.connectionSourceRef,
    plannedCommissioningAt: energyEvStationApplications.plannedCommissioningAt,
    status: energyEvStationApplications.status,
    submittedAt: energyEvStationApplications.submittedAt,
    reviewedBy: energyEvStationApplications.reviewedBy,
    reviewedAt: energyEvStationApplications.reviewedAt,
    reviewNote: energyEvStationApplications.reviewNote,
  }).from(energyEvStationApplications)
    .innerJoin(energyParties, eq(energyParties.id, energyEvStationApplications.applicantPartyId))
    .leftJoin(energySites, eq(energySites.id, energyEvStationApplications.siteId))
    .where(eq(energyEvStationApplications.id, id))
    .limit(1);
  if (!application) return null;
  const [assessments, reviews, documents, history, station] = await Promise.all([
    db.select().from(energyEvGridAssessments).where(eq(energyEvGridAssessments.applicationId, id)),
    db.select().from(energyEvApplicationReviews).where(eq(energyEvApplicationReviews.applicationId, id)),
    db.select().from(energyEvApplicationDocuments).where(eq(energyEvApplicationDocuments.applicationId, id)),
    db.select().from(energyEvApplicationHistory).where(eq(energyEvApplicationHistory.applicationId, id)),
    db.select({
      assetId: energyEvStations.assetId,
      code: energyAssets.code,
      name: energyAssets.name,
      totalPowerKw: energyEvStations.totalPowerKw,
      installedPowerKw: energyEvStations.installedPowerKw,
      connectionCapacityKw: energyEvStations.connectionCapacityKw,
      actualPeakPowerKw: energyEvStations.actualPeakPowerKw,
      operationStatus: energyEvStations.operationStatus,
    }).from(energyEvStations).innerJoin(energyAssets, eq(energyAssets.id, energyEvStations.assetId)).where(eq(energyEvStations.applicationId, id)).limit(1),
  ]);
  return {
    ...application,
    requestedPowerKw: Number(application.requestedPowerKw),
    availableGridCapacityKw: numberOrNull(application.availableGridCapacityKw),
    approvedPowerKw: numberOrNull(application.approvedPowerKw),
    connectionCapacityKw: numberOrNull(application.connectionCapacityKw),
    assessments: assessments.map((item) => ({ ...item, requestedPowerKw: Number(item.requestedPowerKw), availableCapacityKw: numberOrNull(item.availableCapacityKw), approvedCapacityKw: numberOrNull(item.approvedCapacityKw), voltageLevelKv: numberOrNull(item.voltageLevelKv), distanceM: numberOrNull(item.distanceM) })),
    reviews: reviews.map((item) => ({ ...item, approvedPowerKw: numberOrNull(item.approvedPowerKw) })),
    documents,
    history,
    station: station[0] ? { ...station[0], totalPowerKw: Number(station[0].totalPowerKw), installedPowerKw: numberOrNull(station[0].installedPowerKw), connectionCapacityKw: numberOrNull(station[0].connectionCapacityKw), actualPeakPowerKw: numberOrNull(station[0].actualPeakPowerKw) } : null,
  };
}

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (invalidId(id)) return NextResponse.json({ message: 'Mã hồ sơ không hợp lệ.' }, { status: 400 });
    const application = await getApplication(id);
    return application ? NextResponse.json(application) : NextResponse.json({ message: 'Không tìm thấy hồ sơ đăng ký.' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải chi tiết hồ sơ.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (invalidId(id)) return NextResponse.json({ message: 'Mã hồ sơ không hợp lệ.' }, { status: 400 });
    const payload = evApplicationPatchSchema.parse(await request.json());
    const [existing] = await db.select().from(energyEvStationApplications).where(eq(energyEvStationApplications.id, id)).limit(1);
    if (!existing) return NextResponse.json({ message: 'Không tìm thấy hồ sơ đăng ký.' }, { status: 404 });
    if (!['DRAFT', 'NEEDS_INFO'].includes(existing.status)) {
      return NextResponse.json({ message: 'Chỉ hồ sơ DRAFT hoặc NEEDS_INFO mới được chỉnh sửa thông tin đăng ký.' }, { status: 409 });
    }

    const result = await db.transaction(async (tx) => {
      let partyId = existing.applicantPartyId;
      if (payload.applicantPartyId !== undefined) {
        if (payload.applicantPartyId) {
          const [party] = await tx.select({ id: energyParties.id }).from(energyParties).where(eq(energyParties.id, payload.applicantPartyId)).limit(1);
          if (!party) throw new Error('Không tìm thấy khách hàng đăng ký.');
          partyId = party.id;
        } else if (payload.applicantCode && payload.applicantName) {
          const [party] = await tx.insert(energyParties).values({ partyType: 'EV_APPLICANT', code: payload.applicantCode, name: payload.applicantName, address: payload.address ?? existing.address, adminAreaCode: payload.adminAreaCode ?? null, status: 'ACTIVE', classification: 'INTERNAL' }).returning({ id: energyParties.id });
          partyId = party.id;
        } else {
          throw new Error('Chọn khách hàng hoặc nhập đủ mã và tên khách hàng mới.');
        }
      }

      const siteId = existing.siteId;
      const locationProvided = payload.latitude !== undefined || payload.longitude !== undefined;
      const location = locationProvided
        ? (payload.latitude != null && payload.longitude != null ? `SRID=4326;POINT(${payload.longitude} ${payload.latitude})` : null)
        : undefined;
      if (siteId) {
        await tx.update(energySites).set({
          partyId,
          address: payload.address ?? undefined,
          adminAreaCode: payload.adminAreaCode === undefined ? undefined : payload.adminAreaCode,
          location,
          updatedAt: new Date(),
        }).where(eq(energySites.id, siteId));
      }
      const [updated] = await tx.update(energyEvStationApplications).set({
        code: payload.code ?? existing.code,
        applicantPartyId: partyId,
        address: payload.address ?? existing.address,
        location,
        requestedPowerKw: payload.requestedPowerKw == null ? existing.requestedPowerKw : String(payload.requestedPowerKw),
        requestedConnectorCount: payload.requestedConnectorCount ?? existing.requestedConnectorCount,
        requestedConnectorTypes: payload.requestedConnectorTypes ?? existing.requestedConnectorTypes,
        gridAssetId: payload.gridAssetId === undefined ? existing.gridAssetId : payload.gridAssetId,
        plannedCommissioningAt: payload.plannedCommissioningAt === undefined ? existing.plannedCommissioningAt : payload.plannedCommissioningAt ? new Date(payload.plannedCommissioningAt) : null,
      }).where(eq(energyEvStationApplications.id, id)).returning();
      await tx.insert(energyEvApplicationHistory).values({ applicationId: id, fromStatus: existing.status, toStatus: existing.status, action: 'UPDATE_APPLICATION', actor: payload.actor ?? null, metadata: { changedFields: Object.keys(payload) } });
      return updated;
    });
    return NextResponse.json({ ...result, requestedPowerKw: Number(result.requestedPowerKw) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin hồ sơ không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật hồ sơ.' }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (invalidId(id)) return NextResponse.json({ message: 'Mã hồ sơ không hợp lệ.' }, { status: 400 });
    const actor = new URL(request.url).searchParams.get('actor')?.trim() || 'SYSTEM';
    const [existing] = await db.select().from(energyEvStationApplications).where(eq(energyEvStationApplications.id, id)).limit(1);
    if (!existing) return NextResponse.json({ message: 'Không tìm thấy hồ sơ đăng ký.' }, { status: 404 });
    if (existing.status === 'CONVERTED') return NextResponse.json({ message: 'Hồ sơ đã chuyển thành Station, không thể xoá.' }, { status: 409 });
    if (existing.status === 'CANCELLED') return NextResponse.json({ application: existing });
    const result = await db.transaction(async (tx) => {
      const [updated] = await tx.update(energyEvStationApplications).set({ status: 'CANCELLED' }).where(eq(energyEvStationApplications.id, id)).returning();
      await tx.insert(energyEvApplicationHistory).values({ applicationId: id, fromStatus: existing.status, toStatus: 'CANCELLED', action: 'CANCEL_APPLICATION', actor, note: 'Soft archive; dữ liệu hồ sơ và provenance được giữ lại.' });
      return updated;
    });
    return NextResponse.json({ ...result, requestedPowerKw: Number(result.requestedPowerKw) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể huỷ hồ sơ.' }, { status: 400 });
  }
}
