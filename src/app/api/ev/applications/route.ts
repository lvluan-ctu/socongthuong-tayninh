import { count, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyEvApplicationHistory, energyEvGridAssessments, energyEvStationApplications, energyParties, energySites } from '@/db/schema';
import { evApplicationSchema } from '@/lib/ev-schemas';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

type ApplicationPayload = ReturnType<typeof evApplicationSchema.parse>;

async function ensureParty(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], payload: ApplicationPayload) {
  if (payload.applicantPartyId) {
    const [party] = await tx.select().from(energyParties).where(eq(energyParties.id, payload.applicantPartyId)).limit(1);
    if (!party) throw new Error('Không tìm thấy khách hàng đăng ký.');
    return party;
  }
  if (!payload.applicantCode || !payload.applicantName) throw new Error('Cần chọn khách hàng hoặc nhập mã/tên khách hàng mới.');
  const [existing] = await tx.select().from(energyParties).where(eq(energyParties.code, payload.applicantCode)).limit(1);
  if (existing) return existing;
  const [created] = await tx.insert(energyParties).values({
    partyType: 'EV_APPLICANT',
    code: payload.applicantCode,
    name: payload.applicantName,
    address: payload.address,
    adminAreaCode: payload.adminAreaCode ?? null,
    status: 'ACTIVE',
    classification: 'INTERNAL',
  }).returning();
  return created;
}

async function findGrid(latitude: number | null | undefined, longitude: number | null | undefined) {
  if (latitude == null || longitude == null) return null;
  const result = await db.execute(sql`
    SELECT a.id AS "assetId", a.code, a.name,
           s.voltage_level_kv::double precision AS "voltageLevelKv",
           COALESCE(gca.available_capacity_mw, s.available_capacity_mva)::double precision AS "availableCapacityMw",
           ST_Distance(ST_SetSRID(ST_Point(${longitude}, ${latitude}), 4326)::geography, a.location)::double precision AS "distanceM"
    FROM energy_substations s
    JOIN energy_assets a ON a.id = s.asset_id
    LEFT JOIN LATERAL (
      SELECT available_capacity_mw
      FROM energy_grid_capacity_assessments g
      WHERE g.asset_id = a.id
      ORDER BY g.assessed_at DESC
      LIMIT 1
    ) gca ON TRUE
    WHERE a.location IS NOT NULL
    ORDER BY ST_Distance(ST_SetSRID(ST_Point(${longitude}, ${latitude}), 4326)::geography, a.location)
    LIMIT 1
  `);
  const row = result.rows[0] as {
    assetId?: string;
    code?: string;
    name?: string;
    voltageLevelKv?: number | string | null;
    availableCapacityMw?: number | string | null;
    distanceM?: number | string | null;
  } | undefined;
  if (!row?.assetId) return null;
  return {
    assetId: row.assetId,
    code: row.code ?? null,
    name: row.name ?? null,
    voltageLevelKv: row.voltageLevelKv == null ? null : Number(row.voltageLevelKv),
    availableCapacityKw: row.availableCapacityMw == null ? null : Number(row.availableCapacityMw) * 1000,
    distanceM: row.distanceM == null ? null : Number(row.distanceM),
  };
}

