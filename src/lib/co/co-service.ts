import type {
  CoApplication,
  CoKpis,
  CoChartData,
  CoTaxComparison,
  CoImportBatch,
} from "./co-types";
import { CO_FTA_MAP, CO_FORMS_MAP, CO_COUNTRIES_MAP, CO_TARIFF_MAP } from "./co-constants";

import CO_APPLICATIONS_DATA from "@/data/co-applications.json";
import CO_IMPORTS_DATA from "@/data/co-sample-imports.json";

const applications = CO_APPLICATIONS_DATA as unknown as CoApplication[];
const imports = CO_IMPORTS_DATA as unknown as CoImportBatch[];

export function computeCoKpis(data: CoApplication[] = applications): CoKpis {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const totalValue = data.reduce(
    (sum, app) => sum + app.items.reduce((s, item) => s + item.fobValue, 0),
    0,
  );

  let totalSavings = 0;
  for (const app of data) {
    for (const item of app.items) {
      const tariff = CO_TARIFF_MAP.get(item.hsCode);
      if (tariff) {
        const mfn = tariff.mfnRate / 100;
        const ftaRate = getFtaRate(tariff, app.ftaCode) / 100;
        totalSavings += item.fobValue * (mfn - ftaRate);
      }
    }
  }

  const pendingCount = data.filter(
    (a) => a.status === "SUBMITTED" || a.status === "PROCESSING",
  ).length;

  const issuedThisMonth = data.filter((a) => {
    if (!a.coIssuedDate) return false;
    const d = new Date(a.coIssuedDate);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  }).length;

  const byFtaMap = new Map<string, { count: number; value: number }>();
  for (const app of data) {
    const existing = byFtaMap.get(app.ftaCode) ?? { count: 0, value: 0 };
    existing.count += 1;
    existing.value += app.items.reduce((s, item) => s + item.fobValue, 0);
    byFtaMap.set(app.ftaCode, existing);
  }

  const byFta = Array.from(byFtaMap.entries()).map(([fta, dataFta]) => ({
    fta,
    ...dataFta,
  }));

  return {
    totalApplications: data.length,
    totalValue,
    totalSavings,
    pendingCount,
    issuedThisMonth,
    byFta,
  };
}

export function buildCoChartData(data: CoApplication[] = applications): CoChartData {
  const monthlyMap = new Map<string, { count: number; value: number }>();
  const countryMap = new Map<string, { count: number; value: number }>();
  const ftaMap = new Map<string, { count: number; value: number }>();
  const statusMap = new Map<string, number>();

  for (const app of data) {
    const month = app.createdAt.slice(0, 7);
    const mEntry = monthlyMap.get(month) ?? { count: 0, value: 0 };
    mEntry.count += 1;
    mEntry.value += app.items.reduce((s, item) => s + item.fobValue, 0);
    monthlyMap.set(month, mEntry);

    const cEntry = countryMap.get(app.consignee.country) ?? { count: 0, value: 0 };
    cEntry.count += 1;
    cEntry.value += app.items.reduce((s, item) => s + item.fobValue, 0);
    countryMap.set(app.consignee.country, cEntry);

    const fEntry = ftaMap.get(app.ftaCode) ?? { count: 0, value: 0 };
    fEntry.count += 1;
    fEntry.value += app.items.reduce((s, item) => s + item.fobValue, 0);
    ftaMap.set(app.ftaCode, fEntry);

    statusMap.set(app.status, (statusMap.get(app.status) ?? 0) + 1);
  }

  return {
    monthlyTrend: Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data })),
    byCountry: Array.from(countryMap.entries())
      .map(([country, data]) => {
        const c = CO_COUNTRIES_MAP.get(country);
        return { country: c?.name ?? country, ...data };
      })
      .sort((a, b) => b.value - a.value),
    byFta: Array.from(ftaMap.entries())
      .map(([fta, data]) => {
        const f = CO_FTA_MAP.get(fta);
        return { fta: f?.shortName ?? fta, ...data };
      })
      .sort((a, b) => b.value - a.value),
    byStatus: Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
    })),
  };
}

export function filterApplications(
  params: {
    search?: string;
    status?: string;
    ftaCode?: string;
    formCode?: string;
    dateFrom?: string;
    dateTo?: string;
  },
  data: CoApplication[] = applications,
): CoApplication[] {
  let result = [...data];

  if (params.search) {
    const q = params.search.toLowerCase();
    result = result.filter(
      (a) =>
        a.applicationNo.toLowerCase().includes(q) ||
        a.exporter.name.toLowerCase().includes(q) ||
        a.consignee.name.toLowerCase().includes(q) ||
        a.coNumber?.toLowerCase().includes(q),
    );
  }

  if (params.status) {
    result = result.filter((a) => a.status === params.status);
  }

  if (params.ftaCode) {
    result = result.filter((a) => a.ftaCode === params.ftaCode);
  }

  if (params.formCode) {
    result = result.filter((a) => a.formCode === params.formCode);
  }

  if (params.dateFrom) {
    const from = params.dateFrom;
    result = result.filter((a) => a.createdAt >= from);
  }

  if (params.dateTo) {
    const to = params.dateTo;
    result = result.filter((a) => a.createdAt <= to + "T23:59:59Z");
  }

  return result;
}

export function calculateTaxComparison(hsCode: string): CoTaxComparison | null {
  const tariff = CO_TARIFF_MAP.get(hsCode);
  if (!tariff) return null;

  const ftaEntries: [string, string, number][] = [
    ["ATIGA", "D", tariff.atiga],
    ["ACFTA", "E", tariff.acfta],
    ["AKFTA", "AK", tariff.akfta],
    ["CPTPP", "CPTPP", tariff.cptpp],
    ["EVFTA", "EUR.1", tariff.evfta],
    ["RCEP", "RCEP", tariff.rcep],
    ["AANZFTA", "AANZ", tariff.aanz],
    ["AIFTA", "AI", tariff.ai],
  ];

  const options = ftaEntries
    .filter(([, , rate]) => rate < tariff.mfnRate)
    .map(([fta, formCO, rate]) => ({
      fta,
      formCO,
      rate,
      savings: tariff.mfnRate - rate,
      savingsPercent:
        tariff.mfnRate > 0 ? Math.round(((tariff.mfnRate - rate) / tariff.mfnRate) * 100) : 0,
    }))
    .sort((a, b) => a.rate - b.rate);

  const bestOption = options.length > 0 ? options[0].fta : "Khong co FTA";

  return {
    hsCode,
    description: tariff.description,
    mfnRate: tariff.mfnRate,
    options,
    bestOption,
  };
}

export function getImportBatches(): CoImportBatch[] {
  return imports;
}

function getFtaRate(
  tariff: { mfnRate: number; atiga: number; acfta: number; akfta: number; cptpp: number; evfta: number; rcep: number; aanz: number; ai: number },
  ftaCode: string,
): number {
  switch (ftaCode) {
    case "ATIGA":
      return tariff.atiga;
    case "ACFTA":
      return tariff.acfta;
    case "AKFTA":
      return tariff.akfta;
    case "CPTPP":
      return tariff.cptpp;
    case "EVFTA":
      return tariff.evfta;
    case "RCEP":
      return tariff.rcep;
    case "AANZFTA":
      return tariff.aanz;
    case "AIFTA":
      return tariff.ai;
    default:
      return tariff.mfnRate;
  }
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}
