"use client";

import type { ComponentProps } from "react";
import { useEffect, useState } from "react";
import { Alert, Box, Tabs } from "@mantine/core";
import { IconList, IconPlus } from "@tabler/icons-react";
import { Database, FileText, TableProperties, Workflow } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { MissionDataCatalog } from "@/components/energy/MissionDataCatalog";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router-compat";
import { SubstationForm } from "@/features/grid/substations/SubstationForm";
import { SubstationTable } from "@/features/grid/substations/SubstationTable";
import { GenerationProjectForm } from "@/features/generation/projects/GenerationProjectForm";
import { GenerationProject360 } from "@/features/generation/projects/GenerationProject360";
import { GenerationProjectsTable } from "@/features/generation/projects/GenerationProjectsTable";
import { RooftopSystemsWorkspace } from "@/features/solar-advisor/RooftopSystemsWorkspace";
import { EfficiencyConsumerRegistry } from "@/features/efficiency/EfficiencyConsumerRegistry";
import { SafetyOperationsWorkspace } from "@/features/safety/SafetyOperationsWorkspace";
import { CarbonSourceRegistryWorkspace } from "@/features/carbon/CarbonSourceRegistryWorkspace";
import { EvStationsWorkspace } from "@/features/ev/EvStationsWorkspace";
import { OilOperationsWorkspace } from "@/components/energy/OilOperationsWorkspace";

const TITLES: Record<number, string> = {
  1: "Hạ tầng lưới điện",
  2: "Nguồn năng lượng tái tạo",
  3: "Điện mặt trời mái nhà",
  4: "Sử dụng năng lượng hiệu quả",
  5: "An toàn điện và hành lang lưới",
  6: "Kiểm kê khí nhà kính",
  7: "Hạ tầng trạm sạc xe điện",
  8: "Quản lý hạ tầng dầu khí",
};

type GenerationRecords = ComponentProps<typeof GenerationProjectsTable>["initialRecords"];

function GenerationManagement() {
  const [records, setRecords] = useState<GenerationRecords>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void fetch("/api/generation/projects?page=1&pageSize=25", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { items?: GenerationRecords; pagination?: { total?: number }; message?: string };
        if (!response.ok) throw new Error(payload.message ?? "Không thể tải danh mục dự án.");
        if (controller.signal.aborted) return;
        setRecords(payload.items ?? []);
        setTotal(payload.pagination?.total ?? 0);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Không thể tải danh mục dự án.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  if (selectedProject) {
    return (
      <div>
        <Button variant="outline" size="sm" className="mb-4" onClick={() => setSelectedProject(null)}>← Về danh sách dự án</Button>
        <GenerationProject360 assetId={selectedProject} />
      </div>
    );
  }

  return (
    <Tabs defaultValue="list" keepMounted={false}>
      <Tabs.List mb="lg">
        <Tabs.Tab value="list" leftSection={<IconList size={16} />}>Danh sách dự án</Tabs.Tab>
        <Tabs.Tab value="create" leftSection={<IconPlus size={16} />}>Thêm dự án</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="list">
        {error ? <Alert color="red">{error}</Alert> : null}
        {loading ? <Box py="xl">Đang tải dữ liệu…</Box> : <GenerationProjectsTable initialRecords={records} totalRecords={total} partyNames={{}} onOpen={setSelectedProject} />}
      </Tabs.Panel>
      <Tabs.Panel value="create"><GenerationProjectForm /></Tabs.Panel>
    </Tabs>
  );
}

function GridManagement() {
  return (
    <Tabs defaultValue="list" keepMounted={false}>
      <Tabs.List mb="lg">
        <Tabs.Tab value="list" leftSection={<IconList size={16} />}>Danh sách trạm</Tabs.Tab>
        <Tabs.Tab value="create" leftSection={<IconPlus size={16} />}>Thêm trạm</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="list"><SubstationTable /></Tabs.Panel>
      <Tabs.Panel value="create"><SubstationForm /></Tabs.Panel>
    </Tabs>
  );
}

function WorkspaceForTask({ taskId }: { taskId: number }) {
  switch (taskId) {
    case 1: return <GridManagement />;
    case 2: return <GenerationManagement />;
    case 3: return <RooftopSystemsWorkspace />;
    case 4: return <EfficiencyConsumerRegistry />;
    case 5: return <SafetyOperationsWorkspace />;
    case 6: return <CarbonSourceRegistryWorkspace />;
    case 7: return <EvStationsWorkspace />;
    case 8: return <OilOperationsWorkspace />;
    default: return <Alert color="red">Nhiệm vụ không tồn tại.</Alert>;
  }
}

export function MissionManagementWorkspace({ taskId }: { taskId: number }) {
  const [activeTab, setActiveTab] = useState("workflow");

  return (
    <div className="min-h-full bg-surface">
      <PageHeader
        title={`Quản lý dữ liệu nhiệm vụ ${taskId}`}
        description={TITLES[taskId] ?? "Dữ liệu năng lượng"}
        variant="panel"
        icon={Database}
        crumbs={[
          { label: "Năng lượng", to: "/energy" },
          { label: `Nhiệm vụ ${taskId}`, to: `/energy/nhiem-vu-${taskId}` },
          { label: "Quản lý dữ liệu" },
        ]}
        actions={<><Button variant="outline" size="sm" onClick={() => setActiveTab("catalog")}><TableProperties className="size-4" /> Bộ lọc dữ liệu</Button><Button variant="outline" size="sm" asChild><Link to={`/energy/nhiem-vu-${taskId}`}>Về dashboard</Link></Button><Button variant="outline" size="sm" asChild><Link to={`/energy/nhiem-vu-${taskId}/bao-cao`}><FileText className="size-4" /> Báo cáo</Link></Button></>}
      />
      <main className="px-2 pb-8 sm:px-4 lg:px-6">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <Tabs value={activeTab} onChange={(value) => setActiveTab(value ?? "workflow")} keepMounted={false}>
            <Tabs.List mb="lg">
              <Tabs.Tab value="workflow" leftSection={<Workflow size={16} />}>
                Nghiệp vụ chính
              </Tabs.Tab>
              <Tabs.Tab value="catalog" leftSection={<TableProperties size={16} />}>
                Toàn bộ bảng dữ liệu
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="workflow">
              <WorkspaceForTask taskId={taskId} />
            </Tabs.Panel>
            <Tabs.Panel value="catalog">
              <MissionDataCatalog taskId={taskId} />
            </Tabs.Panel>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
