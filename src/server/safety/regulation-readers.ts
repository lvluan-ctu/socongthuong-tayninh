import { eq } from 'drizzle-orm';
import {
  energyClearanceRules,
  energySafetyLegalDocuments,
  energySafetyRegulationDocuments,
  energySafetyRegulations,
} from '@/db/schema';
import { db } from '@/lib/db';

function serializeRule(rule: typeof energyClearanceRules.$inferSelect) {
  const metadata = (rule.metadata ?? {}) as Record<string, unknown>;
  return {
    ...rule,
    voltageLevelKv: Number(rule.voltageLevelKv),
    voltageLevelFromKv: rule.voltageLevelFromKv == null ? null : Number(rule.voltageLevelFromKv),
    voltageLevelToKv: rule.voltageLevelToKv == null ? null : Number(rule.voltageLevelToKv),
    horizontalClearanceM: rule.horizontalClearanceM == null ? null : Number(rule.horizontalClearanceM),
    verticalClearanceM: rule.verticalClearanceM == null ? null : Number(rule.verticalClearanceM),
    corridorWidthM: rule.corridorWidthM == null ? null : Number(rule.corridorWidthM),
    notes: typeof metadata.notes === 'string' ? metadata.notes : null,
  };
}

export async function readRegulation(regulationId: string) {
  const [regulation] = await db.select().from(energySafetyRegulations)
    .where(eq(energySafetyRegulations.id, regulationId)).limit(1);
  if (!regulation) return null;
  const [rules, documents] = await Promise.all([
    db.select().from(energyClearanceRules)
      .where(eq(energyClearanceRules.regulationId, regulationId))
      .orderBy(energyClearanceRules.priority, energyClearanceRules.voltageLevelKv),
    db.select({
      id: energySafetyLegalDocuments.id,
      documentId: energySafetyRegulationDocuments.documentId,
      code: energySafetyLegalDocuments.code,
      documentNo: energySafetyLegalDocuments.documentNo,
      title: energySafetyLegalDocuments.title,
      documentType: energySafetyLegalDocuments.documentType,
      issuingAuthority: energySafetyLegalDocuments.issuingAuthority,
      effectiveFrom: energySafetyLegalDocuments.effectiveFrom,
      effectiveTo: energySafetyLegalDocuments.effectiveTo,
      status: energySafetyLegalDocuments.status,
      fileRef: energySafetyLegalDocuments.fileRef,
      sourceUrl: energySafetyLegalDocuments.sourceUrl,
      citation: energySafetyRegulationDocuments.citation,
      isPrimary: energySafetyRegulationDocuments.isPrimary,
    }).from(energySafetyRegulationDocuments)
      .innerJoin(energySafetyLegalDocuments, eq(energySafetyLegalDocuments.id, energySafetyRegulationDocuments.documentId))
      .where(eq(energySafetyRegulationDocuments.regulationId, regulationId)),
  ]);
  return {
    ...regulation,
    versionNo: regulation.versionNo,
    rules: rules.map(serializeRule),
    documents,
  };
}
