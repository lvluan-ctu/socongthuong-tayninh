import { useMemo, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import {
  Building2,
  CalendarClock,
  Download,
  Factory,
  FileCheck2,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatCard } from "@/components/common/StatCard";
import { FilterBar } from "@/components/common/FilterBar";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ChartCard } from "@/components/common/ChartCard";
import { AlertCard } from "@/components/common/AlertCard";
import { Button } from "@/components/ui/button";
import { ENTERPRISES, EXPIRING_LICENSES, OPERATION_ALERTS } from "@/data/mock";
import { DISTRICTS, SECTORS, STATUS_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ENTERPRISE_STATISTICS from "@/data/enterprise-statistics-summary.json";

type Row = (typeof ENTERPRISES)[number];

const OPERATIONAL_STATUS = ["Tất cả", "Đang hoạt động", "Tạm ngừng"];
const ALERT_ITEMS = OPERATION_ALERTS.slice(0, 3);
const ENTERPRISE_SUMMARY = ENTERPRISE_STATISTICS;

const DAY_MS = 86_400_000;
const daysUntil = (iso: string) =>
  Math.ceil((new Date(`${iso}T00:00:00`).getTime() - Date.now()) / DAY_MS);
const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const enterpriseColumns: Column<Row>[] = [
  { key: "name", header: "Doanh nghiệp", sortable: true },
  { key: "taxCode", header: "MST", sortable: true },
  { key: "sector", header: "Lĩnh vực", sortable: true },
  { key: "district", header: "Địa bàn", sortable: true },
  { key: "employees", header: "Lao động", sortable: true },
  { key: "revenue", header: "Doanh thu (tỷ)", sortable: true },
  {
    key: "dataStatus",
    header: "Trạng thái dữ liệu",
    sortable: true,
    render: (r) => <StatusBadge status={r.dataStatus} />,
  },
];

const licenseColumns: Column<(typeof EXPIRING_LICENSES)[number]>[] = [
  { key: "code", header: "Mã GP", sortable: true },
  { key: "enterprise", header: "Doanh nghiệp", sortable: true },
  { key: "district", header: "Địa bàn", sortable: true },
  {
    key: "expiresAt",
    header: "Hạn hiệu lực",
    sortable: true,
    value: (r) => formatDate(r.expiresAt),
    render: (r) => formatDate(r.expiresAt),
  },
  {
    key: "daysLeft",
    header: "Còn lại",
    render: (r) => {
      const d = daysUntil(r.expiresAt);
      return (
        <span
          className={cn("font-medium tabular-nums", d <= 7 ? "text-destructive" : "text-warning")}
        >
          {d} ngày
        </span>
      );
    },
  },
];

export function CoEnterprisePanel() {
  const navigate = useNavigate();
  const [sector, setSector] = useState("Tất cả lĩnh vực");
  const [district, setDistrict] = useState("Toàn tỉnh");
  const [status, setStatus] = useState("Tất cả");
  const [activeAlert, setActiveAlert] = useState<(typeof OPERATION_ALERTS)[number] | null>(null);

  const filtered = useMemo(
    () =>
      ENTERPRISES.filter(
        (e) =>
          (sector === "Tất cả lĩnh vực" || e.sector === sector) &&
          (district === "Toàn tỉnh" || e.district === district) &&
          (status === "Tất cả" ||
            (status === "Đang hoạt động" ? e.status === "active" : e.status === "suspended")),
      ),
    [sector, district, status],
  );

  const totals = useMemo(
    () => ({
      active: ENTERPRISES.filter((e) => e.status === "active").length,
      employees: ENTERPRISES.reduce((s, e) => s + e.employees, 0),
      revenue: ENTERPRISES.reduce((s, e) => s + e.revenue, 0),
    }),
    [],
  );

  const resetFilters = () => {
    setSector("Tất cả lĩnh vực");
    setDistrict("Toàn tỉnh");
    setStatus("Tất cả");
  };

  const openEnterprise = (name: string) => {
    const match = ENTERPRISES.find((e) => e.name === name);
    if (match) navigate({ to: "/enterprises/$id", params: { id: match.id } });
  };

  const exportCsv = () => {
    const headers = [
      "Doanh nghiệp",
      "MST",
      "Lĩnh vực",
      "Địa bàn",
      "Lao động",
      "Doanh thu (tỷ)",
      "Trạng thái dữ liệu",
    ];
    const esc = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      headers.join(","),
      ...filtered.map((e) =>
        [
          e.name,
          e.taxCode,
          e.sector,
          e.district,
          e.employees,
          e.revenue,
          STATUS_LABEL[e.dataStatus],
        ]
          .map(esc)
          .join(","),
      ),
    ];
    const blob = new Blob([`\ufeff${lines.join("\r\n")}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "du-lieu-doanh-nghiep.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Đã xuất ${filtered.length} doanh nghiệp ra file CSV.`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Tra cứu hồ sơ số doanh nghiệp, giấy phép và cảnh báo — nguồn dùng chung của ngành, gắn
          với hồ sơ C/O xuất khẩu.
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate({ to: "/market" })}>
          <Building2 className="size-4" /> Mở trong Quản lý thị trường
        </Button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="DN đăng ký hoạt động"
          value={`≥ ${ENTERPRISE_SUMMARY.registeredEnterprisesLowerBound.toLocaleString("vi-VN")}`}
          icon={Building2}
          tone="gov"
          onClick={resetFilters}
        />
        <StatCard
          label="Đang hoạt động"
          value={totals.active}
          delta={`${totals.active}/${ENTERPRISE_SUMMARY.detailCoverage} hồ sơ chi tiết demo`}
          icon={Factory}
          tone="success"
          onClick={() => setStatus("Đang hoạt động")}
        />
        <StatCard
          label="Tổng lao động"
          value={totals.employees.toLocaleString("vi-VN")}
          icon={Users}
          tone="teal"
        />
        <StatCard
          label="Tổng doanh thu"
          value={`${totals.revenue.toLocaleString("vi-VN")} tỷ`}
          icon={TrendingUp}
          tone="analytics"
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <StatCard
          label="DN thành lập mới (8 tháng 2026)"
          value={`≈ ${ENTERPRISE_SUMMARY.newEnterprisesFirstEightMonths.toLocaleString("vi-VN")}`}
          icon={TrendingUp}
          tone="teal"
        />
        <StatCard
          label="Hộ kinh doanh/cơ sở"
          value={ENTERPRISE_SUMMARY.businessHouseholdsDisplay}
          delta="Chờ số liệu tổng hợp chính thức"
          icon={Users}
          tone="warning"
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <StatCard label="Giấy phép còn hiệu lực" value="1.827" icon={FileCheck2} tone="success" />
        <StatCard
          label="Sắp hết hạn (30 ngày)"
          value="37"
          delta={`${EXPIRING_LICENSES.length} GP liệt kê dưới đây`}
          icon={CalendarClock}
          tone="warning"
        />
        <StatCard label="Đã hết hạn" value="96" icon={ShieldAlert} tone="navy" />
      </section>

      <ChartCard
        title="Giấy phép sắp hết hạn"
        subtitle="6 giấy phép hết hiệu lực trong 30 ngày tới — click dòng để xem hồ sơ doanh nghiệp"
      >
        <DataTable
          columns={licenseColumns}
          rows={EXPIRING_LICENSES}
          pageSize={6}
          searchPlaceholder="Tìm kiếm giấy phép..."
          onRowClick={(r) => openEnterprise(r.enterprise)}
        />
      </ChartCard>

      <ChartCard title="Cảnh báo & lưu ý" subtitle="Các cảnh báo cần xử lý gần nhất của ngành">
        <div className="grid gap-3 sm:grid-cols-3">
          {ALERT_ITEMS.map((a) => (
            <AlertCard
              key={a.id}
              value={a.value}
              label={a.label}
              tone={a.tone}
              onClick={() => setActiveAlert(activeAlert?.id === a.id ? null : a)}
            />
          ))}
        </div>
        {activeAlert ? (
          <div className="mt-4 rounded-lg border border-border bg-surface p-4">
            <p className="flex items-start gap-2 text-sm leading-relaxed text-foreground">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              {activeAlert.detail}
            </p>
            <ul className="mt-3 space-y-1.5">
              {activeAlert.items.map((it) => (
                <li
                  key={it}
                  className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground"
                >
                  {it}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </ChartCard>

      <FilterBar
        filters={[
          { label: "Lĩnh vực", value: sector, options: SECTORS, onChange: setSector },
          { label: "Địa bàn", value: district, options: DISTRICTS, onChange: setDistrict },
          {
            label: "Trạng thái hoạt động",
            value: status,
            options: OPERATIONAL_STATUS,
            onChange: setStatus,
          },
        ]}
      />

      <DataTable
        columns={enterpriseColumns}
        rows={filtered}
        searchPlaceholder="Tìm kiếm trong danh sách..."
        onRowClick={(r) => navigate({ to: "/enterprises/$id", params: { id: r.id } })}
        toolbar={
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground xl:inline">
              Click dòng để xem hồ sơ 360°
            </span>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="size-4" />
              Xuất CSV ({filtered.length})
            </Button>
          </div>
        }
      />
      <p className="text-[11px] leading-4 text-muted-foreground">
        Nguồn tổng hợp: {ENTERPRISE_SUMMARY.source} · cập nhật đến {ENTERPRISE_SUMMARY.asOf}.{" "}
        {ENTERPRISE_SUMMARY.note} Bảng bên dưới hiện mới có {ENTERPRISE_SUMMARY.detailCoverage} hồ
        sơ mock để minh họa.
      </p>
    </div>
  );
}
