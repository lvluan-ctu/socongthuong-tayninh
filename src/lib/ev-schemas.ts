import { z } from 'zod';

const nullableUuid = z.string().uuid().nullable().optional();
const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();
const dateTime = z.string().trim().min(1).refine((value) => !Number.isNaN(new Date(value).getTime()), 'Thời điểm không hợp lệ.');
const nullableDateTime = dateTime.nullable().optional();
const coordinates = {
  latitude: z.number().finite().min(-90).max(90).nullable().optional(),
  longitude: z.number().finite().min(-180).max(180).nullable().optional(),
};

const applicationFields = {
  code: z.string().trim().min(2).max(100),
  applicantPartyId: nullableUuid,
  applicantCode: nullableText(100),
  applicantName: nullableText(250),
  address: z.string().trim().min(2).max(500),
  adminAreaCode: nullableText(50),
  ...coordinates,
  requestedPowerKw: z.number().finite().positive(),
  requestedConnectorCount: z.number().int().positive(),
  requestedConnectorTypes: z.array(z.string().trim().min(1).max(80)).min(1).max(50),
  gridAssetId: nullableUuid,
  status: z.enum(['DRAFT', 'SUBMITTED']).default('SUBMITTED'),
  actor: nullableText(200),
};

export const evApplicationSchema = z.object(applicationFields).superRefine((value, context) => {
  if (!value.applicantPartyId && (!value.applicantCode || !value.applicantName)) {
    context.addIssue({ code: 'custom', path: ['applicantPartyId'], message: 'Chọn khách hàng hoặc nhập đủ mã và tên khách hàng mới.' });
  }
  if ((value.latitude == null) !== (value.longitude == null)) {
    context.addIssue({ code: 'custom', path: ['latitude'], message: 'Latitude và longitude phải nhập đồng thời.' });
  }
});

const applicationPatchFields = {
  code: applicationFields.code.optional(),
  applicantPartyId: nullableUuid,
  applicantCode: nullableText(100),
  applicantName: nullableText(250),
  address: applicationFields.address.optional(),
  adminAreaCode: nullableText(50),
  latitude: coordinates.latitude,
  longitude: coordinates.longitude,
  requestedPowerKw: applicationFields.requestedPowerKw.optional(),
  requestedConnectorCount: applicationFields.requestedConnectorCount.optional(),
  requestedConnectorTypes: applicationFields.requestedConnectorTypes.optional(),
  gridAssetId: nullableUuid,
  plannedCommissioningAt: nullableDateTime,
  actor: nullableText(200),
};

export const evApplicationPatchSchema = z.object(applicationPatchFields).superRefine((value, context) => {
  if ((value.latitude == null) !== (value.longitude == null) && (value.latitude !== undefined || value.longitude !== undefined)) {
    context.addIssue({ code: 'custom', path: ['latitude'], message: 'Latitude và longitude phải nhập đồng thời.' });
  }
});

export const evApplicationReviewSchema = z.object({
  status: z.enum(['UNDER_REVIEW', 'NEEDS_INFO', 'PRELIMINARY_OK', 'APPROVED', 'REJECTED']),
  reviewType: z.enum(['DOCUMENT_REVIEW', 'GRID_REVIEW', 'SAFETY_REVIEW', 'SITE_REVIEW', 'FINAL_REVIEW']).default('FINAL_REVIEW'),
  reviewedBy: z.string().trim().min(2).max(200),
  reviewNote: nullableText(3000),
  result: z.enum(['PASS', 'CONDITIONAL', 'NEEDS_INFO', 'APPROVED', 'REJECTED']).optional(),
  approvedPowerKw: z.number().finite().positive().nullable().optional(),
  conditions: nullableText(3000),
  documentRef: nullableText(500),
  assessmentId: nullableUuid,
  connectionCapacityKw: z.number().finite().positive().nullable().optional(),
  connectionPointAssetId: nullableUuid,
  connectionMethod: nullableText(120),
  connectionSourceRef: nullableText(500),
  approvalNo: nullableText(150),
}).superRefine((value, context) => {
  if (value.status === 'APPROVED' && value.approvedPowerKw == null) {
    context.addIssue({ code: 'custom', path: ['approvedPowerKw'], message: 'Phải nhập công suất được duyệt.' });
  }
  if (value.status !== 'APPROVED' && value.approvedPowerKw != null) {
    context.addIssue({ code: 'custom', path: ['approvedPowerKw'], message: 'Chỉ nhập approved power khi kết quả là APPROVED.' });
  }
});

