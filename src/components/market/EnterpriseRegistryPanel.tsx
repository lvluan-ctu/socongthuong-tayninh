"use client";

import { useMemo, useState } from "react";
import { Building2, Database, MapPin, Search, Users } from "lucide-react";
import { ChartCard } from "@/components/common/ChartCard";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatCard } from "@/components/common/StatCard";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ENTERPRISES } from "@/data/mock";
import { registryStatistics } from "@/lib/market-registry";
import { STATUS_LABEL } from "@/lib/constants";
import type { Enterprise } from "@/lib/types";

const columns: Column<Enterprise>[] = [
  {
    key: "name",
    header: "Doanh nghiệp",
    sortable: true,
    render: (enterprise) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-navy">{enterprise.name}</p>
        <p className="text-[11px] text-muted-foreground">{enterprise.taxCode}</p>
      </div>
    ),
  },
  { key: "sector", header: "Lĩnh vực", sortable: true },
  { key: "district", header: "Địa bàn", sortable: true },
  {
    key: "employees",
    header: "Lao động",
    sortable: true,
    render: (enterprise) => enterprise.employees.toLocaleString("vi-VN"),
  },
  {
    key: "dataStatus",
    header: "Trạng thái dữ liệu",
    sortable: true,
    render: (enterprise) => <Badge variant="outline">{STATUS_LABEL[enterprise.dataStatus]}</Badge>,
  },
];

export function EnterpriseRegistryPanel() {
  const [query, setQuery] = useState("");
  const [district, setDistrict] = useState("Toàn tỉnh");
  const districts = ["Toàn tỉnh", ...new Set(ENTERPRISES.map((enterprise) => enterprise.district))];
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return ENTERPRISES.filter((enterprise) => {
      const matchesDistrict = district === "Toàn tỉnh" || enterprise.district === district;
      const matchesQuery = !normalizedQuery || [enterprise.name, enterprise.taxCode, enterprise.sector, enterprise.representative]
        .some((value) => value.toLowerCase().includes(normalizedQuery));
      return matchesDistrict && matchesQuery;
    });
  }, [district, query]);

  const activeCount = ENTERPRISES.filter((enterprise) => enterprise.status === "active").length;
  const employeeCount = ENTERPRISES.reduce((sum, enterprise) => sum + enterprise.employees, 0);

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Hồ sơ chi tiết" value={ENTERPRISES.length} icon={Database} tone="gov" />
        <StatCard label="Đang hoạt động" value={activeCount} icon={Building2} tone="success" />
        <StatCard label="Tổng lao động" value={employeeCount.toLocaleString("vi-VN")} icon={Users} tone="teal" />
        <StatCard label="Đã định vị GIS" value="—" icon={MapPin} tone="warning" />
      </div>

      <ChartCard
        title="Dữ liệu doanh nghiệp dùng chung"
        subtitle="Góc nhìn hồ sơ doanh nghiệp trong phân hệ Quản lý thị trường"
      >
        <div className="space-y-3 p-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm tên, MST, lĩnh vực, người đại diện..."
                className="pl-8 text-sm"
              />
            </div>
            <select
              value={district}
              onChange={(event) => setDistrict(event.target.value)}
              className="h-9 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-gov"
            >
              {districts.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>

          <DataTable
            columns={columns}
            rows={filtered}
            searchPlaceholder="Tìm trong dữ liệu doanh nghiệp..."
            onRowClick={() => undefined}
          />

          <p className="text-[11px] leading-4 text-muted-foreground">
            Nguồn hồ sơ hiện tại là mock `ENTERPRISES` và được hiển thị chung trong Quản lý thị trường. Hồ sơ này chưa có tọa độ, nên chưa được vẽ thành marker GIS; dữ liệu GIS chi tiết đang lấy từ danh mục công ty/hộ kinh doanh.
          </p>
          <p className="text-[11px] leading-4 text-muted-foreground">
            Số liệu cấp tỉnh: {registryStatistics.registeredEnterprisesLabel}; hộ kinh doanh: {registryStatistics.businessHouseholdsDisplay}.
          </p>
        </div>
      </ChartCard>
    </section>
  );
}
