'use client';

import { Badge, SimpleGrid, Text } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import type { DataTableColumn } from 'mantine-datatable';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CrudDataTable, DataTableAction, DataTableActions } from '@/components/data/CrudDataTable';

type Project = {
  assetId: string;
  code: string;
  name: string;
  commissionedAt: string | Date | null;
  sourceType: string;
  designedCapacityMw: number;
  actualCapacityMw: number | null;
  operationStatus: string;
  investorPartyId: string | null;
  operatorPartyId: string | null;
  gridConnectionAssetId: string | null;
  siteName: string | null;
  address: string | null;
  adminAreaCode: string | null;
  technicalSpecs: unknown;
};

type ApiProject = Project & {
  investor?: { name?: string | null } | null;
  operator?: { name?: string | null } | null;
};

function sourceLabel(sourceType: string) {
  return ({ SOLAR: 'Mặt trời', WIND: 'Gió', HYDRO: 'Thủy điện', BIOMASS: 'Sinh khối', WASTE_TO_ENERGY: 'Điện rác', LNG: 'LNG', OTHER: 'Khác' } as Record<string, string>)[sourceType] ?? sourceType;
}

function statusColor(status: string) {
  if (status === 'OPERATING' || status === 'ACTIVE') return 'green';
  if (status === 'CONSTRUCTION') return 'blue';
  if (status === 'PREPARING_INVESTMENT') return 'cyan';
  if (status === 'PLANNED') return 'yellow';
  if (status === 'SUSPENDED') return 'orange';
  return 'gray';
}

function formatDate(value: string | Date | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(date);
}

function specsText(value: unknown, key: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '—';
  const item = (value as Record<string, unknown>)[key];
  return item == null || item === '' ? '—' : String(item);
}

