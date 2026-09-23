// Kiểu dữ liệu dùng chung cho toàn nền tảng.
// MOCK DATA: các cấu trúc này được thiết kế để map 1-1 với REST API sau này.

export type DataStatus =
  "draft" | "checking" | "need_more" | "pending" | "approved" | "locked" | "published" | "error";

export interface ExpiringLicense {
  id: string;
  code: string;
  enterprise: string;
  district: string;
  expiresAt: string; // ISO date, ví dụ "2026-09-12"
}

export interface EnterpriseLicense {
  id: string;
  enterpriseId: string;
  code: string;
  type: string; // loại giấy phép, ví dụ "GP đăng ký kinh doanh"
  issuedAt: string; // ISO date — ngày cấp
  expiresAt: string; // ISO date — ngày hết hạn
  status: "valid" | "expiring" | "expired";
}

export interface Enterprise {
  id: string;
  name: string;
  taxCode: string;
  sector: string;
  district: string;
  address: string;
  representative: string;
  email: string;
  employees: number;
  revenue: number; // tỷ đồng
  status: "active" | "suspended" | "dissolved";
  dataStatus: DataStatus;
  updatedAt: string;
  source: string;
  owner: string;
  links: {
    facilities: number;
    products: number;
    licenses: number;
    projects: number;
    energy: number;
    trades: number;
    documents: number;
  };
}

// Ranh giới KCN/CCN dạng GeoJSON Polygon (tọa độ [lng, lat])
export interface ClusterGeometry {
  type: "Polygon";
  coordinates: number[][][];
}

// Chuỗi lịch sử đất công nghiệp toàn tỉnh (theo quý) — đầu vào cho AI dự báo nhu cầu.
export interface IndustryTrendRow {
  period: string; // ví dụ "Q1/2022"
  leasedHa: number; // đất CN đã cho thuê toàn tỉnh (ha)
  occupancy: number; // tỷ lệ lấp đầy bình quân (%)
  enterprises: number; // số doanh nghiệp/dự án trong các CCN hoạt động
}

export interface Cluster {
  id: string;
  name: string;
  district: string; // huyện/thị xã cũ (trước hợp nhất 1/7/2025) — để đối chiếu lịch sử
  ward: string; // xã/phường mới — cấp hành chính cơ sở trực thuộc tỉnh (chính quyền 2 cấp)
  area: number;
  leased: number;
  enterprises: number;
  sectors: string;
  occupancy: number;
  status: DataStatus;
  lat: number; // toạ độ GPS thực tế (tâm KCN/CCN)
  lng: number;
  geometry?: ClusterGeometry; // backend cần bổ sung – nhưng thiếu vẫn vẽ được từ lat/lng + area
  investor?: string; // chủ đầu tư hạ tầng (nếu có)
  infrastructure: { name: string; level: number; note: string }[];
}

// Vùng hành chính cấp xã/phường (chính quyền 2 cấp, NQ 1682/NQ-UBTVQH15) —
// lớp ngoài cùng của bản đồ GIS. Ranh giới là ước lượng (không có GeoJSON chính thức),
// vẽ polygon tượng trưng quanh tâm địa danh.
export interface WardZone {
  id: string;
  name: string;
  type: "xa" | "phuong";
  lat: number;
  lng: number;
  approxRadiusM: number; // bán kính ước lượng (m) — quy đổi từ diện tích tự nhiên
  clusters: string[]; // id các KCN/CCN thuộc vùng
  note?: string; // nguồn ghi chú
}

