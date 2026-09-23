'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Badge,
  Button,
  Drawer,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconActivityHeartbeat, IconEye, IconPlus, IconSettingsAutomation } from '@tabler/icons-react';
import type { DataTableColumn } from 'mantine-datatable';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { CrudDataTable, DataTableAction, DataTableActions } from '@/components/data/CrudDataTable';
import { FormValidationAlert } from '@/components/forms/FormValidationAlert';

const unitSchema = z.object({
  code: z.string().trim().min(1, 'Nhập mã tổ máy'),
  name: z.string().trim().min(1, 'Nhập tên tổ máy'),
  unitType: z.string().trim().min(1, 'Nhập loại tổ máy'),
  designedCapacityMw: z.number().positive('Công suất thiết kế phải lớn hơn 0').nullable().refine((value) => value != null, 'Nhập công suất thiết kế'),
  availableCapacityMw: z.number().min(0).nullable(),
  manufacturer: z.string().max(200),
  model: z.string().max(200),
  serialNumber: z.string().max(200),
  commissionedAt: z.string(),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'OUTAGE', 'PLANNED', 'RETIRED']),
}).superRefine((value, context) => {
  if (value.status === 'ACTIVE' && !value.commissionedAt) context.addIssue({ code: 'custom', path: ['commissionedAt'], message: 'Tổ máy đang hoạt động phải có ngày vận hành.' });
  if (value.availableCapacityMw != null && value.designedCapacityMw != null && value.availableCapacityMw > value.designedCapacityMw * 1.2) context.addIssue({ code: 'custom', path: ['availableCapacityMw'], message: 'Công suất khả dụng vượt 120% thiết kế; hãy kiểm tra số liệu.' });
});

type UnitForm = z.input<typeof unitSchema>;
type UnitSubmission = z.output<typeof unitSchema>;

type UnitItem = {
  id: string;
  code: string;
  name: string;
  unitType: string;
  designedCapacityMw: number | null;
  availableCapacityMw: number | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  commissionedAt: string | null;
  status: string;
};

type SnapshotItem = {
  id: string;
  unitId: string | null;
  unitCode: string | null;
  unitName: string | null;
  measuredAt: string;
  activePowerMw: number | null;
  energyMwh: number | null;
  availableCapacityMw: number | null;
  availabilityPct: number | null;
  efficiencyPct: number | null;
  operationStatus: string | null;
  quality: string;
  notes: string | null;
};

const snapshotSchema = z.object({
  unitId: z.string().nullable(),
  measuredAt: z.string().min(1),
  activePowerMw: z.number().min(0).nullable(),
  energyMwh: z.number().min(0).nullable(),
  availableCapacityMw: z.number().min(0).nullable(),
  availabilityPct: z.number().min(0).max(100).nullable(),
  efficiencyPct: z.number().min(0).max(100).nullable(),
  operationStatus: z.string().max(100),
  quality: z.enum(['GOOD', 'ESTIMATED', 'MISSING', 'INVALID']),
  notes: z.string().max(2000),
}).superRefine((value, context) => {
  if ([value.activePowerMw, value.energyMwh, value.availableCapacityMw, value.availabilityPct, value.efficiencyPct].every((item) => item == null)) context.addIssue({ code: 'custom', path: ['activePowerMw'], message: 'Nhập ít nhất một chỉ số vận hành.' });
});

type SnapshotForm = z.infer<typeof snapshotSchema>;

function formatDate(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(d);
}

function fmt(value: number | null, unit: string) {
  return value == null ? '—' : `${value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ${unit}`;
}

