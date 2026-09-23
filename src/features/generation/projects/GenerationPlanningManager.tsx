'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Badge,
  Button,
  Drawer,
  Group,
  MultiSelect,
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
import { IconEye, IconFileDescription, IconGavel, IconPlus } from '@tabler/icons-react';
import type { DataTableColumn } from 'mantine-datatable';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { CrudDataTable, DataTableAction, DataTableActions } from '@/components/data/CrudDataTable';
import { FormValidationAlert } from '@/components/forms/FormValidationAlert';

const documentSchema = z.object({
  documentType: z.enum(['MEETING_MINUTES', 'DECISION', 'PLAN', 'APPROVAL', 'REPORT', 'PROPOSAL', 'OTHER']),
  documentNo: z.string().trim().min(1, 'Nhập số/ký hiệu văn bản').max(150),
  title: z.string().trim().min(2, 'Nhập tiêu đề tài liệu'),
  issuingAuthority: z.string().trim().min(2, 'Nhập cơ quan ban hành/đơn vị họp').max(250),
  issuedAt: z.string().min(1, 'Chọn ngày ban hành'),
  effectiveFrom: z.string(),
  planLevel: z.enum(['NATIONAL', 'PROVINCIAL', 'SECTOR', 'LOCAL', 'OTHER']).nullable(),
  status: z.enum(['DRAFT', 'ACTIVE', 'SUPERSEDED', 'EXPIRED', 'CANCELLED']),
  fileRef: z.string().trim().min(2, 'Nhập đường dẫn hoặc mã tham chiếu file gốc').max(1000),
  notes: z.string().max(4000),
});

type DocumentForm = z.infer<typeof documentSchema>;

type PlanningDocument = {
  id: string;
  projectAssetId: string | null;
  documentType: string;
  documentNo: string | null;
  title: string;
  issuingAuthority: string | null;
  issuedAt: string | null;
  effectiveFrom: string | null;
  planLevel: string | null;
  status: string;
  fileRef: string | null;
  notes: string | null;
  createdAt: string;
};

const planSchema = z.object({
  planLevel: z.enum(['NATIONAL', 'PROVINCIAL', 'SECTOR', 'LOCAL', 'OTHER']),
  planCode: z.string().trim().min(1, 'Nhập mã kế hoạch/quy hoạch').max(120),
  planName: z.string().trim().min(2, 'Nhập tên kế hoạch/quy hoạch'),
  plannedCapacityMw: z.number().positive('Công suất dự kiến phải lớn hơn 0').nullable().refine((value) => value != null, 'Nhập công suất dự kiến'),
  expectedOperationYear: z.number().int().min(2000).max(2200).nullable().refine((value) => value != null, 'Nhập năm vận hành dự kiến'),
  status: z.enum(['PROPOSED', 'UNDER_REVIEW', 'APPROVED', 'ADJUSTED', 'SUSPENDED', 'CANCELLED']),
  meetingMinutesRef: z.string().max(500),
  decisionRef: z.string().max(500),
  documentIds: z.array(z.string()),
  notes: z.string().max(3000),
}).superRefine((value, context) => {
  if (value.status === 'APPROVED' && !value.documentIds.length && !value.decisionRef) context.addIssue({ code: 'custom', path: ['documentIds'], message: 'Kế hoạch đã phê duyệt phải có hồ sơ hoặc quyết định làm căn cứ.' });
});

type PlanForm = z.input<typeof planSchema>;
type PlanSubmission = z.output<typeof planSchema>;

type PlanItem = {
  id: string;
  planLevel: string;
  planCode: string | null;
  planName: string;
  plannedCapacityMw: number | null;
  expectedOperationYear: number | null;
  status: string;
  meetingMinutesRef: string | null;
  decisionRef: string | null;
  documents: Array<{ documentId: string; documentTitle: string; documentType: string; documentNo: string | null }>;
};

function fmtDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(date);
}

function statusColor(status: string) {
  if (['ACTIVE', 'APPROVED'].includes(status)) return 'green';
  if (['UNDER_REVIEW', 'ADJUSTED'].includes(status)) return 'blue';
  if (['DRAFT', 'PROPOSED'].includes(status)) return 'yellow';
  if (['SUSPENDED', 'EXPIRED'].includes(status)) return 'orange';
  return 'gray';
}

