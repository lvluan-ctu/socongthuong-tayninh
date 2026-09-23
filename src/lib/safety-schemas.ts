import { z } from 'zod';

const dateValue = z.string().trim().min(1, 'Date is required.').refine((value) => !Number.isNaN(new Date(value).getTime()), 'Date is invalid.');
const optionalDateValue = dateValue.nullable().optional();
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const legalDocumentSchema = z.object({
  code: z.string().trim().min(2).max(100),
  documentNo: z.string().trim().min(1).max(150),
  title: z.string().trim().min(2).max(500),
  documentType: z.string().trim().min(2).max(100),
  issuingAuthority: z.string().trim().min(2).max(250),
  issuedAt: optionalDateValue,
  effectiveFrom: optionalDateValue,
  effectiveTo: optionalDateValue,
  status: z.enum(['DRAFT', 'ACTIVE', 'SUPERSEDED', 'EXPIRED', 'ARCHIVED']).default('ACTIVE'),
  fileRef: optionalText(1000),
  sourceUrl: optionalText(2000),
  checksum: optionalText(200),
  notes: optionalText(3000),
});

export const legalDocumentPatchSchema = z.object({
  code: z.string().trim().min(2).max(100).optional(),
  documentNo: z.string().trim().min(1).max(150).optional(),
  title: z.string().trim().min(2).max(500).optional(),
  documentType: z.string().trim().min(2).max(100).optional(),
  issuingAuthority: z.string().trim().min(2).max(250).optional(),
  issuedAt: optionalDateValue,
  effectiveFrom: optionalDateValue,
  effectiveTo: optionalDateValue,
  status: z.enum(['DRAFT', 'ACTIVE', 'SUPERSEDED', 'EXPIRED', 'ARCHIVED']).optional(),
  fileRef: optionalText(1000),
  sourceUrl: optionalText(2000),
  checksum: optionalText(200),
  notes: optionalText(3000),
});

export const clearanceRuleSchema = z.object({
  id: z.string().uuid().optional(),
  ruleCode: z.string().trim().max(100).nullable().optional(),
  ruleName: z.string().trim().max(300).nullable().optional(),
  voltageLevelKv: z.number().positive(),
  voltageLevelFromKv: z.number().positive().nullable().optional(),
  voltageLevelToKv: z.number().positive().nullable().optional(),
  lineType: optionalText(100),
  structureType: optionalText(100),
  objectType: optionalText(100),
  crossingType: optionalText(100),
  terrainType: optionalText(100),
  urbanRuralType: optionalText(100),
  horizontalClearanceM: z.number().nonnegative().nullable().optional(),
  verticalClearanceM: z.number().nonnegative().nullable().optional(),
  corridorWidthM: z.number().nonnegative().nullable().optional(),
  measurementBasis: optionalText(100),
  calculationMethod: optionalText(200),
  priority: z.number().int().min(0).max(100000).default(100),
  validFrom: optionalDateValue,
  validTo: optionalDateValue,
  notes: optionalText(1000),
});

export const clearanceRulePatchSchema = z.object({
  ruleCode: z.string().trim().max(100).nullable().optional(),
  ruleName: z.string().trim().max(300).nullable().optional(),
  voltageLevelKv: z.number().positive().optional(),
  voltageLevelFromKv: z.number().positive().nullable().optional(),
  voltageLevelToKv: z.number().positive().nullable().optional(),
  lineType: optionalText(100),
  structureType: optionalText(100),
  objectType: optionalText(100),
  crossingType: optionalText(100),
  terrainType: optionalText(100),
  urbanRuralType: optionalText(100),
  horizontalClearanceM: z.number().nonnegative().nullable().optional(),
  verticalClearanceM: z.number().nonnegative().nullable().optional(),
  corridorWidthM: z.number().nonnegative().nullable().optional(),
  measurementBasis: optionalText(100),
  calculationMethod: optionalText(200),
  priority: z.number().int().min(0).max(100000).optional(),
  validFrom: optionalDateValue,
  validTo: optionalDateValue,
  notes: optionalText(1000),
});

