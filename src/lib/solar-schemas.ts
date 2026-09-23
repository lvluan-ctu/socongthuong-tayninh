import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const optionalUuid = z.string().uuid().nullable().optional();
const dateText = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không đúng định dạng.")
  .or(z.literal(""))
  .nullable()
  .optional();
const sourceEnum = z.string().trim().min(2, "Nguồn phải có ít nhất 2 ký tự.").max(80);
const solarResourceSourceEnum = z
  .string()
  .trim()
  .min(2, "Nguồn bức xạ phải có ít nhất 2 ký tự.")
  .max(80);

function isPosition(value: unknown): value is [number, number, ...number[]] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

function isRing(value: unknown): value is unknown[] {
  if (!Array.isArray(value) || value.length < 4 || !value.every(isPosition)) return false;
  const first = value[0];
  const last = value[value.length - 1];
  return (
    Array.isArray(first) && Array.isArray(last) && first[0] === last[0] && first[1] === last[1]
  );
}

export const geoJsonPolygonSchema = z
  .object({
    type: z.enum(["Polygon", "MultiPolygon"]),
    coordinates: z.unknown(),
  })
  .superRefine((value, ctx) => {
    const valid =
      value.type === "Polygon"
        ? Array.isArray(value.coordinates) &&
          value.coordinates.length > 0 &&
          value.coordinates.every(isRing)
        : Array.isArray(value.coordinates) &&
          value.coordinates.length > 0 &&
          value.coordinates.every(
            (polygon) => Array.isArray(polygon) && polygon.length > 0 && polygon.every(isRing),
          );
    if (!valid)
      ctx.addIssue({
        code: "custom",
        path: ["coordinates"],
        message: "Polygon/MultiPolygon phải có vòng tọa độ hợp lệ và đóng kín.",
      });
  });

const optionalGeoJsonPolygon = geoJsonPolygonSchema.nullable().optional();

export const roofSurfaceSchema = z
  .object({
    buildingAssetId: z.string().uuid("Cần chọn công trình có trong Asset Registry."),
    code: z.string().trim().min(2, "Mã bề mặt mái phải có ít nhất 2 ký tự.").max(100),
    geometry: optionalGeoJsonPolygon,
    solarResourceZoneId: optionalUuid,
    areaM2: z.number().positive("Diện tích mái phải lớn hơn 0."),
    usableAreaM2: z.number().nonnegative("Diện tích khả dụng không được âm.").nullable().optional(),
    tiltDeg: z.number().min(0).max(90, "Góc mái phải từ 0 đến 90 độ.").nullable().optional(),
    azimuthDeg: z.number().min(0).max(360, "Azimuth phải từ 0 đến 360 độ.").nullable().optional(),
    material: optionalText(120),
    shadingFactor: z
      .number()
      .min(0.1, "Shading factor phải từ 0.1 đến 1.")
      .max(1, "Shading factor phải từ 0.1 đến 1.")
      .nullable()
      .optional(),
    source: sourceEnum,
    sourceCapturedAt: dateText,
    sourceResolutionM: z
      .number()
      .nonnegative("Độ phân giải nguồn không được âm.")
      .nullable()
      .optional(),
    confidence: z
      .number()
      .min(0, "Độ tin cậy phải từ 0 đến 100.")
      .max(100, "Độ tin cậy phải từ 0 đến 100.")
      .nullable()
      .optional(),
    obstructionRatioPct: z
      .number()
      .min(0)
      .max(100, "Tỷ lệ che khuất phải từ 0 đến 100%.")
      .nullable()
      .optional(),
    structuralSuitabilityStatus: z
      .enum(["UNKNOWN", "SUITABLE", "REQUIRES_INSPECTION", "UNSUITABLE"])
      .nullable()
      .optional(),
    orientationQuality: z.enum(["UNKNOWN", "GOOD", "FAIR", "POOR"]).nullable().optional(),
    sourceRef: optionalText(250),
    status: z.enum(["ACTIVE", "ARCHIVED"]).default("ACTIVE"),
    lastVerifiedAt: dateText,
  })
  .superRefine((value, ctx) => {
    if (value.usableAreaM2 != null && value.usableAreaM2 > value.areaM2) {
      ctx.addIssue({
        code: "custom",
        path: ["usableAreaM2"],
        message: "Diện tích khả dụng không thể lớn hơn diện tích bề mặt mái.",
      });
    }
    if (
      value.source &&
      !["MANUAL", "MANUAL_SURVEY"].includes(value.source) &&
      !value.sourceRef?.trim()
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceRef"],
        message: "Nguồn ngoài thủ công phải có source reference để truy vết.",
      });
    }
  });

