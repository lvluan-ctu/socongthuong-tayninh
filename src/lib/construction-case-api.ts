import { desc, eq, sql } from 'drizzle-orm';
import { energyConstructionCaseDocuments, energyConstructionCaseReviews, energyConstructionCases, energyConstructionCaseStatusHistory, energyConstructionClearanceChecks } from '@/db/schema';
import { db } from '@/lib/db';

function parseGeoJson(value: unknown) {
  if (typeof value !== 'string') return value ?? null;
  try { return JSON.parse(value) as unknown; } catch { return null; }
}

export async function readConstructionCase(caseId: string) {
  const current = await db.execute(sql`
    SELECT c.id, c.case_code AS "caseCode", c.applicant_name AS "applicantName",
           c.applicant_organization AS "applicantOrganization", c.address, c.project_type AS "projectType",
           c.description, c.site_id AS "siteId", c.geometry_source AS "geometrySource", c.status,
           c.source_ref AS "sourceRef", c.submitted_at AS "submittedAt", c.created_at AS "createdAt",
           c.updated_at AS "updatedAt", c.metadata, ST_AsGeoJSON(c.proposed_geometry) AS geometry
    FROM energy_construction_cases c WHERE c.id = ${caseId}::uuid
  `);
  const item = current.rows[0] as Record<string, unknown> | undefined;
  if (!item) return null;
  const [documents, reviews, statusHistory, checks] = await Promise.all([
    db.select().from(energyConstructionCaseDocuments).where(eq(energyConstructionCaseDocuments.caseId, caseId)).orderBy(desc(energyConstructionCaseDocuments.uploadedAt)),
    db.select().from(energyConstructionCaseReviews).where(eq(energyConstructionCaseReviews.caseId, caseId)).orderBy(desc(energyConstructionCaseReviews.reviewedAt)),
    db.select().from(energyConstructionCaseStatusHistory).where(eq(energyConstructionCaseStatusHistory.caseId, caseId)).orderBy(desc(energyConstructionCaseStatusHistory.changedAt)),
    db.select().from(energyConstructionClearanceChecks).where(eq(energyConstructionClearanceChecks.caseId, caseId)).orderBy(desc(energyConstructionClearanceChecks.checkedAt)),
  ]);
  return {
    ...item,
    geometry: parseGeoJson(item.geometry),
    documents,
    reviews,
    statusHistory,
    checks: checks.map((check) => ({
      ...check,
      nearestDistanceM: check.nearestDistanceM == null ? null : Number(check.nearestDistanceM),
      requiredClearanceM: check.requiredClearanceM == null ? null : Number(check.requiredClearanceM),
      minimumDistanceM: check.minimumDistanceM == null ? null : Number(check.minimumDistanceM),
      intersectionAreaM2: check.intersectionAreaM2 == null ? null : Number(check.intersectionAreaM2),
    })),
  };
}
