"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Badge,
  Button,
  Drawer,
  Group,
  NumberInput,
  Paper,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconActivity, IconArchive, IconEdit, IconEye, IconPlus } from "@tabler/icons-react";
import type { DataTableColumn } from "mantine-datatable";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { CrudDataTable, DataTableAction, DataTableActions } from "@/components/data/CrudDataTable";
import { FormValidationAlert } from "@/components/forms/FormValidationAlert";

type Party = { id: string; code: string; name: string; partyType: string; status: string };
type GridAsset = { id: string; code: string; name: string; assetType: string; status: string };
type AdminArea = {
  id: string;
  code: string;
  name: string;
  level: string;
  parentCode: string | null;
};
type Station = {
  assetId: string;
  code: string;
  name: string;
  operatorPartyId: string | null;
  operatorName: string | null;
  siteName: string | null;
  address: string | null;
  adminAreaCode: string | null;
  latitude: number | null;
  longitude: number | null;
  totalPowerKw: number;
  installedPowerKw: number;
  connectionCapacityKw: number | null;
  actualPeakPowerKw: number | null;
  connectorCount: number;
  availableCount: number;
  occupiedCount: number;
  faultedCount: number;
  utilizationPct: number;
  gridAssetId: string | null;
  operationStatus: string;
  applicationId: string | null;
};
type Snapshot = {
  id: string;
  stationAssetId: string;
  stationName: string;
  measuredAt: string;
  availableCount: number;
  occupiedCount: number;
  faultedCount: number;
  utilizationPct: number;
  energyDeliveredKwh: number | null;
  peakPowerKw: number | null;
  source: string;
};

const stationSchema = z
  .object({
    code: z.string().trim().min(2),
    name: z.string().trim().min(2),
    operatorPartyId: z.string().uuid(),
    siteCode: z.string().trim().min(2),
    siteName: z.string().trim().min(2),
    address: z.string().trim().min(2),
    adminAreaCode: z.string().min(1, "Chọn khu vực hành chính"),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    totalPowerKw: z.number().positive(),
    connectorCount: z.number().int().positive(),
    connectorTypes: z.string().trim().min(1),
    connectorPowerKw: z.number().positive(),
    gridAssetId: z.string(),
    operationStatus: z.enum(["ACTIVE", "MAINTENANCE", "OFFLINE", "PLANNED", "DECOMMISSIONED"]),
  })
  .superRefine((value, context) => {
    if (value.latitude == null)
      context.addIssue({ code: "custom", path: ["latitude"], message: "Nhập vĩ độ vị trí trạm." });
    if (value.longitude == null)
      context.addIssue({
        code: "custom",
        path: ["longitude"],
        message: "Nhập kinh độ vị trí trạm.",
      });
    if (value.connectorPowerKw * value.connectorCount > value.totalPowerKw * 1.25) {
      context.addIssue({
        code: "custom",
        path: ["connectorPowerKw"],
        message: "Tổng công suất connector vượt 125% công suất trạm; hãy kiểm tra số liệu.",
      });
    }
  });
const snapshotSchema = z.object({
  stationAssetId: z.string().uuid(),
  measuredAt: z.string().min(1),
  availableCount: z.number().int().min(0),
  occupiedCount: z.number().int().min(0),
  faultedCount: z.number().int().min(0),
  utilizationPct: z.number().min(0).max(100),
  energyDeliveredKwh: z.number().min(0).nullable(),
  peakPowerKw: z.number().min(0).nullable(),
  source: z.string().trim().min(2),
});
const stationPatchSchema = z.object({
  name: z.string().trim().min(2),
  operationStatus: z.enum(["ACTIVE", "MAINTENANCE", "OFFLINE", "PLANNED", "DECOMMISSIONED"]),
  installedPowerKw: z.number().positive(),
  connectionCapacityKw: z.number().positive().nullable(),
  actualPeakPowerKw: z.number().min(0).nullable(),
});
type StationForm = z.infer<typeof stationSchema>;
type SnapshotForm = z.infer<typeof snapshotSchema>;
type StationPatchForm = z.infer<typeof stationPatchSchema>;

