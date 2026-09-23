'use client';

import { Badge, Button, Drawer, Group, Modal, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import type { DataTableColumn } from 'mantine-datatable';
import { useEffect, useState } from 'react';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { CrudDataTable, DataTableAction, DataTableActions } from '@/components/data/CrudDataTable';
import { SubstationForm } from './SubstationForm';

type Substation = {
  id: string;
  code: string;
  name: string;
  status: string;
  commissionedAt: string | null;
  voltageLevelKv: string | null;
  substationType: string;
  designedCapacityMva: string | null;
  installedCapacityMva: string | null;
  currentLoadMva: string | null;
  loadFactorPct: string | null;
  availableCapacityMva: string | null;
  overloadStatus: string;
  operator: string | null;
};

type Summary = { total: number; totalCapacity: number; totalLoad: number; hotCount: number };

function numberOf(value: string | null) {
  if (value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function fmt(value: number | null, unit = '') {
  if (value == null) return '—';
  return `${value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ''}`;
}

function loadFactor(record: Substation) {
  const installed = numberOf(record.installedCapacityMva) ?? numberOf(record.designedCapacityMva);
  const load = numberOf(record.currentLoadMva);
  return numberOf(record.loadFactorPct) ?? (installed && load != null && installed > 0 ? load / installed * 100 : null);
}

function statusColor(factor: number | null, status: string) {
  if (status === 'OVERLOAD' || (factor != null && factor >= 93)) return 'red';
  if (status === 'CRITICAL' || (factor != null && factor >= 90)) return 'orange';
  if (status === 'WARNING' || (factor != null && factor >= 80)) return 'yellow';
  return 'green';
}

export function SubstationTable() {
  const [records, setRecords] = useState<Substation[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, totalCapacity: 0, totalLoad: 0, hotCount: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Substation | null>(null);
  const [archiving, setArchiving] = useState(false);

  async function reload(nextPage = page, nextPageSize = pageSize) {
    setLoading(true);
    try {
      const response = await fetch(`/api/grid/substations?page=${nextPage}&pageSize=${nextPageSize}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Không thể tải danh sách trạm biến áp.');
      const data = await response.json() as { items?: Substation[]; pagination?: { page?: number; pageSize?: number; total?: number }; summary?: Summary };
      setRecords(data.items ?? []);
      setSummary(data.summary ?? { total: data.pagination?.total ?? 0, totalCapacity: 0, totalLoad: 0, hotCount: 0 });
      if (data.pagination?.page) setPage(data.pagination.page);
      if (data.pagination?.pageSize) setPageSize(data.pagination.pageSize);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload(1, 25); }, 0);
    return () => window.clearTimeout(timer);
    // The initial load intentionally runs once; pagination handlers reload explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function archiveSubstation() {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      const response = await fetch(`/api/grid/substations/${archiveTarget.id}`, { method: 'DELETE' });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? 'Không thể ngừng khai thác trạm.');
      notifications.show({ color: 'green', title: 'Đã cập nhật trạng thái trạm', message: payload.message ?? archiveTarget.code });
      setArchiveTarget(null);
      await reload(1, pageSize);
    } catch (error) {
      notifications.show({ color: 'red', title: 'Thao tác thất bại', message: error instanceof Error ? error.message : 'Lỗi không xác định.' });
    } finally {
      setArchiving(false);
    }
  }

  const columns: DataTableColumn<Substation>[] = [
    { accessor: 'actions', title: 'Thao tác', width: 88, render: (record) => <DataTableActions><DataTableAction label="Sửa hồ sơ" icon={<IconEdit size={16} />} color="blue" onClick={() => setEditingId(record.id)} /><DataTableAction label="Ngừng khai thác" icon={<IconTrash size={16} />} color="red" onClick={() => setArchiveTarget(record)} /></DataTableActions> },
    { accessor: 'code', title: 'Mã / tên trạm', width: 260, render: (record) => <><Text fw={800}>{record.code}</Text><Text component="span" fw={800} c="blue">{record.name}</Text></> },
    { accessor: 'substationType', title: 'Loại / vận hành', width: 190, render: (record) => <><Badge variant="light">{record.substationType}</Badge><Text size="xs" c="dimmed">{record.operator ?? 'Chưa khai báo đơn vị'}</Text></> },
    { accessor: 'voltageLevelKv', title: 'Điện áp', width: 120, render: (record) => fmt(numberOf(record.voltageLevelKv), 'kV') },
    { accessor: 'installedCapacityMva', title: 'Công suất', width: 140, render: (record) => fmt(numberOf(record.installedCapacityMva) ?? numberOf(record.designedCapacityMva), 'MVA') },
    { accessor: 'currentLoadMva', title: 'Tải hiện tại', width: 140, render: (record) => fmt(numberOf(record.currentLoadMva), 'MVA') },
    { accessor: 'loadFactorPct', title: 'Hệ số tải', width: 120, render: (record) => { const factor = loadFactor(record); return factor == null ? '—' : `${factor.toFixed(1)}%`; } },
    { accessor: 'overloadStatus', title: 'Trạng thái', width: 140, render: (record) => <Badge color={statusColor(loadFactor(record), record.overloadStatus)} variant="light">{record.overloadStatus}</Badge> },
  ];

  return <Stack gap="lg">
    <SimpleGrid cols={{ base: 1, sm: 4 }}>
      <KpiCard label="Tổng trạm" value={summary.total.toLocaleString('vi-VN')} note="Trong Asset Registry" />
      <KpiCard label="Tổng công suất" value={`${summary.totalCapacity.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MVA`} note="Công suất lắp đặt" color="cyan" />
      <KpiCard label="Tổng tải hiện tại" value={`${summary.totalLoad.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MVA`} note="Theo dữ liệu đã cập nhật" color="blue" />
      <KpiCard label="Trạm ≥ 90% tải" value={summary.hotCount.toLocaleString('vi-VN')} note="Cần theo dõi" color="orange" />
    </SimpleGrid>
    <Paper radius="xl" p="lg" withBorder className="energy-glass">
      <Group justify="space-between" mb="md"><div><Title order={3}>Danh sách trạm</Title><Text size="sm" c="dimmed">Bấm mũi tên thao tác để mở hồ sơ 360: MBA, ngăn lộ, feeder, thiết bị, telemetry và lịch sử nguồn.</Text></div><Badge color="green" variant="light">ĐÃ KẾT NỐI CSDL</Badge></Group>
      <CrudDataTable records={records} filterPlaceholder="Mã, tên trạm hoặc đơn vị vận hành..." filters={[{ key: 'overloadStatus', label: 'Trạng thái tải', options: ['NORMAL', 'WARNING', 'CRITICAL', 'OVERLOAD'].map((value) => ({ value, label: value })) }]} columns={columns} idAccessor="id" page={page} totalRecords={summary.total} recordsPerPage={pageSize} onPageChange={(nextPage) => { setPage(nextPage); void reload(nextPage, pageSize); }} onRecordsPerPageChange={(nextSize) => { setPage(1); setPageSize(nextSize); void reload(1, nextSize); }} fetching={loading} rowExpansion={{ allowMultiple: true, content: ({ record }) => <SimpleGrid cols={{ base: 1, sm: 3 }} p="sm"><div><Text size="xs" c="dimmed" fw={800}>Trạng thái master</Text><Text size="sm">{record.status}</Text><Text size="xs" c="dimmed">Commissioned: {record.commissionedAt ? new Date(record.commissionedAt).toLocaleDateString('vi-VN') : '—'}</Text></div><div><Text size="xs" c="dimmed" fw={800}>Khả dụng / thiết kế</Text><Text size="sm">{fmt(numberOf(record.availableCapacityMva), 'MVA')}</Text><Text size="xs" c="dimmed">Thiết kế: {fmt(numberOf(record.designedCapacityMva), 'MVA')}</Text></div><div><Text size="xs" c="dimmed" fw={800}>Đơn vị vận hành</Text><Text size="sm">{record.operator ?? 'Chưa khai báo'}</Text><Text size="xs" c="dimmed">ID: {record.id}</Text></div></SimpleGrid> }} emptyState={<Text c="dimmed" ta="center" py="xl">Chưa có trạm biến áp trong cơ sở dữ liệu.</Text>} />
    </Paper>
    <Drawer opened={Boolean(editingId)} onClose={() => setEditingId(null)} title="Cập nhật hồ sơ trạm biến áp" position="right" size="xl">
      {editingId ? <SubstationForm assetId={editingId} onCancel={() => setEditingId(null)} onSaved={() => { setEditingId(null); void reload(page, pageSize); }} /> : null}
    </Drawer>
    <Modal opened={Boolean(archiveTarget)} onClose={() => setArchiveTarget(null)} title="Xác nhận ngừng khai thác" centered>
      <Text size="sm">Trạm <strong>{archiveTarget?.code}</strong> sẽ chuyển sang trạng thái ngừng khai thác. Dữ liệu vận hành và lịch sử vẫn được giữ để tra cứu.</Text>
      <Group justify="flex-end" mt="lg"><Button variant="default" onClick={() => setArchiveTarget(null)}>Hủy</Button><Button color="red" loading={archiving} onClick={() => void archiveSubstation()}>Xác nhận</Button></Group>
    </Modal>
  </Stack>;
}
