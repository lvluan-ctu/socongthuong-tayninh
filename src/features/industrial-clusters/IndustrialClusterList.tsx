"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Filter, FileText, Eye, MapPin, Building2, TrendingUp, Gauge, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/common/DataTable";
import { ChartCard } from "@/components/common/ChartCard";
import { StatCard } from "@/components/common/StatCard";
import { ClusterStatusBadge } from "@/components/industry/ClusterStatusBadge";
import { getVisibleDossiers, getClusterStats } from "@/lib/industrial-clusters/industrial-cluster-service";
import type { ClusterDossier, ClusterDossierStatus } from "@/lib/industrial-clusters/industrial-cluster-types";
import { CLUSTER_STATUS_OPTIONS } from "@/lib/industrial-clusters/industrial-cluster-constants";

interface IndustrialClusterListProps {
  applications?: ClusterDossier[];
  onSelect?: (cluster: ClusterDossier) => void;
  onCreateNew?: () => void;
}

export function IndustrialClusterList({ applications, onSelect, onCreateNew }: IndustrialClusterListProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClusterDossierStatus | "ALL">("ALL");

  const userDossiers = useMemo(() => applications ?? getVisibleDossiers(), [applications]);
  const stats = useMemo(() => getClusterStats(), []);

  const filtered = useMemo(() => {
    let result = userDossiers;
    if (statusFilter !== "ALL") {
      result = result.filter((d) => d.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.district.toLowerCase().includes(q) ||
          d.ward.toLowerCase().includes(q) ||
          d.dossierCode.toLowerCase().includes(q) ||
          d.investor?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [userDossiers, statusFilter, search]);

  const columns: Column<ClusterDossier>[] = [
    {
      key: "dossierCode",
      header: "Mã hồ sơ",
      sortable: true,
      render: (r) => <span className="font-mono text-xs font-medium text-gov">{r.dossierCode}</span>,
    },
    {
      key: "name",
      header: "Tên CCN",
      sortable: true,
      render: (r) => <span className="font-medium text-navy text-sm">{r.name}</span>,
    },
    {
      key: "ward",
      header: "Địa bàn (Xã/Phường)",
      sortable: true,
      render: (r) => (
        <span className="text-sm max-w-[180px] truncate block" title={r.ward}>
          <MapPin className="inline size-3 mr-1 text-muted-foreground" />
          {r.ward}
        </span>
      ),
    },
    {
      key: "area",
      header: "Diện tích (ha)",
      sortable: true,
      render: (r) => <span className="text-sm tabular-nums">{r.area.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}</span>,
    },
    {
      key: "leased",
      header: "Đã cho thuê (ha)",
      sortable: true,
      render: (r) => <span className="text-sm tabular-nums text-teal">{r.leased.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}</span>,
    },
    {
      key: "occupancy",
      header: "Lấp đầy (%)",
      sortable: true,
      render: (r) => (
        <Badge variant="outline" className={`rounded-full text-[11px] ${
          r.occupancy >= 75 ? "border-success/30 bg-success/10 text-success" :
          r.occupancy >= 50 ? "border-gov/30 bg-gov/10 text-gov" :
          "border-warning/30 bg-warning/10 text-warning"
        }`}>
          {r.occupancy}%
        </Badge>
      ),
    },
    {
      key: "enterprises",
      header: "DN",
      sortable: true,
      render: (r) => <span className="text-sm tabular-nums">{r.enterprises}</span>,
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (r) => <ClusterStatusBadge status={r.status} />,
    },
    {
      key: "investor",
      header: "Chủ đầu tư",
      render: (r) => (
        <span className="text-sm max-w-[200px] truncate block text-muted-foreground" title={r.investor ?? ""}>
          {r.investor ?? "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-navy">Danh sách hồ sơ CCN</h2>
          <Badge variant="outline" className="text-[11px]">{filtered.length}/{userDossiers.length} hồ sơ</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm mã, tên, địa bàn, chủ đầu tư..."
              className="w-[280px] pl-8 text-sm"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              if (value === "ALL" || CLUSTER_STATUS_OPTIONS.some((option) => option.value === value)) {
                setStatusFilter(value as ClusterDossierStatus | "ALL");
              }
            }}
          >
            <SelectTrigger className="w-[180px] text-sm">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              {CLUSTER_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {onCreateNew && (
            <Button onClick={onCreateNew} className="gap-1.5">
              <Plus className="size-4" /> Hồ sơ mới
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Tổng CCN" value={stats.total} icon={Building2} />
        <StatCard label="Tổng diện tích" value={`${stats.totalArea.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ha`} icon={MapPin} tone="teal" />
        <StatCard label="Đã cho thuê" value={`${stats.totalLeased.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ha`} icon={TrendingUp} tone="success" />
        <StatCard label="Tổng DN" value={stats.totalEnterprises} icon={FileText} tone="warning" />
        <StatCard label="Lấp đầy BQ" value={`${stats.avgOccupancy}%`} icon={Gauge} tone="analytics" />
      </div>

      <ChartCard
        title="Danh sách chi tiết"
        subtitle={`${filtered.length} hồ sơ`}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" disabled>
            <Download className="size-3.5" /> Xuất Excel
          </Button>
        }
      >
        <DataTable
          columns={columns}
          rows={filtered as (ClusterDossier & { id: string })[]}
          searchPlaceholder="Tìm kiếm..."
          onRowClick={onSelect}
          paginated
          pageSize={10}
        />
      </ChartCard>
    </div>
  );
}