import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute } from "@/lib/router-compat";
import {
  Activity,
  ArrowDown,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Cable,
  Database,
  FileCheck2,
  FileText,
  Globe,
  Globe2,
  Layers,
  Loader2,
  Mail,
  Network,
  RefreshCcw,
  RotateCcw,
  Server,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard, TONE_BG, TONE_TEXT } from "@/components/common/StatCard";
import { ChartCard } from "@/components/common/ChartCard";
import { DetailDrawer } from "@/components/common/DetailDrawer";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DATA_FLOWS, INTEGRATION_LOGS, INTEGRATIONS } from "@/data/mock";
import { usePersistentState } from "@/lib/persist";
import type { IntegrationLog, IntegrationRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/integration")({
  head: () => ({
    meta: [
      { title: "Tích hợp dữ liệu | Nền tảng ngành Công Thương" },
      {
        name: "description",
        content:
          "Trạng thái tích hợp với các hệ thống phần mềm của đơn vị: eOffice (văn bản, OCR), LGSP, NDXP, Cổng DVC, CSDL chuyên ngành.",
      },
      { property: "og:title", content: "Tích hợp dữ liệu" },
      {
        property: "og:description",
        content: "Trạng thái tích hợp với các hệ thống phần mềm của đơn vị và nhật ký đồng bộ.",
      },
    ],
  }),
  component: Page,
});

const STATUS_ICON: Record<IntegrationRow["code"], LucideIcon> = {
  eOffice: FileText,
  LGSP: Network,
  NDXP: Globe,
  DVC: FileCheck2,
  "CSDL-CN": Database,
  PORTAL: Globe2,
  GATEWAY: Mail,
  DWH: Server,
};

const DIRECTION_META: Record<
  IntegrationRow["direction"],
  { label: string; icon: LucideIcon; cls: string }
> = {
  in: { label: "Nhận dữ liệu", icon: ArrowDownLeft, cls: "border-teal/30 bg-teal/10 text-teal" },
  out: { label: "Gửi dữ liệu", icon: ArrowUpRight, cls: "border-gov/30 bg-gov/10 text-gov" },
  both: { label: "Hai chiều", icon: ArrowLeftRight, cls: "border-navy/25 bg-navy/10 text-navy" },
};

const LOG_ACTION_TONE: Record<IntegrationLog["action"], string> = {
  "Đồng bộ thành công": "border-success/30 bg-success/10 text-success",
  "Đồng bộ thất bại": "border-destructive/30 bg-destructive/10 text-destructive",
  "Đối soát": "border-gov/30 bg-gov/10 text-gov",
  "Kiểm tra kết nối": "border-teal/30 bg-teal/10 text-teal",
  "Cập nhật cấu hình": "border-warning/40 bg-warning/15 text-warning",
};

function ConnectionBadge({ status }: { status: IntegrationRow["status"] }) {
  if (status === "connected") {
    return (
      <Badge className="rounded-md border-success/30 bg-success/10 font-medium text-success">
        <Activity className="size-3" /> Đã kết nối
      </Badge>
    );
  }
  if (status === "limited") {
    return (
      <Badge className="rounded-md border-warning/40 bg-warning/15 font-medium text-warning">
        <Activity className="size-3" /> Hạn chế
      </Badge>
    );
  }
  return (
    <Badge className="rounded-md border-destructive/30 bg-destructive/10 font-medium text-destructive">
      <Activity className="size-3" /> Lỗi
    </Badge>
  );
}

function formatNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-0.5 text-sm font-medium text-navy">{children}</div>
    </div>
  );
}

