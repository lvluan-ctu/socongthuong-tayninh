import { desc, eq, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  energyCustomerAccounts,
  energyCustomerConsumptionMonthly,
  energyAssets,
  energyParties,
  energySites,
  energySolarAssessments,
} from '@/db/schema';
import { db } from '@/lib/db';
import { solarAssessmentSchema } from '@/lib/solar-schemas';

export const dynamic = 'force-dynamic';

const schema = solarAssessmentSchema.extend({
  customerAccountId: z.string().uuid(),
  usableRoofAreaM2: z.number().positive().nullable(),
  irradiationKwhM2Year: z.number().positive('Cần có bức xạ mặt trời từ nguồn đã xác định.'),
  panelPowerW: z.number().positive('Công suất tấm pin phải theo datasheet.'),
  panelAreaM2: z.number().positive('Diện tích tấm pin phải theo datasheet.'),
  availableGridCapacityKw: z.number().nonnegative().nullable(),
  gridAssetId: z.string().uuid().nullable().optional(),
  targetSelfConsumptionSharePct: z.number().min(10).max(100).nullable(),
  tiltDeg: z.number().min(0).max(90).nullable(),
  azimuthDeg: z.number().min(0).max(360).nullable(),
  shadingFactor: z.number().min(0.1).max(1).nullable(),
  solarResourceRef: z.string().trim().min(2, 'Cần lưu source reference cho dữ liệu bức xạ.').max(250),
  solarResourceVersion: z.string().trim().max(100).nullable().optional(),
});

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function loadAccount(accountId: string) {
  const [account] = await db
    .select({
      id: energyCustomerAccounts.id,
      customerCode: energyCustomerAccounts.customerCode,
      provider: energyCustomerAccounts.provider,
      customerType: energyCustomerAccounts.customerType,
      partyId: energyCustomerAccounts.partyId,
      customerName: energyParties.name,
      siteId: energyCustomerAccounts.siteId,
      siteName: energySites.name,
      address: energyCustomerAccounts.serviceAddress,
      adminAreaCode: energySites.adminAreaCode,
    })
    .from(energyCustomerAccounts)
    .innerJoin(energyParties, eq(energyParties.id, energyCustomerAccounts.partyId))
    .leftJoin(energySites, eq(energySites.id, energyCustomerAccounts.siteId))
    .where(eq(energyCustomerAccounts.id, accountId))
    .limit(1);
  return account ?? null;
}