export function GenerationProjectsTable({ initialRecords, totalRecords, partyNames, onOpen }: { initialRecords: Project[]; totalRecords: number; partyNames: Record<string, string>; onOpen?: (assetId: string) => void }) {
  const router = useRouter();
  const [records, setRecords] = useState<ApiProject[]>(initialRecords);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(totalRecords);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    setRecords(initialRecords);
    setTotal(totalRecords);
    setPage(1);
  }, [initialRecords, totalRecords]);

  async function load(nextPage: number, nextPageSize: number) {
    setFetching(true);
    try {
      const response = await fetch(`/api/generation/projects?page=${nextPage}&pageSize=${nextPageSize}`, { cache: 'no-store' });
      const data = await response.json() as { items?: ApiProject[]; pagination?: { page?: number; pageSize?: number; total?: number }; message?: string };
      if (!response.ok) throw new Error(data.message ?? 'Không thể tải danh sách dự án nguồn điện.');
      setRecords(data.items ?? []);
      setTotal(data.pagination?.total ?? 0);
      setPage(data.pagination?.page ?? nextPage);
      setPageSize(data.pagination?.pageSize ?? nextPageSize);
    } finally {
      setFetching(false);
    }
  }

  const columns: DataTableColumn<ApiProject>[] = [
    { accessor: 'actions', title: 'Thao tác', width: 68, render: (item) => <DataTableActions><DataTableAction label="Mở hồ sơ 360" icon={<IconExternalLink size={16} />} color="blue" onClick={() => onOpen ? onOpen(item.assetId) : router.push('/energy/nhiem-vu-2/quan-ly')} /></DataTableActions> },
    { accessor: 'name', title: 'Dự án', width: 290, render: (item) => <><Text fw={900} c="blue">{item.name}</Text><Text size="xs" c="dimmed">{item.code} · {formatDate(item.commissionedAt)}</Text></> },
    { accessor: 'sourceType', title: 'Loại', width: 150, render: (item) => <Badge variant="light" color={item.sourceType === 'SOLAR' ? 'yellow' : item.sourceType === 'BIOMASS' ? 'green' : 'blue'}>{sourceLabel(item.sourceType)}</Badge> },
    { accessor: 'investorPartyId', title: 'Chủ đầu tư / vận hành', width: 250, render: (item) => <><Text size="sm" fw={700}>{item.investor?.name ?? (item.investorPartyId ? partyNames[item.investorPartyId] ?? '—' : '—')}</Text><Text size="xs" c="dimmed">Vận hành: {item.operator?.name ?? (item.operatorPartyId ? partyNames[item.operatorPartyId] ?? '—' : 'Chưa khai báo')}</Text></> },
    { accessor: 'siteName', title: 'Khu vực', width: 240, render: (item) => <><Text size="sm">{item.siteName ?? item.adminAreaCode ?? '—'}</Text><Text size="xs" c="dimmed">{item.address ?? '—'}</Text></> },
    { accessor: 'designedCapacityMw', title: 'Công suất', width: 150, render: (item) => <><Text>{item.designedCapacityMw.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} MW thiết kế</Text><Text size="xs" c="dimmed">{item.actualCapacityMw == null ? 'Thực tế —' : `${item.actualCapacityMw.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} MW thực tế`}</Text></> },
    { accessor: 'operationStatus', title: 'Trạng thái', width: 170, render: (item) => <Badge color={statusColor(item.operationStatus)} variant="light">{item.operationStatus}</Badge> },
    { accessor: 'gridConnectionAssetId', title: 'Đấu nối', width: 130, render: (item) => item.gridConnectionAssetId ? <Badge color="cyan" variant="outline">Đã liên kết</Badge> : <Text size="sm" c="dimmed">Chưa liên kết</Text> },
  ];

  return <CrudDataTable
    records={records}
    filterPlaceholder="Mã, tên dự án hoặc địa bàn..."
    filters={[
      { key: 'sourceType', label: 'Loại nguồn', options: Object.entries({ SOLAR: 'Mặt trời', WIND: 'Gió', HYDRO: 'Thủy điện', BIOMASS: 'Sinh khối', WASTE_TO_ENERGY: 'Điện rác', LNG: 'LNG', OTHER: 'Khác' }).map(([value, label]) => ({ value, label })) },
      { key: 'operationStatus', label: 'Trạng thái', options: ['PLANNED', 'PREPARING_INVESTMENT', 'CONSTRUCTION', 'OPERATING', 'SUSPENDED', 'DECOMMISSIONED'].map((value) => ({ value, label: value })) },
    ]}
    columns={columns}
    idAccessor="assetId"
    page={page}
    totalRecords={total}
    recordsPerPage={pageSize}
    onPageChange={(nextPage) => { setPage(nextPage); void load(nextPage, pageSize); }}
    onRecordsPerPageChange={(nextSize) => { setPage(1); setPageSize(nextSize); void load(1, nextSize); }}
    fetching={fetching}
    rowExpansion={{ allowMultiple: true, content: ({ record }) => <SimpleGrid cols={{ base: 1, sm: 3 }} p="sm"><div><Text size="xs" c="dimmed" fw={800}>Vị trí</Text><Text size="sm">{record.siteName ?? 'Chưa có Site'}</Text><Text size="xs" c="dimmed">{record.adminAreaCode ?? 'Chưa gắn địa bàn'} · {record.address ?? '—'}</Text></div><div><Text size="xs" c="dimmed" fw={800}>Thông số kỹ thuật</Text><Text size="sm">Công nghệ: {specsText(record.technicalSpecs, 'technology')}</Text><Text size="xs" c="dimmed">Số tổ máy: {specsText(record.technicalSpecs, 'unitCount')}</Text></div><div><Text size="xs" c="dimmed" fw={800}>Đấu nối / vận hành</Text><Text size="sm">{record.gridConnectionAssetId ? `Grid asset: ${record.gridConnectionAssetId}` : 'Chưa gắn grid asset'}</Text><Text size="xs" c="dimmed">{record.operationStatus}</Text></div></SimpleGrid> }}
    emptyState={<Text c="dimmed" ta="center" py="xl">Chưa có dự án nguồn điện.</Text>}
  />;
}