export interface Factory {
  id: string;
  name: string;
  sector: string;
  address: string;
  representative: string;
  area: number; // ha
  employees: number;
  products: string;
  revenue: number; // tỷ đồng
  status: "active" | "suspended" | "expanding";
  lat: number;
  lng: number;
  // Hồ sơ doanh nghiệp (backend bổ sung dần; field chưa có sẽ hiển thị "—")
  taxCode?: string;
  establishedAt?: string;
  legalType?: string;
  sectorSecondary?: string;
  investment?: number; // tỷ đồng
  ward?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export interface SurveyRecord {
  id: string;
  subject: string;
  district: string;
  officer: string;
  date: string;
  status: "new" | "doing" | "need_more" | "reviewed" | "approved";
}

export interface EnergySource {
  id: string;
  name: string;
  type: string;
  capacity: number; // MW
  output: number; // triệu kWh
  district: string;
  status: DataStatus;
}

export interface ProductRecord {
  id: string;
  name: string;
  group: string;
  market: string;
  standard: string;
  certificate: string;
  trend: number;
  status: DataStatus;
}

/** Sản phẩm chủ lực — mở rộng từ ProductRecord cho trang Quản lý thị trường. */
export interface MarketProduct extends ProductRecord {
  output?: number; // sản lượng quy đổi theo unit
  unit?: string; // đơn vị sản lượng
  price?: number; // đơn giá tham chiếu (USD theo priceUnit)
  priceUnit?: string; // đơn vị đơn giá
  facilities?: number; // số cơ sở SXKD
  ward?: string; // địa bàn sản xuất chính
}

/** Chỉ số giá theo nhóm hàng (100 = kỳ gốc) — đầu vào cho AI dự báo giá. */
export interface MarketPriceRow {
  period: string; // ví dụ "T1/2025"
  caoSu: number;
  duong: number;
  nongSan: number;
  detMay: number;
  coKhi: number;
}

/** Thị trường xuất khẩu chính của tỉnh. */
export interface MarketExportMarket {
  id: string;
  name: string;
  valueBilUsd: number; // kim ngạch (tỷ USD)
  sharePct: number; // tỷ trọng (%)
  growthPct: number; // tăng trưởng so cùng kỳ (%)
  mainProducts: string[];
  note?: string;
}

/** Cảnh báo diễn biến thị trường. */
export interface MarketAlert {
  id: string;
  title: string;
  group: string;
  level: "Cao" | "Trung bình" | "Thấp";
  since: string;
  detail: string;
  suggestion: string;
}

export interface TradeRecord {
  id: string;
  hs: string;
  name: string;
  enterprise: string;
  market: string;
  exportValue: number;
  importValue: number;
  period: string;
  hsGroup?: string;
  direction?: "XK" | "NK" | "Quá cảnh";
  gate?: string;
  growth?: number;
  value2025?: number;
  value2026?: number;
  status?: DataStatus;
  legalBasis?: string;
  note?: string;
}

export interface BorderGateRecord {
  id: string;
  name: string;
  level: "Cửa khẩu quốc tế" | "Cửa khẩu chính";
  district: string;
  country: string;
  value2026: number;
  growth: number;
  fee2026: number;
  declarations: number;
  transit2026: number;
  goods: string[];
  highlight: string;
  status: DataStatus;
  legalBasis?: string;
}

export interface PromotionProgram {
  id: string;
  name: string;
  organizer: string;
  time: string;
  enterprises: number;
  budget: number;
  result: string;
  status: DataStatus;
  kind:
    | "Hội chợ"
    | "Triển lãm"
    | "Kết nối giao thương"
    | "Khuyến mại"
    | "Hội thảo"
    | "Đoàn giao thương"
    | "TMĐT";
  /** Năm thực hiện chương trình. */
  year: number;
  /** Kỳ theo dõi (Q1..Q4, 6T, "Cả năm"). */
  quarter?: string;
  /** Thị trường/địa điểm tổ chức (trong nước hoặc quốc tế). */
  market?: string;
  /** Nguồn kinh phí: ngân sách nhà nước hay ngoài ngân sách. */
  fundSource?: "NSNN" | "Ngoài NS";
  /** Kinh phí thực tế giải ngân (nghìn USD). */
  actualBudget?: number;
  /** Kết quả: số hợp đồng/biên bản/đơn đặt hàng ước tính. */
  agreements?: number;
  /** Danh sách doanh nghiệp tham gia (id liên kết CSDL ngành). */
  participantIds?: string[];
  /** Căn cứ pháp lý gắn với chương trình. */
  legalBasis?: string;
  note?: string;
}

export interface MasterRecord {
  id: string;
  type: string;
  name: string;
  source: string;
  owner: string;
  updatedAt: string;
  status: DataStatus;
}

export interface QualityIssue {
  id: string;
  field: string;
  issue: string;
  records: number;
  severity: "Cao" | "Trung bình" | "Thấp";
  assignee: string;
  status: DataStatus;
}

export type IntegrationDirection = "in" | "out" | "both";

export interface IntegrationRow {
  id: string;
  code: string;
  system: string;
  description: string;
  vendor: string;
  purpose: string;
  direction: IntegrationDirection;
  method: "REST API" | "SOAP" | "Webhook" | "File transfer" | "ODBC" | "Kafka";
  endpoint: string;
  auth: "OAuth2" | "Token" | "Basic" | "VPN + IP allowlist" | "mTLS";
  frequency: string;
  dataTypes: string[];
  lastSync: string;
  nextSync: string;
  success: number;
  failed: number;
  latency: number;
  status: "connected" | "limited" | "error";
  owner: string;
  lastError?: string;
}

export interface IntegrationLog {
  id: string;
  time: string;
  system: string;
  code: string;
  action:
    | "Đồng bộ thành công"
    | "Đồng bộ thất bại"
    | "Đối soát"
    | "Kiểm tra kết nối"
    | "Cập nhật cấu hình";
  records: number;
  message: string;
  result: "SUCCESS" | "FAILED" | "INFO";
}

export interface DataFlow {
  id: string;
  name: string;
  description: string;
  direction: IntegrationDirection;
  source: string;
  target: string;
  dataTypes: string[];
  method: string;
  status: "connected" | "limited" | "error";
}

export interface UserRow {
  id: string;
  name: string;
  account: string;
  unit: string;
  role: string;
  lastLogin: string;
  status: "active" | "locked";
}

export interface AuditRow {
  id: string;
  time: string;
  user: string;
  action: string;
  module: string;
  object: string;
  ip: string;
  result: "SUCCESS" | "FAILED";
}

// --- Báo cáo & BI --------------------------------------------------------------
export type ReportFileType = "CSV" | "XLSX" | "DOCX" | "PDF" | "MẪU";
export type ReportColumnType = "text" | "number" | "percent";
export type ReportDatasetSource = "upload" | "chatbot" | "sample";

export interface ReportColumn {
  key: string;
  header: string;
  type: ReportColumnType;
}

export interface ReportRow {
  id: string;
  cells: Record<string, string | number>;
}

export interface ReportDataset {
  id: string;
  name: string;
  fileName: string;
  fileType: ReportFileType;
  period: string;
  year: number;
  quarter?: string;
  source: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  status: DataStatus;
  extractedAt: string;
  savedAt: string;
  summary?: string;
  viewCount?: number;
  via: ReportDatasetSource;
}

// Câu trả lời của trợ lý báo cáo (tính toán từ dữ liệu đã chuẩn hóa).
export interface ReportAnswer {
  text: string;
  rows?: { label: string; value: number | string; tone?: string }[];
}

// --- Trang th�ng tin (public portal) ------------------------------------------
export type PortalContentType =
  | "news"
  | "event"
  | "promotion"
  | "investment"
  | "trade-promotion"
  | "market-info"
  | "announcement";

export type PortalStatus = "draft" | "published" | "archived";

export interface PortalAttachment {
  name: string;
  url: string;
  size?: string;
}

export interface PortalPost {
  id: string;
  type: PortalContentType;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: string;
  tags: string[];
  publishedAt: string;
  status: PortalStatus;
  featured?: boolean;
  source?: string;
  author?: string;
  thumbnail?: string;
  views?: number;
  // event
  eventStartDate?: string;
  eventEndDate?: string;
  location?: string;
  organizer?: string;
  audience?: string;
  registrationDeadline?: string;
  // investment
  area?: string;
  availableArea?: string;
  industries?: string[];
  // misc
  attachments?: PortalAttachment[];
}

// --- Tờ khai hải quan xuất khẩu (Mẫu HQ/2015/XK) -------------------------------
export type CustomsChannel = "GREEN" | "YELLOW" | "RED";
export type CustomsClearanceStatus = "PENDING" | "CLEARED" | "INSPECTION" | "HOLD" | "CANCELLED";
export type DeclarationType = "NORMAL" | "PRIORITY" | "EXPRESS" | "TRANSIT";
export type IncotermsCode = "EXW" | "FCA" | "FAS" | "FOB" | "CFR" | "CIF" | "CPT" | "CIP" | "DAP" | "DPU" | "DDP";
export type PaymentMethodCode = "TT" | "LC" | "DP" | "DA" | "OA" | "CAD" | "OTHER";
export type CurrencyCode = "USD" | "VND" | "EUR" | "JPY" | "CNY" | "THB" | "SGD" | "AUD" | "GBP" | "HKD";
export type UnitCode = "KGM" | "MTQ" | "NMB" | "LTR" | "MTR" | "SET" | "PK" | "BOX" | "CTN" | "BAL" | "BAG" | "DRM" | "ROL" | "TNE";

export interface CustomsOffice {
  code: string;
  name: string;
  type: "REGISTRATION" | "EXIT_GATE" | "SUPERVISION";
}

export interface ExportCustomsDeclaration {
  id: string;
  declarationNo: string;
  registrationOfficeCode: string;
  exitGateOfficeCode: string;
  registrationDate: string;
  declarationType: DeclarationType;
  priority: boolean;
  
