export const SOLAR_METHOD_VERSION = "citizen-screening-v1";

export type RoofSize = "small" | "medium" | "large" | "custom";
export type BatteryPriority = "evening" | "backup";

export type CitizenSolarInput = {
  customerName?: string;
  district?: string;
  propertyType: "townhouse" | "villa" | "garden" | "business";
  monthlyBillVnd: number;
  roofSize: RoofSize;
  roofAreaM2?: number;
  wantsBattery: boolean;
  batteryPriority?: BatteryPriority;
};

export type CitizenSolarResult = {
  monthlyConsumptionKwh: number;
  annualConsumptionKwh: number;
  roofAreaM2: number;
  recommendedCapacityKwp: number;
  panelCount: number;
  inverterKw: number;
  batteryKwh: number;
  annualYieldKwh: number;
  consumptionCoveragePct: number;
  estimatedCapexVnd: number;
  monthlySavingVnd: number;
  paybackYears: number;
  avoidedCo2KgYear: number;
  assumptions: string[];
};

const ROOF_AREA: Record<Exclude<RoofSize, "custom">, number> = {
  small: 24,
  medium: 45,
  large: 80,
};

const round = (value: number, digits = 1) => Number(value.toFixed(digits));

export function calculateCitizenSolar(input: CitizenSolarInput): CitizenSolarResult {
  const tariffVndKwh = 2_900;
  const yieldKwhKwpYear = 1_450;
  const panelKwp = 0.55;
  const panelAreaM2 = 2.6;
  const co2KgKwh = 0.6592;
  const roofAreaM2 = input.roofSize === "custom"
    ? Math.max(10, Math.min(500, Number(input.roofAreaM2 ?? 45)))
    : ROOF_AREA[input.roofSize];
  const monthlyConsumptionKwh = input.monthlyBillVnd / tariffVndKwh;
  const annualConsumptionKwh = monthlyConsumptionKwh * 12;
  const demandCapacityKwp = annualConsumptionKwh * 0.85 / yieldKwhKwpYear;
  const roofPanelLimit = Math.max(2, Math.floor(roofAreaM2 / panelAreaM2));
  const demandPanelCount = Math.max(2, Math.ceil(demandCapacityKwp / panelKwp));
  const panelCount = Math.min(roofPanelLimit, demandPanelCount);
  const recommendedCapacityKwp = round(panelCount * panelKwp, 2);
  const annualYieldKwh = round(recommendedCapacityKwp * yieldKwhKwpYear, 0);
  const usableEnergyKwh = Math.min(annualConsumptionKwh, annualYieldKwh * (input.wantsBattery ? 0.92 : 0.78));
  const desiredBattery = input.wantsBattery
    ? monthlyConsumptionKwh / 30 * (input.batteryPriority === "backup" ? 0.8 : 0.45)
    : 0;
  const batteryKwh = input.wantsBattery
    ? Math.min(20, Math.max(5, Math.ceil(desiredBattery / 2.5) * 2.5))
    : 0;
  const estimatedCapexVnd = Math.round(recommendedCapacityKwp * 13_500_000 + batteryKwh * 8_000_000);
  const monthlySavingVnd = Math.round(usableEnergyKwh * tariffVndKwh / 12);
  const paybackYears = monthlySavingVnd > 0
    ? round(estimatedCapexVnd / (monthlySavingVnd * 12), 1)
    : 0;

  return {
    monthlyConsumptionKwh: round(monthlyConsumptionKwh, 0),
    annualConsumptionKwh: round(annualConsumptionKwh, 0),
    roofAreaM2: round(roofAreaM2, 1),
    recommendedCapacityKwp,
    panelCount,
    inverterKw: Math.max(3, Math.ceil(recommendedCapacityKwp)),
    batteryKwh,
    annualYieldKwh,
    consumptionCoveragePct: round(Math.min(100, annualYieldKwh / annualConsumptionKwh * 100), 0),
    estimatedCapexVnd,
    monthlySavingVnd,
    paybackYears,
    avoidedCo2KgYear: round(annualYieldKwh * co2KgKwh, 0),
    assumptions: [
      "Giá điện quy đổi 2.900 đ/kWh.",
      "Suất phát điện sàng lọc 1.450 kWh/kWp/năm.",
      "Tấm pin 550 Wp, cần khoảng 2,6 m²/tấm.",
      "Kết quả là tư vấn sơ bộ; khảo sát mái, che bóng và đấu nối sẽ quyết định phương án cuối.",
    ],
  };
}
