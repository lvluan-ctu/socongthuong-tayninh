import type { Cluster, ClusterGeometry, WardZone } from "@/lib/types";

// Sinh Polygon GeoJSON cho KCN/CCN từ dữ liệu hiện có (lat/lng + area).
// Backend nên bổ sung trường `geometry` (GeoJSON); khi có, ưu tiên dùng geometry gốc.
export function clusterLatLngs(c: Cluster): [number, number][] {
  const side = Math.sqrt(c.area * 10000) * 0.9; // cạnh hình vuông tương đương diện tích, mét
  const radius = side / 2;
  const dLat = radius / 111320;
  const dLng = radius / (111320 * Math.cos((c.lat * Math.PI) / 180));
  const points: [number, number][] = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / n;
    points.push([c.lat + dLat * Math.sin(a), c.lng + dLng * Math.cos(a)]);
  }
  return points;
}

export function clusterGeometry(c: Cluster): ClusterGeometry {
  if (c.geometry) return c.geometry;
  const ring = clusterLatLngs(c).map(([lat, lng]) => [lng, lat] as [number, number]);
  ring.push(ring[0]!);
  return { type: "Polygon", coordinates: [ring] };
}

// Polygon tượng trưng cho vùng hành chính xã/phường (ranh giới ước lượng —
// tròn hóa quanh tâm địa danh theo bán kính quy đổi từ diện tích tự nhiên).
export function wardZoneLatLngs(w: WardZone): [number, number][] {
  const dLat = w.approxRadiusM / 111320;
  const dLng = w.approxRadiusM / (111320 * Math.cos((w.lat * Math.PI) / 180));
  const points: [number, number][] = [];
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    points.push([w.lat + dLat * Math.sin(a), w.lng + dLng * Math.cos(a)]);
  }
  return points;
}

export function wardZoneGeometry(w: WardZone): ClusterGeometry {
  const ring = wardZoneLatLngs(w).map(([lat, lng]) => [lng, lat] as [number, number]);
  ring.push(ring[0]!);
  return { type: "Polygon", coordinates: [ring] };
}

// Màu theo tỷ lệ lấp đầy — đồng bộ với chú giải: xanh lá ≥75%, xanh dương 50–74%, vàng <50%
export function zoneFillColor(c: Cluster): string {
  if (c.occupancy >= 75) return "#2E7D32";
  if (c.occupancy >= 50) return "#1565C0";
  return "#E59A23";
}

export function zoneBorderColor(c: Cluster): string {
  if (c.occupancy >= 75) return "#1B5E20";
  if (c.occupancy >= 50) return "#0D47A1";
  return "#9A6A0D";
}
