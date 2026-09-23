import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

function parseGeoJson(value: unknown) {
  if (typeof value !== 'string') return value ?? null;
  try { return JSON.parse(value) as unknown; } catch { return null; }
}

export async function readViolation(violationId: string) {
  const result = await db.execute(sql`
    SELECT v.id, v.corridor_id AS "corridorId", c.asset_id AS "corridorAssetId", a.code AS "assetCode", a.name AS "assetName",
           v.code, v.violation_type AS "violationType", v.severity, v.detected_at AS "detectedAt", v.status, v.distance_m AS "distanceM",
           v.evidence, v.ai_run_id AS "aiRunId", v.human_review_required AS "humanReviewRequired", v.review_decision AS "reviewDecision",
           v.reviewed_by AS "reviewedBy", v.reviewed_at AS "reviewedAt", v.verified_by AS "verifiedBy", v.verified_at AS "verifiedAt",
           v.closed_at AS "closedAt", v.updated_at AS "updatedAt",
           CASE WHEN v.location IS NULL THEN NULL ELSE ST_AsGeoJSON(v.location::geometry) END AS geometry
    FROM energy_corridor_violations v
    JOIN energy_protection_corridors c ON c.id = v.corridor_id
    JOIN energy_assets a ON a.id = c.asset_id
    WHERE v.id = ${violationId}::uuid
    LIMIT 1
  `);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const [assignments, actions, history, inspections] = await Promise.all([
    db.execute(sql`SELECT id, violation_id AS "violationId", assigned_to AS "assignedTo", assigned_team AS "assignedTeam", assigned_at AS "assignedAt", due_at AS "dueAt", status, note, created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt" FROM energy_violation_assignments WHERE violation_id = ${violationId}::uuid ORDER BY assigned_at DESC`),
    db.execute(sql`SELECT id, violation_id AS "violationId", action_type AS "actionType", status, planned_at AS "plannedAt", started_at AS "startedAt", completed_at AS "completedAt", actor, note, before_evidence AS "beforeEvidence", after_evidence AS "afterEvidence", created_at AS "createdAt", updated_at AS "updatedAt" FROM energy_violation_actions WHERE violation_id = ${violationId}::uuid ORDER BY created_at DESC`),
    db.execute(sql`SELECT id, violation_id AS "violationId", from_status AS "fromStatus", to_status AS "toStatus", changed_by AS "changedBy", reason, changed_at AS "changedAt" FROM energy_violation_status_history WHERE violation_id = ${violationId}::uuid ORDER BY changed_at DESC`),
    db.execute(sql`SELECT iv.inspection_id AS "inspectionId", i.inspection_code AS "inspectionCode", iv.detection_ref AS "detectionRef" FROM energy_safety_inspection_violations iv JOIN energy_safety_inspections i ON i.id = iv.inspection_id WHERE iv.violation_id = ${violationId}::uuid ORDER BY i.started_at DESC`),
  ]);
  return {
    ...row,
    distanceM: row.distanceM == null ? null : Number(row.distanceM),
    geometry: parseGeoJson(row.geometry),
    assignments: assignments.rows,
    actions: actions.rows,
    statusHistory: history.rows,
    inspections: inspections.rows,
  };
}
