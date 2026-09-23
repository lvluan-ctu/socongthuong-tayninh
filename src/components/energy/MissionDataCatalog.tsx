"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Drawer,
  Group,
  Loader,
  Modal,
  Pagination,
  Paper,
  Progress,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconCheck,
  IconDatabase,
  IconEdit,
  IconEye,
  IconMapPin,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import {
  MISSION_PRIMARY_DATA_TABLE,
  type MissionDataAccess,
  type MissionDataImpact,
  type MissionDataScope,
} from "@/lib/mission-data-catalog";

type Permissions = { create: boolean; update: boolean; delete: boolean };
type CatalogResource = {
  table: string;
  label: string;
  group: string;
  scope: MissionDataScope;
  access: MissionDataAccess;
  impacts: MissionDataImpact[];
  description?: string;
  available: boolean;
  rowCount: number;
  permissions: Permissions;
};
type ColumnMeta = {
  name: string;
  dataType: string;
  udtName: string;
  kind: "geometry" | "json" | "boolean" | "datetime" | "number" | "array" | "uuid" | "text";
  nullable: boolean;
  defaultValue: string | null;
  generated: boolean;
  primaryKey: boolean;
  referencedTable: string | null;
  referencedColumn: string | null;
};
type ResourcePayload = {
  resource: CatalogResource;
  columns: ColumnMeta[];
  primaryKeys: string[];
  items: Array<Record<string, unknown>>;
  pagination: { page: number; pageSize: number; total: number };
};
type ConsistencyPayload = {
  label: string;
  tableCount: number;
  statisticsCount: number;
  gisLocatedCount: number;
  gisMissingCount: number;
  gisCoveragePct: number;
  dashboardMarkerLimit: number | null;
  missingLocationSample: Array<{ id: string; code: string | null; name: string | null }>;
  mappedTables: number;
  primaryTable: string;
  dashboardSources: Array<{
    table: string;
    label: string;
    scope: MissionDataScope;
    rowCount: number;
    available: boolean;
  }>;
  statisticTables: string[];
  gisTables: string[];
};

const ACCESS_META: Record<MissionDataAccess, { label: string; color: string; note: string }> = {
  full: { label: "CRUD đầy đủ", color: "green", note: "Cho phép tạo, xem, sửa và xóa có kiểm tra khóa ngoại." },
  append: { label: "Thêm / đọc", color: "blue", note: "Dữ liệu lịch sử bất biến; bản ghi mới được thêm nhưng không ghi đè lịch sử." },
  review: { label: "Duyệt / cập nhật", color: "orange", note: "Dữ liệu do quy trình sinh; người quản trị được cập nhật trạng thái duyệt." },
  readonly: { label: "Chỉ đọc", color: "gray", note: "Kết quả hệ thống hoặc dữ liệu dẫn xuất, không chỉnh sửa trực tiếp." },
  workflow: { label: "Workflow nghiệp vụ", color: "violet", note: "Tạo/sửa/xóa tại tab Nghiệp vụ chính để bảo đảm giao dịch nhiều bảng." },
};

const IMPACT_COLORS: Record<MissionDataImpact, string> = {
  KPI: "cyan",
  CHART: "indigo",
  GIS: "teal",
  REPORT: "blue",
  AI: "violet",
  GOVERNANCE: "gray",
};

const COLUMN_LABELS: Record<string, string> = {
  id: "ID",
  asset_id: "Tài sản",
  code: "Mã",
  name: "Tên",
  status: "Trạng thái",
  created_at: "Ngày tạo",
  updated_at: "Ngày cập nhật",
  measured_at: "Thời điểm đo",
  occurred_at: "Thời điểm phát sinh",
  detected_at: "Thời điểm phát hiện",
  latitude: "Vĩ độ",
  longitude: "Kinh độ",
  metadata: "Metadata",
  geometry: "Hình học GIS",
  location: "Vị trí GIS",
};

function labelForColumn(name: string) {
  return COLUMN_LABELS[name] ?? name
    .replaceAll("_id", " ID")
    .split("_")
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(" ");
}

function displayValue(value: unknown) {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "object") return JSON.stringify(value);
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString("vi-VN");
  }
  return text;
}

