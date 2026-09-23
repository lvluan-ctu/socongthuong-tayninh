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
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconEdit,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import type { DataTableColumn } from "mantine-datatable";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { rooftopSystemSchema, type RooftopSystemInput } from "@/lib/solar-schemas";
import { CrudDataTable, DataTableAction, DataTableActions } from "@/components/data/CrudDataTable";
import { FormValidationAlert } from "@/components/forms/FormValidationAlert";

type CustomerOption = {
  id: string;
  customerCode: string;
  customerName: string;
  customerType: string | null;
  serviceAddress: string | null;
  adminAreaCode: string | null;
};
type GridOption = { id: string; code: string; name: string; assetType: string; status: string };
type ServiceLink = {
  servicePointCode: string;
  isInferred: boolean;
  feederCode: string | null;
  feederName: string | null;
  substationCode: string | null;
  substationName: string | null;
  source: string;
} | null;
type RooftopSystem = {
  assetId: string;
  assetCode: string;
  assetName: string;
  assetStatus: string;
  commissionedAt: string | null;
  customerAccountId: string | null;
  customerCode: string | null;
  customerName: string | null;
  customerType: string | null;
  serviceAddress: string | null;
  siteName: string | null;
  adminAreaCode: string | null;
  installedCapacityKwp: number;
  inverterCapacityKw: number | null;
  batteryCapacityKwh: number | null;
  gridConnectionAssetId: string | null;
  gridConnection: GridOption | null;
  serviceLink: ServiceLink;
  operationStatus: string;
  ownershipModel: string | null;
  installationType: string;
  evRegistrationNo: string | null;
  annualYieldKwh: number | null;
  generatedLast12MonthsKwh: number | null;
  selfConsumptionPct: number | null;
  exportLimitKw: number | null;
  source: string;
  sourceRef: string | null;
  lastVerifiedAt: string | null;
  confidence: number | null;
};

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Đang vận hành" },
  { value: "INSTALLING", label: "Đang lắp đặt" },
  { value: "MAINTENANCE", label: "Bảo trì" },
  { value: "OFFLINE", label: "Tạm dừng" },
  { value: "PLANNED", label: "Kế hoạch" },
  { value: "DECOMMISSIONED", label: "Ngừng vận hành" },
];
const SOURCE_OPTIONS = ["EVN", "MANUAL", "IMPORT", "API", "DEMO"].map((value) => ({
  value,
  label: value === "EVN" ? "EVN" : value === "MANUAL" ? "Nhập thủ công" : value,
}));
const INSTALLATION_OPTIONS = [
  { value: "ROOFTOP", label: "Mái nhà" },
  { value: "CARPORT", label: "Mái che" },
  { value: "MIXED", label: "Kết hợp" },
  { value: "OTHER", label: "Khác" },
];

const defaultValues: RooftopSystemInput = {
  code: "",
  name: "",
  customerAccountId: "",
  buildingAssetId: null,
  roofSurfaceId: null,
  installedCapacityKwp: 0,
  inverterCapacityKw: null,
  batteryCapacityKwh: null,
  gridConnectionAssetId: null,
  commissionedAt: "",
  operationStatus: "ACTIVE",
  ownershipModel: null,
  installationType: "ROOFTOP",
  installerPartyId: null,
  evRegistrationNo: null,
  evnAcceptanceAt: "",
  meteringScheme: null,
  exportLimitKw: null,
  annualYieldKwh: null,
  selfConsumptionPct: null,
  source: "MANUAL",
  sourceId: null,
  sourceRef: null,
  lastVerifiedAt: "",
  confidence: null,
};

function dateValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}
function fmt(value: number | null | undefined, unit = "", digits = 1) {
  return value == null || !Number.isFinite(value)
    ? "—"
    : `${value.toLocaleString("vi-VN", { maximumFractionDigits: digits })}${unit ? ` ${unit}` : ""}`;
}
function statusColor(status: string) {
  return status === "ACTIVE"
    ? "green"
    : status === "INSTALLING"
      ? "cyan"
      : status === "MAINTENANCE"
        ? "yellow"
        : status === "OFFLINE"
          ? "orange"
          : status === "PLANNED"
            ? "blue"
            : "gray";
}
function sourceColor(source: string) {
  return source === "EVN" ? "blue" : source === "DEMO" ? "gray" : "orange";
}

