import { useState } from "react";
import { LicenseTable } from "@/features/mineral/components/LicenseTable";
import { useQueryClient } from "@tanstack/react-query";

type MineralTab = "licenses" | "map" | "reports" | "alerts" | "vehicles";

function ComingSoon({ title, queryKey }: { title: string; queryKey: string }) {
  const queryClient = useQueryClient();
  return (
    <div className="rounded-md border border-border bg-card p-8 text-center">
      <p className="text-sm font-medium text-navy">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Phân hệ đang phát triển — dữ liệu mẫu sẽ được bổ sung sau khi có API trạm cân / GPS.
      </p>
      <button
        type="button"
        className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface"
        onClick={() => queryClient.invalidateQueries({ queryKey: [queryKey] })}
      >
        Tải lại
      </button>
    </div>
  );
}

export function MineralPage() {
  const [activeTab, setActiveTab] = useState<MineralTab>("licenses");
  const queryClient = useQueryClient();

  const handleTabChange = (tab: MineralTab) => {
    setActiveTab(tab);
    // Refresh data when tab changes
    const keyMap: Record<MineralTab, string> = {
      licenses: "mineralLicenses",
      map: "mineralMap",
      reports: "mineralReports",
      alerts: "mineralAlerts",
      vehicles: "mineralVehicles",
    };
    queryClient.invalidateQueries({ queryKey: [keyMap[tab]] });
  };

  return (
    <div className="min-h-screen">
      <h2 className="text-xl font-medium mb-4">Quản lý khai thác khoáng sản</h2>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <button
          onClick={() => handleTabChange("licenses")}
          className="flex-1 px-4 py-2 rounded-md border border-border bg-surface hover:bg-surface-strong focus:outline-none focus:ring-2 focus:ring-gov focus:ring-offset-background"
          aria-pressed={activeTab === "licenses"}
        >
          Danh sách GP
        </button>
        <button
          onClick={() => handleTabChange("map")}
          className="flex-1 px-4 py-2 rounded-md border border-border bg-surface hover:bg-surface-strong focus:outline-none focus:ring-2 focus:ring-gov focus:ring-offset-background"
          aria-pressed={activeTab === "map"}
        >
          Bản đồ
        </button>
        <button
          onClick={() => handleTabChange("reports")}
          className="flex-1 px-4 py-2 rounded-md border border-border bg-surface hover:bg-surface-strong focus:outline-none focus:ring-2 focus:ring-gov focus:ring-offset-background"
          aria-pressed={activeTab === "reports"}
        >
          Báo cáo khai thác
        </button>
        <button
          onClick={() => handleTabChange("alerts")}
          className="flex-1 px-4 py-2 rounded-md border border-border bg-surface hover:bg-surface-strong focus:outline-none focus:ring-2 focus:ring-gov focus:ring-offset-background"
          aria-pressed={activeTab === "alerts"}
        >
          Cảnh báo
        </button>
        <button
          onClick={() => handleTabChange("vehicles")}
          className="flex-1 px-4 py-2 rounded-md border border-border bg-surface hover:bg-surface-strong focus:outline-none focus:ring-2 focus:ring-gov focus:ring-offset-background"
          aria-pressed={activeTab === "vehicles"}
        >
          Phương tiện
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "licenses" && (
        <LicenseTable
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ["mineralLicenses"] })}
        />
      )}

      {activeTab === "map" && <ComingSoon title="Bản đồ mỏ & trạm cân" queryKey="mineralMap" />}

      {activeTab === "reports" && (
        <ComingSoon title="Báo cáo khai thác" queryKey="mineralReports" />
      )}

      {activeTab === "alerts" && <ComingSoon title="Trung tâm cảnh báo" queryKey="mineralAlerts" />}

      {activeTab === "vehicles" && (
        <ComingSoon title="Giám sát phương tiện" queryKey="mineralVehicles" />
      )}
    </div>
  );
}