async function autoRoof(siteId: string | null) {
  if (!siteId) return {
    usableAreaM2: null as number | null,
    buildingAssetId: null as string | null,
    roofSurfaceId: null as string | null,
    solarResourceZoneId: null as string | null,
    solarResourceValue: null as number | null,
    solarResourceRef: null as string | null,
    solarResourceVersion: null as string | null,
    tiltDeg: null as number | null,
    azimuthDeg: null as number | null,
    shadingFactor: null as number | null,
    source: null as string | null,
    confidence: null as number | null,
  };
  const result = await db.execute(sql`
    WITH surfaces AS (
      SELECT b.asset_id AS "buildingAssetId",
             r.id AS "roofSurfaceId",
             COALESCE(r.usable_area_m2, r.area_m2)::double precision AS "usableAreaM2",
             r.solar_resource_zone_id AS "solarResourceZoneId",
             rz.annual_ghi_kwh_m2::double precision AS "solarResourceValue",
             COALESCE(rz.source_ref, rz.code) AS "solarResourceRef",
             rz.source_version AS "solarResourceVersion",
             r.tilt_deg::double precision AS "tiltDeg",
             r.azimuth_deg::double precision AS "azimuthDeg",
             r.shading_factor::double precision AS "shadingFactor",
             r.source AS "source",
             r.confidence::double precision AS "confidence"
      FROM energy_buildings b
      LEFT JOIN energy_roof_surfaces r ON r.building_asset_id = b.asset_id
      LEFT JOIN energy_solar_resource_zones rz ON rz.id = r.solar_resource_zone_id AND rz.status = 'ACTIVE'
      WHERE b.site_id = ${siteId}::uuid AND (r.id IS NULL OR r.status = 'ACTIVE')
    )
    SELECT "buildingAssetId",
           (array_agg("roofSurfaceId" ORDER BY "usableAreaM2" DESC NULLS LAST))[1] AS "roofSurfaceId",
           (array_agg("solarResourceZoneId" ORDER BY "usableAreaM2" DESC NULLS LAST))[1] AS "solarResourceZoneId",
           (array_agg("solarResourceValue" ORDER BY "usableAreaM2" DESC NULLS LAST))[1] AS "solarResourceValue",
           (array_agg("solarResourceRef" ORDER BY "usableAreaM2" DESC NULLS LAST))[1] AS "solarResourceRef",
           (array_agg("solarResourceVersion" ORDER BY "usableAreaM2" DESC NULLS LAST))[1] AS "solarResourceVersion",
           SUM("usableAreaM2")::double precision AS "usableAreaM2",
           CASE WHEN SUM(CASE WHEN "tiltDeg" IS NOT NULL THEN "usableAreaM2" ELSE 0 END) > 0
             THEN SUM("tiltDeg" * "usableAreaM2") / SUM(CASE WHEN "tiltDeg" IS NOT NULL THEN "usableAreaM2" ELSE 0 END)
           END AS "tiltDeg",
           CASE WHEN SUM(CASE WHEN "azimuthDeg" IS NOT NULL THEN "usableAreaM2" ELSE 0 END) > 0
             THEN SUM("azimuthDeg" * "usableAreaM2") / SUM(CASE WHEN "azimuthDeg" IS NOT NULL THEN "usableAreaM2" ELSE 0 END)
           END AS "azimuthDeg",
           CASE WHEN SUM(CASE WHEN "shadingFactor" IS NOT NULL THEN "usableAreaM2" ELSE 0 END) > 0
             THEN SUM("shadingFactor" * "usableAreaM2") / SUM(CASE WHEN "shadingFactor" IS NOT NULL THEN "usableAreaM2" ELSE 0 END)
           END AS "shadingFactor",
           (array_agg("source" ORDER BY "usableAreaM2" DESC NULLS LAST))[1] AS "source",
           (array_agg("confidence" ORDER BY "usableAreaM2" DESC NULLS LAST))[1] AS "confidence"
    FROM surfaces
    GROUP BY "buildingAssetId"
    ORDER BY SUM("usableAreaM2") DESC NULLS LAST
    LIMIT 1
  `);
  const row = result.rows[0] as {
    buildingAssetId?: string;
    roofSurfaceId?: string | null;
    solarResourceZoneId?: string | null;
    solarResourceValue?: number | string | null;
    solarResourceRef?: string | null;
    solarResourceVersion?: string | null;
    usableAreaM2?: number | string | null;
    tiltDeg?: number | string | null;
    azimuthDeg?: number | string | null;
    shadingFactor?: number | string | null;
    source?: string | null;
    confidence?: number | string | null;
  } | undefined;
  return {
    usableAreaM2: row?.usableAreaM2 == null ? null : Number(row.usableAreaM2),
    buildingAssetId: row?.buildingAssetId ?? null,
    roofSurfaceId: row?.roofSurfaceId ?? null,
    solarResourceZoneId: row?.solarResourceZoneId ?? null,
    solarResourceValue: row?.solarResourceValue == null ? null : Number(row.solarResourceValue),
    solarResourceRef: row?.solarResourceRef ?? null,
    solarResourceVersion: row?.solarResourceVersion ?? null,
    tiltDeg: row?.tiltDeg == null ? null : Number(row.tiltDeg),
    azimuthDeg: row?.azimuthDeg == null ? null : Number(row.azimuthDeg),
    shadingFactor: row?.shadingFactor == null ? null : Number(row.shadingFactor),
    source: row?.source ?? null,
    confidence: row?.confidence == null ? null : Number(row.confidence),
  };
}

