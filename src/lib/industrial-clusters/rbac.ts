import type { IndustrialUser, IndustrialUserRole } from "./industrial-cluster-types";
import { ROLE_PERMISSIONS } from "./industrial-cluster-constants";

const MOCK_USER: IndustrialUser = {
  id: "user-001",
  name: "Nguyễn Văn Admin",
  role: "ADMIN",
  permissions: ["*"],
};

export function getCurrentUser(): IndustrialUser {
  return MOCK_USER;
}

export function hasPermission(permission: string, user?: IndustrialUser): boolean {
  const u = user ?? getCurrentUser();
  if (u.permissions.includes("*")) return true;
  const rolePerms = ROLE_PERMISSIONS[u.role] ?? [];
  return rolePerms.includes(permission) || rolePerms.includes("*");
}

export function canReadCluster(clusterId: string, user?: IndustrialUser): boolean {
  const u = user ?? getCurrentUser();
  if (hasPermission("cluster:read", u)) return true;
  return false;
}

export function canUpdateCluster(clusterId: string, user?: IndustrialUser): boolean {
  const u = user ?? getCurrentUser();
  if (hasPermission("cluster:update", u)) return true;
  if (u.role === "INVESTOR_STAFF" && u.investorId) return true;
  return false;
}

export function canDeleteCluster(clusterId: string, user?: IndustrialUser): boolean {
  return hasPermission("cluster:delete", user);
}

export function canCreateReport(reportType: string, user?: IndustrialUser): boolean {
  return hasPermission("report:create", user);
}

export function canSubmitReport(reportType: string, user?: IndustrialUser): boolean {
  return hasPermission("report:submit", user);
}

export function canApproveReport(reportType: string, user?: IndustrialUser): boolean {
  return hasPermission("report:approve", user);
}

export function canManageMilestones(clusterId: string, user?: IndustrialUser): boolean {
  return hasPermission("milestone:update", user);
}

export function canUploadDocument(clusterId: string, user?: IndustrialUser): boolean {
  return hasPermission("document:upload", user);
}

export function getVisibleClusters(
  allClusters: { id: string; wardId?: string; investorId?: string }[],
  user?: IndustrialUser
): { id: string }[] {
  const u = user ?? getCurrentUser();
  if (hasPermission("cluster:read", u) && u.role !== "WARD_STAFF" && u.role !== "INVESTOR_STAFF") {
    return allClusters;
  }
  if (u.role === "WARD_STAFF" && u.wardId) {
    return allClusters.filter((c) => c.wardId === u.wardId);
  }
  if (u.role === "INVESTOR_STAFF" && u.investorId) {
    return allClusters.filter((c) => c.investorId === u.investorId);
  }
  return [];
}

export function isWardStaff(user?: IndustrialUser): boolean {
  return (user ?? getCurrentUser()).role === "WARD_STAFF";
}

export function isInvestorStaff(user?: IndustrialUser): boolean {
  return (user ?? getCurrentUser()).role === "INVESTOR_STAFF";
}

export function isProvinceStaff(user?: IndustrialUser): boolean {
  return (user ?? getCurrentUser()).role === "PROVINCE_STAFF";
}

export function isAdmin(user?: IndustrialUser): boolean {
  return (user ?? getCurrentUser()).role === "ADMIN";
}