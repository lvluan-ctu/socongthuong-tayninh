import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

export const canonicalAiLabels = [
  'TREE_INTRUSION', 'TREE_NEAR_CONDUCTOR', 'CONSTRUCTION_INTRUSION', 'CRANE_NEAR_LINE',
  'SIGNBOARD_INTRUSION', 'FOREIGN_OBJECT', 'FIRE', 'SMOKE', 'BROKEN_INSULATOR',
  'DAMAGED_POLE', 'LEANING_POLE', 'CONDUCTOR_SAG_ANOMALY', 'VEGETATION_OVERGROWTH', 'OTHER',
] as const;

const labelAliases: Record<string, (typeof canonicalAiLabels)[number]> = {
  TREE: 'TREE_INTRUSION',
  VEGETATION: 'VEGETATION_OVERGROWTH',
  VEGETATION_ENCROACHMENT: 'TREE_INTRUSION',
  TREE_INTRUSION: 'TREE_INTRUSION',
  TREE_NEAR_CONDUCTOR: 'TREE_NEAR_CONDUCTOR',
  TREE_NEAR_POWER_LINE: 'TREE_NEAR_CONDUCTOR',
  CONSTRUCTION: 'CONSTRUCTION_INTRUSION',
  CONSTRUCTION_INTRUSION: 'CONSTRUCTION_INTRUSION',
  CONSTRUCTION_EQUIPMENT_PROXIMITY: 'CONSTRUCTION_INTRUSION',
  CRANE: 'CRANE_NEAR_LINE',
  CRANE_NEAR_LINE: 'CRANE_NEAR_LINE',
  SIGNBOARD: 'SIGNBOARD_INTRUSION',
  SIGNBOARD_INTRUSION: 'SIGNBOARD_INTRUSION',
  FOREIGN_OBJECT: 'FOREIGN_OBJECT',
  FOREIGN_OBJECT_BALLOON: 'FOREIGN_OBJECT',
  FOREIGN_OBJECT_KITE: 'FOREIGN_OBJECT',
  BIRD_NEST: 'FOREIGN_OBJECT',
  FIRE: 'FIRE',
  SMOKE: 'SMOKE',
  BROKEN_INSULATOR: 'BROKEN_INSULATOR',
  DAMAGED_POLE: 'DAMAGED_POLE',
  LEANING_POLE: 'LEANING_POLE',
  CONDUCTOR_SAG: 'CONDUCTOR_SAG_ANOMALY',
  CONDUCTOR_SAG_ANOMALY: 'CONDUCTOR_SAG_ANOMALY',
};

export type NormalizedAiDetection = {
  label: (typeof canonicalAiLabels)[number];
  confidence: number;
  bbox: Record<string, unknown> | null;
  segmentation: Record<string, unknown> | null;
  riskScore: number | null;
  suggestedSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  suggestedViolationType: 'TREE_INTRUSION' | 'CONSTRUCTION_INTRUSION' | 'SIGNBOARD' | 'FIRE_SMOKE' | 'FOREIGN_OBJECT' | 'OTHER';
  explanation: Record<string, unknown>;
};

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function riskScoreForLevel(value: unknown) {
  const level = String(value ?? '').trim().toUpperCase();
  if (level === 'CRITICAL') return 0.95;
  if (level === 'HIGH') return 0.85;
  if (level === 'MEDIUM') return 0.6;
  if (level === 'LOW') return 0.25;
  return null;
}

function objectValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function canonicalizeLabel(value: unknown): (typeof canonicalAiLabels)[number] {
  const key = String(value ?? 'OTHER').trim().toUpperCase().replace(/[ -]+/g, '_');
  return labelAliases[key] ?? (canonicalAiLabels.includes(key as (typeof canonicalAiLabels)[number]) ? key as (typeof canonicalAiLabels)[number] : 'OTHER');
}

export function violationTypeForLabel(label: (typeof canonicalAiLabels)[number]) {
  if (['TREE_INTRUSION', 'TREE_NEAR_CONDUCTOR', 'VEGETATION_OVERGROWTH'].includes(label)) return 'TREE_INTRUSION' as const;
  if (['CONSTRUCTION_INTRUSION', 'CRANE_NEAR_LINE'].includes(label)) return 'CONSTRUCTION_INTRUSION' as const;
  if (label === 'SIGNBOARD_INTRUSION') return 'SIGNBOARD' as const;
  if (['FIRE', 'SMOKE'].includes(label)) return 'FIRE_SMOKE' as const;
  if (['FOREIGN_OBJECT', 'BROKEN_INSULATOR', 'DAMAGED_POLE', 'LEANING_POLE', 'CONDUCTOR_SAG_ANOMALY'].includes(label)) return 'FOREIGN_OBJECT' as const;
  return 'OTHER' as const;
}

export function severityForDetection(label: (typeof canonicalAiLabels)[number], confidence: number, riskScore: number | null) {
  const risk = riskScore ?? confidence;
  if (['FIRE', 'SMOKE', 'BROKEN_INSULATOR', 'CONDUCTOR_SAG_ANOMALY'].includes(label) && risk >= 0.85) return 'CRITICAL' as const;
  if (risk >= 0.85 || ['CONSTRUCTION_INTRUSION', 'CRANE_NEAR_LINE', 'DAMAGED_POLE'].includes(label)) return 'HIGH' as const;
  if (risk >= 0.6) return 'MEDIUM' as const;
  return 'LOW' as const;
}

