/**
 * Core domain types for Mineral Exploitation Management (MMS)
 * Based on: 78-GP-KS-TayNinh-CoToaDo-2025.xlsx (79 licenses)
 * Data fields: license, org, mineral type, reserves, capacity, area, duration, expiry, coordinates, admin location, status, 2025 extraction stats
 */

// ---- Admin Location Hierarchy ----
type Hamlet = string; // Xã xóm /ấp
type Commune = string; // Xã / thị trấn
type District = string; // Huyện / Thành phố
type Province = string; // Tỉnh / Thành phố trực thuộc trung ương

interface AdminLocation {
  hamlet?: Hamlet;
  commune: Commune;
  district: District;
  province: Province;
}

export type MineralCategory =
  | 'CAT_XD' // Cát xây dựng
  | 'DAT_SAN_LAP' // Đất san lấp
  | 'THAN_BUN' // Than bùn
  | 'DA_VOI_DA_SET' // Đá vôi, đá sét
  | 'SET_GACH_NGOI' // Sét gạch ngói
  | 'KHAC'; // Khác

export type LicenseStatus =
  | 'HIEU_LUC' // Còn hiệu lực
  | 'NGUNG_HOAT_DONG' // Đang ngưng hoạt động
  | 'HET_HAN' // Hết hạn
  | 'CHUA_CAP'; // Chưa cấp

// ---- Core License Type ----
interface VolumeBreakdown {
  tong: number;      // Tổng (m³)
  dsl?: number;      // ĐSL (nếu áp dụng)
  sgn?: number;      // SGN (nếu áp dụng)
}

export interface ExtractionStats {
  khaiThacNguyenKhoi: VolumeBreakdown;      // Trữ lượng khai thác năm 2025 (nguyên khối)
  khaiThacHeSoNoRoi: VolumeBreakdown;        // Đã nhân hệ số nở rời
  daKhaiThacLuyKe: VolumeBreakdown;          // Lũy kế đến 31/12/2025
  conLai: VolumeBreakdown;                   // Còn lại đến 31/12/2025
}

export interface LicenseExtension {
  number: string;    // Số GP gia hạn
  date: string;      // Ngày cấp (ISO)
  type: 'GIA_HAN' | 'DIEU_CHINH' | 'CHUYEN_NHUONG';
  note?: string;
}

export interface MineralLicense {
  id: string;                    // UUID
  stt: number;                   // STT từ file
  licenseNumber: string;         // Số giấy phép (480/GP-BTNMT, 1799/GP-UBND...)
  issueDate: string;             // Ngày cấp (ISO string)
  extensions: LicenseExtension[]; // Lịch sử gia hạn/điều chỉnh
  organizationName: string;      // Tên tổ chức / Đơn vị khai thác
  mineralType: string;           // Loại khoáng sản thô (từ file)
  mineralCategory: MineralCategory; // Phân loại chuẩn hóa
  totalReserve: number;          // Tổng trữ lượng (m³) - từ file (các số lớn như 32148783)
  remainingReserve2024: number;  // Trữ lượng còn lại 12/2024 (m³)
  capacity: number;              // Công suất thiết kế (m³/năm)
  area: number;                  // Diện tích khai thác (ha)
  durationYears: number;         // Thời hạn (năm)
  expiryDate: string;            // Ngày hết hạn (ISO string)
  geometry: string;              // WKT hoặc GeoJSON string (tọa độ VN2000)
  location: AdminLocation;       // { hamlet, commune, district, province }
  notes?: string;                // Chi_chu từ file
  status: LicenseStatus;         // HIEU_LUC | NGUNG_HOAT_DONG | HET_HAN | CHUA_CAP
  reportSubmitted2025?: string;  // Ngày nộp BC năm 2025 (ISO)
  extraction2025?: ExtractionStats; // 4 nhóm × 3 loại (Tổng/ĐSL/SGN)
  createdAt: string;
  updatedAt: string;
}

// ---- Weighbridge Station (IoT) ----
export interface WeighbridgeStation {
  id: string;
  name: string;
  code: string;
  province: Province;
  district: District;
  hamlet?: Hamlet;
  commune?: Commune;
  lat: number; // WGS84
  lng: number; // WGS84
  protocol: 'HTTP' | 'MQTT' | 'Modbus';
  endpoint?: string; // API endpoint hoặc broker URL
  licenseIds?: string[]; // GP ids đang theo dõi tại trạm này
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
  lastWeight?: string;
  lastWeightTimestamp?: string;
}

export interface Vehicle {
  id: string;
  licensePlate: string;
  vehicleType: 'XE_TAI' | 'XE_NGAN' | 'TAU' | 'KHAC';
  ownerName?: string;
  ownerIdType?: 'GP_ID' | 'ENTERPRISE_ID';
  ownerId?: string; // GP id hoặc Enterprise id
  mineId?: string; // GP id所属
  gpsDeviceId?: string;
  capacity: number; // Tải trọng tối đa (m³)
  status: 'DANG_KY' | 'ĐANG_CHạy' | 'NGỈ_ĐỜNG' | 'HẾT_HẠN';
  currentTripId?: string;
  lastReport?: {
    timestamp: string;
    lat: number;
    lng: number;
    speed: number;
    heading: number;
  };
}

// ---- Declaration (Kê khai doanh nghiệp) ----
export interface DeclarationRecord {
  id: string;
  licenseId: string;
  declarationDate: string; // ISO
  period: 'THANG' | 'QUY' | 'NAM';
  periodValue: string; // '01/2025', 'Q1/2025', '2025'
  exportedVolume: number; // m³ đã kê khai
  declaredVolume: number; // m³ theo licencia
  variance: number; // chênh lệch (exported - declared)
  variancePercent: number;
  status: 'CHO_XL' | 'DA_XL' | 'Bao_buoi' | 'Tu_dong';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ---- Trip (GPS tracking) ----
export interface Trip {
  id: string;
  vehicleId: string;
  licenseId?: string; // GP liên quan
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  distanceKm: number;
  materialType: string;
  status: 'DANG_MO' | 'DANG_CH' | 'HOAN_THANH' | 'HỦY';
}

// ---- Alert (Cảnh báo) ----
export interface Alert {
  id: string;
  type: 'OVER_CAPACITY' | 'DECLARATION_MISMATCH' | 'DATA_GAP' | 'UNREGISTERED_VEHICLE' | 'LICENSE_EXPIRING' | 'GEOFENCE_BREACH';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  relatedId: string; // licenseId, vehicleId, declarationId...
  relatedType: 'LICENSE' | 'VEHICLE' | 'DECLARATION' | 'STATION';
  timestamp: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

// ---- Reconciliation Result ----
export interface ReconciliationResult {
  licenseId: string;
  licensedCapacity: number;
  actualVolume: number; // từ trạm cân
  declaredVolume: number; // từ kê khai doanh nghiệp
  variance: number;
  variancePercent: number;
  status: 'TU_CHINH' | 'CHENH_LECH' | 'VO_T_CONG_SUAT' | 'THIEP_VU';
  alerts: Alert[];
  checkedAt: string;
}

// ---- Dashboard KPIs ----
export interface MineralKpis {
  totalLicenses: number;
  activeLicenses: number;
  expiredLicenses: number;
  suspendedLicenses: number;
  totalReserve: number;
  totalCapacity: number;
  totalExtracted: number; // tháng/năm
  complianceRate: number; // % tuân thủ công suất
  alertsThisMonth: number;
  criticalAlerts: number;
}