  exporter: {
    name: string;
    taxCode: string;
    address: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
  };
  exportLicense?: {
    number: string;
    issueDate: string;
    expiryDate: string;
    issuingAuthority: string;
  };
  importer: {
    name: string;
    address: string;
    country: string;
    taxCode?: string;
  };
  commercialInvoice: {
    number: string;
    date: string;
  };
  authorizedAgent?: {
    name: string;
    taxCode: string;
    licenseNumber?: string;
  };
  customsBroker?: {
    name: string;
    taxCode: string;
    licenseNumber?: string;
  };
  
  incoterms: IncotermsCode;
  paymentMethod: PaymentMethodCode;
  currency: CurrencyCode;
  exchangeRate: number;
  
  items: ExportDeclarationItem[];
  
  exportTax: TaxCalculation;
  otherTaxes: TaxCalculation[];
  totalTaxPayable: number;
  
  containers: ContainerInfo[];
  transportMode: "SEA" | "AIR" | "ROAD" | "RAIL" | "MULTIMODAL";
  vesselName?: string;
  voyageNo?: string;
  billOfLading?: string;
  
  channel: CustomsChannel;
  clearanceStatus: CustomsClearanceStatus;
  clearanceDate?: string;
  inspectionDate?: string;
  releaseDate?: string;
  
