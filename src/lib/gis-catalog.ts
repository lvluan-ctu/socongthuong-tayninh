// Catalog các lớp dữ liệu GIS — nguồn sự thật duy nhất cho panel "Lớp dữ liệu",
// chú giải và bảng đối tượng của bản đồ GIS tổng hợp (/gis/map).
// Sau này từng `source` của catalog sẽ thay bằng endpoint OGC API – Features
// (GeoJSON collection) khi kết nối backend, không đổi cấu trúc UI.

export type GisLayerId =
  | "ward"
  | "kcn"
  | "factory"
  | "substation"
  | "lines"
  | "poles"
  | "planning"
  | "corridors"
  | "connectionPoints"
  | "incidents"
  | "overloadZones"
  | "renewables";

export type GisLegendStyle = "solid" | "line" | "dash" | "point";

export interface GisLayerDef {
  id: GisLayerId;
  label: string;
  /** Kiểu chú giải trên legend (màu/kiểu nét của lớp trên bản đồ). */
  legend: { style: GisLegendStyle; color: string };
}

export interface GisLayerGroupDef {
  id: "industry" | "energy";
  label: string;
  layers: GisLayerId[];
}

export const GIS_LAYER_GROUPS: GisLayerGroupDef[] = [
  {
    id: "industry",
    label: "Khu/Cụm công nghiệp",
    layers: ["ward", "kcn", "factory"],
  },
  {
    id: "energy",
    label: "Nguồn năng lượng – Nhiệm vụ 1",
    layers: [
      "substation",
      "lines",
      "poles",
      "planning",
      "corridors",
      "connectionPoints",
      "incidents",
      "overloadZones",
      "renewables",
    ],
  },
];

export const GIS_LAYERS: Record<GisLayerId, GisLayerDef> = {
  ward: {
    id: "ward",
    label: "Ranh giới xã/phường",
    legend: { style: "dash", color: "#64748B" },
  },
  kcn: {
    id: "kcn",
    label: "Khu/Cụm công nghiệp",
    legend: { style: "solid", color: "#1565C0" },
  },
  factory: {
    id: "factory",
    label: "Doanh nghiệp trong KCN",
    legend: { style: "point", color: "#2E7D32" },
  },
  substation: {
    id: "substation",
    label: "Trạm biến áp",
    legend: { style: "point", color: "#1565C0" },
  },
  lines: {
    id: "lines",
    label: "Đường dây tải điện",
    legend: { style: "line", color: "#1565C0" },
  },
  poles: {
    id: "poles",
    label: "Trụ điện",
    legend: { style: "point", color: "#0f2a4a" },
  },
  planning: {
    id: "planning",
    label: "Quy hoạch lưới điện",
    legend: { style: "dash", color: "#94A3B8" },
  },
  corridors: {
    id: "corridors",
    label: "Hành lang an toàn (NĐ 14/2014)",
    legend: { style: "dash", color: "#F59E0B" },
  },
  connectionPoints: {
    id: "connectionPoints",
    label: "Điểm đấu nối",
    legend: { style: "point", color: "#0F766E" },
  },
  incidents: {
    id: "incidents",
    label: "Điểm sự cố",
    legend: { style: "point", color: "#C62828" },
  },
  overloadZones: {
    id: "overloadZones",
    label: "Khu vực quá tải",
    legend: { style: "solid", color: "#C62828" },
  },
  renewables: {
    id: "renewables",
    label: "Nguồn NLTT đấu nối",
    legend: { style: "point", color: "#2E7D32" },
  },
};

export const ALL_GIS_LAYERS: GisLayerId[] = GIS_LAYER_GROUPS.flatMap((g) => g.layers);
