import type { MineralLicense, LicenseStatus, MineralCategory, WeighbridgeStation, Vehicle, DeclarationRecord, Trip, Alert, ReconciliationResult, MineralKpis } from './mineral-types';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Paths
const DATA_DIR = path.resolve(process.cwd(), 'src/data');
const LICENSES_PATH = path.join(DATA_DIR, 'mineral-licenses.json');
const STATIONS_PATH = path.join(DATA_DIR, 'weighbridge-stations.json');
const VEHICLES_PATH = path.join(DATA_DIR, 'vehicles.json');
const DECLARATIONS_PATH = path.join(DATA_DIR, 'declarations.json');
const EXTRACTION_PATH = path.join(DATA_DIR, 'extraction-records.json');
const TRIPS_PATH = path.join(DATA_DIR, 'trips.json');
const ALERTS_PATH = path.join(DATA_DIR, 'alerts.json');

// Helper: đọc file hoặc trả về default
async function readJSON<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`[mineral-store] Không đọc được ${filePath}:`, error);
    return fallback;
  }
}

// Helper: ghi file (format đẹp, UTF-8, newline akhir)
async function writeJSON(path: string, data: unknown) {
  await writeFile(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// ===========================
// License Store (79 GP từ Excel)
// ===========================

let licenseCache: MineralLicense[] = [];
let licensesLoaded = false;

async function ensureLicensesLoaded(): Promise<void> {
  if (licensesLoaded) return;
  licensesLoaded = true;
  const data = await readJSON<MineralLicense[]>(LICENSES_PATH, []);
  if (Array.isArray(data) && data.length > 0) {
    licenseCache = data;
  }
}

// Các store còn lại dùng chung helper để tránh cache rỗng vĩnh viễn
// (get luôn trả [] và create ghi đè file chỉ với bản ghi trong RAM).
const storeLoadedFlags: Record<string, boolean> = {};

async function ensureStoreLoaded<T>(key: string, filePath: string, assign: (data: T[]) => void): Promise<void> {
  if (storeLoadedFlags[key]) return;
  storeLoadedFlags[key] = true;
  const data = await readJSON<T[]>(filePath, []);
  if (Array.isArray(data) && data.length > 0) {
    assign(data);
  }
}

function ensureStationsLoaded(): Promise<void> {
  return ensureStoreLoaded<WeighbridgeStation>('stations', STATIONS_PATH, (data) => { stationCache = data; });
}

function ensureVehiclesLoaded(): Promise<void> {
  return ensureStoreLoaded<Vehicle>('vehicles', VEHICLES_PATH, (data) => { vehicleCache = data; });
}

function ensureDeclarationsLoaded(): Promise<void> {
  return ensureStoreLoaded<DeclarationRecord>('declarations', DECLARATIONS_PATH, (data) => { declarationCache = data; });
}

function ensureTripsLoaded(): Promise<void> {
  return ensureStoreLoaded<Trip>('trips', TRIPS_PATH, (data) => { tripCache = data; });
}

function ensureAlertsLoaded(): Promise<void> {
  return ensureStoreLoaded<Alert>('alerts', ALERTS_PATH, (data) => { alertCache = data; });
}

export async function getLicenses(filters?: {
  status?: LicenseStatus;
  mineralCategory?: MineralCategory;
  district?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  items: MineralLicense[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}> {
  await ensureLicensesLoaded();
  let items = [...licenseCache];

  if (filters) {
    if (filters.status) items = items.filter((l) => l.status === filters.status);
    if (filters.mineralCategory)
      items = items.filter((l) => l.mineralCategory === filters.mineralCategory);
    if (filters.district) items = items.filter((l) => l.location.district === filters.district);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      items = items.filter(
        (l) =>
          l.licenseNumber.toLowerCase().includes(s) ||
          l.organizationName.toLowerCase().includes(s) ||
          (l.notes?.toLowerCase().includes(s) ?? false)
      );
    }
  }

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  items = items.slice(start, end);

  return {
    items,
    pagination: { page, pageSize, total, totalPages },
  };
}

export async function getLicense(id: string): Promise<MineralLicense | undefined> {
  await ensureLicensesLoaded();
  return licenseCache.find((l) => l.id === id);
}

export async function createLicense(license: Omit<MineralLicense, 'id' | 'createdAt' | 'updatedAt'>): Promise<MineralLicense> {
  await ensureLicensesLoaded();
  // Chống trùng số GP
  const dup = licenseCache.some((l) => l.licenseNumber === license.licenseNumber);
  if (dup) throw new Error(`Số giấy phép ${license.licenseNumber} đã tồn tại.`);
  const newLicense: MineralLicense = {
    id: `LP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    ...license,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  licenseCache = [...licenseCache, newLicense];
  await writeJSON(LICENSES_PATH, licenseCache);
  return newLicense;
}

export async function updateLicense(
  id: string,
  updates: Partial<Omit<MineralLicense, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<MineralLicense | undefined> {
  await ensureLicensesLoaded();
  const idx = licenseCache.findIndex((l) => l.id === id);
  if (idx === -1) return undefined;
  licenseCache[idx] = { ...licenseCache[idx], ...updates, updatedAt: new Date().toISOString() };
  await writeJSON(LICENSES_PATH, licenseCache);
  return licenseCache[idx];
}

export async function deleteLicense(id: string): Promise<boolean> {
  await ensureLicensesLoaded();
  const idx = licenseCache.findIndex((l) => l.id === id);
  if (idx === -1) return false;
  licenseCache.splice(idx, 1);
  await writeJSON(LICENSES_PATH, licenseCache);
  return true;
}

// ===========================
// Weighbridge Station Store
// ===========================

let stationCache: WeighbridgeStation[] = [];

export async function getStations(filters?: {
  status?: WeighbridgeStation['status'];
  province?: string;
}): Promise<WeighbridgeStation[]> {
  await ensureStationsLoaded();
  let items = [...stationCache];
  if (filters?.status) items = items.filter((s) => s.status === filters.status);
  if (filters?.province) items = items.filter((s) => s.province === filters.province);
  return items;
}

export async function getStation(id: string): Promise<WeighbridgeStation | undefined> {
  await ensureStationsLoaded();
  return stationCache.find((s) => s.id === id);
}

export async function createStation(station: Omit<WeighbridgeStation, 'id'>): Promise<WeighbridgeStation> {
  await ensureStationsLoaded();
  const newStation: WeighbridgeStation = {
    id: `WS-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    ...station,
  };
  stationCache = [...stationCache, newStation];
  await writeJSON(STATIONS_PATH, stationCache);
  return newStation;
}

export async function updateStation(id: string, updates: Partial<WeighbridgeStation>): Promise<WeighbridgeStation | undefined> {
  await ensureStationsLoaded();
  const idx = stationCache.findIndex((s) => s.id === id);
  if (idx === -1) return undefined;
  stationCache[idx] = { ...stationCache[idx], ...updates };
  await writeJSON(STATIONS_PATH, stationCache);
  return stationCache[idx];
}

export async function deleteStation(id: string): Promise<boolean> {
  await ensureStationsLoaded();
  const idx = stationCache.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  stationCache.splice(idx, 1);
  await writeJSON(STATIONS_PATH, stationCache);
  return true;
}

// ===========================
// Vehicle Store
// ===========================

let vehicleCache: Vehicle[] = [];

export async function getVehicles(filters?: {
  status?: Vehicle['status'];
  mineId?: string;
}): Promise<Vehicle[]> {
  await ensureVehiclesLoaded();
  let items = [...vehicleCache];
  if (filters?.status) items = items.filter((v) => v.status === filters.status);
  if (filters?.mineId) items = items.filter((v) => v.mineId === filters.mineId);
  return items;
}

export async function getVehicle(id: string): Promise<Vehicle | undefined> {
  await ensureVehiclesLoaded();
  return vehicleCache.find((v) => v.id === id);
}

export async function createVehicle(vehicle: Omit<Vehicle, 'id'>): Promise<Vehicle> {
  await ensureVehiclesLoaded();
  const newVehicle: Vehicle = {
    id: `VEH-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
    ...vehicle,
  };
  vehicleCache = [...vehicleCache, newVehicle];
  await writeJSON(VEHICLES_PATH, vehicleCache);
  return newVehicle;
}

export async function updateVehicle(id: string, updates: Partial<Vehicle>): Promise<Vehicle | undefined> {
  await ensureVehiclesLoaded();
  const idx = vehicleCache.findIndex((v) => v.id === id);
  if (idx === -1) return undefined;
  vehicleCache[idx] = { ...vehicleCache[idx], ...updates };
  await writeJSON(VEHICLES_PATH, vehicleCache);
  return vehicleCache[idx];
}

export async function deleteVehicle(id: string): Promise<boolean> {
  await ensureVehiclesLoaded();
  const idx = vehicleCache.findIndex((v) => v.id === id);
  if (idx === -1) return false;
  vehicleCache.splice(idx, 1);
  await writeJSON(VEHICLES_PATH, vehicleCache);
  return true;
}

// ===========================
// Declaration Record Store
// ===========================

let declarationCache: DeclarationRecord[] = [];

export async function getDeclarations(filters?: {
  licenseId?: string;
  period?: 'THANG' | 'QUY' | 'NAM';
  periodValue?: string;
  status?: DeclarationRecord['status'];
}): Promise<DeclarationRecord[]> {
  await ensureDeclarationsLoaded();
  let items = [...declarationCache];
  if (filters?.licenseId) items = items.filter((d) => d.licenseId === filters.licenseId);
  if (filters?.period) items = items.filter((d) => d.period === filters.period);
  if (filters?.periodValue) items = items.filter((d) => d.periodValue === filters.periodValue);
  if (filters?.status) items = items.filter((d) => d.status === filters.status);
  return items;
}

export async function getDeclaration(id: string): Promise<DeclarationRecord | undefined> {
  await ensureDeclarationsLoaded();
  return declarationCache.find((d) => d.id === id);
}

export async function createDeclaration(decl: Omit<DeclarationRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<DeclarationRecord> {
  await ensureDeclarationsLoaded();
  const newDecl: DeclarationRecord = {
    id: `DEC-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
    ...decl,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  declarationCache = [...declarationCache, newDecl];
  await writeJSON(DECLARATIONS_PATH, declarationCache);
  return newDecl;
}

export async function updateDeclaration(id: string, updates: Partial<DeclarationRecord>): Promise<DeclarationRecord | undefined> {
  await ensureDeclarationsLoaded();
  const idx = declarationCache.findIndex((d) => d.id === id);
  if (idx === -1) return undefined;
  declarationCache[idx] = { ...declarationCache[idx], ...updates, updatedAt: new Date().toISOString() };
  await writeJSON(DECLARATIONS_PATH, declarationCache);
  return declarationCache[idx];
}

export async function deleteDeclaration(id: string): Promise<boolean> {
  await ensureDeclarationsLoaded();
  const idx = declarationCache.findIndex((d) => d.id === id);
  if (idx === -1) return false;
  declarationCache.splice(idx, 1);
  await writeJSON(DECLARATIONS_PATH, declarationCache);
  return true;
}

// ===========================
// Trip Store
// ===========================

let tripCache: Trip[] = [];

export async function getTrips(filters?: {
  vehicleId?: string;
  licenseId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Trip[]> {
  await ensureTripsLoaded();
  let items = [...tripCache];
  const { vehicleId, licenseId, startDate, endDate } = filters ?? {};
  if (vehicleId) items = items.filter((t) => t.vehicleId === vehicleId);
  if (licenseId) items = items.filter((t) => t.licenseId === licenseId);
  if (startDate) items = items.filter((t) => t.startTime >= (startDate as string));
  if (endDate) items = items.filter((t) => t.endTime <= (endDate as string));
  return items;
}

export async function getTrip(id: string): Promise<Trip | undefined> {
  await ensureTripsLoaded();
  return tripCache.find((t) => t.id === id);
}

export async function createTrip(trip: Omit<Trip, 'id'>): Promise<Trip> {
  await ensureTripsLoaded();
  const newTrip: Trip = {
    id: `TP-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
    ...trip,
  };
  tripCache = [...tripCache, newTrip];
  await writeJSON(TRIPS_PATH, tripCache);
  return newTrip;
}

export async function updateTrip(id: string, updates: Partial<Trip>): Promise<Trip | undefined> {
  await ensureTripsLoaded();
  const idx = tripCache.findIndex((t) => t.id === id);
  if (idx === -1) return undefined;
  tripCache[idx] = { ...tripCache[idx], ...updates };
  await writeJSON(TRIPS_PATH, tripCache);
  return tripCache[idx];
}

export async function deleteTrip(id: string): Promise<boolean> {
  await ensureTripsLoaded();
  const idx = tripCache.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  tripCache.splice(idx, 1);
  await writeJSON(TRIPS_PATH, tripCache);
  return true;
}

// ===========================
// Alert Store
// ===========================

let alertCache: Alert[] = [];

export async function getAlerts(filters?: {
  severity?: Alert['severity'];
  type?: Alert['type'];
  relatedType?: Alert['relatedType'];
  acknowledged?: boolean;
}): Promise<Alert[]> {
  await ensureAlertsLoaded();
  let items = [...alertCache];
  if (filters?.severity) items = items.filter((a) => a.severity === filters.severity);
  if (filters?.type) items = items.filter((a) => a.type === filters.type);
  if (filters?.relatedType) items = items.filter((a) => a.relatedType === filters.relatedType);
  if (filters?.acknowledged !== undefined) items = items.filter((a) => a.acknowledged === filters.acknowledged);
  return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function getAlert(id: string): Promise<Alert | undefined> {
  await ensureAlertsLoaded();
  return alertCache.find((a) => a.id === id);
}

export async function createAlert(alert: Omit<Alert, 'id'>): Promise<Alert> {
  await ensureAlertsLoaded();
  const newAlert: Alert = {
    id: `AL-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
    ...alert,
  };
  alertCache = [...alertCache, newAlert];
  await writeJSON(ALERTS_PATH, alertCache);
  return newAlert;
}

export async function updateAlert(id: string, updates: Partial<Alert>): Promise<Alert | undefined> {
  await ensureAlertsLoaded();
  const idx = alertCache.findIndex((a) => a.id === id);
  if (idx === -1) return undefined;
  alertCache[idx] = { ...alertCache[idx], ...updates };
  await writeJSON(ALERTS_PATH, alertCache);
  return alertCache[idx];
}

export async function deleteAlert(id: string): Promise<boolean> {
  await ensureAlertsLoaded();
  const idx = alertCache.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  alertCache.splice(idx, 1);
  await writeJSON(ALERTS_PATH, alertCache);
  return true;
}

// ===========================
// Reconciliation Engine (pure functions)
// ===========================

export function computeReconciliation(license: MineralLicense, actualVolume: number, declaredVolume: number): ReconciliationResult {
  const licensedCapacity = license.capacity;
  const variance = declaredVolume - actualVolume;
  const variancePercent = licensedCapacity > 0 ? (variance / licensedCapacity) * 100 : 0;

  let status: 'TU_CHINH' | 'CHENH_LECH' | 'VO_T_CONG_SUAT' | 'THIEP_VU' = 'TU_CHINH';
  const alerts: Alert[] = [];

  // Rule 1: Vượt công suất (>105% licensed)
  if (actualVolume > licensedCapacity * 1.05) {
    status = 'VO_T_CONG_SUAT';
    alerts.push({
      id: `AL-${Date.now()}-1`,
      type: 'OVER_CAPACITY',
      severity: 'CRITICAL',
      title: 'Vượt công suất khai thác',
      message: `Khai thác thực tế ${actualVolume.toLocaleString()} m³ vượt công suất cấp phép ${licensedCapacity.toLocaleString()} m³/năm (+${((actualVolume / licensedCapacity - 1) * 100).toFixed(1)}%)`,
      relatedId: license.id,
      relatedType: 'LICENSE',
      timestamp: new Date().toISOString(),
      acknowledged: false,
    });
  }
  // Rule 2: Chênh lệch lớn giữa cân và kê khai (>5%)
  else if (Math.abs(variancePercent) > 5) {
    status = 'CHENH_LECH';
    alerts.push({
      id: `AL-${Date.now()}-2`,
      type: 'DECLARATION_MISMATCH',
      severity: 'WARNING',
      title: 'Chênh lệch kê khai/cân',
      message: `Khê lệch ${variancePercent > 0 ? 'thừa kê khai' : 'thiếu kê khai'} ${Math.abs(variancePercent).toFixed(1)}% so với kết quả trạm cân`,
      relatedId: license.id,
      relatedType: 'LICENSE',
      timestamp: new Date().toISOString(),
      acknowledged: false,
    });
  }
  // Rule 3: Không dữ liệu cân trong 30 ngày (mocked: actualVolume === 0)
  else if (actualVolume === 0) {
    status = 'THIEP_VU';
    alerts.push({
      id: `AL-${Date.now()}-3`,
      type: 'DATA_GAP',
      severity: 'WARNING',
      title: 'Thiếu dữ liệu trạm cân',
      message: 'Không có dữ liệu trạm cân trong 30 ngày liên tục',
      relatedId: license.id,
      relatedType: 'LICENSE',
      timestamp: new Date().toISOString(),
      acknowledged: false,
    });
  }
  // Rule 4: License hết hạn sắp tới (within 3 months)
  else if (license.expiryDate) {
    const expiryDate = new Date(license.expiryDate);
    if (!Number.isNaN(expiryDate.getTime())) {
    const now = new Date();
    const diffMonths = (expiryDate.getFullYear() - now.getFullYear()) * 12 + (expiryDate.getMonth() - now.getMonth());
    if (diffMonths <= 3 && diffMonths > 0) {
      status = 'THIEP_VU';
      alerts.push({
        id: `AL-${Date.now()}-4`,
        type: 'LICENSE_EXPIRING',
        severity: 'INFO',
        title: 'Giấy phép sắp hết hạn',
        message: `Giấy phép "${license.licenseNumber}" hết hạn ${diffMonths > 0 ? 'trong ' + diffMonths + ' tháng' : 'và đã hết'}`,
        relatedId: license.id,
        relatedType: 'LICENSE',
        timestamp: new Date().toISOString(),
        acknowledged: false,
      });
    }
    }
  }

  return {
    licenseId: license.id,
    licensedCapacity,
    actualVolume,
    declaredVolume,
    variance,
    variancePercent,
    status,
    alerts,
    checkedAt: new Date().toISOString(),
  };
}

// ===========================
// KPI Computation
// ===========================

export function computeKpis(licenses: MineralLicense[]): MineralKpis {
  const totalLicenses = licenses.length;
  const activeLicenses = licenses.filter((l) => l.status === 'HIEU_LUC').length;
  const expiredLicenses = licenses.filter((l) => l.status === 'HET_HAN').length;
  const suspendedLicenses = licenses.filter((l) => l.status === 'NGUNG_HOAT_DONG').length;
  
  const totalReserve = licenses.reduce((sum, l) => sum + (Number(l.totalReserve) || 0), 0);
  const totalCapacity = licenses.reduce((sum, l) => sum + (Number(l.capacity) || 0), 0);
  
  // Total extracted: sum of extraction2025.conLai (remaining) không, sum of declared or actual
  // Mock: use sum of declared volume from declarations if available, else 0
  const totalExtracted = 0; // Will be computed from declarations collection
  
  // Compliance rate: licenses where actual (mock) <= capacity
  const compliant = licenses.filter((l) => l.status === 'HIEU_LUC').length;
  const complianceRate = totalLicenses > 0 ? (compliant / totalLicenses) * 100 : 0;
  
  // Alerts this month: count CRITICAL alerts from last 30 days (mock)
  const alertsThisMonth = 0;
  const criticalAlerts = 0;
  
  return {
    totalLicenses,
    activeLicenses,
    expiredLicenses,
    suspendedLicenses,
    totalReserve,
    totalCapacity,
    totalExtracted,
    complianceRate,
    alertsThisMonth,
    criticalAlerts,
  };
}

// ===========================
// Initial Seed (chạy 1 lần để sinh dữ liệu từ Excel)
// ===========================

export async function initializeMineralData(): Promise<{
  licenses: MineralLicense[];
  stations: WeighbridgeStation[];
  vehicles: Vehicle[];
  message: string;
}> {
  // 1. Đọc file Excel và parse (sử dụng script bên dưới hoặc manual)
  // 2. Chuyển đổi sang MineralLicense[] theo cấu trúc types
  // 3. Ghi file src/data/mineral-licenses.json
  
  // TODO: Chạy script parse-excel.js để sinh file mineral-licenses.json từ Excel
  // await parseExcelAndSeed();
  
  // Pending: Chạy thủ công hoặc script riêng
  return {
    licenses: [],
    stations: [],
    vehicles: [],
    message: 'Chạy hàm initializeMineralData() để sinh seed data từ Excel, hoặc nhập thủ công qua API',
  };
}