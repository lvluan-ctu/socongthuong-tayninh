export type MissionReportKind = "executive" | "trend" | "risk";

export type MissionAlert = {
  id: string;
  title: string;
  severity: "danger" | "warning" | "info";
  message: string;
  recommendation: string;
  metric: string;
  status: string;
  lat?: number | null;
  lng?: number | null;
  imageUrl?: string | null;
};

export type MissionRecord = {
  id: string;
  code: string;
  name: string;
  category: string;
  status: string;
  metric: string;
  area: string;
};

export type MissionSummary = {
  taskId: number;
  title: string;
  description: string;
  coverage: string;
  coverageStatus?: "READY" | "EMPTY";
  updatedAt: string;
  kpis: Array<{ label: string; value: number; unit?: string }>;
  breakdown: Array<{ name: string; value: number }>;
  records: MissionRecord[];
  intelligence: null | {
    trendTitle: string;
    trendUnit: string;
    trend: Array<{ period: string; value: number }>;
    forecast: Array<{ period: string; value: number; min: number; max: number }>;
    forecastMethod: string;
    alerts: MissionAlert[];
    provenance: {
      sourceRecords: number;
      inferredRecords: number;
      observations: number;
      notes: string[];
    };
  };
};

export type MissionReportConfig = {
  missionTitle: string;
  executiveTitle: string;
  trendTitle: string;
  riskTitle: string;
  reportSubject: string;
  executiveLead: string;
  managementBasis: string[];
  decisionQuestions: string[];
  standingRecommendations: string[];
  analyticalFocus: string[];
  investmentBenefits: string[];
  implementationPriorities: string[];
};

export type MissionReportInsights = {
  topBreakdown: { name: string; value: number; sharePct: number } | null;
  totalBreakdown: number;
  latestActual: number | null;
  trendDeltaPct: number | null;
  trendDirection: "increase" | "decrease" | "stable" | "insufficient";
  forecastPeak: number | null;
  forecastAverage: number | null;
  dangerCount: number;
  warningCount: number;
  infoCount: number;
  dataConfidence: "high" | "medium" | "scenario";
  dataConfidenceLabel: string;
  executiveFindings: string[];
};
