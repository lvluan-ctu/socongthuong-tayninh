import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const energyTypeCodeSchema = z.string()
  .trim()
  .min(2, 'Mã loại năng lượng phải có ít nhất 2 ký tự.')
  .max(80, 'Mã loại năng lượng quá dài.')
  .regex(/^[A-Z][A-Z0-9_\-]*$/, 'Mã chỉ gồm chữ in hoa, số, gạch dưới hoặc gạch ngang.');

export const energyTypeSchema = z.object({
  code: energyTypeCodeSchema,
  name: z.string().trim().min(2, 'Tên loại năng lượng là bắt buộc.').max(150),
  category: z.string().trim().min(2, 'Nhóm năng lượng là bắt buộc.').max(80),
  canonicalUnit: optionalText(40),
  description: optionalText(1000),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PLANNED']).default('ACTIVE'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export const energyTypePatchSchema = energyTypeSchema.partial();

export const carbonSourceSchema = z.object({
  partyId: z.string().uuid('Đơn vị không hợp lệ.'),
  siteId: z.string().uuid('Site không hợp lệ.'),
  code: z.string().trim().min(2, 'Mã nguồn là bắt buộc.').max(100).regex(/^[A-Za-z0-9][A-Za-z0-9_\-./]*$/, 'Mã nguồn chứa ký tự không hợp lệ.'),
  name: z.string().trim().min(2, 'Tên nguồn là bắt buộc.').max(250),
  sourceType: z.string().trim().min(2, 'Loại nguồn là bắt buộc.').max(100),
  energyTypeCode: energyTypeCodeSchema,
  fuelTypeCode: optionalText(80),
  processType: optionalText(120),
  equipmentRef: optionalText(150),
  meterRef: optionalText(150),
  sourceCategory: optionalText(100),
  scope: z.enum(['SCOPE_1', 'SCOPE_2', 'SCOPE_3']),
  sector: optionalText(150),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PLANNED']).default('ACTIVE'),
  classification: z.enum(['PUBLIC', 'INTERNAL', 'RESTRICTED', 'CONFIDENTIAL']).default('INTERNAL'),
});
export const carbonSourcePatchSchema = carbonSourceSchema.partial();

export const vbdhRawRecordSchema = z.object({
  sourceRecordId: z.string().trim().min(1, 'sourceRecordId là bắt buộc.').max(250),
  documentNo: optionalText(200),
  sourceDocumentRef: optionalText(500),
  sourceUrl: z.string().trim().url('sourceUrl phải là URL hợp lệ.').max(2000).nullable().optional(),
  senderUnit: optionalText(250),
  issuedAt: z.string().datetime({ offset: true }).nullable().optional(),
  receivedAt: z.string().datetime({ offset: true }).nullable().optional(),
  rawPayload: z.record(z.string(), z.unknown()).default({}),
  rawText: z.string().max(1000000).nullable().optional(),
  checksum: z.string().trim().max(200).nullable().optional(),
  parserVersion: z.string().trim().min(1).max(80).default('RAW_IMPORT_V1'),
  mappingVersion: z.string().trim().min(1).max(80).default('UNMAPPED'),
});

export const vbdhSyncSchema = z.object({
  mode: z.literal('RAW_IMPORT').default('RAW_IMPORT'),
  endpointRef: optionalText(500),
  createdBy: optionalText(150),
  records: z.array(vbdhRawRecordSchema).min(1, 'Phải có ít nhất một bản ghi VBDH.'),
});

export const vbdhRecordMapSchema = z.object({
  target: z.enum(['ACTIVITY', 'MEASUREMENT']),
  sourceId: z.string().uuid('Nguồn phát thải không hợp lệ.'),
  factorId: z.string().uuid('Hệ số phát thải không hợp lệ.').optional(),
  period: z.string().regex(/^\d{4}(-\d{2})?$/, 'Kỳ phải có dạng YYYY hoặc YYYY-MM.').optional(),
  quantity: z.number().finite().nonnegative().optional(),
  activityUnit: z.string().trim().min(1).max(80).optional(),
  co2eKg: z.number().finite().nonnegative().nullable().optional(),
  metricCode: z.string().trim().min(1).max(120).optional(),
  value: z.number().finite().optional(),
  unit: z.string().trim().min(1).max(40).optional(),
  measuredAt: z.string().datetime({ offset: true }).nullable().optional(),
  periodFrom: z.string().datetime({ offset: true }).nullable().optional(),
  periodTo: z.string().datetime({ offset: true }).nullable().optional(),
  measurementMethod: optionalText(150),
  instrumentRef: optionalText(150),
  quality: z.string().trim().min(1).max(50).default('REPORTED'),
  verificationStatus: z.string().trim().min(1).max(50).default('DRAFT'),
  sourceDocumentRef: optionalText(500),
}).superRefine((value, context) => {
  if (value.target === 'ACTIVITY') {
    if (!value.factorId) context.addIssue({ code: 'custom', path: ['factorId'], message: 'Activity phải chọn hệ số phát thải.' });
    if (!value.period) context.addIssue({ code: 'custom', path: ['period'], message: 'Activity phải có kỳ dữ liệu.' });
    if (value.quantity == null) context.addIssue({ code: 'custom', path: ['quantity'], message: 'Activity phải có sản lượng.' });
    if (!value.activityUnit) context.addIssue({ code: 'custom', path: ['activityUnit'], message: 'Activity phải có đơn vị.' });
  } else {
    if (!value.metricCode) context.addIssue({ code: 'custom', path: ['metricCode'], message: 'Measurement phải có metric.' });
    if (value.value == null) context.addIssue({ code: 'custom', path: ['value'], message: 'Measurement phải có giá trị.' });
    if (!value.unit) context.addIssue({ code: 'custom', path: ['unit'], message: 'Measurement phải có đơn vị.' });
  }
  if (value.periodFrom && value.periodTo && new Date(value.periodTo) < new Date(value.periodFrom)) context.addIssue({ code: 'custom', path: ['periodTo'], message: 'Thời điểm kết thúc phải sau thời điểm bắt đầu.' });
});

export const calculationReviewSchema = z.object({
  reviewStatus: z.enum(['PENDING_REVIEW', 'APPROVED', 'REJECTED']),
  reviewedBy: z.string().trim().min(2).max(150),
  reviewNote: z.string().trim().max(2000).nullable().optional(),
});

const carbonMeasurementBaseSchema = z.object({
  sourceId: z.string().uuid('Nguồn phát thải không hợp lệ.'),
  vbdhRecordId: z.string().uuid().nullable().optional(),
  metricCode: z.string().trim().min(1, 'Metric là bắt buộc.').max(120),
  periodFrom: z.string().datetime({ offset: true }).nullable().optional(),
  periodTo: z.string().datetime({ offset: true }).nullable().optional(),
  measuredAt: z.string().datetime({ offset: true }),
  value: z.number().finite(),
  unit: z.string().trim().min(1, 'Đơn vị là bắt buộc.').max(40),
  measurementMethod: optionalText(150),
  instrumentRef: optionalText(150),
  sourceSystem: z.enum(['MANUAL', 'VBDH', 'EVN', 'IMPORT', 'API']).default('MANUAL'),
  sourceRecordId: optionalText(250),
  sourceDocumentRef: optionalText(500),
  quality: z.string().trim().min(1).max(50).default('REPORTED'),
  verificationStatus: z.string().trim().min(1).max(50).default('DRAFT'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export const carbonMeasurementSchema = carbonMeasurementBaseSchema.superRefine((value, context) => {
  if (value.periodFrom && value.periodTo && new Date(value.periodTo) < new Date(value.periodFrom)) context.addIssue({ code: 'custom', path: ['periodTo'], message: 'Thời điểm kết thúc phải sau thời điểm bắt đầu.' });
});
export const carbonMeasurementPatchSchema = carbonMeasurementBaseSchema.partial().superRefine((value, context) => {
  if (value.periodFrom && value.periodTo && new Date(value.periodTo) < new Date(value.periodFrom)) context.addIssue({ code: 'custom', path: ['periodTo'], message: 'Thời điểm kết thúc phải sau thời điểm bắt đầu.' });
});

export const calculationRunSchema = z.object({ activityId: z.string().uuid('Activity không hợp lệ.'), calculatedBy: z.string().trim().max(150).nullable().optional() });

const periodSchema = z.string().regex(/^\d{4}(-\d{2})?$/, 'Kỳ phải có dạng YYYY hoặc YYYY-MM.');
export const reductionPlanPatchSchema = z.object({ name: z.string().trim().min(2).max(250).optional(), baselineYear: z.number().int().min(2000).max(2100).optional(), targetYear: z.number().int().min(2000).max(2100).optional(), baselineCo2eKg: z.number().finite().nonnegative().optional(), targetReductionPct: z.number().finite().min(0).max(100).optional(), status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional(), metadata: z.record(z.string(), z.unknown()).optional() });
export const reductionTargetSchema = z.object({ year: z.number().int().min(2000).max(2100), targetCo2eKg: z.number().finite().nonnegative(), targetReductionPct: z.number().finite().min(0).max(100), status: z.enum(['PLANNED', 'ACTIVE', 'ACHIEVED', 'RETIRED']).default('PLANNED'), notes: optionalText(2000) });
export const reductionTargetPatchSchema = reductionTargetSchema.partial();

const reductionActionBaseSchema = z.object({
  code: z.string().trim().min(2).max(100), name: z.string().trim().min(2).max(250), actionType: z.string().trim().min(2).max(100), sourceId: z.string().uuid().nullable().optional(), siteId: z.string().uuid().nullable().optional(), owner: optionalText(150), startAt: z.string().datetime({ offset: true }).nullable().optional(), targetAt: z.string().datetime({ offset: true }).nullable().optional(), budget: z.number().finite().nonnegative().nullable().optional(), expectedReductionTco2eYear: z.number().finite().nonnegative().nullable().optional(), actualReductionTco2eYear: z.number().finite().nonnegative().nullable().optional(), status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ON_HOLD']).default('PLANNED'), method: optionalText(2000), verificationRequired: z.boolean().default(true), evidenceRef: optionalText(1000),
});
export const reductionActionSchema = reductionActionBaseSchema.superRefine((value, context) => { if (value.startAt && value.targetAt && new Date(value.targetAt) < new Date(value.startAt)) context.addIssue({ code: 'custom', path: ['targetAt'], message: 'Thời điểm mục tiêu phải sau thời điểm bắt đầu.' }); });
export const reductionActionPatchSchema = reductionActionBaseSchema.partial().superRefine((value, context) => { if (value.startAt && value.targetAt && new Date(value.targetAt) < new Date(value.startAt)) context.addIssue({ code: 'custom', path: ['targetAt'], message: 'Thời điểm mục tiêu phải sau thời điểm bắt đầu.' }); });

export const reductionActionProgressSchema = z.object({ period: periodSchema, actualCo2eKg: z.number().finite().nonnegative(), reductionPct: z.number().finite().min(0).max(100).nullable().optional(), evidenceRef: optionalText(1000), verifiedBy: optionalText(150), verifiedAt: z.string().datetime({ offset: true }).nullable().optional(), status: z.enum(['RECORDED', 'VERIFIED', 'REJECTED']).default('RECORDED'), notes: optionalText(2000) });
export const reductionActionProgressPatchSchema = reductionActionProgressSchema.partial();

const carbonProjectBaseSchema = z.object({
  code: z.string().trim().min(2).max(100), name: z.string().trim().min(2).max(250), partyId: z.string().uuid().nullable().optional(), siteId: z.string().uuid().nullable().optional(), projectType: z.string().trim().min(2).max(100), methodology: z.string().trim().min(2).max(250), registry: optionalText(150), validationRef: optionalText(500), verificationRef: optionalText(500), startDate: z.string().datetime({ offset: true }).nullable().optional(), creditingPeriodFrom: z.string().datetime({ offset: true }).nullable().optional(), creditingPeriodTo: z.string().datetime({ offset: true }).nullable().optional(), status: z.enum(['DRAFT', 'VALIDATED', 'VERIFIED', 'ACTIVE', 'COMPLETED', 'CANCELLED']).default('DRAFT'), notes: optionalText(2000), metadata: z.record(z.string(), z.unknown()).optional(),
});
export const carbonProjectSchema = carbonProjectBaseSchema.superRefine((value, context) => { if (value.creditingPeriodFrom && value.creditingPeriodTo && new Date(value.creditingPeriodTo) < new Date(value.creditingPeriodFrom)) context.addIssue({ code: 'custom', path: ['creditingPeriodTo'], message: 'Kết thúc crediting period phải sau thời điểm bắt đầu.' }); });
export const carbonProjectPatchSchema = carbonProjectBaseSchema.partial().superRefine((value, context) => { if (value.creditingPeriodFrom && value.creditingPeriodTo && new Date(value.creditingPeriodTo) < new Date(value.creditingPeriodFrom)) context.addIssue({ code: 'custom', path: ['creditingPeriodTo'], message: 'Kết thúc crediting period phải sau thời điểm bắt đầu.' }); });

export const carbonCreditBatchSchema = z.object({ projectId: z.string().uuid().nullable().optional(), registry: z.string().trim().min(2).max(120), batchRef: z.string().trim().min(2).max(200), serialFrom: optionalText(200), serialTo: optionalText(200), vintageYear: z.number().int().min(1900).max(2200), issuedAt: z.string().datetime({ offset: true }), quantityTco2e: z.number().finite().positive(), status: z.enum(['DRAFT', 'ISSUED', 'AVAILABLE', 'RESERVED', 'RETIRED', 'CANCELLED']).default('ISSUED'), evidenceRef: optionalText(1000), metadata: z.record(z.string(), z.unknown()).optional() });
export const carbonCreditBatchPatchSchema = carbonCreditBatchSchema.partial();

const carbonCreditTransactionBaseSchema = z.object({ creditBatchId: z.string().uuid('Batch tín chỉ không hợp lệ.'), transactionType: z.enum(['ISSUE', 'TRANSFER_IN', 'TRANSFER_OUT', 'RESERVE', 'RELEASE', 'RETIRE', 'CANCEL', 'ADJUSTMENT']), quantityTco2e: z.number().finite().positive(), balanceDeltaTco2e: z.number().finite().optional(), fromPartyId: z.string().uuid().nullable().optional(), toPartyId: z.string().uuid().nullable().optional(), occurredAt: z.string().datetime({ offset: true }).optional(), reference: optionalText(500), certificateRef: optionalText(500), reason: optionalText(2000), createdBy: optionalText(150) });
export const carbonCreditTransactionSchema = carbonCreditTransactionBaseSchema.superRefine((value, context) => {
  if (value.transactionType === 'ADJUSTMENT' && value.balanceDeltaTco2e == null) context.addIssue({ code: 'custom', path: ['balanceDeltaTco2e'], message: 'ADJUSTMENT phải nêu rõ balance delta âm hoặc dương.' });
  if (value.transactionType !== 'ADJUSTMENT' && value.balanceDeltaTco2e != null) context.addIssue({ code: 'custom', path: ['balanceDeltaTco2e'], message: 'Chỉ ADJUSTMENT được tự chọn balance delta.' });
  if (['TRANSFER_IN', 'RELEASE'].includes(value.transactionType) && !value.toPartyId) context.addIssue({ code: 'custom', path: ['toPartyId'], message: 'Transaction này cần toPartyId.' });
  if (value.transactionType === 'TRANSFER_OUT' && !value.fromPartyId) context.addIssue({ code: 'custom', path: ['fromPartyId'], message: 'Transaction này cần fromPartyId.' });
});
