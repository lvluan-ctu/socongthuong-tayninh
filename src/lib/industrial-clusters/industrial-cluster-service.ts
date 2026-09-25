import type {
  ClusterDossier,
  ClusterDossierStatus,
  InvestmentMilestone,
  InvestmentMilestoneStatus,
  ClusterReport,
  ReportType,
  ReportStatus,
  LandFundDetail,
  DocumentAttachment,
  DocumentType,
  WardZoneIndustrial,
  IndustrialUser,
} from "./industrial-cluster-types";
import { CLUSTER_STATUS_LABELS } from "./industrial-cluster-types";
import { STANDARD_MILESTONES } from "./industrial-cluster-constants";
import { CLUSTERS } from "@/data/mock";
import { WARD_ZONES, wardZoneById } from "@/data/industrial-zones";
import OFFICIAL_SUMMARY from "@/data/industrial-clusters-summary.json";
import { getCurrentUser, hasPermission, getVisibleClusters } from "./rbac";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultLandFund(cluster: typeof CLUSTERS[0]): LandFundDetail {
  const total = cluster.area;
  const leased = cluster.leased;
  const unleased = total - leased;
  const sectors = cluster.sectors.split(/[–\-/]/).map((s) => s.trim()).filter(Boolean);

  return {
    totalArea: total,
    industrialLand: Math.round(total * 0.75),
    serviceLand: Math.round(total * 0.1),
    greenLand: Math.round(total * 0.08),
    trafficLand: Math.round(total * 0.07),
    vacantLand: unleased,
    leasedLand: leased,
    unleasedLand: unleased,
    byFunctionZone: sectors.map((s, i) => ({
      zone: s,
      area: Math.round((total / sectors.length) * (1 + (i % 3) * 0.1)),
      leased: Math.round((leased / sectors.length) * (1 + (i % 3) * 0.1)),
      occupancy: Math.min(100, Math.round((leased / total) * 100 + (i % 3) * 5)),
    })),
  };
}

function createStandardMilestones(clusterId: string): InvestmentMilestone[] {
  return STANDARD_MILESTONES.map((m, i) => ({
    ...m,
    id: generateId("ms"),
    clusterId,
    progressPercent: i < 2 ? 100 : i < 5 ? 60 : i < 8 ? 30 : 0,
    status: i < 2 ? "COMPLETED" : i < 5 ? "IN_PROGRESS" : "NOT_STARTED",
    attachments: [],
    createdBy: "system",
    updatedAt: new Date().toISOString(),
  }));
}

function createEmptyLandFund(): LandFundDetail {
  return {
    totalArea: 0,
    industrialLand: 0,
    serviceLand: 0,
    greenLand: 0,
    trafficLand: 0,
    vacantLand: 0,
    leasedLand: 0,
    unleasedLand: 0,
    byFunctionZone: [],
  };
}

const mockDossiers: ClusterDossier[] = CLUSTERS.map((c) => {
  const ward = WARD_ZONES.find((w) => w.clusters.includes(c.id));
  return {
    id: c.id,
    name: c.name,
    district: c.district,
    ward: c.ward,
    wardId: ward?.id ?? "",
    area: c.area,
    leased: c.leased,
    enterprises: c.enterprises,
    sectors: c.sectors,
    occupancy: c.occupancy,
    status: (c.status === "locked"
      ? "OPERATING"
      : c.status === "pending"
        ? "DRAFT"
        : "INFRA_CONSTRUCTION") as ClusterDossierStatus,
    lat: c.lat,
    lng: c.lng,
    geometry: c.geometry,
    investor: c.investor,
    infrastructure: c.infrastructure,
    dossierCode: `CCN/${c.id.toUpperCase()}/2024`,
    decisionEstablish: `QĐ-${c.id}/UBND`,
    decisionDate: "2024-05-15",
    planningDoc: "QĐ 2968/QĐ-UBND",
    landUseCert: `GCN-${c.id}`,
    envImpactAssessment: `DGT-${c.id}`,
    milestones: createStandardMilestones(c.id),
    overallProgress: c.status === "locked" ? 100 : c.status === "approved" ? 65 : c.status === "pending" ? 10 : 30,
    landCompensationProgress: c.status === "locked" ? 100 : c.status === "approved" ? 80 : 20,
    infraConstructionProgress: c.status === "locked" ? 100 : c.status === "approved" ? 70 : 15,
    landFund: createDefaultLandFund(c),
    reports: [],
    documents: [],
    managedByWardId: ward?.id,
    createdBy: "system",
    updatedBy: "system",
    createdAt: "2024-01-15T08:00:00Z",
    updatedAt: new Date().toISOString(),
  };
});

