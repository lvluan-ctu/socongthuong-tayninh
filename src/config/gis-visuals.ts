export const GIS_VISUALS = {
  boundary: { color: "#64748b", glyph: "▱" },
  substation: { color: "#1565c0", glyph: "⚡" },
  lineHigh: { color: "#2563eb", glyph: "—" },
  lineMedium: { color: "#0891b2", glyph: "—" },
  pole: { color: "#334155", glyph: "•" },
  supplyArea: { color: "#0f766e", glyph: "▱" },
  loadArea: { color: "#7c3aed", glyph: "▱" },
  planning: { color: "#7c3aed", glyph: "QH" },
  corridor: { color: "#0f766e", glyph: "▱" },
  connection: { color: "#0f766e", glyph: "⊕" },
  incident: { color: "#c62828", glyph: "!" },
  warning: { color: "#f59e0b", glyph: "⚠" },
  overload: { color: "#dc2626", glyph: "!" },
  renewable: { color: "#16a34a", glyph: "✦" },
  solar: { color: "#0ea5e9", glyph: "☀" },
  hydro: { color: "#0284c7", glyph: "≈" },
  biomass: { color: "#16a34a", glyph: "♻" },
  consumer: { color: "#0f766e", glyph: "kW" },
  charging: { color: "#7c3aed", glyph: "EV" },
  oil: { color: "#b45309", glyph: "⛽" },
  oilStorage: { color: "#0f766e", glyph: "▣" },
  mission: { color: "#0891b2", glyph: "•" },
} as const;

export const GIS_ICON_ASSETS = {
  substation: "/images/map/substation.svg",
  transformer: "/images/map/transformer.svg",
  transmission: "/images/map/transmission-tower.svg",
  utilityPole: "/images/map/utility-pole.svg",
  powerLine: "/images/map/power-line.svg",
  powerPlant: "/images/map/power-plant.svg",
  solar: "/images/map/solar-plant.svg",
  wind: "/images/map/wind-turbine.svg",
  hydro: "/images/map/hydropower.svg",
  battery: "/images/map/battery-storage.svg",
  charger: "/images/map/ev-charger.svg",
  chargingArea: "/images/map/charging-station-area.svg",
  customer: "/images/map/customer.svg",
  meter: "/images/map/electric-meter.svg",
  distributionBox: "/images/map/distribution-box.svg",
} as const;

/** Bộ lọc dùng cho icon SVG bên trong marker nền màu. */
export const GIS_ICON_FILTER = "brightness(0) invert(1)";

export function energyEntityIconAsset(kind: string) {
  if (kind === "substation") return GIS_ICON_ASSETS.substation;
  if (kind === "consumer") return GIS_ICON_ASSETS.customer;
  if (kind === "charging") return GIS_ICON_ASSETS.charger;
  if (kind === "rooftop") return GIS_ICON_ASSETS.solar;
  if (kind === "project") return GIS_ICON_ASSETS.powerPlant;
  if (kind === "pole") return GIS_ICON_ASSETS.utilityPole;
  if (kind === "line") return GIS_ICON_ASSETS.powerLine;
  if (kind === "incident") return GIS_ICON_ASSETS.distributionBox;
  if (kind === "emission") return GIS_ICON_ASSETS.battery;
  return undefined;
}

export function geoServerIconAsset(kind: string, name: string) {
  const value = name.toLowerCase();
  if (kind === "charging" || value.includes("tram_sac")) return GIS_ICON_ASSETS.charger;
  if (kind === "oil" || value.includes("tram_xang")) return undefined;
  if (kind === "consumer" || value.includes("khach_hang")) return GIS_ICON_ASSETS.customer;
  if (value.includes("tba") || value.includes("tram_bien_ap")) return GIS_ICON_ASSETS.substation;
  if (value.includes("vi_tri")) return GIS_ICON_ASSETS.transmission;
  if (value.includes("mat_troi")) return GIS_ICON_ASSETS.solar;
  if (value.includes("thuy_dien")) return GIS_ICON_ASSETS.hydro;
  if (value.includes("sinh_khoi") || value.includes("du_an")) return GIS_ICON_ASSETS.powerPlant;
  if (kind === "generation") return GIS_ICON_ASSETS.powerPlant;
  if (kind === "grid") return GIS_ICON_ASSETS.powerLine;
  return undefined;
}

export function geoServerGlyph(kind: string, name: string) {
  const layerName = name.toLowerCase();
  if (layerName.includes("duong_ong") || layerName.includes("duong_day")) return GIS_VISUALS.lineMedium.glyph;
  if (kind === "boundary") return GIS_VISUALS.boundary.glyph;
  if (kind === "charging") return GIS_VISUALS.charging.glyph;
  if (kind === "oil") return GIS_VISUALS.oil.glyph;
  if (kind === "oilStorage") return GIS_VISUALS.oilStorage.glyph;
  if (kind === "consumer") return GIS_VISUALS.consumer.glyph;
  if (layerName.includes("mat_troi")) return GIS_VISUALS.solar.glyph;
  if (layerName.includes("thuy_dien")) return GIS_VISUALS.hydro.glyph;
  if (layerName.includes("sinh_khoi")) return GIS_VISUALS.biomass.glyph;
  if (layerName.includes("tba")) return GIS_VISUALS.substation.glyph;
  if (layerName.includes("vi_tri")) return GIS_VISUALS.pole.glyph;
  return GIS_VISUALS.lineMedium.glyph;
}

// ─────────────────────── Cluster / Industrial Icons ───────────────────────

/** Icon PNG theo ngành nghề cho marker doanh nghiệp và polygon KCN/CCN. */
export const CLUSTER_ICON_ASSETS = {
  default: "/img/office.png",
  "dệt may": "/img/textile.png",
  "cơ khí": "/img/engineering.png",
  "điện tử": "/img/electric.png",
  "chế biến thực phẩm": "/img/food.png",
  "chế biến nông sản": "/img/yard.png",
  "chế biến lương thực": "/img/food.png",
  "hóa chất": "/img/chemical-reaction.png",
  "thép – vlxd": "/img/construction.png",
  "cao su": "/img/tree.png",
  "năng lượng": "/img/Energy.png",
  "thương mại": "/img/Commerce.png",
} as const;

/** Trả về đường dẫn icon PNG dựa trên tên ngành nghề. */
export function clusterIconAsset(sector: string): string {
  const key = sector.toLowerCase().trim();
  for (const [k, v] of Object.entries(CLUSTER_ICON_ASSETS)) {
    if (k !== "default" && key.includes(k)) return v;
  }
  return CLUSTER_ICON_ASSETS.default;
}