export const solarResourceZoneSchema = z
  .object({
    code: z.string().trim().min(2, "Mã vùng bức xạ phải có ít nhất 2 ký tự.").max(100),
    name: z.string().trim().min(2, "Tên vùng bức xạ phải có ít nhất 2 ký tự.").max(250),
    boundary: optionalGeoJsonPolygon,
    annualGhiKwhM2: z.number().positive("GHI năm phải lớn hơn 0."),
    annualDniKwhM2: z.number().nonnegative("DNI năm không được âm.").nullable().optional(),
    annualDhiKwhM2: z.number().nonnegative("DHI năm không được âm.").nullable().optional(),
    referenceTiltDeg: z
      .number()
      .min(0)
      .max(90, "Góc nghiêng tham chiếu phải từ 0 đến 90 độ.")
      .nullable()
      .optional(),
    referenceAzimuthDeg: z
      .number()
      .min(0)
      .max(360, "Azimuth tham chiếu phải từ 0 đến 360 độ.")
      .nullable()
      .optional(),
    source: solarResourceSourceEnum,
    sourceVersion: z.string().trim().min(1, "Cần lưu phiên bản nguồn bức xạ.").max(100),
    sourceRef: optionalText(250),
    measuredFrom: dateText,
    measuredTo: dateText,
    quality: z.enum(["GOOD", "ESTIMATED", "SUSPECT", "MISSING"]),
    confidence: z.number().min(0).max(100).nullable().optional(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).default("ACTIVE"),
  })
  .superRefine((value, ctx) => {
    if (value.measuredFrom && value.measuredTo && value.measuredFrom > value.measuredTo) {
      ctx.addIssue({
        code: "custom",
        path: ["measuredTo"],
        message: "Ngày kết thúc phải sau ngày bắt đầu.",
      });
    }
    if (value.source && value.source !== "MANUAL" && !value.sourceRef?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceRef"],
        message: "Nguồn bức xạ ngoài thủ công phải có source reference.",
      });
    }
  });

export const roofSurfacePatchSchema = z
  .object({
    buildingAssetId: z.string().uuid().optional(),
    code: z.string().trim().min(2).max(100).optional(),
    geometry: geoJsonPolygonSchema.nullable().optional(),
    solarResourceZoneId: z.string().uuid().nullable().optional(),
    areaM2: z.number().positive().optional(),
    usableAreaM2: z.number().nonnegative().nullable().optional(),
    tiltDeg: z.number().min(0).max(90).nullable().optional(),
    azimuthDeg: z.number().min(0).max(360).nullable().optional(),
    material: z.string().trim().max(120).nullable().optional(),
    shadingFactor: z.number().min(0.1).max(1).nullable().optional(),
    source: sourceEnum.optional(),
    sourceCapturedAt: dateText,
    sourceResolutionM: z.number().nonnegative().nullable().optional(),
    confidence: z.number().min(0).max(100).nullable().optional(),
    obstructionRatioPct: z.number().min(0).max(100).nullable().optional(),
    structuralSuitabilityStatus: z
      .enum(["UNKNOWN", "SUITABLE", "REQUIRES_INSPECTION", "UNSUITABLE"])
      .nullable()
      .optional(),
    orientationQuality: z.enum(["UNKNOWN", "GOOD", "FAIR", "POOR"]).nullable().optional(),
    sourceRef: z.string().trim().max(250).nullable().optional(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
    lastVerifiedAt: dateText,
  })
  .superRefine((value, ctx) => {
    if (value.areaM2 != null && value.usableAreaM2 != null && value.usableAreaM2 > value.areaM2) {
      ctx.addIssue({
        code: "custom",
        path: ["usableAreaM2"],
        message: "Diện tích khả dụng không thể lớn hơn diện tích bề mặt mái.",
      });
    }
    if (
      value.source &&
      !["MANUAL", "MANUAL_SURVEY"].includes(value.source) &&
      !value.sourceRef?.trim()
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceRef"],
        message: "Nguồn ngoài thủ công phải có source reference để truy vết.",
      });
    }
  });

