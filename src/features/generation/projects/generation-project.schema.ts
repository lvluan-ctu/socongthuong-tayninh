import { z } from 'zod';

const optionalNumberText = z.string().trim().refine(
  (value) => value === '' || (Number.isFinite(Number(value)) && Number(value) >= 0),
  'Giá trị phải là số không âm',
);

const requiredPositiveNumberText = z.string().trim().min(1, 'Bắt buộc nhập').refine(
  (value) => Number.isFinite(Number(value)) && Number(value) > 0,
  'Giá trị phải lớn hơn 0',
);

const requiredLatitude = z.string().trim().min(1, 'Nhập latitude để hiển thị dự án trên GIS').refine(
  (value) => Number.isFinite(Number(value)) && Number(value) >= -90 && Number(value) <= 90,
  'Latitude phải từ -90 đến 90',
);

const requiredLongitude = z.string().trim().min(1, 'Nhập longitude để hiển thị dự án trên GIS').refine(
  (value) => Number.isFinite(Number(value)) && Number(value) >= -180 && Number(value) <= 180,
  'Longitude phải từ -180 đến 180',
);

export const generationProjectFormSchema = z.object({
  code: z.string().trim().min(2, 'Mã dự án tối thiểu 2 ký tự').max(80),
  name: z.string().trim().min(3, 'Tên dự án tối thiểu 3 ký tự').max(250),
  sourceType: z.enum(['SOLAR', 'WIND', 'HYDRO', 'BIOMASS', 'WASTE_TO_ENERGY', 'LNG', 'OTHER']),
  designedCapacityMw: requiredPositiveNumberText,
  actualCapacityMw: optionalNumberText,
  operationStatus: z.enum(['PLANNED', 'PREPARING_INVESTMENT', 'CONSTRUCTION', 'OPERATING', 'SUSPENDED', 'DECOMMISSIONED']),
  commissionedAt: z.string().trim().optional().default(''),
  investorCode: z.string().trim().min(2, 'Nhập mã chủ đầu tư').max(80),
  investorName: z.string().trim().min(2, 'Nhập tên chủ đầu tư').max(250),
  operatorCode: z.string().trim().max(80).optional().default(''),
  operatorName: z.string().trim().max(250).optional().default(''),
  siteCode: z.string().trim().min(2, 'Nhập mã địa điểm').max(80),
  siteName: z.string().trim().min(2, 'Nhập tên địa điểm').max(250),
  address: z.string().trim().min(3, 'Nhập địa chỉ dự án').max(500),
  adminAreaCode: z.string().trim().min(1, 'Nhập mã khu vực hành chính').max(50),
  latitude: requiredLatitude,
  longitude: requiredLongitude,
  gridConnectionAssetId: z.string().uuid('ID điểm đấu nối không hợp lệ').or(z.literal('')).optional().default(''),
  technology: z.string().trim().max(200).optional().default(''),
  unitCount: z.string().trim().refine((value) => value === '' || (Number.isInteger(Number(value)) && Number(value) >= 0), 'Số tổ máy phải là số nguyên không âm').optional().default(''),
  notes: z.string().trim().max(2000).optional().default(''),
}).superRefine((value, context) => {
  if (Boolean(value.operatorCode) !== Boolean(value.operatorName)) {
    const path = value.operatorCode ? ['operatorName'] : ['operatorCode'];
    context.addIssue({ code: 'custom', path, message: 'Phải nhập đồng thời mã và tên đơn vị vận hành.' });
  }
  if (value.operationStatus === 'OPERATING' && !value.commissionedAt) {
    context.addIssue({ code: 'custom', path: ['commissionedAt'], message: 'Dự án đang vận hành phải có ngày vận hành.' });
  }
  if (value.operationStatus === 'OPERATING' && value.actualCapacityMw === '') {
    context.addIssue({ code: 'custom', path: ['actualCapacityMw'], message: 'Dự án đang vận hành phải có công suất thực tế/khả dụng.' });
  }
  if (value.actualCapacityMw && Number(value.actualCapacityMw) > Number(value.designedCapacityMw) * 1.5) {
    context.addIssue({ code: 'custom', path: ['actualCapacityMw'], message: 'Công suất thực tế vượt 150% thiết kế; hãy kiểm tra lại số liệu hoặc đơn vị.' });
  }
});

export type GenerationProjectFormValues = z.infer<typeof generationProjectFormSchema>;
export type GenerationProjectFormInput = z.input<typeof generationProjectFormSchema>;

export function generationProjectApiPayload(values: GenerationProjectFormValues) {
  return {
    ...values,
    designedCapacityMw: Number(values.designedCapacityMw),
    actualCapacityMw: values.actualCapacityMw ? Number(values.actualCapacityMw) : null,
    latitude: values.latitude ? Number(values.latitude) : null,
    longitude: values.longitude ? Number(values.longitude) : null,
    unitCount: values.unitCount ? Number(values.unitCount) : null,
    commissionedAt: values.commissionedAt || null,
    operatorCode: values.operatorCode || null,
    operatorName: values.operatorName || null,
    address: values.address || null,
    adminAreaCode: values.adminAreaCode || null,
    gridConnectionAssetId: values.gridConnectionAssetId || null,
    technology: values.technology || null,
    notes: values.notes || null,
  };
}