export const evGridAssessmentSchema = z.object({
  assessmentType: z.enum(['NEAREST_GRID_SCREENING', 'EVN_CONFIRMED_SERVICE_POINT', 'FEEDER_HOSTING_CAPACITY', 'TECHNICAL_REVIEW', 'FINAL_CONNECTION_ASSESSMENT']),
  assessedAt: nullableDateTime,
  assessedBy: nullableText(200),
  requestedPowerKw: z.number().finite().positive(),
  candidateGridAssetId: nullableUuid,
  confirmedGridAssetId: nullableUuid,
  availableCapacityKw: z.number().finite().min(0).nullable().optional(),
  approvedCapacityKw: z.number().finite().min(0).nullable().optional(),
  voltageLevelKv: z.number().finite().min(0).nullable().optional(),
  distanceM: z.number().finite().min(0).nullable().optional(),
  method: z.string().trim().min(2).max(200),
  methodVersion: z.string().trim().min(1).max(80),
  sourceRef: nullableText(500),
  inputSnapshot: z.record(z.string(), z.unknown()).default({}),
  result: z.record(z.string(), z.unknown()).default({}),
  constraints: z.record(z.string(), z.unknown()).default({}),
  recommendation: nullableText(3000),
  status: z.enum(['PRELIMINARY', 'CONFIRMED', 'SUPERSEDED', 'REJECTED']).default('PRELIMINARY'),
}).superRefine((value, context) => {
  if (value.status === 'CONFIRMED' && !value.confirmedGridAssetId) {
    context.addIssue({ code: 'custom', path: ['confirmedGridAssetId'], message: 'Assessment CONFIRMED phải có điểm lưới đã xác nhận.' });
  }
  if (value.assessmentType !== 'NEAREST_GRID_SCREENING' && !value.assessedBy) {
    context.addIssue({ code: 'custom', path: ['assessedBy'], message: 'Assessment kỹ thuật phải có người đánh giá.' });
  }
});

export const evGridAssessmentPatchSchema = z.object({
  assessmentType: evGridAssessmentSchema.shape.assessmentType.optional(),
  assessedAt: nullableDateTime,
  assessedBy: nullableText(200),
  candidateGridAssetId: nullableUuid,
  confirmedGridAssetId: nullableUuid,
  availableCapacityKw: evGridAssessmentSchema.shape.availableCapacityKw,
  approvedCapacityKw: evGridAssessmentSchema.shape.approvedCapacityKw,
  voltageLevelKv: evGridAssessmentSchema.shape.voltageLevelKv,
  distanceM: evGridAssessmentSchema.shape.distanceM,
  method: evGridAssessmentSchema.shape.method.optional(),
  methodVersion: evGridAssessmentSchema.shape.methodVersion.optional(),
  sourceRef: nullableText(500),
  inputSnapshot: z.record(z.string(), z.unknown()).optional(),
  result: z.record(z.string(), z.unknown()).optional(),
  constraints: z.record(z.string(), z.unknown()).optional(),
  recommendation: nullableText(3000),
  status: evGridAssessmentSchema.shape.status.optional(),
  actor: z.string().trim().min(2).max(200).nullable().optional(),
});

export const evApplicationDocumentSchema = z.object({
  documentType: z.enum(['APPLICATION_FORM', 'SITE_PLAN', 'LAND_DOCUMENT', 'POWER_REQUEST', 'ELECTRICAL_DESIGN', 'FIRE_SAFETY', 'GRID_AGREEMENT', 'APPROVAL_DECISION', 'OTHER']),
  documentRef: z.string().trim().min(2).max(1000),
  title: nullableText(250),
  version: z.number().int().positive().default(1),
  status: z.enum(['ACTIVE', 'SUPERSEDED', 'REJECTED', 'ARCHIVED']).default('ACTIVE'),
  uploadedAt: nullableDateTime,
  uploadedBy: nullableText(200),
  checksum: nullableText(200),
  notes: nullableText(3000),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const evApplicationDocumentPatchSchema = z.object({
  documentType: evApplicationDocumentSchema.shape.documentType.optional(),
  documentRef: evApplicationDocumentSchema.shape.documentRef.optional(),
  title: nullableText(250),
  version: evApplicationDocumentSchema.shape.version.optional(),
  status: evApplicationDocumentSchema.shape.status.optional(),
  uploadedAt: nullableDateTime,
  uploadedBy: nullableText(200),
  checksum: nullableText(200),
  notes: nullableText(3000),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const evAnalyticsFilterSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  adminAreaCode: z.string().trim().max(50).optional(),
  status: z.enum(['ALL', 'SUBMITTED', 'APPROVED', 'OPERATING']).default('ALL'),
}).superRefine((value, context) => {
  for (const key of ['from', 'to'] as const) {
    const date = value[key];
    if (date) {
      const [year, month, day] = date.split('-').map(Number);
      const parsed = new Date(Date.UTC(year, month - 1, day));
      if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) context.addIssue({ code: 'custom', path: [key], message: 'Ngày lịch không hợp lệ.' });
    }
  }
  if (value.from && value.to && value.to < value.from) context.addIssue({ code: 'custom', path: ['to'], message: 'Đến ngày phải sau hoặc bằng từ ngày.' });
});

export const evGisFilterSchema = z.object({
  adminAreaCode: z.string().trim().max(50).optional(),
  status: z.enum(['ALL', 'SUBMITTED', 'APPROVED', 'OPERATING']).default('ALL'),
});