async function autoGrid(accountId: string) {
  const official = await db.execute(sql`
    SELECT l.id AS "gridServiceLinkId",
           l.feeder_asset_id AS "feederAssetId",
           l.bay_asset_id AS "bayAssetId",
           l.transformer_asset_id AS "transformerAssetId",
           l.substation_asset_id AS "substationAssetId",
           COALESCE(l.feeder_asset_id, l.substation_asset_id, l.bay_asset_id, l.transformer_asset_id) AS "gridAssetId",
           COALESCE(fa.code, sa.code, ba.code, ta.code) AS "gridCode",
           COALESCE(fa.name, sa.name, ba.name, ta.name) AS "gridName",
           f.voltage_level_kv::double precision AS "voltageLevelKv",
           latest.id AS "capacityAssessmentId",
           latest.assessed_at AS "gridAssessedAt",
           COALESCE(latest.available_capacity_mw * 1000, f.headroom_mw * 1000)::double precision AS "availableCapacityKw"
    FROM energy_customer_grid_service_links l
    LEFT JOIN energy_assets fa ON fa.id = l.feeder_asset_id
    LEFT JOIN energy_assets sa ON sa.id = l.substation_asset_id
    LEFT JOIN energy_assets ba ON ba.id = l.bay_asset_id
    LEFT JOIN energy_assets ta ON ta.id = l.transformer_asset_id
    LEFT JOIN energy_feeders f ON f.asset_id = l.feeder_asset_id
    LEFT JOIN LATERAL (
      SELECT g.id, g.assessed_at, g.available_capacity_mw
      FROM energy_grid_capacity_assessments g
      WHERE g.asset_id = COALESCE(l.feeder_asset_id, l.substation_asset_id, l.bay_asset_id, l.transformer_asset_id)
      ORDER BY g.assessed_at DESC
      LIMIT 1
    ) latest ON TRUE
    WHERE l.customer_account_id = ${accountId}::uuid
      AND l.is_inferred = FALSE
      AND (l.valid_from IS NULL OR l.valid_from <= now())
      AND (l.valid_to IS NULL OR l.valid_to >= now())
    ORDER BY l.valid_from DESC NULLS LAST, l.created_at DESC
    LIMIT 1
  `);
  const officialRow = official.rows[0] as {
    gridServiceLinkId?: string; gridAssetId?: string; gridCode?: string; gridName?: string; voltageLevelKv?: number | string | null;
    availableCapacityKw?: number | string | null; feederAssetId?: string | null; bayAssetId?: string | null; transformerAssetId?: string | null; substationAssetId?: string | null; capacityAssessmentId?: string | null; gridAssessedAt?: Date | string | null;
  } | undefined;
  if (officialRow?.gridAssetId) return {
    gridServiceLinkId: officialRow.gridServiceLinkId ?? null,
    gridAssetId: officialRow.gridAssetId,
    gridCode: officialRow.gridCode ?? null,
    gridName: officialRow.gridName ?? null,
    voltageLevelKv: officialRow.voltageLevelKv == null ? null : Number(officialRow.voltageLevelKv),
    availableCapacityKw: officialRow.availableCapacityKw == null ? null : Number(officialRow.availableCapacityKw),
    feederAssetId: officialRow.feederAssetId ?? null,
    bayAssetId: officialRow.bayAssetId ?? null,
    transformerAssetId: officialRow.transformerAssetId ?? null,
    substationAssetId: officialRow.substationAssetId ?? null,
    capacityAssessmentId: officialRow.capacityAssessmentId ?? null,
    gridAssessedAt: officialRow.gridAssessedAt ?? null,
    distanceM: null,
    isInferred: false,
    method: 'EVN_SERVICE_LINK',
  };

  const result = await db.execute(sql`
    SELECT ga.id AS "gridAssetId",
           ga.code AS "gridCode",
           ga.name AS "gridName",
           gs.voltage_level_kv::double precision AS "voltageLevelKv",
           COALESCE(gca.available_capacity_mw, gs.available_capacity_mva)::double precision AS "availableCapacityMw",
           ST_Distance(site.location, ga.location)::double precision AS "distanceM"
    FROM energy_customer_accounts ca
    JOIN energy_sites site ON site.id = ca.site_id
    JOIN energy_substations gs ON TRUE
    JOIN energy_assets ga ON ga.id = gs.asset_id
    LEFT JOIN LATERAL (
      SELECT g.available_capacity_mw
      FROM energy_grid_capacity_assessments g
      WHERE g.asset_id = ga.id
      ORDER BY g.assessed_at DESC
      LIMIT 1
    ) gca ON TRUE
    WHERE ca.id = ${accountId}::uuid
      AND site.location IS NOT NULL
      AND ga.location IS NOT NULL
    ORDER BY ST_Distance(site.location, ga.location)
    LIMIT 1
  `);
  const row = result.rows[0] as {
    gridAssetId?: string; gridCode?: string; gridName?: string; voltageLevelKv?: number | string | null;
    availableCapacityMw?: number | string | null; distanceM?: number | string | null;
  } | undefined;
  if (!row?.gridAssetId) return null;
  return {
    gridServiceLinkId: null,
    gridAssetId: row.gridAssetId,
    gridCode: row.gridCode ?? null,
    gridName: row.gridName ?? null,
    voltageLevelKv: row.voltageLevelKv == null ? null : Number(row.voltageLevelKv),
    availableCapacityKw: row.availableCapacityMw == null ? null : Number(row.availableCapacityMw) * 1000,
    distanceM: row.distanceM == null ? null : Number(row.distanceM),
    feederAssetId: null,
    bayAssetId: null,
    transformerAssetId: null,
    substationAssetId: row.gridAssetId,
    capacityAssessmentId: null,
    gridAssessedAt: null,
    isInferred: true,
    method: 'NEAREST_SUBSTATION_FALLBACK',
  };
}