export const solarResourceZonePatchSchema = z
  .object({
    code: z.string().trim().min(2).max(100).optional(),
    name: z.string().trim().min(2).max(250).optional(),
    boundary: geoJsonPolygonSchema.nullable().optional(),
    annualGhiKwhM2: z.number().positive().optional(),
    annualDniKwhM2: z.number().nonnegative().nullable().optional(),
    annualDhiKwhM2: z.number().nonnegative().nullable().optional(),
    referenceTiltDeg: z.number().min(0).max(90).nullable().optional(),
    referenceAzimuthDeg: z.number().min(0).max(360).nullable().optional(),
    source: solarResourceSourceEnum.optional(),
    sourceVersion: z.string().trim().min(1).max(100).optional(),
    sourceRef: z.string().trim().max(250).nullable().optional(),
    measuredFrom: dateText,
    measuredTo: dateText,
    quality: z.enum(["GOOD", "ESTIMATED", "SUSPECT", "MISSING"]).optional(),
    confidence: z.number().min(0).max(100).nullable().optional(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.measuredFrom && value.measuredTo && value.measuredFrom > value.measuredTo) {
      ctx.addIssue({
        code: "custom",
        path: ["measuredTo"],
        message: "Ngày kết thúc phải sau ngày bắt đầu.",
      });
    }
    if (value.source && value.source !== "MANUAL" && !value.sourceRef?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceRef"],
        message: "Nguồn bức xạ ngoài thủ công phải có source reference.",
      });
    }
  });

export const solarGisLookupSchema = z
  .object({
    customerCode: z.string().trim().max(100).optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const hasCustomerCode = Boolean(value.customerCode?.trim());
    const hasLatitude = value.latitude != null;
    const hasLongitude = value.longitude != null;
    if (!hasCustomerCode && !hasLatitude && !hasLongitude) {
      ctx.addIssue({
        code: "custom",
        path: ["customerCode"],
        message: "Nhập mã khách hàng hoặc cặp tọa độ để mở context GIS.",
      });
    }
    if (hasLatitude !== hasLongitude) {
      ctx.addIssue({
        code: "custom",
        path: ["longitude"],
        message: "Latitude và longitude phải được nhập cùng nhau.",
      });
    }
  });

const rooftopSystemBaseSchema = z.object({
  code: z.string().trim().min(2, "Mã hệ thống phải có ít nhất 2 ký tự.").max(100),
  name: z.string().trim().min(2, "Tên hệ thống phải có ít nhất 2 ký tự.").max(250),
  customerAccountId: z.string().uuid("Cần chọn khách hàng EVN."),
  buildingAssetId: optionalUuid,
  roofSurfaceId: optionalUuid,
  installedCapacityKwp: z.number().positive("Công suất lắp đặt phải lớn hơn 0."),
  inverterCapacityKw: z
    .number()
    .positive("Công suất inverter phải lớn hơn 0.")
    .nullable()
    .optional(),
  batteryCapacityKwh: z.number().nonnegative("Dung lượng pin không được âm.").nullable().optional(),
  gridConnectionAssetId: optionalUuid,
  commissionedAt: dateText,
  operationStatus: z.enum([
    "ACTIVE",
    "INSTALLING",
    "MAINTENANCE",
    "OFFLINE",
    "PLANNED",
    "DECOMMISSIONED",
    "DELETED",
  ]),
  ownershipModel: optionalText(80),
  installationType: z.enum(["ROOFTOP", "CARPORT", "MIXED", "OTHER"]),
  installerPartyId: optionalUuid,
  evRegistrationNo: optionalText(120),
  evnAcceptanceAt: dateText,
  meteringScheme: optionalText(100),
  exportLimitKw: z
    .number()
    .nonnegative("Giới hạn phát lên lưới không được âm.")
    .nullable()
    .optional(),
  annualYieldKwh: z.number().nonnegative("Sản lượng năm không được âm.").nullable().optional(),
  selfConsumptionPct: z
    .number()
    .min(0, "Tỷ lệ tự dùng phải từ 0 đến 100%.")
    .max(100, "Tỷ lệ tự dùng phải từ 0 đến 100%.")
    .nullable()
    .optional(),
  source: z.enum(["EVN", "MANUAL", "IMPORT", "API", "DEMO"]),
  sourceId: optionalUuid,
  sourceRef: optionalText(250),
  lastVerifiedAt: dateText,
  confidence: z
    .number()
    .min(0, "Độ tin cậy phải từ 0 đến 100.")
    .max(100, "Độ tin cậy phải từ 0 đến 100.")
    .nullable()
    .optional(),
});

