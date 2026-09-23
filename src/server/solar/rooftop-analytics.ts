import { desc, eq, inArray, ne, sql } from 'drizzle-orm';
import {
  energyAdminAreas,
  energyCustomerAccounts,
  energyCustomerGridServiceLinks,
  energyParties,
  energyRooftopGenerationMonthly,
  energyRooftopSystems,
  energySites,
  energySolarAssessments,
} from '@/db/schema';
import { db } from '@/lib/db';

export type RooftopAnalyticsArea = {
  code: string;
  name: string;
  level: string | null;
  installedCustomers: number;
  installedSystems: number;
  installedKwp: number;
  inverterKw: number;
  batteryKwh: number;
  annualGenerationKwh: number;
  potentialAssessments: number;
  potentialKwp: number;
  gridConstrainedPotentialKwp: number;
  gridHeadroomKw: number;
};

type AnalyticsSystem = {
  assetId: string;
  customerAccountId: string | null;
  customerType: string | null;
  adminAreaCode: string | null;
  installedCapacityKwp: string;
  inverterCapacityKw: string | null;
  batteryCapacityKwh: string | null;
  annualYieldKwh: string | null;
  operationStatus: string;
};

type PotentialAssessment = {
  id: string;
  customerAccountId: string;
  customerCode: string;
  customerName: string;
  customerType: string | null;
  adminAreaCode: string | null;
  assessedAt: Date;
  recommendedCapacityKwp: string;
  availableGridCapacityKw: string | null;
  score: string | null;
  status: string;
  methodVersion: string;
  factors: Record<string, unknown>;
};

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function asNumber(value: string | number | null | undefined) {
  return value == null ? 0 : Number(value);
}

function isInstalled(status: string) {
  return ['ACTIVE', 'MAINTENANCE', 'OFFLINE'].includes(status);
}

function areaKey(code: string | null) { return code || 'UNMAPPED'; }

