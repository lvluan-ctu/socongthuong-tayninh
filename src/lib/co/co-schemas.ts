// Zod schemas cho C/O — dùng được cả client (form) và server (API).
import { z } from "zod";

export const coApplicationItemSchema = z.object({
  itemNumber: z.number().int().min(1),
  hsCode: z.string().min(4),
  description: z.string().min(1),
  quantity: z.number().min(0),
  unit: z.string().min(1),
  fobValue: z.number().min(0),
  originCriterion: z.string().min(1),
  countryOfOrigin: z.string().min(2),
  rvcPercentage: z.number().min(0).max(100).optional(),
  invoiceNumber: z.string().min(1),
  invoiceDate: z.string().min(1),
});

const partySchema = z.object({
  name: z.string().min(1, "Bắt buộc"),
  address: z.string().min(1, "Bắt buộc"),
  country: z.string().min(2, "Mã nước (2 ký tự)"),
});

export const coCreateSchema = z.object({
  formCode: z.string().min(1, "Chọn mẫu C/O"),
  ftaCode: z.string().min(1, "Chọn FTA"),
  certificateType: z.enum(["CO", "SELF_CERT"]).default("CO"),
  exporter: partySchema.extend({ taxCode: z.string().min(1, "Bắt buộc") }),
  consignee: partySchema,
  transport: z.object({
    departureDate: z.string().min(1, "Chọn ngày xuất khẩu"),
    vessel: z.string().default(""),
    portLoading: z.string().default(""),
    portDischarge: z.string().default(""),
  }),
  items: z.array(coApplicationItemSchema).min(1, "Cần ít nhất 1 mặt hàng"),
  declaration: z.object({
    exportingCountry: z.string().min(1, "Bắt buộc"),
    importingCountry: z.string().min(1, "Bắt buộc"),
    signDate: z.string().default(""),
    signerName: z.string().default(""),
  }),
  dataSource: z.enum(["MANUAL", "ECOSYS", "FILE_IMPORT"]).default("MANUAL"),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type CoCreateInput = z.input<typeof coCreateSchema>;

export const coUpdateSchema = coCreateSchema.partial().extend({
  status: z
    .enum([
      "DRAFT",
      "SUBMITTED",
      "PROCESSING",
      "RETURNED",
      "APPROVED",
      "REJECTED",
      "ISSUED",
      "CANCELLED",
    ])
    .optional(),
  reviewerNote: z.string().nullable().optional(),
  coNumber: z.string().nullable().optional(),
  coIssuedDate: z.string().nullable().optional(),
  approvedBy: z.string().nullable().optional(),
});

export const coTransitionSchema = z.object({
  action: z.enum(["SUBMIT", "ACCEPT", "RETURN", "APPROVE", "REJECT", "ISSUE", "CANCEL"]),
  by: z.string().min(1).default("Chuyên viên C/O"),
  note: z.string().optional(),
  approvedBy: z.string().optional(),
  signerName: z.string().optional(),
});

export const coSelfAssessmentSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      met: z.boolean(),
      note: z.string().optional(),
    }),
  ),
  assessedBy: z.string().min(1),
  assessedAt: z.string().min(1),
});
