import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const dateTimeString = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), "Ngày/giờ không hợp lệ.");
const nullableDateTimeString = dateTimeString.nullable().optional();

export const consumerGroupEnum = z.enum([
  "STATE_AGENCY",
  "ENTERPRISE",
  "INDUSTRIAL",
  "COMMERCIAL_SERVICE",
  "AGRICULTURE",
  "EDUCATION",
  "HEALTHCARE",
  "HOUSEHOLD",
  "OTHER",
]);

export const importanceLevelEnum = z.enum(["KEY", "NEAR_KEY", "NORMAL"]);
export const reportingRequiredEnum = z.enum(["YES", "NO"]);

export const consumerSchema = z
  .object({
    customerAccountId: z.string().uuid().nullable().optional(),
    partyCode: z.string().trim().min(2).max(80).nullable().optional(),
    partyName: z.string().trim().min(2).max(250).nullable().optional(),
    address: optionalText(500),
    adminAreaCode: optionalText(50),
    latitude: z.number().finite().min(-90).max(90).nullable().optional(),
    longitude: z.number().finite().min(-180).max(180).nullable().optional(),
    consumerGroup: consumerGroupEnum.default("OTHER"),
    importanceLevel: importanceLevelEnum.default("NORMAL"),
    /** Legacy field retained for existing integrations; the two new dimensions are authoritative. */
    classification: z.string().trim().min(2).max(80).nullable().optional(),
    classificationValidFrom: dateTimeString.nullable().optional(),
    classificationSourceDocumentNo: optionalText(200),
    classificationSourceDocumentRef: optionalText(1000),
    classificationReason: optionalText(2000),
    classificationIssuedBy: optionalText(200),
    sector: z.string().trim().min(2).max(150),
    industryZoneCode: optionalText(100),
    reportingRequired: reportingRequiredEnum.default("YES"),
  })
  .superRefine((value, context) => {
    if (!value.customerAccountId && !value.partyCode) {
      context.addIssue({
        code: "custom",
        path: ["partyCode"],
        message: "Cần mã đơn vị khi không liên kết tài khoản EVN.",
      });
    }
    if (!value.customerAccountId && !value.partyName) {
      context.addIssue({
        code: "custom",
        path: ["partyName"],
        message: "Cần tên đơn vị khi không liên kết tài khoản EVN.",
      });
    }
    if (!value.customerAccountId && !value.address) {
      context.addIssue({
        code: "custom",
        path: ["address"],
        message: "Cần địa chỉ vận hành khi không liên kết tài khoản EVN.",
      });
    }
    if (!value.customerAccountId && !value.adminAreaCode) {
      context.addIssue({
        code: "custom",
        path: ["adminAreaCode"],
        message: "Cần mã địa bàn khi không liên kết tài khoản EVN.",
      });
    }
    if (!value.customerAccountId && value.latitude == null) {
      context.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Cần vĩ độ để cơ sở hiển thị đồng bộ trên GIS.",
      });
    }
    if (!value.customerAccountId && value.longitude == null) {
      context.addIssue({
        code: "custom",
        path: ["longitude"],
        message: "Cần kinh độ để cơ sở hiển thị đồng bộ trên GIS.",
      });
    }
    if (!value.classificationSourceDocumentNo && !value.classificationSourceDocumentRef) {
      context.addIssue({
        code: "custom",
        path: ["classificationSourceDocumentRef"],
        message: "Cần văn bản hoặc nguồn làm căn cứ phân loại.",
      });
    }
  });

