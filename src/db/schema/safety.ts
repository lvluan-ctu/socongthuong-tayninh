import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { energyAssets, energySites, geography, geometry } from './core';
import { energyCustomerAccounts } from './solar';

export const energySafetyLegalDocuments = pgTable('energy_safety_legal_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull(),
  documentNo: text('document_no').notNull(),
  title: text('title').notNull(),
  documentType: text('document_type').notNull(),
  issuingAuthority: text('issuing_authority').notNull(),
  issuedAt: timestamp('issued_at', { withTimezone: true }),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  status: text('status').notNull().default('ACTIVE'),
  fileRef: text('file_ref'),
  sourceUrl: text('source_url'),
  checksum: text('checksum'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('energy_safety_legal_documents_code_uq').on(t.code),
  index('energy_safety_legal_documents_effective_idx').on(t.effectiveFrom, t.effectiveTo, t.status),
]);

export const energySafetyRegulations = pgTable('energy_safety_regulations', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull(),
  versionNo: integer('version_no').notNull().default(1),
  name: text('name').notNull(),
  legalDocumentRef: text('legal_document_ref').notNull(),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  status: text('status').notNull().default('ACTIVE'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('energy_safety_regulations_code_version_uq').on(t.code, t.versionNo),
  index('energy_safety_regulations_effective_idx').on(t.effectiveFrom, t.effectiveTo, t.status),
]);

export const energySafetyRegulationDocuments = pgTable('energy_safety_regulation_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  regulationId: uuid('regulation_id').notNull().references(() => energySafetyRegulations.id, { onDelete: 'cascade' }),
  documentId: uuid('document_id').notNull().references(() => energySafetyLegalDocuments.id, { onDelete: 'restrict' }),
  citation: text('citation'),
  isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('energy_safety_regulation_documents_uq').on(t.regulationId, t.documentId),
  index('energy_safety_regulation_documents_document_idx').on(t.documentId),
]);

export const energyClearanceRules = pgTable('energy_clearance_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  regulationId: uuid('regulation_id').notNull().references(() => energySafetyRegulations.id, { onDelete: 'cascade' }),
  ruleCode: text('rule_code'),
  ruleName: text('rule_name'),
  voltageLevelKv: numeric('voltage_level_kv', { precision: 10, scale: 3 }).notNull(),
  voltageLevelFromKv: numeric('voltage_level_from_kv', { precision: 10, scale: 3 }),
  voltageLevelToKv: numeric('voltage_level_to_kv', { precision: 10, scale: 3 }),
  lineType: text('line_type'),
  structureType: text('structure_type'),
  objectType: text('object_type'),
  crossingType: text('crossing_type'),
  terrainType: text('terrain_type'),
  urbanRuralType: text('urban_rural_type'),
  horizontalClearanceM: numeric('horizontal_clearance_m', { precision: 10, scale: 3 }),
  verticalClearanceM: numeric('vertical_clearance_m', { precision: 10, scale: 3 }),
  corridorWidthM: numeric('corridor_width_m', { precision: 10, scale: 3 }),
  measurementBasis: text('measurement_basis'),
  calculationMethod: text('calculation_method'),
  priority: integer('priority').notNull().default(100),
  validFrom: timestamp('valid_from', { withTimezone: true }),
  validTo: timestamp('valid_to', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('energy_clearance_rules_voltage_idx').on(t.voltageLevelKv),
  index('energy_clearance_rules_validity_idx').on(t.validFrom, t.validTo, t.priority),
]);

export const energyProtectionCorridors = pgTable('energy_protection_corridors', {
  id: uuid('id').defaultRandom().primaryKey(),
  assetId: uuid('asset_id').notNull().references(() => energyAssets.id, { onDelete: 'cascade' }),
  ruleId: uuid('rule_id').references(() => energyClearanceRules.id, { onDelete: 'set null' }),
  geometry: geometry('geometry').notNull(),
  status: text('status').notNull().default('ACTIVE'),
  versionNo: integer('version_no').notNull().default(1),
  sourceLineGeometryHash: text('source_line_geometry_hash'),
  ruleVersion: text('rule_version'),
  calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull().defaultNow(),
  validFrom: timestamp('valid_from', { withTimezone: true }),
  validTo: timestamp('valid_to', { withTimezone: true }),
  calculationMethod: text('calculation_method'),
  inputSnapshot: jsonb('input_snapshot').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('energy_protection_corridors_geometry_gist').using('gist', t.geometry),
  index('energy_protection_corridors_version_idx').on(t.assetId, t.versionNo, t.status),
]);