function formValue(column: ColumnMeta, value: unknown) {
  if (value == null) return column.kind === "boolean" ? false : "";
  if (column.kind === "json" || column.kind === "array" || column.kind === "geometry") {
    return typeof value === "string" ? value : JSON.stringify(value, null, 2);
  }
  if (column.kind === "datetime") {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 16);
  }
  return value;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const payload = await response.json() as T & { message?: string; detail?: string };
  if (!response.ok) throw new Error(payload.message ?? payload.detail ?? "Không thể xử lý dữ liệu.");
  return payload;
}

function DynamicField({
  column,
  value,
  disabled,
  onChange,
}: {
  column: ColumnMeta;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
}) {
  const label = labelForColumn(column.name);
  const description = column.referencedTable
    ? `Tham chiếu ${column.referencedTable}.${column.referencedColumn}`
    : column.kind === "geometry"
      ? "Nhập GeoJSON hoặc WKT, ví dụ POINT(106.40 10.53). Hệ tọa độ mặc định EPSG:4326."
      : column.defaultValue
        ? `Mặc định DB: ${column.defaultValue}`
        : undefined;
  const required = !column.nullable && column.defaultValue == null && !column.generated;
  if (column.kind === "boolean") {
    return (
      <Switch
        label={label}
        description={description}
        checked={Boolean(value)}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    );
  }
  if (column.kind === "json" || column.kind === "array" || column.kind === "geometry") {
    return (
      <Textarea
        label={label}
        description={description}
        required={required}
        disabled={disabled}
        autosize
        minRows={column.kind === "geometry" ? 3 : 4}
        maxRows={12}
        styles={{ input: { fontFamily: "var(--font-mono), monospace", fontSize: 12 } }}
        value={String(value ?? "")}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    );
  }
  return (
    <TextInput
      label={label}
      description={description}
      required={required}
      disabled={disabled}
      type={column.kind === "datetime" ? "datetime-local" : column.kind === "number" ? "number" : "text"}
      step={column.kind === "number" ? "any" : undefined}
      styles={column.kind === "uuid" ? { input: { fontFamily: "var(--font-mono), monospace", fontSize: 12 } } : undefined}
      value={String(value ?? "")}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );
}