export const rooftopSystemSchema = rooftopSystemBaseSchema.superRefine((value, ctx) => {
  if (value.operationStatus === "ACTIVE" && !value.commissionedAt) {
    ctx.addIssue({
      code: "custom",
      path: ["commissionedAt"],
      message: "Hệ đang vận hành phải có ngày vận hành.",
    });
  }
  if (value.operationStatus === "ACTIVE" && value.commissionedAt) {
    const commissionedAt = new Date(`${value.commissionedAt}T00:00:00.000Z`);
    if (!Number.isNaN(commissionedAt.getTime()) && commissionedAt.getTime() > Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["commissionedAt"],
        message: "Ngày vận hành không được nằm trong tương lai.",
      });
    }
  }
  if (value.source !== "MANUAL" && !value.sourceRef?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["sourceRef"],
      message: "Nguồn không thủ công phải có source reference để truy vết.",
    });
  }
});

export const rooftopSystemPatchSchema = rooftopSystemBaseSchema
  .partial()
  .superRefine((value, ctx) => {
    if (value.operationStatus === "ACTIVE" && value.commissionedAt === "") {
      ctx.addIssue({
        code: "custom",
        path: ["commissionedAt"],
        message: "Hệ đang vận hành phải có ngày vận hành.",
      });
    }
    if (value.operationStatus === "ACTIVE" && value.commissionedAt) {
      const commissionedAt = new Date(`${value.commissionedAt}T00:00:00.000Z`);
      if (!Number.isNaN(commissionedAt.getTime()) && commissionedAt.getTime() > Date.now()) {
        ctx.addIssue({
          code: "custom",
          path: ["commissionedAt"],
          message: "Ngày vận hành không được nằm trong tương lai.",
        });
      }
    }
    if (value.source && value.source !== "MANUAL" && !value.sourceRef?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceRef"],
        message: "Nguồn không thủ công phải có source reference để truy vết.",
      });
    }
  });

export const rooftopComponentSchema = z.object({
  componentType: z.enum(["PANEL", "INVERTER", "BATTERY", "METER", "OPTIMIZER", "OTHER"]),
  manufacturer: optionalText(160),
  model: optionalText(160),
  serialNumber: optionalText(160),
  quantity: z.number().int("Số lượng phải là số nguyên.").positive("Số lượng phải lớn hơn 0."),
  ratedPower: z.number().positive("Công suất định mức phải lớn hơn 0.").nullable().optional(),
  unit: optionalText(40),
  commissionedAt: dateText,
  warrantyUntil: dateText,
  source: z.enum(["EVN", "MANUAL", "IMPORT", "API", "DEMO"]),
  sourceRef: optionalText(250),
});

const rooftopGenerationBaseSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Kỳ phải có dạng YYYY-MM."),
  energyGeneratedKwh: z.number().nonnegative("Sản lượng không được âm."),
  energySelfConsumedKwh: z
    .number()
    .nonnegative("Điện tự dùng không được âm.")
    .nullable()
    .optional(),
  energyExportedKwh: z
    .number()
    .nonnegative("Điện phát lên lưới không được âm.")
    .nullable()
    .optional(),
  energyImportedKwh: z.number().nonnegative("Điện mua vào không được âm.").nullable().optional(),
  peakGenerationKw: z.number().nonnegative("Công suất đỉnh không được âm.").nullable().optional(),
  source: z.enum(["EVN", "MANUAL", "IMPORT", "API", "DEMO"]),
  sourceId: optionalUuid,
  sourceRef: optionalText(250),
  quality: z.enum(["GOOD", "ESTIMATED", "SUSPECT", "MISSING"]),
});

export const rooftopGenerationSchema = rooftopGenerationBaseSchema.superRefine((value, ctx) => {
  if (
    value.energySelfConsumedKwh != null &&
    value.energySelfConsumedKwh > value.energyGeneratedKwh
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["energySelfConsumedKwh"],
      message: "Điện tự dùng không thể lớn hơn tổng sản lượng.",
    });
  }
  if (
    value.energyExportedKwh != null &&
    value.energySelfConsumedKwh != null &&
    value.energyExportedKwh + value.energySelfConsumedKwh > value.energyGeneratedKwh * 1.01
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["energyExportedKwh"],
      message: "Tự dùng + phát lên lưới vượt quá tổng sản lượng.",
    });
  }
});

export const rooftopGenerationPatchSchema = rooftopGenerationBaseSchema
  .partial()
  .superRefine((value, ctx) => {
    if (
      value.energyGeneratedKwh != null &&
      value.energySelfConsumedKwh != null &&
      value.energySelfConsumedKwh > value.energyGeneratedKwh
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["energySelfConsumedKwh"],
        message: "Điện tự dùng không thể lớn hơn tổng sản lượng.",
      });
    }
    if (
      value.energyGeneratedKwh != null &&
      value.energyExportedKwh != null &&
      value.energySelfConsumedKwh != null &&
      value.energyExportedKwh + value.energySelfConsumedKwh > value.energyGeneratedKwh * 1.01
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["energyExportedKwh"],
        message: "Tự dùng + phát lên lưới vượt quá tổng sản lượng.",
      });
    }
  });

export const rooftopDocumentSchema = z.object({
  documentType: z.enum([
    "COMMISSIONING",
    "GRID_AGREEMENT",
    "EVN_RECORD",
    "EQUIPMENT_INVOICE",
    "WARRANTY",
    "INSPECTION",
    "TECHNICAL_OTHER",
  ]),
  documentNo: optionalText(120),
  title: z.string().trim().min(2, "Tên hồ sơ phải có ít nhất 2 ký tự.").max(250),
  issuedAt: dateText,
  fileRef: optionalText(500),
  source: z.enum(["EVN", "MANUAL", "IMPORT", "API", "DEMO"]),
  sourceRef: optionalText(250),
  notes: optionalText(2000),
});

export const customerGridServiceLinkSchema = z
  .object({
    customerAccountId: z.string().uuid("Cần chọn khách hàng EVN."),
    servicePointCode: z
      .string()
      .trim()
      .min(2, "Mã điểm cấp điện phải có ít nhất 2 ký tự.")
      .max(120),
    measurementPointId: optionalUuid,
    feederAssetId: optionalUuid,
    bayAssetId: optionalUuid,
    transformerAssetId: optionalUuid,
    substationAssetId: optionalUuid,
    validFrom: dateText,
    validTo: dateText,
    source: z.enum(["EVN", "MANUAL", "IMPORT", "API", "DEMO"]),
    sourceId: optionalUuid,
    sourceRef: optionalText(250),
    confidence: z.number().min(0).max(100).nullable().optional(),
    isInferred: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.validFrom && value.validTo && value.validFrom > value.validTo) {
      ctx.addIssue({
        code: "custom",
        path: ["validTo"],
        message: "Ngày kết thúc phải sau ngày bắt đầu.",
      });
    }
    if (
      !value.feederAssetId &&
      !value.bayAssetId &&
      !value.transformerAssetId &&
      !value.substationAssetId &&
      !value.isInferred
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["feederAssetId"],
        message: "Cần gắn ít nhất một tài sản lưới hoặc đánh dấu mapping suy luận.",
      });
    }
    if (value.isInferred && value.source === "EVN") {
      ctx.addIssue({
        code: "custom",
        path: ["source"],
        message: "Mapping suy luận không được khai báo là nguồn EVN chính thức.",
      });
    }
    if (value.source !== "MANUAL" && !value.sourceRef?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceRef"],
        message: "Mapping từ nguồn ngoài phải có source reference để truy vết.",
      });
    }
  });

