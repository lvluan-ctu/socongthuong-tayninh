export const INVESTMENT_TYPES = [
  "INDUSTRIAL",
  "LOGISTICS",
  "COMMERCIAL",
  "EV_HUB",
  "RENEWABLE",
] as const;

export type InvestmentType = (typeof INVESTMENT_TYPES)[number];

export const INVESTMENT_TYPE_LABELS: Record<InvestmentType, string> = {
  INDUSTRIAL: "Nhà máy / sản xuất",
  LOGISTICS: "Logistics / kho vận",
  COMMERCIAL: "Thương mại / dịch vụ",
  EV_HUB: "Trung tâm sạc xe điện",
  RENEWABLE: "Năng lượng tái tạo",
};

export type AssessmentGrade = "FAVORABLE" | "CONDITIONAL" | "REVIEW_REQUIRED";
export type CoverageStatus = "AVAILABLE" | "LIMITED" | "NO_RECORDS";

export interface InvestmentAssessmentQuery {
  lat?: number;
  lng?: number;
  address?: string;
  radiusKm: number;
  investmentType: InvestmentType;
  expectedDemandKw: number;
  landAreaHa: number;
  roofAreaM2: number;
}

export interface AssessmentBreakdownItem {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  status: "GOOD" | "WATCH" | "LIMITED";
  summary: string;
  evidence: string[];
}

export interface NearbyProject {
  id: string;
  code: string;
  name: string;
  sourceType: string;
  status: string;
  capacityMw: number;
  distanceKm: number;
  lat: number | null;
  lng: number | null;
}

export interface NearbySubstation {
  id: string;
  code: string;
  name: string;
  voltageKv: number;
  installedCapacityMva: number;
  currentLoadMva: number;
  availableCapacityMva: number;
  feederHeadroomMw: number;
  assessedAvailableMw: number;
  loadFactorPct: number;
  status: string;
  distanceKm: number;
  lat: number | null;
  lng: number | null;
}

export interface NearbyLine {
  id: string;
  code: string;
  name: string;
  voltageKv: number;
  capacityMw: number;
  currentLoadMw: number;
  headroomMw: number;
  loadFactorPct: number;
  distanceKm: number;
  lat: number | null;
  lng: number | null;
}

export interface NearbyRooftopSystem {
  id: string;
  code: string;
  name: string;
  owner: string;
  capacityKwp: number;
  status: string;
  distanceKm: number;
  lat: number | null;
  lng: number | null;
}

export interface NearbyEvStation {
  id: string;
  code: string;
  name: string;
  powerKw: number;
  connectors: number;
  availableConnectors: number;
  status: string;
  distanceKm: number;
  lat: number | null;
  lng: number | null;
}

export interface NearbySafetyEvent {
  id: string;
  kind: "GRID_INCIDENT" | "CORRIDOR_VIOLATION";
  code: string;
  name: string;
  severity: string;
  status: string;
  occurredAt: string | null;
  distanceKm: number;
  lat: number | null;
  lng: number | null;
}

export interface NearbyEmissionSource {
  id: string;
  code: string;
  name: string;
  sourceType: string;
  scope: string;
  status: string;
  recordedCo2eTonnes: number;
  latestPeriod: string | null;
  reportingObligations: number;
  distanceKm: number;
  lat: number | null;
  lng: number | null;
}

export interface NearbyConsumer {
  id: string;
  code: string;
  name: string;
  sector: string;
  classification: string;
  importanceLevel: string;
  reportedEnergyMwh: number;
  distanceKm: number;
  lat: number | null;
  lng: number | null;
}

export interface InvestmentScenario {
  id: "CONSERVATIVE" | "BASE" | "GROWTH";
  label: string;
  status: "READY" | "CONDITIONAL" | "CAPACITY_REVIEW";
  score: number;
  demandKw: number;
  gridCoveragePct: number;
  rooftopKwp: number;
  rooftopAnnualOutputMwh: number;
  renewableCoveragePct: number;
  estimatedAnnualCo2eTonnes: number;
  headline: string;
  rationale: string[];
}

export interface InvestmentProcedure {
  step: number;
  title: string;
  agency: string;
  status: "READY" | "SCREENING" | "CONFIRMATION_REQUIRED";
  description: string;
  requiredInputs: string[];
}

export interface InvestmentDataCoverage {
  domain: string;
  label: string;
  records: number;
  status: CoverageStatus;
  note: string;
}

export interface InvestmentAssumption {
  key: string;
  label: string;
  value: string;
  source: string;
  classification: "DATABASE" | "PLANNING_ASSUMPTION" | "DERIVED";
}

export interface InvestmentAssessmentResponse {
  location: {
    lat: number;
    lng: number;
    inputAddress: string | null;
    displayName: string | null;
    adminArea: { code: string; name: string; level: string } | null;
    radiusKm: number;
  };
  profile: {
    investmentType: InvestmentType;
    investmentTypeLabel: string;
    expectedDemandKw: number;
    landAreaHa: number;
    roofAreaM2: number;
  };
  assessment: {
    score: number;
    grade: AssessmentGrade;
    label: string;
    decision: "PROCEED_TO_FEASIBILITY" | "PROCEED_WITH_CONDITIONS" | "SURVEY_REQUIRED";
    conclusion: string;
    strengths: string[];
    constraints: string[];
    recommendations: string[];
    disclaimer: string;
  };
  scoreBreakdown: AssessmentBreakdownItem[];
  metrics: {
    projects: number;
    generationCapacityMw: number;
    substations: number;
    availableCapacityMva: number;
    gridHeadroomKw: number;
    estimatedConnectionHeadroomKw: number;
    demandCoveragePct: number;
    nearestSubstationKm: number | null;
    lines: number;
    nearestLineKm: number | null;
    maxVoltageKv: number;
    hasHighVoltageGrid: boolean;
    has220Kv: boolean;
    threePhaseReadiness: "AVAILABLE_PRELIMINARY" | "LIMITED" | "SURVEY_REQUIRED";
    rooftopSystems: number;
    rooftopCapacityMw: number;
    rooftopPotentialKwp: number;
    rooftopAnnualOutputMwh: number;
    renewableCoveragePct: number;
    activeIncidents: number;
    incidents12Months: number;
    corridorViolations: number;
    outagePlans12Months: number;
    stabilityIndex: number;
    evStations: number;
    evPowerKw: number;
    evConnectors: number;
    evAvailableConnectors: number;
    nearestEvStationKm: number | null;
    emissionSources: number;
    recordedCo2eTonnes: number;
    pendingReportingObligations: number;
    estimatedAnnualElectricityMwh: number;
    estimatedOperationalCo2eTonnes: number;
    emissionFactorKgPerKwh: number;
    consumers: number;
    keyConsumers: number;
  };
  nearby: {
    projects: NearbyProject[];
    substations: NearbySubstation[];
    lines: NearbyLine[];
    rooftopSystems: NearbyRooftopSystem[];
    evStations: NearbyEvStation[];
    safetyEvents: NearbySafetyEvent[];
    emissionSources: NearbyEmissionSource[];
    consumers: NearbyConsumer[];
  };
  scenarios: InvestmentScenario[];
  procedures: InvestmentProcedure[];
  dataCoverage: InvestmentDataCoverage[];
  assumptions: InvestmentAssumption[];
  generatedAt: string;
  source: "postgresql-postgis";
}
