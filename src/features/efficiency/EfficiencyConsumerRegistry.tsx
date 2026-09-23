"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Badge,
  Button,
  Drawer,
  Group,
  Modal,
  NumberInput,
  Paper,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconArchive,
  IconBolt,
  IconBuildingFactory2,
  IconHistory,
  IconPencil,
  IconPlus,
  IconRefresh,
} from "@tabler/icons-react";
import type { DataTableColumn } from "mantine-datatable";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { classificationHistorySchema, consumerSchema } from "@/lib/efficiency-schemas";
import {
  ClientCrudDataTable,
  CrudDataTable,
  DataTableAction,
  DataTableActions,
} from "@/components/data/CrudDataTable";
import { FormValidationAlert } from "@/components/forms/FormValidationAlert";

type FormValues = z.input<typeof consumerSchema>;
type HistoryFormValues = z.input<typeof classificationHistorySchema>;
type Customer = {
  id: string;
  customerCode: string;
  customerName: string;
  serviceAddress: string | null;
  customerType: string | null;
};
type Consumer = {
  id: string;
  customerAccountId: string | null;
  classification: string;
  consumerGroup: string;
  importanceLevel: string;
  sector: string;
  industryZoneCode: string | null;
  reportingRequired: string;
  status: string;
  partyCode: string;
  partyName: string;
  address: string | null;
  adminAreaCode: string | null;
  latitude: number | null;
  longitude: number | null;
  customerCode: string | null;
  annualConsumptionKwh: number;
  peakDemandKw: number;
  reportCount: number;
  submittedReportCount: number;
  classificationHistoryCount: number;
  meterCount: number;
  activeMeterCount: number;
};
type ConsumerStats = {
  keyCount: number;
  nearKeyCount: number;
  requiredCount: number;
  annualConsumptionKwh: number;
};
type History = {
  id: string;
  consumerGroup: string;
  importanceLevel: string;
  validFrom: string;
  validTo: string | null;
  sourceDocumentNo: string | null;
  sourceDocumentRef: string | null;
  issuedBy: string | null;
  reason: string | null;
  status: string;
};

const groupOptions = [
  { value: "STATE_AGENCY", label: "Cơ quan nhà nước" },
  { value: "ENTERPRISE", label: "Doanh nghiệp" },
  { value: "INDUSTRIAL", label: "Công nghiệp" },
  { value: "COMMERCIAL_SERVICE", label: "Thương mại / dịch vụ" },
  { value: "AGRICULTURE", label: "Nông nghiệp" },
  { value: "EDUCATION", label: "Giáo dục" },
  { value: "HEALTHCARE", label: "Y tế" },
  { value: "HOUSEHOLD", label: "Hộ gia đình" },
  { value: "OTHER", label: "Khác" },
];
const importanceOptions = [
  { value: "KEY", label: "Trọng điểm" },
  { value: "NEAR_KEY", label: "Cận trọng điểm" },
  { value: "NORMAL", label: "Thông thường" },
];

function importanceLabel(value: string) {
  return importanceOptions.find((option) => option.value === value)?.label ?? value;
}

function groupLabel(value: string) {
  return groupOptions.find((option) => option.value === value)?.label ?? value;
}

function initialValues(): FormValues {
  return {
    customerAccountId: null,
    partyCode: "",
    partyName: "",
    address: "",
    adminAreaCode: "",
    latitude: null,
    longitude: null,
    consumerGroup: "OTHER",
    importanceLevel: "NORMAL",
    classification: null,
    classificationValidFrom: new Date().toISOString(),
    classificationSourceDocumentNo: "",
    classificationSourceDocumentRef: "",
    classificationReason: "",
    classificationIssuedBy: "",
    sector: "",
    industryZoneCode: "",
    reportingRequired: "YES",
  };
}

