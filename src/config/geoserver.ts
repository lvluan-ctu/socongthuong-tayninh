import { canonicalGeoServerLayerName } from "./geoserver-layers";

const DEFAULT_GEOSERVER_URL = "http://172.16.20.158:8081/geoserver";
const DEFAULT_GEOSERVER_LAYERS = [
  "nangluong_tayninh:du_an_dien_mat_troi_dien_tap_trung",
  "nangluong_tayninh:du_an_dien_sinh_khoi",
  "nangluong_tayninh:du_an_thuy_dien",
  "nangluong_tayninh:duong_day_110kv_long_an_",
  "nangluong_tayninh:duong_day_22kv_tuyen_473_long_an",
  "nangluong_tayninh:khach_hang_dien_mat_troi",
  "nangluong_tayninh:nhanh_re_ubnd_tinh",
  "nangluong_tayninh:phuong_long_an",
  "nangluong_tayninh:tba_110kv_long_an_hc",
  "nangluong_tayninh:tba_ubnd_tinh",
  "nangluong_tayninh:tinh_tay_ninh",
  "nangluong_tayninh:tram_sac",
  "nangluong_tayninh:vi_tri_110kv_long_an",
  "nangluong_tayninh:vi_tri_tuyen_473_22kv",
  "nangluong_tayninh:duong_ong_xang_dau",
  "nangluong_tayninh:kho_xang_dau",
  "nangluong_tayninh:tram_xang",
  "nangluong_tayninh:tram_xang_petrolimex",
] as const;

function asNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function list(value: string | undefined, fallback: readonly string[] = []) {
  const values = (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map(canonicalGeoServerLayerName);
  return values.length ? values : [...fallback];
}

export function getGeoServerConfig() {
  return {
    baseUrl: (process.env.GEOSERVER_URL || DEFAULT_GEOSERVER_URL).replace(/\/+$/, ""),
    defaultLayers: list(process.env.GEOSERVER_WMS_LAYERS, DEFAULT_GEOSERVER_LAYERS),
    center: [
      asNumber(process.env.GIS_CENTER_LON, 106.414),
      asNumber(process.env.GIS_CENTER_LAT, 10.555),
    ] as [number, number],
    zoom: asNumber(process.env.GIS_DEFAULT_ZOOM, 14),
    timeoutMs: asNumber(process.env.GEOSERVER_TIMEOUT_MS, 20_000),
    username: process.env.GEOSERVER_USERNAME || "",
    password: process.env.GEOSERVER_PASSWORD || "",
  };
}
