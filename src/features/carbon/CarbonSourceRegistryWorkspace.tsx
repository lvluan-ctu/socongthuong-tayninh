"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Badge,
  Button,
  Drawer,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArchive,
  IconBuildingFactory2,
  IconEdit,
  IconMapPin,
  IconPlus,
} from "@tabler/icons-react";
import type { DataTableColumn } from "mantine-datatable";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { CrudDataTable, DataTableAction, DataTableActions } from "@/components/data/CrudDataTable";
import { FormValidationAlert } from "@/components/forms/FormValidationAlert";

type Party = { id: string; code: string; name: string; partyType: string; status: string };
type Site = {
  id: string;
  code: string;
  name: string;
  siteType: string;
  partyId: string | null;
  partyName: string | null;
  address: string | null;
  adminAreaCode: string | null;
  adminAreaName: string | null;
  status: string;
};
type AdminArea = {
  id: string;
  code: string;
  name: string;
  level: string;
  parentCode: string | null;
};
type EnergyType = {
  code: string;
  name: string;
  category: string;
  canonicalUnit: string | null;
  status: string;
};
type Source = {
  id: string;
  code: string;
  name: string;
  sourceType: string;
  energyTypeCode: string | null;
  energyTypeName: string | null;
  fuelTypeCode: string | null;
  processType: string | null;
  equipmentRef: string | null;
  meterRef: string | null;
  sourceCategory: string | null;
  scope: string;
  sector: string | null;
  status: string;
  classification: string;
  partyId: string | null;
  partyName: string | null;
  siteId: string | null;
  siteName: string | null;
  adminAreaCode: string | null;
  warnings?: string[];
};

const sourceSchema = z.object({
  partyId: z.string().min(1, "Hãy chọn đơn vị quản lý."),
  siteId: z.string().min(1, "Hãy chọn Site để có thể lập bản đồ."),
  energyTypeCode: z.string().min(1, "Hãy chọn loại năng lượng chuẩn."),
  code: z.string().trim().min(2, "Mã nguồn là bắt buộc.").max(100),
  name: z.string().trim().min(2, "Tên nguồn là bắt buộc.").max(250),
  sourceType: z.string().trim().min(2, "Loại nguồn là bắt buộc.").max(100),
  fuelTypeCode: z.string().trim().max(80),
  processType: z.string().trim().max(120),
  equipmentRef: z.string().trim().max(150),
  meterRef: z.string().trim().max(150),
  sourceCategory: z.string().trim().max(100),
  scope: z.enum(["SCOPE_1", "SCOPE_2", "SCOPE_3"]),
  sector: z.string().trim().max(150),
  status: z.enum(["ACTIVE", "INACTIVE", "PLANNED"]),
  classification: z.enum(["PUBLIC", "INTERNAL", "RESTRICTED", "CONFIDENTIAL"]),
});

const siteSchema = z
  .object({
    partyId: z.string().min(1, "Hãy chọn đơn vị quản lý."),
    code: z.string().trim().min(2, "Mã Site là bắt buộc."),
    name: z.string().trim().min(2, "Tên Site là bắt buộc."),
    siteType: z.string().trim().min(2, "Loại Site là bắt buộc."),
    address: z.string().trim().min(2, "Địa chỉ Site là bắt buộc."),
    adminAreaCode: z.string().min(1, "Hãy chọn khu vực hành chính."),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    classification: z.enum(["PUBLIC", "INTERNAL", "RESTRICTED", "CONFIDENTIAL"]),
  })
  .superRefine((value, context) => {
    if (value.latitude == null)
      context.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Nhập Latitude để hiển thị Site trên GIS.",
      });
    if (value.longitude == null)
      context.addIssue({
        code: "custom",
        path: ["longitude"],
        message: "Nhập Longitude để hiển thị Site trên GIS.",
      });
  });

type SourceForm = z.infer<typeof sourceSchema>;
type SiteForm = z.infer<typeof siteSchema>;