export function GenerationPlanningManager({ projectAssetId }: { projectAssetId: string }) {
  const [documents, setDocuments] = useState<PlanningDocument[]>([]);
  const [documentOptions, setDocumentOptions] = useState<PlanningDocument[]>([]);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [documentOpened, setDocumentOpened] = useState(false);
  const [planOpened, setPlanOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [documentPage, setDocumentPage] = useState(1);
  const [documentPageSize, setDocumentPageSize] = useState(25);
  const [documentTotal, setDocumentTotal] = useState(0);
  const [planPage, setPlanPage] = useState(1);
  const [planPageSize, setPlanPageSize] = useState(25);
  const [planTotal, setPlanTotal] = useState(0);
  const [documentSummary, setDocumentSummary] = useState({ meetings: 0 });
  const [planSummary, setPlanSummary] = useState({ approved: 0 });
  const [detail, setDetail] = useState<{ document?: PlanningDocument; plan?: PlanItem } | null>(null);

  const documentForm = useForm<DocumentForm>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      documentType: 'MEETING_MINUTES', documentNo: '', title: '', issuingAuthority: '', issuedAt: '', effectiveFrom: '',
      planLevel: 'PROVINCIAL', status: 'ACTIVE', fileRef: '', notes: '',
    },
  });

  const planForm = useForm<PlanForm, unknown, PlanSubmission>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      planLevel: 'PROVINCIAL', planCode: '', planName: '', plannedCapacityMw: null, expectedOperationYear: null,
      status: 'PROPOSED', meetingMinutesRef: '', decisionRef: '', documentIds: [], notes: '',
    },
  });

  const reload = useCallback(async (nextDocumentPage = 1, nextDocumentPageSize = 25, nextPlanPage = 1, nextPlanPageSize = 25) => {
    setLoading(true);
    try {
      const [docRes, docOptionsRes, planRes] = await Promise.all([
        fetch(`/api/generation/planning-documents?projectAssetId=${projectAssetId}&page=${nextDocumentPage}&pageSize=${nextDocumentPageSize}`, { cache: 'no-store' }),
        fetch(`/api/generation/planning-documents?projectAssetId=${projectAssetId}&options=true`, { cache: 'no-store' }),
        fetch(`/api/generation/plans?projectAssetId=${projectAssetId}&page=${nextPlanPage}&pageSize=${nextPlanPageSize}`, { cache: 'no-store' }),
      ]);
      if (docRes.ok) {
        const data = await docRes.json() as { items: PlanningDocument[]; pagination?: { total?: number; page?: number; pageSize?: number }; summary?: { meetings?: number } };
        setDocuments(data.items ?? []);
        setDocumentTotal(Number(data.pagination?.total ?? 0));
        setDocumentSummary({ meetings: Number(data.summary?.meetings ?? 0) });
        if (data.pagination?.page) setDocumentPage(data.pagination.page);
        if (data.pagination?.pageSize) setDocumentPageSize(data.pagination.pageSize);
      }
      if (docOptionsRes.ok) setDocumentOptions((await docOptionsRes.json() as { items: PlanningDocument[] }).items ?? []);
      if (planRes.ok) {
        const data = await planRes.json() as { items: PlanItem[]; pagination?: { total?: number; page?: number; pageSize?: number }; summary?: { approved?: number } };
        setPlans(data.items ?? []);
        setPlanTotal(Number(data.pagination?.total ?? 0));
        setPlanSummary({ approved: Number(data.summary?.approved ?? 0) });
        if (data.pagination?.page) setPlanPage(data.pagination.page);
        if (data.pagination?.pageSize) setPlanPageSize(data.pagination.pageSize);
      }
    } finally { setLoading(false); }
  }, [projectAssetId]);

  useEffect(() => { const timer = window.setTimeout(() => { void reload(); }, 0); return () => window.clearTimeout(timer); }, [reload]);

  const documentColumns: DataTableColumn<PlanningDocument>[] = [
    { accessor: 'actions', title: '', width: 64, render: (item) => <DataTableActions><DataTableAction label="Xem hồ sơ" icon={<IconEye size={16} />} onClick={() => setDetail({ document: item })} /></DataTableActions> },
    { accessor: 'documentType', title: 'Loại', width: 150, render: (item) => <Badge variant="light">{item.documentType}</Badge> },
    { accessor: 'documentNo', title: 'Số / ký hiệu', width: 160, render: (item) => item.documentNo ?? '—' },
    { accessor: 'title', title: 'Tiêu đề', width: 270, render: (item) => <Text fw={800}>{item.title}</Text> },
    { accessor: 'issuingAuthority', title: 'Cơ quan ban hành', width: 190, render: (item) => item.issuingAuthority ?? '—' },
    { accessor: 'issuedAt', title: 'Ngày ban hành', width: 150, render: (item) => fmtDate(item.issuedAt) },
    { accessor: 'planLevel', title: 'Cấp quy hoạch', width: 150, render: (item) => item.planLevel ?? '—' },
    { accessor: 'status', title: 'Trạng thái', width: 140, render: (item) => <Badge color={statusColor(item.status)} variant="light">{item.status}</Badge> },
    { accessor: 'fileRef', title: 'File', width: 140, render: (item) => item.fileRef ? <Text component="a" href={item.fileRef} target="_blank" c="blue" fw={700}>Mở file</Text> : '—' },
  ];
  const planColumns: DataTableColumn<PlanItem>[] = [
    { accessor: 'actions', title: '', width: 64, render: (item) => <DataTableActions><DataTableAction label="Xem kế hoạch" icon={<IconEye size={16} />} onClick={() => setDetail({ plan: item })} /></DataTableActions> },
    { accessor: 'planLevel', title: 'Cấp', width: 130, render: (item) => <Badge variant="outline">{item.planLevel}</Badge> },
    { accessor: 'planCode', title: 'Mã', width: 140, render: (item) => item.planCode ?? '—' },
    { accessor: 'planName', title: 'Tên kế hoạch', width: 280, render: (item) => <Text fw={800}>{item.planName}</Text> },
    { accessor: 'plannedCapacityMw', title: 'Công suất', width: 140, render: (item) => item.plannedCapacityMw == null ? '—' : `${item.plannedCapacityMw.toLocaleString('vi-VN')} MW` },
    { accessor: 'expectedOperationYear', title: 'Năm dự kiến', width: 140, render: (item) => item.expectedOperationYear ?? '—' },
    { accessor: 'status', title: 'Trạng thái', width: 150, render: (item) => <Badge color={statusColor(item.status)} variant="light">{item.status}</Badge> },
    { accessor: 'documents', title: 'Căn cứ liên kết', width: 240, render: (item) => <div><Text size="sm">{item.documents.length} tài liệu</Text>{item.documents.slice(0, 2).map((document) => <Text size="xs" c="dimmed" key={document.documentId}>{document.documentNo ?? document.documentType} • {document.documentTitle}</Text>)}</div> },
  ];

  const createDocument = documentForm.handleSubmit(async (values) => {
    setSaving(true);
    try {
      const response = await fetch('/api/generation/planning-documents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          projectAssetId,
          documentNo: values.documentNo || null,
          issuingAuthority: values.issuingAuthority || null,
          issuedAt: values.issuedAt || null,
          effectiveFrom: values.effectiveFrom || null,
          fileRef: values.fileRef || null,
          notes: values.notes || null,
        }),
      });
      const data = await response.json() as { message?: string };
      if (!response.ok) throw new Error(data.message || 'Không thể lưu hồ sơ.');
      notifications.show({ title: 'Đã lưu hồ sơ', message: 'Biên bản/quyết định/tài liệu được lưu vào Planning Document Registry.', color: 'green' });
      setDocumentOpened(false);
      documentForm.reset();
      await reload();
    } catch (error) {
      notifications.show({ title: 'Không thể lưu', message: error instanceof Error ? error.message : 'Lỗi không xác định.', color: 'red' });
    } finally { setSaving(false); }
  });

  const createPlan = planForm.handleSubmit(async (values) => {
    setSaving(true);
    try {
      const response = await fetch('/api/generation/plans', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          projectAssetId,
          planCode: values.planCode || null,
          meetingMinutesRef: values.meetingMinutesRef || null,
          decisionRef: values.decisionRef || null,
          notes: values.notes || null,
        }),
      });
      const data = await response.json() as { message?: string };
      if (!response.ok) throw new Error(data.message || 'Không thể lưu kế hoạch/quy hoạch.');
      notifications.show({ title: 'Đã lưu kế hoạch', message: 'Kế hoạch/quy hoạch và căn cứ liên quan đã được ghi nhận.', color: 'green' });
      setPlanOpened(false);
      planForm.reset();
      await reload();
    } catch (error) {
      notifications.show({ title: 'Không thể lưu', message: error instanceof Error ? error.message : 'Lỗi không xác định.', color: 'red' });
    } finally { setSaving(false); }
  });

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Paper radius="xl" p="md" withBorder><Text size="xs" c="dimmed" fw={800}>HỒ SƠ / VĂN BẢN</Text><Text fz={26} fw={900}>{documentTotal}</Text></Paper>
        <Paper radius="xl" p="md" withBorder><Text size="xs" c="dimmed" fw={800}>BIÊN BẢN HỌP</Text><Text fz={26} fw={900}>{documentSummary.meetings}</Text></Paper>
        <Paper radius="xl" p="md" withBorder><Text size="xs" c="dimmed" fw={800}>KẾ HOẠCH / QUY HOẠCH</Text><Text fz={26} fw={900}>{planTotal}</Text></Paper>
        <Paper radius="xl" p="md" withBorder><Text size="xs" c="dimmed" fw={800}>ĐÃ PHÊ DUYỆT</Text><Text fz={26} fw={900}>{planSummary.approved}</Text></Paper>
      </SimpleGrid>

      <Paper radius="xl" p="lg" withBorder className="energy-glass">
        <Group justify="space-between" mb="md">
          <div><Group gap="sm"><IconFileDescription size={22}/><Title order={3}>Biên bản, quyết định và hồ sơ căn cứ</Title></Group><Text size="sm" c="dimmed">Lưu được biên bản họp khách hàng cung cấp, quyết định, văn bản phê duyệt, báo cáo và đường dẫn file gốc.</Text></div>
          <Button leftSection={<IconPlus size={16}/>} onClick={() => setDocumentOpened(true)}>Thêm hồ sơ</Button>
        </Group>
        <CrudDataTable records={documents} columns={documentColumns} idAccessor="id" page={documentPage} totalRecords={documentTotal} recordsPerPage={documentPageSize} onPageChange={(nextPage) => { setDocumentPage(nextPage); void reload(nextPage, documentPageSize, planPage, planPageSize); }} onRecordsPerPageChange={(nextSize) => { setDocumentPage(1); setDocumentPageSize(nextSize); void reload(1, nextSize, planPage, planPageSize); }} fetching={loading} rowExpansion={{ allowMultiple: true, content: ({ record }) => <SimpleGrid cols={{ base: 1, sm: 3 }} p="sm"><div><Text size="xs" c="dimmed" fw={800}>Văn bản</Text><Text size="sm">{record.title}</Text><Text size="xs" c="dimmed">{record.documentType} • {record.documentNo ?? 'Chưa có số'}</Text></div><div><Text size="xs" c="dimmed" fw={800}>Hiệu lực</Text><Text size="sm">Ban hành: {fmtDate(record.issuedAt)}</Text><Text size="xs" c="dimmed">Hiệu lực từ: {fmtDate(record.effectiveFrom)}</Text></div><div><Text size="xs" c="dimmed" fw={800}>Provenance</Text><Text size="sm">{record.issuingAuthority ?? 'Chưa có cơ quan'}</Text><Text size="xs" c="dimmed">{record.fileRef ?? record.notes ?? 'Chưa có file/ghi chú'}</Text></div></SimpleGrid> }} emptyState={<Text c="dimmed" ta="center" py="xl">Chưa có hồ sơ quy hoạch/biên bản.</Text>} />
      </Paper>

      <Paper radius="xl" p="lg" withBorder className="energy-glass">
        <Group justify="space-between" mb="md">
          <div><Group gap="sm"><IconGavel size={22}/><Title order={3}>Kế hoạch / quy hoạch dự án</Title></Group><Text size="sm" c="dimmed">Theo dõi dự án nằm trong kế hoạch quốc gia, của tỉnh hoặc kế hoạch ngành; công suất dự kiến, năm vận hành và căn cứ.</Text></div>
          <Button variant="light" leftSection={<IconPlus size={16}/>} onClick={() => setPlanOpened(true)}>Thêm kế hoạch</Button>
        </Group>
        <CrudDataTable records={plans} columns={planColumns} idAccessor="id" page={planPage} totalRecords={planTotal} recordsPerPage={planPageSize} onPageChange={(nextPage) => { setPlanPage(nextPage); void reload(documentPage, documentPageSize, nextPage, planPageSize); }} onRecordsPerPageChange={(nextSize) => { setPlanPage(1); setPlanPageSize(nextSize); void reload(documentPage, documentPageSize, 1, nextSize); }} fetching={loading} rowExpansion={{ allowMultiple: true, content: ({ record }) => <SimpleGrid cols={{ base: 1, sm: 3 }} p="sm"><div><Text size="xs" c="dimmed" fw={800}>Kế hoạch</Text><Text size="sm">{record.planName}</Text><Text size="xs" c="dimmed">{record.planLevel} • {record.planCode ?? 'Chưa có mã'}</Text></div><div><Text size="xs" c="dimmed" fw={800}>Quy mô / thời điểm</Text><Text size="sm">{record.plannedCapacityMw == null ? 'Chưa có công suất' : `${record.plannedCapacityMw.toLocaleString('vi-VN')} MW`}</Text><Text size="xs" c="dimmed">Năm dự kiến: {record.expectedOperationYear ?? '—'}</Text></div><div><Text size="xs" c="dimmed" fw={800}>Căn cứ</Text><Text size="sm">{record.documents.length} tài liệu</Text><Text size="xs" c="dimmed">{record.meetingMinutesRef ?? record.decisionRef ?? 'Chưa có tham chiếu'}</Text></div></SimpleGrid> }} emptyState={<Text c="dimmed" ta="center" py="xl">Chưa gắn dự án vào kế hoạch/quy hoạch.</Text>} />
      </Paper>

      <Drawer opened={documentOpened} onClose={() => setDocumentOpened(false)} title="Thêm hồ sơ quy hoạch / biên bản" position="right" size="lg">
        <form onSubmit={createDocument} noValidate><Stack>
          <FormValidationAlert errors={documentForm.formState.errors as Record<string, unknown>} />
          <SimpleGrid cols={2}><Controller control={documentForm.control} name="documentType" render={({ field, fieldState }) => <Select label="Loại tài liệu" withAsterisk data={['MEETING_MINUTES','DECISION','PLAN','APPROVAL','REPORT','PROPOSAL','OTHER']} value={field.value} onChange={(v) => field.onChange(v ?? 'OTHER')} error={fieldState.error?.message}/>}/><TextInput label="Số / ký hiệu" withAsterisk error={documentForm.formState.errors.documentNo?.message} {...documentForm.register('documentNo')}/></SimpleGrid>
          <TextInput label="Tiêu đề" withAsterisk error={documentForm.formState.errors.title?.message} {...documentForm.register('title')}/>
          <TextInput label="Cơ quan ban hành / đơn vị họp" withAsterisk error={documentForm.formState.errors.issuingAuthority?.message} {...documentForm.register('issuingAuthority')}/>
          <SimpleGrid cols={2}><TextInput type="date" label="Ngày ban hành" withAsterisk error={documentForm.formState.errors.issuedAt?.message} {...documentForm.register('issuedAt')}/><TextInput type="date" label="Hiệu lực từ" error={documentForm.formState.errors.effectiveFrom?.message} {...documentForm.register('effectiveFrom')}/></SimpleGrid>
          <SimpleGrid cols={2}><Controller control={documentForm.control} name="planLevel" render={({ field, fieldState }) => <Select label="Cấp quy hoạch" clearable data={['NATIONAL','PROVINCIAL','SECTOR','LOCAL','OTHER']} value={field.value} onChange={field.onChange} error={fieldState.error?.message}/>}/><Controller control={documentForm.control} name="status" render={({ field, fieldState }) => <Select label="Trạng thái" withAsterisk data={['DRAFT','ACTIVE','SUPERSEDED','EXPIRED','CANCELLED']} value={field.value} onChange={(v) => field.onChange(v ?? 'ACTIVE')} error={fieldState.error?.message}/>}/></SimpleGrid>
          <TextInput label="File / Drive / document URL" withAsterisk placeholder="https://..." error={documentForm.formState.errors.fileRef?.message} {...documentForm.register('fileRef')}/>
          <Textarea label="Ghi chú" minRows={4} error={documentForm.formState.errors.notes?.message} {...documentForm.register('notes')}/>
          <Group justify="flex-end"><Button variant="default" onClick={() => setDocumentOpened(false)}>Hủy</Button><Button type="submit" loading={saving}>Lưu hồ sơ</Button></Group>
        </Stack></form>
      </Drawer>

      <Drawer opened={planOpened} onClose={() => setPlanOpened(false)} title="Thêm kế hoạch / quy hoạch" position="right" size="lg">
        <form onSubmit={createPlan} noValidate><Stack>
          <FormValidationAlert errors={planForm.formState.errors as Record<string, unknown>} />
          <SimpleGrid cols={2}><Controller control={planForm.control} name="planLevel" render={({ field, fieldState }) => <Select label="Cấp kế hoạch" withAsterisk data={['NATIONAL','PROVINCIAL','SECTOR','LOCAL','OTHER']} value={field.value} onChange={(v) => field.onChange(v ?? 'OTHER')} error={fieldState.error?.message}/>}/><TextInput label="Mã kế hoạch" withAsterisk error={planForm.formState.errors.planCode?.message} {...planForm.register('planCode')}/></SimpleGrid>
          <TextInput label="Tên kế hoạch / nội dung quy hoạch" withAsterisk error={planForm.formState.errors.planName?.message} {...planForm.register('planName')}/>
          <SimpleGrid cols={2}><Controller control={planForm.control} name="plannedCapacityMw" render={({ field, fieldState }) => <NumberInput label="Công suất dự kiến (MW)" withAsterisk min={0} decimalScale={3} value={field.value ?? ''} onChange={(v) => field.onChange(v === '' ? null : Number(v))} error={fieldState.error?.message}/>}/><Controller control={planForm.control} name="expectedOperationYear" render={({ field, fieldState }) => <NumberInput label="Năm vận hành dự kiến" withAsterisk min={2000} max={2200} allowDecimal={false} value={field.value ?? ''} onChange={(v) => field.onChange(v === '' ? null : Number(v))} error={fieldState.error?.message}/>}/></SimpleGrid>
          <Controller control={planForm.control} name="status" render={({ field, fieldState }) => <Select label="Trạng thái" withAsterisk data={['PROPOSED','UNDER_REVIEW','APPROVED','ADJUSTED','SUSPENDED','CANCELLED']} value={field.value} onChange={(v) => field.onChange(v ?? 'PROPOSED')} error={fieldState.error?.message}/>}/>
          <Controller control={planForm.control} name="documentIds" render={({ field, fieldState }) => <MultiSelect label="Hồ sơ căn cứ" searchable clearable data={documentOptions.map((d) => ({ value: d.id, label: `${d.documentNo ?? d.documentType} • ${d.title}` }))} value={field.value} onChange={field.onChange} error={fieldState.error?.message}/>}/>
          <SimpleGrid cols={2}><TextInput label="Tham chiếu biên bản họp" error={planForm.formState.errors.meetingMinutesRef?.message} {...planForm.register('meetingMinutesRef')}/><TextInput label="Tham chiếu quyết định" error={planForm.formState.errors.decisionRef?.message} {...planForm.register('decisionRef')}/></SimpleGrid>
          <Textarea label="Ghi chú" minRows={3} error={planForm.formState.errors.notes?.message} {...planForm.register('notes')}/>
          <Group justify="flex-end"><Button variant="default" onClick={() => setPlanOpened(false)}>Hủy</Button><Button type="submit" loading={saving}>Lưu kế hoạch</Button></Group>
        </Stack></form>
      </Drawer>
      <Drawer opened={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.document ? 'Chi tiết hồ sơ' : 'Chi tiết kế hoạch'} position="right" size="md">
        {detail?.document ? <Stack gap="sm"><Text fw={900}>{detail.document.title}</Text><Text>Loại: {detail.document.documentType} • {detail.document.documentNo ?? 'Chưa có số'}</Text><Text>Cơ quan: {detail.document.issuingAuthority ?? '—'}</Text><Text>Ban hành: {fmtDate(detail.document.issuedAt)} • Hiệu lực: {fmtDate(detail.document.effectiveFrom)}</Text><Text>Trạng thái: {detail.document.status}</Text><Text>File: {detail.document.fileRef ?? '—'}</Text><Text>Ghi chú: {detail.document.notes ?? '—'}</Text></Stack> : null}
        {detail?.plan ? <Stack gap="sm"><Text fw={900}>{detail.plan.planName}</Text><Text>Cấp: {detail.plan.planLevel} • {detail.plan.planCode ?? 'Chưa có mã'}</Text><Text>Công suất: {detail.plan.plannedCapacityMw == null ? '—' : `${detail.plan.plannedCapacityMw.toLocaleString('vi-VN')} MW`}</Text><Text>Năm dự kiến: {detail.plan.expectedOperationYear ?? '—'}</Text><Text>Trạng thái: {detail.plan.status}</Text><Text>Căn cứ: {detail.plan.documents.length} tài liệu</Text></Stack> : null}
      </Drawer>
    </Stack>
  );
}