export const solarAssessmentSchema = z.object({
  customerAccountId: z.string().uuid("Cần chọn khách hàng EVN."),
  usableRoofAreaM2: z.number().positive("Diện tích mái phải lớn hơn 0.").nullable(),
  irradiationKwhM2Year: z.number().positive("Cần nhập bức xạ từ nguồn đã xác định."),
  panelPowerW: z.number().positive("Công suất tấm pin phải theo datasheet."),
  panelAreaM2: z.number().positive("Diện tích tấm pin phải theo datasheet."),
  availableGridCapacityKw: z.number().nonnegative("Headroom không được âm.").nullable(),
  gridAssetId: optionalUuid,
  solarResourceZoneId: optionalUuid,
  targetSelfConsumptionSharePct: z.number().min(10).max(100).nullable(),
  policyMaxCapacityKwp: z
    .number()
    .positive("Giới hạn chính sách phải lớn hơn 0.")
    .nullable()
    .optional(),
  tiltDeg: z.number().min(0).max(90, "Góc mái phải từ 0 đến 90 độ.").nullable(),
  azimuthDeg: z.number().min(0).max(360, "Azimuth phải từ 0 đến 360 độ.").nullable(),
  shadingFactor: z.number().min(0.1).max(1, "Shading factor phải từ 0.1 đến 1.").nullable(),
  solarResourceRef: z
    .string()
    .trim()
    .min(2, "Cần lưu source reference cho dữ liệu bức xạ.")
    .max(250),
  solarResourceVersion: optionalText(100),
});

export const solarAssessmentReviewSchema = z
  .object({
    status: z.enum(["DRAFT", "REVIEWED", "APPROVED", "SUPERSEDED", "ARCHIVED"]),
    reviewedBy: z.string().trim().max(160).nullable().optional(),
    reviewNote: z.string().trim().max(2000).nullable().optional(),
    confidence: z.number().min(0).max(100).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (["REVIEWED", "APPROVED"].includes(value.status) && !value.reviewedBy?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["reviewedBy"],
        message: "Trạng thái review/approved phải có người duyệt.",
      });
    }
  });

export const solarAssessmentReviewPatchSchema = z
  .object({
    status: z.enum(["DRAFT", "REVIEWED", "APPROVED", "SUPERSEDED", "ARCHIVED"]).optional(),
    reviewedBy: z.string().trim().max(160).nullable().optional(),
    reviewNote: z.string().trim().max(2000).nullable().optional(),
    confidence: z.number().min(0).max(100).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.status &&
      ["REVIEWED", "APPROVED"].includes(value.status) &&
      !value.reviewedBy?.trim()
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["reviewedBy"],
        message: "Trạng thái review/approved phải có người duyệt.",
      });
    }
  });

export type RooftopSystemInput = z.infer<typeof rooftopSystemSchema>;
export type RoofSurfaceInput = z.infer<typeof roofSurfaceSchema>;
export type SolarResourceZoneInput = z.infer<typeof solarResourceZoneSchema>;
export type SolarGisLookupInput = z.infer<typeof solarGisLookupSchema>;
export type RooftopComponentInput = z.infer<typeof rooftopComponentSchema>;
export type RooftopGenerationInput = z.infer<typeof rooftopGenerationSchema>;
export type RooftopDocumentInput = z.infer<typeof rooftopDocumentSchema>;
export type CustomerGridServiceLinkInput = z.infer<typeof customerGridServiceLinkSchema>;
export type SolarAssessmentInput = z.infer<typeof solarAssessmentSchema>;
export type SolarAssessmentReviewInput = z.infer<typeof solarAssessmentReviewSchema>;