function statusColor(value: string) {
  return value === "ACTIVE"
    ? "green"
    : value === "MAINTENANCE"
      ? "yellow"
      : value === "OFFLINE"
        ? "red"
        : value === "PLANNED"
          ? "blue"
          : "gray";
}
function fmtDate(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(d);
}

export function EvStationsWorkspace() {
  const [stations, setStations] = useState<Station[]>([]);
  const [stationChoices, setStationChoices] = useState<Station[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [gridAssets, setGridAssets] = useState<GridAsset[]>([]);
  const [adminAreas, setAdminAreas] = useState<AdminArea[]>([]);
  const [opened, setOpened] = useState<"station" | "snapshot" | "editStation" | null>(null);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [snapshotPage, setSnapshotPage] = useState(1);
  const [snapshotPageSize, setSnapshotPageSize] = useState(25);
  const [snapshotTotal, setSnapshotTotal] = useState(0);
  const stationForm = useForm<StationForm>({
    resolver: zodResolver(stationSchema),
    defaultValues: {
      code: "",
      name: "",
      operatorPartyId: "",
      siteCode: "",
      siteName: "",
      address: "",
      adminAreaCode: "",
      latitude: 11.3,
      longitude: 106.1,
      totalPowerKw: 120,
      connectorCount: 2,
      connectorTypes: "CCS2",
      connectorPowerKw: 60,
      gridAssetId: "",
      operationStatus: "ACTIVE",
    },
  });
  const snapshotForm = useForm<SnapshotForm>({
    resolver: zodResolver(snapshotSchema),
    defaultValues: {
      stationAssetId: "",
      measuredAt: new Date().toISOString().slice(0, 16),
      availableCount: 0,
      occupiedCount: 0,
      faultedCount: 0,
      utilizationPct: 0,
      energyDeliveredKwh: null,
      peakPowerKw: null,
      source: "MANUAL",
    },
  });
  const stationPatchForm = useForm<StationPatchForm>({
    resolver: zodResolver(stationPatchSchema),
    defaultValues: {
      name: "",
      operationStatus: "ACTIVE",
      installedPowerKw: 1,
      connectionCapacityKw: null,
      actualPeakPowerKw: null,
    },
    mode: "onBlur",
  });
  async function reload(
    nextPage = page,
    nextPageSize = pageSize,
    nextSnapshotPage = snapshotPage,
    nextSnapshotPageSize = snapshotPageSize,
  ) {
    setLoading(true);
    try {
      const [stationRes, snapRes, partyRes, gridRes, areaRes, stationChoiceRes] = await Promise.all(
        [
          fetch(`/api/ev/stations?page=${nextPage}&pageSize=${nextPageSize}`, {
            cache: "no-store",
          }),
          fetch(
            `/api/ev/stations/snapshots?page=${nextSnapshotPage}&pageSize=${nextSnapshotPageSize}`,
            { cache: "no-store" },
          ),
          fetch("/api/core/parties", { cache: "no-store" }),
          fetch("/api/grid/assets/options?types=SUBSTATION,FEEDER", { cache: "no-store" }),
          fetch("/api/core/admin-areas", { cache: "no-store" }),
          fetch("/api/ev/stations?options=true", { cache: "no-store" }),
        ],
      );
      if (stationRes.ok) {
        const data = (await stationRes.json()) as {
          items: Station[];
          pagination?: { page?: number; pageSize?: number; total?: number };
        };
        setStations(data.items ?? []);
        setTotal(data.pagination?.total ?? 0);
        if (data.pagination?.page) setPage(data.pagination.page);
        if (data.pagination?.pageSize) setPageSize(data.pagination.pageSize);
      }
      if (snapRes.ok) {
        const data = (await snapRes.json()) as {
          items: Snapshot[];
          pagination?: { page?: number; pageSize?: number; total?: number };
        };
        setSnapshots(data.items ?? []);
        setSnapshotTotal(data.pagination?.total ?? 0);
        if (data.pagination?.page) setSnapshotPage(data.pagination.page);
        if (data.pagination?.pageSize) setSnapshotPageSize(data.pagination.pageSize);
      }
      if (stationChoiceRes.ok)
        setStationChoices(((await stationChoiceRes.json()) as { items: Station[] }).items ?? []);
      if (partyRes.ok) setParties(((await partyRes.json()) as { items: Party[] }).items ?? []);
      if (gridRes.ok) setGridAssets(((await gridRes.json()) as { items: GridAsset[] }).items ?? []);
      if (areaRes.ok) setAdminAreas(((await areaRes.json()) as { items: AdminArea[] }).items ?? []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => window.clearTimeout(timer);
    // The initial load intentionally runs once; pagination handlers reload explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function post(url: string, body: unknown) {
    setSaving(true);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Không thể lưu dữ liệu.");
      notifications.show({
        title: "Đã lưu",
        message: "Dữ liệu trạm sạc đã được cập nhật.",
        color: "green",
      });
      setOpened(null);
      await reload();
    } catch (error) {
      notifications.show({
        title: "Không thể lưu",
        message: error instanceof Error ? error.message : "Lỗi không xác định",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  }
  async function patchStation(value: StationPatchForm) {
    if (!editingStation) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/ev/stations/${editingStation.assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Không thể cập nhật station.");
      notifications.show({
        title: "Đã cập nhật station",
        message: "Công suất vận hành và trạng thái đã được lưu.",
        color: "green",
      });
      setOpened(null);
      setEditingStation(null);
      await reload();
    } catch (error) {
      notifications.show({
        title: "Cập nhật thất bại",
        message: error instanceof Error ? error.message : "Lỗi không xác định",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  }
  async function archiveStation(station: Station) {
    if (
      !window.confirm(`Chuyển ${station.code} sang DECOMMISSIONED? Session/snapshot vẫn được giữ.`)
    )
      return;
    try {
      const response = await fetch(`/api/ev/stations/${station.assetId}`, { method: "DELETE" });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Không thể archive station.");
      notifications.show({
        title: "Đã archive station",
        message: data.message ?? station.code,
        color: "green",
      });
      await reload();
    } catch (error) {
      notifications.show({
        title: "Archive thất bại",
        message: error instanceof Error ? " " + error.message : "Lỗi không xác định",
        color: "red",
      });
    }
  }
  function openStationEdit(station: Station) {
    setEditingStation(station);
    stationPatchForm.reset({
      name: station.name,
      operationStatus: station.operationStatus as StationPatchForm["operationStatus"],
      installedPowerKw: station.installedPowerKw,
      connectionCapacityKw: station.connectionCapacityKw,
      actualPeakPowerKw: station.actualPeakPowerKw,
    });
    setOpened("editStation");
  }
  const totalPower = useMemo(
    () => stations.reduce((sum, s) => sum + s.totalPowerKw, 0),
    [stations],
  );
  const totalConnectors = useMemo(
    () => stations.reduce((sum, s) => sum + s.connectorCount, 0),
    [stations],
  );
  const available = useMemo(
    () => stations.reduce((sum, s) => sum + s.availableCount, 0),
    [stations],
  );
  const avgUtil = stations.length
    ? stations.reduce((sum, s) => sum + s.utilizationPct, 0) / stations.length
    : 0;
  const gridMap = new Map(gridAssets.map((a) => [a.id, a]));
  const areaMap = new Map(adminAreas.map((a) => [a.code, a.name]));
  const partyOptions = parties.map((p) => ({ value: p.id, label: `${p.name} • ${p.code}` }));
  const gridOptions = gridAssets.map((a) => ({ value: a.id, label: `${a.name} • ${a.code}` }));
  const stationOptions = stationChoices.map((s) => ({
    value: s.assetId,
    label: `${s.name} • ${s.code}`,
  }));
  const areaOptions = adminAreas.map((a) => ({ value: a.code, label: `${a.name} • ${a.level}` }));

  const stationColumns: DataTableColumn<Station>[] = [
    {
      accessor: "actions",
      title: "Thao tác",
      width: 92,
      render: (station) => (
        <DataTableActions>
          <DataTableAction
            label="Sửa trạm"
            icon={<IconEdit size={16} />}
            color="blue"
            onClick={() => openStationEdit(station)}
          />
          <DataTableAction
            label="Archive trạm"
            icon={<IconArchive size={16} />}
            color="orange"
            onClick={() => void archiveStation(station)}
          />
        </DataTableActions>
      ),
    },
    {
      accessor: "name",
      title: "Trạm",
      width: 240,
      render: (station) => (
        <>
          <Text fw={900}>{station.name}</Text>
          <Text size="xs" c="dimmed">
            {station.code}
          </Text>
        </>
      ),
    },
    {
      accessor: "operatorName",
      title: "Operator / khu vực",
      width: 250,
      render: (station) => (
        <>
          <Text size="sm" fw={700}>
            {station.operatorName ?? "—"}
          </Text>
          <Text size="xs" c="dimmed">
            {station.adminAreaCode
              ? (areaMap.get(station.adminAreaCode) ?? station.adminAreaCode)
              : (station.siteName ?? "Chưa phân loại")}
          </Text>
        </>
      ),
    },
    {
      accessor: "totalPowerKw",
      title: "Công suất",
      width: 150,
      render: (station) => (
        <>
          <Text>{station.totalPowerKw.toLocaleString("vi-VN")} kW</Text>
          <Text size="xs" c="dimmed">
            Installed {station.installedPowerKw.toLocaleString("vi-VN")} kW
          </Text>
        </>
      ),
    },
    {
      accessor: "connectorCount",
      title: "Connector",
      width: 105,
      render: (station) => station.connectorCount,
    },
    {
      accessor: "availableCount",
      title: "Trống / sạc / lỗi",
      width: 150,
      render: (station) =>
        `${station.availableCount} / ${station.occupiedCount} / ${station.faultedCount}`,
    },
    {
      accessor: "utilizationPct",
      title: "Utilization",
      width: 190,
      render: (station) => (
        <Group gap="xs" wrap="nowrap">
          <Progress
            value={station.utilizationPct}
            color={
              station.utilizationPct >= 85
                ? "red"
                : station.utilizationPct >= 65
                  ? "yellow"
                  : "green"
            }
            flex={1}
          />
          <Text size="xs" fw={800}>
            {station.utilizationPct.toFixed(1)}%
          </Text>
        </Group>
      ),
    },
    {
      accessor: "gridAssetId",
      title: "Điểm cấp điện",
      width: 180,
      render: (station) =>
        station.gridAssetId ? (gridMap.get(station.gridAssetId)?.name ?? station.gridAssetId) : "—",
    },
    {
      accessor: "operationStatus",
      title: "Trạng thái",
      width: 140,
      render: (station) => (
        <Badge color={statusColor(station.operationStatus)}>{station.operationStatus}</Badge>
      ),
    },
  ];

  const snapshotColumns: DataTableColumn<Snapshot>[] = [
    {
      accessor: "actions",
      title: "Thao tác",
      width: 72,
      render: (snapshot) => (
        <DataTableActions>
          <DataTableAction
            label="Xem snapshot"
            icon={<IconEye size={16} />}
            color="blue"
            onClick={() =>
              notifications.show({
                title: snapshot.stationName,
                message: `${fmtDate(snapshot.measuredAt)} · ${snapshot.availableCount} available / ${snapshot.occupiedCount} occupied / ${snapshot.faultedCount} faulted`,
                color: "blue",
              })
            }
          />
        </DataTableActions>
      ),
    },
    {
      accessor: "stationName",
      title: "Trạm",
      width: 240,
      render: (snapshot) => (
        <>
          <Text fw={800}>{snapshot.stationName}</Text>
          <Text size="xs" c="dimmed">
            {snapshot.source}
          </Text>
        </>
      ),
    },
    {
      accessor: "measuredAt",
      title: "Thời điểm",
      width: 180,
      render: (snapshot) => fmtDate(snapshot.measuredAt),
    },
    {
      accessor: "availableCount",
      title: "Available",
      width: 110,
      render: (snapshot) => snapshot.availableCount,
    },
    {
      accessor: "occupiedCount",
      title: "Occupied",
      width: 110,
      render: (snapshot) => snapshot.occupiedCount,
    },
    {
      accessor: "faultedCount",
      title: "Faulted",
      width: 100,
      render: (snapshot) => snapshot.faultedCount,
    },
    {
      accessor: "utilizationPct",
      title: "Utilization",
      width: 130,
      render: (snapshot) => `${snapshot.utilizationPct.toFixed(1)}%`,
    },
    {
      accessor: "energyDeliveredKwh",
      title: "Energy",
      width: 150,
      render: (snapshot) =>
        snapshot.energyDeliveredKwh == null
          ? "—"
          : `${snapshot.energyDeliveredKwh.toLocaleString("vi-VN")} kWh`,
    },
    {
      accessor: "peakPowerKw",
      title: "Peak",
      width: 140,
      render: (snapshot) =>
        snapshot.peakPowerKw == null ? "—" : `${snapshot.peakPowerKw.toLocaleString("vi-VN")} kW`,
    },
  ];
  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        {[
          ["Trạm sạc", stations.length, "blue"],
          ["Connector", totalConnectors, "cyan"],
          ["Đang trống", available, "green"],
          [
            "Công suất lắp đặt",
            `${(totalPower / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} MW`,
            "violet",
          ],
        ].map(([label, value, c]) => (
          <Paper key={String(label)} radius="xl" p="md" withBorder className="energy-glass">
            <Text size="xs" c="dimmed" fw={800}>
              {label}
            </Text>
            <Text fz={28} fw={900} c={String(c)}>
              {String(value)}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>
      <Paper radius="xl" p="lg" withBorder className="energy-glass">
        <Group justify="space-between" mb="md">
          <div>
            <Title order={3}>Station Registry & vận hành</Title>
            <Text size="sm" c="dimmed">
              Quản lý trạm hiện hữu, khu vực hành chính, connector, công suất, TBA/feeder liên quan
              và snapshot availability/utilization. Utilization bình quân hiện tại{" "}
              {avgUtil.toFixed(1)}%.
            </Text>
          </div>
          <Group gap="xs">
            <Button
              variant="light"
              onClick={() => setOpened("snapshot")}
              leftSection={<IconActivity size={16} />}
            >
              Ghi snapshot
            </Button>
            <Button onClick={() => setOpened("station")} leftSection={<IconPlus size={16} />}>
              Thêm trạm hiện hữu
            </Button>
          </Group>
        </Group>
        <CrudDataTable
          records={stations}
          filterPlaceholder="Mã, tên trạm hoặc địa bàn..."
          filters={[
            { key: "operationStatus", label: "Trạng thái vận hành", options: ["ACTIVE", "MAINTENANCE", "OFFLINE", "PLANNED", "DECOMMISSIONED"].map((value) => ({ value, label: value })) },
            { key: "adminAreaCode", label: "Địa bàn", options: adminAreas.map((area) => ({ value: area.code, label: area.name })) },
          ]}
          columns={stationColumns}
          idAccessor="assetId"
          page={page}
          totalRecords={total}
          recordsPerPage={pageSize}
          onPageChange={(nextPage) => {
            setPage(nextPage);
            void reload(nextPage, pageSize, snapshotPage, snapshotPageSize);
          }}
          onRecordsPerPageChange={(nextSize) => {
            setPage(1);
            setPageSize(nextSize);
            void reload(1, nextSize, snapshotPage, snapshotPageSize);
          }}
          fetching={loading || saving}
          rowExpansion={{
            allowMultiple: true,
            content: ({ record }) => (
              <SimpleGrid cols={{ base: 1, sm: 3 }} p="sm">
                <div>
                  <Text size="xs" c="dimmed" fw={800}>
                    Site / địa chỉ
                  </Text>
                  <Text size="sm">{record.siteName ?? "—"}</Text>
                  <Text size="xs" c="dimmed">
                    {record.address ?? "—"} · {record.adminAreaCode ?? "—"}
                  </Text>
                  <Text size="xs" c="dimmed">
                    GIS:{" "}
                    {record.latitude == null || record.longitude == null
                      ? "Chưa có tọa độ"
                      : `${record.latitude.toFixed(6)}, ${record.longitude.toFixed(6)}`}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed" fw={800}>
                    Công suất vận hành
                  </Text>
                  <Text size="sm">
                    Connection{" "}
                    {record.connectionCapacityKw == null
                      ? "—"
                      : record.connectionCapacityKw + " kW"}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Peak {record.actualPeakPowerKw == null ? "—" : record.actualPeakPowerKw + " kW"}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed" fw={800}>
                    Liên kết
                  </Text>
                  <Text size="sm">
                    {record.gridAssetId
                      ? (gridMap.get(record.gridAssetId)?.code ?? record.gridAssetId)
                      : "Chưa có grid asset"}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Application: {record.applicationId ?? "—"}
                  </Text>
                </div>
              </SimpleGrid>
            ),
          }}
          emptyState={
            <Text c="dimmed" ta="center" py="xl">
              Chưa có trạm sạc.
            </Text>
          }
        />
      </Paper>
      <Paper radius="xl" p="lg" withBorder className="energy-glass">
        <Title order={3} mb="md">
          Snapshot vận hành gần nhất
        </Title>
        <CrudDataTable
          records={snapshots}
          columns={snapshotColumns}
          idAccessor="id"
          page={snapshotPage}
          totalRecords={snapshotTotal}
          recordsPerPage={snapshotPageSize}
          onPageChange={(nextSnapshotPage) => {
            setSnapshotPage(nextSnapshotPage);
            void reload(page, pageSize, nextSnapshotPage, snapshotPageSize);
          }}
          onRecordsPerPageChange={(nextSize) => {
            setSnapshotPage(1);
            setSnapshotPageSize(nextSize);
            void reload(page, pageSize, 1, nextSize);
          }}
          fetching={loading || saving}
          rowExpansion={{
            allowMultiple: true,
            content: ({ record }) => (
              <SimpleGrid cols={{ base: 1, sm: 3 }} p="sm">
                <div>
                  <Text size="xs" c="dimmed" fw={800}>
                    Trạng thái connector
                  </Text>
                  <Text size="sm">
                    {record.availableCount} available · {record.occupiedCount} occupied ·{" "}
                    {record.faultedCount} faulted
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed" fw={800}>
                    Sản lượng / peak
                  </Text>
                  <Text size="sm">
                    {record.energyDeliveredKwh == null ? "—" : record.energyDeliveredKwh + " kWh"} ·{" "}
                    {record.peakPowerKw == null ? "—" : record.peakPowerKw + " kW"}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed" fw={800}>
                    Nguồn
                  </Text>
                  <Text size="sm">{record.source}</Text>
                  <Text size="xs" c="dimmed">
                    {fmtDate(record.measuredAt)}
                  </Text>
                </div>
              </SimpleGrid>
            ),
          }}
          emptyState={
            <Text c="dimmed" ta="center" py="xl">
              Chưa có snapshot vận hành.
            </Text>
          }
        />
      </Paper>

      <Drawer
        opened={opened === "station"}
        onClose={() => setOpened(null)}
        title="Thêm trạm sạc hiện hữu"
        position="right"
        size="lg"
      >
        <form
          onSubmit={stationForm.handleSubmit(
            (v) =>
              void post("/api/ev/stations", {
                ...v,
                adminAreaCode: v.adminAreaCode || null,
                connectorTypes: v.connectorTypes
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
                gridAssetId: v.gridAssetId || null,
              }),
          )}
          noValidate
        >
          <Stack>
            <FormValidationAlert errors={stationForm.formState.errors} />
            <SimpleGrid cols={2}>
              <TextInput
                label="Mã trạm"
                withAsterisk
                error={stationForm.formState.errors.code?.message}
                {...stationForm.register("code")}
              />
              <TextInput
                label="Tên trạm"
                withAsterisk
                error={stationForm.formState.errors.name?.message}
                {...stationForm.register("name")}
              />
            </SimpleGrid>
            <Controller
              control={stationForm.control}
              name="operatorPartyId"
              render={({ field, fieldState }) => (
                <Select
                  searchable
                  withAsterisk
                  label="Đơn vị vận hành"
                  data={partyOptions}
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? "")}
                  error={fieldState.error?.message}
                />
              )}
            />
            <SimpleGrid cols={2}>
              <TextInput
                label="Mã site"
                withAsterisk
                error={stationForm.formState.errors.siteCode?.message}
                {...stationForm.register("siteCode")}
              />
              <TextInput
                label="Tên site"
                withAsterisk
                error={stationForm.formState.errors.siteName?.message}
                {...stationForm.register("siteName")}
              />
            </SimpleGrid>
            <TextInput
              label="Địa chỉ"
              withAsterisk
              error={stationForm.formState.errors.address?.message}
              {...stationForm.register("address")}
            />
            <Controller
              control={stationForm.control}
              name="adminAreaCode"
              render={({ field, fieldState }) => (
                <Select
                  searchable
                  clearable
                  label="Khu vực hành chính"
                  withAsterisk
                  data={areaOptions}
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? "")}
                  error={fieldState.error?.message}
                />
              )}
            />
            <SimpleGrid cols={2}>
              <Controller
                control={stationForm.control}
                name="latitude"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Latitude"
                    withAsterisk
                    decimalScale={7}
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v === "" ? null : Number(v))}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                control={stationForm.control}
                name="longitude"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Longitude"
                    withAsterisk
                    decimalScale={7}
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v === "" ? null : Number(v))}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </SimpleGrid>
            <SimpleGrid cols={2}>
              <Controller
                control={stationForm.control}
                name="totalPowerKw"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Tổng công suất kW"
                    withAsterisk
                    value={field.value}
                    onChange={(v) => field.onChange(Number(v))}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                control={stationForm.control}
                name="connectorCount"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Số connector"
                    withAsterisk
                    value={field.value}
                    onChange={(v) => field.onChange(Number(v))}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </SimpleGrid>
            <TextInput
              label="Loại connector"
              withAsterisk
              placeholder="CCS2, Type2"
              error={stationForm.formState.errors.connectorTypes?.message}
              {...stationForm.register("connectorTypes")}
            />
            <Controller
              control={stationForm.control}
              name="connectorPowerKw"
              render={({ field, fieldState }) => (
                <NumberInput
                  label="Công suất mỗi connector kW"
                  withAsterisk
                  value={field.value}
                  onChange={(v) => field.onChange(Number(v))}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={stationForm.control}
              name="gridAssetId"
              render={({ field, fieldState }) => (
                <Select
                  searchable
                  clearable
                  label="TBA / feeder cấp điện"
                  data={gridOptions}
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? "")}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Button type="submit" loading={saving}>
              Lưu trạm
            </Button>
          </Stack>
        </form>
      </Drawer>
      <Drawer
        opened={opened === "editStation"}
        onClose={() => {
          setOpened(null);
          setEditingStation(null);
        }}
        title={editingStation ? `Sửa ${editingStation.code}` : "Sửa station"}
        position="right"
        size="lg"
      >
        <form onSubmit={stationPatchForm.handleSubmit((v) => void patchStation(v))} noValidate>
          <Stack>
            <FormValidationAlert errors={stationPatchForm.formState.errors} />
            <TextInput
              label="Tên station"
              withAsterisk
              error={stationPatchForm.formState.errors.name?.message}
              {...stationPatchForm.register("name")}
            />
            <Controller
              control={stationPatchForm.control}
              name="operationStatus"
              render={({ field, fieldState }) => (
                <Select
                  label="Trạng thái vận hành"
                  data={["ACTIVE", "MAINTENANCE", "OFFLINE", "PLANNED", "DECOMMISSIONED"]}
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? "ACTIVE")}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={stationPatchForm.control}
              name="installedPowerKw"
              render={({ field, fieldState }) => (
                <NumberInput
                  label="Installed power kW"
                  withAsterisk
                  value={field.value}
                  onChange={(v) => field.onChange(Number(v))}
                  error={fieldState.error?.message}
                />
              )}
            />
            <SimpleGrid cols={2}>
              <Controller
                control={stationPatchForm.control}
                name="connectionCapacityKw"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Connection capacity kW"
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v === "" ? null : Number(v))}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                control={stationPatchForm.control}
                name="actualPeakPowerKw"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Actual peak kW"
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v === "" ? null : Number(v))}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </SimpleGrid>
            <Button type="submit" loading={saving}>
              Lưu station
            </Button>
          </Stack>
        </form>
      </Drawer>
      <Drawer
        opened={opened === "snapshot"}
        onClose={() => setOpened(null)}
        title="Ghi snapshot vận hành"
        position="right"
        size="lg"
      >
        <form
          onSubmit={snapshotForm.handleSubmit((v) => void post("/api/ev/stations/snapshots", v))}
          noValidate
        >
          <Stack>
            <FormValidationAlert errors={snapshotForm.formState.errors} />
            <Controller
              control={snapshotForm.control}
              name="stationAssetId"
              render={({ field, fieldState }) => (
                <Select
                  searchable
                  label="Trạm"
                  withAsterisk
                  data={stationOptions}
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? "")}
                  error={fieldState.error?.message}
                />
              )}
            />
            <TextInput
              type="datetime-local"
              label="Thời điểm"
              withAsterisk
              error={snapshotForm.formState.errors.measuredAt?.message}
              {...snapshotForm.register("measuredAt")}
            />
            <SimpleGrid cols={3}>
              <Controller
                control={snapshotForm.control}
                name="availableCount"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Available"
                    value={field.value}
                    onChange={(v) => field.onChange(Number(v))}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                control={snapshotForm.control}
                name="occupiedCount"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Occupied"
                    value={field.value}
                    onChange={(v) => field.onChange(Number(v))}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                control={snapshotForm.control}
                name="faultedCount"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Faulted"
                    value={field.value}
                    onChange={(v) => field.onChange(Number(v))}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </SimpleGrid>
            <Controller
              control={snapshotForm.control}
              name="utilizationPct"
              render={({ field, fieldState }) => (
                <NumberInput
                  label="Utilization %"
                  value={field.value}
                  onChange={(v) => field.onChange(Number(v))}
                  error={fieldState.error?.message}
                />
              )}
            />
            <SimpleGrid cols={2}>
              <Controller
                control={snapshotForm.control}
                name="energyDeliveredKwh"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Energy delivered kWh"
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v === "" ? null : Number(v))}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                control={snapshotForm.control}
                name="peakPowerKw"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Peak power kW"
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v === "" ? null : Number(v))}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </SimpleGrid>
            <TextInput
              label="Nguồn"
              withAsterisk
              error={snapshotForm.formState.errors.source?.message}
              {...snapshotForm.register("source")}
            />
            <Button type="submit" loading={saving}>
              Lưu snapshot
            </Button>
          </Stack>
        </form>
      </Drawer>
    </Stack>
  );
}
