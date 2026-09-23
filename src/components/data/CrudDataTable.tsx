'use client';

import { ActionIcon, Group, Select, Text, TextInput, Tooltip, type MantineColor } from '@mantine/core';
import { DataTable, type DataTableColumn, type DataTableRowExpansionProps } from 'mantine-datatable';
import { useState, type MouseEventHandler, type ReactNode } from 'react';

export const DATA_TABLE_PAGE_SIZE_OPTIONS = [25, 50, 100];

type CrudDataTableProps<T> = {
  records: T[];
  columns: DataTableColumn<T>[];
  idAccessor: keyof T | (string & NonNullable<unknown>);
  page: number;
  totalRecords: number;
  recordsPerPage?: number;
  onPageChange: (page: number) => void;
  onRecordsPerPageChange?: (recordsPerPage: number) => void;
  fetching?: boolean;
  rowExpansion?: DataTableRowExpansionProps<T>;
  emptyState?: ReactNode;
  minHeight?: number | string;
  pinFirstColumn?: boolean;
  highlightOnHover?: boolean;
  striped?: boolean;
  filters?: Array<{ key: keyof T & string; label: string; options: Array<{ value: string; label: string }> }>;
  filterPlaceholder?: string;
};

export function CrudDataTable<T>({
  records,
  columns,
  idAccessor,
  page,
  totalRecords,
  recordsPerPage = 25,
  onPageChange,
  onRecordsPerPageChange,
  fetching = false,
  rowExpansion,
  emptyState,
  minHeight = 180,
  pinFirstColumn = true,
  highlightOnHover = true,
  striped = false,
  filters = [],
  filterPlaceholder = '',
}: CrudDataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string | null>>({});
  const filteredRecords = records.filter((record) => {
    const query = search.trim().toLocaleLowerCase('vi-VN');
    if (query && !Object.values(record as Record<string, unknown>).some((value) => String(value ?? '').toLocaleLowerCase('vi-VN').includes(query))) return false;
    return filters.every((filter) => {
      const value = filterValues[filter.key];
      return !value || String(record[filter.key] ?? '') === value;
    });
  });
  const hasFilters = Boolean(search.trim()) || filters.some((filter) => filterValues[filter.key]);
  const paginationProps = onRecordsPerPageChange
    ? {
      onRecordsPerPageChange,
      recordsPerPageOptions: DATA_TABLE_PAGE_SIZE_OPTIONS,
    }
    : {};

  return (
    <>
      {filters.length || filterPlaceholder ? (
        <Group mb="sm" align="end" gap="xs" wrap="wrap">
          <TextInput
            label="Tìm kiếm"
            placeholder={filterPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            className="min-w-[240px] flex-1"
          />
          {filters.map((filter) => (
            <Select
              key={filter.key}
              label={filter.label}
              placeholder="Tất cả"
              clearable
              data={filter.options}
              value={filterValues[filter.key] ?? null}
              onChange={(value) => setFilterValues((current) => ({ ...current, [filter.key]: value }))}
              className="min-w-[170px]"
            />
          ))}
          {hasFilters ? <ActionIcon aria-label="Xóa bộ lọc" variant="subtle" onClick={() => { setSearch(''); setFilterValues({}); }}><Text size="xs">X</Text></ActionIcon> : null}
        </Group>
      ) : null}
      <DataTable<T>
      withTableBorder
      borderRadius="md"
      withColumnBorders
      minHeight={minHeight}
      records={filteredRecords}
      columns={columns}
      idAccessor={idAccessor}
      page={page}
      onPageChange={onPageChange}
      totalRecords={hasFilters ? filteredRecords.length : totalRecords}
      recordsPerPage={recordsPerPage}
      {...paginationProps}
      paginationWithEdges
      paginationWithControls
      paginationText={({ from, to, totalRecords: total }) => `${from}–${to} / ${total.toLocaleString('vi-VN')}`}
      fetching={fetching}
      loadingText="Đang tải dữ liệu..."
      emptyState={emptyState ?? <Text c="dimmed" ta="center" py="xl">Không có dữ liệu phù hợp.</Text>}
      rowExpansion={rowExpansion}
      pinFirstColumn={pinFirstColumn}
      highlightOnHover={highlightOnHover}
      striped={striped}
      verticalAlign="top"
      defaultColumnProps={{ ellipsis: true }}
      scrollAreaProps={{ type: 'auto' }}
      />
    </>
  );
}

type ClientCrudDataTableProps<T> = Omit<CrudDataTableProps<T>, 'page' | 'totalRecords' | 'recordsPerPage' | 'onPageChange' | 'onRecordsPerPageChange'> & {
  initialRecordsPerPage?: number;
};

/**
 * Use for child collections that are already scoped to a single parent/detail
 * record. It keeps the rendered rows light while the parent endpoint remains
 * responsible for the bounded child payload.
 */
export function ClientCrudDataTable<T>({ records, initialRecordsPerPage = 25, ...props }: ClientCrudDataTableProps<T>) {
  const [page, setPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(initialRecordsPerPage);
  const pageCount = Math.max(1, Math.ceil(records.length / recordsPerPage));
  const currentPage = Math.min(page, pageCount);

  return (
    <CrudDataTable
      {...props}
      records={records.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage)}
      page={currentPage}
      totalRecords={records.length}
      recordsPerPage={recordsPerPage}
      onPageChange={setPage}
      onRecordsPerPageChange={(nextSize) => { setPage(1); setRecordsPerPage(nextSize); }}
    />
  );
}

export function DataTableActions({ children }: { children: ReactNode }) {
  return <Group gap={4} wrap="nowrap">{children}</Group>;
}

type DataTableActionProps = {
  label: string;
  icon: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  color?: MantineColor;
  variant?: 'subtle' | 'light' | 'default' | 'filled' | 'outline' | 'transparent';
  disabled?: boolean;
  loading?: boolean;
};

export function DataTableAction({
  label,
  icon,
  onClick,
  color = 'gray',
  variant = 'subtle',
  disabled = false,
  loading = false,
}: DataTableActionProps) {
  return (
    <Tooltip label={label} withArrow>
      <ActionIcon
        type="button"
        aria-label={label}
        color={color}
        variant={variant}
        onClick={onClick}
        disabled={disabled}
        loading={loading}
      >
        {icon}
      </ActionIcon>
    </Tooltip>
  );
}
