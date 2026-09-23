import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { feature, numeric, parseGeoJson } from '@/server/solar/geo';

export const dynamic = 'force-dynamic';

const uuidSchema = z.string().uuid();

function serializeRoof(row: Record<string, unknown>) {
  return {
    id: row.id,
    code: row.code,
    buildingAssetId: row.buildingAssetId,
    buildingCode: row.buildingCode,
    buildingName: row.buildingName,
    areaM2: numeric(row.areaM2),
    usableAreaM2: numeric(row.usableAreaM2),
    tiltDeg: numeric(row.tiltDeg),
    azimuthDeg: numeric(row.azimuthDeg),
    shadingFactor: numeric(row.shadingFactor),
    source: row.source,
    sourceRef: row.sourceRef,
    confidence: numeric(row.confidence),
    solarResourceZoneId: row.solarResourceZoneId,
    solarResourceCode: row.solarResourceCode,
    solarResourceVersion: row.solarResourceVersion,
    geometry: parseGeoJson(row.geometry),
  };
}

function serializeResource(row: Record<string, unknown>) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    annualGhiKwhM2: numeric(row.annualGhiKwhM2),
    annualDniKwhM2: numeric(row.annualDniKwhM2),
    annualDhiKwhM2: numeric(row.annualDhiKwhM2),
    source: row.source,
    sourceVersion: row.sourceVersion,
    sourceRef: row.sourceRef,
    quality: row.quality,
    confidence: numeric(row.confidence),
    geometry: parseGeoJson(row.boundary),
  };
}

function serializeSystem(row: Record<string, unknown>) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    customerCode: row.customerCode,
    operationStatus: row.operationStatus,
    installedCapacityKwp: numeric(row.installedCapacityKwp),
    annualYieldKwh: numeric(row.annualYieldKwh),
    source: row.source,
    sourceRef: row.sourceRef,
    confidence: numeric(row.confidence),
    distanceM: numeric(row.distanceM),
    geometry: parseGeoJson(row.geometry),
  };
}