function toNumber(value: string | number | null) {
  return value == null ? null : Number(value);
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const status = params.get('status');
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const where = status && status !== 'ALL' ? eq(energyEvStationApplications.status, status) : undefined;
    const query = db.select({
      id: energyEvStationApplications.id,
      code: energyEvStationApplications.code,
      applicantPartyId: energyEvStationApplications.applicantPartyId,
      applicantName: energyParties.name,
      siteId: energyEvStationApplications.siteId,
      siteName: energySites.name,
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
      .where(where)
      .orderBy(desc(energyEvStationApplications.submittedAt));
    const [rows, totalRows] = await Promise.all([
      wantsPagination ? query.limit(pagination.pageSize).offset(pagination.offset) : query,
      db.select({ value: count() }).from(energyEvStationApplications).where(where),
    ]);
    const items = rows.map((row) => ({
      ...row,
      requestedPowerKw: Number(row.requestedPowerKw),
      availableGridCapacityKw: toNumber(row.availableGridCapacityKw),
      approvedPowerKw: toNumber(row.approvedPowerKw),
      connectionCapacityKw: toNumber(row.connectionCapacityKw),
    }));
    return wantsPagination ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0)) : NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải hồ sơ trạm sạc.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = evApplicationSchema.parse(await request.json());
    const [duplicate] = await db.select({ id: energyEvStationApplications.id })
      .from(energyEvStationApplications)
      .where(eq(energyEvStationApplications.code, payload.code))
      .limit(1);
    if (duplicate) return NextResponse.json({ message: 'Mã hồ sơ trạm sạc đã tồn tại.' }, { status: 409 });

    const grid = await findGrid(payload.latitude, payload.longitude);
    const result = await db.transaction(async (tx) => {
      const party = await ensureParty(tx, payload);
      const siteCode = `EVSITE-${payload.code}`;
      let [site] = await tx.select().from(energySites).where(eq(energySites.code, siteCode)).limit(1);
      if (site && site.partyId && site.partyId !== party.id) throw new Error('Mã vị trí đề xuất đã thuộc khách hàng khác.');
      const location = payload.latitude != null && payload.longitude != null
        ? `SRID=4326;POINT(${payload.longitude} ${payload.latitude})`
        : null;
      if (!site) {
        [site] = await tx.insert(energySites).values({
          partyId: party.id,
          code: siteCode,
          name: `Vị trí ${payload.code}`,
          siteType: 'EV_CHARGING_PROPOSED',
          address: payload.address,
          adminAreaCode: payload.adminAreaCode ?? null,
          location,
          status: 'ACTIVE',
          classification: 'INTERNAL',
        }).returning();
      } else {
        [site] = await tx.update(energySites).set({
          partyId: party.id,
          address: payload.address,
          adminAreaCode: payload.adminAreaCode ?? null,
          location,
          updatedAt: new Date(),
        }).where(eq(energySites.id, site.id)).returning();
      }

      const [created] = await tx.insert(energyEvStationApplications).values({
        code: payload.code,
        applicantPartyId: party.id,
        siteId: site.id,
        address: payload.address,
        location,
        requestedPowerKw: String(payload.requestedPowerKw),
        requestedConnectorCount: payload.requestedConnectorCount,
        requestedConnectorTypes: payload.requestedConnectorTypes,
        gridAssetId: payload.gridAssetId ?? grid?.assetId ?? null,
        availableGridCapacityKw: grid?.availableCapacityKw == null ? null : String(grid.availableCapacityKw),
        status: payload.status,
        submittedAt: payload.status === 'SUBMITTED' ? new Date() : null,
        plannedCommissioningAt: null,
      }).returning();
      await tx.insert(energyEvApplicationHistory).values({
        applicationId: created.id,
        fromStatus: null,
        toStatus: payload.status,
        action: 'CREATE_APPLICATION',
        actor: payload.actor ?? null,
        metadata: { gridAutoMatch: grid, gridMatchMeaning: 'PRELIMINARY_ONLY' },
      });

      let assessment = null;
      if (grid) {
        [assessment] = await tx.insert(energyEvGridAssessments).values({
          applicationId: created.id,
          assessmentType: 'NEAREST_GRID_SCREENING',
          assessedBy: 'SYSTEM_POSTGIS_SCREENING',
          requestedPowerKw: String(payload.requestedPowerKw),
          candidateGridAssetId: grid.assetId,
          availableCapacityKw: grid.availableCapacityKw == null ? null : String(grid.availableCapacityKw),
          voltageLevelKv: grid.voltageLevelKv == null ? null : String(grid.voltageLevelKv),
          distanceM: grid.distanceM == null ? null : String(grid.distanceM),
          method: 'NEAREST_SUBSTATION_POSTGIS_WITH_LATEST_CAPACITY',
          methodVersion: '1.0',
          sourceRef: 'energy_substations + energy_grid_capacity_assessments',
          inputSnapshot: { latitude: payload.latitude, longitude: payload.longitude, requestedPowerKw: payload.requestedPowerKw },
          result: grid,
          constraints: { preliminary: true, confirmedConnectionPointRequired: true },
          recommendation: grid.availableCapacityKw != null && grid.availableCapacityKw >= payload.requestedPowerKw
            ? 'PRELIMINARY_CAPACITY_SUFFICIENT'
            : 'PRELIMINARY_CAPACITY_INSUFFICIENT_OR_UNKNOWN',
          status: 'PRELIMINARY',
        }).returning();
      }
      return { created, party, site, assessment };
    });
    return NextResponse.json({ application: result.created, grid, gridAssessment: result.assessment, applicant: result.party, site: result.site }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Hồ sơ đăng ký trạm sạc không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu hồ sơ trạm sạc.' }, { status: 400 });
  }
}