  declarantName: string;
  declarantTitle: string;
  declarationDate: string;
  notes?: string;
  attachedDocuments?: string[];
  
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface ExportDeclarationItem {
  stt: number;
  description: string;
  hsCode: string;
  hsDescription?: string;
  originCountry: string;
  quantity: number;
  unitCode: UnitCode;
  unitPrice: number;
  customsValue: number;
  exportTaxRate: number;
  exportTaxAmount: number;
  preferentialTreatment?: string;
  quotaNumber?: string;
  licenseNumber?: string;
}

export interface ContainerInfo {
  containerNo: string;
  sealNo?: string;
  packageCount: number;
  packageType?: string;
  grossWeight: number;
  netWeight?: number;
  stuffingLocation: string;
  stuffingDate?: string;
}

export interface TaxCalculation {
  taxableValue: number;
  taxRate: number;
  taxAmount: number;
  taxType: "EXPORT" | "VAT" | "SCT" | "EPT" | "OTHER";
  currency: CurrencyCode;
}

export interface CustomsDeclarationStats {
  totalDeclarations: number;
  clearedCount: number;
  pendingCount: number;
  inspectionCount: number;
  totalCustomsValue: number;
  totalExportTax: number;
  byGate: Record<string, number>;
  byChannel: Record<CustomsChannel, number>;
  byStatus: Record<CustomsClearanceStatus, number>;
  byMonth: { month: string; count: number; value: number }[];
  topExporters: { name: string; taxCode: string; count: number; value: number }[];
  topHsCodes: { hsCode: string; description: string; count: number; value: number }[];
}
