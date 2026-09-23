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
  Tabs,
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
  IconCalendarEvent,
  IconFileCertificate,
  IconLeaf,
  IconEye,
  IconEdit,
  IconPlus,
  IconShieldBolt,
  IconTopologyStar3,
} from "@tabler/icons-react";
import type { DataTableColumn } from "mantine-datatable";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { CrudDataTable, DataTableAction, DataTableActions } from "@/components/data/CrudDataTable";
import { FormValidationAlert } from "@/components/forms/FormValidationAlert";

type RegulationRule = {
  id: string;
  voltageLevelKv: string | number;
  lineType: string | null;
  structureType: string | null;
  horizontalClearanceM: string | number | null;
  verticalClearanceM: string | number | null;
  corridorWidthM: string | number | null;
};
type Regulation = {
  id: string;
  code: string;
  name: string;
  legalDocumentRef: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
  rules: RegulationRule[];
};
type Corridor = {
  id: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  voltageLevelKv: number | null;
  corridorWidthM: number | null;
  regulationCode: string | null;
  legalDocumentRef: string | null;
  areaM2: number;
  status: string;
};
type Violation = {
  id: string;
  corridorId: string;
  assetCode: string;
  assetName: string;
  code: string;
  violationType: string;
  severity: string;
  detectedAt: string;
  status: string;
  distanceM: number | null;
  evidence: Record<string, unknown>;
  updatedAt: string;
  humanReviewRequired: boolean;
};
type Outage = {
  id: string;
  code: string;
  source: string;
  sourceType: string;
  sourceUrl: string | null;
  sourceRecordId: string | null;
  title: string;
  startAt: string;
  endAt: string;
  affectedCustomers: number | null;
  reason: string | null;
  status: string;
  impactMethod: string | null;
  affectedGeometry: unknown | null;
};
type Incident = {
  id: string;
  code: string;
  assetId: string | null;
  assetCode: string | null;
  assetName: string | null;
  incidentType: string;
  severity: string;
  startedAt: string;
  resolvedAt: string | null;
  status: string;
  affectedCustomers: number | null;
  affectedLoadMw: number | null;
  cause: string | null;
  metadata: Record<string, unknown>;
};
type GridAsset = { id: string; code: string; name: string; assetType: string; status: string };
type OutageImpactDetail = {
  summary?: { affectedCustomers?: number; affectedAssets?: number; affectedAreas?: number; affectedLoadMw?: number | null };
  assets?: Array<{ code?: string; name?: string; assetType?: string; relationType?: string }>;
  areas?: Array<{ adminAreaCode?: string; affectedCustomerCount?: number | null; affectedLoadMw?: number | null }>;
  warnings?: string[];
};

const regulationSchema = z
  .object({
    code: z.string().trim().min(2, "Nhập mã phiên bản quy định"),
    name: z.string().trim().min(2, "Nhập tên quy định"),
    legalDocumentRef: z.string().trim().min(2, "Nhập số hoặc đường dẫn văn bản pháp lý"),
    effectiveFrom: z.string().min(1, "Chọn ngày bắt đầu hiệu lực"),
    effectiveTo: z.string(),
    status: z.enum(["DRAFT", "ACTIVE", "SUPERSEDED", "EXPIRED"]),
    voltageLevelKv: z.number().positive("Điện áp phải lớn hơn 0"),
    lineType: z.string(),
    structureType: z.string(),
    horizontalClearanceM: z.number().min(0).nullable(),
    verticalClearanceM: z.number().min(0).nullable(),
    corridorWidthM: z.number().min(0).nullable(),
    notes: z.string().max(1000),
  })
  .superRefine((value, context) => {
    if (value.effectiveTo && value.effectiveTo < value.effectiveFrom)
      context.addIssue({
        code: "custom",
        path: ["effectiveTo"],
        message: "Ngày hết hiệu lực không được trước ngày bắt đầu.",
      });
    if (
      [value.horizontalClearanceM, value.verticalClearanceM, value.corridorWidthM].every(
        (item) => item == null,
      )
    )
      context.addIssue({
        code: "custom",
        path: ["horizontalClearanceM"],
        message: "Nhập ít nhất một thông số khoảng cách hoặc bề rộng hành lang.",
      });
  });
type RegulationForm = z.infer<typeof regulationSchema>;

const violationSchema = z
  .object({
    corridorId: z.string().uuid("Chọn hành lang/tuyến bị vi phạm"),
    code: z.string().trim().min(2, "Nhập mã vi phạm"),
    violationType: z.enum([
      "TREE_INTRUSION",
      "CONSTRUCTION_INTRUSION",
      "SIGNBOARD",
      "FIRE_SMOKE",
      "FOREIGN_OBJECT",
      "OTHER",
    ]),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    detectedAt: z.string().min(1, "Chọn thời điểm phát hiện"),
    status: z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "FALSE_POSITIVE"]),
    distanceM: z.number().min(0).nullable(),
    source: z.enum(["FIELD", "EVN", "AI_VISION", "CITIZEN", "OTHER"]),
    evidenceRef: z.string().max(1000),
    aiLabel: z.string().max(150),
    aiConfidencePct: z.number().min(0).max(100).nullable(),
    notes: z.string().max(3000),
  })
  .superRefine((value, context) => {
    if (value.latitude == null)
      context.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Nhập vĩ độ vị trí vi phạm.",
      });
    if (value.longitude == null)
      context.addIssue({
        code: "custom",
        path: ["longitude"],
        message: "Nhập kinh độ vị trí vi phạm.",
      });
    if (value.source === "AI_VISION" && !value.aiLabel)
      context.addIssue({
        code: "custom",
        path: ["aiLabel"],
        message: "Kết quả AI phải có nhãn nhận diện.",
      });
  });
type ViolationForm = z.infer<typeof violationSchema>;