export function normalizeAiDetections(input: Array<Record<string, unknown>>) {
  return input.map((raw): NormalizedAiDetection => {
    const label = canonicalizeLabel(raw.label ?? raw.class ?? raw.name ?? raw.type);
    const rawConfidence = numberValue(raw.confidence ?? raw.score ?? raw.probability) ?? 0;
    const confidence = rawConfidence > 1 ? rawConfidence / 100 : rawConfidence;
    const rawRisk = numberValue(raw.riskScore ?? raw.risk_score) ?? riskScoreForLevel(raw.risk_level);
    const riskScore = rawRisk == null ? null : rawRisk > 1 ? rawRisk / 100 : rawRisk;
    const suggestedViolationType = violationTypeForLabel(label);
    const suggestedSeverity = severityForDetection(label, confidence, riskScore);
    return {
      label,
      confidence: Math.min(1, Math.max(0, confidence)),
      bbox: objectValue(raw.bbox ?? raw.boundingBox ?? raw.bounding_box),
      segmentation: objectValue(raw.segmentation ?? raw.mask),
      riskScore: riskScore == null ? null : Math.min(1, Math.max(0, riskScore)),
      suggestedSeverity,
      suggestedViolationType,
      explanation: {
        ...(objectValue(raw.explanation) ?? {}),
        rawLabel: raw.label ?? raw.class ?? raw.type ?? null,
        riskLevel: raw.risk_level ?? null,
        rawDetection: raw,
      },
    };
  });
}

export function inputHashForMedia(media: { checksum: string | null; fileRef: string | null; sourceUrl: string | null; capturedAt: Date | null; metadata: Record<string, unknown> }) {
  if (media.checksum && /^[a-f0-9]{64}$/i.test(media.checksum.trim())) return media.checksum.trim().toLowerCase();
  return createHash('sha256').update(JSON.stringify({ checksum: media.checksum, fileRef: media.fileRef, sourceUrl: media.sourceUrl, capturedAt: media.capturedAt?.toISOString() ?? null, metadata: media.metadata })).digest('hex');
}

export async function matchMediaAsset(mediaId: string, directAssetId?: string | null) {
  if (directAssetId) {
    const direct = await db.execute(sql`SELECT id, code, name FROM energy_assets WHERE id = ${directAssetId}::uuid LIMIT 1`);
    const row = direct.rows[0] as Record<string, unknown> | undefined;
    if (row) return { assetId: String(row.id), assetCode: String(row.code), assetName: String(row.name), method: 'DIRECT_ASSET_HINT', distanceM: null as number | null, warning: null as string | null };
  }
  const nearest = await db.execute(sql`
    SELECT candidate.asset_id AS "assetId", candidate.asset_code AS "assetCode", candidate.asset_name AS "assetName", candidate.match_method AS "matchMethod", candidate.distance_m AS "distanceM"
    FROM (
      SELECT a.id AS asset_id, a.code AS asset_code, a.name AS asset_name, 'GPS_NEAREST_POWER_LINE' AS match_method,
             ST_Distance(m.location, pl.geometry::geography) AS distance_m
      FROM energy_safety_inspection_media m
      JOIN energy_power_lines pl ON pl.geometry IS NOT NULL
      JOIN energy_assets a ON a.id = pl.asset_id
      WHERE m.id = ${mediaId}::uuid AND m.location IS NOT NULL
      UNION ALL
      SELECT a.id AS asset_id, a.code AS asset_code, a.name AS asset_name, 'GPS_NEAREST_LINE_POSITION' AS match_method,
             ST_Distance(m.location, lp.location) AS distance_m
      FROM energy_safety_inspection_media m
      JOIN energy_line_positions lp ON lp.location IS NOT NULL
      JOIN energy_assets a ON a.id = COALESCE(lp.asset_id, lp.line_asset_id)
      WHERE m.id = ${mediaId}::uuid AND m.location IS NOT NULL
    ) candidate
    ORDER BY candidate.distance_m ASC
    LIMIT 1
  `);
  const nearestRow = nearest.rows[0] as Record<string, unknown> | undefined;
  if (nearestRow) {
    const distanceM = Number(nearestRow.distanceM);
    const maxDistanceM = Number(process.env.AI_VISION_ASSET_MATCH_MAX_DISTANCE_M ?? 150);
    if (Number.isFinite(distanceM) && distanceM <= maxDistanceM) return { assetId: String(nearestRow.assetId), assetCode: String(nearestRow.assetCode), assetName: String(nearestRow.assetName), method: String(nearestRow.matchMethod), distanceM, warning: null as string | null };
    return { assetId: null, assetCode: null, assetName: null, method: 'UNRESOLVED_DISTANCE', distanceM: Number.isFinite(distanceM) ? distanceM : null, warning: `Nearest grid asset is beyond the ${maxDistanceM} m matching threshold; human mapping is required.` };
  }
  const context = await db.execute(sql`
    SELECT a.id, a.code, a.name
    FROM energy_safety_inspection_media m
    JOIN energy_safety_inspections i ON i.id = m.inspection_id
    JOIN energy_protection_corridors c ON c.id = i.corridor_id
    JOIN energy_assets a ON a.id = c.asset_id
    WHERE m.id = ${mediaId}::uuid
    LIMIT 1
  `);
  const contextRow = context.rows[0] as Record<string, unknown> | undefined;
  if (contextRow) return { assetId: String(contextRow.id), assetCode: String(contextRow.code), assetName: String(contextRow.name), method: 'INSPECTION_CONTEXT', distanceM: null as number | null, warning: 'Asset match used the inspection corridor context because GPS nearest matching was unavailable.' };
  return { assetId: null, assetCode: null, assetName: null, method: 'UNRESOLVED', distanceM: null as number | null, warning: 'No GPS, direct asset hint or inspection corridor context was available for asset matching.' };
}
