// ============================================================
// HÌNH HỌC GIS — NHIỆM VỤ 1
// Các phép tính khoảng cách/hành lang an toàn dùng chung cho
// bản đồ và công cụ "phụ tải mới". Không phụ thuộc thư viện.
// ============================================================
import type { GridSubstation } from "@/lib/grid-types";

export type LatLng = [number, number];

/** Khoảng cách Haversine giữa 2 điểm (km). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const la = (a[0] * Math.PI) / 180;
  const lb = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Chiều rộng hành lang bảo vệ an toàn lưới điện cao áp (mỗi phía,
 * từ dây ngoài cùng) theo Nghị định 14/2014/NĐ-CP, Điều 11 (bảng 1):
 * - Đến 22 kV: 2,0 m (dây trần) / 1,0 m (dây bọc)
 * - 35 kV: 3,0 m (trần) / 1,5 m (bọc)
 * - 110 kV: 4,0 m · 220 kV: 6,0 m · 500 kV: 7,0 m
 */
export function corridorWidthM(voltageLevel: string): number {
  const v = voltageLevel.replace(/\s/g, "").toUpperCase();
  if (v.startsWith("500")) return 7;
  if (v.startsWith("220")) return 6;
  if (v.startsWith("110")) return 4;
  if (v.startsWith("35")) return 3;
  return 2;
}

function unitNormal(a: LatLng, b: LatLng): LatLng {
  const dLat = b[0] - a[0];
  const dLng = b[1] - a[1];
  const len = Math.max(1e-9, Math.hypot(dLat, dLng));
  // Vector pháp tuyến đơn vị trong hệ tọa độ (lat, lng) — ước lượng đủ tốt
  // cho hành lang hẹp (≤ 7 m) so với độ phân giải của tuyến (km).
  return [-dLng / len, dLat / len];
}

/**
 * Sinh polygon hành lang an toàn quanh tuyến (mỗi phía `widthM` mét).
 * Trả về ring khép kín [lat, lng][]. Nếu tuyến chỉ có 1 điểm, trả về rỗng.
 */
export function buildCorridorPolygon(route: LatLng[], widthM: number): LatLng[] {
  if (route.length < 2) return [];
  // 1 độ vĩ ≈ 111 km → mét sang độ.
  const d = widthM / 111000;
  const left: LatLng[] = [];
  const right: LatLng[] = [];
  for (let i = 0; i < route.length; i++) {
    const prev = route[Math.max(0, i - 1)]!;
    const next = route[Math.min(route.length - 1, i + 1)]!;
    const n1 = unitNormal(prev, route[i]!);
    const n2 = unitNormal(route[i]!, next);
    const n: LatLng = [(n1[0] + n2[0]) / 2, (n1[1] + n2[1]) / 2];
    const len = Math.max(1e-9, Math.hypot(n[0], n[1]));
    const u: LatLng = [n[0] / len, n[1] / len];
    left.push([route[i]![0] + u[0] * d, route[i]![1] + u[1] * d]);
    right.push([route[i]![0] - u[0] * d, route[i]![1] - u[1] * d]);
  }
  const ring: LatLng[] = [...left, ...right.reverse(), ...left.slice(0, 1)];
  return ring.map(([lat, lng]) => [Number(lat.toFixed(5)), Number(lng.toFixed(5))]) as LatLng[];
}

/** Trạm gần nhất với điểm cho trước (haversine). */
export function nearestSubstation(
  lat: number,
  lng: number,
  substations: GridSubstation[],
): { substation: GridSubstation; distanceKm: number } | null {
  let best: { substation: GridSubstation; distanceKm: number } | null = null;
  substations.forEach((s) => {
    if (!s.latitude || !s.longitude) return;
    if (s.status === "Quy hoạch") return;
    const d = haversineKm([lat, lng], [s.latitude, s.longitude]);
    if (!best || d < best.distanceKm) best = { substation: s, distanceKm: d };
  });
  return best;
}

/**
 * Khả năng cấp điện dư của trạm cho phụ tải mới (MW):
 * công suất vận hành − công suất đang mang tải.
 */
export function substationSpareCapacityMw(s: GridSubstation): number {
  const cap = s.operatingCapacity ?? s.designCapacity ?? 0;
  const load = cap * ((s.loadFactor ?? 0) / 100);
  return Math.max(0, Math.round((cap - load) * 10) / 10);
}
