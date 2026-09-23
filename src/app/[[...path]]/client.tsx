"use client";

import dynamic from "next/dynamic";

const LegacyRouteView = dynamic(
  () => import("@/components/routing/LegacyRouteView").then((mod) => mod.LegacyRouteView),
  { ssr: false },
);

export function ClientOnlyRoute() {
  return <LegacyRouteView />;
}
