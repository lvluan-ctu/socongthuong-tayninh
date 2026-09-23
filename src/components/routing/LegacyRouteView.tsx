"use client";

import { notFound, useRouter, usePathname } from "next/navigation";
import { createElement, useEffect, type ComponentType } from "react";

import { Route as AdminRoute } from "@/routes/admin";
import { Route as AnalyticsRoute } from "@/routes/analytics";
import { Route as DataManagementRoute } from "@/routes/data-management";
import { Route as EnergyChargingStationsRoute } from "@/routes/energy.charging-stations";
import { Route as EnergyConsumptionRoute } from "@/routes/energy.consumption";
import { Route as EnergyCarbonRoute } from "@/routes/energy.carbon";
import { Route as EnergyGisRoute } from "@/routes/energy.gis";
import { Route as EnergyGridSafetyRoute } from "@/routes/energy.grid-safety";
import { Route as EnergyGridRoute } from "@/routes/energy.grid";
import { Route as EnergyTask1Route } from "@/routes/energy.nhiem-vu-1";
import { Route as EnergyTask2Route } from "@/routes/energy.nhiem-vu-2";
import { Route as EnergyTask3Route } from "@/routes/energy.nhiem-vu-3";
import { Route as EnergyTask4Route } from "@/routes/energy.nhiem-vu-4";
import { Route as EnergyTask5Route } from "@/routes/energy.nhiem-vu-5";
import { Route as EnergyTask6Route } from "@/routes/energy.nhiem-vu-6";
import { Route as EnergyTask7Route } from "@/routes/energy.nhiem-vu-7";
import { Route as EnergyTask8Route } from "@/routes/energy.nhiem-vu-8";
import { Route as EnergyProjectsRoute } from "@/routes/energy.projects";
import { Route as EnergyRooftopSolarRoute } from "@/routes/energy.rooftop-solar";
import { Route as EnergyRoute } from "@/routes/energy";
import { Route as EnterpriseRoute } from "@/routes/enterprises/$id";
import { Route as GisMapRoute } from "@/routes/gis.map";
import { Route as HomeRoute } from "@/routes/index";
import { Route as CoRoute } from "@/routes/co";
import { Route as ImportExportRoute } from "@/routes/import-export";
import { Route as IndustrialClustersRoute } from "@/routes/industrial-clusters";
import { Route as IntegrationRoute } from "@/routes/integration";
import { Route as MarketRoute } from "@/routes/market";
import { Route as PlatformOverviewRoute } from "@/routes/platform-overview";
import { Route as TradePromotionRoute } from "@/routes/trade-promotion";
import { Route as PortalInvestmentRoute } from "@/routes/trang-thong-tin/dau-tu.$slug";
import { Route as PortalLeadershipRoute } from "@/routes/trang-thong-tin/lanh-dao-don-vi";
import { Route as PortalEventRoute } from "@/routes/trang-thong-tin/su-kien.$slug";
import { Route as PortalNewsRoute } from "@/routes/trang-thong-tin/tin.$slug";
import { Route as PortalRoute } from "@/routes/trang-thong-tin";
import { MissionAiWorkspace } from "@/components/energy/MissionAiWorkspace";
import { MissionManagementWorkspace } from "@/components/energy/MissionManagementWorkspace";
import { MissionReportWorkspace } from "@/components/energy/MissionReportWorkspace";

type RouteModule = { options: { component: ComponentType } };

