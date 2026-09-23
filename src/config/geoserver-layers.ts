export type GeoServerLayerKind = "boundary" | "grid" | "generation" | "consumer" | "charging" | "oil" | "oilStorage";

export type GeoServerLayerStyle = {
  weight?: number;
  opacity?: number;
  fillOpacity?: number;
  dashArray?: string;
  wmsOpacity?: number;
};

export type GeoServerLayerDefinition = {
  name: string;
  label: string;
  shortLabel: string;
  kind: GeoServerLayerKind;
  geometry: "point" | "line" | "polygon";
  color: string;
  missionIds: number[];
  defaultVisible: boolean;
  /** Mặc định true khi thuộc tính vắng mặt để tương thích payload/catalog cũ. */
  allowFeatureDetails?: boolean;
  /** Ghi đè cách hiển thị; component giữ fallback hiện hữu cho thuộc tính vắng mặt. */
  style?: GeoServerLayerStyle;
};

export const GEOSERVER_LAYER_CATALOG: GeoServerLayerDefinition[] = [
  {
    name: "nangluong_tayninh:tinh_tay_ninh",
    label: "Ranh giới tỉnh Tây Ninh",
    shortLabel: "Ranh giới tỉnh",
    kind: "boundary",
    geometry: "polygon",
    color: "#064e3b",
    missionIds: [1, 2, 3, 4, 5, 6, 7, 8],
    defaultVisible: true,
    allowFeatureDetails: false,
    style: {
      weight: 3,
      opacity: 1,
      fillOpacity: 0.1,
      wmsOpacity: 0.92,
    },
  },
  {
    name: "nangluong_tayninh:phuong_long_an",
    label: "Địa giới phường Long An",
    shortLabel: "Phường Long An",
    kind: "boundary",
    geometry: "polygon",
    color: "#334155",
    missionIds: [1, 2, 3, 4, 5, 6, 7, 8],
    defaultVisible: true,
    allowFeatureDetails: false,
    style: {
      weight: 2.25,
      opacity: 0.95,
      fillOpacity: 0.08,
      dashArray: "6 4",
      wmsOpacity: 0.9,
    },
  },
  {
    name: "nangluong_tayninh:duong_day_110kv_long_an_",
    label: "Đường dây 110 kV Long An",
    shortLabel: "Đường dây 110 kV",
    kind: "grid",
    geometry: "line",
    color: "#2563eb",
    missionIds: [1, 2, 3, 4, 5, 7],
    defaultVisible: true,
    allowFeatureDetails: true,
  },
  {
    name: "nangluong_tayninh:duong_day_22kv_tuyen_473_long_an",
    label: "Đường dây 22 kV tuyến 473 Long An",
    shortLabel: "Tuyến 473/22 kV",
    kind: "grid",
    geometry: "line",
    color: "#0891b2",
    missionIds: [1, 2, 3, 4, 5, 7],
    defaultVisible: true,
    allowFeatureDetails: true,
  },
  {
    name: "nangluong_tayninh:nhanh_re_ubnd_tinh",
    label: "Nhánh rẽ cấp điện UBND tỉnh",
    shortLabel: "Nhánh rẽ UBND tỉnh",
    kind: "grid",
    geometry: "line",
    color: "#0f766e",
    missionIds: [1, 2, 3, 4, 5, 7],
    defaultVisible: false,
    allowFeatureDetails: true,
  },
  {
    name: "nangluong_tayninh:vi_tri_110kv_long_an",
    label: "Vị trí cột tuyến 110 kV Long An",
    shortLabel: "Cột tuyến 110 kV",
    kind: "grid",
    geometry: "point",
    color: "#1d4ed8",
    missionIds: [1, 5],
    defaultVisible: false,
    allowFeatureDetails: true,
  },
  {
    name: "nangluong_tayninh:vi_tri_tuyen_473_22kv",
    label: "Vị trí cột tuyến 473/22 kV",
    shortLabel: "Cột tuyến 473",
    kind: "grid",
    geometry: "point",
    color: "#0e7490",
    missionIds: [1, 5],
    defaultVisible: false,
    allowFeatureDetails: true,
  },
  {
    name: "nangluong_tayninh:tba_110kv_long_an_hc",
    label: "Trạm biến áp 110 kV Long An",
    shortLabel: "TBA 110 kV",
    kind: "grid",
    geometry: "point",
    color: "#1e40af",
    missionIds: [1, 2, 3, 4, 5, 7],
    defaultVisible: true,
    allowFeatureDetails: true,
  },
  {
    name: "nangluong_tayninh:tba_ubnd_tinh",
    label: "Trạm biến áp UBND tỉnh",
    shortLabel: "TBA UBND tỉnh",
    kind: "grid",
    geometry: "point",
    color: "#7c3aed",
    missionIds: [1, 2, 3, 4, 5, 7],
    defaultVisible: true,
    allowFeatureDetails: true,
  },
  {
    name: "nangluong_tayninh:du_an_dien_mat_troi_dien_tap_trung",
    label: "Dự án điện mặt trời tập trung",
    shortLabel: "Điện mặt trời tập trung",
    kind: "generation",
    geometry: "point",
    color: "#0ea5e9",
    missionIds: [2, 6],
    defaultVisible: true,
    allowFeatureDetails: true,
  },
  {
    name: "nangluong_tayninh:du_an_dien_sinh_khoi",
    label: "Dự án điện sinh khối",
    shortLabel: "Điện sinh khối",
    kind: "generation",
    geometry: "point",
    color: "#16a34a",
    missionIds: [2, 6],
    defaultVisible: true,
    allowFeatureDetails: true,
  },
  {
    name: "nangluong_tayninh:du_an_thuy_dien",
    label: "Dự án thủy điện",
    shortLabel: "Thủy điện",
    kind: "generation",
    geometry: "point",
    color: "#0284c7",
    missionIds: [2, 6],
    defaultVisible: true,
    allowFeatureDetails: true,
  },
  {
    name: "nangluong_tayninh:khach_hang_dien_mat_troi",
    label: "Khách hàng điện mặt trời mái nhà",
    shortLabel: "Khách hàng ĐMTMN",
    kind: "consumer",
    geometry: "point",
    color: "#ea580c",
    missionIds: [3, 6],
    defaultVisible: true,
    allowFeatureDetails: true,
  },
  {
    name: "nangluong_tayninh:tram_sac",
    label: "Trạm sạc xe điện",
    shortLabel: "Trạm sạc",
    kind: "charging",
    geometry: "point",
    color: "#7c3aed",
    missionIds: [7],
    defaultVisible: true,
    allowFeatureDetails: true,
  },
  {
    name: "nangluong_tayninh:duong_ong_xang_dau",
    label: "Đường ống xăng dầu",
    shortLabel: "Đường ống dầu",
    kind: "oil",
    geometry: "line",
    color: "#ea580c",
    missionIds: [8],
    defaultVisible: true,
    allowFeatureDetails: true,
    style: { weight: 4, opacity: 0.95, dashArray: "10 6" },
  },
  {
    name: "nangluong_tayninh:kho_xang_dau",
    label: "Kho xăng dầu",
    shortLabel: "Kho xăng dầu",
    kind: "oilStorage",
    geometry: "point",
    color: "#0f766e",
    missionIds: [8],
    defaultVisible: true,
    allowFeatureDetails: true,
  },
  {
    name: "nangluong_tayninh:tram_xang",
    label: "Trạm xăng dầu",
    shortLabel: "Trạm xăng dầu",
    kind: "oil",
    geometry: "point",
    color: "#16a34a",
    missionIds: [8],
    defaultVisible: true,
    allowFeatureDetails: true,
  },
  {
    name: "nangluong_tayninh:tram_xang_petrolimex",
    label: "Trạm xăng Petrolimex",
    shortLabel: "Petrolimex",
    kind: "oil",
    geometry: "point",
    color: "#15803d",
    missionIds: [8],
    defaultVisible: true,
    allowFeatureDetails: true,
  },
];

const LAYER_ALIASES: Record<string, string> = {
  "nangluong_tayninh:duong_day_110kv_long_an": "nangluong_tayninh:duong_day_110kv_long_an_",
  "nangluong_tayninh:duong_day_tuyen_473_22kv":
    "nangluong_tayninh:duong_day_22kv_tuyen_473_long_an",
  "nangluong_tayninh:tba_110kv_phuong_long_an": "nangluong_tayninh:tba_110kv_long_an_hc",
};

export function canonicalGeoServerLayerName(name: string) {
  return LAYER_ALIASES[name] ?? name;
}
