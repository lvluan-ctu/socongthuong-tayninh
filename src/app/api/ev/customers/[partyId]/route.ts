import { desc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyAssets, energyEvApplicationDocuments, energyEvApplicationHistory, energyEvApplicationReviews, energyEvGridAssessments, energyEvStationApplications, energyEvStations, energyParties, energySites } from '@/db/schema';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ partyId: string }> };

function invalidId(id: string) {
  return !z.string().uuid().safeParse(id).success;
}

function numeric(value: string | number | null) { return value == null ? null : Number(value); }

export async function GET(_request: Request, context: Context) {
  try {
    const { partyId } = await context.params;
    if (invalidId(partyId)) return NextResponse.json({ message: 'Mã khách hàng không hợp lệ.' }, { status: 400 });
    const [party] = await db.select().from(energyParties).where(eq(energyParties.id, partyId)).limit(1);
    if (!party) return NextResponse.json({ message: 'Không tìm thấy khách hàng.' }, { status: 404 });
    const [applications, stations] = await Promise.all([
      db.select({
        id: energyEvStationApplications.id,
        code: energyEvStationApplications.code,
        siteId: energyEvStationApplications.siteId,
        siteName: energySites.name,
        adminAreaCode: energySites.adminAreaCode,
        address: energyEvStationApplications.address,
        requestedPowerKw: energyEvStationApplications.requestedPowerKw,
        requestedConnectorCount: energyEvStationApplications.requestedConnectorCount,
        requestedConnectorTypes: energyEvStationApplications.requestedConnectorTypes,
        availableGridCapacityKw: energyEvStationApplications.availableGridCapacityKw,
        approvedPowerKw: energyEvStationApplications.approvedPowerKw,
        connectionCapacityKw: energyEvStationApplications.connectionCapacityKw,
        connectionPointAssetId: energyEvStationApplications.connectionPointAssetId,
        status: energyEvStationApplications.status,
        submittedAt: energyEvStationApplications.submittedAt,
        reviewedAt: energyEvStationApplications.reviewedAt,
        reviewNote: energyEvStationApplications.reviewNote,
      }).from(energyEvStationApplications).leftJoin(energySites, eq(energySites.id, energyEvStationApplications.siteId)).where(eq(energyEvStationApplications.applicantPartyId, partyId)).orderBy(desc(energyEvStationApplications.submittedAt)),
      db.select({
        assetId: energyEvStations.assetId,
        code: energyAssets.code,
        name: energyAssets.name,
        siteId: energyEvStations.siteId,
        siteName: energySites.name,
        installedPowerKw: energyEvStations.installedPowerKw,
        totalPowerKw: energyEvStations.totalPowerKw,
        connectionCapacityKw: energyEvStations.connectionCapacityKw,
        actualPeakPowerKw: energyEvStations.actualPeakPowerKw,
        connectorCount: energyEvStations.connectorCount,
        operationStatus: energyEvStations.operationStatus,
      }).from(energyEvStations).innerJoin(energyAssets, eq(energyAssets.id, energyEvStations.assetId)).leftJoin(energySites, eq(energySites.id, energyEvStations.siteId)).where(eq(energyEvStations.operatorPartyId, partyId)),
    ]);
    const applicationIds = applications.map((application) => application.id);
    const [assessments, reviews, documents, history] = applicationIds.length ? await Promise.all([
      db.select().from(energyEvGridAssessments).where(inArray(energyEvGridAssessments.applicationId, applicationIds)),
      db.select().from(energyEvApplicationReviews).where(inArray(energyEvApplicationReviews.applicationId, applicationIds)),
      db.select().from(energyEvApplicationDocuments).where(inArray(energyEvApplicationDocuments.applicationId, applicationIds)),
      db.select().from(energyEvApplicationHistory).where(inArray(energyEvApplicationHistory.applicationId, applicationIds)),
    ]) : [[], [], [], []];
    return NextResponse.json({
      party,
      applications: applications.map((item) => ({ ...item, requestedPowerKw: Number(item.requestedPowerKw), availableGridCapacityKw: numeric(item.availableGridCapacityKw), approvedPowerKw: numeric(item.approvedPowerKw), connectionCapacityKw: numeric(item.connectionCapacityKw) })),
      stations: stations.map((item) => ({ ...item, installedPowerKw: numeric(item.installedPowerKw) ?? Number(item.totalPowerKw), totalPowerKw: Number(item.totalPowerKw), connectionCapacityKw: numeric(item.connectionCapacityKw), actualPeakPowerKw: numeric(item.actualPeakPowerKw) })),
      assessments,
      reviews,
      documents,
      history,
      warning: null,
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải Customer 360.' }, { status: 500 });
  }
}