export const consumerPatchSchema = z.object({
  customerAccountId: z.string().uuid().nullable().optional(),
  partyCode: z.string().trim().min(2).max(80).nullable().optional(),
  partyName: z.string().trim().min(2).max(250).nullable().optional(),
  address: optionalText(500),
  adminAreaCode: optionalText(50),
  latitude: z.number().finite().min(-90).max(90).nullable().optional(),
  longitude: z.number().finite().min(-180).max(180).nullable().optional(),
  consumerGroup: consumerGroupEnum.optional(),
  importanceLevel: importanceLevelEnum.optional(),
  classification: z.string().trim().min(2).max(80).nullable().optional(),
  classificationValidFrom: dateTimeString.optional(),
  classificationSourceDocumentNo: optionalText(200),
  classificationSourceDocumentRef: optionalText(1000),
  classificationReason: optionalText(2000),
  classificationIssuedBy: optionalText(200),
  sector: z.string().trim().min(2).max(150).optional(),
  industryZoneCode: optionalText(100),
  reportingRequired: reportingRequiredEnum.optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
}).superRefine((value, context) => {
  const hasLatitude = Object.prototype.hasOwnProperty.call(value, "latitude");
  const hasLongitude = Object.prototype.hasOwnProperty.call(value, "longitude");
  if (hasLatitude !== hasLongitude || (hasLatitude && (value.latitude == null) !== (value.longitude == null))) {
    context.addIssue({
      code: "custom",
      path: [hasLatitude ? "longitude" : "latitude"],
      message: "Vĩ độ và kinh độ phải được cập nhật cùng nhau.",
    });
  }
});

export const classificationHistorySchema = z
  .object({
    consumerGroup: consumerGroupEnum,
    importanceLevel: importanceLevelEnum,
    validFrom: dateTimeString,
    validTo: nullableDateTimeString,
    sourceDocumentNo: optionalText(200),
    sourceDocumentRef: optionalText(1000),
    issuedBy: optionalText(200),
    reason: optionalText(2000),
    status: z.enum(["ACTIVE", "SUPERSEDED", "REVOKED"]).default("ACTIVE"),
  })
  .superRefine((value, context) => {
    if (value.validTo && new Date(value.validTo).getTime() < new Date(value.validFrom).getTime()) {
      context.addIssue({
        code: "custom",
        path: ["validTo"],
        message: "Ngày kết thúc phải sau ngày bắt đầu.",
      });
    }
    if (!value.sourceDocumentNo && !value.sourceDocumentRef) {
      context.addIssue({
        code: "custom",
        path: ["sourceDocumentRef"],
        message: "Cần số hoặc đường dẫn văn bản làm căn cứ phân loại.",
      });
    }
  });

export const classificationHistoryPatchSchema = z.object({
  consumerGroup: consumerGroupEnum.optional(),
  importanceLevel: importanceLevelEnum.optional(),
  validFrom: dateTimeString.optional(),
  validTo: nullableDateTimeString,
  sourceDocumentNo: optionalText(200),
  sourceDocumentRef: optionalText(1000),
  issuedBy: optionalText(200),
  reason: optionalText(2000),
  status: z.enum(["ACTIVE", "SUPERSEDED", "REVOKED"]).optional(),
});