function serializeGrid(row: Record<string, unknown>) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    assetType: row.assetType,
    distanceM: numeric(row.distanceM),
    geometry: parseGeoJson(row.geometry),
  };
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const customerAccountId = params.get('customerAccountId')?.trim() || null;
    const customerCode = params.get('customerCode')?.trim() || null;
    const rawLat = params.get('lat');
    const rawLng = params.get('lng');
    const latitude = rawLat == null || rawLat === '' ? null : Number(rawLat);
    const longitude = rawLng == null || rawLng === '' ? null : Number(rawLng);
    if (customerAccountId && !uuidSchema.safeParse(customerAccountId).success) return NextResponse.json({ message: 'customerAccountId không đúng UUID.' }, { status: 400 });
    const coordinatesProvided = latitude != null || longitude != null;
    if (coordinatesProvided && (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)) {
      return NextResponse.json({ message: 'lat/lng phải đi theo cặp và nằm trong phạm vi tọa độ WGS84.' }, { status: 400 });
    }
    if (!customerAccountId && !customerCode && latitude == null) return NextResponse.json({ message: 'Cần truyền customerAccountId, customerCode hoặc cặp lat/lng.' }, { status: 400 });

    let customer: Record<string, unknown> | null = null;
    if (customerAccountId || customerCode) {
      const result = await db.execute(sql`
        SELECT ca.id,
               ca.provider,
               ca.customer_code AS "customerCode",
               ca.customer_type AS "customerType",
               ca.service_address AS "serviceAddress",
               ca.status,
               p.name AS "customerName",
               s.id AS "siteId",
               s.code AS "siteCode",
               s.name AS "siteName",
               s.address AS "siteAddress",
               s.admin_area_code AS "adminAreaCode",
               ST_X(s.location::geometry)::double precision AS longitude,
               ST_Y(s.location::geometry)::double precision AS latitude,
               ST_AsGeoJSON(s.boundary) AS "siteBoundary"
        FROM energy_customer_accounts ca
        JOIN energy_parties p ON p.id = ca.party_id
        LEFT JOIN energy_sites s ON s.id = ca.site_id
        WHERE ${customerAccountId ? sql`ca.id = ${customerAccountId}::uuid` : sql`ca.customer_code = ${customerCode}`}
        LIMIT 1
      `);
      customer = (result.rows[0] as Record<string, unknown> | undefined) ?? null;
      if ((customerAccountId || customerCode) && !customer) return NextResponse.json({ message: 'Không tìm thấy khách hàng EVN.' }, { status: 404 });
    }

    const centerLatitude = numeric(customer?.latitude) ?? latitude;
    const centerLongitude = numeric(customer?.longitude) ?? longitude;
    const siteId = typeof customer?.siteId === 'string' ? customer.siteId : null;
    const point = centerLatitude != null && centerLongitude != null
      ? sql`ST_SetSRID(ST_Point(${centerLongitude}, ${centerLatitude}), 4326)`
      : sql`NULL::geometry`;
    const pointGeography = sql`(${point})::geography`;
    const siteRoofCondition = siteId ? sql`b.site_id = ${siteId}::uuid` : sql`FALSE`;
    const proximityRoofCondition = centerLatitude != null ? sql`rs.geometry IS NOT NULL AND ST_DWithin(rs.geometry::geography, ${pointGeography}, 5000)` : sql`FALSE`;
    const roofResult = await db.execute(sql`
      SELECT rs.id,
             rs.code,
             rs.building_asset_id AS "buildingAssetId",
             a.code AS "buildingCode",
             a.name AS "buildingName",
             rs.area_m2 AS "areaM2",
             rs.usable_area_m2 AS "usableAreaM2",
             rs.tilt_deg AS "tiltDeg",
             rs.azimuth_deg AS "azimuthDeg",
             rs.shading_factor AS "shadingFactor",
             rs.source,
             rs.source_ref AS "sourceRef",
             rs.confidence,
             rs.solar_resource_zone_id AS "solarResourceZoneId",
             rz.code AS "solarResourceCode",
             rz.source_version AS "solarResourceVersion",
             ST_AsGeoJSON(rs.geometry) AS geometry
      FROM energy_roof_surfaces rs
      JOIN energy_buildings b ON b.asset_id = rs.building_asset_id
      JOIN energy_assets a ON a.id = b.asset_id
      LEFT JOIN energy_solar_resource_zones rz ON rz.id = rs.solar_resource_zone_id AND rz.status = 'ACTIVE'
      WHERE rs.status = 'ACTIVE' AND (${siteRoofCondition} OR ${proximityRoofCondition})
      ORDER BY rs.usable_area_m2 DESC NULLS LAST, rs.area_m2 DESC
      LIMIT 500
    `);
    const roofs = roofResult.rows.map((row) => serializeRoof(row as Record<string, unknown>));

    const resourceResult = await db.execute(sql`
      SELECT rz.id,
             rz.code,
             rz.name,
             ST_AsGeoJSON(rz.boundary) AS boundary,
             rz.annual_ghi_kwh_m2 AS "annualGhiKwhM2",
             rz.annual_dni_kwh_m2 AS "annualDniKwhM2",
             rz.annual_dhi_kwh_m2 AS "annualDhiKwhM2",
             rz.source,
             rz.source_version AS "sourceVersion",
             rz.source_ref AS "sourceRef",
             rz.quality,
             rz.confidence
      FROM energy_solar_resource_zones rz
      WHERE rz.status = 'ACTIVE'
        AND (
          (${centerLatitude != null ? sql`rz.boundary IS NOT NULL AND ST_DWithin(rz.boundary::geography, ${pointGeography}, 5000)` : sql`FALSE`})
          OR EXISTS (
            SELECT 1
            FROM energy_roof_surfaces rs
            JOIN energy_buildings b ON b.asset_id = rs.building_asset_id
            WHERE rs.solar_resource_zone_id = rz.id
              AND rs.status = 'ACTIVE'
              AND ${siteRoofCondition}
          )
        )
      ORDER BY rz.code
      LIMIT 100
    `);
    const resources = resourceResult.rows.map((row) => serializeResource(row as Record<string, unknown>));

    const consumptionResult = customer?.id
      ? await db.execute(sql`
          SELECT period, energy_kwh AS "energyKwh", peak_demand_kw AS "peakDemandKw", daytime_share_pct AS "daytimeSharePct", source
          FROM energy_customer_consumption_monthly
          WHERE account_id = ${customer.id}::uuid
          ORDER BY period DESC
          LIMIT 24
        `)
      : { rows: [] };
    const consumption = consumptionResult.rows.map((row) => ({
      period: row.period,
      energyKwh: numeric(row.energyKwh) ?? 0,
      peakDemandKw: numeric(row.peakDemandKw),
      daytimeSharePct: numeric(row.daytimeSharePct),
      source: row.source,
    }));

    const linkResult = customer?.id
      ? await db.execute(sql`
          SELECT l.id,
                 l.service_point_code AS "servicePointCode",
                 l.measurement_point_id AS "measurementPointId",
                 l.feeder_asset_id AS "feederAssetId",
                 l.bay_asset_id AS "bayAssetId",
                 l.transformer_asset_id AS "transformerAssetId",
                 l.substation_asset_id AS "substationAssetId",
                 l.valid_from AS "validFrom",
                 l.valid_to AS "validTo",
                 l.source,
                 l.source_ref AS "sourceRef",
                 l.confidence,
                 l.is_inferred AS "isInferred",
                 COALESCE(fa.code, ba.code, ta.code, sa.code) AS "gridCode",
                 COALESCE(fa.name, ba.name, ta.name, sa.name) AS "gridName",
                 COALESCE(l.feeder_asset_id, l.bay_asset_id, l.transformer_asset_id, l.substation_asset_id) AS "gridAssetId",
                 latest.id AS "capacityAssessmentId",
                 latest.assessed_at AS "gridAssessedAt",
                 latest.available_capacity_mw * 1000 AS "availableCapacityKw",
                 f.headroom_mw * 1000 AS "feederHeadroomKw"
          FROM energy_customer_grid_service_links l
          LEFT JOIN energy_assets fa ON fa.id = l.feeder_asset_id
          LEFT JOIN energy_assets ba ON ba.id = l.bay_asset_id
          LEFT JOIN energy_assets ta ON ta.id = l.transformer_asset_id
          LEFT JOIN energy_assets sa ON sa.id = l.substation_asset_id
          LEFT JOIN energy_feeders f ON f.asset_id = l.feeder_asset_id
          LEFT JOIN LATERAL (
            SELECT g.id, g.assessed_at, g.available_capacity_mw
            FROM energy_grid_capacity_assessments g
            WHERE g.asset_id = COALESCE(l.feeder_asset_id, l.bay_asset_id, l.transformer_asset_id, l.substation_asset_id)
            ORDER BY g.assessed_at DESC
            LIMIT 1
          ) latest ON TRUE
          WHERE l.customer_account_id = ${customer.id}::uuid
            AND (l.valid_from IS NULL OR l.valid_from <= now())
            AND (l.valid_to IS NULL OR l.valid_to >= now())
          ORDER BY l.is_inferred ASC, l.valid_from DESC NULLS LAST, l.created_at DESC
          LIMIT 1
        `)
      : { rows: [] };
    const serviceLink = (linkResult.rows[0] as Record<string, unknown> | undefined) ?? null;

    const gridAssetIds = serviceLink
      ? [serviceLink.feederAssetId, serviceLink.bayAssetId, serviceLink.transformerAssetId, serviceLink.substationAssetId].filter((value): value is string => typeof value === 'string')
      : [];
    const linkAssetCondition = gridAssetIds.length
      ? sql`a.id IN (${sql.join(gridAssetIds.map((id) => sql`${id}::uuid`), sql`, `)})`
      : sql`FALSE`;
    const proximityGridCondition = centerLatitude != null ? sql`ST_DWithin(a.location::geography, ${pointGeography}, 10000)` : sql`FALSE`;
    const gridResult = await db.execute(sql`
      SELECT a.id,
             a.code,
             a.name,
             a.asset_type AS "assetType",
             ST_Distance(a.location::geography, ${pointGeography}) AS "distanceM",
             ST_AsGeoJSON(a.location::geometry) AS geometry
      FROM energy_assets a
      WHERE a.asset_type IN ('SUBSTATION', 'FEEDER', 'BAY', 'TRANSFORMER')
        AND a.location IS NOT NULL
        AND (${linkAssetCondition} OR ${proximityGridCondition})
      ORDER BY CASE WHEN ${linkAssetCondition} THEN 0 ELSE 1 END, "distanceM"
      LIMIT 100
    `);
    const gridAssets = gridResult.rows.map((row) => serializeGrid(row as Record<string, unknown>));

    const systemResult = await db.execute(sql`
      SELECT a.id,
             a.code,
             a.name,
             ca.customer_code AS "customerCode",
             rs.operation_status AS "operationStatus",
             rs.installed_capacity_kwp AS "installedCapacityKwp",
             rs.annual_yield_kwh AS "annualYieldKwh",
             rs.source,
             rs.source_ref AS "sourceRef",
             rs.confidence,
             ST_Distance(a.location::geography, ${pointGeography}) AS "distanceM",
             ST_AsGeoJSON(a.location::geometry) AS geometry
      FROM energy_rooftop_systems rs
      JOIN energy_assets a ON a.id = rs.asset_id
      LEFT JOIN energy_customer_accounts ca ON ca.id = rs.customer_account_id
      WHERE rs.operation_status <> 'DELETED'
        AND a.status <> 'DELETED'
        AND a.location IS NOT NULL
        AND (${siteId ? sql`a.site_id = ${siteId}::uuid` : sql`FALSE`} OR ${proximityGridCondition})
      ORDER BY "distanceM"
      LIMIT 200
    `);
    const nearbySystems = systemResult.rows.map((row) => serializeSystem(row as Record<string, unknown>));

    const latestAssessmentResult = customer?.id
      ? await db.execute(sql`
          SELECT id, assessed_at AS "assessedAt", recommended_capacity_kwp AS "recommendedCapacityKwp", score, status, method_version AS "methodVersion"
          FROM energy_solar_assessments
          WHERE customer_account_id = ${customer.id}::uuid
          ORDER BY assessed_at DESC
          LIMIT 1
        `)
      : { rows: [] };
    const latestAssessment = (latestAssessmentResult.rows[0] as Record<string, unknown> | undefined) ?? null;

    const features = [];
    if (centerLatitude != null && centerLongitude != null) {
      features.push(feature('context-customer', { type: 'Point', coordinates: [centerLongitude, centerLatitude] }, {
        layer: 'customer',
        label: customer?.customerCode ? `Khách hàng ${customer.customerCode}` : 'Vị trí tra cứu',
        customerAccountId: customer?.id ?? null,
      }));
    }
    if (customer?.siteBoundary) features.push(feature(`site-${String(customer.siteId)}`, parseGeoJson(customer.siteBoundary), { layer: 'site', siteCode: customer.siteCode, siteName: customer.siteName }));
    roofs.forEach((roof) => features.push(feature(`roof-${String(roof.id)}`, roof.geometry, { layer: 'roof', code: roof.code, buildingName: roof.buildingName, usableAreaM2: roof.usableAreaM2, source: roof.source, confidence: roof.confidence })));
    resources.forEach((resource) => features.push(feature(`resource-${String(resource.id)}`, resource.geometry, { layer: 'solar-resource', code: resource.code, name: resource.name, annualGhiKwhM2: resource.annualGhiKwhM2, source: resource.source, sourceVersion: resource.sourceVersion })));
    nearbySystems.forEach((system) => features.push(feature(`system-${String(system.id)}`, system.geometry, { layer: 'rooftop-system', code: system.code, capacityKwp: system.installedCapacityKwp, status: system.operationStatus, distanceM: system.distanceM })));
    gridAssets.forEach((asset) => features.push(feature(`grid-${String(asset.id)}`, asset.geometry, { layer: 'grid', code: asset.code, name: asset.name, assetType: asset.assetType, distanceM: asset.distanceM })));

    const warnings: string[] = [];
    if (!customer) warnings.push('Đang xem context theo tọa độ; chưa gắn vào tài khoản khách hàng EVN, không có dữ liệu tiêu thụ cá nhân.');
    if (customer && centerLatitude == null) warnings.push('Khách hàng chưa có tọa độ site; GIS không tự geocode và không thể suy ra vị trí bản đồ.');
    if (customer && consumption.length < 12) warnings.push(`Mới có ${consumption.length}/12 tháng tiêu thụ trong context.`);
    if (!roofs.length) warnings.push('Chưa có roof surface active trong phạm vi context; cần khảo sát hoặc import polygon mái.');
    if (!resources.length) warnings.push('Chưa có solar resource zone active giao cắt/ở gần context.');
    if (!serviceLink) warnings.push('Chưa có mapping service point–grid asset chính thức còn hiệu lực.');
    if (serviceLink?.isInferred) warnings.push('Mapping lưới hiện tại là suy luận; cần xác minh EVN trước khi dùng cho đấu nối.');
    if (serviceLink && !serviceLink.sourceRef) warnings.push('Mapping lưới thiếu source reference để truy vết.');

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      selection: { customerAccountId: customer?.id ?? null, customerCode: customer?.customerCode ?? customerCode, matchedBy: customer ? (customerAccountId ? 'CUSTOMER_ACCOUNT_ID' : 'CUSTOMER_CODE') : 'COORDINATES' },
      center: centerLatitude != null && centerLongitude != null ? { latitude: centerLatitude, longitude: centerLongitude } : null,
      customer: customer ? {
        id: customer.id,
        provider: customer.provider,
        customerCode: customer.customerCode,
        customerName: customer.customerName,
        customerType: customer.customerType,
        serviceAddress: customer.serviceAddress,
        status: customer.status,
        siteId: customer.siteId,
        siteCode: customer.siteCode,
        siteName: customer.siteName,
        adminAreaCode: customer.adminAreaCode,
        latitude: centerLatitude,
        longitude: centerLongitude,
      } : null,
      consumption,
      roofs,
      resources,
      grid: {
        serviceLink: serviceLink ? {
          ...serviceLink,
          availableCapacityKw: numeric(serviceLink.availableCapacityKw) ?? numeric(serviceLink.feederHeadroomKw),
          confidence: numeric(serviceLink.confidence),
        } : null,
        assets: gridAssets,
      },
      nearbySystems,
      latestAssessment: latestAssessment ? {
        ...latestAssessment,
        recommendedCapacityKwp: numeric(latestAssessment.recommendedCapacityKwp),
        score: numeric(latestAssessment.score),
      } : null,
      warnings,
      features: { type: 'FeatureCollection', features },
    });
  } catch (error) {
    console.error('Solar GIS customer context failed', error);
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải context GIS Solar.' }, { status: 500 });
  }
}