export function MissionDataCatalog({ taskId, initialTable }: { taskId: number; initialTable?: string }) {
  const [scope, setScope] = useState<MissionDataScope>("domain");
  const [resources, setResources] = useState<CatalogResource[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [payload, setPayload] = useState<ResourcePayload | null>(null);
  const [consistency, setConsistency] = useState<ConsistencyPayload | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [filterColumn, setFilterColumn] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState("");
  const [submittedFilterColumn, setSubmittedFilterColumn] = useState<string | null>(null);
  const [submittedFilterValue, setSubmittedFilterValue] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [drawerMode, setDrawerMode] = useState<"view" | "create" | "edit" | null>(null);
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [deleteRow, setDeleteRow] = useState<Record<string, unknown> | null>(null);
  const rowsRequestRef = useRef(0);

  const loadConsistency = useCallback(async () => {
    const result = await api<ConsistencyPayload>(`/api/management/mission-data?mission=${taskId}&view=consistency`);
    setConsistency(result);
  }, [taskId]);

  const loadCatalog = useCallback(async (nextScope = scope) => {
    setLoadingCatalog(true);
    try {
      const result = await api<{ resources: CatalogResource[] }>(`/api/management/mission-data?mission=${taskId}&scope=${nextScope}`);
      setResources(result.resources);
      setSelectedTable((current) => {
        if (result.resources.some((item) => item.table === current)) return current;
        const preferred = nextScope === "domain" ? initialTable ?? MISSION_PRIMARY_DATA_TABLE[taskId] : null;
        return result.resources.find((item) => item.table === preferred)?.table
          ?? result.resources[0]?.table
          ?? null;
      });
    } catch (error) {
      notifications.show({ color: "red", title: "Không thể tải catalog", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoadingCatalog(false);
    }
  }, [initialTable, scope, taskId]);

  const loadRows = useCallback(async (
    table = selectedTable,
    nextPage = page,
    nextSearch = submittedSearch,
    nextFilterColumn = submittedFilterColumn,
    nextFilterValue = submittedFilterValue,
  ) => {
    if (!table) return;
    const requestId = ++rowsRequestRef.current;
    setLoadingRows(true);
    try {
      const params = new URLSearchParams({ mission: String(taskId), resource: table, page: String(nextPage), pageSize: String(pageSize) });
      if (nextSearch) params.set("search", nextSearch);
      if (nextFilterColumn && nextFilterValue) {
        params.set("filterColumn", nextFilterColumn);
        params.set("filterValue", nextFilterValue);
      }
      const result = await api<ResourcePayload>(`/api/management/mission-data?${params.toString()}`);
      if (requestId === rowsRequestRef.current) setPayload(result);
    } catch (error) {
      if (requestId === rowsRequestRef.current) {
        setPayload(null);
        notifications.show({ color: "red", title: "Không thể tải bảng", message: error instanceof Error ? error.message : String(error) });
      }
    } finally {
      if (requestId === rowsRequestRef.current) setLoadingRows(false);
    }
  }, [page, pageSize, selectedTable, submittedFilterColumn, submittedFilterValue, submittedSearch, taskId]);

  useEffect(() => {
    void Promise.all([loadCatalog(scope), loadConsistency()]);
  }, [loadCatalog, loadConsistency, scope]);

  useEffect(() => {
    setPage(1);
    setSearch("");
    setSubmittedSearch("");
    setFilterColumn(null);
    setFilterValue("");
    setSubmittedFilterColumn(null);
    setSubmittedFilterValue("");
    setPayload(null);
    if (selectedTable) void loadRows(selectedTable, 1, "");
  }, [selectedTable]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedResource = resources.find((item) => item.table === selectedTable) ?? payload?.resource ?? null;
  const visibleColumns = useMemo(() => {
    if (!payload) return [];
    const priority = ["code", "name", "status", "period", "measured_at", "created_at"];
    return [...payload.columns]
      .sort((left, right) => {
        const leftIndex = left.primaryKey ? -10 : priority.indexOf(left.name);
        const rightIndex = right.primaryKey ? -10 : priority.indexOf(right.name);
        return (leftIndex < 0 ? 50 : leftIndex) - (rightIndex < 0 ? 50 : rightIndex);
      })
      .filter((column) => column.kind !== "json" && column.kind !== "geometry")
      .slice(0, 8);
  }, [payload]);

  const resourceOptions = useMemo(() => {
    const groups = new Map<string, CatalogResource[]>();
    for (const item of resources) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
    return [...groups.entries()].map(([group, items]) => ({
      group,
      items: items.map((item) => ({ value: item.table, label: `${item.label} · ${item.rowCount.toLocaleString("vi-VN")}` })),
    }));
  }, [resources]);

  function openDashboardSource(source: ConsistencyPayload["dashboardSources"][number]) {
    setScope(source.scope);
    setSelectedTable(source.table);
    setPage(1);
    window.setTimeout(() => {
      document.getElementById("mission-data-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function applyFilters() {
    const nextSearch = search.trim();
    const nextFilterValue = filterValue.trim();
    setPage(1);
    setSubmittedSearch(nextSearch);
    setSubmittedFilterColumn(filterColumn);
    setSubmittedFilterValue(nextFilterValue);
    void loadRows(selectedTable, 1, nextSearch, filterColumn, nextFilterValue);
  }

  function rowKeys(row: Record<string, unknown>) {
    return Object.fromEntries((payload?.primaryKeys ?? []).map((key) => [key, row[key]]));
  }

  function openDrawer(mode: "view" | "create" | "edit", row?: Record<string, unknown>) {
    const next: Record<string, unknown> = {};
    for (const column of payload?.columns ?? []) {
      if (mode === "create") {
        if (!column.generated && !(column.primaryKey && column.defaultValue)) next[column.name] = column.kind === "boolean" ? false : "";
      } else {
        next[column.name] = formValue(column, row?.[column.name]);
      }
    }
    setEditingRow(row ?? null);
    setForm(next);
    setDrawerMode(mode);
  }

  async function refreshAll() {
    await Promise.all([loadRows(selectedTable, page, submittedSearch), loadCatalog(scope), loadConsistency()]);
  }

  async function save() {
    if (!selectedTable || !drawerMode || drawerMode === "view") return;
    setSaving(true);
    try {
      const url = `/api/management/mission-data?mission=${taskId}&resource=${encodeURIComponent(selectedTable)}`;
      const method = drawerMode === "create" ? "POST" : "PATCH";
      await api(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ values: form, ...(editingRow ? { keys: rowKeys(editingRow) } : {}) }),
      });
      notifications.show({ color: "green", title: "Đã lưu dữ liệu", message: "Catalog, thống kê và GIS sẽ đọc lại cùng dữ liệu hệ thống GIS." });
      setDrawerMode(null);
      await refreshAll();
    } catch (error) {
      notifications.show({ color: "red", title: "Không thể lưu", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!selectedTable || !deleteRow) return;
    setSaving(true);
    try {
      await api(`/api/management/mission-data?mission=${taskId}&resource=${encodeURIComponent(selectedTable)}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keys: rowKeys(deleteRow) }),
      });
      notifications.show({ color: "green", title: "Đã xóa bản ghi", message: "Bản ghi kiểm tra khóa ngoại trước khi xóa." });
      setDeleteRow(null);
      await refreshAll();
    } catch (error) {
      notifications.show({ color: "red", title: "Không thể xóa", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  }

  const totalPages = payload ? Math.max(1, Math.ceil(payload.pagination.total / payload.pagination.pageSize)) : 1;
  const access = selectedResource ? ACCESS_META[selectedResource.access] : null;

  return (
    <Stack gap="lg">
      {consistency ? (
        <Paper radius="xl" p="lg" withBorder className="energy-glass">
          <Group justify="space-between" align="flex-start" mb="md">
            <div>
              <Group gap="xs">
                <ThemeIcon variant="light" color={consistency.gisMissingCount ? "orange" : "green"} radius="xl">
                  {consistency.gisMissingCount ? <IconAlertTriangle size={18} /> : <IconCheck size={18} />}
                </ThemeIcon>
                <Title order={3}>Đối soát thống kê ↔ GIS</Title>
              </Group>
              <Text size="sm" c="dimmed" mt={4}>{consistency.label}</Text>
            </div>
            <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => void refreshAll()} loading={loadingRows || loadingCatalog}>
              Kiểm tra lại
            </Button>
          </Group>
          <SimpleGrid cols={{ base: 2, md: 4 }}>
            <div><Text size="xs" c="dimmed" fw={800}>Bản ghi hoạt động</Text><Text fz={28} fw={900}>{consistency.tableCount.toLocaleString("vi-VN")}</Text></div>
            <div><Text size="xs" c="dimmed" fw={800}>Được thống kê</Text><Text fz={28} fw={900} c="cyan">{consistency.statisticsCount.toLocaleString("vi-VN")}</Text></div>
            <div><Text size="xs" c="dimmed" fw={800}>Có tọa độ GIS</Text><Text fz={28} fw={900} c="teal">{consistency.gisLocatedCount.toLocaleString("vi-VN")}</Text></div>
            <div><Text size="xs" c="dimmed" fw={800}>Thiếu vị trí</Text><Text fz={28} fw={900} c={consistency.gisMissingCount ? "orange" : "green"}>{consistency.gisMissingCount.toLocaleString("vi-VN")}</Text></div>
          </SimpleGrid>
          <Progress value={consistency.gisCoveragePct} color={consistency.gisCoveragePct >= 99.9 ? "teal" : "orange"} size="lg" radius="xl" mt="md" />
          <Group justify="space-between" mt={6}>
            <Text size="xs" c="dimmed">Độ phủ tọa độ: {consistency.gisCoveragePct.toLocaleString("vi-VN")}% · {consistency.mappedTables} bảng chuyên ngành đã ánh xạ</Text>
            {consistency.dashboardMarkerLimit ? <Text size="xs" c="dimmed">Bản đồ ưu tiên {consistency.dashboardMarkerLimit} bản ghi mới nhất để bảo đảm hiệu năng</Text> : null}
          </Group>
          <Stack gap={7} mt="md">
            <Group gap="xs">
              <Text size="xs" fw={900} tt="uppercase" c="dimmed">Bảng đang cấp số liệu cho dashboard</Text>
              <Badge size="xs" variant="light">{consistency.dashboardSources.length} nguồn</Badge>
            </Group>
            <Group gap="xs">
              {consistency.dashboardSources.map((source) => (
                <Button
                  key={source.table}
                  size="xs"
                  variant={selectedTable === source.table ? "filled" : "light"}
                  color={source.available ? "blue" : "red"}
                  leftSection={<IconDatabase size={14} />}
                  onClick={() => openDashboardSource(source)}
                >
                  {source.label} · {source.rowCount.toLocaleString("vi-VN")} dòng
                </Button>
              ))}
            </Group>
            <Text size="xs" c="dimmed">Chọn một nguồn để mở ngay các bản ghi tạo nên KPI, biểu đồ và số liệu thống kê tương ứng.</Text>
          </Stack>
          {consistency.missingLocationSample.length ? (
            <Alert color="orange" mt="md" title="Bản ghi chưa thể hiển thị trên GIS">
              {consistency.missingLocationSample.map((item) => `${item.code ?? item.id} · ${item.name ?? "Chưa có tên"}`).join("; ")}
            </Alert>
          ) : null}
        </Paper>
      ) : null}

      <Paper radius="xl" p="lg" withBorder className="energy-glass">
        <Group justify="space-between" align="flex-start" mb="md">
          <div>
            <Title order={3}>Catalog quản trị đầy đủ</Title>
            <Text size="sm" c="dimmed" mt={4}>Bao phủ bảng chuyên ngành, dữ liệu nền dùng chung và lịch sử AI; quyền sửa tuân theo tính chất từng bảng.</Text>
          </div>
          <Badge size="lg" variant="light" leftSection={<IconDatabase size={14} />}>{resources.length} bảng trong nhóm</Badge>
        </Group>
        <Tabs value={scope} onChange={(value) => setScope((value as MissionDataScope | null) ?? "domain")}>
          <Tabs.List mb="md">
            <Tabs.Tab value="domain">Dữ liệu chuyên ngành</Tabs.Tab>
            <Tabs.Tab value="shared">Dữ liệu nền dùng chung</Tabs.Tab>
            <Tabs.Tab value="ai">Lịch sử và đánh giá AI</Tabs.Tab>
          </Tabs.List>
        </Tabs>
        {loadingCatalog ? <Group justify="center" py="xl"><Loader size="sm" /><Text size="sm">Đang kiểm kê bảng…</Text></Group> : (
          <Select searchable label="Chọn bảng dữ liệu" data={resourceOptions} value={selectedTable} onChange={setSelectedTable} />
        )}
      </Paper>

      {selectedResource ? (
        <Paper id="mission-data-table" radius="xl" p="lg" withBorder className="energy-glass">
          <Group justify="space-between" align="flex-start" mb="md">
            <div>
              <Group gap="xs">
                <Title order={3}>{selectedResource.label}</Title>
                <Badge color={access?.color} variant="light">{access?.label}</Badge>
                {!selectedResource.available ? <Badge color="red">Chưa có bảng dữ liệu</Badge> : null}
              </Group>
              <Text size="xs" ff="monospace" c="dimmed" mt={4}>{selectedResource.table}</Text>
              <Text size="sm" c="dimmed" mt={5}>{selectedResource.description ?? access?.note}</Text>
              <Group gap={6} mt="xs">{selectedResource.impacts.map((impact) => <Badge key={impact} size="xs" color={IMPACT_COLORS[impact]} variant="dot">{impact}</Badge>)}</Group>
            </div>
            <Group gap="xs">
              <Badge size="lg" variant="outline">{(payload?.pagination.total ?? selectedResource.rowCount).toLocaleString("vi-VN")} dòng</Badge>
              {selectedResource.permissions.create ? <Button leftSection={<IconPlus size={16} />} onClick={() => openDrawer("create")}>Thêm bản ghi</Button> : null}
            </Group>
          </Group>

          <Group mb="md" align="end" gap="xs" wrap="wrap">
            <TextInput
              label="Tìm trong bảng"
              placeholder="Mã, tên, trạng thái, UUID…"
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              onKeyDown={(event) => { if (event.key === "Enter") applyFilters(); }}
              className="min-w-[240px] flex-1"
            />
            <Select
              label="Lọc theo cột"
              placeholder="Chọn cột"
              clearable
              searchable
              data={visibleColumns.map((column) => ({ value: column.name, label: labelForColumn(column.name) }))}
              value={filterColumn}
              onChange={setFilterColumn}
              className="min-w-[180px]"
            />
            <TextInput
              label="Giá trị lọc"
              placeholder="Nhập giá trị"
              value={filterValue}
              onChange={(event) => setFilterValue(event.currentTarget.value)}
              onKeyDown={(event) => { if (event.key === "Enter") applyFilters(); }}
              className="min-w-[180px]"
            />
            <Button variant="light" onClick={applyFilters}>Lọc</Button>
            <Button variant="subtle" leftSection={<IconRefresh size={16} />} onClick={() => void loadRows()} loading={loadingRows}>Làm mới</Button>
          </Group>

          {loadingRows && !payload ? <Group justify="center" py={60}><Loader /><Text>Đang đọc PostgreSQL…</Text></Group> : null}
          {payload ? (
            <>
              <ScrollArea type="auto">
                <Table striped highlightOnHover withTableBorder withColumnBorders miw={900}>
                  <Table.Thead><Table.Tr>{visibleColumns.map((column) => <Table.Th key={column.name}>{labelForColumn(column.name)}</Table.Th>)}<Table.Th w={132}>Thao tác</Table.Th></Table.Tr></Table.Thead>
                  <Table.Tbody>
                    {payload.items.map((row, index) => (
                      <Table.Tr key={payload.primaryKeys.map((key) => String(row[key])).join(":") || index}>
                        {visibleColumns.map((column) => <Table.Td key={column.name} maw={260}><Text size="sm" truncate="end" ff={column.kind === "uuid" ? "monospace" : undefined}>{displayValue(row[column.name])}</Text></Table.Td>)}
                        <Table.Td>
                          <Group gap={4} wrap="nowrap">
                            <Button size="compact-xs" variant="subtle" aria-label="Xem" onClick={() => openDrawer("view", row)}><IconEye size={15} /></Button>
                            {selectedResource.permissions.update ? <Button size="compact-xs" variant="subtle" color="blue" aria-label="Sửa" onClick={() => openDrawer("edit", row)}><IconEdit size={15} /></Button> : null}
                            {selectedResource.permissions.delete ? <Button size="compact-xs" variant="subtle" color="red" aria-label="Xóa" onClick={() => setDeleteRow(row)}><IconTrash size={15} /></Button> : null}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                    {!payload.items.length ? <Table.Tr><Table.Td colSpan={visibleColumns.length + 1}><Text ta="center" c="dimmed" py="xl">Chưa có bản ghi phù hợp.</Text></Table.Td></Table.Tr> : null}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
              <Group justify="space-between" mt="md">
                <Text size="xs" c="dimmed">Trang {payload.pagination.page}/{totalPages} · {payload.pagination.total.toLocaleString("vi-VN")} bản ghi</Text>
                <Pagination value={page} total={totalPages} onChange={(next) => { setPage(next); void loadRows(selectedTable, next, submittedSearch); }} size="sm" />
              </Group>
            </>
          ) : null}
        </Paper>
      ) : null}

      <Drawer
        opened={drawerMode != null}
        onClose={() => setDrawerMode(null)}
        title={drawerMode === "create" ? `Thêm ${selectedResource?.label ?? "bản ghi"}` : drawerMode === "edit" ? `Sửa ${selectedResource?.label ?? "bản ghi"}` : `Chi tiết ${selectedResource?.label ?? "bản ghi"}`}
        position="right"
        size="xl"
      >
        <Stack>
          {payload?.columns.map((column) => {
            if (drawerMode === "create" && column.generated) return null;
            const disabled = drawerMode === "view" || (drawerMode === "edit" && column.primaryKey) || ["created_at", "updated_at"].includes(column.name);
            return <DynamicField key={column.name} column={column} value={form[column.name]} disabled={disabled} onChange={(value) => setForm((current) => ({ ...current, [column.name]: value }))} />;
          })}
          {drawerMode !== "view" ? <Group justify="flex-end" mt="md"><Button variant="default" onClick={() => setDrawerMode(null)}>Hủy</Button><Button onClick={() => void save()} loading={saving}>Lưu dữ liệu</Button></Group> : null}
        </Stack>
      </Drawer>

      <Modal opened={deleteRow != null} onClose={() => setDeleteRow(null)} title="Xác nhận xóa bản ghi" centered>
        <Stack>
          <Alert color="red" title="Kiểm tra quan hệ dữ liệu">
            Xóa cứng chỉ áp dụng cho bảng có quyền CRUD đầy đủ. Nếu bản ghi đang được tham chiếu, PostgreSQL sẽ từ chối và giữ nguyên dữ liệu.
          </Alert>
          <Text size="sm">Bạn có chắc muốn xóa bản ghi khỏi <strong>{selectedResource?.label}</strong>?</Text>
          <Group justify="flex-end"><Button variant="default" onClick={() => setDeleteRow(null)}>Hủy</Button><Button color="red" onClick={() => void remove()} loading={saving}>Xóa bản ghi</Button></Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