export async function loadRooftopAnalytics(year = new Date().getUTCFullYear()) {
  const resolvedAdminArea = sql<string | null>`COALESCE(${energySites.adminAreaCode}, (SELECT aa.code FROM energy_admin_areas aa WHERE aa.boundary IS NOT NULL AND ${energySites.location} IS NOT NULL AND ST_Intersects(aa.boundary, (${energySites.location})::geometry) LIMIT 1))`;
  const [systems, monthlyGeneration, assessments, adminAreas, serviceLinks] = await Promise.all([
    db.select({
      assetId: energyRooftopSystems.assetId,
      customerAccountId: energyRooftopSystems.customerAccountId,
      customerType: energyCustomerAccounts.customerType,
      adminAreaCode: resolvedAdminArea,
      installedCapacityKwp: energyRooftopSystems.installedCapacityKwp,
      inverterCapacityKw: energyRooftopSystems.inverterCapacityKw,
      batteryCapacityKwh: energyRooftopSystems.batteryCapacityKwh,
      annualYieldKwh: energyRooftopSystems.annualYieldKwh,
      operationStatus: energyRooftopSystems.operationStatus,
    }).from(energyRooftopSystems)
      .leftJoin(energyCustomerAccounts, eq(energyCustomerAccounts.id, energyRooftopSystems.customerAccountId))
      .leftJoin(energySites, eq(energySites.id, energyCustomerAccounts.siteId))
      .where(ne(energyRooftopSystems.operationStatus, 'DELETED')),
    db.select({ systemAssetId: energyRooftopGenerationMonthly.systemAssetId, period: energyRooftopGenerationMonthly.period, energyGeneratedKwh: energyRooftopGenerationMonthly.energyGeneratedKwh })
      .from(energyRooftopGenerationMonthly)
      .where(sql`${energyRooftopGenerationMonthly.period} LIKE ${`${year}-%`}`)
      .orderBy(desc(energyRooftopGenerationMonthly.period)),
    db.select({
      id: energySolarAssessments.id,
      customerAccountId: energySolarAssessments.customerAccountId,
      customerCode: energyCustomerAccounts.customerCode,
      customerName: energyParties.name,
      customerType: energyCustomerAccounts.customerType,
      adminAreaCode: resolvedAdminArea,
      assessedAt: energySolarAssessments.assessedAt,
      recommendedCapacityKwp: energySolarAssessments.recommendedCapacityKwp,
      availableGridCapacityKw: energySolarAssessments.availableGridCapacityKw,
      score: energySolarAssessments.score,
      status: energySolarAssessments.status,
      methodVersion: energySolarAssessments.methodVersion,
      factors: energySolarAssessments.factors,
    }).from(energySolarAssessments)
      .innerJoin(energyCustomerAccounts, eq(energyCustomerAccounts.id, energySolarAssessments.customerAccountId))
      .innerJoin(energyParties, eq(energyParties.id, energyCustomerAccounts.partyId))
      .leftJoin(energySites, eq(energySites.id, energyCustomerAccounts.siteId))
      .where(inArray(energySolarAssessments.status, ['DRAFT', 'REVIEWED', 'APPROVED']))
      .orderBy(desc(energySolarAssessments.assessedAt)),
    db.select({ code: energyAdminAreas.code, name: energyAdminAreas.name, level: energyAdminAreas.level }).from(energyAdminAreas),
    db.select({ customerAccountId: energyCustomerGridServiceLinks.customerAccountId, feederAssetId: energyCustomerGridServiceLinks.feederAssetId, bayAssetId: energyCustomerGridServiceLinks.bayAssetId, transformerAssetId: energyCustomerGridServiceLinks.transformerAssetId, substationAssetId: energyCustomerGridServiceLinks.substationAssetId, validFrom: energyCustomerGridServiceLinks.validFrom, validTo: energyCustomerGridServiceLinks.validTo, isInferred: energyCustomerGridServiceLinks.isInferred, createdAt: energyCustomerGridServiceLinks.createdAt }).from(energyCustomerGridServiceLinks).orderBy(desc(energyCustomerGridServiceLinks.validFrom), desc(energyCustomerGridServiceLinks.createdAt)),
  ]);

  const areaMeta = new Map(adminAreas.map((area) => [area.code, area]));
  const generatedBySystem = new Map<string, number>();
  for (const row of monthlyGeneration) generatedBySystem.set(row.systemAssetId, (generatedBySystem.get(row.systemAssetId) ?? 0) + asNumber(row.energyGeneratedKwh));

  const installedAccounts = new Set(systems.filter((system) => isInstalled(system.operationStatus) && system.customerAccountId).map((system) => system.customerAccountId as string));
  const latestAssessmentByAccount = new Map<string, PotentialAssessment>();
  for (const row of assessments) {
    if (!latestAssessmentByAccount.has(row.customerAccountId)) latestAssessmentByAccount.set(row.customerAccountId, row as PotentialAssessment);
  }
  const potential = Array.from(latestAssessmentByAccount.values()).filter((assessment) => !installedAccounts.has(assessment.customerAccountId));

  const rows = new Map<string, RooftopAnalyticsArea>();
  function getArea(code: string | null) {
    const key = areaKey(code);
    const existing = rows.get(key);
    if (existing) return existing;
    const meta = areaMeta.get(key);
    const created: RooftopAnalyticsArea = { code: key, name: meta?.name ?? (key === 'UNMAPPED' ? 'Chưa xác định địa bàn' : key), level: meta?.level ?? null, installedCustomers: 0, installedSystems: 0, installedKwp: 0, inverterKw: 0, batteryKwh: 0, annualGenerationKwh: 0, potentialAssessments: 0, potentialKwp: 0, gridConstrainedPotentialKwp: 0, gridHeadroomKw: 0 };
    rows.set(key, created);
    return created;
  }

  const accountsByArea = new Map<string, Set<string>>();
  for (const system of systems as AnalyticsSystem[]) {
    if (!isInstalled(system.operationStatus)) continue;
    const area = getArea(system.adminAreaCode);
    area.installedSystems += 1;
    area.installedKwp += asNumber(system.installedCapacityKwp);
    area.inverterKw += asNumber(system.inverterCapacityKw);
    area.batteryKwh += asNumber(system.batteryCapacityKwh);
    const generation = generatedBySystem.get(system.assetId);
    area.annualGenerationKwh += generation == null ? asNumber(system.annualYieldKwh) : generation;
    if (system.customerAccountId) {
      const accountSet = accountsByArea.get(area.code) ?? new Set<string>();
      accountSet.add(system.customerAccountId);
      accountsByArea.set(area.code, accountSet);
    }
  }
  for (const [code, accountSet] of accountsByArea) getArea(code).installedCustomers = accountSet.size;

  for (const assessment of potential) {
    const area = getArea(assessment.adminAreaCode);
    const capacity = asNumber(assessment.recommendedCapacityKwp);
    const grid = assessment.availableGridCapacityKw == null ? null : asNumber(assessment.availableGridCapacityKw);
    area.potentialAssessments += 1;
    area.potentialKwp += capacity;
    if (grid != null && grid < capacity) area.gridConstrainedPotentialKwp += Math.max(0, capacity - grid);
    if (grid != null) area.gridHeadroomKw += grid;
  }

  const areaRows = Array.from(rows.values()).map((row) => ({
    ...row,
    installedKwp: round(row.installedKwp, 3),
    inverterKw: round(row.inverterKw, 3),
    batteryKwh: round(row.batteryKwh, 3),
    annualGenerationKwh: round(row.annualGenerationKwh, 3),
    potentialKwp: round(row.potentialKwp, 3),
    gridConstrainedPotentialKwp: round(row.gridConstrainedPotentialKwp, 3),
    gridHeadroomKw: round(row.gridHeadroomKw, 3),
  })).sort((a, b) => b.installedKwp - a.installedKwp || b.potentialKwp - a.potentialKwp || a.name.localeCompare(b.name, 'vi'));

  const summary = areaRows.reduce((total, row) => ({
    installedCustomers: total.installedCustomers + row.installedCustomers,
    activeSystems: total.activeSystems + row.installedSystems,
    installedKwp: total.installedKwp + row.installedKwp,
    inverterKw: total.inverterKw + row.inverterKw,
    batteryKwh: total.batteryKwh + row.batteryKwh,
    annualGenerationKwh: total.annualGenerationKwh + row.annualGenerationKwh,
    potentialAssessments: total.potentialAssessments + row.potentialAssessments,
    potentialKwp: total.potentialKwp + row.potentialKwp,
    gridConstrainedPotentialKwp: total.gridConstrainedPotentialKwp + row.gridConstrainedPotentialKwp,
    gridHeadroomKw: total.gridHeadroomKw + row.gridHeadroomKw,
  }), { installedCustomers: 0, activeSystems: 0, installedKwp: 0, inverterKw: 0, batteryKwh: 0, annualGenerationKwh: 0, potentialAssessments: 0, potentialKwp: 0, gridConstrainedPotentialKwp: 0, gridHeadroomKw: 0 });

  const currentPotential = potential.map((assessment) => ({
    ...assessment,
    recommendedCapacityKwp: asNumber(assessment.recommendedCapacityKwp),
    availableGridCapacityKw: assessment.availableGridCapacityKw == null ? null : asNumber(assessment.availableGridCapacityKw),
    score: assessment.score == null ? null : asNumber(assessment.score),
    gridConstrained: assessment.availableGridCapacityKw != null && asNumber(assessment.availableGridCapacityKw) < asNumber(assessment.recommendedCapacityKwp),
  })).sort((a, b) => b.recommendedCapacityKwp - a.recommendedCapacityKwp);

  return {
    year,
    generatedAt: new Date().toISOString(),
    summary: {
      ...summary,
      installedKwp: round(summary.installedKwp, 3),
      inverterKw: round(summary.inverterKw, 3),
      batteryKwh: round(summary.batteryKwh, 3),
      annualGenerationKwh: round(summary.annualGenerationKwh, 3),
      potentialKwp: round(summary.potentialKwp, 3),
      gridConstrainedPotentialKwp: round(summary.gridConstrainedPotentialKwp, 3),
      gridHeadroomKw: round(summary.gridHeadroomKw, 3),
    },
    areas: areaRows,
    potential: currentPotential,
    dataQuality: {
      systemsWithoutAdminArea: systems.filter((system) => !system.adminAreaCode).length,
      assessmentsWithoutAdminArea: assessments.filter((assessment) => !assessment.adminAreaCode).length,
      serviceLinks: serviceLinks.length,
      inferredServiceLinks: serviceLinks.filter((link) => link.isInferred).length,
      monthlyGenerationRows: monthlyGeneration.length,
      note: 'Địa bàn được lấy từ site.admin_area_code; nếu thiếu sẽ fallback spatial join PostGIS và gắn UNMAPPED khi không xác định được.',
    },
  };
}