const MOCK_WARDS: WardZoneIndustrial[] = WARD_ZONES.map((w) => ({
  id: w.id,
  name: w.name,
  type: w.type,
  lat: w.lat,
  lng: w.lng,
  approxRadiusM: w.approxRadiusM,
  clusters: w.clusters,
  note: w.note,
}));

const dossiers = [...mockDossiers];
const wards = [...MOCK_WARDS];

export interface ClusterDashboardSnapshot {
  total: number;
  active: number;
  constructing: number;
  planned: number;
  totalArea: number;
  totalLeased: number;
  totalEnterprises: number;
  occupancy: number;
  completedInfrastructureOccupancy: number;
  remainingIndustrialLand: number;
  investmentProjects: number;
  fdiProjects: number;
  promotingInvestment: number;
  detailCoverage: number;
  source: string;
  sourceUrl: string;
  asOf: string;
  byWard: Array<{
    wardId: string;
    wardName: string;
    clusterCount: number;
    totalArea: number;
    totalLeased: number;
    occupancy: number;
  }>;
}

export function getAllDossiers(): ClusterDossier[] {
  return dossiers;
}

export function getDossierById(id: string): ClusterDossier | undefined {
  return dossiers.find((d) => d.id === id);
}

export function getDossiersByWard(wardId: string): ClusterDossier[] {
  return dossiers.filter((d) => d.wardId === wardId);
}

export function getDossiersByStatus(status: ClusterDossierStatus): ClusterDossier[] {
  return dossiers.filter((d) => d.status === status);
}

export function getDossiersByInvestor(investorId: string): ClusterDossier[] {
  return dossiers.filter((d) => d.investor?.includes(investorId));
}