export function GenerationUnitOperationsManager({ projectAssetId }: { projectAssetId: string }) {
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [unitOpened, setUnitOpened] = useState(false);
  const [snapshotOpened, setSnapshotOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unitPage, setUnitPage] = useState(1);
  const [unitPageSize, setUnitPageSize] = useState(25);
  const [unitTotal, setUnitTotal] = useState(0);
  const [snapshotPage, setSnapshotPage] = useState(1);
  const [snapshotPageSize, setSnapshotPageSize] = useState(25);
  const [snapshotTotal, setSnapshotTotal] = useState(0);
  const [unitSummary, setUnitSummary] = useState({ designed: 0, available: 0 });
  const [snapshotSummary, setSnapshotSummary] = useState<{ latestPower: number | null }>({ latestPower: null });
  const [detail, setDetail] = useState<{ unit?: UnitItem; snapshot?: SnapshotItem } | null>(null);

  const unitForm = useForm<UnitForm, unknown, UnitSubmission>({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      code: '', name: '', unitType: 'GENERATOR', designedCapacityMw: null, availableCapacityMw: null,
      manufacturer: '', model: '', serialNumber: '', commissionedAt: '', status: 'ACTIVE',
    },
  });

  const snapshotForm = useForm<SnapshotForm>({
    resolver: zodResolver(snapshotSchema),
    defaultValues: {
      unitId: null,
      measuredAt: new Date().toISOString().slice(0, 16),
      activePowerMw: null,
      energyMwh: null,
      availableCapacityMw: null,
      availabilityPct: null,
      efficiencyPct: null,
      operationStatus: 'RUNNING',
      quality: 'GOOD',
      notes: '',
    },
  });

  const reload = useCallback(async (nextUnitPage = 1, nextUnitPageSize = 25, nextSnapshotPage = 1, nextSnapshotPageSize = 25) => {
    setLoading(true);
    try {
      const [unitRes, snapshotRes] = await Promise.all([
        fetch(`/api/generation/units?projectAssetId=${projectAssetId}&page=${nextUnitPage}&pageSize=${nextUnitPageSize}`, { cache: 'no-store' }),
        fetch(`/api/generation/operational-snapshots?projectAssetId=${projectAssetId}&page=${nextSnapshotPage}&pageSize=${nextSnapshotPageSize}`, { cache: 'no-store' }),
      ]);
      if (unitRes.ok) {
        const data = await unitRes.json() as { items: UnitItem[]; pagination?: { total?: number; page?: number; pageSize?: number }; summary?: { designed?: number; available?: number } };
        setUnits(data.items ?? []);
        setUnitTotal(Number(data.pagination?.total ?? 0));
        setUnitSummary({ designed: Number(data.summary?.designed ?? 0), available: Number(data.summary?.available ?? 0) });
        if (data.pagination?.page) setUnitPage(data.pagination.page);
        if (data.pagination?.pageSize) setUnitPageSize(data.pagination.pageSize);
      }
      if (snapshotRes.ok) {
        const data = await snapshotRes.json() as { items: SnapshotItem[]; pagination?: { total?: number; page?: number; pageSize?: number }; summary?: { latestPower?: number | null } };
        setSnapshots(data.items ?? []);
        setSnapshotTotal(Number(data.pagination?.total ?? 0));
        setSnapshotSummary({ latestPower: data.summary?.latestPower == null ? null : Number(data.summary.latestPower) });
        if (data.pagination?.page) setSnapshotPage(data.pagination.page);
        if (data.pagination?.pageSize) setSnapshotPageSize(data.pagination.pageSize);
      }
    } finally { setLoading(false); }
  }, [projectAssetId]);

  useEffect(() => { const timer = window.setTimeout(() => { void reload(); }, 0); return () => window.clearTimeout(timer); }, [reload]);

  const totalDesigned = unitSummary.designed;
  const totalAvailable = unitSummary.available;

  const unitColumns: DataTableColumn<UnitItem>[] = [
    { accessor: 'actions', title: '', width: 64, render: (item) => <DataTableActions><DataTableAction label="Xem chi tiết tổ máy" icon={<IconEye size={16} />} onClick={() => setDetail({ unit: item })} /></DataTableActions> },
    { accessor: 'code', title: 'Mã', width: 140, render: (item) => <Text fw={800}>{item.code}</Text> },
    { accessor: 'name', title: 'Tên', width: 180, render: (item) => item.name },
    { accessor: 'unitType', title: 'Loại', width: 140, render: (item) => item.unitType },
    { accessor: 'designedCapacityMw', title: 'Thiết kế', width: 130, render: (item) => fmt(item.designedCapacityMw, 'MW') },
    { accessor: 'availableCapacityMw', title: 'Khả dụng', width: 130, render: (item) => fmt(item.availableCapacityMw, 'MW') },
    { accessor: 'manufacturer', title: 'Hãng / Model', width: 200, render: (item) => <div><Text size="sm">{item.manufacturer ?? '—'}</Text><Text size="xs" c="dimmed">{item.model ?? item.serialNumber ?? '—'}</Text></div> },
    { accessor: 'commissionedAt', title: 'Vận hành', width: 140, render: (item) => formatDate(item.commissionedAt) },
    { accessor: 'status', title: 'Trạng thái', width: 140, render: (item) => <Badge color={item.status === 'ACTIVE' ? 'green' : item.status === 'OUTAGE' ? 'red' : 'orange'} variant="light">{item.status}</Badge> },
  ];

  const snapshotColumns: DataTableColumn<SnapshotItem>[] = [
    { accessor: 'actions', title: '', width: 64, render: (item) => <DataTableActions><DataTableAction label="Xem chi tiết snapshot" icon={<IconEye size={16} />} onClick={() => setDetail({ snapshot: item })} /></DataTableActions> },
    { accessor: 'measuredAt', title: 'Thời điểm', width: 150, render: (item) => formatDate(item.measuredAt) },
    { accessor: 'unitCode', title: 'Tổ máy', width: 180, render: (item) => item.unitCode ? `${item.unitCode} • ${item.unitName ?? ''}` : 'Toàn nhà máy' },
    { accessor: 'activePowerMw', title: 'P', width: 120, render: (item) => fmt(item.activePowerMw, 'MW') },
    { accessor: 'energyMwh', title: 'Sản lượng', width: 130, render: (item) => fmt(item.energyMwh, 'MWh') },
    { accessor: 'availableCapacityMw', title: 'Khả dụng', width: 130, render: (item) => fmt(item.availableCapacityMw, 'MW') },
    { accessor: 'availabilityPct', title: 'Availability', width: 130, render: (item) => item.availabilityPct == null ? '—' : `${item.availabilityPct}%` },
    { accessor: 'efficiencyPct', title: 'Hiệu suất', width: 120, render: (item) => item.efficiencyPct == null ? '—' : `${item.efficiencyPct}%` },
    { accessor: 'quality', title: 'Quality', width: 120, render: (item) => <Badge color={item.quality === 'GOOD' ? 'green' : item.quality === 'ESTIMATED' ? 'yellow' : 'red'} variant="light">{item.quality}</Badge> },
    { accessor: 'operationStatus', title: 'Trạng thái', width: 140, render: (item) => item.operationStatus ?? '—' },
  ];

  const createUnit = unitForm.handleSubmit(async (values) => {
    setSaving(true);
    try {
      const response = await fetch('/api/generation/units', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectAssetId,
          ...values,
          commissionedAt: values.commissionedAt || null,
          manufacturer: values.manufacturer || null,
          model: values.model || null,
          serialNumber: values.serialNumber || null,
          technicalSpecs: {},
        }),
      });
      const data = await response.json() as { message?: string };
      if (!response.ok) throw new Error(data.message || 'Không thể tạo tổ máy.');
      notifications.show({ title: 'Đã lưu tổ máy', message: 'Thông tin tổ máy đã được ghi vào Generation Unit Registry.', color: 'green' });
      setUnitOpened(false);
      unitForm.reset();
      await reload();
    } catch (error) {
      notifications.show({ title: 'Không thể lưu', message: error instanceof Error ? error.message : 'Lỗi không xác định.', color: 'red' });
    } finally { setSaving(false); }
  });

  const createSnapshot = snapshotForm.handleSubmit(async (values) => {
    setSaving(true);
    try {
      const response = await fetch('/api/generation/operational-snapshots', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, projectAssetId, operationStatus: values.operationStatus || null, notes: values.notes || null }),
      });
      const data = await response.json() as { message?: string };
      if (!response.ok) throw new Error(data.message || 'Không thể ghi nhận vận hành.');
      notifications.show({ title: 'Đã ghi nhận vận hành', message: 'Snapshot vận hành được lưu lịch sử, không ghi đè số liệu trước.', color: 'green' });
      setSnapshotOpened(false);
      await reload();
    } catch (error) {
      notifications.show({ title: 'Không thể lưu', message: error instanceof Error ? error.message : 'Lỗi không xác định.', color: 'red' });
    } finally { setSaving(false); }
  });

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Paper radius="xl" p="md" withBorder><Text size="xs" c="dimmed" fw={800}>TỔ MÁY</Text><Text fz={26} fw={900}>{unitTotal}</Text></Paper>
        <Paper radius="xl" p="md" withBorder><Text size="xs" c="dimmed" fw={800}>CÔNG SUẤT THIẾT KẾ</Text><Text fz={26} fw={900}>{fmt(totalDesigned, 'MW')}</Text></Paper>
        <Paper radius="xl" p="md" withBorder><Text size="xs" c="dimmed" fw={800}>KHẢ DỤNG</Text><Text fz={26} fw={900}>{fmt(totalAvailable, 'MW')}</Text></Paper>
        <Paper radius="xl" p="md" withBorder><Text size="xs" c="dimmed" fw={800}>P GẦN NHẤT</Text><Text fz={26} fw={900}>{fmt(snapshotSummary.latestPower, 'MW')}</Text><Text size="xs" c="dimmed">Theo dữ liệu snapshot</Text></Paper>
      </SimpleGrid>

      <Paper radius="xl" p="lg" withBorder className="energy-glass">
        <Group justify="space-between" mb="md">
          <div><Group gap="sm"><IconSettingsAutomation size={22}/><Title order={3}>Tổ máy / Generation Units</Title></Group><Text size="sm" c="dimmed">Quản lý từng tổ máy, turbine, block, inverter station hoặc unit kỹ thuật thuộc dự án.</Text></div>
          <Button leftSection={<IconPlus size={16}/>} onClick={() => setUnitOpened(true)}>Thêm tổ máy</Button>
        </Group>
        <CrudDataTable records={units} columns={unitColumns} idAccessor="id" page={unitPage} totalRecords={unitTotal} recordsPerPage={unitPageSize} onPageChange={(nextPage) => { setUnitPage(nextPage); void reload(nextPage, unitPageSize, snapshotPage, snapshotPageSize); }} onRecordsPerPageChange={(nextSize) => { setUnitPage(1); setUnitPageSize(nextSize); void reload(1, nextSize, snapshotPage, snapshotPageSize); }} fetching={loading} rowExpansion={{ allowMultiple: true, content: ({ record }) => <SimpleGrid cols={{ base: 1, sm: 3 }} p="sm"><div><Text size="xs" c="dimmed" fw={800}>Tổ máy</Text><Text size="sm">{record.code} • {record.name}</Text><Text size="xs" c="dimmed">{record.unitType} • {record.status}</Text></div><div><Text size="xs" c="dimmed" fw={800}>Công suất</Text><Text size="sm">Thiết kế {fmt(record.designedCapacityMw, 'MW')}</Text><Text size="xs" c="dimmed">Khả dụng {fmt(record.availableCapacityMw, 'MW')}</Text></div><div><Text size="xs" c="dimmed" fw={800}>Nhận dạng</Text><Text size="sm">{record.manufacturer ?? 'Chưa có hãng'}</Text><Text size="xs" c="dimmed">{record.model ?? record.serialNumber ?? 'Chưa có model/serial'}</Text></div></SimpleGrid> }} emptyState={<Text c="dimmed" ta="center" py="xl">Chưa khai báo tổ máy.</Text>} />
      </Paper>

      <Paper radius="xl" p="lg" withBorder className="energy-glass">
        <Group justify="space-between" mb="md">
          <div><Group gap="sm"><IconActivityHeartbeat size={22}/><Title order={3}>Lịch sử vận hành</Title></Group><Text size="sm" c="dimmed">Snapshot theo thời gian: công suất, sản lượng, availability, efficiency, trạng thái và chất lượng dữ liệu.</Text></div>
          <Button variant="light" leftSection={<IconPlus size={16}/>} onClick={() => setSnapshotOpened(true)}>Ghi vận hành</Button>
        </Group>
        <CrudDataTable records={snapshots} columns={snapshotColumns} idAccessor="id" page={snapshotPage} totalRecords={snapshotTotal} recordsPerPage={snapshotPageSize} onPageChange={(nextPage) => { setSnapshotPage(nextPage); void reload(unitPage, unitPageSize, nextPage, snapshotPageSize); }} onRecordsPerPageChange={(nextSize) => { setSnapshotPage(1); setSnapshotPageSize(nextSize); void reload(unitPage, unitPageSize, 1, nextSize); }} fetching={loading} rowExpansion={{ allowMultiple: true, content: ({ record }) => <SimpleGrid cols={{ base: 1, sm: 3 }} p="sm"><div><Text size="xs" c="dimmed" fw={800}>Snapshot</Text><Text size="sm">{formatDate(record.measuredAt)} • {record.unitCode ?? 'Toàn nhà máy'}</Text><Text size="xs" c="dimmed">{record.operationStatus ?? 'Chưa khai báo trạng thái'}</Text></div><div><Text size="xs" c="dimmed" fw={800}>Công suất / sản lượng</Text><Text size="sm">P {fmt(record.activePowerMw, 'MW')} • E {fmt(record.energyMwh, 'MWh')}</Text><Text size="xs" c="dimmed">Khả dụng {fmt(record.availableCapacityMw, 'MW')}</Text></div><div><Text size="xs" c="dimmed" fw={800}>Chất lượng</Text><Badge color={record.quality === 'GOOD' ? 'green' : record.quality === 'ESTIMATED' ? 'yellow' : 'red'} variant="light">{record.quality}</Badge><Text size="xs" c="dimmed">{record.notes ?? 'Không có ghi chú'}</Text></div></SimpleGrid> }} emptyState={<Text c="dimmed" ta="center" py="xl">Chưa có snapshot vận hành.</Text>} />
      </Paper>

      <Drawer opened={unitOpened} onClose={() => setUnitOpened(false)} title="Thêm tổ máy" position="right" size="lg">
        <form onSubmit={createUnit} noValidate><Stack>
          <FormValidationAlert errors={unitForm.formState.errors as Record<string, unknown>} />
          <SimpleGrid cols={2}><TextInput label="Mã tổ máy" withAsterisk error={unitForm.formState.errors.code?.message} {...unitForm.register('code')}/><TextInput label="Tên tổ máy" withAsterisk error={unitForm.formState.errors.name?.message} {...unitForm.register('name')}/></SimpleGrid>
          <SimpleGrid cols={2}><TextInput label="Loại unit" withAsterisk placeholder="GENERATOR / TURBINE / BLOCK..." error={unitForm.formState.errors.unitType?.message} {...unitForm.register('unitType')}/><Controller control={unitForm.control} name="status" render={({ field, fieldState }) => <Select label="Trạng thái" withAsterisk data={['ACTIVE','MAINTENANCE','OUTAGE','PLANNED','RETIRED']} value={field.value} onChange={(v) => field.onChange(v ?? 'ACTIVE')} error={fieldState.error?.message}/>}/></SimpleGrid>
          <SimpleGrid cols={2}><Controller control={unitForm.control} name="designedCapacityMw" render={({ field, fieldState }) => <NumberInput label="Công suất thiết kế (MW)" withAsterisk min={0} decimalScale={3} value={field.value ?? ''} onChange={(v) => field.onChange(v === '' ? null : Number(v))} error={fieldState.error?.message}/>}/><Controller control={unitForm.control} name="availableCapacityMw" render={({ field, fieldState }) => <NumberInput label="Công suất khả dụng (MW)" min={0} decimalScale={3} value={field.value ?? ''} onChange={(v) => field.onChange(v === '' ? null : Number(v))} error={fieldState.error?.message}/>}/></SimpleGrid>
          <SimpleGrid cols={2}><TextInput label="Nhà sản xuất" error={unitForm.formState.errors.manufacturer?.message} {...unitForm.register('manufacturer')}/><TextInput label="Model" error={unitForm.formState.errors.model?.message} {...unitForm.register('model')}/></SimpleGrid>
          <SimpleGrid cols={2}><TextInput label="Serial" error={unitForm.formState.errors.serialNumber?.message} {...unitForm.register('serialNumber')}/><TextInput type="date" label="Ngày vận hành" error={unitForm.formState.errors.commissionedAt?.message} {...unitForm.register('commissionedAt')}/></SimpleGrid>
          <Group justify="flex-end"><Button variant="default" onClick={() => setUnitOpened(false)}>Hủy</Button><Button type="submit" loading={saving}>Lưu tổ máy</Button></Group>
        </Stack></form>
      </Drawer>

      <Drawer opened={snapshotOpened} onClose={() => setSnapshotOpened(false)} title="Ghi nhận vận hành" position="right" size="lg">
        <form onSubmit={createSnapshot} noValidate><Stack>
          <FormValidationAlert errors={snapshotForm.formState.errors as Record<string, unknown>} />
          <Controller control={snapshotForm.control} name="unitId" render={({ field, fieldState }) => <Select label="Tổ máy" description="Để trống nếu snapshot ở cấp toàn nhà máy" clearable data={units.map((u) => ({ value: u.id, label: `${u.code} • ${u.name}` }))} value={field.value} onChange={field.onChange} error={fieldState.error?.message}/>}/>
          <TextInput type="datetime-local" label="Thời điểm ghi nhận" withAsterisk error={snapshotForm.formState.errors.measuredAt?.message} {...snapshotForm.register('measuredAt')}/>
          <SimpleGrid cols={2}><Controller control={snapshotForm.control} name="activePowerMw" render={({ field, fieldState }) => <NumberInput label="P (MW)" min={0} decimalScale={4} value={field.value ?? ''} onChange={(v) => field.onChange(v === '' ? null : Number(v))} error={fieldState.error?.message}/>}/><Controller control={snapshotForm.control} name="energyMwh" render={({ field, fieldState }) => <NumberInput label="Sản lượng (MWh)" min={0} decimalScale={4} value={field.value ?? ''} onChange={(v) => field.onChange(v === '' ? null : Number(v))} error={fieldState.error?.message}/>}/></SimpleGrid>
          <SimpleGrid cols={2}><Controller control={snapshotForm.control} name="availableCapacityMw" render={({ field, fieldState }) => <NumberInput label="Available capacity (MW)" min={0} decimalScale={4} value={field.value ?? ''} onChange={(v) => field.onChange(v === '' ? null : Number(v))} error={fieldState.error?.message}/>}/><Controller control={snapshotForm.control} name="availabilityPct" render={({ field, fieldState }) => <NumberInput label="Availability (%)" min={0} max={100} decimalScale={2} value={field.value ?? ''} onChange={(v) => field.onChange(v === '' ? null : Number(v))} error={fieldState.error?.message}/>}/></SimpleGrid>
          <SimpleGrid cols={2}><Controller control={snapshotForm.control} name="efficiencyPct" render={({ field, fieldState }) => <NumberInput label="Efficiency (%)" min={0} max={100} decimalScale={2} value={field.value ?? ''} onChange={(v) => field.onChange(v === '' ? null : Number(v))} error={fieldState.error?.message}/>}/><Controller control={snapshotForm.control} name="quality" render={({ field, fieldState }) => <Select label="Chất lượng dữ liệu" withAsterisk data={['GOOD','ESTIMATED','MISSING','INVALID']} value={field.value} onChange={(v) => field.onChange(v ?? 'GOOD')} error={fieldState.error?.message}/>}/></SimpleGrid>
          <TextInput label="Trạng thái vận hành" withAsterisk error={snapshotForm.formState.errors.operationStatus?.message} {...snapshotForm.register('operationStatus')}/>
          <Textarea label="Ghi chú" minRows={3} error={snapshotForm.formState.errors.notes?.message} {...snapshotForm.register('notes')}/>
          <Group justify="flex-end"><Button variant="default" onClick={() => setSnapshotOpened(false)}>Hủy</Button><Button type="submit" loading={saving}>Ghi snapshot</Button></Group>
        </Stack></form>
      </Drawer>
      <Drawer opened={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.unit ? 'Chi tiết tổ máy' : 'Chi tiết snapshot'} position="right" size="md">
        {detail?.unit ? <Stack gap="sm"><Text fw={900}>{detail.unit.code} • {detail.unit.name}</Text><Text>Loại: {detail.unit.unitType} • {detail.unit.status}</Text><Text>Thiết kế: {fmt(detail.unit.designedCapacityMw, 'MW')}</Text><Text>Khả dụng: {fmt(detail.unit.availableCapacityMw, 'MW')}</Text><Text>Hãng/model: {detail.unit.manufacturer ?? '—'} • {detail.unit.model ?? '—'}</Text><Text>Serial: {detail.unit.serialNumber ?? '—'}</Text></Stack> : null}
        {detail?.snapshot ? <Stack gap="sm"><Text fw={900}>{formatDate(detail.snapshot.measuredAt)} • {detail.snapshot.unitCode ?? 'Toàn nhà máy'}</Text><Text>P: {fmt(detail.snapshot.activePowerMw, 'MW')} • Sản lượng: {fmt(detail.snapshot.energyMwh, 'MWh')}</Text><Text>Khả dụng: {fmt(detail.snapshot.availableCapacityMw, 'MW')}</Text><Text>Availability: {detail.snapshot.availabilityPct == null ? '—' : `${detail.snapshot.availabilityPct}%`}</Text><Text>Quality: {detail.snapshot.quality} • {detail.snapshot.operationStatus ?? '—'}</Text></Stack> : null}
      </Drawer>
    </Stack>
  );
}