const outageSchema = z
  .object({
    code: z.string().trim().min(2, "Nhập mã lịch cắt điện"),
    source: z.string().trim().min(2, "Nhập nguồn công bố"),
    title: z.string().trim().min(2, "Nhập nội dung cắt điện"),
    startAt: z.string().min(1, "Chọn thời điểm bắt đầu"),
    endAt: z.string().min(1, "Chọn thời điểm kết thúc"),
    affectedCustomers: z.number().int().min(0).nullable(),
    reason: z.string().max(2000),
    status: z.enum(["PLANNED", "ANNOUNCED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
    centerLatitude: z.number().min(-90).max(90).nullable(),
    centerLongitude: z.number().min(-180).max(180).nullable(),
    affectedRadiusM: z.number().positive().nullable(),
  })
  .superRefine((value, context) => {
    if (value.endAt <= value.startAt)
      context.addIssue({
        code: "custom",
        path: ["endAt"],
        message: "Thời điểm kết thúc phải sau thời điểm bắt đầu.",
      });
    const gisValues = [value.centerLatitude, value.centerLongitude, value.affectedRadiusM];
    if (gisValues.some((item) => item != null) && gisValues.some((item) => item == null))
      context.addIssue({
        code: "custom",
        path: ["centerLatitude"],
        message: "Vùng GIS cần đủ vĩ độ, kinh độ và bán kính.",
      });
  });
type OutageForm = z.infer<typeof outageSchema>;

const incidentSchema = z
  .object({
    code: z.string().trim().min(2, "Nhập mã sự cố"),
    assetId: z.string().nullable(),
    incidentType: z.string().trim().min(2, "Nhập loại sự cố"),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    startedAt: z.string().min(1, "Chọn thời điểm xảy ra"),
    resolvedAt: z.string(),
    status: z.enum(["OPEN", "INVESTIGATING", "RESTORING", "RESOLVED", "CLOSED"]),
    affectedCustomers: z.number().int().min(0).nullable(),
    affectedLoadMw: z.number().min(0).nullable(),
    cause: z.string().max(2000),
    notes: z.string().max(3000),
  })
  .superRefine((value, context) => {
    if (value.resolvedAt && value.resolvedAt < value.startedAt)
      context.addIssue({
        code: "custom",
        path: ["resolvedAt"],
        message: "Thời điểm khôi phục không được trước lúc xảy ra.",
      });
    if (["RESOLVED", "CLOSED"].includes(value.status) && !value.resolvedAt)
      context.addIssue({
        code: "custom",
        path: ["resolvedAt"],
        message: "Sự cố đã xử lý phải có thời điểm khôi phục.",
      });
  });
type IncidentForm = z.infer<typeof incidentSchema>;

function fmtDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}
function severityColor(value: string) {
  return value === "CRITICAL"
    ? "red"
    : value === "HIGH"
      ? "orange"
      : value === "MEDIUM"
        ? "yellow"
        : "blue";
}
function statusColor(value: string) {
  return ["ACTIVE", "COMPLETED", "RESOLVED", "CLOSED"].includes(value)
    ? "green"
    : ["OPEN", "IN_PROGRESS", "RESTORING", "INVESTIGATING"].includes(value)
      ? "orange"
      : value === "CANCELLED"
        ? "gray"
        : "blue";
}

export function SafetyOperationsWorkspace() {
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [corridorOptions, setCorridorOptions] = useState<Corridor[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [outages, setOutages] = useState<Outage[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [gridAssets, setGridAssets] = useState<GridAsset[]>([]);
  const [opened, setOpened] = useState<"regulation" | "violation" | "outage" | "incident" | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [violationPage, setViolationPage] = useState(1);
  const [violationPageSize, setViolationPageSize] = useState(25);
  const [violationTotal, setViolationTotal] = useState(0);
  const [outagePage, setOutagePage] = useState(1);
  const [outagePageSize, setOutagePageSize] = useState(25);
  const [outageTotal, setOutageTotal] = useState(0);
  const [incidentPage, setIncidentPage] = useState(1);
  const [incidentPageSize, setIncidentPageSize] = useState(25);
  const [incidentTotal, setIncidentTotal] = useState(0);
  const [regulationPage, setRegulationPage] = useState(1);
  const [regulationPageSize, setRegulationPageSize] = useState(25);
  const [regulationTotal, setRegulationTotal] = useState(0);
  const [corridorPage, setCorridorPage] = useState(1);
  const [corridorPageSize, setCorridorPageSize] = useState(25);
  const [corridorTotal, setCorridorTotal] = useState(0);
  const [selectedRegulation, setSelectedRegulation] = useState<Regulation | null>(null);
  const [selectedCorridor, setSelectedCorridor] = useState<Corridor | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [selectedOutage, setSelectedOutage] = useState<Outage | null>(null);
  const [outageImpact, setOutageImpact] = useState<OutageImpactDetail | null>(null);
  const [outageDetailLoading, setOutageDetailLoading] = useState(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [now] = useState(() => Date.now());

  const regulationForm = useForm<RegulationForm>({
    resolver: zodResolver(regulationSchema),
    defaultValues: {
      code: "",
      name: "",
      legalDocumentRef: "",
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: "",
      status: "ACTIVE",
      voltageLevelKv: 110,
      lineType: "OVERHEAD",
      structureType: "BUILDING",
      horizontalClearanceM: null,
      verticalClearanceM: null,
      corridorWidthM: null,
      notes: "",
    },
  });
  const violationForm = useForm<ViolationForm>({
    resolver: zodResolver(violationSchema),
    defaultValues: {
      corridorId: "",
      code: "",
      violationType: "TREE_INTRUSION",
      severity: "MEDIUM",
      latitude: null,
      longitude: null,
      detectedAt: new Date().toISOString().slice(0, 16),
      status: "OPEN",
      distanceM: null,
      source: "FIELD",
      evidenceRef: "",
      aiLabel: "",
      aiConfidencePct: null,
      notes: "",
    },
  });
  const outageForm = useForm<OutageForm>({
    resolver: zodResolver(outageSchema),
    defaultValues: {
      code: "",
      source: "EVN",
      title: "",
      startAt: new Date().toISOString().slice(0, 16),
      endAt: new Date(now + 4 * 3600000).toISOString().slice(0, 16),
      affectedCustomers: null,
      reason: "",
      status: "ANNOUNCED",
      centerLatitude: null,
      centerLongitude: null,
      affectedRadiusM: null,
    },
  });
  const incidentForm = useForm<IncidentForm>({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
      code: "",
      assetId: null,
      incidentType: "MẤT ĐIỆN",
      severity: "MEDIUM",
      startedAt: new Date().toISOString().slice(0, 16),
      resolvedAt: "",
      status: "OPEN",
      affectedCustomers: null,
      affectedLoadMw: null,
      cause: "",
      notes: "",
    },
  });

  const reload = useCallback(
    async (
      nextViolationPage = 1,
      nextViolationPageSize = 25,
      nextOutagePage = 1,
      nextOutagePageSize = 25,
      nextIncidentPage = 1,
      nextIncidentPageSize = 25,
      nextRegulationPage = 1,
      nextRegulationPageSize = 25,
      nextCorridorPage = 1,
      nextCorridorPageSize = 25,
    ) => {
      setLoading(true);
      const [
        regRes,
        corridorRes,
        corridorOptionRes,
        violationRes,
        outageRes,
        incidentRes,
        assetRes,
      ] = await Promise.all([
        fetch(
          `/api/safety/regulations?includeArchived=true&page=${nextRegulationPage}&pageSize=${nextRegulationPageSize}`,
          { cache: "no-store" },
        ),
        fetch(`/api/safety/corridors?page=${nextCorridorPage}&pageSize=${nextCorridorPageSize}`, {
          cache: "no-store",
        }),
        fetch("/api/safety/corridors?options=true", { cache: "no-store" }),
        fetch(
          `/api/safety/violations?page=${nextViolationPage}&pageSize=${nextViolationPageSize}`,
          { cache: "no-store" },
        ),
        fetch(`/api/safety/outages?page=${nextOutagePage}&pageSize=${nextOutagePageSize}`, {
          cache: "no-store",
        }),
        fetch(`/api/safety/incidents?page=${nextIncidentPage}&pageSize=${nextIncidentPageSize}`, {
          cache: "no-store",
        }),
        fetch("/api/grid/assets/options?types=SUBSTATION,TRANSFORMER,BAY,FEEDER,POWER_LINE", {
          cache: "no-store",
        }),
      ]);
      if (regRes.ok) {
        const data = (await regRes.json()) as {
          items?: Regulation[];
          pagination?: { page?: number; pageSize?: number; total?: number };
        };
        setRegulations(data.items ?? []);
        setRegulationTotal(data.pagination?.total ?? 0);
        if (data.pagination?.page) setRegulationPage(data.pagination.page);
        if (data.pagination?.pageSize) setRegulationPageSize(data.pagination.pageSize);
      }
      if (corridorRes.ok) {
        const data = (await corridorRes.json()) as {
          items?: Corridor[];
          pagination?: { page?: number; pageSize?: number; total?: number };
        };
        setCorridors(data.items ?? []);
        setCorridorTotal(data.pagination?.total ?? 0);
        if (data.pagination?.page) setCorridorPage(data.pagination.page);
        if (data.pagination?.pageSize) setCorridorPageSize(data.pagination.pageSize);
      }
      if (corridorOptionRes.ok)
        setCorridorOptions(
          ((await corridorOptionRes.json()) as { items?: Corridor[] }).items ?? [],
        );
      if (violationRes.ok) {
        const data = (await violationRes.json()) as {
          items?: Violation[];
          pagination?: { page?: number; pageSize?: number; total?: number };
        };
        setViolations(data.items ?? []);
        setViolationTotal(data.pagination?.total ?? 0);
        if (data.pagination?.page) setViolationPage(data.pagination.page);
        if (data.pagination?.pageSize) setViolationPageSize(data.pagination.pageSize);
      }
      if (outageRes.ok) {
        const data = (await outageRes.json()) as {
          items?: Outage[];
          pagination?: { page?: number; pageSize?: number; total?: number };
        };
        setOutages(data.items ?? []);
        setOutageTotal(data.pagination?.total ?? 0);
        if (data.pagination?.page) setOutagePage(data.pagination.page);
        if (data.pagination?.pageSize) setOutagePageSize(data.pagination.pageSize);
      }
      if (incidentRes.ok) {
        const data = (await incidentRes.json()) as {
          items?: Incident[];
          pagination?: { page?: number; pageSize?: number; total?: number };
        };
        setIncidents(data.items ?? []);
        setIncidentTotal(data.pagination?.total ?? 0);
        if (data.pagination?.page) setIncidentPage(data.pagination.page);
        if (data.pagination?.pageSize) setIncidentPageSize(data.pagination.pageSize);
      }
      if (assetRes.ok)
        setGridAssets(((await assetRes.json()) as { items: GridAsset[] }).items ?? []);
      setLoading(false);
    },
    [],
  );
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  const openViolations = useMemo(
    () => violations.filter((v) => ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(v.status)).length,
    [violations],
  );
  const criticalViolations = useMemo(
    () =>
      violations.filter(
        (v) =>
          ["HIGH", "CRITICAL"].includes(v.severity) &&
          ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(v.status),
      ).length,
    [violations],
  );
  const activeIncidents = useMemo(
    () => incidents.filter((i) => !["RESOLVED", "CLOSED"].includes(i.status)).length,
    [incidents],
  );
  const upcomingOutages = useMemo(
    () =>
      outages.filter(
        (o) => new Date(o.endAt) > new Date() && !["COMPLETED", "CANCELLED"].includes(o.status),
      ).length,
    [outages],
  );

  async function rebuildCorridors() {
    setSaving(true);
    try {
      const response = await fetch("/api/safety/corridors/rebuild", { method: "POST" });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "Không thể dựng hành lang.");
      notifications.show({
        title: "Đã dựng hành lang GIS",
        message: data.message ?? "Hoàn tất",
        color: "green",
      });
      await reload();
    } catch (error) {
      notifications.show({
        title: "Dựng hành lang thất bại",
        message: error instanceof Error ? error.message : "Lỗi không xác định.",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  }

  const saveRegulation = regulationForm.handleSubmit(async (v) => {
    setSaving(true);
    try {
      const response = await fetch("/api/safety/regulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: v.code,
          name: v.name,
          legalDocumentRef: v.legalDocumentRef,
          effectiveFrom: v.effectiveFrom,
          effectiveTo: v.effectiveTo || null,
          status: v.status,
          rules: [
            {
              voltageLevelKv: v.voltageLevelKv,
              lineType: v.lineType || null,
              structureType: v.structureType || null,
              horizontalClearanceM: v.horizontalClearanceM,
              verticalClearanceM: v.verticalClearanceM,
              corridorWidthM: v.corridorWidthM,
              notes: v.notes || null,
            },
          ],
        }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "Không thể lưu quy định.");
      notifications.show({
        title: "Đã lưu quy định",
        message: "Rule được version theo văn bản và ngày hiệu lực.",
        color: "green",
      });
      setOpened(null);
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
  const saveViolation = violationForm.handleSubmit(async (v) => {
    setSaving(true);
    try {
      const response = await fetch("/api/safety/violations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...v,
          evidenceRefs: v.evidenceRef ? [v.evidenceRef] : [],
          aiLabel: v.aiLabel || null,
          notes: v.notes || null,
        }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "Không thể lưu vi phạm.");
      notifications.show({
        title: "Đã lưu vi phạm",
        message: "Bằng chứng, nguồn phát hiện và trạng thái đã được lưu.",
        color: "green",
      });
      setOpened(null);
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
  const saveOutage = outageForm.handleSubmit(async (v) => {
    setSaving(true);
    try {
      const response = await fetch("/api/safety/outages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v, reason: v.reason || null }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "Không thể lưu lịch cắt điện.");
      notifications.show({
        title: "Đã lưu lịch cắt điện",
        message:
          "Thời gian và vùng ảnh hưởng sơ bộ đã được lưu vào PostGIS nếu có tọa độ/bán kính.",
        color: "green",
      });
      setOpened(null);
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
  const saveIncident = incidentForm.handleSubmit(async (v) => {
    setSaving(true);
    try {
      const response = await fetch(
        editingIncident ? `/api/safety/incidents/${editingIncident.id}` : "/api/safety/incidents",
        {
          method: editingIncident ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...v,
            assetId: v.assetId || null,
            resolvedAt: v.resolvedAt || null,
            cause: v.cause || null,
            notes: v.notes || null,
          }),
        },
      );
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "Không thể lưu sự cố.");
      notifications.show({
        title: editingIncident ? "Đã cập nhật sự cố" : "Đã lưu sự cố",
        message: "Sự cố và phạm vi ảnh hưởng đã được ghi nhận.",
        color: "green",
      });
      setOpened(null);
      setEditingIncident(null);
      incidentForm.reset();
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

  function openIncidentEdit(item: Incident) {
    setEditingIncident(item);
    incidentForm.reset({
      code: item.code,
      assetId: item.assetId,
      incidentType: item.incidentType,
      severity: item.severity as IncidentForm["severity"],
      startedAt: new Date(item.startedAt).toISOString().slice(0, 16),
      resolvedAt: item.resolvedAt ? new Date(item.resolvedAt).toISOString().slice(0, 16) : "",
      status: item.status as IncidentForm["status"],
      affectedCustomers: item.affectedCustomers,
      affectedLoadMw: item.affectedLoadMw,
      cause: item.cause ?? "",
      notes: typeof item.metadata?.notes === "string" ? item.metadata.notes : "",
    });
    setOpened("incident");
  }

  async function archiveIncident(item: Incident) {
    if (!window.confirm(`Archive sự cố ${item.code}? Lịch sử vẫn được giữ.`)) return;
    try {
      const response = await fetch(`/api/safety/incidents/${item.id}`, { method: "DELETE" });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "Không thể archive sự cố.");
      await reload();
      notifications.show({
        title: "Đã archive sự cố",
        message: "Sự cố được đóng và giữ nguyên lịch sử.",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Archive thất bại",
        message: error instanceof Error ? error.message : "Lỗi không xác định.",
        color: "red",
      });
    }
  }

  async function archiveRegulation(item: Regulation) {
    if (!window.confirm(`Archive quy định ${item.code}?`)) return;
    try {
      const response = await fetch(`/api/safety/regulations/${item.id}`, { method: "DELETE" });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "Không thể archive quy định.");
      await reload();
      notifications.show({
        title: "Đã archive quy định",
        message: "Quy định và các rule lịch sử vẫn được giữ.",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Archive thất bại",
        message: error instanceof Error ? error.message : "Lỗi không xác định.",
        color: "red",
      });
    }
  }

  async function archiveViolation(item: Violation) {
    if (!window.confirm(`Archive vi phạm ${item.code}?`)) return;
    try {
      const response = await fetch(`/api/safety/violations/${item.id}`, { method: "DELETE" });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "Không thể archive vi phạm.");
      await reload();
      notifications.show({
        title: "Đã archive vi phạm",
        message: "Bằng chứng và lịch sử trạng thái vẫn được giữ.",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Archive thất bại",
        message: error instanceof Error ? error.message : "Lỗi không xác định.",
        color: "red",
      });
    }
  }
  async function archiveOutage(item: Outage) {
    if (!window.confirm(`Archive lịch cắt điện ${item.code}?`)) return;
    try {
      const response = await fetch(`/api/safety/outages/${item.id}`, { method: "DELETE" });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "Không thể archive lịch cắt điện.");
      await reload();
      notifications.show({
        title: "Đã archive lịch cắt điện",
        message: "Lịch sử kế hoạch vẫn được giữ.",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Archive thất bại",
        message: error instanceof Error ? error.message : "Lỗi không xác định.",
        color: "red",
      });
    }
  }

  async function openOutageDetail(item: Outage) {
    setSelectedOutage(item);
    setOutageImpact(null);
    setOutageDetailLoading(true);
    try {
      const response = await fetch(`/api/safety/outages/${item.id}/impact`, { cache: "no-store" });
      const payload = await response.json() as OutageImpactDetail & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Không thể tải phạm vi ảnh hưởng.");
      setOutageImpact(payload);
    } catch (error) {
      notifications.show({ title: "Không thể tải chi tiết lịch cắt điện", message: error instanceof Error ? error.message : "Lỗi không xác định.", color: "red" });
    } finally {
      setOutageDetailLoading(false);
    }
  }

  const violationColumns: DataTableColumn<Violation>[] = [
    {
      accessor: "actions",
      title: "Thao tác",
      width: 68,
      render: (item) => (
        <DataTableActions>
          <DataTableAction
            label="Archive vi phạm"
            icon={<IconArchive size={16} />}
            color="orange"
            onClick={() => void archiveViolation(item)}
          />
        </DataTableActions>
      ),
    },
    {
      accessor: "code",
      title: "Mã / tuyến",
      width: 230,
      render: (item) => (
        <>
          <Text fw={900}>{item.code}</Text>
          <Text size="xs" c="dimmed">
            {item.assetName} · {item.assetCode}
          </Text>
        </>
      ),
    },
    { accessor: "violationType", title: "Loại", width: 190, render: (item) => item.violationType },
    {
      accessor: "severity",
      title: "Mức độ",
      width: 120,
      render: (item) => (
        <Badge color={severityColor(item.severity)} variant="light">
          {item.severity}
        </Badge>
      ),
    },
    {
      accessor: "detectedAt",
      title: "Phát hiện",
      width: 170,
      render: (item) => fmtDate(item.detectedAt),
    },
    {
      accessor: "distanceM",
      title: "Khoảng cách",
      width: 130,
      render: (item) => (item.distanceM == null ? "—" : `${item.distanceM} m`),
    },
    {
      accessor: "status",
      title: "Trạng thái",
      width: 150,
      render: (item) => (
        <Badge color={statusColor(item.status)} variant="dot">
          {item.status}
        </Badge>
      ),
    },
  ];
  const outageColumns: DataTableColumn<Outage>[] = [
    {
      accessor: "actions",
      title: "Thao tác",
      width: 104,
      render: (item) => (
        <DataTableActions>
          <DataTableAction
            label="Xem chi tiết lịch cắt điện"
            icon={<IconEye size={16} />}
            color="blue"
            onClick={() => void openOutageDetail(item)}
          />
          <DataTableAction
            label="Archive lịch cắt điện"
            icon={<IconArchive size={16} />}
            color="orange"
            onClick={() => void archiveOutage(item)}
          />
        </DataTableActions>
      ),
    },
    {
      accessor: "code",
      title: "Mã / nội dung",
      width: 260,
      render: (item) => (
        <>
          <Text fw={900}>{item.code}</Text>
          <Text size="sm" fw={700}>
            {item.title}
          </Text>
          <Text size="xs" c="dimmed">
            {item.source}
          </Text>
        </>
      ),
    },
    {
      accessor: "startAt",
      title: "Thời gian",
      width: 230,
      render: (item) => (
        <>
          <Text size="sm">{fmtDate(item.startAt)}</Text>
          <Text size="xs" c="dimmed">
            → {fmtDate(item.endAt)}
          </Text>
        </>
      ),
    },
    {
      accessor: "affectedCustomers",
      title: "KH ảnh hưởng",
      width: 140,
      render: (item) => item.affectedCustomers?.toLocaleString("vi-VN") ?? "—",
    },
    {
      accessor: "affectedGeometry",
      title: "Vùng GIS",
      width: 120,
      render: (item) =>
        item.affectedGeometry ? (
          <Badge color="cyan" variant="light">
            Có polygon
          </Badge>
        ) : (
          "—"
        ),
    },
    {
      accessor: "status",
      title: "Trạng thái",
      width: 150,
      render: (item) => (
        <Badge color={statusColor(item.status)} variant="light">
          {item.status}
        </Badge>
      ),
    },
  ];
  const incidentColumns: DataTableColumn<Incident>[] = [
    {
      accessor: "actions",
      title: "Thao tác",
      width: 96,
      render: (item) => (
        <DataTableActions>
          <DataTableAction
            label="Xem sự cố"
            icon={<IconEye size={16} />}
            color="blue"
            onClick={() => setSelectedIncident(item)}
          />
          <DataTableAction
            label="Sửa sự cố"
            icon={<IconEdit size={16} />}
            color="blue"
            onClick={() => openIncidentEdit(item)}
          />
          <DataTableAction
            label="Archive sự cố"
            icon={<IconArchive size={16} />}
            color="orange"
            onClick={() => void archiveIncident(item)}
          />
        </DataTableActions>
      ),
    },
    {
      accessor: "code",
      title: "Mã / tài sản",
      width: 250,
      render: (item) => (
        <>
          <Text fw={900}>{item.code}</Text>
          <Text size="xs" c="dimmed">
            {item.assetName ?? "Chưa gắn tài sản"} · {item.assetCode ?? "—"}
          </Text>
        </>
      ),
    },
    { accessor: "incidentType", title: "Loại", width: 190, render: (item) => item.incidentType },
    {
      accessor: "severity",
      title: "Mức độ",
      width: 120,
      render: (item) => (
        <Badge color={severityColor(item.severity)} variant="light">
          {item.severity}
        </Badge>
      ),
    },
    {
      accessor: "startedAt",
      title: "Bắt đầu",
      width: 170,
      render: (item) => fmtDate(item.startedAt),
    },
    {
      accessor: "affectedCustomers",
      title: "Khách hàng",
      width: 130,
      render: (item) => item.affectedCustomers?.toLocaleString("vi-VN") ?? "—",
    },
    {
      accessor: "affectedLoadMw",
      title: "Mất tải",
      width: 120,
      render: (item) => (item.affectedLoadMw == null ? "—" : `${item.affectedLoadMw} MW`),
    },
    {
      accessor: "status",
      title: "Trạng thái",
      width: 150,
      render: (item) => (
        <Badge color={statusColor(item.status)} variant="dot">
          {item.status}
        </Badge>
      ),
    },
  ];
  const regulationColumns: DataTableColumn<Regulation>[] = [
    {
      accessor: "actions",
      title: "Thao tác",
      width: 88,
      render: (item) => (
        <DataTableActions>
          <DataTableAction
            label="Xem quy định"
            icon={<IconEye size={16} />}
            color="blue"
            onClick={() => setSelectedRegulation(item)}
          />
          <DataTableAction
            label="Archive quy định"
            icon={<IconArchive size={16} />}
            color="orange"
            onClick={() => void archiveRegulation(item)}
          />
        </DataTableActions>
      ),
    },
    {
      accessor: "code",
      title: "Mã / tên",
      width: 280,
      render: (item) => (
        <>
          <Text fw={900}>{item.code}</Text>
          <Text size="sm">{item.name}</Text>
        </>
      ),
    },
    {
      accessor: "effectiveFrom",
      title: "Hiệu lực",
      width: 190,
      render: (item) => (
        <>
          <Text>{fmtDate(item.effectiveFrom)}</Text>
          <Text size="xs" c="dimmed">
            {item.effectiveTo ? `đến ${fmtDate(item.effectiveTo)}` : "Không thời hạn"}
          </Text>
        </>
      ),
    },
    {
      accessor: "status",
      title: "Trạng thái",
      width: 140,
      render: (item) => (
        <Badge color={statusColor(item.status)} variant="dot">
          {item.status}
        </Badge>
      ),
    },
    {
      accessor: "rules",
      title: "Rules",
      width: 100,
      render: (item) => `${item.rules.length} rule`,
    },
    {
      accessor: "legalDocumentRef",
      title: "Căn cứ pháp lý",
      width: 260,
      render: (item) => item.legalDocumentRef,
    },
  ];
  const corridorColumns: DataTableColumn<Corridor>[] = [
    {
      accessor: "actions",
      title: "Thao tác",
      width: 68,
      render: (item) => (
        <DataTableActions>
          <DataTableAction
            label="Xem corridor"
            icon={<IconEye size={16} />}
            color="blue"
            onClick={() => setSelectedCorridor(item)}
          />
        </DataTableActions>
      ),
    },
    {
      accessor: "assetCode",
      title: "Tuyến",
      width: 250,
      render: (item) => (
        <>
          <Text fw={900}>{item.assetCode}</Text>
          <Text size="xs" c="dimmed">
            {item.assetName}
          </Text>
        </>
      ),
    },
    {
      accessor: "voltageLevelKv",
      title: "Điện áp",
      width: 120,
      render: (item) => (item.voltageLevelKv == null ? "—" : `${item.voltageLevelKv} kV`),
    },
    {
      accessor: "regulationCode",
      title: "Rule",
      width: 170,
      render: (item) => item.regulationCode ?? "—",
    },
    {
      accessor: "corridorWidthM",
      title: "Bề rộng",
      width: 120,
      render: (item) => (item.corridorWidthM == null ? "—" : `${item.corridorWidthM} m`),
    },
    {
      accessor: "areaM2",
      title: "Diện tích",
      width: 140,
      render: (item) =>
        `${(item.areaM2 / 10000).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} ha`,
    },
    {
      accessor: "status",
      title: "Trạng thái",
      width: 140,
      render: (item) => (
        <Badge color="green" variant="dot">
          {item.status}
        </Badge>
      ),
    },
  ];

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Paper radius="xl" p="md" withBorder>
          <Text size="xs" c="dimmed" fw={800}>
            VI PHẠM MỞ
          </Text>
          <Text fz={28} fw={900}>
            {openViolations}
          </Text>
          <Text size="xs" c={criticalViolations ? "red" : "dimmed"}>
            {criticalViolations} nguy cơ cao
          </Text>
        </Paper>
        <Paper radius="xl" p="md" withBorder>
          <Text size="xs" c="dimmed" fw={800}>
            SỰ CỐ ĐANG XỬ LÝ
          </Text>
          <Text fz={28} fw={900}>
            {activeIncidents}
          </Text>
        </Paper>
        <Paper radius="xl" p="md" withBorder>
          <Text size="xs" c="dimmed" fw={800}>
            LỊCH CẮT ĐIỆN
          </Text>
          <Text fz={28} fw={900}>
            {upcomingOutages}
          </Text>
          <Text size="xs" c="dimmed">
            đang/chuẩn bị ảnh hưởng
          </Text>
        </Paper>
        <Paper radius="xl" p="md" withBorder>
          <Text size="xs" c="dimmed" fw={800}>
            HÀNH LANG GIS
          </Text>
          <Text fz={28} fw={900}>
            {corridors.length}
          </Text>
          <Text size="xs" c="dimmed">
            {regulations.filter((r) => r.status === "ACTIVE").length} bộ quy định hoạt động
          </Text>
        </Paper>
      </SimpleGrid>

      <Tabs defaultValue="violations" variant="outline" radius="lg">
        <Tabs.List>
          <Tabs.Tab value="violations" leftSection={<IconAlertTriangle size={15} />}>
            Vi phạm
          </Tabs.Tab>
          <Tabs.Tab value="corridors" leftSection={<IconShieldBolt size={15} />}>
            Hành lang & quy định
          </Tabs.Tab>
          <Tabs.Tab value="outages" leftSection={<IconCalendarEvent size={15} />}>
            Lịch cắt điện
          </Tabs.Tab>
          <Tabs.Tab value="incidents" leftSection={<IconBolt size={15} />}>
            Sự cố
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="violations" pt="lg">
          <Paper radius="xl" p="lg" withBorder className="energy-glass">
            <Group justify="space-between" mb="md">
              <div>
                <Title order={3}>Vi phạm hành lang</Title>
                <Text size="sm" c="dimmed">
                  Cây xanh, công trình, biển quảng cáo, vật thể lạ; hỗ trợ evidence từ hiện trường
                  hoặc AI Vision.
                </Text>
              </div>
              <Button
                leftSection={<IconPlus size={16} />}
                disabled={!corridors.length}
                onClick={() => setOpened("violation")}
              >
                Ghi nhận vi phạm
              </Button>
            </Group>
            {!corridors.length ? (
              <Alert color="orange">
                Chưa có hành lang. Hãy khai báo quy định và dựng hành lang từ tuyến điện trước.
              </Alert>
            ) : (
              <CrudDataTable
                records={violations}
                filterPlaceholder="Mã vi phạm, loại hoặc tài sản..."
                filters={[
                  { key: "severity", label: "Mức độ", options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => ({ value, label: value })) },
                  { key: "status", label: "Trạng thái", options: ["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "FALSE_POSITIVE"].map((value) => ({ value, label: value })) },
                ]}
                columns={violationColumns}
                idAccessor="id"
                page={violationPage}
                totalRecords={violationTotal}
                recordsPerPage={violationPageSize}
                onPageChange={(nextPage) => {
                  setViolationPage(nextPage);
                  void reload(
                    nextPage,
                    violationPageSize,
                    outagePage,
                    outagePageSize,
                    incidentPage,
                    incidentPageSize,
                  );
                }}
                onRecordsPerPageChange={(nextSize) => {
                  setViolationPage(1);
                  setViolationPageSize(nextSize);
                  void reload(
                    1,
                    nextSize,
                    outagePage,
                    outagePageSize,
                    incidentPage,
                    incidentPageSize,
                  );
                }}
                fetching={loading}
                rowExpansion={{
                  allowMultiple: true,
                  content: ({ record }) => (
                    <SimpleGrid cols={{ base: 1, sm: 3 }} p="sm">
                      <div>
                        <Text size="xs" c="dimmed" fw={800}>
                          Tuyến / hành lang
                        </Text>
                        <Text size="sm">{record.assetName}</Text>
                        <Text size="xs" c="dimmed">
                          {record.assetCode} · {record.corridorId}
                        </Text>
                      </div>
                      <div>
                        <Text size="xs" c="dimmed" fw={800}>
                          Nguồn phát hiện
                        </Text>
                        <Text size="sm">
                          {String((record.evidence as { source?: unknown })?.source ?? "FIELD")}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {record.humanReviewRequired
                            ? "Cần human review"
                            : "Không yêu cầu human review"}
                        </Text>
                      </div>
                      <div>
                        <Text size="xs" c="dimmed" fw={800}>
                          Evidence / cập nhật
                        </Text>
                        <Text size="sm">
                          {record.distanceM == null
                            ? "Chưa có khoảng cách"
                            : `${record.distanceM} m`}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {record.updatedAt ? fmtDate(record.updatedAt) : "—"}
                        </Text>
                      </div>
                    </SimpleGrid>
                  ),
                }}
                emptyState={
                  <Text c="dimmed" ta="center" py="xl">
                    Chưa có vi phạm.
                  </Text>
                }
              />
            )}
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="corridors" pt="lg">
          <Stack>
            <Paper radius="xl" p="lg" withBorder className="energy-glass">
              <Group justify="space-between" align="flex-start" wrap="wrap">
                <div>
                  <Group gap="sm">
                    <IconFileCertificate size={21} />
                    <Title order={3}>Quy định hành lang có version</Title>
                  </Group>
                  <Text size="sm" c="dimmed" maw={760}>
                    Không hard-code khoảng cách. Mỗi rule gắn văn bản pháp lý, ngày hiệu lực, cấp
                    điện áp, loại tuyến/công trình và thông số hành lang.
                  </Text>
                </div>
                <Group>
                  <Button
                    variant="light"
                    leftSection={<IconPlus size={16} />}
                    onClick={() => setOpened("regulation")}
                  >
                    Thêm quy định
                  </Button>
                  <Button
                    color="indigo"
                    loading={saving}
                    leftSection={<IconTopologyStar3 size={16} />}
                    onClick={() => void rebuildCorridors()}
                  >
                    Dựng lại hành lang GIS
                  </Button>
                </Group>
              </Group>
            </Paper>
            <CrudDataTable
              records={regulations}
              columns={regulationColumns}
              idAccessor="id"
              page={regulationPage}
              totalRecords={regulationTotal}
              recordsPerPage={regulationPageSize}
              onPageChange={(nextPage) => {
                setRegulationPage(nextPage);
                void reload(
                  violationPage,
                  violationPageSize,
                  outagePage,
                  outagePageSize,
                  incidentPage,
                  incidentPageSize,
                  nextPage,
                  regulationPageSize,
                  corridorPage,
                  corridorPageSize,
                );
              }}
              onRecordsPerPageChange={(nextSize) => {
                setRegulationPage(1);
                setRegulationPageSize(nextSize);
                void reload(
                  violationPage,
                  violationPageSize,
                  outagePage,
                  outagePageSize,
                  incidentPage,
                  incidentPageSize,
                  1,
                  nextSize,
                  corridorPage,
                  corridorPageSize,
                );
              }}
              fetching={loading}
              rowExpansion={{
                allowMultiple: true,
                content: ({ record }) => (
                  <Stack p="sm" gap="xs">
                    <Text size="xs" c="dimmed" fw={800}>
                      {record.legalDocumentRef} · hiệu lực {fmtDate(record.effectiveFrom)}
                    </Text>
                    {record.rules.map((rule) => (
                      <Text key={rule.id} size="sm">
                        <b>{Number(rule.voltageLevelKv)} kV</b> · {rule.lineType ?? "Tất cả"} ·{" "}
                        {rule.structureType ?? "Tất cả"} · ngang{" "}
                        {rule.horizontalClearanceM == null
                          ? "—"
                          : Number(rule.horizontalClearanceM) + " m"}{" "}
                        · dọc{" "}
                        {rule.verticalClearanceM == null
                          ? "—"
                          : Number(rule.verticalClearanceM) + " m"}{" "}
                        · hành lang{" "}
                        {rule.corridorWidthM == null ? "—" : Number(rule.corridorWidthM) + " m"}
                      </Text>
                    ))}
                  </Stack>
                ),
              }}
              emptyState={
                <Text c="dimmed" ta="center" py="xl">
                  Chưa có quy định.
                </Text>
              }
            />
            <Paper radius="xl" p="lg" withBorder>
              <Title order={3} mb="md">
                Hành lang đã sinh trên PostGIS
              </Title>
              <CrudDataTable
                records={corridors}
                columns={corridorColumns}
                idAccessor="id"
                page={corridorPage}
                totalRecords={corridorTotal}
                recordsPerPage={corridorPageSize}
                onPageChange={(nextPage) => {
                  setCorridorPage(nextPage);
                  void reload(
                    violationPage,
                    violationPageSize,
                    outagePage,
                    outagePageSize,
                    incidentPage,
                    incidentPageSize,
                    regulationPage,
                    regulationPageSize,
                    nextPage,
                    corridorPageSize,
                  );
                }}
                onRecordsPerPageChange={(nextSize) => {
                  setCorridorPage(1);
                  setCorridorPageSize(nextSize);
                  void reload(
                    violationPage,
                    violationPageSize,
                    outagePage,
                    outagePageSize,
                    incidentPage,
                    incidentPageSize,
                    regulationPage,
                    regulationPageSize,
                    1,
                    nextSize,
                  );
                }}
                fetching={loading}
                rowExpansion={{
                  allowMultiple: true,
                  content: ({ record }) => (
                    <SimpleGrid cols={{ base: 1, sm: 3 }} p="sm">
                      <div>
                        <Text size="xs" c="dimmed" fw={800}>
                          Rule / pháp lý
                        </Text>
                        <Text size="sm">{record.regulationCode ?? "—"}</Text>
                        <Text size="xs" c="dimmed">
                          {record.legalDocumentRef ?? "Chưa gắn văn bản"}
                        </Text>
                      </div>
                      <div>
                        <Text size="xs" c="dimmed" fw={800}>
                          Hình học / diện tích
                        </Text>
                        <Text size="sm">
                          {(record.areaM2 / 10000).toLocaleString("vi-VN", {
                            maximumFractionDigits: 2,
                          })}{" "}
                          ha
                        </Text>
                        <Text size="xs" c="dimmed">
                          {record.corridorWidthM == null
                            ? "Chưa có bề rộng"
                            : record.corridorWidthM + " m"}
                        </Text>
                      </div>
                      <div>
                        <Text size="xs" c="dimmed" fw={800}>
                          Phiên bản / trạng thái
                        </Text>
                        <Text size="sm">{record.status}</Text>
                        <Text size="xs" c="dimmed">
                          Asset {record.assetId}
                        </Text>
                      </div>
                    </SimpleGrid>
                  ),
                }}
                emptyState={
                  <Text c="dimmed" ta="center" py="xl">
                    Chưa có corridor geometry.
                  </Text>
                }
              />
            </Paper>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="outages" pt="lg">
          <Paper radius="xl" p="lg" withBorder className="energy-glass">
            <Group justify="space-between" mb="md">
              <div>
                <Title order={3}>Lịch cắt điện / cúp điện</Title>
                <Text size="sm" c="dimmed">
                  Lưu lịch EVN công khai, thời gian, lý do, số khách hàng và vùng ảnh hưởng sơ bộ.
                </Text>
              </div>
              <Button leftSection={<IconPlus size={16} />} onClick={() => setOpened("outage")}>
                Thêm lịch
              </Button>
            </Group>
            <CrudDataTable
              records={outages}
              filterPlaceholder="Mã, nội dung hoặc nguồn cắt điện..."
              filters={[
                { key: "status", label: "Trạng thái", options: ["PLANNED", "ANNOUNCED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map((value) => ({ value, label: value })) },
                { key: "sourceType", label: "Nguồn dữ liệu", options: ["MANUAL", "EVN_API", "EVN_WEB", "EVN_FILE", "IMPORT"].map((value) => ({ value, label: value })) },
              ]}
              columns={outageColumns}
              idAccessor="id"
              page={outagePage}
              totalRecords={outageTotal}
              recordsPerPage={outagePageSize}
              onPageChange={(nextPage) => {
                setOutagePage(nextPage);
                void reload(
                  violationPage,
                  violationPageSize,
                  nextPage,
                  outagePageSize,
                  incidentPage,
                  incidentPageSize,
                );
              }}
              onRecordsPerPageChange={(nextSize) => {
                setOutagePage(1);
                setOutagePageSize(nextSize);
                void reload(
                  violationPage,
                  violationPageSize,
                  1,
                  nextSize,
                  incidentPage,
                  incidentPageSize,
                );
              }}
              fetching={loading}
              rowExpansion={{
                allowMultiple: true,
                content: ({ record }) => (
                  <SimpleGrid cols={{ base: 1, sm: 3 }} p="sm">
                    <div>
                      <Text size="xs" c="dimmed" fw={800}>
                        Nội dung / lý do
                      </Text>
                      <Text size="sm">{record.title}</Text>
                      <Text size="xs" c="dimmed">
                        {record.reason ?? "Chưa có lý do"}
                      </Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed" fw={800}>
                        Nguồn
                      </Text>
                      <Text size="sm">
                        {record.source} · {record.sourceType}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {record.sourceUrl ?? record.sourceRecordId ?? "Chưa có source reference"}
                      </Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed" fw={800}>
                        Tác động
                      </Text>
                      <Text size="sm">
                        {record.affectedCustomers?.toLocaleString("vi-VN") ?? "—"} khách hàng
                      </Text>
                      <Text size="xs" c="dimmed">
                        {record.impactMethod ?? "Chưa tính vùng ảnh hưởng"}
                      </Text>
                    </div>
                  </SimpleGrid>
                ),
              }}
              emptyState={
                <Text c="dimmed" ta="center" py="xl">
                  Chưa có lịch cắt điện.
                </Text>
              }
            />
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="incidents" pt="lg">
          <Paper radius="xl" p="lg" withBorder className="energy-glass">
            <Group justify="space-between" mb="md">
              <div>
                <Title order={3}>Sự cố lưới điện</Title>
                <Text size="sm" c="dimmed">
                  Theo dõi asset liên quan, severity, khách hàng/công suất ảnh hưởng và quá trình
                  khôi phục.
                </Text>
              </div>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => {
                  setEditingIncident(null);
                  incidentForm.reset();
                  setOpened("incident");
                }}
              >
                Ghi sự cố
              </Button>
            </Group>
            <CrudDataTable
              records={incidents}
              filterPlaceholder="Mã sự cố, loại hoặc tài sản..."
              filters={[
                { key: "severity", label: "Mức độ", options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => ({ value, label: value })) },
                { key: "status", label: "Trạng thái", options: ["OPEN", "INVESTIGATING", "RESTORING", "RESOLVED", "CLOSED"].map((value) => ({ value, label: value })) },
              ]}
              columns={incidentColumns}
              idAccessor="id"
              page={incidentPage}
              totalRecords={incidentTotal}
              recordsPerPage={incidentPageSize}
              onPageChange={(nextPage) => {
                setIncidentPage(nextPage);
                void reload(
                  violationPage,
                  violationPageSize,
                  outagePage,
                  outagePageSize,
                  nextPage,
                  incidentPageSize,
                );
              }}
              onRecordsPerPageChange={(nextSize) => {
                setIncidentPage(1);
                setIncidentPageSize(nextSize);
                void reload(
                  violationPage,
                  violationPageSize,
                  outagePage,
                  outagePageSize,
                  1,
                  nextSize,
                );
              }}
              fetching={loading}
              rowExpansion={{
                allowMultiple: true,
                content: ({ record }) => (
                  <SimpleGrid cols={{ base: 1, sm: 3 }} p="sm">
                    <div>
                      <Text size="xs" c="dimmed" fw={800}>
                        Tài sản liên quan
                      </Text>
                      <Text size="sm">{record.assetName ?? "Chưa gắn tài sản"}</Text>
                      <Text size="xs" c="dimmed">
                        {record.assetCode ?? record.assetId ?? "—"}
                      </Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed" fw={800}>
                        Ảnh hưởng
                      </Text>
                      <Text size="sm">
                        {record.affectedCustomers?.toLocaleString("vi-VN") ?? "—"} khách hàng
                      </Text>
                      <Text size="xs" c="dimmed">
                        {record.affectedLoadMw == null
                          ? "Chưa có công suất mất tải"
                          : `${record.affectedLoadMw} MW`}
                      </Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed" fw={800}>
                        Nguyên nhân / khôi phục
                      </Text>
                      <Text size="sm">{record.cause ?? "Chưa khai báo nguyên nhân"}</Text>
                      <Text size="xs" c="dimmed">
                        Kết thúc:{" "}
                        {record.resolvedAt ? fmtDate(record.resolvedAt) : "Chưa khôi phục"}
                      </Text>
                    </div>
                  </SimpleGrid>
                ),
              }}
              emptyState={
                <Text c="dimmed" ta="center" py="xl">
                  Chưa có sự cố.
                </Text>
              }
            />
          </Paper>
        </Tabs.Panel>
      </Tabs>

      <Drawer
        opened={opened === "regulation"}
        onClose={() => setOpened(null)}
        title="Thêm quy định / rule hành lang"
        position="right"
        size="lg"
      >
        <form noValidate onSubmit={saveRegulation}>
          <Stack>
            <FormValidationAlert errors={regulationForm.formState.errors} />
            <SimpleGrid cols={2}>
              <TextInput
                label="Mã version"
                withAsterisk
                error={regulationForm.formState.errors.code?.message}
                {...regulationForm.register("code")}
              />
              <Controller
                control={regulationForm.control}
                name="status"
                render={({ field }) => (
                  <Select
                    label="Trạng thái"
                    data={["DRAFT", "ACTIVE", "SUPERSEDED", "EXPIRED"]}
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? "ACTIVE")}
                  />
                )}
              />
            </SimpleGrid>
            <TextInput
              label="Tên quy định"
              withAsterisk
              error={regulationForm.formState.errors.name?.message}
              {...regulationForm.register("name")}
            />
            <TextInput
              label="Văn bản pháp lý / URL"
              withAsterisk
              error={regulationForm.formState.errors.legalDocumentRef?.message}
              {...regulationForm.register("legalDocumentRef")}
            />
            <SimpleGrid cols={2}>
              <TextInput
                type="date"
                label="Hiệu lực từ"
                withAsterisk
                error={regulationForm.formState.errors.effectiveFrom?.message}
                {...regulationForm.register("effectiveFrom")}
              />
              <TextInput
                type="date"
                label="Hiệu lực đến"
                error={regulationForm.formState.errors.effectiveTo?.message}
                {...regulationForm.register("effectiveTo")}
              />
            </SimpleGrid>
            <SimpleGrid cols={3}>
              <Controller
                control={regulationForm.control}
                name="voltageLevelKv"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Điện áp (kV)"
                    withAsterisk
                    error={fieldState.error?.message}
                    min={0}
                    value={field.value}
                    onChange={(v) => field.onChange(Number(v))}
                  />
                )}
              />
              <TextInput label="Loại tuyến" {...regulationForm.register("lineType")} />
              <TextInput label="Loại công trình" {...regulationForm.register("structureType")} />
            </SimpleGrid>
            <SimpleGrid cols={3}>
              <Controller
                control={regulationForm.control}
                name="horizontalClearanceM"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Khoảng cách ngang (m)"
                    error={fieldState.error?.message}
                    min={0}
                    decimalScale={3}
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v === "" ? null : Number(v))}
                  />
                )}
              />
              <Controller
                control={regulationForm.control}
                name="verticalClearanceM"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Khoảng cách dọc (m)"
                    error={fieldState.error?.message}
                    min={0}
                    decimalScale={3}
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v === "" ? null : Number(v))}
                  />
                )}
              />
              <Controller
                control={regulationForm.control}
                name="corridorWidthM"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Bề rộng hành lang (m)"
                    error={fieldState.error?.message}
                    min={0}
                    decimalScale={3}
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v === "" ? null : Number(v))}
                  />
                )}
              />
            </SimpleGrid>
            <Textarea
              label="Ghi chú nguồn/rule"
              minRows={3}
              {...regulationForm.register("notes")}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setOpened(null)}>
                Hủy
              </Button>
              <Button type="submit" loading={saving}>
                Lưu quy định
              </Button>
            </Group>
          </Stack>
        </form>
      </Drawer>

      <Drawer
        opened={opened === "violation"}
        onClose={() => setOpened(null)}
        title="Ghi nhận vi phạm hành lang"
        position="right"
        size="lg"
      >
        <form noValidate onSubmit={saveViolation}>
          <Stack>
            <FormValidationAlert errors={violationForm.formState.errors} />
            <Controller
              control={violationForm.control}
              name="corridorId"
              render={({ field, fieldState }) => (
                <Select
                  label="Hành lang / tuyến"
                  withAsterisk
                  error={fieldState.error?.message}
                  searchable
                  data={corridorOptions.map((c) => ({
                    value: c.id,
                    label: `${c.assetCode} • ${c.assetName}`,
                  }))}
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? "")}
                />
              )}
            />
            <SimpleGrid cols={2}>
              <TextInput
                label="Mã vi phạm"
                withAsterisk
                error={violationForm.formState.errors.code?.message}
                {...violationForm.register("code")}
              />
              <Controller
                control={violationForm.control}
                name="severity"
                render={({ field }) => (
                  <Select
                    label="Mức độ"
                    data={["LOW", "MEDIUM", "HIGH", "CRITICAL"]}
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? "MEDIUM")}
                  />
                )}
              />
            </SimpleGrid>
            <SimpleGrid cols={2}>
              <Controller
                control={violationForm.control}
                name="violationType"
                render={({ field }) => (
                  <Select
                    label="Loại vi phạm"
                    data={[
                      "TREE_INTRUSION",
                      "CONSTRUCTION_INTRUSION",
                      "SIGNBOARD",
                      "FIRE_SMOKE",
                      "FOREIGN_OBJECT",
                      "OTHER",
                    ]}
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? "OTHER")}
                  />
                )}
              />
              <Controller
                control={violationForm.control}
                name="source"
                render={({ field }) => (
                  <Select
                    label="Nguồn phát hiện"
                    data={["FIELD", "EVN", "AI_VISION", "CITIZEN", "OTHER"]}
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? "FIELD")}
                  />
                )}
              />
            </SimpleGrid>
            <TextInput
              type="datetime-local"
              label="Thời điểm phát hiện"
              withAsterisk
              error={violationForm.formState.errors.detectedAt?.message}
              {...violationForm.register("detectedAt")}
            />
            <SimpleGrid cols={3}>
              <Controller
                control={violationForm.control}
                name="latitude"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Latitude"
                    withAsterisk
                    error={fieldState.error?.message}
                    decimalScale={7}
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v === "" ? null : Number(v))}
                  />
                )}
              />
              <Controller
                control={violationForm.control}
                name="longitude"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Longitude"
                    withAsterisk
                    error={fieldState.error?.message}
                    decimalScale={7}
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v === "" ? null : Number(v))}
                  />
                )}
              />
              <Controller
                control={violationForm.control}
                name="distanceM"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Khoảng cách (m)"
                    error={fieldState.error?.message}
                    min={0}
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v === "" ? null : Number(v))}
                  />
                )}
              />
            </SimpleGrid>
            <TextInput label="Ảnh / evidence URL" {...violationForm.register("evidenceRef")} />
            <SimpleGrid cols={2}>
              <TextInput
                label="AI label"
                placeholder="TREE_INTRUSION..."
                error={violationForm.formState.errors.aiLabel?.message}
                {...violationForm.register("aiLabel")}
              />
              <Controller
                control={violationForm.control}
                name="aiConfidencePct"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="AI confidence (%)"
                    error={fieldState.error?.message}
                    min={0}
                    max={100}
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v === "" ? null : Number(v))}
                  />
                )}
              />
            </SimpleGrid>
            <Textarea
              label="Ghi chú hiện trường"
              minRows={4}
              {...violationForm.register("notes")}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setOpened(null)}>
                Hủy
              </Button>
              <Button type="submit" loading={saving} leftSection={<IconLeaf size={16} />}>
                Lưu vi phạm
              </Button>
            </Group>
          </Stack>
        </form>
      </Drawer>

      <Drawer
        opened={opened === "outage"}
        onClose={() => setOpened(null)}
        title="Thêm lịch cắt điện"
        position="right"
        size="lg"
      >
        <form noValidate onSubmit={saveOutage}>
          <Stack>
            <FormValidationAlert errors={outageForm.formState.errors} />
            <SimpleGrid cols={2}>
              <TextInput
                label="Mã lịch"
                withAsterisk
                error={outageForm.formState.errors.code?.message}
                {...outageForm.register("code")}
              />
              <TextInput
                label="Nguồn"
                withAsterisk
                error={outageForm.formState.errors.source?.message}
                {...outageForm.register("source")}
              />
            </SimpleGrid>
            <TextInput
              label="Nội dung"
              withAsterisk
              error={outageForm.formState.errors.title?.message}
              {...outageForm.register("title")}
            />
            <SimpleGrid cols={2}>
              <TextInput
                type="datetime-local"
                label="Bắt đầu"
                withAsterisk
                error={outageForm.formState.errors.startAt?.message}
                {...outageForm.register("startAt")}
              />
              <TextInput
                type="datetime-local"
                label="Kết thúc"
                withAsterisk
                error={outageForm.formState.errors.endAt?.message}
                {...outageForm.register("endAt")}
              />
            </SimpleGrid>
            <SimpleGrid cols={2}>
              <Controller
                control={outageForm.control}
                name="affectedCustomers"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Khách hàng ảnh hưởng"
                    error={fieldState.error?.message}
                    min={0}
                    allowDecimal={false}
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v === "" ? null : Number(v))}
                  />
                )}
              />
              <Controller
                control={outageForm.control}
                name="status"
                render={({ field }) => (
                  <Select
                    label="Trạng thái"
                    data={["PLANNED", "ANNOUNCED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]}
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? "PLANNED")}
                  />
                )}
              />
            </SimpleGrid>
            <Textarea label="Lý do / phạm vi mô tả" {...outageForm.register("reason")} />
            <Text fw={800} size="sm">
              Vùng ảnh hưởng sơ bộ trên GIS (tùy chọn)
            </Text>
            <SimpleGrid cols={3}>
              <Controller
                control={outageForm.control}
                name="centerLatitude"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Latitude tâm"
                    error={fieldState.error?.message}
                    decimalScale={7}
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v === "" ? null : Number(v))}
                  />
                )}
              />
              <Controller
                control={outageForm.control}
                name="centerLongitude"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Longitude tâm"
                    error={fieldState.error?.message}
                    decimalScale={7}
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v === "" ? null : Number(v))}
                  />
                )}
              />
              <Controller
                control={outageForm.control}
                name="affectedRadiusM"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Bán kính (m)"
                    error={fieldState.error?.message}
                    min={1}
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v === "" ? null : Number(v))}
                  />
                )}
              />
            </SimpleGrid>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setOpened(null)}>
                Hủy
              </Button>
              <Button type="submit" loading={saving}>
                Lưu lịch
              </Button>
            </Group>
          </Stack>
        </form>
      </Drawer>

      <Drawer
        opened={Boolean(selectedOutage)}
        onClose={() => {
          setSelectedOutage(null);
          setOutageImpact(null);
        }}
        title={selectedOutage ? `Chi tiết lịch cắt điện ${selectedOutage.code}` : "Chi tiết lịch cắt điện"}
        position="right"
        size="lg"
      >
        {selectedOutage ? (
          <Stack gap="md">
            <Paper p="md" radius="md" withBorder bg="red.0">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text size="xs" c="dimmed" fw={800}>NỘI DUNG CẮT ĐIỆN</Text>
                  <Title order={3}>{selectedOutage.title}</Title>
                </div>
                <Badge color={statusColor(selectedOutage.status)}>{selectedOutage.status}</Badge>
              </Group>
              <Text size="sm" mt="sm">{selectedOutage.reason ?? "Chưa cập nhật lý do cắt điện."}</Text>
            </Paper>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Paper p="md" withBorder bg="red.0">
                <Text size="xs" c="red.8" fw={800}>THỜI GIAN CẮT ĐIỆN</Text>
                <Text fw={900} c="red.8">{fmtDate(selectedOutage.startAt)}</Text>
                <Text size="xs" c="dimmed">Bắt đầu theo kế hoạch</Text>
              </Paper>
              <Paper p="md" withBorder bg="green.0">
                <Text size="xs" c="green.8" fw={800}>DỰ KIẾN CÓ ĐIỆN LẠI</Text>
                <Text fw={900} c="green.8">{fmtDate(selectedOutage.endAt)}</Text>
                <Text size="xs" c="dimmed">Kết thúc theo kế hoạch</Text>
              </Paper>
            </SimpleGrid>
            <Paper p="md" withBorder>
              <Text size="xs" c="dimmed" fw={800}>PHẠM VI VÀ NGUỒN DỮ LIỆU</Text>
              <SimpleGrid cols={{ base: 1, sm: 2 }} mt="xs">
                <Text size="sm">Khách hàng dự kiến: <b>{selectedOutage.affectedCustomers?.toLocaleString("vi-VN") ?? "—"}</b></Text>
                <Text size="sm">Geometry: <b>{selectedOutage.affectedGeometry ? "Có vùng GIS" : "Chưa có"}</b></Text>
                <Text size="sm">Nguồn: <b>{selectedOutage.source} · {selectedOutage.sourceType}</b></Text>
                <Text size="sm">Phương pháp: <b>{selectedOutage.impactMethod ?? "Chưa tính"}</b></Text>
              </SimpleGrid>
            </Paper>
            {outageDetailLoading ? <Text size="sm" c="dimmed">Đang tải chi tiết tài sản và khu vực ảnh hưởng...</Text> : null}
            {outageImpact ? (
              <>
                <SimpleGrid cols={{ base: 2, sm: 4 }}>
                  <Paper p="sm" withBorder><Text size="xs" c="dimmed">Tài sản</Text><Text fw={900}>{outageImpact.summary?.affectedAssets ?? 0}</Text></Paper>
                  <Paper p="sm" withBorder><Text size="xs" c="dimmed">Khu vực</Text><Text fw={900}>{outageImpact.summary?.affectedAreas ?? 0}</Text></Paper>
                  <Paper p="sm" withBorder><Text size="xs" c="dimmed">Phụ tải (MW)</Text><Text fw={900}>{outageImpact.summary?.affectedLoadMw?.toLocaleString("vi-VN") ?? "—"}</Text></Paper>
                  <Paper p="sm" withBorder><Text size="xs" c="dimmed">KH topology</Text><Text fw={900}>{outageImpact.summary?.affectedCustomers ?? 0}</Text></Paper>
                </SimpleGrid>
                {outageImpact.assets?.length ? <Paper p="md" withBorder><Text fw={800} mb="xs">Đường dây / tài sản liên quan</Text><Stack gap={4}>{outageImpact.assets.map((asset) => <Text size="sm" key={`${asset.code}-${asset.relationType}`}>{asset.code} · {asset.name} <Text span size="xs" c="dimmed">({asset.assetType} · {asset.relationType})</Text></Text>)}</Stack></Paper> : null}
                {outageImpact.areas?.length ? <Paper p="md" withBorder><Text fw={800} mb="xs">Khu vực hành chính dự kiến ảnh hưởng</Text><Stack gap={4}>{outageImpact.areas.map((area) => <Text size="sm" key={area.adminAreaCode}>{area.adminAreaCode} · {area.affectedCustomerCount?.toLocaleString("vi-VN") ?? "—"} khách hàng · {area.affectedLoadMw?.toLocaleString("vi-VN") ?? "—"} MW</Text>)}</Stack></Paper> : null}
                {outageImpact.warnings?.length ? <Alert color="orange" title="Lưu ý phạm vi">{outageImpact.warnings.join(" ")}</Alert> : null}
              </>
            ) : null}
          </Stack>
        ) : null}
      </Drawer>

      <Drawer
        opened={opened === "incident"}
        onClose={() => {
          setOpened(null);
          setEditingIncident(null);
        }}
        title={editingIncident ? `Cập nhật sự cố ${editingIncident.code}` : "Ghi nhận sự cố lưới"}
        position="right"
        size="lg"
      >
        <form noValidate onSubmit={saveIncident}>
          <Stack>
            <FormValidationAlert errors={incidentForm.formState.errors} />
            <SimpleGrid cols={2}>
              <TextInput
                label="Mã sự cố"
                withAsterisk
                error={incidentForm.formState.errors.code?.message}
                {...incidentForm.register("code")}
              />
              <Controller
                control={incidentForm.control}
                name="severity"
                render={({ field }) => (
                  <Select
                    label="Mức độ"
                    data={["LOW", "MEDIUM", "HIGH", "CRITICAL"]}
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? "MEDIUM")}
                  />
                )}
              />
            </SimpleGrid>
            <Controller
              control={incidentForm.control}
              name="assetId"
              render={({ field }) => (
                <Select
                  label="Tài sản lưới liên quan"
                  searchable
                  clearable
                  data={gridAssets.map((a) => ({
                    value: a.id,
                    label: `${a.code} • ${a.name} (${a.assetType})`,
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <TextInput
              label="Loại sự cố"
              withAsterisk
              error={incidentForm.formState.errors.incidentType?.message}
              {...incidentForm.register("incidentType")}
            />
            <SimpleGrid cols={2}>
              <TextInput
                type="datetime-local"
                label="Bắt đầu"
                withAsterisk
                error={incidentForm.formState.errors.startedAt?.message}
                {...incidentForm.register("startedAt")}
              />
              <TextInput
                type="datetime-local"
                label="Khôi phục"
                error={incidentForm.formState.errors.resolvedAt?.message}
                {...incidentForm.register("resolvedAt")}
              />
            </SimpleGrid>
            <SimpleGrid cols={3}>
              <Controller
                control={incidentForm.control}
                name="affectedCustomers"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="KH ảnh hưởng"
                    error={fieldState.error?.message}
                    min={0}
                    allowDecimal={false}
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v === "" ? null : Number(v))}
                  />
                )}
              />
              <Controller
                control={incidentForm.control}
                name="affectedLoadMw"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Mất tải (MW)"
                    error={fieldState.error?.message}
                    min={0}
                    decimalScale={3}
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v === "" ? null : Number(v))}
                  />
                )}
              />
              <Controller
                control={incidentForm.control}
                name="status"
                render={({ field }) => (
                  <Select
                    label="Trạng thái"
                    data={["OPEN", "INVESTIGATING", "RESTORING", "RESOLVED", "CLOSED"]}
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? "OPEN")}
                  />
                )}
              />
            </SimpleGrid>
            <Textarea label="Nguyên nhân" minRows={3} {...incidentForm.register("cause")} />
            <Textarea label="Ghi chú xử lý" minRows={3} {...incidentForm.register("notes")} />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setOpened(null)}>
                Hủy
              </Button>
              <Button type="submit" loading={saving}>
                {editingIncident ? "Lưu thay đổi" : "Lưu sự cố"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Drawer>
      <Modal
        opened={Boolean(selectedRegulation)}
        onClose={() => setSelectedRegulation(null)}
        title="Chi tiết quy định"
        size="lg"
      >
        <Stack>
          <Text fw={900}>
            {selectedRegulation?.code} · {selectedRegulation?.name}
          </Text>
          <Text size="sm" c="dimmed">
            {selectedRegulation?.legalDocumentRef} · {selectedRegulation?.status}
          </Text>
          {selectedRegulation?.rules.map((rule) => (
            <Paper key={rule.id} p="sm" withBorder>
              <Text fw={800}>
                {Number(rule.voltageLevelKv)} kV · {rule.lineType ?? "Tất cả"} ·{" "}
                {rule.structureType ?? "Tất cả"}
              </Text>
              <Text size="sm">
                Ngang:{" "}
                {rule.horizontalClearanceM == null ? "—" : Number(rule.horizontalClearanceM) + " m"}{" "}
                · Dọc:{" "}
                {rule.verticalClearanceM == null ? "—" : Number(rule.verticalClearanceM) + " m"} ·
                Hành lang: {rule.corridorWidthM == null ? "—" : Number(rule.corridorWidthM) + " m"}
              </Text>
            </Paper>
          ))}
        </Stack>
      </Modal>
      <Modal
        opened={Boolean(selectedCorridor)}
        onClose={() => setSelectedCorridor(null)}
        title="Chi tiết corridor"
        size="lg"
      >
        <Stack>
          <Text fw={900}>
            {selectedCorridor?.assetCode} · {selectedCorridor?.assetName}
          </Text>
          <SimpleGrid cols={2}>
            <div>
              <Text size="xs" c="dimmed" fw={800}>
                Rule
              </Text>
              <Text>{selectedCorridor?.regulationCode ?? "—"}</Text>
              <Text size="xs" c="dimmed">
                {selectedCorridor?.legalDocumentRef ?? "Chưa gắn văn bản"}
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" fw={800}>
                Hình học
              </Text>
              <Text>
                {selectedCorridor?.corridorWidthM == null
                  ? "—"
                  : selectedCorridor.corridorWidthM + " m"}
              </Text>
              <Text size="xs" c="dimmed">
                {selectedCorridor?.areaM2 == null
                  ? "—"
                  : `${(selectedCorridor.areaM2 / 10000).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} ha`}
              </Text>
            </div>
          </SimpleGrid>
        </Stack>
      </Modal>
      <Modal
        opened={Boolean(selectedIncident)}
        onClose={() => setSelectedIncident(null)}
        title="Chi tiết sự cố"
        size="lg"
      >
        <Stack>
          <Text fw={900}>
            {selectedIncident?.code} · {selectedIncident?.incidentType}
          </Text>
          <Text size="sm" c="dimmed">
            {selectedIncident?.assetName ?? "Chưa gắn tài sản"} · {selectedIncident?.status}
          </Text>
          <SimpleGrid cols={2}>
            <div>
              <Text size="xs" c="dimmed" fw={800}>
                Thời gian
              </Text>
              <Text>{selectedIncident?.startedAt ? fmtDate(selectedIncident.startedAt) : "—"}</Text>
              <Text size="xs" c="dimmed">
                Khôi phục:{" "}
                {selectedIncident?.resolvedAt
                  ? fmtDate(selectedIncident.resolvedAt)
                  : "Chưa khôi phục"}
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" fw={800}>
                Ảnh hưởng
              </Text>
              <Text>
                {selectedIncident?.affectedCustomers?.toLocaleString("vi-VN") ?? "—"} khách hàng
              </Text>
              <Text size="xs" c="dimmed">
                {selectedIncident?.affectedLoadMw == null
                  ? "Chưa có MW"
                  : `${selectedIncident.affectedLoadMw} MW`}
              </Text>
            </div>
          </SimpleGrid>
          <Text>{selectedIncident?.cause ?? "Chưa khai báo nguyên nhân"}</Text>
        </Stack>
      </Modal>
    </Stack>
  );
}
