import { desc, eq, sql } from 'drizzle-orm';
import {
  energyOutageAffectedAreas,
  energyOutagePlans,
  energyOutageSourceRecords,
} from '@/db/schema';
import { db } from '@/lib/db';

const ENGINE_METHOD = 'TOPOLOGY_IMPACT_V1';
const DOWNSTREAM_RELATIONS = ['FEEDS', 'EVN_PARENT', 'SUPPLIED_BY', 'CONNECTED_TO', 'CONTAINS'] as const;
const ASSET_REFERENCE_KEYS = new Set([
  'assetid', 'assetids', 'assetcode', 'assetcodes', 'affectedassetid', 'affectedassetids',
  'affectedassetcode', 'affectedassetcodes', 'feederid', 'feederids', 'feedercode', 'feedercodes',
  'lineid', 'lineids', 'linecode', 'linecodes', 'powerlineid', 'powerlineids', 'powerlinecode', 'powerlinecodes',
  'substationid', 'substationids', 'substationcode', 'substationcodes', 'transformerid', 'transformerids',
  'transformercode', 'transformercodes', 'bayid', 'bayids', 'baycode', 'baycodes', 'assets', 'affectedassets',
]);
const CUSTOMER_REFERENCE_KEYS = new Set([
  'customerid', 'customerids', 'customercode', 'customercodes', 'affectedcustomerid', 'affectedcustomerids',
  'affectedcustomercode', 'affectedcustomercodes', 'customers', 'customeraccounts', 'affectedcustomers',
]);
const SERVICE_POINT_KEYS = new Set(['servicepointcode', 'servicepointcodes', 'servicepoints', 'meterpointcode', 'meterpointcodes']);

type UnknownRecord = Record<string, unknown>;

function normalizeKey(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function appendScalar(value: unknown, target: Set<string>) {
  if (typeof value === 'string' || typeof value === 'number') {
    const normalized = String(value).trim();
    if (normalized) target.add(normalized);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => appendScalar(item, target));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value as UnknownRecord)) {
      const normalizedKey = normalizeKey(key);
      if (['id', 'code', 'assetid', 'assetcode', 'customerid', 'customercode', 'servicepointcode', 'value'].includes(normalizedKey)) {
        appendScalar(item, target);
      }
    }
  }
}

function collectReferences(payload: unknown, keys: Set<string>) {
  const result = new Set<string>();
  const walk = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value as UnknownRecord)) {
      if (keys.has(normalizeKey(key))) appendScalar(child, result);
      walk(child);
    }
  };
  walk(payload);
  return [...result];
}

