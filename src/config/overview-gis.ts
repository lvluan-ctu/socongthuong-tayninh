import type { EnergyMapChromeConfig, EnergyMapLayerOption } from "@/components/energy/EnergyMap";
import { GIS_ICON_ASSETS, GIS_VISUALS } from "@/config/gis-visuals";

/** Các lớp nghiệp vụ của bản đồ tổng quan /energy. */
export const OVERVIEW_GIS_LAYER_OPTIONS: EnergyMapLayerOption[] = [
  {
    id: "incidents",
    label: "Sự cố và cảnh báo vận hành",
    keys: ["incidents"],
    source: "Cảnh báo",
    color: GIS_VISUALS.incident.color,
    glyph: GIS_VISUALS.incident.glyph,
    icon: GIS_ICON_ASSETS.distributionBox,
    description: "Điểm sự cố có tọa độ cần theo dõi trên toàn tỉnh",
  },
  {
    id: "substations",
    label: "Trạm biến áp",
    keys: ["substations"],
    source: "PostGIS",
    color: GIS_VISUALS.substation.color,
    glyph: GIS_VISUALS.substation.glyph,
    icon: GIS_ICON_ASSETS.substation,
    description: "Trạm điện, mức tải và dư địa công suất",
  },
  {
    id: "transmission-grid",
    label: "Lưới điện 110–500 kV",
    keys: ["lines500", "lines220", "lines110"],
    source: "PostGIS",
    color: GIS_VISUALS.lineHigh.color,
    glyph: GIS_VISUALS.lineHigh.glyph,
    description: "Các tuyến điện áp cao và tình trạng mang tải",
  },
  {
    id: "distribution-grid",
    label: "Lưới điện 22 kV",
    keys: ["lines22"],
    source: "PostGIS",
    color: GIS_VISUALS.lineMedium.color,
    glyph: GIS_VISUALS.lineMedium.glyph,
    description: "Các tuyến trung áp đang quản lý",
  },
  {
    id: "poles",
    label: "Vị trí trụ điện",
    keys: ["poles"],
    source: "PostGIS",
    color: GIS_VISUALS.pole.color,
    glyph: GIS_VISUALS.pole.glyph,
    icon: GIS_ICON_ASSETS.utilityPole,
    description: "Chi tiết trụ và hành lang tuyến điện",
    defaultVisible: false,
  },
  {
    id: "renewable-projects",
    label: "Dự án nguồn năng lượng",
    keys: ["projects"],
    source: "PostGIS",
    color: GIS_VISUALS.renewable.color,
    glyph: GIS_VISUALS.renewable.glyph,
    icon: GIS_ICON_ASSETS.powerPlant,
    description: "Nguồn điện đang vận hành, đầu tư và quy hoạch",
  },
  {
    id: "rooftop-solar",
    label: "Điện mặt trời mái nhà",
    keys: ["rooftopSolar"],
    source: "PostGIS",
    color: GIS_VISUALS.solar.color,
    glyph: GIS_VISUALS.solar.glyph,
    icon: GIS_ICON_ASSETS.solar,
    description: "Hệ thống mái nhà và khả năng tiếp nhận",
    defaultVisible: false,
  },
  {
    id: "key-consumers",
    label: "Phụ tải trọng điểm",
    keys: ["keyConsumers"],
    source: "PostGIS",
    color: GIS_VISUALS.consumer.color,
    glyph: GIS_VISUALS.consumer.glyph,
    icon: GIS_ICON_ASSETS.customer,
    description: "Cơ sở sử dụng điện và phụ tải lớn",
    defaultVisible: false,
  },
  {
    id: "emissions",
    label: "Nguồn phát thải carbon",
    keys: ["emissions"],
    source: "PostGIS",
    color: "#2e7d32",
    glyph: "CO₂",
    icon: GIS_ICON_ASSETS.battery,
    description: "Nguồn phát thải và cường độ CO₂e",
    defaultVisible: false,
  },
  {
    id: "charging-stations",
    label: "Trạm sạc xe điện",
    keys: ["chargingStations"],
    source: "PostGIS",
    color: GIS_VISUALS.charging.color,
    glyph: GIS_VISUALS.charging.glyph,
    icon: GIS_ICON_ASSETS.charger,
    description: "Hạ tầng sạc và trạng thái khai thác",
    defaultVisible: false,
  },
];

export const OVERVIEW_GIS_CHROME_CONFIG: EnergyMapChromeConfig = {
  statusText:
    "Lớp nghiệp vụ lấy từ hệ thống GIS; lớp nền chuyên đề lấy từ WMS GeoServer theo cấu hình env. Nhấp điểm dữ liệu rồi chọn Xem hồ sơ để xem chi tiết.",
  managementRoutes: {
    substation: {
      href: "/energy/nhiem-vu-1/quan-ly",
      label: "Quản lý dữ liệu lưới điện",
    },
    project: {
      href: "/energy/nhiem-vu-2/quan-ly",
      label: "Quản lý dự án nguồn điện",
    },
    rooftop: {
      href: "/energy/nhiem-vu-3/quan-ly",
      label: "Quản lý điện mặt trời mái nhà",
    },
    consumer: {
      href: "/energy/nhiem-vu-4/quan-ly",
      label: "Quản lý phụ tải",
    },
    incident: {
      href: "/energy/nhiem-vu-5/quan-ly",
      label: "Xử lý sự cố và an toàn điện",
    },
    emission: {
      href: "/energy/nhiem-vu-6/quan-ly",
      label: "Quản lý phát thải",
    },
    charging: {
      href: "/energy/nhiem-vu-7/quan-ly",
      label: "Quản lý trạm sạc",
    },
  },
};