const sourceDefaults: SourceForm = {
  partyId: "",
  siteId: "",
  energyTypeCode: "",
  code: "",
  name: "",
  sourceType: "COMBUSTION",
  fuelTypeCode: "",
  processType: "",
  equipmentRef: "",
  meterRef: "",
  sourceCategory: "",
  scope: "SCOPE_1",
  sector: "",
  status: "ACTIVE",
  classification: "INTERNAL",
};
const siteDefaults: SiteForm = {
  partyId: "",
  code: "",
  name: "",
  siteType: "EMISSION_SITE",
  address: "",
  adminAreaCode: "",
  latitude: null,
  longitude: null,
  classification: "INTERNAL",
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Lỗi không xác định.";
}

export function CarbonSourceRegistryWorkspace() {
  const [parties, setParties] = useState<Party[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [areas, setAreas] = useState<AdminArea[]>([]);
  const [energyTypes, setEnergyTypes] = useState<EnergyType[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [opened, setOpened] = useState<"source" | "site" | null>(null);
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const sourceForm = useForm<SourceForm>({
    resolver: zodResolver(sourceSchema),
    defaultValues: sourceDefaults,
    mode: "onBlur",
  });
  const siteForm = useForm<SiteForm>({
    resolver: zodResolver(siteSchema),
    defaultValues: siteDefaults,
    mode: "onBlur",
  });

  const reload = useCallback(async (nextPage = 1, nextPageSize = 25) => {
    setLoading(true);
    try {
      const [partyRes, siteRes, areaRes, typeRes, sourceRes] = await Promise.all([
        fetch("/api/core/parties", { cache: "no-store" }),
        fetch("/api/core/sites", { cache: "no-store" }),
        fetch("/api/core/admin-areas", { cache: "no-store" }),
        fetch("/api/carbon/energy-types", { cache: "no-store" }),
        fetch(`/api/carbon/sources?page=${nextPage}&pageSize=${nextPageSize}`, {
          cache: "no-store",
        }),
      ]);
      if (!partyRes.ok || !siteRes.ok || !areaRes.ok || !typeRes.ok || !sourceRes.ok)
        throw new Error("Không thể tải đầy đủ dữ liệu registry.");
      setParties(((await partyRes.json()) as { items: Party[] }).items ?? []);
      setSites(((await siteRes.json()) as { items: Site[] }).items ?? []);
      setAreas(((await areaRes.json()) as { items: AdminArea[] }).items ?? []);
      setEnergyTypes(((await typeRes.json()) as { items: EnergyType[] }).items ?? []);
      const sourceData = (await sourceRes.json()) as {
        items?: Source[];
        pagination?: { page?: number; pageSize?: number; total?: number };
      };
      setSources(sourceData.items ?? []);
      setTotal(sourceData.pagination?.total ?? 0);
      if (sourceData.pagination?.page) setPage(sourceData.pagination.page);
      if (sourceData.pagination?.pageSize) setPageSize(sourceData.pagination.pageSize);
    } catch (error) {
      notifications.show({
        title: "Không thể tải registry",
        message: errorMessage(error),
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  function openNewSource() {
    setEditingSource(null);
    sourceForm.reset(sourceDefaults);
    setOpened("source");
  }
  function openEditSource(source: Source) {
    setEditingSource(source);
    sourceForm.reset({
      partyId: source.partyId ?? "",
      siteId: source.siteId ?? "",
      energyTypeCode: source.energyTypeCode ?? "",
      code: source.code,
      name: source.name,
      sourceType: source.sourceType,
      fuelTypeCode: source.fuelTypeCode ?? "",
      processType: source.processType ?? "",
      equipmentRef: source.equipmentRef ?? "",
      meterRef: source.meterRef ?? "",
      sourceCategory: source.sourceCategory ?? "",
      scope: source.scope as SourceForm["scope"],
      sector: source.sector ?? "",
      status: source.status as SourceForm["status"],
      classification: source.classification as SourceForm["classification"],
    });
    setOpened("source");
  }

  function openNewSite() {
    siteForm.reset({ ...siteDefaults, partyId: parties[0]?.id ?? "" });
    setOpened("site");
  }

  async function save(url: string, method: "POST" | "PATCH", body: unknown) {
    setSaving(true);
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Không thể lưu dữ liệu.");
      notifications.show({
        title: "Đã lưu",
        message: "Registry đã được cập nhật vào Energy Database.",
        color: "green",
      });
      setOpened(null);
      setEditingSource(null);
      await reload();
    } catch (error) {
      notifications.show({ title: "Lưu thất bại", message: errorMessage(error), color: "red" });
    } finally {
      setSaving(false);
    }
  }

  async function archive(source: Source) {
    if (!window.confirm(`Chuyển nguồn ${source.code} sang INACTIVE để giữ lịch sử?`)) return;
    await save(`/api/carbon/sources/${source.id}`, "PATCH", { status: "INACTIVE" });
  }

  const areaMap = new Map(areas.map((area) => [area.code, area.name]));
  const stats = useMemo(
    () => ({
      total: sources.length,
      located: sources.filter((source) => source.siteId).length,
      unclassified: sources.filter((source) => !source.energyTypeCode).length,
      sectors: new Set(sources.map((source) => source.sector).filter(Boolean)).size,
    }),
    [sources],
  );
  const partyOptions = parties
    .filter((party) => party.status === "ACTIVE")
    .map((party) => ({ value: party.id, label: `${party.name} • ${party.code}` }));
  const siteOptions = sites
    .filter((site) => site.status === "ACTIVE")
    .map((site) => ({
      value: site.id,
      label: `${site.name} • ${site.code}${site.adminAreaName ? ` • ${site.adminAreaName}` : ""}`,
    }));
  const areaOptions = areas.map((area) => ({
    value: area.code,
    label: `${area.name} • ${area.level}`,
  }));
  const energyTypeOptions = energyTypes
    .filter((type) => type.status === "ACTIVE")
    .map((type) => ({
      value: type.code,
      label: `${type.name} • ${type.code}${type.canonicalUnit ? ` • ${type.canonicalUnit}` : ""}`,
    }));
  const columns: DataTableColumn<Source>[] = [
    {
      accessor: "actions",
      title: "Thao tác",
      width: 92,
      render: (source) => (
        <DataTableActions>
          <DataTableAction
            label="Sửa nguồn phát thải"
            icon={<IconEdit size={16} />}
            color="blue"
            onClick={() => openEditSource(source)}
          />
          <DataTableAction
            label="Lưu trữ nguồn phát thải"
            icon={<IconArchive size={16} />}
            color="orange"
            onClick={() => void archive(source)}
          />
        </DataTableActions>
      ),
    },
    {
      accessor: "name",
      title: "Mã / nguồn",
      width: 260,
      render: (source) => (
        <>
          <Text fw={900}>{source.name}</Text>
          <Text size="xs" c="dimmed">
            {source.code}
          </Text>
        </>
      ),
    },
    {
      accessor: "energyTypeCode",
      title: "Loại năng lượng",
      width: 220,
      render: (source) =>
        source.energyTypeName ? (
          <>
            <Text fw={700}>{source.energyTypeName}</Text>
            <Text size="xs" c="dimmed">
              {source.energyTypeCode}
            </Text>
          </>
        ) : (
          <Badge color="orange">Chưa phân loại</Badge>
        ),
    },
    {
      accessor: "partyName",
      title: "Đơn vị",
      width: 210,
      render: (source) => source.partyName ?? <Text c="orange">Chưa liên kết</Text>,
    },
    {
      accessor: "siteName",
      title: "Site / khu vực",
      width: 230,
      render: (source) => (
        <>
          <Text size="sm" fw={700}>
            {source.siteName ?? "Chưa có Site"}
          </Text>
          <Text size="xs" c="dimmed">
            {source.adminAreaCode
              ? (areaMap.get(source.adminAreaCode) ?? source.adminAreaCode)
              : "—"}
          </Text>
        </>
      ),
    },
    {
      accessor: "sourceType",
      title: "Loại / Scope",
      width: 190,
      render: (source) => (
        <>
          <Text size="sm">{source.sourceType}</Text>
          <Badge variant="light">{source.scope}</Badge>
        </>
      ),
    },
    { accessor: "sector", title: "Lĩnh vực", width: 150, render: (source) => source.sector ?? "—" },
    {
      accessor: "status",
      title: "Trạng thái",
      width: 140,
      render: (source) => (
        <Badge
          color={
            source.status === "ACTIVE" ? "green" : source.status === "PLANNED" ? "blue" : "gray"
          }
        >
          {source.status}
        </Badge>
      ),
    },
  ];

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        {[
          ["Nguồn phát thải", stats.total, "violet"],
          ["Đã gắn Site", stats.located, "green"],
          ["Thiếu loại năng lượng", stats.unclassified, "orange"],
          ["Lĩnh vực", stats.sectors, "blue"],
        ].map(([label, value, color]) => (
          <Paper key={String(label)} radius="xl" p="md" withBorder className="energy-glass">
            <Text size="xs" c="dimmed" fw={800}>
              {label}
            </Text>
            <Text fz={30} fw={900} c={String(color)}>
              {String(value)}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>

      {stats.unclassified > 0 ? (
        <Alert color="orange" title="Cần chuẩn hoá phân loại">
          Có {stats.unclassified} nguồn chưa gắn loại năng lượng chuẩn. Các nguồn này vẫn giữ được
          lịch sử nhưng chưa nên đưa vào KPI chính thức.
        </Alert>
      ) : null}

      <Paper radius="xl" p="lg" withBorder className="energy-glass">
        <Group justify="space-between" mb="md" align="flex-start">
          <div>
            <Title order={3}>Emission Source Registry</Title>
            <Text size="sm" c="dimmed">
              Nguồn phát thải phải có đơn vị, Site và loại năng lượng chuẩn để phục vụ kiểm kê, cảnh
              báo và Carbon GIS.
            </Text>
          </div>
          <Group gap="xs">
            <Button
              variant="light"
              loading={loading}
              onClick={() => void reload()}
              leftSection={<IconMapPin size={16} />}
            >
              Làm mới
            </Button>
            <Button variant="light" leftSection={<IconMapPin size={16} />} onClick={openNewSite}>
              Thêm Site
            </Button>
            <Button leftSection={<IconPlus size={16} />} onClick={openNewSource}>
              Thêm nguồn
            </Button>
          </Group>
        </Group>
        <CrudDataTable
          records={sources}
          filterPlaceholder="Mã, tên nguồn, đơn vị hoặc lĩnh vực..."
          filters={[
            { key: "status", label: "Trạng thái", options: [{ value: "ACTIVE", label: "ACTIVE" }, { value: "INACTIVE", label: "INACTIVE" }, { value: "PLANNED", label: "PLANNED" }] },
            { key: "scope", label: "Phạm vi phát thải", options: [{ value: "SCOPE_1", label: "Scope 1" }, { value: "SCOPE_2", label: "Scope 2" }, { value: "SCOPE_3", label: "Scope 3" }] },
          ]}
          columns={columns}
          idAccessor="id"
          page={page}
          totalRecords={total}
          recordsPerPage={pageSize}
          onPageChange={(nextPage) => {
            setPage(nextPage);
            void reload(nextPage, pageSize);
          }}
          onRecordsPerPageChange={(nextSize) => {
            setPage(1);
            setPageSize(nextSize);
            void reload(1, nextSize);
          }}
          fetching={loading}
          rowExpansion={{
            allowMultiple: true,
            content: ({ record }) => (
              <SimpleGrid cols={{ base: 1, sm: 3 }} p="sm">
                <div>
                  <Text size="xs" c="dimmed" fw={800}>
                    Thiết bị / công tơ
                  </Text>
                  <Text size="sm">{record.equipmentRef ?? "Chưa có mã thiết bị"}</Text>
                  <Text size="xs" c="dimmed">
                    Meter: {record.meterRef ?? "—"}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed" fw={800}>
                    Phân loại
                  </Text>
                  <Text size="sm">
                    {record.sourceCategory ?? "—"} · {record.sector ?? "—"}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {record.classification}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed" fw={800}>
                    Cảnh báo dữ liệu
                  </Text>
                  {record.warnings?.length ? (
                    record.warnings.map((warning) => (
                      <Text key={warning} size="xs" c="orange">
                        {warning}
                      </Text>
                    ))
                  ) : (
                    <Text size="sm" c="green">
                      Không có cảnh báo.
                    </Text>
                  )}
                </div>
              </SimpleGrid>
            ),
          }}
          emptyState={
            <Text c="dimmed" ta="center" py="xl">
              Chưa có nguồn phát thải trong database.
            </Text>
          }
        />
      </Paper>

      <Paper radius="xl" p="lg" withBorder className="energy-glass">
        <Title order={3} mb="md">
          Site Registry liên quan
        </Title>
        <Table.ScrollContainer minWidth={850}>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Site</Table.Th>
                <Table.Th>Đơn vị</Table.Th>
                <Table.Th>Loại</Table.Th>
                <Table.Th>Khu vực</Table.Th>
                <Table.Th>Địa chỉ</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sites.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text c="dimmed" ta="center" py="xl">
                      Chưa có Site trong database.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                sites.slice(0, 100).map((site) => (
                  <Table.Tr key={site.id}>
                    <Table.Td>
                      <Text fw={800}>{site.name}</Text>
                      <Text size="xs" c="dimmed">
                        {site.code}
                      </Text>
                    </Table.Td>
                    <Table.Td>{site.partyName ?? "—"}</Table.Td>
                    <Table.Td>{site.siteType}</Table.Td>
                    <Table.Td>
                      {site.adminAreaName ??
                        (site.adminAreaCode
                          ? (areaMap.get(site.adminAreaCode) ?? site.adminAreaCode)
                          : "—")}
                    </Table.Td>
                    <Table.Td>{site.address ?? "—"}</Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>

      <Drawer
        opened={opened === "source"}
        onClose={() => {
          setOpened(null);
          setEditingSource(null);
        }}
        title={editingSource ? `Sửa nguồn ${editingSource.code}` : "Thêm nguồn phát thải"}
        position="right"
        size="lg"
      >
        <form
          onSubmit={sourceForm.handleSubmit(
            (value) =>
              void save(
                editingSource ? `/api/carbon/sources/${editingSource.id}` : "/api/carbon/sources",
                editingSource ? "PATCH" : "POST",
                {
                  ...value,
                  fuelTypeCode: value.fuelTypeCode || null,
                  processType: value.processType || null,
                  equipmentRef: value.equipmentRef || null,
                  meterRef: value.meterRef || null,
                  sourceCategory: value.sourceCategory || null,
                  sector: value.sector || null,
                },
              ),
          )}
          noValidate
        >
          <Stack>
            <FormValidationAlert errors={sourceForm.formState.errors} />
            <Controller
              control={sourceForm.control}
              name="partyId"
              render={({ field, fieldState }) => (
                <Select
                  searchable
                  withAsterisk
                  label="Đơn vị quản lý"
                  data={partyOptions}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={sourceForm.control}
              name="siteId"
              render={({ field, fieldState }) => (
                <Select
                  searchable
                  withAsterisk
                  label="Site / vị trí"
                  data={siteOptions}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={sourceForm.control}
              name="energyTypeCode"
              render={({ field, fieldState }) => (
                <Select
                  searchable
                  withAsterisk
                  label="Loại năng lượng chuẩn"
                  description="Phân biệt loại năng lượng với source type và Scope."
                  data={energyTypeOptions}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={fieldState.error?.message}
                />
              )}
            />
            <SimpleGrid cols={2}>
              <TextInput
                label="Mã nguồn"
                withAsterisk
                error={sourceForm.formState.errors.code?.message}
                {...sourceForm.register("code")}
              />
              <TextInput
                label="Tên nguồn"
                withAsterisk
                error={sourceForm.formState.errors.name?.message}
                {...sourceForm.register("name")}
              />
            </SimpleGrid>
            <TextInput
              label="Loại nguồn phát thải"
              description="Ví dụ: COMBUSTION, PURCHASED_ELECTRICITY, PROCESS"
              withAsterisk
              error={sourceForm.formState.errors.sourceType?.message}
              {...sourceForm.register("sourceType")}
            />
            <SimpleGrid cols={2}>
              <TextInput
                label="Mã nhiên liệu"
                error={sourceForm.formState.errors.fuelTypeCode?.message}
                {...sourceForm.register("fuelTypeCode")}
              />
              <TextInput
                label="Loại quy trình"
                error={sourceForm.formState.errors.processType?.message}
                {...sourceForm.register("processType")}
              />
            </SimpleGrid>
            <SimpleGrid cols={2}>
              <TextInput
                label="Mã thiết bị"
                error={sourceForm.formState.errors.equipmentRef?.message}
                {...sourceForm.register("equipmentRef")}
              />
              <TextInput
                label="Mã công tơ"
                error={sourceForm.formState.errors.meterRef?.message}
                {...sourceForm.register("meterRef")}
              />
            </SimpleGrid>
            <SimpleGrid cols={2}>
              <Controller
                control={sourceForm.control}
                name="scope"
                render={({ field, fieldState }) => (
                  <Select
                    label="Scope"
                    withAsterisk
                    data={["SCOPE_1", "SCOPE_2", "SCOPE_3"]}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "SCOPE_1")}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <TextInput
                label="Lĩnh vực"
                error={sourceForm.formState.errors.sector?.message}
                {...sourceForm.register("sector")}
              />
            </SimpleGrid>
            <SimpleGrid cols={2}>
              <Controller
                control={sourceForm.control}
                name="status"
                render={({ field, fieldState }) => (
                  <Select
                    label="Trạng thái"
                    data={["ACTIVE", "PLANNED", "INACTIVE"]}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "ACTIVE")}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                control={sourceForm.control}
                name="classification"
                render={({ field, fieldState }) => (
                  <Select
                    label="Phân loại dữ liệu"
                    data={["PUBLIC", "INTERNAL", "RESTRICTED", "CONFIDENTIAL"]}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "INTERNAL")}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </SimpleGrid>
            <Button type="submit" loading={saving}>
              {editingSource ? "Lưu thay đổi" : "Lưu nguồn phát thải"}
            </Button>
          </Stack>
        </form>
      </Drawer>

      <Drawer
        opened={opened === "site"}
        onClose={() => setOpened(null)}
        title="Thêm Site / vị trí cơ sở"
        position="right"
        size="lg"
      >
        <form
          onSubmit={siteForm.handleSubmit(
            (value) =>
              void save("/api/core/sites", "POST", {
                ...value,
                address: value.address || null,
                adminAreaCode: value.adminAreaCode || null,
              }),
          )}
          noValidate
        >
          <Stack>
            <FormValidationAlert errors={siteForm.formState.errors} />
            <Controller
              control={siteForm.control}
              name="partyId"
              render={({ field, fieldState }) => (
                <Select
                  searchable
                  withAsterisk
                  label="Đơn vị"
                  data={partyOptions}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={fieldState.error?.message}
                />
              )}
            />
            <SimpleGrid cols={2}>
              <TextInput
                label="Mã Site"
                withAsterisk
                error={siteForm.formState.errors.code?.message}
                {...siteForm.register("code")}
              />
              <TextInput
                label="Tên Site"
                withAsterisk
                error={siteForm.formState.errors.name?.message}
                {...siteForm.register("name")}
              />
            </SimpleGrid>
            <TextInput
              label="Loại Site"
              withAsterisk
              error={siteForm.formState.errors.siteType?.message}
              {...siteForm.register("siteType")}
            />
            <TextInput
              label="Địa chỉ"
              withAsterisk
              error={siteForm.formState.errors.address?.message}
              {...siteForm.register("address")}
            />
            <Controller
              control={siteForm.control}
              name="adminAreaCode"
              render={({ field, fieldState }) => (
                <Select
                  searchable
                  clearable
                  label="Khu vực hành chính"
                  withAsterisk
                  data={areaOptions}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={fieldState.error?.message}
                />
              )}
            />
            <SimpleGrid cols={2}>
              <Controller
                control={siteForm.control}
                name="latitude"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Latitude"
                    withAsterisk
                    decimalScale={7}
                    value={field.value ?? ""}
                    onChange={(value) => field.onChange(value === "" ? null : Number(value))}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                control={siteForm.control}
                name="longitude"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Longitude"
                    withAsterisk
                    decimalScale={7}
                    value={field.value ?? ""}
                    onChange={(value) => field.onChange(value === "" ? null : Number(value))}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </SimpleGrid>
            <Controller
              control={siteForm.control}
              name="classification"
              render={({ field, fieldState }) => (
                <Select
                  label="Phân loại dữ liệu"
                  data={["PUBLIC", "INTERNAL", "RESTRICTED", "CONFIDENTIAL"]}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? "INTERNAL")}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Button type="submit" loading={saving} leftSection={<IconBuildingFactory2 size={16} />}>
              Lưu Site
            </Button>
          </Stack>
        </form>
      </Drawer>
    </Stack>
  );
}
