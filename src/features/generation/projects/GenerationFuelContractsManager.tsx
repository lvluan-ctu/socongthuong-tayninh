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
import { IconEye, IconFileInvoice, IconPlus, IconTruckDelivery } from '@tabler/icons-react';
import type { DataTableColumn } from 'mantine-datatable';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { CrudDataTable, DataTableAction, DataTableActions } from '@/components/data/CrudDataTable';
import { FormValidationAlert } from '@/components/forms/FormValidationAlert';

const schema = z.object({
  storageId: z.string().nullable(),
  supplierCode: z.string().trim().min(1, 'Nhập mã nhà cung cấp').max(80),
  supplierName: z.string().trim().min(2, 'Nhập tên nhà cung cấp').max(250),
  contractNo: z.string().trim().min(1, 'Nhập số hợp đồng'),
  fuelType: z.string().trim().min(1, 'Nhập loại nhiên liệu'),
  contractedQuantity: z.number().positive('Sản lượng cam kết phải lớn hơn 0').nullable().refine((value) => value != null, 'Nhập sản lượng cam kết'),
  unit: z.string().trim().min(1, 'Nhập đơn vị tính').max(30),
  startAt: z.string().min(1, 'Chọn ngày bắt đầu'),
  endAt: z.string().min(1, 'Chọn ngày kết thúc'),
  deliveryRatePerDay: z.number().min(0).nullable(),
  status: z.enum(['DRAFT', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'COMPLETED', 'CANCELLED']),
  documentRef: z.string().trim().min(2, 'Nhập tham chiếu hồ sơ hợp đồng').max(1000),
  notes: z.string().max(4000),
}).refine((value) => value.endAt >= value.startAt, { path: ['endAt'], message: 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.' });

type FormValues = z.input<typeof schema>;
type FormSubmission = z.output<typeof schema>;

type StorageItem = {
  id: string;
  code: string;
  name: string | null;
  fuelType: string;
  capacity: number;
  unit: string;
  minimumReserve: number | null;
};

type ContractItem = {
  id: string;
  storageId: string | null;
  storageName: string | null;
  storageCode: string | null;
  supplierPartyId: string | null;
  supplierName: string | null;
  supplierCode: string | null;
  contractNo: string;
  fuelType: string;
  contractedQuantity: number | null;
  unit: string | null;
  startAt: string | null;
  endAt: string | null;
  deliveryRatePerDay: number | null;
  status: string;
  documentRef: string | null;
  metadata: Record<string, unknown>;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(date);
}

function statusColor(status: string) {
  if (status === 'ACTIVE') return 'green';
  if (status === 'DRAFT') return 'yellow';
  if (status === 'SUSPENDED') return 'orange';
  if (['EXPIRED', 'CANCELLED'].includes(status)) return 'red';
  return 'blue';
}

export function GenerationFuelContractsManager({ projectAssetId, enabled }: { projectAssetId: string; enabled: boolean }) {
  const [storages, setStorages] = useState<StorageItem[]>([]);
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [opened, setOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ active: 0, deliveryRate: 0, contractedQuantity: 0 });
  const [detail, setDetail] = useState<ContractItem | null>(null);

  const form = useForm<FormValues, unknown, FormSubmission>({
    resolver: zodResolver(schema),
    defaultValues: {
      storageId: null, supplierCode: '', supplierName: '', contractNo: '', fuelType: '', contractedQuantity: null,
      unit: '', startAt: '', endAt: '', deliveryRatePerDay: null, status: 'ACTIVE', documentRef: '', notes: '',
    },
  });

  const reload = useCallback(async (nextPage = 1, nextPageSize = 25) => {
    setLoading(true);
    try {
      const [storageRes, contractRes] = await Promise.all([
        fetch(`/api/generation/fuel/storages?projectAssetId=${projectAssetId}&options=true`, { cache: 'no-store' }),
        fetch(`/api/generation/fuel/contracts?projectAssetId=${projectAssetId}&page=${nextPage}&pageSize=${nextPageSize}`, { cache: 'no-store' }),
      ]);
      if (storageRes.ok) setStorages((await storageRes.json() as { items: StorageItem[] }).items ?? []);
      if (contractRes.ok) {
        const data = await contractRes.json() as { items: ContractItem[]; pagination?: { total?: number; page?: number; pageSize?: number }; summary?: { active?: number; deliveryRate?: number; contractedQuantity?: number } };
        setContracts(data.items ?? []);
        setTotal(Number(data.pagination?.total ?? 0));
        setSummary({ active: Number(data.summary?.active ?? 0), deliveryRate: Number(data.summary?.deliveryRate ?? 0), contractedQuantity: Number(data.summary?.contractedQuantity ?? 0) });
        if (data.pagination?.page) setPage(data.pagination.page);
        if (data.pagination?.pageSize) setPageSize(data.pagination.pageSize);
      }
    } finally { setLoading(false); }
  }, [projectAssetId]);

  useEffect(() => { const timer = window.setTimeout(() => { void reload(); }, 0); return () => window.clearTimeout(timer); }, [reload]);

  const columns: DataTableColumn<ContractItem>[] = [
    { accessor: 'actions', title: '', width: 64, render: (item) => <DataTableActions><DataTableAction label="Xem hợp đồng" icon={<IconEye size={16} />} onClick={() => setDetail(item)} /></DataTableActions> },
    { accessor: 'contractNo', title: 'Số HĐ', width: 150, render: (item) => <Text fw={900}>{item.contractNo}</Text> },
    { accessor: 'supplierName', title: 'Nhà cung cấp', width: 200, render: (item) => <div><Text fw={700}>{item.supplierName ?? 'Chưa khai báo'}</Text><Text size="xs" c="dimmed">{item.supplierCode ?? '—'}</Text></div> },
    { accessor: 'fuelType', title: 'Nhiên liệu', width: 130, render: (item) => item.fuelType },
    { accessor: 'storageCode', title: 'Kho nhận', width: 190, render: (item) => item.storageCode ? `${item.storageCode} • ${item.storageName ?? ''}` : 'Chưa gắn kho' },
    { accessor: 'contractedQuantity', title: 'Sản lượng', width: 150, render: (item) => item.contractedQuantity == null ? '—' : `${item.contractedQuantity.toLocaleString('vi-VN')} ${item.unit ?? ''}` },
    { accessor: 'deliveryRatePerDay', title: 'Giao/ngày', width: 150, render: (item) => item.deliveryRatePerDay == null ? '—' : `${item.deliveryRatePerDay.toLocaleString('vi-VN')} ${item.unit ?? ''}/ngày` },
    { accessor: 'startAt', title: 'Hiệu lực', width: 220, render: (item) => `${formatDate(item.startAt)} → ${formatDate(item.endAt)}` },
    { accessor: 'status', title: 'Trạng thái', width: 140, render: (item) => <Badge color={statusColor(item.status)} variant="light">{item.status}</Badge> },
    { accessor: 'documentRef', title: 'Hồ sơ', width: 160, render: (item) => item.documentRef ? <Text component="a" href={item.documentRef} target="_blank" c="blue" fw={700}>Mở hồ sơ</Text> : '—' },
  ];

  const submit = form.handleSubmit(async (values) => {
    setSaving(true);
    try {
      const response = await fetch('/api/generation/fuel/contracts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          projectAssetId,
          storageId: values.storageId || null,
          supplierCode: values.supplierCode || null,
          supplierName: values.supplierName || null,
          unit: values.unit || null,
          startAt: values.startAt || null,
          endAt: values.endAt || null,
          documentRef: values.documentRef || null,
          notes: values.notes || null,
        }),
      });
      const data = await response.json() as { message?: string };
      if (!response.ok) throw new Error(data.message || 'Không thể lưu hợp đồng cung ứng.');
      notifications.show({ title: 'Đã lưu hợp đồng', message: 'Nguồn cung nhiên liệu đã được liên kết với dự án và kho tương ứng.', color: 'green' });
      setOpened(false);
      form.reset();
      await reload();
    } catch (error) {
      notifications.show({ title: 'Không thể lưu', message: error instanceof Error ? error.message : 'Lỗi không xác định.', color: 'red' });
    } finally { setSaving(false); }
  });

  if (!enabled) {
    return (
      <Paper radius="xl" p="lg" withBorder className="energy-glass">
        <Group gap="sm"><IconTruckDelivery size={22}/><Title order={3}>Cung ứng nhiên liệu</Title></Group>
        <Text c="dimmed" mt="xs">Loại nguồn này hiện không được đánh dấu là nguồn cần quản lý nhiên liệu đầu vào. Module vẫn có thể bật nếu hồ sơ thực tế yêu cầu.</Text>
      </Paper>
    );
  }

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Paper radius="xl" p="md" withBorder><Text size="xs" c="dimmed" fw={800}>HỢP ĐỒNG</Text><Text fz={26} fw={900}>{total}</Text></Paper>
        <Paper radius="xl" p="md" withBorder><Text size="xs" c="dimmed" fw={800}>ĐANG HIỆU LỰC</Text><Text fz={26} fw={900}>{summary.active}</Text></Paper>
        <Paper radius="xl" p="md" withBorder><Text size="xs" c="dimmed" fw={800}>NHỊP GIAO HÀNG</Text><Text fz={26} fw={900}>{summary.deliveryRate.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}</Text><Text size="xs" c="dimmed">đơn vị/ngày theo hợp đồng</Text></Paper>
        <Paper radius="xl" p="md" withBorder><Text size="xs" c="dimmed" fw={800}>SẢN LƯỢNG HỢP ĐỒNG</Text><Text fz={26} fw={900}>{summary.contractedQuantity.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}</Text><Text size="xs" c="dimmed">theo các hợp đồng đang hiệu lực</Text></Paper>
      </SimpleGrid>

      <Paper radius="xl" p="lg" withBorder className="energy-glass">
        <Group justify="space-between" mb="md">
          <div><Group gap="sm"><IconFileInvoice size={22}/><Title order={3}>Hợp đồng / nguồn cung nhiên liệu</Title></Group><Text size="sm" c="dimmed">Theo dõi nhà cung cấp, sản lượng cam kết, nhịp giao hàng, hiệu lực và hồ sơ hợp đồng để giải thích khả năng duy trì nguồn nhiên liệu.</Text></div>
          <Button leftSection={<IconPlus size={16}/>} onClick={() => setOpened(true)}>Thêm hợp đồng</Button>
        </Group>
        <CrudDataTable records={contracts} columns={columns} idAccessor="id" page={page} totalRecords={total} recordsPerPage={pageSize} onPageChange={(nextPage) => { setPage(nextPage); void reload(nextPage, pageSize); }} onRecordsPerPageChange={(nextSize) => { setPage(1); setPageSize(nextSize); void reload(1, nextSize); }} fetching={loading} rowExpansion={{ allowMultiple: true, content: ({ record }) => <SimpleGrid cols={{ base: 1, sm: 3 }} p="sm"><div><Text size="xs" c="dimmed" fw={800}>Hợp đồng</Text><Text size="sm">{record.contractNo} • {record.fuelType}</Text><Text size="xs" c="dimmed">{formatDate(record.startAt)} → {formatDate(record.endAt)}</Text></div><div><Text size="xs" c="dimmed" fw={800}>Nhà cung cấp / kho</Text><Text size="sm">{record.supplierName ?? 'Chưa khai báo'}</Text><Text size="xs" c="dimmed">{record.storageCode ?? 'Chưa gắn kho'} • {record.storageName ?? '—'}</Text></div><div><Text size="xs" c="dimmed" fw={800}>Chứng từ</Text><Text size="sm">{record.documentRef ?? 'Chưa có hồ sơ'}</Text><Text size="xs" c="dimmed">{record.metadata?.notes ? String(record.metadata.notes) : 'Không có ghi chú'}</Text></div></SimpleGrid> }} emptyState={<Text c="dimmed" ta="center" py="xl">Chưa khai báo hợp đồng cung ứng nhiên liệu.</Text>} />
      </Paper>

      <Drawer opened={opened} onClose={() => setOpened(false)} title="Thêm hợp đồng cung ứng nhiên liệu" position="right" size="lg">
        <form onSubmit={submit} noValidate><Stack>
          <FormValidationAlert errors={form.formState.errors as Record<string, unknown>} />
          <SimpleGrid cols={2}><TextInput label="Số hợp đồng" withAsterisk error={form.formState.errors.contractNo?.message} {...form.register('contractNo')}/><TextInput label="Loại nhiên liệu" withAsterisk placeholder="BIOMASS / LNG / RDF..." error={form.formState.errors.fuelType?.message} {...form.register('fuelType')}/></SimpleGrid>
          <SimpleGrid cols={2}><TextInput label="Mã nhà cung cấp" withAsterisk error={form.formState.errors.supplierCode?.message} {...form.register('supplierCode')}/><TextInput label="Tên nhà cung cấp" withAsterisk error={form.formState.errors.supplierName?.message} {...form.register('supplierName')}/></SimpleGrid>
          <Controller control={form.control} name="storageId" render={({ field, fieldState }) => <Select label="Kho/bể/bãi nhận nhiên liệu" clearable searchable data={storages.map((storage) => ({ value: storage.id, label: `${storage.code} • ${storage.name ?? storage.fuelType}` }))} value={field.value} onChange={field.onChange} error={fieldState.error?.message}/>}/>
          <SimpleGrid cols={3}><Controller control={form.control} name="contractedQuantity" render={({ field, fieldState }) => <NumberInput label="Sản lượng cam kết" withAsterisk min={0} decimalScale={4} value={field.value ?? ''} onChange={(v) => field.onChange(v === '' ? null : Number(v))} error={fieldState.error?.message}/>}/><TextInput label="Đơn vị" withAsterisk placeholder="tấn / Nm³..." error={form.formState.errors.unit?.message} {...form.register('unit')}/><Controller control={form.control} name="deliveryRatePerDay" render={({ field, fieldState }) => <NumberInput label="Giao bình quân/ngày" min={0} decimalScale={4} value={field.value ?? ''} onChange={(v) => field.onChange(v === '' ? null : Number(v))} error={fieldState.error?.message}/>}/></SimpleGrid>
          <SimpleGrid cols={2}><TextInput type="date" label="Hiệu lực từ" withAsterisk error={form.formState.errors.startAt?.message} {...form.register('startAt')}/><TextInput type="date" label="Đến ngày" withAsterisk error={form.formState.errors.endAt?.message} {...form.register('endAt')}/></SimpleGrid>
          <Controller control={form.control} name="status" render={({ field, fieldState }) => <Select label="Trạng thái" withAsterisk data={['DRAFT','ACTIVE','SUSPENDED','EXPIRED','COMPLETED','CANCELLED']} value={field.value} onChange={(v) => field.onChange(v ?? 'ACTIVE')} error={fieldState.error?.message}/>}/>
          <TextInput label="File / Drive / hồ sơ hợp đồng" withAsterisk placeholder="https://..." error={form.formState.errors.documentRef?.message} {...form.register('documentRef')}/>
          <Textarea label="Ghi chú điều khoản cung ứng" minRows={4} error={form.formState.errors.notes?.message} {...form.register('notes')}/>
          <Group justify="flex-end"><Button variant="default" onClick={() => setOpened(false)}>Hủy</Button><Button type="submit" loading={saving}>Lưu hợp đồng</Button></Group>
        </Stack></form>
      </Drawer>
      <Drawer opened={Boolean(detail)} onClose={() => setDetail(null)} title="Chi tiết hợp đồng cung ứng" position="right" size="md">
        {detail ? <Stack gap="sm"><Text fw={900}>{detail.contractNo} • {detail.fuelType}</Text><Text>Nhà cung cấp: {detail.supplierName ?? 'Chưa khai báo'}</Text><Text>Kho nhận: {detail.storageCode ?? 'Chưa gắn kho'} • {detail.storageName ?? '—'}</Text><Text>Sản lượng: {detail.contractedQuantity == null ? '—' : `${detail.contractedQuantity.toLocaleString('vi-VN')} ${detail.unit ?? ''}`}</Text><Text>Hiệu lực: {formatDate(detail.startAt)} → {formatDate(detail.endAt)}</Text><Text>Hồ sơ: {detail.documentRef ?? '—'}</Text></Stack> : null}
      </Drawer>
    </Stack>
  );
}