function numberOrNull(value: unknown) {
  if (value == null) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function parseGeoJson(value: unknown) {
  if (typeof value !== 'string') return value ?? null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function uuidArray(values: string[]) {
  return values.length
    ? sql`ARRAY[${sql.join(values.map((value) => sql`${value}::uuid`), sql`, `)}]::uuid[]`
    : sql`ARRAY[]::uuid[]`;
}

function textArray(values: string[]) {
  return values.length
    ? sql`ARRAY[${sql.join(values.map((value) => sql`${value}`), sql`, `)}]::text[]`
    : sql`ARRAY[]::text[]`;
}

export type OutageImpact = {
  outage: Record<string, unknown>;
  sourceRecords: Array<Record<string, unknown>>;
  summary: {
    affectedCustomers: number;
    affectedLoadMw: number;
    affectedAssets: number;
    affectedAreas: number;
    criticalFacilities: number | null;
    inferredLinks: number;
  };
  customers: Array<Record<string, unknown>>;
  assets: Array<Record<string, unknown>>;
  areas: Array<Record<string, unknown>>;
  affectedGeometry: unknown;
  warnings: string[];
  method: string;
};

export async function readOutageImpact(outageId: string): Promise<OutageImpact | null> {
  const [outage] = await db.select().from(energyOutagePlans).where(eq(energyOutagePlans.id, outageId)).limit(1);
  if (!outage) return null;
  const [customers, assets, areas, geometryResult, sourceRecords] = await Promise.all([
    db.execute(sql`
      SELECT oc.id,
             oc.customer_account_id AS "customerAccountId",
             ca.customer_code AS "customerCode",
             oc.service_point_code AS "servicePointCode",
             oc.primary_asset_id AS "primaryAssetId",
             oc.is_critical AS "isCritical",
             oc.determination_method AS "determinationMethod",
             oc.source_ref AS "sourceRef",
             s.admin_area_code AS "adminAreaCode"
      FROM energy_outage_affected_customers oc
      LEFT JOIN energy_customer_accounts ca ON ca.id = oc.customer_account_id
      LEFT JOIN energy_sites s ON s.id = ca.site_id
      WHERE oc.outage_id = ${outageId}::uuid
      ORDER BY ca.customer_code NULLS LAST, oc.service_point_code NULLS LAST
    `),
    db.execute(sql`
      SELECT oa.id,
             oa.asset_id AS "assetId",
             a.code,
             a.name,
             a.asset_type AS "assetType",
             oa.relation_type AS "relationType",
             oa.is_primary AS "isPrimary",
             oa.determination_method AS "determinationMethod",
             oa.source_ref AS "sourceRef"
      FROM energy_outage_affected_assets oa
      JOIN energy_assets a ON a.id = oa.asset_id
      WHERE oa.outage_id = ${outageId}::uuid
      ORDER BY oa.is_primary DESC, oa.relation_type, a.name
    `),
    db.select().from(energyOutageAffectedAreas)
      .where(eq(energyOutageAffectedAreas.outageId, outageId))
      .orderBy(desc(energyOutageAffectedAreas.affectedCustomerCount)),
    db.execute(sql`SELECT ST_AsGeoJSON(affected_geometry) AS geometry FROM energy_outage_plans WHERE id = ${outageId}::uuid`),
    db.select().from(energyOutageSourceRecords)
      .where(eq(energyOutageSourceRecords.outageId, outageId))
      .orderBy(desc(energyOutageSourceRecords.fetchedAt)),
  ]);
  const customerRows = customers.rows as Array<Record<string, unknown>>;
  const assetRows = assets.rows as Array<Record<string, unknown>>;
  const areaRows = areas.map((area) => ({
    ...area,
    affectedCustomerCount: numberOrNull(area.affectedCustomerCount),
    affectedLoadMw: numberOrNull(area.affectedLoadMw),
  }));
  const inferredLinks = customerRows.filter((customer) => customer.determinationMethod === 'TOPOLOGY_INFERRED').length;
  const warnings: string[] = [];
  if (!sourceRecords.length && !assetRows.length && !customerRows.length) {
    warnings.push('No EVN source record or resolved asset/customer reference is available; topology impact is not inferred.');
  }
  if (!customerRows.length) warnings.push('No valid customer-grid-service-link matched this outage interval; affected customers are not inferred by radius.');
  if (!assetRows.length) warnings.push('No feeder/line/transformer/substation/bay was resolved from the source or valid customer-grid links.');
  if (!areaRows.length) warnings.push('No administrative area was available from the linked customer Site records.');
  if (inferredLinks) warnings.push(`${inferredLinks} affected customer link(s) are inferred and require EVN verification.`);
  if (areaRows.length && areaRows.every((area) => area.criticalFacilityCount == null)) {
    warnings.push('Critical-facility classification is unavailable; the critical-facility count is not asserted.');
  }
  if (!geometryResult.rows[0]?.geometry) warnings.push('Affected geometry is unavailable because linked customer/grid assets have no real geometry.');
  if (outage.impactMethod === 'RADIUS_ESTIMATE') warnings.push('The current geometry is a radius estimate and must not be treated as official EVN impact geometry.');
  return {
    outage: {
      ...outage,
      affectedCustomers: numberOrNull(outage.affectedCustomers),
      impactMethod: outage.impactMethod,
    },
    sourceRecords: sourceRecords.map((record) => ({
      ...record,
      rawPayload: record.rawPayload ?? {},
    })),
    summary: {
      affectedCustomers: customerRows.length,
      affectedLoadMw: areaRows.reduce((sum, area) => sum + (numberOrNull(area.affectedLoadMw) ?? 0), 0),
      affectedAssets: assetRows.length,
      affectedAreas: areaRows.length,
      criticalFacilities: areaRows.some((area) => area.criticalFacilityCount != null)
        ? areaRows.reduce((sum, area) => sum + (Number(area.criticalFacilityCount) || 0), 0)
        : null,
      inferredLinks,
    },
    customers: customerRows,
    assets: assetRows,
    areas: areaRows,
    affectedGeometry: parseGeoJson(geometryResult.rows[0]?.geometry),
    warnings,
    method: outage.impactMethod || ENGINE_METHOD,
  };
}

async function resolveSourceContext(outageId: string) {
  const [sourceRecord] = await db.select().from(energyOutageSourceRecords)
    .where(eq(energyOutageSourceRecords.outageId, outageId))
    .orderBy(desc(energyOutageSourceRecords.fetchedAt))
    .limit(1);
  const payload = sourceRecord?.rawPayload ?? {};
  const assetReferences = uniqueStrings(collectReferences(payload, ASSET_REFERENCE_KEYS));
  const customerReferences = uniqueStrings(collectReferences(payload, CUSTOMER_REFERENCE_KEYS));
  const servicePointCodes = uniqueStrings(collectReferences(payload, SERVICE_POINT_KEYS));
  const assetIds = assetReferences.filter(isUuid);
  const assetCodes = assetReferences.filter((value) => !isUuid(value));
  return { sourceRecord, assetReferences, assetIds, assetCodes, customerReferences, servicePointCodes };
}

async function resolveAssetIds(assetIds: string[], assetCodes: string[]) {
  const [byId, byCode] = await Promise.all([
    assetIds.length
      ? db.execute(sql`SELECT id, code FROM energy_assets WHERE id = ANY(${uuidArray(assetIds)})`)
      : Promise.resolve({ rows: [] as Array<Record<string, unknown>> }),
    assetCodes.length
      ? db.execute(sql`SELECT id, code FROM energy_assets WHERE lower(code) = ANY(${textArray(assetCodes.map((code) => code.toLowerCase()))})`)
      : Promise.resolve({ rows: [] as Array<Record<string, unknown>> }),
  ]);
  const rows = [...(byId.rows as Array<Record<string, unknown>>), ...(byCode.rows as Array<Record<string, unknown>>)] as Array<Record<string, unknown>>;
  const ids = uniqueStrings(rows.map((row) => String(row.id)));
  const resolvedCodes = uniqueStrings(rows.map((row) => String(row.code)));
  return { ids, codes: resolvedCodes };
}

async function resolveCustomerIds(customerReferences: string[]) {
  const ids = customerReferences.filter(isUuid);
  const codes = customerReferences.filter((value) => !isUuid(value));
  const rows = customerReferences.length
    ? await db.execute(sql`
        SELECT id, customer_code AS "customerCode"
        FROM energy_customer_accounts
        WHERE (${ids.length > 0} AND id = ANY(${uuidArray(ids)}))
           OR (${codes.length > 0} AND lower(customer_code) = ANY(${textArray(codes.map((code) => code.toLowerCase()))}))
      `)
    : { rows: [] as Array<Record<string, unknown>> };
  return uniqueStrings((rows.rows as Array<Record<string, unknown>>).map((row) => String(row.id)));
}

async function resolveTopologyAssetIds(seedIds: string[], outageStartAt: Date) {
  if (!seedIds.length) return [];
  const result = await db.execute(sql`
    WITH RECURSIVE closure AS (
      SELECT a.id, 0::integer AS depth, ARRAY[a.id]::uuid[] AS path
      FROM energy_assets a
      WHERE a.id = ANY(${uuidArray(seedIds)})

      UNION ALL

      SELECT child.id, parent.depth + 1, parent.path || child.id
      FROM closure parent
      JOIN energy_asset_relations r ON r.from_asset_id = parent.id
      JOIN energy_assets child ON child.id = r.to_asset_id
      WHERE parent.depth < 20
        AND r.relation_type = ANY(${textArray([...DOWNSTREAM_RELATIONS])})
        AND (r.valid_from IS NULL OR r.valid_from <= ${outageStartAt})
        AND (r.valid_to IS NULL OR r.valid_to >= ${outageStartAt})
        AND NOT child.id = ANY(parent.path)
    )
    SELECT DISTINCT id FROM closure
  `);
  return uniqueStrings((result.rows as Array<Record<string, unknown>>).map((row) => String(row.id)));
}

export async function rebuildOutageImpact(outageId: string, determinationMethod = 'TOPOLOGY_DERIVED') {
  const [outage] = await db.select().from(energyOutagePlans).where(eq(energyOutagePlans.id, outageId)).limit(1);
  if (!outage) return null;
  const context = await resolveSourceContext(outageId);
  const resolvedAssets = await resolveAssetIds(context.assetIds, context.assetCodes);
  const topologyAssetIds = await resolveTopologyAssetIds(resolvedAssets.ids, outage.startAt);
  const resolvedCustomerIds = await resolveCustomerIds(context.customerReferences);
  const sourceRef = context.sourceRecord?.sourceRecordId ?? outage.sourceRecordId ?? null;
  const hasExplicitSourceRefs = topologyAssetIds.length > 0 || resolvedCustomerIds.length > 0 || context.servicePointCodes.length > 0;
  const requestedMethod = determinationMethod === 'TOPOLOGY_DERIVED' ? determinationMethod : 'TOPOLOGY_DERIVED';
  const sourceCustomerMethod = resolvedCustomerIds.length || context.servicePointCodes.length ? 'EVN_PROVIDED_CUSTOMER_LIST' : requestedMethod;

  await db.transaction(async (tx) => {
    await tx.execute(sql`DELETE FROM energy_outage_affected_customers WHERE outage_id = ${outageId}::uuid`);
    await tx.execute(sql`DELETE FROM energy_outage_affected_assets WHERE outage_id = ${outageId}::uuid`);
    await tx.execute(sql`DELETE FROM energy_outage_affected_areas WHERE outage_id = ${outageId}::uuid`);

    await tx.execute(sql`
      WITH valid_links AS (
        SELECT DISTINCT ON (l.customer_account_id, l.service_point_code) l.*
        FROM energy_customer_grid_service_links l
        WHERE (l.valid_from IS NULL OR l.valid_from <= ${outage.startAt})
          AND (l.valid_to IS NULL OR l.valid_to >= ${outage.startAt})
        ORDER BY l.customer_account_id, l.service_point_code, l.valid_from DESC NULLS LAST, l.created_at DESC, l.id DESC
      ), selected_links AS (
        SELECT vl.*
        FROM valid_links vl
        WHERE (${topologyAssetIds.length > 0}
          AND (vl.feeder_asset_id = ANY(${uuidArray(topologyAssetIds)})
            OR vl.transformer_asset_id = ANY(${uuidArray(topologyAssetIds)})
            OR vl.substation_asset_id = ANY(${uuidArray(topologyAssetIds)})
            OR vl.bay_asset_id = ANY(${uuidArray(topologyAssetIds)})))
           OR (${resolvedCustomerIds.length > 0} AND vl.customer_account_id = ANY(${uuidArray(resolvedCustomerIds)}))
           OR (${context.servicePointCodes.length > 0} AND vl.service_point_code = ANY(${textArray(context.servicePointCodes)}))
      )
      INSERT INTO energy_outage_affected_customers
        (id, outage_id, customer_account_id, service_point_code, primary_asset_id, is_critical, determination_method, source_ref)
      SELECT gen_random_uuid(), ${outageId}::uuid, l.customer_account_id, l.service_point_code,
             COALESCE(l.feeder_asset_id, l.transformer_asset_id, l.substation_asset_id, l.bay_asset_id),
             CASE WHEN ca.metadata->>'isCritical' = 'true'
                       OR UPPER(COALESCE(ca.customer_type, '')) IN ('CRITICAL', 'HOSPITAL', 'SCHOOL', 'EMERGENCY')
                  THEN true ELSE false END,
             CASE WHEN l.is_inferred THEN 'TOPOLOGY_INFERRED' ELSE ${requestedMethod} END,
             COALESCE(l.source_ref, ${sourceRef})
      FROM selected_links l
      JOIN energy_customer_accounts ca ON ca.id = l.customer_account_id
      ON CONFLICT (outage_id, customer_account_id, service_point_code) DO UPDATE
        SET primary_asset_id = EXCLUDED.primary_asset_id,
            is_critical = EXCLUDED.is_critical,
            determination_method = EXCLUDED.determination_method,
            source_ref = EXCLUDED.source_ref
    `);

    await tx.execute(sql`
      INSERT INTO energy_outage_affected_customers
        (id, outage_id, customer_account_id, service_point_code, is_critical, determination_method, source_ref)
      SELECT gen_random_uuid(), ${outageId}::uuid, ca.id, NULL,
             CASE WHEN ca.metadata->>'isCritical' = 'true'
                       OR UPPER(COALESCE(ca.customer_type, '')) IN ('CRITICAL', 'HOSPITAL', 'SCHOOL', 'EMERGENCY')
                  THEN true ELSE false END,
             'EVN_PROVIDED_CUSTOMER_LIST', ${sourceRef}
      FROM energy_customer_accounts ca
      WHERE ca.id = ANY(${uuidArray(resolvedCustomerIds)})
        AND NOT EXISTS (
          SELECT 1 FROM energy_outage_affected_customers existing
          WHERE existing.outage_id = ${outageId}::uuid
            AND existing.customer_account_id = ca.id
            AND existing.service_point_code IS NULL
        )
    `);

    await tx.execute(sql`
      INSERT INTO energy_outage_affected_assets
        (id, outage_id, asset_id, relation_type, is_primary, determination_method, source_ref)
      SELECT gen_random_uuid(), ${outageId}::uuid, a.id,
             CASE WHEN a.id = ANY(${uuidArray(resolvedAssets.ids)}) THEN 'OUTAGE_SOURCE' ELSE 'TOPOLOGY_DOWNSTREAM' END,
             a.id = ANY(${uuidArray(resolvedAssets.ids)}), ${requestedMethod}, ${sourceRef}
      FROM energy_assets a
      WHERE a.id = ANY(${uuidArray(topologyAssetIds)})
      ON CONFLICT (outage_id, asset_id, relation_type) DO UPDATE
        SET is_primary = EXCLUDED.is_primary,
            determination_method = EXCLUDED.determination_method,
            source_ref = EXCLUDED.source_ref
    `);

    await tx.execute(sql`
      WITH valid_links AS (
        SELECT DISTINCT ON (l.customer_account_id, l.service_point_code) l.*
        FROM energy_customer_grid_service_links l
        WHERE (l.valid_from IS NULL OR l.valid_from <= ${outage.startAt})
          AND (l.valid_to IS NULL OR l.valid_to >= ${outage.startAt})
        ORDER BY l.customer_account_id, l.service_point_code, l.valid_from DESC NULLS LAST, l.created_at DESC, l.id DESC
      ), selected_links AS (
        SELECT vl.*
        FROM valid_links vl
        WHERE (${topologyAssetIds.length > 0}
          AND (vl.feeder_asset_id = ANY(${uuidArray(topologyAssetIds)})
            OR vl.transformer_asset_id = ANY(${uuidArray(topologyAssetIds)})
            OR vl.substation_asset_id = ANY(${uuidArray(topologyAssetIds)})
            OR vl.bay_asset_id = ANY(${uuidArray(topologyAssetIds)})))
           OR (${resolvedCustomerIds.length > 0} AND vl.customer_account_id = ANY(${uuidArray(resolvedCustomerIds)}))
           OR (${context.servicePointCodes.length > 0} AND vl.service_point_code = ANY(${textArray(context.servicePointCodes)}))
      )
      INSERT INTO energy_outage_affected_assets
        (id, outage_id, asset_id, relation_type, is_primary, determination_method, source_ref)
      SELECT gen_random_uuid(), ${outageId}::uuid, linked.asset_id, linked.relation_type,
             linked.relation_type = 'FEEDER',
             CASE WHEN sl.is_inferred THEN 'TOPOLOGY_INFERRED' ELSE ${requestedMethod} END,
             COALESCE(sl.source_ref, ${sourceRef})
      FROM selected_links sl
      CROSS JOIN LATERAL (VALUES
        ('FEEDER', sl.feeder_asset_id), ('TRANSFORMER', sl.transformer_asset_id),
        ('SUBSTATION', sl.substation_asset_id), ('BAY', sl.bay_asset_id)
      ) linked(relation_type, asset_id)
      WHERE linked.asset_id IS NOT NULL
      ON CONFLICT (outage_id, asset_id, relation_type) DO UPDATE
        SET is_primary = EXCLUDED.is_primary,
            determination_method = EXCLUDED.determination_method,
            source_ref = EXCLUDED.source_ref
    `);

    await tx.execute(sql`
      INSERT INTO energy_outage_affected_areas
        (id, outage_id, admin_area_code, affected_customer_count, affected_load_mw, critical_facility_count, determination_method, source_ref)
      SELECT gen_random_uuid(), ${outageId}::uuid, s.admin_area_code,
             COUNT(DISTINCT oc.customer_account_id),
             COALESCE(SUM(cm.peak_demand_kw), 0) / 1000.0,
             CASE WHEN COUNT(*) FILTER (WHERE oc.is_critical) > 0 THEN COUNT(*) FILTER (WHERE oc.is_critical) ELSE NULL END,
             MAX(oc.determination_method), MAX(oc.source_ref)
      FROM energy_outage_affected_customers oc
      JOIN energy_customer_accounts ca ON ca.id = oc.customer_account_id
      JOIN energy_sites s ON s.id = ca.site_id
      LEFT JOIN energy_customer_consumption_monthly cm
        ON cm.account_id = oc.customer_account_id AND cm.period = TO_CHAR(${outage.startAt}::timestamptz, 'YYYY-MM')
      WHERE oc.outage_id = ${outageId}::uuid AND s.admin_area_code IS NOT NULL
      GROUP BY s.admin_area_code
      ON CONFLICT (outage_id, admin_area_code) DO UPDATE
        SET affected_customer_count = EXCLUDED.affected_customer_count,
            affected_load_mw = EXCLUDED.affected_load_mw,
            critical_facility_count = EXCLUDED.critical_facility_count,
            determination_method = EXCLUDED.determination_method,
            source_ref = EXCLUDED.source_ref
    `);

    await tx.execute(sql`
      UPDATE energy_outage_plans p
      SET affected_customers = (SELECT COUNT(*) FROM energy_outage_affected_customers WHERE outage_id = ${outageId}::uuid),
          affected_geometry = COALESCE((
            SELECT ST_ConvexHull(ST_Collect(source_geom))
            FROM (
              SELECT COALESCE(s.location::geometry, s.boundary) AS source_geom
              FROM energy_outage_affected_customers oc
              JOIN energy_customer_accounts ca ON ca.id = oc.customer_account_id
              JOIN energy_sites s ON s.id = ca.site_id
              WHERE oc.outage_id = ${outageId}::uuid AND COALESCE(s.location::geometry, s.boundary) IS NOT NULL
              UNION ALL
              SELECT COALESCE(a.location::geometry, a.boundary) AS source_geom
              FROM energy_outage_affected_assets oa
              JOIN energy_assets a ON a.id = oa.asset_id
              WHERE oa.outage_id = ${outageId}::uuid AND COALESCE(a.location::geometry, a.boundary) IS NOT NULL
            ) source_geometries
          ), p.affected_geometry),
          impact_method = CASE
            WHEN EXISTS (SELECT 1 FROM energy_outage_affected_customers WHERE outage_id = ${outageId}::uuid)
              THEN CASE WHEN ${sourceCustomerMethod} = 'EVN_PROVIDED_CUSTOMER_LIST' THEN 'EVN_PROVIDED_CUSTOMER_LIST' ELSE ${ENGINE_METHOD} END
            WHEN p.impact_method IN ('EVN_PROVIDED_POLYGON', 'MANUAL_POLYGON', 'RADIUS_ESTIMATE') THEN p.impact_method
            ELSE 'NO_VALID_GRID_LINK'
          END,
          impact_calculated_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE p.id = ${outageId}::uuid
    `);
  });

  const impact = await readOutageImpact(outageId);
  if (!impact) return null;
  if (!hasExplicitSourceRefs) {
    impact.warnings.unshift('No resolvable EVN feeder/line/TBA or customer/service-point reference was found in the source payload.');
  }
  if (context.assetReferences.length && !resolvedAssets.ids.length) {
    impact.warnings.unshift(`Source asset reference(s) could not be resolved: ${context.assetReferences.join(', ')}.`);
  }
  if (resolvedAssets.ids.length && topologyAssetIds.length === resolvedAssets.ids.length) {
    impact.warnings.push('Topology trace resolved only the source asset(s); no downstream relation was available at the outage start time.');
  }
  return impact;
}