export async function GET(request: Request) {
  try {
    const accountId = new URL(request.url).searchParams.get('customerAccountId');
    if (!accountId) return NextResponse.json({ message: 'Thiếu customerAccountId.' }, { status: 400 });
    if (!z.string().uuid().safeParse(accountId).success) return NextResponse.json({ message: 'customerAccountId không đúng UUID.' }, { status: 400 });
    const rows = await db.select().from(energySolarAssessments)
      .where(eq(energySolarAssessments.customerAccountId, accountId))
      .orderBy(desc(energySolarAssessments.assessedAt))
      .limit(50);
    return NextResponse.json({ items: rows.map((row) => ({
      ...row,
      annualConsumptionKwh: Number(row.annualConsumptionKwh),
      daytimeSharePct: row.daytimeSharePct == null ? null : Number(row.daytimeSharePct),
      usableRoofAreaM2: row.usableRoofAreaM2 == null ? null : Number(row.usableRoofAreaM2),
      irradiationKwhM2Year: row.irradiationKwhM2Year == null ? null : Number(row.irradiationKwhM2Year),
      recommendedCapacityKwp: Number(row.recommendedCapacityKwp),
      recommendedInverterKw: row.recommendedInverterKw == null ? null : Number(row.recommendedInverterKw),
      recommendedBatteryKwh: row.recommendedBatteryKwh == null ? null : Number(row.recommendedBatteryKwh),
      availableGridCapacityKw: row.availableGridCapacityKw == null ? null : Number(row.availableGridCapacityKw),
      score: row.score == null ? null : Number(row.score),
    })) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải lịch sử đánh giá solar.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const account = await loadAccount(payload.customerAccountId);
    if (!account) return NextResponse.json({ message: 'Không tìm thấy khách hàng EVN.' }, { status: 404 });

    if (payload.gridAssetId) {
      const [gridAsset] = await db.select({ id: energyAssets.id, assetType: energyAssets.assetType }).from(energyAssets).where(eq(energyAssets.id, payload.gridAssetId)).limit(1);
      if (!gridAsset) return NextResponse.json({ message: 'Grid asset override không tồn tại.' }, { status: 422 });
      if (!['FEEDER', 'BAY', 'TRANSFORMER', 'SUBSTATION'].includes(gridAsset.assetType)) return NextResponse.json({ message: 'Grid asset override phải là feeder, bay, transformer hoặc substation.' }, { status: 422 });
    }
    const consumption = await db.select().from(energyCustomerConsumptionMonthly)
      .where(eq(energyCustomerConsumptionMonthly.accountId, payload.customerAccountId))
      .orderBy(desc(energyCustomerConsumptionMonthly.period))
      .limit(12);
    if (consumption.length === 0) return NextResponse.json({ message: 'Khách hàng chưa có dữ liệu tiêu thụ để tính phương án Solar.' }, { status: 422 });

    const annualConsumptionKwh = consumption.reduce((sum, row) => sum + Number(row.energyKwh), 0);
    const daytimeRows = consumption.filter((row) => row.daytimeSharePct != null);
    const daytimeSharePct = daytimeRows.length
      ? daytimeRows.reduce((sum, row) => sum + Number(row.daytimeSharePct), 0) / daytimeRows.length
      : payload.targetSelfConsumptionSharePct;
    if (daytimeSharePct == null) {
      return NextResponse.json({ message: 'Chưa có tỷ lệ tiêu thụ ban ngày trong dữ liệu EVN. Cần nhập mục tiêu tự dùng rõ ràng trước khi đánh giá.', issues: [{ path: ['targetSelfConsumptionSharePct'], message: 'Bắt buộc khi chưa có daytime share.' }] }, { status: 422 });
    }

    const roof = await autoRoof(account.siteId);
    const resourceZoneId = payload.solarResourceZoneId ?? roof.solarResourceZoneId;
    const resourceZoneResult = resourceZoneId
      ? await db.execute(sql`
          SELECT id, code, annual_ghi_kwh_m2 AS "annualGhiKwhM2", source, source_version AS "sourceVersion", source_ref AS "sourceRef",
                 quality, reference_tilt_deg AS "referenceTiltDeg", reference_azimuth_deg AS "referenceAzimuthDeg"
          FROM energy_solar_resource_zones
          WHERE id = ${resourceZoneId}::uuid AND status = 'ACTIVE'
          LIMIT 1
        `)
      : { rows: [] };
    const resourceZone = resourceZoneResult.rows[0] as {
      id?: string;
      code?: string;
      annualGhiKwhM2?: number | string;
      source?: string;
      sourceVersion?: string;
      sourceRef?: string | null;
      quality?: string;
      referenceTiltDeg?: number | string | null;
      referenceAzimuthDeg?: number | string | null;
    } | undefined;
    if (resourceZoneId && !resourceZone) return NextResponse.json({ message: 'Vùng tài nguyên bức xạ không tồn tại hoặc đã archive.' }, { status: 422 });
    const usableRoofAreaM2 = payload.usableRoofAreaM2 ?? roof.usableAreaM2;
    const grid = payload.gridAssetId || payload.availableGridCapacityKw != null
      ? {
        gridServiceLinkId: null,
        gridAssetId: payload.gridAssetId ?? null,
        gridCode: null,
        gridName: null,
        voltageLevelKv: null,
        availableCapacityKw: payload.availableGridCapacityKw ?? null,
        feederAssetId: null,
        bayAssetId: null,
        transformerAssetId: null,
        substationAssetId: null,
        capacityAssessmentId: null,
        gridAssessedAt: null,
        distanceM: null,
        isInferred: false,
        method: 'MANUAL_OVERRIDE',
      }
      : await autoGrid(payload.customerAccountId);
    const gridAssetId = payload.gridAssetId ?? grid?.gridAssetId ?? null;
    const availableGridCapacityKw = payload.availableGridCapacityKw ?? grid?.availableCapacityKw ?? null;
    const tiltDeg = payload.tiltDeg ?? roof.tiltDeg;
    const azimuthDeg = payload.azimuthDeg ?? roof.azimuthDeg;
    const shadingFactor = payload.shadingFactor ?? roof.shadingFactor;
    const irradiationKwhM2Year = resourceZone ? Number(resourceZone.annualGhiKwhM2) : payload.irradiationKwhM2Year;
    const solarResourceRef = resourceZone ? (resourceZone.sourceRef || resourceZone.code || payload.solarResourceRef) : payload.solarResourceRef;
    const solarResourceVersion = resourceZone?.sourceVersion ?? payload.solarResourceVersion ?? null;
    const suggestedTiltDeg = resourceZone?.referenceTiltDeg == null ? 15 : Number(resourceZone.referenceTiltDeg);
    const suggestedAzimuthDeg = resourceZone?.referenceAzimuthDeg == null ? 180 : Number(resourceZone.referenceAzimuthDeg);
    const hasRoofOrientation = tiltDeg != null && azimuthDeg != null;
    const orientationTiltFactor = tiltDeg == null ? 1 : Math.max(0.7, 1 - Math.abs(tiltDeg - suggestedTiltDeg) / 90 * 0.3);
    const azimuthDistance = azimuthDeg == null ? 0 : Math.abs(((azimuthDeg - suggestedAzimuthDeg + 540) % 360) - 180);
    const orientationAzimuthFactor = azimuthDeg == null ? 1 : Math.max(0.75, 1 - azimuthDistance / 180 * 0.25);
    const orientationFactor = round(orientationTiltFactor * orientationAzimuthFactor, 4);
    const effectiveShadingFactor = shadingFactor == null ? 1 : Math.max(0.1, Math.min(1, shadingFactor));
    const performanceRatio = 0.8;
    const calculatedSpecificYield = irradiationKwhM2Year * performanceRatio * orientationFactor * effectiveShadingFactor;
    const specificYieldKwhPerKwpYear = calculatedSpecificYield;

    const panelKw = payload.panelPowerW / 1000;
    const roofPanelCount = usableRoofAreaM2 == null ? null : Math.max(0, Math.floor(usableRoofAreaM2 / payload.panelAreaM2));
    const roofCapacityKwp = roofPanelCount == null ? null : roofPanelCount * panelKw;
    const consumptionTargetKwp = annualConsumptionKwh * (daytimeSharePct / 100) / specificYieldKwhPerKwpYear;
    const policyMaxCapacityKwp = payload.policyMaxCapacityKwp ?? null;
    const solarResourceStatus = resourceZone == null ? 'UNVERIFIED_INPUT' : ['GOOD', 'ESTIMATED'].includes(resourceZone.quality ?? '') ? 'AVAILABLE' : 'REVIEW_REQUIRED';
    const constraints: Array<{ key: string; label: string; value: number }> = [
      { key: 'CONSUMPTION', label: 'Tiêu thụ tự dùng', value: consumptionTargetKwp },
    ];
    if (roofCapacityKwp != null) constraints.push({ key: 'ROOF', label: 'Bề mặt mái', value: roofCapacityKwp });
    if (availableGridCapacityKw != null) constraints.push({ key: 'GRID', label: 'Headroom lưới', value: availableGridCapacityKw });
    if (policyMaxCapacityKwp != null) constraints.push({ key: 'POLICY', label: 'Giới hạn chính sách', value: policyMaxCapacityKwp });
    const bindingConstraint = constraints.reduce((lowest, current) => current.value < lowest.value ? current : lowest, constraints[0]);
    const rawRecommendation = Math.max(0, Math.min(...constraints.map((constraint) => constraint.value)));
    const recommendedPanelCount = Math.max(0, Math.floor(rawRecommendation / panelKw));
    const recommendedCapacityKwp = recommendedPanelCount * panelKw;
    const recommendedInverterKw = recommendedCapacityKwp > 0 ? Math.max(1, round(recommendedCapacityKwp * 0.85, 1)) : null;
    const expectedAnnualYieldKwh = recommendedCapacityKwp * specificYieldKwhPerKwpYear;

    const completenessScore = Math.min(20, consumption.length / 12 * 20);
    const daytimeScore = Math.min(20, daytimeSharePct / 100 * 20);
    const roofScore = roofCapacityKwp == null ? 6 : (roofCapacityKwp >= consumptionTargetKwp ? 20 : Math.max(6, roofCapacityKwp / Math.max(consumptionTargetKwp, 0.1) * 20));
    const gridScore = availableGridCapacityKw == null ? 6 : (availableGridCapacityKw >= consumptionTargetKwp ? 20 : Math.max(5, availableGridCapacityKw / Math.max(consumptionTargetKwp, 0.1) * 20));
    const resourceScore = Math.min(20, Math.max(5, irradiationKwhM2Year / 1500 * 15 + (hasRoofOrientation ? 5 : 1)));
    const score = round(Math.min(100, completenessScore + daytimeScore + roofScore + gridScore + resourceScore - (solarResourceStatus === 'REVIEW_REQUIRED' ? 5 : 0)), 1);
    const caveats = [
      'Đây là khuyến nghị sơ bộ phục vụ quản lý/quy hoạch, không thay thế khảo sát kỹ thuật và thỏa thuận đấu nối.',
    ];
    if (consumption.length < 12) caveats.push(`Mới có ${consumption.length}/12 tháng tiêu thụ; cần bổ sung chuỗi thời gian để tăng độ tin cậy.`);
    if (!usableRoofAreaM2) caveats.push('Chưa có diện tích mái authoritative; kết quả chưa bị giới hạn bởi mái.');
    if (!hasRoofOrientation) caveats.push('Chưa đủ dữ liệu tilt/azimuth; orientation factor đang trung tính, chưa kết luận góc tối ưu.');
    if (shadingFactor == null) caveats.push('Chưa có shading factor; cần khảo sát vật cản/bóng đổ.');
    if (!resourceZone) caveats.push('Bức xạ đang dùng giá trị nhập theo assessment, chưa liên kết vùng tài nguyên có version trong PostGIS.');
    if (solarResourceStatus === 'REVIEW_REQUIRED') caveats.push(`Solar resource zone đang có quality ${resourceZone?.quality ?? 'UNKNOWN'}; cần review nguồn trước khi dùng cho quyết định đầu tư.`);
    if (!grid) caveats.push('Chưa tìm thấy grid asset có vị trí; chưa thể đánh giá headroom.');
    if (grid?.isInferred) caveats.push('Grid match suy luận theo TBA gần nhất, cần xác minh EVN trước khi dùng cho đấu nối.');
    if (grid?.method === 'MANUAL_OVERRIDE') caveats.push('Headroom đang dùng giá trị override nhập tay, cần đối chiếu với Grid Capacity Assessment chính thức.');
    const periods = consumption.map((row) => row.period).sort();
    const inputSnapshot = {
      payload,
      consumption: consumption.map((row) => ({ period: row.period, energyKwh: row.energyKwh, daytimeSharePct: row.daytimeSharePct })),
      roof,
      grid,
      resourceZone,
      calculatedSpecificYieldKwhPerKwpYear: round(specificYieldKwhPerKwpYear, 3),
    };
    const inputHash = createHash('sha256').update(JSON.stringify(inputSnapshot)).digest('hex');
    const factors = {
      method: 'SELF_CONSUMPTION_CONSTRAINED_SIZING',
      methodVersion: 'solar-advisor-v2.0',
      yieldModel: 'GHI × orientationFactor × shadingFactor × performanceRatio',
      modelVersion: 'pv-simplified-v1',
      consumptionMonthsUsed: consumption.length,
      annualConsumptionKwh: round(annualConsumptionKwh, 2),
      daytimeSharePct: round(daytimeSharePct, 2),
      irradiationKwhM2Year,
      solarResourceRef,
      solarResourceVersion,
      performanceRatio,
      specificYieldKwhPerKwpYear: round(specificYieldKwhPerKwpYear, 3),
      panelPowerW: payload.panelPowerW,
      panelAreaM2: payload.panelAreaM2,
      roofSurfaceId: roof.roofSurfaceId,
      roofSource: roof.source,
      roofConfidence: roof.confidence,
      roofTiltDeg: tiltDeg,
      roofAzimuthDeg: azimuthDeg,
      suggestedTiltDeg,
      suggestedAzimuthDeg,
      orientationFactor,
      shadingFactor: shadingFactor ?? null,
      solarResourceStatus,
      solarResourceQuality: resourceZone?.quality ?? 'UNVERIFIED_INPUT',
      roofPanelCount,
      roofCapacityKwp: roofCapacityKwp == null ? null : round(roofCapacityKwp, 3),
      consumptionTargetKwp: round(consumptionTargetKwp, 3),
      gridConstraintKwp: availableGridCapacityKw,
      policyConstraintKwp: policyMaxCapacityKwp,
      constraints: constraints.map((constraint) => ({ ...constraint, value: round(constraint.value, 3) })),
      bindingConstraint: { key: bindingConstraint.key, label: bindingConstraint.label, value: round(bindingConstraint.value, 3) },
      constraintModel: {
        consumption: { status: 'AVAILABLE', targetKwp: round(consumptionTargetKwp, 3), monthsUsed: consumption.length, daytimeSharePct: round(daytimeSharePct, 2) },
        roof: { status: roofCapacityKwp == null ? 'UNVERIFIED' : 'AVAILABLE', capacityKwp: roofCapacityKwp == null ? null : round(roofCapacityKwp, 3), roofSurfaceId: roof.roofSurfaceId, source: roof.source, confidence: roof.confidence },
        solarResource: { status: solarResourceStatus, ghiKwhM2Year: irradiationKwhM2Year, reference: solarResourceRef, version: solarResourceVersion, quality: resourceZone?.quality ?? 'UNVERIFIED_INPUT' },
        grid: { status: availableGridCapacityKw == null ? 'UNVERIFIED' : grid?.isInferred ? 'INFERRED' : 'AVAILABLE', capacityKwp: availableGridCapacityKw, assetId: gridAssetId, method: grid?.method ?? null },
        policy: { status: policyMaxCapacityKwp == null ? 'UNSET' : 'AVAILABLE', capacityKwp: policyMaxCapacityKwp },
      },
      gridAutoMatch: grid,
      expectedAnnualYieldKwh: round(expectedAnnualYieldKwh, 2),
      caveats,
      inputSnapshot,
    };

    const [assessment] = await db.insert(energySolarAssessments).values({
      customerAccountId: payload.customerAccountId,
      buildingAssetId: roof.buildingAssetId,
      roofSurfaceId: roof.roofSurfaceId,
      annualConsumptionKwh: String(annualConsumptionKwh),
      daytimeSharePct: String(daytimeSharePct),
      usableRoofAreaM2: usableRoofAreaM2 == null ? null : String(usableRoofAreaM2),
      irradiationKwhM2Year: String(payload.irradiationKwhM2Year),
      recommendedCapacityKwp: String(recommendedCapacityKwp),
      recommendedPanelCount,
      recommendedInverterKw: recommendedInverterKw == null ? null : String(recommendedInverterKw),
      recommendedBatteryKwh: null,
      gridAssetId,
      feederAssetId: grid?.feederAssetId ?? null,
      bayAssetId: grid?.bayAssetId ?? null,
      substationAssetId: grid?.substationAssetId ?? null,
      capacityAssessmentId: grid?.capacityAssessmentId ?? null,
      gridServiceLinkId: grid?.gridServiceLinkId ?? null,
      gridMatchIsInferred: grid?.isInferred ?? false,
      gridAssessedAt: grid?.gridAssessedAt ? new Date(grid.gridAssessedAt) : null,
      availableGridCapacityKw: availableGridCapacityKw == null ? null : String(availableGridCapacityKw),
      score: String(score),
      factors,
      methodVersion: 'solar-advisor-v2.0',
      inputHash,
      consumptionFrom: periods[0] ?? null,
      consumptionTo: periods[periods.length - 1] ?? null,
      solarResourceZoneId: resourceZone?.id ?? null,
      solarResourceRef: solarResourceRef ?? null,
      solarResourceVersion,
      status: 'DRAFT',
      confidence: String(score),
    }).returning();

    return NextResponse.json({
      assessment: {
        ...assessment,
        annualConsumptionKwh,
        daytimeSharePct: round(daytimeSharePct, 2),
        usableRoofAreaM2,
        recommendedCapacityKwp: round(recommendedCapacityKwp, 3),
        recommendedPanelCount,
        recommendedInverterKw,
        availableGridCapacityKw,
        bindingConstraint,
        score,
        confidence: score,
      },
      customer: account,
      grid,
      factors,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Tham số đánh giá Solar không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tính phương án Solar.' }, { status: 400 });
  }
}