export const energyProtectionCorridorVersions = pgTable('energy_protection_corridor_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  corridorId: uuid('corridor_id').notNull().references(() => energyProtectionCorridors.id, { onDelete: 'cascade' }),
  assetId: uuid('asset_id').notNull().references(() => energyAssets.id, { onDelete: 'cascade' }),
  ruleId: uuid('rule_id').references(() => energyClearanceRules.id, { onDelete: 'set null' }),
  versionNo: integer('version_no').notNull(),
  geometry: geometry('geometry').notNull(),
  sourceLineGeometryHash: text('source_line_geometry_hash'),
  ruleVersion: text('rule_version'),
  calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull().defaultNow(),
  validFrom: timestamp('valid_from', { withTimezone: true }),
  validTo: timestamp('valid_to', { withTimezone: true }),
  calculationMethod: text('calculation_method').notNull(),
  inputSnapshot: jsonb('input_snapshot').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('energy_protection_corridor_versions_uq').on(t.corridorId, t.versionNo),
  index('energy_protection_corridor_versions_geometry_gist').using('gist', t.geometry),
]);

export const energyCorridorViolations = pgTable('energy_corridor_violations', {
  id: uuid('id').defaultRandom().primaryKey(),
  corridorId: uuid('corridor_id').notNull().references(() => energyProtectionCorridors.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  violationType: text('violation_type').notNull(),
  severity: text('severity').notNull(),
  location: geography('location'),
  detectedAt: timestamp('detected_at', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('OPEN'),
  distanceM: numeric('distance_m', { precision: 12, scale: 3 }),
  evidence: jsonb('evidence').$type<Record<string, unknown>>().notNull().default({}),
  aiRunId: uuid('ai_run_id'),
  aiDetectionId: uuid('ai_detection_id'),
  humanReviewRequired: boolean('human_review_required').notNull().default(false),
  reviewDecision: text('review_decision'),
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  verifiedBy: text('verified_by'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('energy_corridor_violations_code_uq').on(t.code), index('energy_corridor_violations_severity_idx').on(t.severity, t.status), index('energy_corridor_violations_review_idx').on(t.humanReviewRequired, t.reviewedAt)]);

export const energySafetyInspections = pgTable('energy_safety_inspections', {
  id: uuid('id').defaultRandom().primaryKey(),
  inspectionCode: text('inspection_code').notNull(),
  inspectionType: text('inspection_type').notNull(),
  corridorId: uuid('corridor_id').references(() => energyProtectionCorridors.id, { onDelete: 'set null' }),
  assetId: uuid('asset_id').references(() => energyAssets.id, { onDelete: 'set null' }),
  inspector: text('inspector').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  status: text('status').notNull().default('OPEN'),
  source: text('source').notNull().default('FIELD'),
  sourceRef: text('source_ref'),
  geometry: geometry('geometry'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('energy_safety_inspections_code_uq').on(t.inspectionCode),
  index('energy_safety_inspections_status_idx').on(t.status, t.startedAt),
  index('energy_safety_inspections_corridor_idx').on(t.corridorId, t.startedAt),
  index('energy_safety_inspections_geometry_gist').using('gist', t.geometry),
]);

export const energySafetyInspectionMedia = pgTable('energy_safety_inspection_media', {
  id: uuid('id').defaultRandom().primaryKey(),
  inspectionId: uuid('inspection_id').notNull().references(() => energySafetyInspections.id, { onDelete: 'cascade' }),
  mediaType: text('media_type').notNull().default('IMAGE'),
  title: text('title').notNull(),
  fileRef: text('file_ref'),
  sourceUrl: text('source_url'),
  checksum: text('checksum'),
  status: text('status').notNull().default('ACTIVE'),
  capturedAt: timestamp('captured_at', { withTimezone: true }),
  bearingDeg: numeric('bearing_deg', { precision: 8, scale: 3 }),
  assetHint: text('asset_hint'),
  location: geography('location'),
  notes: text('notes'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('energy_safety_inspection_media_inspection_idx').on(t.inspectionId, t.createdAt)]);

export const energyAiVisionRuns = pgTable('energy_ai_vision_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  mediaId: uuid('media_id').notNull().references(() => energySafetyInspectionMedia.id, { onDelete: 'cascade' }),
  modelProvider: text('model_provider').notNull(),
  modelName: text('model_name').notNull(),
  modelVersion: text('model_version').notNull(),
  configVersion: text('config_version').notNull(),
  inputHash: text('input_hash').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  status: text('status').notNull().default('QUEUED'),
  rawOutput: jsonb('raw_output').$type<Record<string, unknown>>().notNull().default({}),
  errorMessage: text('error_message'),
  matchedAssetId: uuid('matched_asset_id').references(() => energyAssets.id, { onDelete: 'set null' }),
  matchedAssetMethod: text('matched_asset_method'),
  matchedDistanceM: numeric('matched_distance_m', { precision: 12, scale: 3 }),
  matchedAt: timestamp('matched_at', { withTimezone: true }),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('energy_ai_vision_runs_media_idx').on(t.mediaId, t.startedAt), index('energy_ai_vision_runs_status_idx').on(t.status, t.startedAt), index('energy_ai_vision_runs_hash_idx').on(t.inputHash)]);

export const energyAiVisionDetections = pgTable('energy_ai_vision_detections', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').notNull().references(() => energyAiVisionRuns.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  confidence: numeric('confidence', { precision: 8, scale: 6 }).notNull(),
  bbox: jsonb('bbox').$type<Record<string, unknown>>(),
  segmentation: jsonb('segmentation').$type<Record<string, unknown>>(),
  riskScore: numeric('risk_score', { precision: 8, scale: 6 }),
  suggestedSeverity: text('suggested_severity'),
  suggestedViolationType: text('suggested_violation_type'),
  explanation: jsonb('explanation').$type<Record<string, unknown>>().notNull().default({}),
  reviewStatus: text('review_status').notNull().default('PENDING_HUMAN_REVIEW'),
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdViolationId: uuid('created_violation_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('energy_ai_vision_detections_run_idx').on(t.runId, t.createdAt), index('energy_ai_vision_detections_review_idx').on(t.reviewStatus, t.reviewedAt)]);

export const energyAiVisionReviews = pgTable('energy_ai_vision_reviews', {
  id: uuid('id').defaultRandom().primaryKey(),
  detectionId: uuid('detection_id').notNull().references(() => energyAiVisionDetections.id, { onDelete: 'cascade' }),
  decision: text('decision').notNull(),
  reviewer: text('reviewer').notNull(),
  finalLabel: text('final_label'),
  finalSeverity: text('final_severity'),
  finalViolationType: text('final_violation_type'),
  note: text('note'),
  violationId: uuid('violation_id'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('energy_ai_vision_reviews_detection_idx').on(t.detectionId, t.reviewedAt), index('energy_ai_vision_reviews_violation_idx').on(t.violationId)]);

export const energySafetyInspectionViolations = pgTable('energy_safety_inspection_violations', {
  id: uuid('id').defaultRandom().primaryKey(),
  inspectionId: uuid('inspection_id').notNull().references(() => energySafetyInspections.id, { onDelete: 'cascade' }),
  violationId: uuid('violation_id').notNull().references(() => energyCorridorViolations.id, { onDelete: 'cascade' }),
  detectionRef: text('detection_ref'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('energy_safety_inspection_violations_uq').on(t.inspectionId, t.violationId),
  index('energy_safety_inspection_violations_violation_idx').on(t.violationId),
]);

export const energyViolationAssignments = pgTable('energy_violation_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  violationId: uuid('violation_id').notNull().references(() => energyCorridorViolations.id, { onDelete: 'cascade' }),
  assignedTo: text('assigned_to'),
  assignedTeam: text('assigned_team'),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  dueAt: timestamp('due_at', { withTimezone: true }),
  status: text('status').notNull().default('ACTIVE'),
  note: text('note'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('energy_violation_assignments_violation_idx').on(t.violationId, t.assignedAt), index('energy_violation_assignments_due_idx').on(t.status, t.dueAt)]);

export const energyViolationActions = pgTable('energy_violation_actions', {
  id: uuid('id').defaultRandom().primaryKey(),
  violationId: uuid('violation_id').notNull().references(() => energyCorridorViolations.id, { onDelete: 'cascade' }),
  actionType: text('action_type').notNull(),
  status: text('status').notNull().default('PLANNED'),
  plannedAt: timestamp('planned_at', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  actor: text('actor').notNull(),
  note: text('note'),
  beforeEvidence: jsonb('before_evidence').$type<Record<string, unknown>>().notNull().default({}),
  afterEvidence: jsonb('after_evidence').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('energy_violation_actions_violation_idx').on(t.violationId, t.createdAt), index('energy_violation_actions_status_idx').on(t.status, t.completedAt)]);

export const energyViolationStatusHistory = pgTable('energy_violation_status_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  violationId: uuid('violation_id').notNull().references(() => energyCorridorViolations.id, { onDelete: 'cascade' }),
  fromStatus: text('from_status'),
  toStatus: text('to_status').notNull(),
  changedBy: text('changed_by'),
  reason: text('reason'),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('energy_violation_status_history_violation_idx').on(t.violationId, t.changedAt)]);

export const energyOutagePlans = pgTable('energy_outage_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull(),
  source: text('source').notNull().default('EVN'),
  sourceType: text('source_type').notNull().default('MANUAL'),
  sourceRecordId: text('source_record_id'),
  sourceUrl: text('source_url'),
  announcedAt: timestamp('announced_at', { withTimezone: true }),
  title: text('title').notNull(),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  affectedGeometry: geometry('affected_geometry'),
  affectedCustomers: numeric('affected_customers', { precision: 14, scale: 0 }),
  reason: text('reason'),
  status: text('status').notNull().default('PLANNED'),
  impactMethod: text('impact_method').notNull().default('NOT_CALCULATED'),
  impactCalculatedAt: timestamp('impact_calculated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('energy_outage_plans_code_uq').on(t.code), index('energy_outage_plans_time_idx').on(t.startAt, t.endAt), index('energy_outage_plans_source_idx').on(t.source, t.sourceRecordId)]);

export const energyOutageSourceRecords = pgTable('energy_outage_source_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  outageId: uuid('outage_id').references(() => energyOutagePlans.id, { onDelete: 'set null' }),
  provider: text('provider').notNull().default('EVN'),
  sourceRecordId: text('source_record_id').notNull(),
  sourceUrl: text('source_url'),
  announcedAt: timestamp('announced_at', { withTimezone: true }),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>().notNull().default({}),
  rawText: text('raw_text'),
  checksum: text('checksum'),
  parserVersion: text('parser_version').notNull(),
  mappingVersion: text('mapping_version').notNull(),
  status: text('status').notNull().default('RAW'),
}, (t) => [uniqueIndex('energy_outage_source_records_provider_key_uq').on(t.provider, t.sourceRecordId), index('energy_outage_source_records_outage_idx').on(t.outageId, t.fetchedAt)]);

export const energyOutageAffectedAssets = pgTable('energy_outage_affected_assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  outageId: uuid('outage_id').notNull().references(() => energyOutagePlans.id, { onDelete: 'cascade' }),
  assetId: uuid('asset_id').notNull().references(() => energyAssets.id, { onDelete: 'cascade' }),
  relationType: text('relation_type').notNull(),
  isPrimary: boolean('is_primary').notNull().default(false),
  determinationMethod: text('determination_method').notNull().default('TOPOLOGY_DERIVED'),
  sourceRef: text('source_ref'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('energy_outage_affected_assets_uq').on(t.outageId, t.assetId, t.relationType), index('energy_outage_affected_assets_asset_idx').on(t.assetId, t.outageId)]);

export const energyOutageAffectedAreas = pgTable('energy_outage_affected_areas', {
  id: uuid('id').defaultRandom().primaryKey(),
  outageId: uuid('outage_id').notNull().references(() => energyOutagePlans.id, { onDelete: 'cascade' }),
  adminAreaCode: text('admin_area_code').notNull(),
  affectedCustomerCount: numeric('affected_customer_count', { precision: 14, scale: 0 }),
  affectedLoadMw: numeric('affected_load_mw', { precision: 14, scale: 3 }),
  criticalFacilityCount: integer('critical_facility_count'),
  determinationMethod: text('determination_method').notNull().default('TOPOLOGY_DERIVED'),
  sourceRef: text('source_ref'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('energy_outage_affected_areas_uq').on(t.outageId, t.adminAreaCode), index('energy_outage_affected_areas_area_idx').on(t.adminAreaCode, t.outageId)]);

export const energyOutageAffectedCustomers = pgTable('energy_outage_affected_customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  outageId: uuid('outage_id').notNull().references(() => energyOutagePlans.id, { onDelete: 'cascade' }),
  customerAccountId: uuid('customer_account_id').references(() => energyCustomerAccounts.id, { onDelete: 'set null' }),
  servicePointCode: text('service_point_code'),
  primaryAssetId: uuid('primary_asset_id').references(() => energyAssets.id, { onDelete: 'set null' }),
  isCritical: boolean('is_critical').notNull().default(false),
  determinationMethod: text('determination_method').notNull().default('TOPOLOGY_DERIVED'),
  sourceRef: text('source_ref'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('energy_outage_affected_customers_uq').on(t.outageId, t.customerAccountId, t.servicePointCode), index('energy_outage_affected_customers_outage_idx').on(t.outageId, t.isCritical)]);

export const energyConstructionCases = pgTable('energy_construction_cases', {
  id: uuid('id').defaultRandom().primaryKey(),
  caseCode: text('case_code').notNull(),
  applicantName: text('applicant_name'),
  applicantOrganization: text('applicant_organization'),
  address: text('address'),
  projectType: text('project_type').notNull(),
  description: text('description'),
  siteId: uuid('site_id').references(() => energySites.id, { onDelete: 'set null' }),
  proposedGeometry: geometry('proposed_geometry'),
  geometrySource: text('geometry_source').notNull().default('MANUAL'),
  status: text('status').notNull().default('SUBMITTED'),
  sourceRef: text('source_ref'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [
  uniqueIndex('energy_construction_cases_code_uq').on(t.caseCode),
  index('energy_construction_cases_status_idx').on(t.status, t.updatedAt),
  index('energy_construction_cases_geometry_gist').using('gist', t.proposedGeometry),
]);

export const energyConstructionCaseDocuments = pgTable('energy_construction_case_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  caseId: uuid('case_id').notNull().references(() => energyConstructionCases.id, { onDelete: 'cascade' }),
  documentType: text('document_type').notNull(),
  title: text('title').notNull(),
  fileRef: text('file_ref'),
  sourceUrl: text('source_url'),
  checksum: text('checksum'),
  status: text('status').notNull().default('ACTIVE'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  notes: text('notes'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [index('energy_construction_case_documents_case_idx').on(t.caseId, t.status)]);

export const energyConstructionCaseReviews = pgTable('energy_construction_case_reviews', {
  id: uuid('id').defaultRandom().primaryKey(),
  caseId: uuid('case_id').notNull().references(() => energyConstructionCases.id, { onDelete: 'cascade' }),
  reviewType: text('review_type').notNull(),
  decision: text('decision').notNull(),
  reviewer: text('reviewer').notNull(),
  note: text('note'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  evidence: jsonb('evidence').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [index('energy_construction_case_reviews_case_idx').on(t.caseId, t.reviewedAt)]);

export const energyConstructionCaseStatusHistory = pgTable('energy_construction_case_status_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  caseId: uuid('case_id').notNull().references(() => energyConstructionCases.id, { onDelete: 'cascade' }),
  fromStatus: text('from_status'),
  toStatus: text('to_status').notNull(),
  changedBy: text('changed_by'),
  reason: text('reason'),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('energy_construction_case_status_history_case_idx').on(t.caseId, t.changedAt)]);

export const energyConstructionClearanceChecks = pgTable('energy_construction_clearance_checks', {
  id: uuid('id').defaultRandom().primaryKey(),
  caseId: uuid('case_id').references(() => energyConstructionCases.id, { onDelete: 'set null' }),
  siteId: uuid('site_id').references(() => energySites.id, { onDelete: 'set null' }),
  caseCode: text('case_code').notNull(),
  applicantName: text('applicant_name'),
  address: text('address'),
  proposedGeometry: geometry('proposed_geometry').notNull(),
  nearestGridAssetId: uuid('nearest_grid_asset_id').references(() => energyAssets.id, { onDelete: 'set null' }),
  nearestDistanceM: numeric('nearest_distance_m', { precision: 12, scale: 3 }),
  requiredClearanceM: numeric('required_clearance_m', { precision: 12, scale: 3 }),
  minimumDistanceM: numeric('minimum_distance_m', { precision: 12, scale: 3 }),
  intersectionAreaM2: numeric('intersection_area_m2', { precision: 18, scale: 3 }),
  intersectsCorridor: boolean('intersects_corridor'),
  corridorVersionId: uuid('corridor_version_id').references(() => energyProtectionCorridorVersions.id, { onDelete: 'set null' }),
  lineGeometryHash: text('line_geometry_hash'),
  calculationMethod: text('calculation_method'),
  checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
  result: text('result').notNull(),
  ruleId: uuid('rule_id').references(() => energyClearanceRules.id, { onDelete: 'set null' }),
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  explanation: jsonb('explanation').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [index('energy_construction_checks_case_idx').on(t.caseId, t.checkedAt), index('energy_construction_checks_geometry_gist').using('gist', t.proposedGeometry)]);

export const energyGridIncidents = pgTable('energy_grid_incidents', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull(),
  assetId: uuid('asset_id').references(() => energyAssets.id, { onDelete: 'set null' }),
  incidentType: text('incident_type').notNull(),
  severity: text('severity').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  status: text('status').notNull().default('OPEN'),
  affectedCustomers: numeric('affected_customers', { precision: 14, scale: 0 }),
  affectedLoadMw: numeric('affected_load_mw', { precision: 14, scale: 3 }),
  cause: text('cause'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [uniqueIndex('energy_grid_incidents_code_uq').on(t.code), index('energy_grid_incidents_status_idx').on(t.status, t.severity)]);
