// ─── Quản lý thị trường — Types ───────────────────────────────────────────
// Dựa trên biểu mẫu "Danh mục cá nhân, tổ chức" (Cục QLPTTTN)

/** Loại hình thực thể */
export type BusinessType = "company" | "household";

/** Trạng thái hoạt động */
export type BusinessStatus = "active" | "suspended" | "expired";

/** Lĩnh vực kinh doanh chính */
export type BusinessField =
  | "xang_dau"
  | "gas"
  | "phan_bon"
  | "hoa_chat"
  | "thuc_pham"
  | "thuong_mai"
  | "xay_dung"
  | "dich_vu"
  | "khac";

export const FIELD_LABELS: Record<BusinessField, string> = {
  xang_dau: "Xăng dầu",
  gas: "Gas",
  phan_bon: "Phân bón",
  hoa_chat: "Hóa chất",
  thuc_pham: "Thực phẩm",
  thuong_mai: "Thương mại",
  xay_dung: "Xây dựng",
  dich_vu: "Dịch vụ",
  khac: "Khác",
};

/** Trạng thái giấy phép */
export type LicenseStatus = "valid" | "expiring" | "expired";

/** Trạng thái vi phạm */
export type ViolationStatus = "pending" | "resolved" | "appealing";

// ─── Doanh nghiệp / Hộ kinh doanh ─────────────────────────────────────────

export interface Business {
  id: string;
  type: BusinessType;
  name: string;
  taxCode: string;
  representative: string;
  phone?: string;
  gender?: "Nam" | "Nữ";
  birthDate?: string;
  nationality: string;
  idIssueDate?: string;
  idIssuePlace?: string;
  occupation?: string;

  // Giấy phép kinh doanh
  gcnNumber?: string;
  gcnIssueDate?: string;
  gcnIssuePlace?: string;
  gcnExpiryDate?: string;

  // Địa chỉ
  province: string;
  district: string;
  ward: string;
  street?: string;
  houseNumber?: string;

  // Kinh doanh
  field: BusinessField;
  mainProduct: string;
  subProduct?: string;
  businessForm: string;
  status: BusinessStatus;

  // GIS
  lat: number;
  lng: number;

  // Liên kết
  licenses: License[];
  violations: Violation[];
}

// ─── Giấy phép ─────────────────────────────────────────────────────────────

export interface License {
  id: string;
  type: string;
  number: string;
  issueDate: string;
  expiryDate: string;
  issuedBy: string;
  status: LicenseStatus;
  fileUrl?: string;
}

// ─── Vi phạm ───────────────────────────────────────────────────────────────

export interface Violation {
  id: string;
  businessId: string;
  date: string;
  content: string;
  handlingResult: string;
  fineAmount?: number;
  inspectorName: string;
  status: ViolationStatus;
}

// ─── Cán bộ kiểm tra ──────────────────────────────────────────────────────

export interface Inspector {
  id: string;
  name: string;
  rank: string;
  department: string;
  phone?: string;
}
