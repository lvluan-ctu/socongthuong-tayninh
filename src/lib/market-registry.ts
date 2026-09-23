import enterpriseStatistics from "@/data/enterprise-statistics-summary.json";

const registryStatistics = {
  ...enterpriseStatistics,
  registeredEnterprisesLabel: `>= ${enterpriseStatistics.registeredEnterprisesLowerBound.toLocaleString("vi-VN")} doanh nghiep dang ky hoat dong`,
};

export { registryStatistics };
