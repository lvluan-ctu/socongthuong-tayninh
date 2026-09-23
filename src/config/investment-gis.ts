import type { EnergyMapChromeConfig, EnergyMapLayerOption } from "@/components/energy/EnergyMap";
import { GIS_ICON_ASSETS, GIS_VISUALS } from "@/config/gis-visuals";

/**
 * Cấu hình lớp riêng của màn hình đánh giá đầu tư.
 * EnergyMap chỉ đảm nhiệm kết xuất; thứ tự, màu và trạng thái mặc định được quản lý tại đây
 * giống cách các bản đồ nhiệm vụ dùng catalog GIS dùng chung.
 */
export const INVESTMENT_GIS_LAYER_OPTIONS: EnergyMapLayerOption[] = [
  {
    id: "incidents",
    label: "Sự cố và điểm rủi ro",
    keys: ["incidents"],
    source: "Cảnh báo",
    color: GIS_VISUALS.incident.color,
    glyph: GIS_VISUALS.incident.glyph,
    icon: GIS_ICON_ASSETS.distributionBox,
    description: "Sự cố có tọa độ ảnh hưởng đến độ tin cậy cấp điện",
  },
  {
    id: "substations",
    label: "Trạm biến áp",
    keys: ["substations"],
    source: "PostGIS",
    color: GIS_VISUALS.substation.color,
    glyph: GIS_VISUALS.substation.glyph,
    icon: GIS_ICON_ASSETS.substation,
    description: "Công suất, mức tải và dư địa tiếp nhận phụ tải",
  },
  {
    id: "transmission-grid",
    label: "Lưới điện 110–500 kV",
    keys: ["lines500", "lines220", "lines110"],
    source: "PostGIS",
    color: GIS_VISUALS.lineHigh.color,
    glyph: GIS_VISUALS.lineHigh.glyph,
    description: "Các tuyến truyền tải và phân phối cấp điện áp cao",
  },
  {
    id: "distribution-grid",
    label: "Lưới điện 22 kV",
    keys: ["lines22"],
    source: "PostGIS",
    color: GIS_VISUALS.lineMedium.color,
    glyph: GIS_VISUALS.lineMedium.glyph,
    description: "Các tuyến trung áp phục vụ rà soát đấu nối",
  },
  {
    id: "poles",
    label: "Vị trí trụ điện",
    keys: ["poles"],
    source: "PostGIS",
    color: GIS_VISUALS.pole.color,
    glyph: GIS_VISUALS.pole.glyph,
    icon: GIS_ICON_ASSETS.utilityPole,
    description: "Chi tiết tuyến và hành lang an toàn",
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
    description: "Hệ thống mái nhà và dữ liệu khả năng tiếp nhận",
  },
  {
    id: "key-consumers",
    label: "Phụ tải trọng điểm",
    keys: ["keyConsumers"],
    source: "PostGIS",
    color: GIS_VISUALS.consumer.color,
    glyph: GIS_VISUALS.consumer.glyph,
    icon: GIS_ICON_ASSETS.customer,
    description: "Các phụ tải lớn dùng để đánh giá hệ sinh thái khu vực",
  },
  {
    id: "emissions",
    label: "Nguồn phát thải carbon",
    keys: ["emissions"],
    source: "PostGIS",
    color: "#2e7d32",
    glyph: "CO₂",
    icon: GIS_ICON_ASSETS.battery,
    description: "Nguồn phát thải và cường độ CO₂e đã ghi nhận",
  },
  {
    id: "charging-stations",
    label: "Trạm sạc xe điện",
    keys: ["chargingStations"],
    source: "PostGIS",
    color: GIS_VISUALS.charging.color,
    glyph: GIS_VISUALS.charging.glyph,
    icon: GIS_ICON_ASSETS.charger,
    description: "Hạ tầng sạc hiện hữu và dư địa cấp điện",
  },
];

export const INVESTMENT_GIS_CHROME_CONFIG: EnergyMapChromeConfig = {
  statusText:
    "Các lớp hệ thống GIS và WMS GeoServer được bật/tắt độc lập. Nhấp điểm dữ liệu rồi chọn Xem hồ sơ để mở thông tin chi tiết.",
  extraLayer: {
    id: "investment:analysis-area",
    label: "Vị trí và vùng phân tích đầu tư",
    source: "Nghiệp vụ",
    color: "#dc2626",
    glyph: "ĐT",
    description: "Điểm khảo sát cùng bán kính dùng để tổng hợp báo cáo tiền khả thi",
    defaultVisible: true,
  },
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