function Page() {
  const [rows, setRows, resetRows] = usePersistentState<IntegrationRow[]>(
    "integration.rows",
    INTEGRATIONS,
  );
  const [logs, setLogs, resetLogs] = usePersistentState<IntegrationLog[]>(
    "integration.logs",
    INTEGRATION_LOGS,
  );
  const [selected, setSelected] = useState<IntegrationRow | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const addLog = (log: Omit<IntegrationLog, "id" | "time">) => {
    const entry: IntegrationLog = { ...log, id: `IL-${Date.now()}`, time: formatNow() };
    setLogs((prev) => [entry, ...prev].slice(0, 120));
  };

  const syncSystem = (sys: IntegrationRow) => {
    if (syncingId) return;
    setSyncingId(sys.id);
    setTimeout(() => {
      const records = Math.floor(Math.random() * 60) + 10;
      setRows((prev) =>
        prev.map((r) =>
          r.id === sys.id ? { ...r, lastSync: formatNow(), status: "connected" } : r,
        ),
      );
      addLog({
        system: sys.system,
        code: sys.code,
        action: "Đồng bộ thành công",
        records,
        message: `Đồng bộ ${records} bản ghi từ "${sys.system}", kết nối ổn định.`,
        result: "SUCCESS",
      });
      setSyncingId(null);
      toast.success(`Đã đồng bộ "${sys.system}" (${records} bản ghi).`);
    }, 900);
  };

  const checkConnection = (sys: IntegrationRow) => {
    if (sys.status === "connected") {
      toast.success(`Kết nối "${sys.system}" hoạt động bình thường.`);
      addLog({
        system: sys.system,
        code: sys.code,
        action: "Kiểm tra kết nối",
        records: 0,
        message: `Kết nối "${sys.system}" thành công, độ trễ ${sys.latency}ms.`,
        result: "INFO",
      });
    } else if (sys.status === "limited") {
      toast.warning(`Kết nối "${sys.system}" đang hạn chế (độ trễ ${sys.latency}ms).`);
      addLog({
        system: sys.system,
        code: sys.code,
        action: "Kiểm tra kết nối",
        records: 0,
        message: `Phát hiện hạn chế ở "${sys.system}", cần rà soát.`,
        result: "INFO",
      });
    } else {
      toast.error(`Kết nối "${sys.system}" gặp lỗi.`);
      addLog({
        system: sys.system,
        code: sys.code,
        action: "Kiểm tra kết nối",
        records: 0,
        message: `Lỗi kết nối "${sys.system}": ${sys.lastError ?? "Không xác định"}.`,
        result: "FAILED",
      });
    }
  };

  const syncAll = () => {
    toast.info("Đang đồng bộ toàn bộ hệ thống tích hợp...");
    setTimeout(() => {
      const now = formatNow();
      setRows((prev) => prev.map((r) => ({ ...r, lastSync: now })));
      addLog({
        system: "Hệ thống",
        code: "ALL",
        action: "Đồng bộ thành công",
        records: rows.reduce((s, r) => s + r.success, 0),
        message: "Đồng bộ toàn bộ hệ thống tích hợp hoàn tất.",
        result: "SUCCESS",
      });
      toast.success("Đã đồng bộ tất cả hệ thống tích hợp.");
    }, 1200);
  };

  const resetAll = () => {
    resetRows();
    resetLogs();
    toast.info("Đã khôi phục trạng thái tích hợp về mặc định.");
  };

  const kpi = useMemo(
    () => ({
      total: rows.length,
      connected: rows.filter((r) => r.status === "connected").length,
      limited: rows.filter((r) => r.status === "limited").length,
      error: rows.filter((r) => r.status === "error").length,
      records: rows.reduce((s, r) => s + r.success + r.failed, 0),
    }),
    [rows],
  );

  const logColumns: Column<IntegrationLog>[] = [
    { key: "time", header: "Thời gian", sortable: true, className: "whitespace-nowrap" },
    { key: "system", header: "Hệ thống", sortable: true, className: "font-medium text-navy" },
    {
      key: "action",
      header: "Sự kiện",
      render: (l) => (
        <Badge className={cn("rounded-md border font-medium", LOG_ACTION_TONE[l.action])}>
          {l.action}
        </Badge>
      ),
    },
    {
      key: "records",
      header: "Số bản ghi",
      sortable: true,
      className: "text-right tabular-nums",
    },
    { key: "message", header: "Nội dung", className: "max-w-md" },
    {
      key: "result",
      header: "Kết quả",
      render: (l) =>
        l.result === "SUCCESS" ? (
          <Badge className="rounded-md border-success/30 bg-success/10 font-medium text-success">
            Thành công
          </Badge>
        ) : l.result === "FAILED" ? (
          <Badge className="rounded-md border-destructive/30 bg-destructive/10 font-medium text-destructive">
            Thất bại
          </Badge>
        ) : (
          <Badge className="rounded-md border-gov/30 bg-gov/10 font-medium text-gov">
            Thông tin
          </Badge>
        ),
    },
  ];

  const configColumns: Column<IntegrationRow>[] = [
    {
      key: "code",
      header: "Hệ thống",
      sortable: true,
      render: (r) => {
        const Icon = STATUS_ICON[r.code] ?? Cable;
        return (
          <span className="inline-flex items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-gov/10">
              <Icon className="size-3.5 text-gov" />
            </span>
            <span>
              <span className="block font-medium text-navy">{r.system}</span>
              <span className="block text-[11px] text-muted-foreground">{r.vendor}</span>
            </span>
          </span>
        );
      },
    },
    { key: "method", header: "Phương thức", sortable: true },
    {
      key: "endpoint",
      header: "Endpoint / Kết nối",
      render: (r) => (
        <code className="block max-w-56 truncate rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-gov">
          {r.endpoint}
        </code>
      ),
    },
    { key: "auth", header: "Xác thực", sortable: true },
    { key: "frequency", header: "Tần suất", sortable: true },
    { key: "owner", header: "Đơn vị chủ quản", sortable: true },
    {
      key: "status",
      header: "Trạng thái",
      render: (r) => <ConnectionBadge status={r.status} />,
    },
    {
      key: "actions",
      header: "Thao tác",
      className: "w-40",
      render: (r) => (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 px-2 text-xs text-gov hover:bg-gov/5"
            onClick={() => setSelected(r)}
          >
            Chi tiết
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2 text-xs"
            onClick={() => syncSystem(r)}
            disabled={syncingId === r.id}
          >
            {syncingId === r.id ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCcw className="size-3.5" />
            )}
            Đồng bộ
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Tích hợp dữ liệu"
        description="Trạng thái tích hợp với các hệ thống phần mềm của đơn vị — eOffice nhận văn bản điều hành để trích xuất OCR, đồng bộ với LGSP, NDXP, Cổng DVC, CSDL chuyên ngành."
        crumbs={[{ label: "Hệ thống" }, { label: "Tích hợp dữ liệu" }]}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => toast.success("Đã kiểm tra kết nối toàn bộ hệ thống tích hợp.")}
            >
              <Cable className="size-4" /> Kiểm tra kết nối
            </Button>
            <Button onClick={syncAll}>
              <RefreshCcw className="size-4" /> Đồng bộ tất cả
            </Button>
          </>
        }
      />

      <div className="space-y-5 p-4 sm:p-6">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Tổng kết nối" value={kpi.total} icon={Cable} tone="gov" />
          <StatCard label="Đã kết nối" value={kpi.connected} icon={Activity} tone="success" />
          <StatCard label="Đang hạn chế" value={kpi.limited} icon={ShieldCheck} tone="warning" />
          <StatCard label="Gặp lỗi" value={kpi.error} icon={Activity} tone="danger" />
          <StatCard
            label="Bản ghi đồng bộ tích lũy"
            value={kpi.records.toLocaleString("vi-VN")}
            icon={Layers}
            tone="teal"
          />
        </section>

        <Tabs defaultValue="systems">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="systems">Hệ thống tích hợp</TabsTrigger>
              <TabsTrigger value="flows">Luồng dữ liệu</TabsTrigger>
              <TabsTrigger value="logs">Nhật ký đồng bộ</TabsTrigger>
              <TabsTrigger value="config">Cấu hình &amp; API</TabsTrigger>
            </TabsList>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={resetAll}
            >
              <RotateCcw className="size-3.5" /> Khôi phục mặc định
            </Button>
          </div>

          <TabsContent value="systems" className="mt-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((sys) => {
                const Icon = STATUS_ICON[sys.code] ?? Cable;
                const dir = DIRECTION_META[sys.direction];
                const isSyncing = syncingId === sys.id;
                return (
                  <div
                    key={sys.id}
                    onClick={() => setSelected(sys)}
                    className="gov-card flex cursor-pointer flex-col gap-3 p-4 transition-colors hover:border-gov/50 hover:bg-surface"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-gov/10">
                        <Icon className="size-5 text-gov" strokeWidth={1.75} />
                      </span>
                      <ConnectionBadge status={sys.status} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-navy">{sys.system}</h3>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {sys.description}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        className={cn("rounded-md border font-medium", dir.cls)}
                        title={dir.label}
                      >
                        <dir.icon className="size-3" /> {dir.label}
                      </Badge>
                      <Badge variant="outline" className="rounded-md font-medium">
                        {sys.frequency}
                      </Badge>
                    </div>
                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md border border-border bg-surface px-2.5 py-1.5">
                        <dt className="text-[11px] text-muted-foreground">Đồng bộ gần nhất</dt>
                        <dd className="mt-0.5 font-medium tabular-nums text-navy">
                          {sys.lastSync}
                        </dd>
                      </div>
                      <div className="rounded-md border border-border bg-surface px-2.5 py-1.5">
                        <dt className="text-[11px] text-muted-foreground">Độ trễ</dt>
                        <dd className="mt-0.5 font-medium tabular-nums text-navy">
                          {sys.latency} ms
                        </dd>
                      </div>
                      <div className="rounded-md border border-border bg-surface px-2.5 py-1.5">
                        <dt className="text-[11px] text-muted-foreground">Thành công</dt>
                        <dd className="mt-0.5 font-medium tabular-nums text-success">
                          {sys.success.toLocaleString("vi-VN")}
                        </dd>
                      </div>
                      <div className="rounded-md border border-border bg-surface px-2.5 py-1.5">
                        <dt className="text-[11px] text-muted-foreground">Thất bại</dt>
                        <dd className="mt-0.5 font-medium tabular-nums text-destructive">
                          {sys.failed.toLocaleString("vi-VN")}
                        </dd>
                      </div>
                    </dl>
                    <div
                      className="mt-auto flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        className="flex-1 bg-gov text-white hover:bg-gov/90"
                        onClick={() => syncSystem(sys)}
                        disabled={isSyncing}
                      >
                        {isSyncing ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RefreshCcw className="size-3.5" />
                        )}
                        Đồng bộ ngay
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 px-2 text-xs"
                        onClick={() => checkConnection(sys)}
                      >
                        <Cable className="size-3.5" /> Kiểm tra
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="flows" className="mt-4 grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Dòng dữ liệu tổng thể"
              subtitle="Từ nguồn vào → xử lý OCR/AI → kho dữ liệu → khai thác & chia sẻ"
            >
              <div className="space-y-2">
                <FlowRow
                  label="Dữ liệu đầu vào"
                  nodes={[
                    {
                      title: "eOffice (QLVBĐH)",
                      subtitle: "Văn bản → OCR",
                      icon: FileText,
                      tone: "gov" as const,
                    },
                    {
                      title: "Cổng DVC",
                      subtitle: "Hồ sơ TTHC",
                      icon: FileCheck2,
                      tone: "teal" as const,
                    },
                    {
                      title: "LGSP",
                      subtitle: "Doanh nghiệp, giấy phép",
                      icon: Network,
                      tone: "success" as const,
                    },
                    {
                      title: "CSDL chuyên ngành",
                      subtitle: "Số liệu ngành",
                      icon: Database,
                      tone: "warning" as const,
                    },
                  ]}
                />
                <FlowArrow />
                <FlowRow
                  label="Xử lý & chuẩn hóa"
                  nodes={[
                    {
                      title: "OCR/AI trích xuất",
                      subtitle: "Nhận diện văn bản, chữ ký",
                      icon: FileText,
                      tone: "gov" as const,
                    },
                    {
                      title: "Chuẩn hóa / Staging",
                      subtitle: "Kiểm tra chất lượng, đối soát",
                      icon: Database,
                      tone: "navy" as const,
                    },
                  ]}
                />
                <FlowArrow />
                <FlowRow
                  label="Kho dữ liệu"
                  nodes={[
                    {
                      title: "Kho dữ liệu (DWH)",
                      subtitle: "CSDL ngành tập trung",
                      icon: Server,
                      tone: "teal" as const,
                    },
                  ]}
                />
                <FlowArrow />
                <FlowRow
                  label="Khai thác & chia sẻ"
                  nodes={[
                    {
                      title: "BI / Báo cáo",
                      subtitle: "Phân tích, KPI",
                      icon: Activity,
                      tone: "success" as const,
                    },
                    {
                      title: "LGSP",
                      subtitle: "Chia sẻ cấp tỉnh",
                      icon: Network,
                      tone: "gov" as const,
                    },
                    {
                      title: "NDXP",
                      subtitle: "Thống kê quốc gia",
                      icon: Globe,
                      tone: "navy" as const,
                    },
                    {
                      title: "Cổng thông tin",
                      subtitle: "Công khai nội dung",
                      icon: Globe2,
                      tone: "warning" as const,
                    },
                    {
                      title: "Email / SMS",
                      subtitle: "Thông báo doanh nghiệp",
                      icon: Mail,
                      tone: "teal" as const,
                    },
                  ]}
                />
              </div>
            </ChartCard>

            <ChartCard
              title="Chi tiết các luồng dữ liệu"
              subtitle="Luồng trao đổi giữa nền tảng và hệ thống đối tác"
            >
              <ul className="space-y-2.5">
                {DATA_FLOWS.map((f) => (
                  <li
                    key={f.id}
                    className="flex flex-col gap-2 rounded-md border border-border bg-surface px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-navy">{f.name}</p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{f.description}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <Badge variant="outline" className="rounded-md font-medium">
                        {f.source}
                      </Badge>
                      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                      <Badge variant="outline" className="rounded-md font-medium">
                        {f.target}
                      </Badge>
                      <ConnectionBadge status={f.status} />
                    </div>
                  </li>
                ))}
              </ul>
            </ChartCard>
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <DataTable
              columns={logColumns}
              rows={logs}
              searchPlaceholder="Tìm kiếm nhật ký theo hệ thống, sự kiện, nội dung..."
            />
          </TabsContent>

          <TabsContent value="config" className="mt-4">
            <DataTable
              columns={configColumns}
              rows={rows}
              searchPlaceholder="Tìm kiếm cấu hình theo hệ thống, phương thức, đơn vị chủ quản..."
            />
          </TabsContent>
        </Tabs>
      </div>

      <DetailDrawer
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
        title={selected?.system ?? ""}
        description={selected?.description ?? ""}
      >
        {selected ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <ConnectionBadge status={selected.status} />
              {(() => {
                const dir = DIRECTION_META[selected.direction];
                const DirIcon = dir.icon;
                return (
                  <Badge className={cn("rounded-md border font-medium", dir.cls)}>
                    <DirIcon className="size-3" />
                    {dir.label}
                  </Badge>
                );
              })()}
              <Badge variant="outline" className="rounded-md font-medium">
                {selected.method}
              </Badge>
            </div>

            {selected.lastError ? (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm">
                <Activity className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">Lỗi gần nhất</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{selected.lastError}</p>
                </div>
              </div>
            ) : null}

            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Mục đích tích hợp
              </p>
              <p className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-navy">
                {selected.purpose}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <InfoRow label="Đơn vị chủ quản">{selected.owner}</InfoRow>
              <InfoRow label="Nhà cung cấp">{selected.vendor}</InfoRow>
              <InfoRow label="Phương thức">{selected.method}</InfoRow>
              <InfoRow label="Xác thực">{selected.auth}</InfoRow>
              <InfoRow label="Tần suất đồng bộ">{selected.frequency}</InfoRow>
              <InfoRow label="Đồng bộ gần nhất">{selected.lastSync}</InfoRow>
              <InfoRow label="Đồng bộ kế tiếp">{selected.nextSync}</InfoRow>
              <InfoRow label="Độ trễ trung bình">{selected.latency} ms</InfoRow>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Endpoint
              </p>
              <code className="block break-all rounded-md border border-border bg-surface px-3 py-2.5 font-mono text-xs text-gov">
                {selected.endpoint}
              </code>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Loại dữ liệu trao đổi
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selected.dataTypes.map((t) => (
                  <Badge
                    key={t}
                    variant="outline"
                    className="rounded-md border-gov/25 bg-gov/5 font-medium text-gov"
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <InfoRow label="Bản ghi thành công">
                <span className="text-success">{selected.success.toLocaleString("vi-VN")}</span>
              </InfoRow>
              <InfoRow label="Bản ghi thất bại">
                <span className="text-destructive">{selected.failed.toLocaleString("vi-VN")}</span>
              </InfoRow>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1 bg-gov text-white hover:bg-gov/90"
                onClick={() => syncSystem(selected)}
                disabled={syncingId === selected.id}
              >
                {syncingId === selected.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCcw className="size-4" />
                )}
                Đồng bộ ngay
              </Button>
              <Button variant="outline" onClick={() => checkConnection(selected)}>
                <Cable className="size-4" /> Kiểm tra kết nối
              </Button>
            </div>
          </>
        ) : null}
      </DetailDrawer>
    </>
  );
}

function FlowRow({
  label,
  nodes,
}: {
  label: string;
  nodes: { title: string; subtitle: string; icon: LucideIcon; tone: keyof typeof TONE_BG }[];
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="w-44 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {nodes.map((n) => (
          <div
            key={n.title}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2"
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-md",
                TONE_BG[n.tone],
              )}
            >
              <n.icon className={cn("size-4", TONE_TEXT[n.tone])} />
            </span>
            <span>
              <span className="block text-sm font-medium leading-tight text-navy">{n.title}</span>
              {n.subtitle ? (
                <span className="block text-[11px] text-muted-foreground">{n.subtitle}</span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center gap-1 py-0.5 text-muted-foreground sm:ml-[13.75rem] sm:justify-start">
      <ArrowDown className="size-4" />
    </div>
  );
}
