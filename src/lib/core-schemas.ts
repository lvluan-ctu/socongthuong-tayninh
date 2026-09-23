import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const code = (label: string, max = 100) => z.string().trim().min(2, `${label} phải có ít nhất 2 ký tự.`).max(max).regex(/^[A-Za-z0-9][A-Za-z0-9_\-./]*$/, `${label} chỉ được chứa chữ, số, _, -, ., /.`);
const optionalDateTime = z.string().trim().max(80).refine((value) => !value || !Number.isNaN(new Date(value).getTime()), 'Thời điểm cập nhật nguồn không hợp lệ.').nullable().optional();

const email = z.string().trim().max(250).refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Email không hợp lệ.').nullable().optional();

export const partySchema = z.object({
  partyType: z.string().trim().min(2, 'Loại Party là bắt buộc.').max(80),
  code: code('Mã Party'),
  name: z.string().trim().min(2, 'Tên Party là bắt buộc.').max(250),
  taxCode: optionalText(50),
  phone: optionalText(50),
  email,
  address: optionalText(500),
  adminAreaCode: optionalText(50),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED']).default('ACTIVE'),
  classification: z.enum(['PUBLIC', 'INTERNAL', 'RESTRICTED', 'CONFIDENTIAL']).default('INTERNAL'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const partyPatchSchema = partySchema.partial();

const siteBaseSchema = z.object({
  partyId: z.string().uuid('Party không hợp lệ.').nullable().optional(),
  code: code('Mã Site'),
  name: z.string().trim().min(2, 'Tên Site là bắt buộc.').max(250),
  siteType: z.string().trim().min(2, 'Loại Site là bắt buộc.').max(100),
  address: optionalText(500),
  adminAreaCode: optionalText(50),
  latitude: z.number().finite().min(-90, 'Latitude phải trong khoảng -90 đến 90.').max(90, 'Latitude phải trong khoảng -90 đến 90.').nullable().optional(),
  longitude: z.number().finite().min(-180, 'Longitude phải trong khoảng -180 đến 180.').max(180, 'Longitude phải trong khoảng -180 đến 180.').nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).default('ACTIVE'),
  classification: z.enum(['PUBLIC', 'INTERNAL', 'RESTRICTED', 'CONFIDENTIAL']).default('INTERNAL'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function validateCoordinates(value: { latitude?: number | null; longitude?: number | null }, context: z.RefinementCtx) {
  const hasLatitude = value.latitude != null;
  const hasLongitude = value.longitude != null;
  if (hasLatitude !== hasLongitude) {
    context.addIssue({ code: 'custom', path: [hasLatitude ? 'longitude' : 'latitude'], message: 'Phải nhập đồng thời Latitude và Longitude.' });
  }
}

export const siteSchema = siteBaseSchema.superRefine(validateCoordinates);
export const sitePatchSchema = siteBaseSchema.partial().superRefine(validateCoordinates);

export const dataSourceSchema = z.object({
  code: code('Mã nguồn dữ liệu'),
  name: z.string().trim().min(2, 'Tên nguồn dữ liệu là bắt buộc.').max(250),
  provider: z.string().trim().min(2, 'Provider là bắt buộc.').max(150),
  sourceType: z.string().trim().min(2, 'Source type là bắt buộc.').max(100),
  owner: optionalText(200),
  endpointRef: optionalText(1000),
  schedule: optionalText(150),
  refreshCadence: optionalText(150),
  authoritativeLevel: z.enum(['AUTHORITATIVE', 'REFERENCE', 'DERIVED', 'UNKNOWN']).default('REFERENCE'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PAUSED', 'DEPRECATED']).default('ACTIVE'),
  classification: z.enum(['PUBLIC', 'INTERNAL', 'RESTRICTED', 'CONFIDENTIAL']).default('INTERNAL'),
  sourceVersion: optionalText(100),
  lastSourceUpdatedAt: optionalDateTime,
  config: z.record(z.string(), z.unknown()).optional(),
});

export const dataSourcePatchSchema = dataSourceSchema.partial();

export const commandCenterFilterSchema = z.object({
  year: z.string().regex(/^\d{4}$/, 'Năm phải có 4 chữ số.'),
  adminArea: z.string().trim().max(50),
  mission: z.enum(['ALL', 'grid', 'generation', 'rooftop-solar', 'efficiency', 'grid-safety', 'carbon', 'ev-charging']),
  sourceQuality: z.enum(['ALL', 'HAS_PROVENANCE', 'MISSING_PROVENANCE']),
});
