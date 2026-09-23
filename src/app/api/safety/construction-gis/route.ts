import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Feature = { type: 'Feature'; id: string; geometry: unknown; properties: Record<string, unknown> };

function parseGeoJson(value: unknown) {
  if (typeof value !== 'string') return value ?? null;
  try { return JSON.parse(value) as unknown; } catch { return null; }
}

function feature(row: Record<string, unknown>, layer: string): Feature | null {
  const geometry = parseGeoJson(row.geometry);
  if (!geometry) return null;
  const properties = { ...row };
  delete properties.geometry;
  delete properties.id;
  return { type: 'Feature' as const, id: String(row.id), geometry, properties: { ...properties, ...(layer === 'construction-case' ? { caseId: String(row.id) } : {}), layer } };
}

export async function GET() {
  try {
    const [lines, corridors, cases, assets] = await Promise.all([
      db.execute(sql`
        SELECT pl.asset_id AS id, a.code, a.name, pl.voltage_level_kv::double precision AS "voltageLevelKv", pl.line_type AS "lineType", ST_AsGeoJSON(pl.geometry) AS geometry
        FROM energy_power_lines pl JOIN energy_assets a ON a.id = pl.asset_id
        WHERE a.status = 'ACTIVE' AND pl.geometry IS NOT NULL
      `),
      db.execute(sql`
        SELECT c.id, c.asset_id AS "assetId", a.code, a.name, cr.voltage_level_kv::double precision AS "voltageLevelKv", c.version_no AS "versionNo", c.rule_version AS "ruleVersion", ST_AsGeoJSON(c.geometry) AS geometry
        FROM energy_protection_corridors c JOIN energy_assets a ON a.id = c.asset_id
        LEFT JOIN energy_clearance_rules cr ON cr.id = c.rule_id
        WHERE c.status = 'ACTIVE' AND c.geometry IS NOT NULL
      `),
      db.execute(sql`
        SELECT c.id, c.case_code AS "caseCode", c.project_type AS "projectType", c.status, c.geometry_source AS "geometrySource", ST_AsGeoJSON(c.proposed_geometry) AS geometry
        FROM energy_construction_cases c
        WHERE c.status <> 'ARCHIVED' AND c.proposed_geometry IS NOT NULL
      `),
      db.execute(sql`
        SELECT a.id, a.code, a.name, a.asset_type AS "assetType", ST_AsGeoJSON(COALESCE(a.location::geometry, a.boundary)) AS geometry
        FROM energy_assets a
        WHERE a.status = 'ACTIVE' AND a.asset_type IN ('SUBSTATION', 'TRANSFORMER', 'BAY')
          AND COALESCE(a.location::geometry, a.boundary) IS NOT NULL
      `),
    ]);
    const lineFeatures = (lines.rows as Array<Record<string, unknown>>).map((row) => feature(row, 'power-line')).filter((item): item is Feature => Boolean(item));
    const corridorFeatures = (corridors.rows as Array<Record<string, unknown>>).map((row) => feature(row, 'protection-corridor')).filter((item): item is Feature => Boolean(item));
    const caseFeatures = (cases.rows as Array<Record<string, unknown>>).map((row) => feature(row, 'construction-case')).filter((item): item is Feature => Boolean(item));
    const assetFeatures = (assets.rows as Array<Record<string, unknown>>).map((row) => feature(row, 'grid-asset')).filter((item): item is Feature => Boolean(item));
    const warnings: string[] = [];
    if (!lineFeatures.length) warnings.push('No active power-line geometry is available from the grid foundation.');
    if (!corridorFeatures.length) warnings.push('No active protection corridor geometry has been generated from a versioned rule.');
    if (!caseFeatures.length) warnings.push('No construction case currently has a proposed geometry.');
    return NextResponse.json({
      layers: {
        powerLines: { type: 'FeatureCollection', features: lineFeatures },
        protectionCorridors: { type: 'FeatureCollection', features: corridorFeatures },
        constructionCases: { type: 'FeatureCollection', features: caseFeatures },
        gridAssets: { type: 'FeatureCollection', features: assetFeatures },
      },
      features: { type: 'FeatureCollection', features: [...lineFeatures, ...corridorFeatures, ...caseFeatures, ...assetFeatures] },
      stats: { powerLines: lineFeatures.length, protectionCorridors: corridorFeatures.length, constructionCases: caseFeatures.length, gridAssets: assetFeatures.length },
      warnings,
      method: 'hệ thống GIS ST_AsGeoJSON from grid assets, power lines, protection corridors and construction cases; no synthetic coordinate.',
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load construction GIS layers.' }, { status: 500 });
  }
}
