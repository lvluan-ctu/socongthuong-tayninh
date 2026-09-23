import { z } from 'zod';

export const substationFormSchema = z.object({
  code: z.string().min(2, 'Mã trạm tối thiểu 2 ký tự').max(50),
  name: z.string().min(3, 'Tên trạm tối thiểu 3 ký tự').max(200),
  status: z.enum(['ACTIVE', 'PLANNED', 'MAINTENANCE', 'INACTIVE', 'DECOMMISSIONED']),
  voltageLevelKv: z.number().positive('Điện áp phải lớn hơn 0'),
  substationType: z.enum(['AIS', 'GIS', 'COMPACT', 'DISTRIBUTION', 'OTHER']),
  designedCapacityMva: z.number().positive('Công suất thiết kế phải lớn hơn 0'),
  installedCapacityMva: z.number().positive('Công suất lắp đặt phải lớn hơn 0'),
  currentLoadMva: z.number().nonnegative('Tải hiện tại không được âm'),
  operator: z.string().trim().min(2, 'Nhập đơn vị vận hành').max(200),
  commissionedAt: z.string().min(1, 'Chọn ngày đưa vào sử dụng').refine((value) => !Number.isNaN(new Date(`${value}T00:00:00+07:00`).getTime()), 'Ngày đưa vào sử dụng không hợp lệ'),
  siteCode: z.string().trim().min(2, 'Nhập mã địa điểm').max(80),
  address: z.string().trim().min(3, 'Nhập địa chỉ trạm').max(500),
  adminAreaCode: z.string().trim().min(1, 'Chọn khu vực hành chính').max(100),
  latitude: z.number().min(-90, 'Latitude phải từ -90 đến 90').max(90, 'Latitude phải từ -90 đến 90'),
  longitude: z.number().min(-180, 'Longitude phải từ -180 đến 180').max(180, 'Longitude phải từ -180 đến 180'),
}).superRefine((value, context) => {
  if (value.currentLoadMva > value.installedCapacityMva * 1.5) {
    context.addIssue({ code: 'custom', path: ['currentLoadMva'], message: 'Tải hiện tại vượt 150% công suất lắp đặt; hãy kiểm tra lại đơn vị hoặc số liệu.' });
  }
  if (value.commissionedAt > new Date().toISOString().slice(0, 10) && value.status === 'ACTIVE') {
    context.addIssue({ code: 'custom', path: ['commissionedAt'], message: 'Trạm đang hoạt động không thể có ngày vận hành trong tương lai.' });
  }
});

export type SubstationFormValues = z.infer<typeof substationFormSchema>;