const regulationDocumentSchema = z.object({
  documentId: z.string().uuid(),
  citation: optionalText(500),
  isPrimary: z.boolean().default(false),
});

export const regulationSchema = z.object({
  code: z.string().trim().min(2).max(100),
  versionNo: z.number().int().positive().default(1),
  name: z.string().trim().min(2).max(300),
  legalDocumentRef: z.string().trim().min(2).max(1000),
  effectiveFrom: dateValue,
  effectiveTo: optionalDateValue,
  status: z.enum(['DRAFT', 'ACTIVE', 'SUPERSEDED', 'EXPIRED', 'ARCHIVED']).default('ACTIVE'),
  notes: optionalText(3000),
  documents: z.array(regulationDocumentSchema).default([]),
  rules: z.array(clearanceRuleSchema).min(1),
});

export const regulationPatchSchema = z.object({
  code: z.string().trim().min(2).max(100).optional(),
  versionNo: z.number().int().positive().optional(),
  name: z.string().trim().min(2).max(300).optional(),
  legalDocumentRef: z.string().trim().min(2).max(1000).optional(),
  effectiveFrom: dateValue.optional(),
  effectiveTo: optionalDateValue,
  status: z.enum(['DRAFT', 'ACTIVE', 'SUPERSEDED', 'EXPIRED', 'ARCHIVED']).optional(),
  notes: optionalText(3000),
  documents: z.array(regulationDocumentSchema).optional(),
  rules: z.array(clearanceRuleSchema).min(1).optional(),
});

export const corridorPatchSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
  validFrom: optionalDateValue,
  validTo: optionalDateValue,
});

const supportedGeometryTypes = ['Point', 'Polygon', 'MultiPolygon', 'LineString'] as const;

export function isSupportedGeoJsonGeometry(value: unknown): value is { type: (typeof supportedGeometryTypes)[number]; coordinates: unknown } {
  if (!value || typeof value !== 'object') return false;
  const geometry = value as { type?: unknown; coordinates?: unknown };
  return typeof geometry.type === 'string' && supportedGeometryTypes.includes(geometry.type as (typeof supportedGeometryTypes)[number]) && geometry.coordinates != null;
}

export const geoJsonGeometrySchema = z.unknown().refine(isSupportedGeoJsonGeometry, 'Geometry must be Point, Polygon, MultiPolygon or LineString GeoJSON.');

