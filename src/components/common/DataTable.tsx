"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DataTable as MantineDataTable,
  type DataTableColumn,
  type DataTableSortStatus,
} from "mantine-datatable";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  value?: (row: T) => string | number;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  searchPlaceholder?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  toolbar?: ReactNode;
  emptyText?: string;
  searchable?: boolean;
  paginated?: boolean;
  minHeight?: number | string;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  searchPlaceholder = "Tìm kiếm...",
  pageSize = 8,
  onRowClick,
  toolbar,
  emptyText = "Không có dữ liệu phù hợp",
  searchable = true,
  paginated = true,
  minHeight = 180,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(pageSize);
  const firstSortable = columns.find((column) => column.sortable)?.key ?? columns[0]?.key ?? "id";
  const [sortStatus, setSortStatus] = useState<DataTableSortStatus<T>>({
    columnAccessor: firstSortable,
    direction: "asc",
  });

  useEffect(() => setPage(1), [query, recordsPerPage, rows.length]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi");
    const matching = normalizedQuery
      ? rows.filter((row) =>
          columns.some((column) => {
            const value = column.value
              ? column.value(row)
              : (row as Record<string, unknown>)[column.key];
            return String(value ?? "").toLocaleLowerCase("vi").includes(normalizedQuery);
          }),
        )
      : rows;

    const selectedColumn = columns.find(
      (column) => column.key === String(sortStatus.columnAccessor),
    );
    if (!selectedColumn?.sortable) return matching;

    return [...matching].sort((left, right) => {
      const leftValue = selectedColumn.value
        ? selectedColumn.value(left)
        : (left as Record<string, unknown>)[selectedColumn.key];
      const rightValue = selectedColumn.value
        ? selectedColumn.value(right)
        : (right as Record<string, unknown>)[selectedColumn.key];
      const result =
        typeof leftValue === "number" && typeof rightValue === "number"
          ? leftValue - rightValue
          : String(leftValue ?? "").localeCompare(String(rightValue ?? ""), "vi", {
              numeric: true,
              sensitivity: "base",
            });
      return sortStatus.direction === "asc" ? result : -result;
    });
  }, [columns, query, rows, sortStatus]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / recordsPerPage));
  const currentPage = Math.min(page, pageCount);
  const displayedRecords = paginated
    ? filtered.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage)
    : filtered;

  const mantineColumns = useMemo<DataTableColumn<T>[]>(
    () =>
      columns.map((column) => ({
        accessor: column.key,
        title: column.header,
        sortable: column.sortable,
        cellsClassName: column.className,
        render: (record) =>
          column.render
            ? column.render(record)
            : String(
                (column.value
                  ? column.value(record)
                  : (record as Record<string, unknown>)[column.key]) ?? "",
              ),
      })),
    [columns],
  );

  const commonProps = {
    withTableBorder: false,
    withColumnBorders: true,
    striped: true,
    highlightOnHover: true,
    verticalAlign: "center" as const,
    minHeight,
    records: displayedRecords,
    columns: mantineColumns,
    idAccessor: "id" as const,
    noRecordsText: emptyText,
    sortStatus,
    onSortStatusChange: (status: DataTableSortStatus<T>) => {
      setSortStatus(status);
      setPage(1);
    },
    onRowClick: onRowClick ? ({ record }: { record: T }) => onRowClick(record) : undefined,
    rowClassName: onRowClick ? () => "cursor-pointer" : undefined,
    defaultColumnProps: { ellipsis: true },
    scrollAreaProps: { type: "auto" as const },
  };

  return (
    <div className="gov-card overflow-hidden">
      {searchable || toolbar ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          {searchable ? (
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-2.5 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 bg-surface pl-8"
              />
            </div>
          ) : null}
          {toolbar}
        </div>
      ) : null}

      {paginated ? (
        <MantineDataTable<T>
          {...commonProps}
          page={currentPage}
          onPageChange={setPage}
          totalRecords={filtered.length}
          recordsPerPage={recordsPerPage}
          onRecordsPerPageChange={(size) => {
            setRecordsPerPage(size);
            setPage(1);
          }}
          recordsPerPageOptions={[8, 15, 25, 50]}
          paginationWithEdges
          paginationWithControls
          paginationText={({ from, to, totalRecords }) =>
            `${from}–${to} / ${totalRecords.toLocaleString("vi-VN")}`
          }
        />
      ) : (
        <MantineDataTable<T> {...commonProps} />
      )}
    </div>
  );
}