function toPayload(values: RooftopSystemInput) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      typeof value === "string" && value.trim() === "" ? null : value,
    ]),
  );
}

export function RooftopSystemsWorkspace() {
  const [items, setItems] = useState<RooftopSystem[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [gridOptions, setGridOptions] = useState<GridOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drawerOpened, setDrawerOpened] = useState(false);
  const [editing, setEditing] = useState<RooftopSystem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RooftopSystem | null>(null);
  const [search, setSearch] = useState("");
  const [adminAreaCode, setAdminAreaCode] = useState<string | null>(null);
  const [operationStatus, setOperationStatus] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [battery, setBattery] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);

  const form = useForm<RooftopSystemInput>({
    resolver: zodResolver(rooftopSystemSchema),
    defaultValues,
    mode: "onBlur",
  });
  const errors = form.formState.errors;

  const load = useCallback(
    async (nextPage = page, nextPageSize = pageSize) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          pageSize: String(nextPageSize),
        });
        if (search.trim()) params.set("search", search.trim());
        if (adminAreaCode) params.set("adminAreaCode", adminAreaCode);
        if (operationStatus) params.set("operationStatus", operationStatus);
        if (source) params.set("source", source);
        if (battery) params.set("battery", battery);
        const response = await fetch(`/api/solar/systems?${params.toString()}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as {
          items?: RooftopSystem[];
          pagination?: { page?: number; pageSize?: number; total?: number; totalPages?: number };
          message?: string;
        };
        if (!response.ok) throw new Error(data.message ?? "Không thể tải danh mục rooftop.");
        setItems(data.items ?? []);
        setTotal(data.pagination?.total ?? 0);
        if (data.pagination?.page) setPage(data.pagination.page);
        if (data.pagination?.pageSize) setPageSize(data.pagination.pageSize);
      } catch (error) {
        notifications.show({
          title: "Không thể tải dữ liệu",
          message: error instanceof Error ? error.message : "Lỗi không xác định.",
          color: "red",
        });
      } finally {
        setLoading(false);
      }
    },
    [adminAreaCode, battery, operationStatus, page, pageSize, search, source],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    void Promise.all([
      fetch("/api/solar/customers?limit=500", { cache: "no-store" }).then(async (response) => {
        const data = (await response.json()) as { items?: CustomerOption[] };
        if (response.ok) setCustomers(data.items ?? []);
      }),
      fetch("/api/grid/assets/options?types=SUBSTATION,TRANSFORMER,BAY,FEEDER", {
        cache: "no-store",
      }).then(async (response) => {
        const data = (await response.json()) as { items?: GridOption[] };
        if (response.ok) setGridOptions(data.items ?? []);
      }),
    ]).catch(() => undefined);
  }, []);

  const customerOptions = useMemo(
    () =>
      customers.map((customer) => ({
        value: customer.id,
        label: `${customer.customerCode} • ${customer.customerName}`,
      })),
    [customers],
  );
  const gridSelectOptions = useMemo(
    () =>
      gridOptions.map((option) => ({
        value: option.id,
        label: `[${option.assetType}] ${option.code} • ${option.name}`,
      })),
    [gridOptions],
  );

  function openCreate() {
    setEditing(null);
    form.reset(defaultValues);
    setDrawerOpened(true);
  }
  function openEdit(item: RooftopSystem) {
    setEditing(item);
    form.reset({
      ...defaultValues,
      code: item.assetCode,
      name: item.assetName,
      customerAccountId: item.customerAccountId ?? "",
      installedCapacityKwp: item.installedCapacityKwp,
      inverterCapacityKw: item.inverterCapacityKw,
      batteryCapacityKwh: item.batteryCapacityKwh,
      gridConnectionAssetId: item.gridConnectionAssetId,
      commissionedAt: dateValue(item.commissionedAt),
      operationStatus: item.operationStatus as RooftopSystemInput["operationStatus"],
      ownershipModel: item.ownershipModel,
      installationType: item.installationType as RooftopSystemInput["installationType"],
      evRegistrationNo: item.evRegistrationNo,
      annualYieldKwh: item.annualYieldKwh,
      selfConsumptionPct: item.selfConsumptionPct,
      exportLimitKw: item.exportLimitKw,
      source: item.source as RooftopSystemInput["source"],
      sourceRef: item.sourceRef,
      lastVerifiedAt: dateValue(item.lastVerifiedAt),
      confidence: item.confidence,
    });
    setDrawerOpened(true);
  }

  const submit = form.handleSubmit(async (values) => {
    setSaving(true);
    try {
      const response = await fetch(
        editing ? `/api/solar/systems/${editing.assetId}` : "/api/solar/systems",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toPayload(values)),
        },
      );
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Không thể lưu hệ rooftop.");
      notifications.show({
        title: editing ? "Đã cập nhật hệ rooftop" : "Đã tạo hệ rooftop",
        message: "Dữ liệu đã được lưu vào Asset Registry và giữ provenance.",
        color: "green",
      });
      setDrawerOpened(false);
      await load();
    } catch (error) {
      notifications.show({
        title: "Lưu thất bại",
        message: error instanceof Error ? error.message : "Lỗi không xác định.",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  });

  async function remove() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/solar/systems/${deleteTarget.assetId}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Không thể xóa hệ rooftop.");
      notifications.show({
        title: "Đã ngừng hồ sơ",
        message: "Record được soft-delete để bảo toàn lịch sử và provenance.",
        color: "green",
      });
      setDeleteTarget(null);
      await load();
    } catch (error) {
      notifications.show({
        title: "Xóa thất bại",
        message: error instanceof Error ? error.message : "Lỗi không xác định.",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  }

  const columns: DataTableColumn<RooftopSystem>[] = [
    {
      accessor: "actions",
      title: "Thao tác",
      width: 92,
      render: (item) => (
        <DataTableActions>
          <DataTableAction
            label="Sửa hệ rooftop"
            icon={<IconEdit size={16} />}
            color="blue"
            onClick={() => openEdit(item)}
          />
          <DataTableAction
            label="Đánh dấu DELETED"
            icon={<IconTrash size={16} />}
            color="red"
            onClick={() => setDeleteTarget(item)}
          />
        </DataTableActions>
      ),
    },
    {
      accessor: "assetName",
      title: "Hệ thống",
      width: 250,
      render: (item) => (
        <>
          <Link href={"/mission/rooftop-solar/systems/" + item.assetId}>
            <Text component="span" fw={900} c="blue">
              {item.assetName}
            </Text>
          </Link>
          <Text size="xs" c="dimmed">
            {item.assetCode}
          </Text>
        </>
      ),
    },
    {
      accessor: "customerName",
      title: "Khách hàng EVN",
      width: 230,
      render: (item) => (
        <>
          <Text fw={800}>{item.customerName ?? "—"}</Text>
          <Text size="xs" c="dimmed">
            {item.customerCode ?? "Chưa gắn mã EVN"}
          </Text>
        </>
      ),
    },
    {
      accessor: "adminAreaCode",
      title: "Địa bàn / địa chỉ",
      width: 230,
      render: (item) => (
        <>
          <Text size="sm">{item.adminAreaCode ?? "Chưa xác định"}</Text>
          <Text size="xs" c="dimmed" lineClamp={2}>
            {item.serviceAddress ?? "—"}
          </Text>
        </>
      ),
    },
    {
      accessor: "installedCapacityKwp",
      title: "Installed",
      width: 145,
      render: (item) => (
        <>
          <Text fw={900}>{fmt(item.installedCapacityKwp, "kWp", 2)}</Text>
          <Text size="xs" c="dimmed">
            {item.installationType}
          </Text>
        </>
      ),
    },
    {
      accessor: "inverterCapacityKw",
      title: "Inverter / battery",
      width: 165,
      render: (item) => (
        <>
          <Text>{fmt(item.inverterCapacityKw, "kW")}</Text>
          <Text size="xs" c="dimmed">
            Battery {fmt(item.batteryCapacityKwh, "kWh")}
          </Text>
        </>
      ),
    },
    {
      accessor: "gridConnectionAssetId",
      title: "Grid service",
      width: 190,
      render: (item) =>
        item.serviceLink ? (
          <>
            <Badge color={item.serviceLink.isInferred ? "orange" : "green"} variant="light">
              {item.serviceLink.isInferred ? "INFERRED" : "EVN LINK"}
            </Badge>
            <Text size="xs" mt={3}>
              {item.serviceLink.feederCode ??
                item.serviceLink.substationCode ??
                item.gridConnection?.code ??
                "Có link, thiếu asset"}
            </Text>
          </>
        ) : (
          <Badge color="orange" variant="light">
            Chưa mapping
          </Badge>
        ),
    },
    {
      accessor: "operationStatus",
      title: "Vận hành",
      width: 165,
      render: (item) => (
        <>
          <Badge color={statusColor(item.operationStatus)} variant="dot">
            {STATUS_OPTIONS.find((option) => option.value === item.operationStatus)?.label ??
              item.operationStatus}
          </Badge>
          <Text size="xs" c="dimmed" mt={3}>
            {dateValue(item.commissionedAt) || "Chưa có ngày"}
          </Text>
        </>
      ),
    },
    {
      accessor: "source",
      title: "Nguồn / sản lượng",
      width: 190,
      render: (item) => (
        <>
          <Badge color={sourceColor(item.source)} variant="light">
            {item.source}
          </Badge>
          <Text size="xs" c="dimmed">
            {fmt(item.generatedLast12MonthsKwh ?? item.annualYieldKwh, "kWh", 0)}
          </Text>
        </>
      ),
    },
  ];
  return (
    <Stack gap="lg">
      <Paper radius="xl" p="lg" withBorder className="energy-glass">
        <Group justify="space-between" align="end" wrap="wrap" gap="md">
          <div>
            <Title order={3}>Installed Rooftop Solar Registry</Title>
            <Text size="sm" c="dimmed">
              Danh sách hệ đã lắp, tách khỏi toàn bộ EVN Customer Registry. Mỗi record gắn customer,
              site, grid link và nguồn dữ liệu.
            </Text>
          </div>
          <Group>
            <Button
              variant="light"
              leftSection={<IconRefresh size={16} />}
              onClick={() => void load()}
            >
              Làm mới
            </Button>
            <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
              Thêm hệ rooftop
            </Button>
          </Group>
        </Group>
        <SimpleGrid cols={{ base: 1, md: 3, lg: 5 }} mt="lg">
          <TextInput
            label="Tìm kiếm"
            placeholder="Mã hệ / mã EVN / khách hàng / địa chỉ"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(event) => {
              setSearch(event.currentTarget.value);
              setPage(1);
            }}
          />
          <TextInput
            label="Mã địa bàn"
            placeholder="Xã/phường/huyện"
            value={adminAreaCode ?? ""}
            onChange={(event) => {
              setAdminAreaCode(event.currentTarget.value || null);
              setPage(1);
            }}
          />
          <Select
            label="Trạng thái"
            placeholder="Tất cả"
            clearable
            data={STATUS_OPTIONS}
            value={operationStatus}
            onChange={(value) => {
              setOperationStatus(value);
              setPage(1);
            }}
          />
          <Select
            label="Nguồn"
            placeholder="Tất cả"
            clearable
            data={SOURCE_OPTIONS}
            value={source}
            onChange={(value) => {
              setSource(value);
              setPage(1);
            }}
          />
          <Select
            label="Battery"
            placeholder="Tất cả"
            clearable
            data={[
              { value: "yes", label: "Có battery" },
              { value: "no", label: "Không battery" },
            ]}
            value={battery}
            onChange={(value) => {
              setBattery(value);
              setPage(1);
            }}
          />
        </SimpleGrid>
      </Paper>

      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Paper p="md" radius="lg" withBorder>
          <Text size="xs" c="dimmed" fw={800}>
            HỆ TRONG TRANG
          </Text>
          <Text fz={28} fw={900}>
            {items.length.toLocaleString("vi-VN")}
          </Text>
          <Text size="xs" c="dimmed">
            Tổng {total.toLocaleString("vi-VN")} record
          </Text>
        </Paper>
        <Paper p="md" radius="lg" withBorder>
          <Text size="xs" c="dimmed" fw={800}>
            INSTALLED kWp
          </Text>
          <Text fz={28} fw={900}>
            {fmt(
              items.reduce((sum, item) => sum + item.installedCapacityKwp, 0),
              "kWp",
            )}
          </Text>
          <Text size="xs" c="dimmed">
            Trong trang hiện tại
          </Text>
        </Paper>
        <Paper p="md" radius="lg" withBorder>
          <Text size="xs" c="dimmed" fw={800}>
            CÓ GRID LINK
          </Text>
          <Text fz={28} fw={900}>
            {items.filter((item) => item.serviceLink && !item.serviceLink.isInferred).length}
          </Text>
          <Text size="xs" c="dimmed">
            Mapping EVN chính thức
          </Text>
        </Paper>
        <Paper p="md" radius="lg" withBorder>
          <Text size="xs" c="dimmed" fw={800}>
            CẦN XÁC MINH
          </Text>
          <Text fz={28} fw={900}>
            {
              items.filter(
                (item) => !item.serviceLink || item.serviceLink.isInferred || item.source !== "EVN",
              ).length
            }
          </Text>
          <Text size="xs" c="dimmed">
            Thiếu nguồn/link authoritative
          </Text>
        </Paper>
      </SimpleGrid>

      <Paper radius="xl" p="lg" withBorder className="energy-glass">
        <CrudDataTable
          records={items}
          columns={columns}
          idAccessor="assetId"
          page={page}
          totalRecords={total}
          recordsPerPage={pageSize}
          onPageChange={setPage}
          onRecordsPerPageChange={(nextSize) => {
            setPage(1);
            setPageSize(nextSize);
          }}
          fetching={loading}
          rowExpansion={{
            allowMultiple: true,
            content: ({ record }) => (
              <SimpleGrid cols={{ base: 1, sm: 3 }} p="sm">
                <div>
                  <Text size="xs" c="dimmed" fw={800}>
                    Địa chỉ dịch vụ / site
                  </Text>
                  <Text size="sm">{record.serviceAddress ?? "—"}</Text>
                  <Text size="xs" c="dimmed">
                    {record.siteName ?? "Chưa gắn Site"} · {record.adminAreaCode ?? "—"}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed" fw={800}>
                    Grid connection
                  </Text>
                  <Text size="sm">
                    {record.gridConnection
                      ? String(record.gridConnection.code) +
                        " · " +
                        String(record.gridConnection.name)
                      : "—"}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {record.serviceLink?.substationName ?? "Chưa có substation"} ·{" "}
                    {record.serviceLink?.feederName ?? "Chưa có feeder"}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed" fw={800}>
                    Thông tin chi tiết
                  </Text>
                  <Text size="sm">
                    Yield {fmt(record.annualYieldKwh, "kWh", 0)} · Self{" "}
                    {fmt(record.selfConsumptionPct, "%", 1)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Export {fmt(record.exportLimitKw, "kW")} · Confidence{" "}
                    {fmt(record.confidence, "%")}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed" fw={800}>
                    Provenance
                  </Text>
                  <Text size="sm">{record.sourceRef ?? "Không có source reference"}</Text>
                  <Text size="xs" c="dimmed">
                    Xác minh: {dateValue(record.lastVerifiedAt) || "—"}
                  </Text>
                </div>
              </SimpleGrid>
            ),
          }}
          emptyState={
            <Stack align="center" py="xl">
              <IconAlertTriangle size={36} />
              <Text fw={800}>Chưa có hệ rooftop phù hợp</Text>
              <Text c="dimmed" size="sm">
                Hãy import dữ liệu có nguồn hoặc tạo hồ sơ hệ đã lắp. Không có số liệu minh họa được
                tự sinh.
              </Text>
            </Stack>
          }
        />
      </Paper>

      <Drawer
        opened={drawerOpened}
        onClose={() => setDrawerOpened(false)}
        title={editing ? `Sửa hệ rooftop • ${editing.assetCode}` : "Thêm hệ rooftop đã lắp"}
        position="right"
        size="xl"
      >
        <form onSubmit={submit} noValidate>
          <Stack gap="md">
            <FormValidationAlert errors={errors} />
            <Alert color="blue" variant="light">
              Thông tin hệ phải gắn với một tài khoản EVN. Nếu chưa có source authoritative, chọn
              `MANUAL/IMPORT` và điền source reference để người review truy nguyên.
            </Alert>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Mã hệ thống"
                withAsterisk
                error={errors.code?.message}
                {...form.register("code")}
              />
              <TextInput
                label="Tên hệ thống"
                withAsterisk
                error={errors.name?.message}
                {...form.register("name")}
              />
            </SimpleGrid>
            <Controller
              control={form.control}
              name="customerAccountId"
              render={({ field }) => (
                <Select
                  label="Khách hàng EVN"
                  withAsterisk
                  searchable
                  clearable
                  data={customerOptions}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={errors.customerAccountId?.message}
                  description="Customer Registry dùng chung cho Solar/Efficiency/EV."
                />
              )}
            />
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <Controller
                control={form.control}
                name="installedCapacityKwp"
                render={({ field }) => (
                  <NumberInput
                    label="Công suất lắp đặt (kWp)"
                    withAsterisk
                    min={0.001}
                    decimalScale={3}
                    value={field.value}
                    onChange={(value) => field.onChange(value === "" ? 0 : Number(value))}
                    error={errors.installedCapacityKwp?.message}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="inverterCapacityKw"
                render={({ field }) => (
                  <NumberInput
                    label="Inverter (kW)"
                    min={0}
                    decimalScale={3}
                    value={field.value ?? ""}
                    onChange={(value) => field.onChange(value === "" ? null : Number(value))}
                    error={errors.inverterCapacityKw?.message}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="batteryCapacityKwh"
                render={({ field }) => (
                  <NumberInput
                    label="Battery (kWh)"
                    min={0}
                    decimalScale={3}
                    value={field.value ?? ""}
                    onChange={(value) => field.onChange(value === "" ? null : Number(value))}
                    error={errors.batteryCapacityKwh?.message}
                  />
                )}
              />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <Controller
                control={form.control}
                name="operationStatus"
                render={({ field }) => (
                  <Select
                    label="Trạng thái vận hành"
                    withAsterisk
                    data={STATUS_OPTIONS}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "ACTIVE")}
                    error={errors.operationStatus?.message}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="installationType"
                render={({ field }) => (
                  <Select
                    label="Kiểu lắp đặt"
                    withAsterisk
                    data={INSTALLATION_OPTIONS}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "ROOFTOP")}
                    error={errors.installationType?.message}
                  />
                )}
              />
              <TextInput
                label="Mô hình sở hữu"
                placeholder="SELF_OWNED / LEASED / PPA"
                error={errors.ownershipModel?.message}
                {...form.register("ownershipModel")}
              />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <TextInput
                label="Ngày vận hành"
                type="date"
                error={errors.commissionedAt?.message}
                {...form.register("commissionedAt")}
              />
              <TextInput
                label="Ngày EVN nghiệm thu"
                type="date"
                error={errors.evnAcceptanceAt?.message}
                {...form.register("evnAcceptanceAt")}
              />
              <TextInput
                label="Ngày xác minh gần nhất"
                type="date"
                error={errors.lastVerifiedAt?.message}
                {...form.register("lastVerifiedAt")}
              />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <Controller
                control={form.control}
                name="annualYieldKwh"
                render={({ field }) => (
                  <NumberInput
                    label="Sản lượng năm (kWh)"
                    min={0}
                    decimalScale={3}
                    value={field.value ?? ""}
                    onChange={(value) => field.onChange(value === "" ? null : Number(value))}
                    error={errors.annualYieldKwh?.message}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="selfConsumptionPct"
                render={({ field }) => (
                  <NumberInput
                    label="Tự dùng (%)"
                    min={0}
                    max={100}
                    decimalScale={2}
                    value={field.value ?? ""}
                    onChange={(value) => field.onChange(value === "" ? null : Number(value))}
                    error={errors.selfConsumptionPct?.message}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="exportLimitKw"
                render={({ field }) => (
                  <NumberInput
                    label="Giới hạn phát lưới (kW)"
                    min={0}
                    decimalScale={3}
                    value={field.value ?? ""}
                    onChange={(value) => field.onChange(value === "" ? null : Number(value))}
                    error={errors.exportLimitKw?.message}
                  />
                )}
              />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Số đăng ký / hồ sơ EVN"
                error={errors.evRegistrationNo?.message}
                {...form.register("evRegistrationNo")}
              />
              <TextInput
                label="Sơ đồ đo đếm"
                placeholder="NET_METERING / ZERO_EXPORT / OTHER"
                error={errors.meteringScheme?.message}
                {...form.register("meteringScheme")}
              />
            </SimpleGrid>
            <Controller
              control={form.control}
              name="gridConnectionAssetId"
              render={({ field }) => (
                <Select
                  label="Tài sản grid đấu nối (nếu đã xác nhận)"
                  searchable
                  clearable
                  data={gridSelectOptions}
                  value={field.value ?? null}
                  onChange={(value) => field.onChange(value ?? null)}
                  error={errors.gridConnectionAssetId?.message}
                  description="Đây là liên kết vận hành của hệ; mapping customer → feeder/TBA quản lý ở System 360."
                />
              )}
            />
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Controller
                control={form.control}
                name="source"
                render={({ field }) => (
                  <Select
                    label="Nguồn dữ liệu"
                    withAsterisk
                    data={SOURCE_OPTIONS}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "MANUAL")}
                    error={errors.source?.message}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="confidence"
                render={({ field }) => (
                  <NumberInput
                    label="Độ tin cậy (%)"
                    min={0}
                    max={100}
                    decimalScale={2}
                    value={field.value ?? ""}
                    onChange={(value) => field.onChange(value === "" ? null : Number(value))}
                    error={errors.confidence?.message}
                  />
                )}
              />
            </SimpleGrid>
            <TextInput
              label="Source reference / file / record ID"
              placeholder="EVN workbook, số hồ sơ, API record..."
              error={errors.sourceRef?.message}
              {...form.register("sourceRef")}
            />
            {Object.keys(errors).length ? (
              <Alert color="red" icon={<IconAlertTriangle size={17} />}>
                Vui lòng kiểm tra các trường đang báo lỗi trước khi lưu.
              </Alert>
            ) : null}
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setDrawerOpened(false)}>
                Hủy
              </Button>
              <Button type="submit" loading={saving}>
                {editing ? "Lưu thay đổi" : "Tạo hồ sơ"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Drawer>

      <Modal
        opened={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Xác nhận soft-delete"
        centered
      >
        <Stack>
          <Text>
            Hồ sơ <b>{deleteTarget?.assetCode}</b> sẽ chuyển sang DELETED và không còn xuất hiện
            trong danh sách mặc định. Dữ liệu thành phần/lịch sử vẫn được bảo toàn.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteTarget(null)}>
              Hủy
            </Button>
            <Button color="red" loading={saving} onClick={() => void remove()}>
              Đánh dấu DELETED
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