export const constructionCaseSchema = z.object({
  caseCode: z.string().trim().min(2).max(120),
  applicantName: optionalText(250),
  applicantOrganization: optionalText(250),
  address: optionalText(500),
  projectType: z.string().trim().min(2).max(150),
  description: optionalText(3000),
  siteId: z.string().uuid().nullable().optional(),
  proposedGeometry: geoJsonGeometrySchema.nullable().optional(),
  geometrySource: z.enum(['MANUAL', 'DRAWN', 'GEOJSON_UPLOAD', 'PARCEL', 'API']).default('MANUAL'),
  status: z.enum(['SUBMITTED', 'GIS_CHECKED', 'UNDER_TECHNICAL_REVIEW', 'REQUEST_MORE_INFO', 'SITE_SURVEY_REQUIRED', 'RECOMMEND_APPROVAL', 'RECOMMEND_REJECTION', 'FINALIZED', 'ARCHIVED']).default('SUBMITTED'),
  sourceRef: optionalText(1000),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export const constructionCasePatchSchema = z.object({
  caseCode: z.string().trim().min(2).max(120).optional(),
  applicantName: optionalText(250),
  applicantOrganization: optionalText(250),
  address: optionalText(500),
  projectType: z.string().trim().min(2).max(150).optional(),
  description: optionalText(3000),
  siteId: z.string().uuid().nullable().optional(),
  proposedGeometry: geoJsonGeometrySchema.nullable().optional(),
  geometrySource: z.enum(['MANUAL', 'DRAWN', 'GEOJSON_UPLOAD', 'PARCEL', 'API']).optional(),
  status: z.enum(['SUBMITTED', 'GIS_CHECKED', 'UNDER_TECHNICAL_REVIEW', 'REQUEST_MORE_INFO', 'SITE_SURVEY_REQUIRED', 'RECOMMEND_APPROVAL', 'RECOMMEND_REJECTION', 'FINALIZED', 'ARCHIVED']).optional(),
  sourceRef: optionalText(1000),
  metadata: z.record(z.string(), z.unknown()).optional(),
  changedBy: optionalText(200),
  reason: optionalText(1000),
});

export const constructionCheckSchema = z.object({
  geometry: geoJsonGeometrySchema,
  structureType: z.string().trim().min(1).max(100).default('BUILDING'),
  objectType: z.string().trim().max(100).nullable().optional(),
  crossingType: z.string().trim().max(100).nullable().optional(),
  terrainType: z.string().trim().max(100).nullable().optional(),
  urbanRuralType: z.string().trim().max(100).nullable().optional(),
  reviewedBy: optionalText(200),
  notes: optionalText(3000),
});

export const constructionCaseDocumentSchema = z.object({
  documentType: z.string().trim().min(2).max(100),
  title: z.string().trim().min(2).max(500),
  fileRef: optionalText(1000),
  sourceUrl: optionalText(2000),
  checksum: optionalText(200),
  status: z.enum(['ACTIVE', 'ARCHIVED']).default('ACTIVE'),
  notes: optionalText(3000),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export const constructionCaseDocumentPatchSchema = z.object({
  documentType: z.string().trim().min(2).max(100).optional(),
  title: z.string().trim().min(2).max(500).optional(),
  fileRef: optionalText(1000),
  sourceUrl: optionalText(2000),
  checksum: optionalText(200),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  notes: optionalText(3000),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const constructionCaseReviewSchema = z.object({
  reviewType: z.string().trim().min(2).max(100),
  decision: z.enum(['REQUEST_MORE_INFO', 'SITE_SURVEY_REQUIRED', 'RECOMMEND_APPROVAL', 'RECOMMEND_REJECTION', 'FINALIZED', 'ACKNOWLEDGED']),
  reviewer: z.string().trim().min(2).max(200),
  note: optionalText(3000),
  evidence: z.record(z.string(), z.unknown()).optional().default({}),
});

const inspectionStatuses = ['OPEN', 'IN_PROGRESS', 'SUBMITTED', 'PENDING_REVIEW', 'COMPLETED', 'ARCHIVED'] as const;
const violationStatuses = ['DETECTED', 'PENDING_REVIEW', 'CONFIRMED', 'ASSIGNED', 'IN_PROGRESS', 'REMEDIATED', 'VERIFIED', 'CLOSED', 'OPEN', 'RESOLVED', 'FALSE_POSITIVE', 'ARCHIVED'] as const;

export const safetyInspectionSchema = z.object({
  inspectionCode: z.string().trim().min(2).max(120),
  inspectionType: z.string().trim().min(2).max(120),
  corridorId: z.string().uuid().nullable().optional(),
  assetId: z.string().uuid().nullable().optional(),
  inspector: z.string().trim().min(2).max(200),
  startedAt: dateValue,
  completedAt: optionalDateValue,
  status: z.enum(inspectionStatuses).default('OPEN'),
  source: z.enum(['FIELD', 'EVN', 'AI_VISION', 'CITIZEN', 'OTHER']).default('FIELD'),
  sourceRef: optionalText(1000),
  geometry: geoJsonGeometrySchema.nullable().optional(),
  notes: optionalText(3000),
});

export const safetyInspectionPatchSchema = z.object({
  inspectionCode: z.string().trim().min(2).max(120).optional(),
  inspectionType: z.string().trim().min(2).max(120).optional(),
  corridorId: z.string().uuid().nullable().optional(),
  assetId: z.string().uuid().nullable().optional(),
  inspector: z.string().trim().min(2).max(200).optional(),
  startedAt: dateValue.optional(),
  completedAt: optionalDateValue,
  status: z.enum(inspectionStatuses).optional(),
  source: z.enum(['FIELD', 'EVN', 'AI_VISION', 'CITIZEN', 'OTHER']).optional(),
  sourceRef: optionalText(1000),
  geometry: geoJsonGeometrySchema.nullable().optional(),
  notes: optionalText(3000),
});

export const safetyInspectionMediaSchema = z.object({
  mediaType: z.enum(['IMAGE', 'VIDEO', 'DOCUMENT', 'OTHER']).default('IMAGE'),
  title: z.string().trim().min(2).max(500),
  fileRef: optionalText(1000),
  sourceUrl: optionalText(2000),
  checksum: optionalText(200),
  status: z.enum(['ACTIVE', 'ARCHIVED']).default('ACTIVE'),
  capturedAt: optionalDateValue,
  bearingDeg: z.number().min(0).max(360).nullable().optional(),
  assetHint: optionalText(200),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  notes: optionalText(3000),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export const safetyInspectionMediaPatchSchema = safetyInspectionMediaSchema.partial();

export const aiVisionLabels = [
  'TREE_INTRUSION', 'TREE_NEAR_CONDUCTOR', 'CONSTRUCTION_INTRUSION', 'CRANE_NEAR_LINE',
  'SIGNBOARD_INTRUSION', 'FOREIGN_OBJECT', 'FIRE', 'SMOKE', 'BROKEN_INSULATOR',
  'DAMAGED_POLE', 'LEANING_POLE', 'CONDUCTOR_SAG_ANOMALY', 'VEGETATION_OVERGROWTH', 'OTHER',
] as const;

const aiVisionDetectionInputSchema = z.object({
  label: z.string().trim().min(1).max(150),
  confidence: z.number().min(0).max(100),
  bbox: z.unknown().nullable().optional(),
  segmentation: z.unknown().nullable().optional(),
  riskScore: z.number().min(0).max(100).nullable().optional(),
  explanation: z.record(z.string(), z.unknown()).optional().default({}),
});

export const aiVisionAnalyzeSchema = z.object({
  mediaId: z.string().uuid(),
  modelProvider: z.string().trim().min(2).max(100),
  modelName: z.string().trim().min(2).max(150),
  modelVersion: z.string().trim().min(1).max(100),
  configVersion: z.string().trim().min(1).max(100),
  executionMode: z.enum(['MODEL_OUTPUT_IMPORT', 'HTTP_ENDPOINT']).default('MODEL_OUTPUT_IMPORT'),
  assetId: z.string().uuid().nullable().optional(),
  inputHash: optionalText(200),
  rawOutput: z.record(z.string(), z.unknown()).optional().default({}),
  detections: z.array(aiVisionDetectionInputSchema).optional(),
  createdBy: optionalText(200),
});

export const aiVisionRunPatchSchema = z.object({
  status: z.enum(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REVIEWED']).optional(),
  note: optionalText(2000),
});

export const aiVisionReviewSchema = z.object({
  decision: z.enum(['CONFIRM', 'REJECT', 'ADJUST']),
  reviewer: z.string().trim().min(2).max(200),
  finalLabel: z.enum(aiVisionLabels).optional(),
  finalSeverity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  finalViolationType: z.enum(['TREE_INTRUSION', 'CONSTRUCTION_INTRUSION', 'SIGNBOARD', 'FIRE_SMOKE', 'FOREIGN_OBJECT', 'OTHER']).optional(),
  createViolation: z.boolean().default(true),
  corridorId: z.string().uuid().nullable().optional(),
  violationCode: optionalText(120),
  distanceM: z.number().nonnegative().nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  note: optionalText(3000),
});

export const safetyViolationSchema = z.object({
  corridorId: z.string().uuid(),
  inspectionId: z.string().uuid().nullable().optional(),
  code: z.string().trim().min(2).max(120),
  violationType: z.enum(['TREE_INTRUSION', 'CONSTRUCTION_INTRUSION', 'SIGNBOARD', 'FIRE_SMOKE', 'FOREIGN_OBJECT', 'OTHER']),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  detectedAt: dateValue,
  status: z.enum(violationStatuses).default('DETECTED'),
  distanceM: z.number().nonnegative().nullable().optional(),
  evidenceRefs: z.array(z.string().max(1000)).max(20).optional().default([]),
  source: z.enum(['FIELD', 'EVN', 'AI_VISION', 'CITIZEN', 'OTHER']).default('FIELD'),
  aiLabel: optionalText(150),
  aiConfidencePct: z.number().min(0).max(100).nullable().optional(),
  humanReviewRequired: z.boolean().default(false),
  notes: optionalText(3000),
});

export const safetyViolationPatchSchema = z.object({
  corridorId: z.string().uuid().optional(),
  code: z.string().trim().min(2).max(120).optional(),
  violationType: z.enum(['TREE_INTRUSION', 'CONSTRUCTION_INTRUSION', 'SIGNBOARD', 'FIRE_SMOKE', 'FOREIGN_OBJECT', 'OTHER']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  detectedAt: dateValue.optional(),
  status: z.enum(violationStatuses).optional(),
  distanceM: z.number().nonnegative().nullable().optional(),
  evidenceRefs: z.array(z.string().max(1000)).max(20).optional(),
  source: z.enum(['FIELD', 'EVN', 'AI_VISION', 'CITIZEN', 'OTHER']).optional(),
  aiLabel: optionalText(150),
  aiConfidencePct: z.number().min(0).max(100).nullable().optional(),
  humanReviewRequired: z.boolean().optional(),
  notes: optionalText(3000),
  changedBy: optionalText(200),
  reason: optionalText(1000),
});

export const violationAssignmentSchema = z.object({
  assignedTo: optionalText(200),
  assignedTeam: optionalText(200),
  assignedAt: optionalDateValue,
  dueAt: optionalDateValue,
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).default('ACTIVE'),
  note: optionalText(2000),
  createdBy: optionalText(200),
});

export const violationAssignmentPatchSchema = violationAssignmentSchema.partial();

export const violationActionSchema = z.object({
  actionType: z.string().trim().min(2).max(120),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).default('PLANNED'),
  plannedAt: optionalDateValue,
  startedAt: optionalDateValue,
  completedAt: optionalDateValue,
  actor: z.string().trim().min(2).max(200),
  note: optionalText(3000),
  beforeEvidence: z.record(z.string(), z.unknown()).optional().default({}),
  afterEvidence: z.record(z.string(), z.unknown()).optional().default({}),
});

export const violationActionPatchSchema = violationActionSchema.partial();

export const violationVerifySchema = z.object({
  decision: z.enum(['VERIFIED', 'REOPEN', 'CLOSE', 'FALSE_POSITIVE']),
  reviewer: z.string().trim().min(2).max(200),
  note: optionalText(3000),
});

export type ConstructionCaseInput = z.input<typeof constructionCaseSchema>;
export type ConstructionCasePatchInput = z.input<typeof constructionCasePatchSchema>;
export type ConstructionCheckInput = z.input<typeof constructionCheckSchema>;

export const outagePlanSchema = z.object({
  code: z.string().trim().min(2).max(120),
  source: z.string().trim().min(2).max(80).default('EVN'),
  sourceType: z.enum(['MANUAL', 'EVN_API', 'EVN_WEB', 'EVN_FILE', 'IMPORT']).default('MANUAL'),
  sourceRecordId: optionalText(200),
  sourceUrl: optionalText(2000),
  announcedAt: optionalDateValue,
  title: z.string().trim().min(2).max(500),
  startAt: dateValue,
  endAt: dateValue,
  affectedCustomers: z.number().int().nonnegative().nullable().optional(),
  reason: optionalText(2000),
  status: z.enum(['PLANNED', 'ANNOUNCED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).default('PLANNED'),
  affectedGeometry: z.unknown().nullable().optional().refine((value) => {
    if (value == null) return true;
    if (!isSupportedGeoJsonGeometry(value)) return false;
    const type = (value as { type: string }).type;
    return type === 'Polygon' || type === 'MultiPolygon';
  }, 'Affected geometry must be a Polygon or MultiPolygon GeoJSON.'),
  centerLatitude: z.number().min(-90).max(90).nullable().optional(),
  centerLongitude: z.number().min(-180).max(180).nullable().optional(),
  affectedRadiusM: z.number().positive().max(100000).nullable().optional(),
});

export const outagePlanPatchSchema = z.object({
  code: z.string().trim().min(2).max(120).optional(),
  source: z.string().trim().min(2).max(80).optional(),
  sourceType: z.enum(['MANUAL', 'EVN_API', 'EVN_WEB', 'EVN_FILE', 'IMPORT']).optional(),
  sourceRecordId: optionalText(200),
  sourceUrl: optionalText(2000),
  announcedAt: optionalDateValue,
  title: z.string().trim().min(2).max(500).optional(),
  startAt: dateValue.optional(),
  endAt: dateValue.optional(),
  affectedCustomers: z.number().int().nonnegative().nullable().optional(),
  reason: optionalText(2000),
  status: z.enum(['PLANNED', 'ANNOUNCED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ARCHIVED']).optional(),
  affectedGeometry: z.unknown().nullable().optional().refine((value) => {
    if (value == null) return true;
    if (!isSupportedGeoJsonGeometry(value)) return false;
    const type = (value as { type: string }).type;
    return type === 'Polygon' || type === 'MultiPolygon';
  }, 'Affected geometry must be a Polygon or MultiPolygon GeoJSON.'),
  centerLatitude: z.number().min(-90).max(90).nullable().optional(),
  centerLongitude: z.number().min(-180).max(180).nullable().optional(),
  affectedRadiusM: z.number().positive().max(100000).nullable().optional(),
});

export const outageSourceRecordSchema = z.object({
  provider: z.string().trim().min(2).max(80).default('EVN'),
  sourceRecordId: z.string().trim().min(1).max(200),
  sourceUrl: optionalText(2000),
  announcedAt: optionalDateValue,
  rawPayload: z.record(z.string(), z.unknown()).default({}),
  rawText: optionalText(100000),
  checksum: optionalText(200),
  parserVersion: z.string().trim().min(1).max(100),
  mappingVersion: z.string().trim().min(1).max(100),
});

export const outageImportSchema = outagePlanSchema.extend({
  sourceRecord: outageSourceRecordSchema,
});

export const outageImpactRebuildSchema = z.object({
  determinationMethod: z.enum(['TOPOLOGY_DERIVED', 'EVN_PROVIDED_POLYGON', 'EVN_PROVIDED_CUSTOMER_LIST', 'MANUAL_POLYGON', 'RADIUS_ESTIMATE']).default('TOPOLOGY_DERIVED'),
});

export type LegalDocumentInput = z.input<typeof legalDocumentSchema>;
export type LegalDocumentPatchInput = z.input<typeof legalDocumentPatchSchema>;
export type ClearanceRuleInput = z.input<typeof clearanceRuleSchema>;
export type RegulationInput = z.input<typeof regulationSchema>;
export type RegulationPatchInput = z.input<typeof regulationPatchSchema>;