function historyInitialValues(): HistoryFormValues {
  return {
    consumerGroup: "OTHER",
    importanceLevel: "NORMAL",
    validFrom: new Date().toISOString(),
    validTo: null,
    sourceDocumentNo: "",
    sourceDocumentRef: "",
    issuedBy: "",
    reason: "",
    status: "ACTIVE",
  };
}

export function EfficiencyConsumerRegistry() {
  const [items, setItems] = useState<Consumer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [opened, setOpened] = useState(false);
  const [historyOpened, setHistoryOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Consumer | null>(null);
  const [historyConsumer, setHistoryConsumer] = useState<Consumer | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [archiveTarget, setArchiveTarget] = useState<Consumer | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<ConsumerStats>({
    keyCount: 0,
    nearKeyCount: 0,
    requiredCount: 0,
    annualConsumptionKwh: 0,
  });
  const form = useForm<FormValues>({
    resolver: zodResolver(consumerSchema),
    defaultValues: initialValues(),
  });
  const historyForm = useForm<HistoryFormValues>({
    resolver: zodResolver(classificationHistorySchema),
    defaultValues: historyInitialValues(),
  });

  const reload = useCallback(
    async (nextPage = page, nextPageSize = pageSize) => {
      setLoading(true);
      try {
        const [consumerRes, customerRes] = await Promise.all([
          fetch(`/api/efficiency/consumers?page=${nextPage}&pageSize=${nextPageSize}`, {
            cache: "no-store",
          }),
          fetch("/api/solar/customers?limit=200", { cache: "no-store" }),
        ]);
        if (consumerRes.ok) {
          const data = (await consumerRes.json()) as {
            items: Consumer[];
            pagination?: { page?: number; pageSize?: number; total?: number };
            stats?: ConsumerStats;
          };
          setItems(data.items ?? []);
          setTotal(data.pagination?.total ?? 0);
          if (data.pagination?.page) setPage(data.pagination.page);
          if (data.pagination?.pageSize) setPageSize(data.pagination.pageSize);
          if (data.stats) setStats(data.stats);
        }
        if (customerRes.ok)
          setCustomers(((await customerRes.json()) as { items: Customer[] }).items ?? []);
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize],
  );
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  const { keyCount, nearKeyCount, requiredCount, annualConsumptionKwh: annualTotal } = stats;

  function openCreate() {
    setEditing(null);
    form.reset(initialValues());
    setOpened(true);
  }

  async function openEdit(item: Consumer) {
    setEditing(item);
    const response = await fetch(`/api/efficiency/consumers/${item.id}`, { cache: "no-store" });
    const data = (await response.json()) as { consumer?: { history?: History[] } };
    const active =
      data.consumer?.history?.find((record) => record.status === "ACTIVE") ??
      data.consumer?.history?.at(-1);
    form.reset({
      ...initialValues(),
      customerAccountId: item.customerAccountId,
      partyCode: item.partyCode,
      partyName: item.partyName,
      address: item.address ?? "",
      adminAreaCode: item.adminAreaCode ?? "",
      latitude: item.latitude,
      longitude: item.longitude,
      consumerGroup: (item.consumerGroup as FormValues["consumerGroup"]) ?? "OTHER",
      importanceLevel: (item.importanceLevel as FormValues["importanceLevel"]) ?? "NORMAL",
      sector: item.sector,
      industryZoneCode: item.industryZoneCode ?? "",
      reportingRequired: item.reportingRequired === "NO" ? "NO" : "YES",
      classificationValidFrom: active?.validFrom ?? new Date().toISOString(),
      classificationSourceDocumentNo: active?.sourceDocumentNo ?? "",
      classificationSourceDocumentRef: active?.sourceDocumentRef ?? "",
      classificationReason: active?.reason ?? "",
      classificationIssuedBy: active?.issuedBy ?? "",
    });
    setOpened(true);
  }

  const submit = form.handleSubmit(async (values) => {
    setSaving(true);
    try {
      const endpoint = editing
        ? `/api/efficiency/consumers/${editing.id}`
        : "/api/efficiency/consumers";
      const response = await fetch(endpoint, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          customerAccountId: values.customerAccountId || null,
          partyCode:
            editing && values.customerAccountId
              ? undefined
              : values.customerAccountId
                ? null
                : values.partyCode || null,
          partyName:
            editing && values.customerAccountId
              ? undefined
              : values.customerAccountId
                ? null
                : values.partyName || null,
          address: values.address || null,
          adminAreaCode: values.adminAreaCode || null,
          latitude: values.latitude ?? null,
          longitude: values.longitude ?? null,
          industryZoneCode: values.industryZoneCode || null,
          classificationSourceDocumentNo: values.classificationSourceDocumentNo || null,
          classificationSourceDocumentRef: values.classificationSourceDocumentRef || null,
          classificationReason: values.classificationReason || null,
          classificationIssuedBy: values.classificationIssuedBy || null,
        }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "Không thể lưu đơn vị.");
      notifications.show({
        title: editing ? "Đã cập nhật đơn vị" : "Đã lưu đơn vị sử dụng năng lượng",
        message: "Phân loại và căn cứ đã được ghi vào Consumer Registry.",
        color: "green",
      });
      setOpened(false);
      setEditing(null);
      form.reset(initialValues());
      await reload();
    } catch (error) {
      notifications.show({
        title: "Không thể lưu",
        message: error instanceof Error ? error.message : "Lỗi không xác định.",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  });

  async function archiveConsumer() {
    if (!archiveTarget) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/efficiency/consumers/${archiveTarget.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "Không thể archive đơn vị.");
      notifications.show({
        title: "Đã archive đơn vị",
        message: data.message ?? "",
        color: "green",
      });
      setArchiveTarget(null);
      await reload();
    } catch (error) {
      notifications.show({
        title: "Không thể archive",
        message: error instanceof Error ? error.message : "Lỗi không xác định.",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  }

  async function openHistory(item: Consumer) {
    setHistoryConsumer(item);
    const response = await fetch(`/api/efficiency/consumers/${item.id}/classification-history`, {
      cache: "no-store",
    });
    const data = (await response.json()) as { items?: History[] };
    setHistory(data.items ?? []);
    historyForm.reset(historyInitialValues());
    setHistoryOpened(true);
  }

  const submitHistory = historyForm.handleSubmit(async (values) => {
    if (!historyConsumer) return;
    setSaving(true);
    try {
      const response = await fetch(
        `/api/efficiency/consumers/${historyConsumer.id}/classification-history`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...values,
            sourceDocumentNo: values.sourceDocumentNo || null,
            sourceDocumentRef: values.sourceDocumentRef || null,
            issuedBy: values.issuedBy || null,
            reason: values.reason || null,
          }),
        },
      );
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "Không thể ghi lịch sử phân loại.");
      notifications.show({
        title: "Đã ghi phiên bản phân loại",
        message: "Phiên bản trước đã được SUPERSEDED và phiên bản mới đã ACTIVE.",
        color: "green",
      });
      await openHistory(historyConsumer);
      await reload();
    } catch (error) {
      notifications.show({
        title: "Không thể ghi lịch sử",
        message: error instanceof Error ? error.message : "Lỗi không xác định.",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  });

  async function revokeHistory(record: History) {
    if (!historyConsumer) return;
    setSaving(true);
    try {
      const response = await fetch(
        `/api/efficiency/consumers/${historyConsumer.id}/classification-history/${record.id}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "Không thể thu hồi phiên bản.");
      notifications.show({
        title: "Đã thu hồi phiên bản",
        message: data.message ?? "",
        color: "green",
      });
      await openHistory(historyConsumer);
      await reload();
    } catch (error) {
      notifications.show({
        title: "Không thể thu hồi",
        message: error instanceof Error ? error.message : "Lỗi không xác định.",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  }

  const columns: DataTableColumn<Consumer>[] = [
    {
      accessor: "actions",
      title: "Thao tác",
      width: 132,
      render: (item) => (
        <DataTableActions>
          <DataTableAction
            label="Sửa đơn vị"
            icon={<IconPencil size={16} />}
            color="blue"
            onClick={() => void openEdit(item)}
          />
          <DataTableAction
            label="Xem lịch sử phân loại"
            icon={<IconHistory size={16} />}
            color="cyan"
            onClick={() => void openHistory(item)}
          />
          <DataTableAction
            label="Archive đơn vị"
            icon={<IconArchive size={16} />}
            color="red"
            onClick={() => setArchiveTarget(item)}
          />
        </DataTableActions>
      ),
    },
    {
      accessor: "partyName",
      title: "Đơn vị",
      width: 250,
      render: (item) => (
        <>
          <Text fw={900}>{item.partyName}</Text>
          <Text size="xs" c="dimmed">
            {item.partyCode} · {item.status}
          </Text>
        </>
      ),
    },
    {
      accessor: "consumerGroup",
      title: "Nhóm / mức độ",
      width: 190,
      render: (item) => (
        <>
          <Text size="sm">{groupLabel(item.consumerGroup)}</Text>
          <Badge
            color={
              item.importanceLevel === "KEY"
                ? "blue"
                : item.importanceLevel === "NEAR_KEY"
                  ? "cyan"
                  : "gray"
            }
            variant="light"
          >
            {importanceLabel(item.importanceLevel)}
          </Badge>
        </>
      ),
    },
    {
      accessor: "sector",
      title: "Lĩnh vực / khu vực",
      width: 210,
      render: (item) => (
        <>
          <Text>{item.sector}</Text>
          <Text size="xs" c="dimmed">
            {item.industryZoneCode ?? item.adminAreaCode ?? "—"}
          </Text>
        </>
      ),
    },
    {
      accessor: "customerCode",
      title: "Mã EVN",
      width: 150,
      render: (item) => item.customerCode ?? "Chưa liên kết",
    },
    {
      accessor: "annualConsumptionKwh",
      title: "12 tháng / Peak",
      width: 180,
      render: (item) => (
        <>
          <Text>{item.annualConsumptionKwh.toLocaleString("vi-VN")} kWh</Text>
          <Text size="xs" c="dimmed">
            Peak {item.peakDemandKw ? item.peakDemandKw.toLocaleString("vi-VN") + " kW" : "—"}
          </Text>
        </>
      ),
    },
    {
      accessor: "meterCount",
      title: "Công tơ",
      width: 135,
      render: (item) => (
        <Text>
          {item.activeMeterCount}/{item.meterCount} hoạt động
        </Text>
      ),
    },
    {
      accessor: "reportCount",
      title: "Báo cáo",
      width: 180,
      render: (item) => (
        <Group gap="xs" wrap="nowrap">
          <Progress
            value={item.reportCount ? (item.submittedReportCount / item.reportCount) * 100 : 0}
            flex={1}
          />
          <Text size="xs" fw={800}>
            {item.submittedReportCount}/{item.reportCount}
          </Text>
        </Group>
      ),
    },
  ];
  const historyColumns: DataTableColumn<History>[] = [
    {
      accessor: "actions",
      title: "Thao tác",
      width: 92,
      render: (record) => (
        <DataTableActions>
          {record.status === "ACTIVE" ? (
            <DataTableAction
              label="Thu hồi phiên bản"
              icon={<IconArchive size={16} />}
              color="red"
              onClick={() => void revokeHistory(record)}
            />
          ) : null}
        </DataTableActions>
      ),
    },
    {
      accessor: "validFrom",
      title: "Hiệu lực",
      width: 220,
      render: (record) => (
        <>
          <Text size="sm">{new Date(record.validFrom).toLocaleString("vi-VN")}</Text>
          <Text size="xs" c="dimmed">
            {record.validTo
              ? `đến ${new Date(record.validTo).toLocaleString("vi-VN")}`
              : "hiện hành"}
          </Text>
        </>
      ),
    },
    {
      accessor: "consumerGroup",
      title: "Nhóm / mức độ",
      width: 200,
      render: (record) => (
        <>
          <Text>{groupLabel(record.consumerGroup)}</Text>
          <Badge size="xs" variant="light">
            {importanceLabel(record.importanceLevel)}
          </Badge>
        </>
      ),
    },
    {
      accessor: "sourceDocumentNo",
      title: "Căn cứ",
      width: 260,
      render: (record) => (
        <>
          <Text size="sm">{record.sourceDocumentNo ?? "—"}</Text>
          <Text size="xs" c="dimmed" lineClamp={1}>
            {record.sourceDocumentRef ?? "Chưa có link"}
          </Text>
        </>
      ),
    },
    {
      accessor: "status",
      title: "Trạng thái",
      width: 140,
      render: (record) => (
        <Badge
          color={
            record.status === "ACTIVE" ? "green" : record.status === "REVOKED" ? "red" : "gray"
          }
          variant="light"
        >
          {record.status}
        </Badge>
      ),
    },
  ];

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Paper radius="xl" p="md" withBorder>
          <Text size="xs" c="dimmed" fw={800}>
            TRỌNG ĐIỂM
          </Text>
          <Text fz={26} fw={900}>
            {keyCount}
          </Text>
        </Paper>
        <Paper radius="xl" p="md" withBorder>
          <Text size="xs" c="dimmed" fw={800}>
            CẬN TRỌNG ĐIỂM
          </Text>
          <Text fz={26} fw={900}>
            {nearKeyCount}
          </Text>
        </Paper>
        <Paper radius="xl" p="md" withBorder>
          <Text size="xs" c="dimmed" fw={800}>
            PHẢI BÁO CÁO
          </Text>
          <Text fz={26} fw={900}>
            {requiredCount}
          </Text>
        </Paper>
        <Paper radius="xl" p="md" withBorder>
          <Text size="xs" c="dimmed" fw={800}>
            TIÊU THỤ 12 THÁNG
          </Text>
          <Text fz={26} fw={900}>
            {(annualTotal / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} GWh
          </Text>
        </Paper>
      </SimpleGrid>

      <Paper radius="xl" p="lg" withBorder className="energy-glass">
        <Group justify="space-between" mb="md">
          <div>
            <Title order={3}>Danh sách đơn vị sử dụng năng lượng</Title>
            <Text size="sm" c="dimmed">
              Dữ liệu thật từ Consumer Registry và EVN customer consumption. Phân loại được tách
              thành nhóm sử dụng và mức độ trọng điểm.
            </Text>
          </div>
          <Group>
            <Button
              variant="light"
              leftSection={<IconRefresh size={16} />}
              onClick={() => void reload()}
            >
              Làm mới
            </Button>
            <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
              Thêm đơn vị
            </Button>
          </Group>
        </Group>
        <CrudDataTable
          records={items}
          filterPlaceholder="Tên, mã đơn vị, lĩnh vực hoặc địa bàn..."
          filters={[
            { key: "consumerGroup", label: "Nhóm sử dụng", options: groupOptions },
            { key: "importanceLevel", label: "Mức độ", options: importanceOptions },
            { key: "reportingRequired", label: "Báo cáo", options: [{ value: "YES", label: "Bắt buộc" }, { value: "NO", label: "Không bắt buộc" }] },
            { key: "status", label: "Trạng thái", options: [{ value: "ACTIVE", label: "ACTIVE" }, { value: "ARCHIVED", label: "ARCHIVED" }] },
          ]}
          columns={columns}
          idAccessor="id"
          page={page}
          totalRecords={total}
          recordsPerPage={pageSize}
          onPageChange={setPage}
          onRecordsPerPageChange={(nextSize) => {
            setPage(1);
            setPageSize(nextSize);
          }}
          fetching={loading || saving}
          rowExpansion={{
            allowMultiple: true,
            content: ({ record }) => (
              <SimpleGrid cols={{ base: 1, sm: 2 }} p="sm">
                <div>
                  <Text size="xs" c="dimmed" fw={800}>
                    Địa chỉ / liên kết
                  </Text>
                  <Text size="sm">{record.address ?? "—"}</Text>
                  <Text size="xs" c="dimmed">
                    EVN {record.customerCode ?? "chưa liên kết"} ·{" "}
                    {record.industryZoneCode ?? record.adminAreaCode ?? "—"}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed" fw={800}>
                    Classification
                  </Text>
                  <Text size="sm">
                    {record.classification} ·{" "}
                    {record.reportingRequired === "YES" ? "Bắt buộc báo cáo" : "Không bắt buộc"}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {record.classificationHistoryCount} phiên bản phân loại
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed" fw={800}>
                    Tiêu thụ / công tơ
                  </Text>
                  <Text size="sm">
                    {record.annualConsumptionKwh.toLocaleString("vi-VN")} kWh · peak{" "}
                    {record.peakDemandKw.toLocaleString("vi-VN")} kW
                  </Text>
                  <Text size="xs" c="dimmed">
                    {record.activeMeterCount}/{record.meterCount} công tơ ACTIVE
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed" fw={800}>
                    Báo cáo
                  </Text>
                  <Text size="sm">
                    {record.submittedReportCount}/{record.reportCount} đã gửi
                  </Text>
                  <Text size="xs" c="dimmed">
                    Party code: {record.partyCode}
                  </Text>
                </div>
              </SimpleGrid>
            ),
          }}
          emptyState={
            <Stack align="center" py="xl">
              <IconBuildingFactory2 size={38} />
              <Text fw={800}>Chưa có đơn vị quản lý</Text>
            </Stack>
          }
        />
      </Paper>

      <Drawer
        opened={opened}
        onClose={() => setOpened(false)}
        title={editing ? "Sửa đơn vị sử dụng năng lượng" : "Thêm đơn vị sử dụng năng lượng"}
        position="right"
        size="lg"
      >
        <form noValidate onSubmit={submit}>
          <Stack>
            <FormValidationAlert errors={form.formState.errors} />
            <Controller
              control={form.control}
              name="customerAccountId"
              render={({ field, fieldState }) => (
                <Select
                  label="Liên kết mã khách hàng EVN"
                  description="Nếu có mã EVN, Party/Site được tái sử dụng thay vì tạo trùng."
                  error={fieldState.error?.message}
                  searchable
                  clearable
                  data={customers.map((customer) => ({
                    value: customer.id,
                    label: `${customer.customerCode} • ${customer.customerName}`,
                  }))}
                  value={field.value ?? null}
                  onChange={field.onChange}
                />
              )}
            />
            <Text fw={800} size="sm">
              Đơn vị chưa có EVN account
            </Text>
            <SimpleGrid cols={2}>
              <TextInput
                label="Mã đơn vị"
                error={form.formState.errors.partyCode?.message}
                {...form.register("partyCode")}
              />
              <TextInput
                label="Tên đơn vị"
                error={form.formState.errors.partyName?.message}
                {...form.register("partyName")}
              />
            </SimpleGrid>
            <TextInput
              label="Địa chỉ"
              error={form.formState.errors.address?.message}
              {...form.register("address")}
            />
            <SimpleGrid cols={2}>
              <TextInput
                label="Mã địa bàn"
                error={form.formState.errors.adminAreaCode?.message}
                {...form.register("adminAreaCode")}
              />
              <TextInput
                label="KCN/CCN"
                error={form.formState.errors.industryZoneCode?.message}
                {...form.register("industryZoneCode")}
              />
            </SimpleGrid>
            <SimpleGrid cols={2}>
              <Controller
                control={form.control}
                name="latitude"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Vĩ độ GIS"
                    description="Bắt buộc với cơ sở chưa liên kết EVN"
                    decimalScale={7}
                    value={field.value ?? ""}
                    onChange={(value) => field.onChange(value === "" ? null : Number(value))}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="longitude"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Kinh độ GIS"
                    description="Bắt buộc với cơ sở chưa liên kết EVN"
                    decimalScale={7}
                    value={field.value ?? ""}
                    onChange={(value) => field.onChange(value === "" ? null : Number(value))}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </SimpleGrid>
            <SimpleGrid cols={2}>
              <Controller
                control={form.control}
                name="consumerGroup"
                render={({ field, fieldState }) => (
                  <Select
                    label="Nhóm đối tượng sử dụng"
                    withAsterisk
                    data={groupOptions}
                    error={fieldState.error?.message}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "OTHER")}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="importanceLevel"
                render={({ field, fieldState }) => (
                  <Select
                    label="Mức độ trọng điểm"
                    withAsterisk
                    data={importanceOptions}
                    error={fieldState.error?.message}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "NORMAL")}
                  />
                )}
              />
            </SimpleGrid>
            <SimpleGrid cols={2}>
              <TextInput
                label="Lĩnh vực"
                placeholder="Sản xuất / thương mại..."
                withAsterisk
                error={form.formState.errors.sector?.message}
                {...form.register("sector")}
              />
              <Controller
                control={form.control}
                name="reportingRequired"
                render={({ field, fieldState }) => (
                  <Select
                    label="Nghĩa vụ báo cáo"
                    data={[
                      { value: "YES", label: "Có" },
                      { value: "NO", label: "Không" },
                    ]}
                    error={fieldState.error?.message}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "YES")}
                  />
                )}
              />
            </SimpleGrid>
            <Paper withBorder radius="lg" p="md">
              <Stack gap="xs">
                <Text fw={800}>Căn cứ phân loại</Text>
                <Text size="xs" c="dimmed">
                  Bắt buộc khi tạo; khi đổi nhóm/mức độ phải nhập căn cứ mới. Không dùng dữ liệu mặc
                  định không có provenance.
                </Text>
                <SimpleGrid cols={2}>
                  <TextInput
                    label="Số văn bản"
                    error={form.formState.errors.classificationSourceDocumentNo?.message}
                    {...form.register("classificationSourceDocumentNo")}
                  />
                  <TextInput
                    label="Ngày hiệu lực"
                    type="datetime-local"
                    error={form.formState.errors.classificationValidFrom?.message}
                    {...form.register("classificationValidFrom")}
                  />
                </SimpleGrid>
                <TextInput
                  label="Link/file văn bản"
                  error={form.formState.errors.classificationSourceDocumentRef?.message}
                  {...form.register("classificationSourceDocumentRef")}
                />
                <SimpleGrid cols={2}>
                  <TextInput
                    label="Đơn vị/người ban hành"
                    error={form.formState.errors.classificationIssuedBy?.message}
                    {...form.register("classificationIssuedBy")}
                  />
                  <Textarea
                    label="Lý do"
                    minRows={2}
                    error={form.formState.errors.classificationReason?.message}
                    {...form.register("classificationReason")}
                  />
                </SimpleGrid>
              </Stack>
            </Paper>
            <Group justify="flex-end">
              <Button type="button" variant="default" onClick={() => setOpened(false)}>
                Hủy
              </Button>
              <Button type="submit" loading={saving} leftSection={<IconBolt size={16} />}>
                Lưu đơn vị
              </Button>
            </Group>
          </Stack>
        </form>
      </Drawer>

      <Drawer
        opened={historyOpened}
        onClose={() => setHistoryOpened(false)}
        title={`Lịch sử phân loại${historyConsumer ? ` • ${historyConsumer.partyName}` : ""}`}
        position="right"
        size="xl"
      >
        <Stack>
          <Alert color="blue" icon={<IconHistory size={18} />}>
            Mỗi phiên bản giữ nguyên số văn bản, nguồn và thời gian hiệu lực. Phiên bản cũ được
            SUPERSEDED/REVOKED, không bị xóa vật lý.
          </Alert>
          {history.length ? (
            <ClientCrudDataTable
              records={history}
              columns={historyColumns}
              idAccessor="id"
              emptyState={
                <Text c="dimmed" ta="center" py="xl">
                  Chưa có lịch sử phân loại.
                </Text>
              }
            />
          ) : (
            <Text c="dimmed">Chưa có lịch sử phân loại.</Text>
          )}
          <Paper withBorder radius="lg" p="md">
            <form noValidate onSubmit={submitHistory}>
              <Stack>
                <FormValidationAlert errors={historyForm.formState.errors} />
                <Title order={4}>Thêm phiên bản phân loại</Title>
                <SimpleGrid cols={2}>
                  <Controller
                    control={historyForm.control}
                    name="consumerGroup"
                    render={({ field, fieldState }) => (
                      <Select
                        label="Nhóm"
                        withAsterisk
                        data={groupOptions}
                        error={fieldState.error?.message}
                        value={field.value}
                        onChange={(value) => field.onChange(value ?? "OTHER")}
                      />
                    )}
                  />
                  <Controller
                    control={historyForm.control}
                    name="importanceLevel"
                    render={({ field, fieldState }) => (
                      <Select
                        label="Mức độ"
                        withAsterisk
                        data={importanceOptions}
                        error={fieldState.error?.message}
                        value={field.value}
                        onChange={(value) => field.onChange(value ?? "NORMAL")}
                      />
                    )}
                  />
                </SimpleGrid>
                <TextInput
                  label="Ngày hiệu lực"
                  type="datetime-local"
                  error={historyForm.formState.errors.validFrom?.message}
                  {...historyForm.register("validFrom")}
                />
                <SimpleGrid cols={2}>
                  <TextInput
                    label="Số văn bản"
                    error={historyForm.formState.errors.sourceDocumentNo?.message}
                    {...historyForm.register("sourceDocumentNo")}
                  />
                  <TextInput
                    label="Link/file văn bản"
                    error={historyForm.formState.errors.sourceDocumentRef?.message}
                    {...historyForm.register("sourceDocumentRef")}
                  />
                </SimpleGrid>
                <SimpleGrid cols={2}>
                  <TextInput
                    label="Đơn vị/người ban hành"
                    error={historyForm.formState.errors.issuedBy?.message}
                    {...historyForm.register("issuedBy")}
                  />
                  <Textarea
                    label="Lý do"
                    error={historyForm.formState.errors.reason?.message}
                    {...historyForm.register("reason")}
                  />
                </SimpleGrid>
                <Group justify="flex-end">
                  <Button type="submit" loading={saving}>
                    Ghi phiên bản
                  </Button>
                </Group>
              </Stack>
            </form>
          </Paper>
        </Stack>
      </Drawer>

      <Modal
        opened={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        title="Archive đơn vị?"
        centered
      >
        <Stack>
          <Alert color="yellow" icon={<IconAlertTriangle size={18} />}>
            Thao tác chỉ chuyển trạng thái sang ARCHIVED, không xóa tiêu thụ, báo cáo, công tơ hoặc
            lịch sử phân loại.
          </Alert>
          <Text>{archiveTarget?.partyName}</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setArchiveTarget(null)}>
              Hủy
            </Button>
            <Button color="red" loading={saving} onClick={() => void archiveConsumer()}>
              Xác nhận archive
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
