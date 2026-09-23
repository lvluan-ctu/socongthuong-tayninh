import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/common/DataTable";
import { CoStatusBadge } from "@/components/co/CoStatusBadge";
import { formatCurrency } from "@/lib/co/co-service";
import { CO_FTA_MAP, CO_FORMS_MAP } from "@/lib/co/co-constants";
import type { CoApplication } from "@/lib/co/co-types";

interface CoApplicationListProps {
  applications: CoApplication[];
  onSelect: (app: CoApplication) => void;
}

export function CoApplicationList({ applications, onSelect }: CoApplicationListProps) {
  const columns: Column<CoApplication>[] = [
    {
      key: "applicationNo",
      header: "Số hồ sơ",
      sortable: true,
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-navy text-xs">{r.applicationNo}</p>
          {r.coNumber && (
            <p className="text-[11px] text-gov font-medium">{r.coNumber}</p>
          )}
        </div>
      ),
    },
    {
      key: "formCode",
      header: "Mẫu C/O",
      sortable: true,
      render: (r) => (
        <span className="text-xs font-medium">{r.formCode}</span>
      ),
    },
    {
      key: "ftaCode",
      header: "FTA",
      sortable: true,
      render: (r) => {
        const fta = CO_FTA_MAP.get(r.ftaCode);
        return (
          <span className="text-xs">{fta?.shortName ?? r.ftaCode}</span>
        );
      },
    },
    {
      key: "exporter",
      header: "Xuất khẩu (VN)",
      render: (r) => (
        <span className="text-xs max-w-[160px] truncate block" title={r.exporter.name}>
          {r.exporter.name}
        </span>
      ),
    },
    {
      key: "consignee",
      header: "Nhập khẩu",
      render: (r) => (
        <span className="text-xs">
          {r.consignee.name}
          <span className="ml-1 text-muted-foreground">({r.consignee.country})</span>
        </span>
      ),
    },
    {
      key: "fobValue",
      header: "Giá trị FOB",
      sortable: true,
      render: (r) => (
        <span className="text-xs font-medium">
          {formatCurrency(r.items.reduce((s, i) => s + i.fobValue, 0))}
        </span>
      ),
    },
    {
      key: "departureDate",
      header: "Ngày XK",
      sortable: true,
      render: (r) => (
        <span className="text-xs">{r.transport.departureDate}</span>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (r) => <CoStatusBadge status={r.status} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={applications}
      onRowClick={onSelect}
      searchPlaceholder="Tìm số hồ sơ, doanh nghiệp..."
    />
  );
}