const exactRoutes: Record<string, RouteModule> = {
  "/": HomeRoute,
  "/admin": AdminRoute,
  "/analytics": AnalyticsRoute,
  "/data-management": DataManagementRoute,
  "/energy": EnergyRoute,
  "/energy/carbon": EnergyCarbonRoute,
  "/energy/charging-stations": EnergyChargingStationsRoute,
  "/energy/consumption": EnergyConsumptionRoute,
  "/energy/gis": EnergyGisRoute,
  "/energy/grid": EnergyGridRoute,
  "/energy/grid-safety": EnergyGridSafetyRoute,
  "/energy/nhiem-vu-1": EnergyTask1Route,
  "/energy/nhiem-vu-2": EnergyTask2Route,
  "/energy/nhiem-vu-3": EnergyTask3Route,
  "/energy/nhiem-vu-4": EnergyTask4Route,
  "/energy/nhiem-vu-5": EnergyTask5Route,
  "/energy/nhiem-vu-6": EnergyTask6Route,
  "/energy/nhiem-vu-7": EnergyTask7Route,
  "/energy/nhiem-vu-8": EnergyTask8Route,
  "/energy/nhiem-vu-8/quan-ly": { options: { component: EnergyTask8ManagementRoute } },
  "/energy/nhiem-vu-8/ai": { options: { component: EnergyTask8AiRoute } },
  "/energy/nhiem-vu-8/bao-cao": { options: { component: EnergyTask8ReportRoute } },
  "/energy/projects": EnergyProjectsRoute,
  "/energy/rooftop-solar": EnergyRooftopSolarRoute,
  "/gis/map": GisMapRoute,
  "/co": CoRoute,
  "/import-export": ImportExportRoute,
  "/industrial-clusters": IndustrialClustersRoute,
  "/industry-database": { options: { component: IndustryDatabaseRedirect } },
  "/integration": IntegrationRoute,
  "/market": MarketRoute,
  "/platform-overview": PlatformOverviewRoute,
  "/trade-promotion": TradePromotionRoute,
  "/trang-thong-tin": PortalRoute,
  "/trang-thong-tin/lanh-dao-don-vi": PortalLeadershipRoute,
};

const dynamicRoutes: Array<{ pattern: RegExp; route: RouteModule }> = [
  { pattern: /^\/energy\/nhiem-vu-\d+\/quan-ly$/, route: { options: { component: MissionManagementRoute } } },
  { pattern: /^\/energy\/nhiem-vu-\d+\/ai$/, route: { options: { component: MissionAiRoute } } },
  { pattern: /^\/energy\/nhiem-vu-\d+\/bao-cao$/, route: { options: { component: MissionReportRoute } } },
  { pattern: /^\/enterprises\/[^/]+$/, route: EnterpriseRoute },
  { pattern: /^\/trang-thong-tin\/tin\/[^/]+$/, route: PortalNewsRoute },
  { pattern: /^\/trang-thong-tin\/su-kien\/[^/]+$/, route: PortalEventRoute },
  { pattern: /^\/trang-thong-tin\/dau-tu\/[^/]+$/, route: PortalInvestmentRoute },
];

function useMissionTaskId() {
  const match = /\/energy\/nhiem-vu-(\d+)\//.exec(usePathname() || "");
  return Number(match?.[1] ?? 0);
}

function MissionManagementRoute() {
  return <MissionManagementWorkspace taskId={useMissionTaskId()} />;
}

function MissionAiRoute() {
  return <MissionAiWorkspace taskId={useMissionTaskId()} />;
}

function MissionReportRoute() {
  return <MissionReportWorkspace taskId={useMissionTaskId()} />;
}

function EnergyTask8ManagementRoute() {
  return <MissionManagementWorkspace taskId={8} />;
}

function EnergyTask8AiRoute() {
  return <MissionAiWorkspace taskId={8} />;
}

function EnergyTask8ReportRoute() {
  return <MissionReportWorkspace taskId={8} />;
}

/** /industry-database đã gộp vào /co (tab Doanh nghiệp) — giữ link cũ hoạt động. */
function IndustryDatabaseRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/co?tab=doanh-nghiep");
  }, [router]);
  return (
    <div className="p-6 text-sm text-muted-foreground">
      Đang chuyển hướng đến C/O · Dữ liệu doanh nghiệp…
    </div>
  );
}

export function LegacyRouteView() {
  const currentPathname = usePathname() || "/";
  const pathname = currentPathname === "/" ? "/" : currentPathname.replace(/\/+$/, "");
  const route =
    exactRoutes[pathname] ?? dynamicRoutes.find((candidate) => candidate.pattern.test(pathname))?.route;

  if (!route && pathname === "/energy/nhiem-vu-8/quan-ly") {
    return <EnergyTask8ManagementRoute />;
  }
  if (!route && pathname === "/energy/nhiem-vu-8/ai") {
    return <EnergyTask8AiRoute />;
  }
  if (!route && pathname === "/energy/nhiem-vu-8/bao-cao") {
    return <EnergyTask8ReportRoute />;
  }
  if (!route) notFound();
  return createElement(route.options.component);
}