export const smartMeterSchema = z.object({
  consumerId: z.string().uuid().nullable().optional(),
  siteId: z.string().uuid().nullable().optional(),
  customerAccountId: z.string().uuid().nullable().optional(),
  measurementPointId: z.string().uuid().nullable().optional(),
  meterCode: z.string().trim().min(2).max(120),
  provider: z.string().trim().min(2).max(120).default("EVN"),
  meterType: z.string().trim().min(2).max(80).default("SMART_METER"),
  manufacturer: optionalText(150),
  model: optionalText(150),
  serialNumber: optionalText(150),
  phaseType: optionalText(30),
  voltageLevelKv: z.number().finite().positive().nullable().optional(),
  installedAt: nullableDateTimeString,
  commissionedAt: nullableDateTimeString,
  lastInspectionAt: nullableDateTimeString,
  nextInspectionDueAt: nullableDateTimeString,
  replacementDueAt: nullableDateTimeString,
  status: z.enum(["ACTIVE", "INACTIVE", "RETIRED", "ARCHIVED"]).default("ACTIVE"),
  communicationType: optionalText(80),
  sourceId: z.string().uuid().nullable().optional(),
  sourceRef: optionalText(1000),
  confidence: z.number().finite().min(0).max(100).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const smartMeterPatchSchema = smartMeterSchema.partial();

export const meterEventSchema = z.object({
  eventType: z.string().trim().min(2).max(80),
  eventAt: dateTimeString,
  description: optionalText(2000),
  source: z.string().trim().min(2).max(120).default("MANUAL"),
  sourceRef: optionalText(1000),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const meterEventPatchSchema = meterEventSchema.partial();

export const canonicalMetricCodes = [
  "ENERGY_IMPORT_KWH",
  "ACTIVE_POWER_KW",
  "MAX_DEMAND_KW",
  "VOLTAGE_V",
  "CURRENT_A",
  "POWER_FACTOR",
  "PEAK_ENERGY_KWH",
  "NORMAL_ENERGY_KWH",
  "OFFPEAK_ENERGY_KWH",
] as const;

export const canonicalMetricCodeSchema = z.enum(canonicalMetricCodes);

export const meterReadingSchema = z.object({
  metricCode: canonicalMetricCodeSchema,
  measuredAt: dateTimeString,
  value: z.number().finite(),
  unit: z.string().trim().min(1).max(30),
  quality: z.enum(["GOOD", "ESTIMATED", "MISSING", "INVALID", "REPORTED"]).default("GOOD"),
  sourceId: z.string().uuid().nullable().optional(),
  rawValue: optionalText(200),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const meterReadingPatchSchema = meterReadingSchema.partial();

export const reportLineSchema = z.object({
  metricCode: z.string().trim().min(2).max(100),
  value: z.number().finite().nonnegative(),
  unit: z.string().trim().min(1).max(30),
  source: z.string().trim().min(2).max(120).default("CONSUMER_REPORT"),
  sourceRef: optionalText(1000),
  quality: z.enum(["GOOD", "ESTIMATED", "MISSING", "INVALID", "REPORTED"]).default("REPORTED"),
  notes: optionalText(2000),
});

export const reportLinePatchSchema = reportLineSchema.partial();

export const reportSchema = z
  .object({
    consumerId: z.string().uuid(),
    period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Kỳ phải có dạng YYYY-MM."),
    reportType: z.enum(["MONTHLY", "QUARTERLY", "YEARLY", "CUSTOM"]).default("MONTHLY"),
    periodFrom: z
      .string()
      .regex(/^\d{4}-\d{2}$/, "Kỳ bắt đầu không hợp lệ.")
      .nullable()
      .optional(),
    periodTo: z
      .string()
      .regex(/^\d{4}-\d{2}$/, "Kỳ kết thúc không hợp lệ.")
      .nullable()
      .optional(),
    reportVersion: z.string().trim().min(1).max(40).default("1.0"),
    reportedEnergyKwh: z.number().finite().nonnegative(),
    status: z
      .enum(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "REJECTED", "ARCHIVED"])
      .default("SUBMITTED"),
    documentRef: optionalText(1000),
    submittedBy: optionalText(200),
    notes: optionalText(3000),
    lines: z.array(reportLineSchema).max(100).default([]),
  })
  .superRefine((value, context) => {
    if (value.periodFrom && value.periodTo && value.periodFrom > value.periodTo) {
      context.addIssue({
        code: "custom",
        path: ["periodTo"],
        message: "Kỳ kết thúc phải sau hoặc bằng kỳ bắt đầu.",
      });
    }
  });

export const reportPatchSchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  reportType: z.enum(["MONTHLY", "QUARTERLY", "YEARLY", "CUSTOM"]).optional(),
  periodFrom: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .nullable()
    .optional(),
  periodTo: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .nullable()
    .optional(),
  reportVersion: z.string().trim().min(1).max(40).optional(),
  reportedEnergyKwh: z.number().finite().nonnegative().optional(),
  status: z
    .enum(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "REJECTED", "ARCHIVED"])
    .optional(),
  documentRef: optionalText(1000),
  submittedBy: optionalText(200),
  notes: optionalText(3000),
});

export const ruleSchema = z
  .object({
    metricCode: z.string().trim().min(2).max(100),
    matchThresholdPct: z.number().finite().min(0).max(100),
    reviewThresholdPct: z.number().finite().min(0).max(100),
    minDenominator: z.number().finite().nonnegative().default(0),
    severity: z.enum(["INFO", "WARNING", "ALERT"]).default("ALERT"),
    unit: z.string().trim().min(1).max(30).default("%"),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((value, context) => {
    if (value.reviewThresholdPct < value.matchThresholdPct) {
      context.addIssue({
        code: "custom",
        path: ["reviewThresholdPct"],
        message: "Ngưỡng review phải lớn hơn hoặc bằng ngưỡng match.",
      });
    }
  });

export const rulePatchSchema = z.object({
  metricCode: z.string().trim().min(2).max(100).optional(),
  matchThresholdPct: z.number().finite().min(0).max(100).optional(),
  reviewThresholdPct: z.number().finite().min(0).max(100).optional(),
  minDenominator: z.number().finite().nonnegative().optional(),
  severity: z.enum(["INFO", "WARNING", "ALERT"]).optional(),
  unit: z.string().trim().min(1).max(30).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const ruleSetSchema = z
  .object({
    code: z.string().trim().min(2).max(100),
    name: z.string().trim().min(2).max(250),
    version: z.string().trim().min(1).max(60),
    validFrom: dateTimeString,
    validTo: nullableDateTimeString,
    status: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]).default("DRAFT"),
    sourceDocumentNo: optionalText(200),
    sourceDocumentRef: optionalText(1000),
    notes: optionalText(3000),
    rules: z.array(ruleSchema).min(1).max(100),
  })
  .superRefine((value, context) => {
    if (value.validTo && new Date(value.validTo).getTime() < new Date(value.validFrom).getTime()) {
      context.addIssue({
        code: "custom",
        path: ["validTo"],
        message: "Ngày kết thúc phải sau ngày bắt đầu.",
      });
    }
    if (value.status === "ACTIVE" && !value.sourceDocumentNo && !value.sourceDocumentRef) {
      context.addIssue({
        code: "custom",
        path: ["sourceDocumentRef"],
        message: "Rule ACTIVE phải có văn bản hoặc nguồn công bố.",
      });
    }
    const metricCodes = value.rules.map((rule) => rule.metricCode);
    if (new Set(metricCodes).size !== metricCodes.length) {
      context.addIssue({
        code: "custom",
        path: ["rules"],
        message: "Mỗi metric chỉ được khai báo một lần trong rule set.",
      });
    }
  });

export const ruleSetPatchSchema = z.object({
  code: z.string().trim().min(2).max(100).optional(),
  name: z.string().trim().min(2).max(250).optional(),
  version: z.string().trim().min(1).max(60).optional(),
  validFrom: dateTimeString.optional(),
  validTo: nullableDateTimeString,
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
  sourceDocumentNo: optionalText(200),
  sourceDocumentRef: optionalText(1000),
  notes: optionalText(3000),
});

export const baselineSchema = z
  .object({
    consumerId: z.string().uuid(),
    baselineType: z.string().trim().min(2).max(80).default("HISTORICAL_AVERAGE"),
    periodFrom: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Kỳ bắt đầu phải có dạng YYYY-MM."),
    periodTo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Kỳ kết thúc phải có dạng YYYY-MM."),
    baselineKwh: z.number().finite().nonnegative(),
    normalizationMethod: z.string().trim().min(2).max(100).default("NONE"),
    weatherAdjusted: z.boolean().default(false),
    productionAdjusted: z.boolean().default(false),
    methodVersion: z.string().trim().min(1).max(60),
    sourceId: z.string().uuid().nullable().optional(),
    sourceRef: optionalText(1000),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED", "RETIRED"]).default("DRAFT"),
    notes: optionalText(3000),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((value, context) => {
    if (value.periodFrom > value.periodTo)
      context.addIssue({
        code: "custom",
        path: ["periodTo"],
        message: "Kỳ kết thúc phải sau hoặc bằng kỳ bắt đầu.",
      });
    if (value.status === "ACTIVE" && !value.sourceRef)
      context.addIssue({
        code: "custom",
        path: ["sourceRef"],
        message: "Baseline ACTIVE phải có source reference.",
      });
  });

export const baselinePatchSchema = z.object({
  baselineType: z.string().trim().min(2).max(80).optional(),
  periodFrom: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  periodTo: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  baselineKwh: z.number().finite().nonnegative().optional(),
  normalizationMethod: z.string().trim().min(2).max(100).optional(),
  weatherAdjusted: z.boolean().optional(),
  productionAdjusted: z.boolean().optional(),
  methodVersion: z.string().trim().min(1).max(60).optional(),
  sourceId: z.string().uuid().nullable().optional(),
  sourceRef: optionalText(1000),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED", "RETIRED"]).optional(),
  notes: optionalText(3000),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const baselineDeriveSchema = z
  .object({
    consumerId: z.string().uuid(),
    baselineType: z.string().trim().min(2).max(80).default("HISTORICAL_SUM"),
    periodFrom: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Kỳ bắt đầu phải có dạng YYYY-MM."),
    periodTo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Kỳ kết thúc phải có dạng YYYY-MM."),
    normalizationMethod: z.string().trim().min(2).max(100).default("NONE"),
    weatherAdjusted: z.boolean().default(false),
    productionAdjusted: z.boolean().default(false),
    methodVersion: z.string().trim().min(1).max(60).default("EVN_MONTHLY_SUM_V1"),
    sourceId: z.string().uuid().nullable().optional(),
    sourceRef: optionalText(1000),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED", "RETIRED"]).default("DRAFT"),
    notes: optionalText(3000),
  })
  .superRefine((value, context) => {
    if (value.periodFrom > value.periodTo)
      context.addIssue({
        code: "custom",
        path: ["periodTo"],
        message: "Kỳ kết thúc phải sau hoặc bằng kỳ bắt đầu.",
      });
    if (value.status === "ACTIVE" && !value.sourceRef)
      context.addIssue({
        code: "custom",
        path: ["sourceRef"],
        message: "Baseline ACTIVE phải có source reference.",
      });
  });

export const activityMetricSchema = z.object({
  consumerId: z.string().uuid(),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Kỳ phải có dạng YYYY-MM."),
  metricCode: z.string().trim().min(2).max(100),
  value: z.number().finite().nonnegative(),
  unit: z.string().trim().min(1).max(40),
  source: z.string().trim().min(2).max(120).default("MANUAL"),
  sourceRef: optionalText(1000),
  quality: z.enum(["GOOD", "ESTIMATED", "MISSING", "INVALID", "REPORTED"]).default("REPORTED"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const activityMetricPatchSchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  metricCode: z.string().trim().min(2).max(100).optional(),
  value: z.number().finite().nonnegative().optional(),
  unit: z.string().trim().min(1).max(40).optional(),
  source: z.string().trim().min(2).max(120).optional(),
  sourceRef: optionalText(1000),
  quality: z.enum(["GOOD", "ESTIMATED", "MISSING", "INVALID", "REPORTED"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const savingMeasureSchema = z
  .object({
    consumerId: z.string().uuid(),
    baselineId: z.string().uuid().nullable().optional(),
    measureCode: z.string().trim().min(2).max(100).default("GENERAL"),
    name: z.string().trim().min(2).max(250),
    status: z
      .enum([
        "PROPOSED",
        "PLANNED",
        "IMPLEMENTED",
        "COMPLETED",
        "VERIFIED",
        "CANCELLED",
        "ARCHIVED",
      ])
      .default("PROPOSED"),
    estimatedSavingKwhYear: z.number().finite().nonnegative().nullable().optional(),
    actualSavingKwhYear: z.number().finite().nonnegative().nullable().optional(),
    savingRatePct: z.number().finite().min(0).max(100).nullable().optional(),
    investmentCost: z.number().finite().nonnegative().nullable().optional(),
    targetCompletionAt: nullableDateTimeString,
    sourceRef: optionalText(1000),
    evidenceRef: optionalText(1000),
    verifiedBy: optionalText(200),
    verifiedAt: nullableDateTimeString,
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((value, context) => {
    if (
      value.status === "VERIFIED" &&
      (value.actualSavingKwhYear == null || !value.evidenceRef || !value.verifiedBy)
    ) {
      context.addIssue({
        code: "custom",
        path: ["evidenceRef"],
        message: "Measure VERIFIED cần actual saving, evidence và người xác nhận.",
      });
    }
  });

export const savingMeasurePatchSchema = z.object({
  baselineId: z.string().uuid().nullable().optional(),
  measureCode: z.string().trim().min(2).max(100).optional(),
  name: z.string().trim().min(2).max(250).optional(),
  status: z
    .enum(["PROPOSED", "PLANNED", "IMPLEMENTED", "COMPLETED", "VERIFIED", "CANCELLED", "ARCHIVED"])
    .optional(),
  estimatedSavingKwhYear: z.number().finite().nonnegative().nullable().optional(),
  actualSavingKwhYear: z.number().finite().nonnegative().nullable().optional(),
  savingRatePct: z.number().finite().min(0).max(100).nullable().optional(),
  investmentCost: z.number().finite().nonnegative().nullable().optional(),
  targetCompletionAt: nullableDateTimeString,
  sourceRef: optionalText(1000),
  evidenceRef: optionalText(1000),
  verifiedBy: optionalText(200),
  verifiedAt: nullableDateTimeString,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const benchmarkSchema = z
  .object({
    sector: z.string().trim().min(2).max(150),
    consumerGroup: consumerGroupEnum.nullable().optional(),
    metricCode: z.string().trim().min(2).max(100),
    benchmarkValue: z.number().finite().nonnegative(),
    unit: z.string().trim().min(1).max(40),
    lowerBound: z.number().finite().nonnegative().nullable().optional(),
    upperBound: z.number().finite().nonnegative().nullable().optional(),
    methodVersion: z.string().trim().min(1).max(60),
    validFrom: dateTimeString,
    validTo: nullableDateTimeString,
    sourceRef: optionalText(1000),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((value, context) => {
    if (value.validTo && new Date(value.validTo).getTime() < new Date(value.validFrom).getTime())
      context.addIssue({
        code: "custom",
        path: ["validTo"],
        message: "Ngày kết thúc phải sau ngày bắt đầu.",
      });
    if (value.upperBound != null && value.lowerBound != null && value.upperBound < value.lowerBound)
      context.addIssue({
        code: "custom",
        path: ["upperBound"],
        message: "Upper bound phải lớn hơn hoặc bằng lower bound.",
      });
    if (value.status === "ACTIVE" && !value.sourceRef)
      context.addIssue({
        code: "custom",
        path: ["sourceRef"],
        message: "Benchmark ACTIVE phải có source reference.",
      });
  });

export const benchmarkPatchSchema = z.object({
  sector: z.string().trim().min(2).max(150).optional(),
  consumerGroup: consumerGroupEnum.nullable().optional(),
  metricCode: z.string().trim().min(2).max(100).optional(),
  benchmarkValue: z.number().finite().nonnegative().optional(),
  unit: z.string().trim().min(1).max(40).optional(),
  lowerBound: z.number().finite().nonnegative().nullable().optional(),
  upperBound: z.number().finite().nonnegative().nullable().optional(),
  methodVersion: z.string().trim().min(1).max(60).optional(),
  validFrom: dateTimeString.optional(),
  validTo: nullableDateTimeString,
  sourceRef: optionalText(1000),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ConsumerInput = z.infer<typeof consumerSchema>;
export type ConsumerPatchInput = z.infer<typeof consumerPatchSchema>;
export type ClassificationHistoryInput = z.infer<typeof classificationHistorySchema>;
export type SmartMeterInput = z.infer<typeof smartMeterSchema>;
export type SmartMeterPatchInput = z.infer<typeof smartMeterPatchSchema>;
export type MeterEventInput = z.infer<typeof meterEventSchema>;
export type MeterReadingInput = z.infer<typeof meterReadingSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
export type ReportLineInput = z.infer<typeof reportLineSchema>;
export type RuleSetInput = z.infer<typeof ruleSetSchema>;
export type RuleInput = z.infer<typeof ruleSchema>;
export type BaselineInput = z.infer<typeof baselineSchema>;
export type BaselineDeriveInput = z.infer<typeof baselineDeriveSchema>;
export type ActivityMetricInput = z.infer<typeof activityMetricSchema>;
export type SavingMeasureInput = z.infer<typeof savingMeasureSchema>;
export type BenchmarkInput = z.infer<typeof benchmarkSchema>;