export function createDossier(data: Partial<ClusterDossier>): ClusterDossier {
  const ward = wards.find((w) => w.id === data.wardId);
  const newDossier: ClusterDossier = {
    id: generateId("ccn"),
    name: data.name ?? "",
    district: data.district ?? "",
    ward: ward?.name ?? "",
    wardId: data.wardId ?? "",
    area: data.area ?? 0,
    leased: 0,
    enterprises: 0,
    sectors: data.sectors ?? "",
    occupancy: 0,
    status: "DRAFT",
    lat: data.lat ?? 0,
    lng: data.lng ?? 0,
    investor: data.investor,
    infrastructure: [
      { name: "Giao thông", level: 0, note: "" },
      { name: "Điện", level: 0, note: "" },
      { name: "Nước", level: 0, note: "" },
      { name: "Viễn thông", level: 0, note: "" },
      { name: "Thoát nước", level: 0, note: "" },
      { name: "Xử lý nước thải", level: 0, note: "" },
    ],
    dossierCode: `CCN/${generateId("").slice(0, 6).toUpperCase()}/2024`,
    milestones: createStandardMilestones(""),
    overallProgress: 0,
    landCompensationProgress: 0,
    infraConstructionProgress: 0,
    landFund: createEmptyLandFund(),
    reports: [],
    documents: [],
    managedByWardId: data.wardId,
    createdBy: getCurrentUser().id,
    updatedBy: getCurrentUser().id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  dossiers.push(newDossier);
  return newDossier;
}

export function updateDossier(id: string, data: Partial<ClusterDossier>): ClusterDossier | null {
  const idx = dossiers.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  dossiers[idx] = { ...dossiers[idx], ...data, updatedBy: getCurrentUser().id, updatedAt: new Date().toISOString() };
  return dossiers[idx];
}

export function deleteDossier(id: string): boolean {
  const idx = dossiers.findIndex((d) => d.id === id);
  if (idx === -1) return false;
  dossiers.splice(idx, 1);
  return true;
}

export function getAllWards(): WardZoneIndustrial[] {
  return wards;
}

export function getClusterDashboardSnapshot(): ClusterDashboardSnapshot {
  const totalArea = dossiers.reduce((sum, dossier) => sum + dossier.area, 0);
  const totalLeased = dossiers.reduce((sum, dossier) => sum + dossier.leased, 0);
  const totalEnterprises = dossiers.reduce((sum, dossier) => sum + dossier.enterprises, 0);
  const byWard = wards.map((ward) => {
    const wardDossiers = dossiers.filter((dossier) => dossier.wardId === ward.id);
    const wardArea = wardDossiers.reduce((sum, dossier) => sum + dossier.area, 0);
    const wardLeased = wardDossiers.reduce((sum, dossier) => sum + dossier.leased, 0);
    return {
      wardId: ward.id,
      wardName: ward.name,
      clusterCount: wardDossiers.length,
      totalArea: wardArea,
      totalLeased: wardLeased,
      occupancy: wardArea > 0 ? Math.round((wardLeased / wardArea) * 100) : 0,
    };
  }).filter((ward) => ward.clusterCount > 0);

  return {
    total: OFFICIAL_SUMMARY.plannedClusters,
    active: OFFICIAL_SUMMARY.operatingClusters,
    constructing: OFFICIAL_SUMMARY.underInvestmentClusters,
    planned: OFFICIAL_SUMMARY.promotingInvestmentClusters,
    totalArea: OFFICIAL_SUMMARY.plannedAreaHa,
    totalLeased: OFFICIAL_SUMMARY.leasedAreaHa,
    totalEnterprises: OFFICIAL_SUMMARY.investmentProjects,
    occupancy: OFFICIAL_SUMMARY.occupancyPct,
    completedInfrastructureOccupancy: OFFICIAL_SUMMARY.completedInfrastructureOccupancyPct,
    remainingIndustrialLand: OFFICIAL_SUMMARY.remainingIndustrialLandHa,
    investmentProjects: OFFICIAL_SUMMARY.investmentProjects,
    fdiProjects: OFFICIAL_SUMMARY.fdiProjects,
    promotingInvestment: OFFICIAL_SUMMARY.promotingInvestmentClusters,
    detailCoverage: Math.min(OFFICIAL_SUMMARY.detailCoverage, dossiers.length),
    source: OFFICIAL_SUMMARY.source,
    sourceUrl: OFFICIAL_SUMMARY.sourceUrl,
    asOf: OFFICIAL_SUMMARY.asOf,
    byWard,
  };
}

export function getWardById(id: string): WardZoneIndustrial | undefined {
  return wards.find((w) => w.id === id);
}

export function addMilestone(clusterId: string, milestone: Omit<InvestmentMilestone, "id" | "clusterId" | "createdBy" | "updatedAt">): InvestmentMilestone {
  const dossier = dossiers.find((d) => d.id === clusterId);
  if (!dossier) throw new Error("Cluster not found");
  const newMs: InvestmentMilestone = {
    ...milestone,
    id: generateId("ms"),
    clusterId,
    createdBy: getCurrentUser().id,
    updatedAt: new Date().toISOString(),
  };
  dossier.milestones.push(newMs);
  dossier.updatedAt = new Date().toISOString();
  dossier.updatedBy = getCurrentUser().id;
  return newMs;
}

export function updateMilestone(clusterId: string, milestoneId: string, data: Partial<InvestmentMilestone>): InvestmentMilestone | null {
  const dossier = dossiers.find((d) => d.id === clusterId);
  if (!dossier) return null;
  const msIdx = dossier.milestones.findIndex((m) => m.id === milestoneId);
  if (msIdx === -1) return null;
  dossier.milestones[msIdx] = { ...dossier.milestones[msIdx], ...data, updatedAt: new Date().toISOString() };
  dossier.updatedAt = new Date().toISOString();
  dossier.updatedBy = getCurrentUser().id;
  recalcProgress(dossier);
  return dossier.milestones[msIdx];
}

export function deleteMilestone(clusterId: string, milestoneId: string): boolean {
  const dossier = dossiers.find((d) => d.id === clusterId);
  if (!dossier) return false;
  const msIdx = dossier.milestones.findIndex((m) => m.id === milestoneId);
  if (msIdx === -1) return false;
  dossier.milestones.splice(msIdx, 1);
  dossier.updatedAt = new Date().toISOString();
  dossier.updatedBy = getCurrentUser().id;
  recalcProgress(dossier);
  return true;
}

function recalcProgress(dossier: ClusterDossier): void {
  if (dossier.milestones.length === 0) {
    dossier.overallProgress = 0;
    return;
  }
  const completed = dossier.milestones.filter((m) => m.status === "COMPLETED").length;
  dossier.overallProgress = Math.round((completed / dossier.milestones.length) * 100);
}

export function addDocument(clusterId: string, doc: Omit<DocumentAttachment, "id" | "uploadedAt" | "uploadedBy">): DocumentAttachment {
  const dossier = dossiers.find((d) => d.id === clusterId);
  if (!dossier) throw new Error("Cluster not found");
  const newDoc: DocumentAttachment = {
    ...doc,
    id: generateId("doc"),
    uploadedAt: new Date().toISOString(),
    uploadedBy: getCurrentUser().id,
  };
  dossier.documents.push(newDoc);
  dossier.updatedAt = new Date().toISOString();
  dossier.updatedBy = getCurrentUser().id;
  return newDoc;
}

export function deleteDocument(clusterId: string, docId: string): boolean {
  const dossier = dossiers.find((d) => d.id === clusterId);
  if (!dossier) return false;
  const idx = dossier.documents.findIndex((d) => d.id === docId);
  if (idx === -1) return false;
  dossier.documents.splice(idx, 1);
  dossier.updatedAt = new Date().toISOString();
  dossier.updatedBy = getCurrentUser().id;
  return true;
}

export function createReport(data: Omit<ClusterReport, "id" | "createdBy" | "createdAt">): ClusterReport {
  const newReport: ClusterReport = {
    ...data,
    id: generateId("rpt"),
    createdBy: getCurrentUser().id,
    createdAt: new Date().toISOString(),
  };
  const dossier = dossiers.find((d) => d.id === data.clusterId);
  if (dossier) {
    dossier.reports.push(newReport);
    dossier.updatedAt = new Date().toISOString();
    dossier.updatedBy = getCurrentUser().id;
  }
  return newReport;
}

export function updateReport(clusterId: string, reportId: string, data: Partial<ClusterReport>): ClusterReport | null {
  const dossier = dossiers.find((d) => d.id === clusterId);
  if (!dossier) return null;
  const idx = dossier.reports.findIndex((r) => r.id === reportId);
  if (idx === -1) return null;
  dossier.reports[idx] = { ...dossier.reports[idx], ...data };
  dossier.updatedAt = new Date().toISOString();
  dossier.updatedBy = getCurrentUser().id;
  return dossier.reports[idx];
}

export function getReportsByCluster(clusterId: string): ClusterReport[] {
  const dossier = dossiers.find((d) => d.id === clusterId);
  return dossier?.reports ?? [];
}

export function getReportsByType(reportType: ReportType): ClusterReport[] {
  return dossiers.flatMap((d) => d.reports.filter((r) => r.reportType === reportType));
}

export function getReportsByStatus(status: ReportStatus): ClusterReport[] {
  return dossiers.flatMap((d) => d.reports.filter((r) => r.status === status));
}

export function getReportsByPeriod(period: string): ClusterReport[] {
  return dossiers.flatMap((d) => d.reports.filter((r) => r.period === period));
}

export function getVisibleDossiers(user?: IndustrialUser): ClusterDossier[] {
  const u = user ?? getCurrentUser();
  if (hasPermission("cluster:read", u) && u.role !== "WARD_STAFF" && u.role !== "INVESTOR_STAFF") {
    return dossiers;
  }
  if (u.role === "WARD_STAFF" && u.wardId) {
    return dossiers.filter((d) => d.wardId === u.wardId);
  }
  if (u.role === "INVESTOR_STAFF" && u.investorId) {
    return dossiers.filter((d) => d.investor?.includes(u.investorId!));
  }
  return dossiers;
}

export function getClusterStats(): {
  total: number;
  byStatus: Record<ClusterDossierStatus, number>;
  totalArea: number;
  totalLeased: number;
  totalEnterprises: number;
  avgOccupancy: number;
} {
  const byStatus: Record<ClusterDossierStatus, number> = {
    DRAFT: 0,
    SUBMITTED: 0,
    UNDER_REVIEW: 0,
    APPROVED: 0,
    INVESTOR_SELECTING: 0,
    INFRA_CONSTRUCTION: 0,
    OPERATING: 0,
    EXPANDING: 0,
    SUSPENDED: 0,
    DISSOLVED: 0,
  };
  let totalArea = 0;
  let totalLeased = 0;
  let totalEnterprises = 0;
  let occupancySum = 0;

  for (const d of dossiers) {
    byStatus[d.status]++;
    totalArea += d.area;
    totalLeased += d.leased;
    totalEnterprises += d.enterprises;
    occupancySum += d.occupancy;
  }

  return {
    total: dossiers.length,
    byStatus,
    totalArea,
    totalLeased,
    totalEnterprises,
    avgOccupancy: dossiers.length > 0 ? Math.round(occupancySum / dossiers.length) : 0,
  };
}

export function getMilestonesByCluster(clusterId: string): InvestmentMilestone[] {
  const dossier = dossiers.find((d) => d.id === clusterId);
  return dossier?.milestones ?? [];
}

export function getDocumentsByCluster(clusterId: string): DocumentAttachment[] {
  const dossier = dossiers.find((d) => d.id === clusterId);
  return dossier?.documents ?? [];
}

export function getMilestonesByStatus(status: InvestmentMilestoneStatus): InvestmentMilestone[] {
  return dossiers.flatMap((d) => d.milestones.filter((m) => m.status === status));
}

export function getUpcomingMilestones(days: number = 30): InvestmentMilestone[] {
  const now = new Date();
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return dossiers
    .flatMap((d) => d.milestones)
    .filter((m) => {
      if (m.status === "COMPLETED") return false;
      const planned = new Date(m.plannedDate);
      return planned >= now && planned <= future;
    })
    .sort((a, b) => new Date(a.plannedDate).getTime() - new Date(b.plannedDate).getTime());
}

export function getOverdueMilestones(): InvestmentMilestone[] {
  const now = new Date();
  return dossiers
    .flatMap((d) => d.milestones)
    .filter((m) => m.status !== "COMPLETED" && new Date(m.plannedDate) < now)
    .sort((a, b) => new Date(a.plannedDate).getTime() - new Date(b.plannedDate).getTime());
}