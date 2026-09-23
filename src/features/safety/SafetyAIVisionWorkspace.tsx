"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Eye,
  FileCheck2,
  History,
  ImageIcon,
  MapPinned,
  Play,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import type { MissionMarker } from "@/components/energy/MissionGisMap";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/lib/router-compat";
import { cn } from "@/lib/utils";

const MissionGisMap = dynamic(
  () => import("@/components/energy/MissionGisMap").then((module) => module.MissionGisMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[360px] items-center justify-center rounded-lg bg-surface text-sm text-muted-foreground">
        <RefreshCw className="mr-2 size-4 animate-spin" /> Đang tải bản đồ GIS…
      </div>
    ),
  },
);

type PointGeometry = { type?: string; coordinates?: unknown } | null;

type Inspection = {
  id: string;
  inspectionCode: string;
  inspectionType: string;
  corridorId: string | null;
  corridorCode: string | null;
  corridorName: string | null;
  assetId: string | null;
  inspector: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  source: string;
  notes: string | null;
  geometry: PointGeometry;
  mediaCount: number;
  violationCount: number;
};

type Media = {
  id: string;
  inspectionId: string;
  mediaType: string;
  title: string;
  fileRef: string | null;
  sourceUrl: string | null;
  checksum: string | null;
  status: string;
  capturedAt: string | null;
  assetHint: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  geometry: PointGeometry;
  inspection: Inspection;
};

type VisionRun = {
  id: string;
  mediaId: string;
  mediaTitle: string;
  inspectionId: string;
  modelProvider: string;
  modelName: string;
  modelVersion: string;
  configVersion: string;
  inputHash: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  errorMessage: string | null;
  matchedAssetId: string | null;
  matchedAssetMethod: string | null;
  matchedDistanceM: number | null;
  detectionCount: number;
  pendingDetectionCount: number;
};

type Detection = {
  id: string;
  runId: string;
  label: string;
  confidence: number;
  riskScore: number | null;
  suggestedSeverity: string | null;
  suggestedViolationType: string | null;
  bbox: Record<string, unknown> | null;
  explanation: Record<string, unknown>;
  reviewStatus: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdViolationId: string | null;
};

type RunDetail = VisionRun & {
  mediaFileRef: string | null;
  mediaSourceUrl: string | null;
  mediaChecksum: string | null;
  capturedAt: string | null;
  inspectionCode: string;
  rawOutput: Record<string, unknown>;
  createdBy: string | null;
  detections: Detection[];
};

type Runtime = { endpointConfigured: boolean };

type ReviewDraft = {
  decision: "CONFIRM" | "REJECT" | "ADJUST";
  reviewer: string;
  finalLabel: string;
  finalSeverity: string;
  finalViolationType: string;
  createViolation: boolean;
  note: string;
};

type DemoDetection = {
  label: string;
  confidence: number;
  riskScore: number;
  bbox: { x: number; y: number; width: number; height: number };
  explanation: Record<string, unknown>;
};

const DEMO_IMAGE_REFERENCE = /^\/images\/safety\/inspection_00[1-7]\.jpg$/i;

function isDemoInspectionImage(reference: string | null | undefined) {
  return Boolean(reference && DEMO_IMAGE_REFERENCE.test(reference.trim().replaceAll("\\", "/")));
}

function demoImageName(item: Media) {
  const reference = item.fileRef ?? item.sourceUrl ?? "";
  return reference.split("/").pop() ?? item.title;
}

const LABELS: Record<string, string> = {
  TREE_INTRUSION: "Cây xanh xâm phạm hành lang",
  TREE_NEAR_CONDUCTOR: "Cây xanh gần dây dẫn",
  VEGETATION_OVERGROWTH: "Thảm thực vật phát triển quá mức",
  CONSTRUCTION_INTRUSION: "Công trình xâm phạm hành lang",
  CRANE_NEAR_LINE: "Thiết bị nâng gần đường dây",
  SIGNBOARD_INTRUSION: "Biển quảng cáo trong hành lang",
  FOREIGN_OBJECT: "Vật thể lạ trên lưới",
  FIRE: "Điểm cháy gần lưới",
  SMOKE: "Khói gần thiết bị điện",
  BROKEN_INSULATOR: "Sứ cách điện bất thường",
  DAMAGED_POLE: "Cột điện có dấu hiệu hư hỏng",
  CONDUCTOR_SAG_ANOMALY: "Độ võng dây dẫn bất thường",
  OTHER: "Bất thường thiết bị điện",
};

const SEVERITY_LABELS: Record<string, string> = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  CRITICAL: "Rất cao",
};

const STATUS_LABELS: Record<string, string> = {
  SUCCEEDED: "Chờ rà soát",
  REVIEWED: "Đã rà soát",
  FAILED: "Thất bại",
  RUNNING: "Đang phân tích",
  QUEUED: "Đang chờ",
  CANCELLED: "Đã hủy",
  PENDING_HUMAN_REVIEW: "Chờ cán bộ duyệt",
  CONFIRMED: "Đã xác nhận",
  REJECTED: "Đã loại",
};

const VIOLATION_TYPES: Record<string, string> = {
  TREE_INTRUSION: "Cây xanh lấn hành lang",
  CONSTRUCTION_INTRUSION: "Công trình lấn hành lang",
  SIGNBOARD: "Biển quảng cáo",
  FIRE_SMOKE: "Khói hoặc cháy",
  FOREIGN_OBJECT: "Vật thể lạ",
  OTHER: "Nguy cơ khác",
};

function labelText(value: string | null | undefined) {
  if (!value) return "Chưa phân loại";
  return LABELS[value] ?? value.replaceAll("_", " ");
}

function statusText(value: string) {
  return STATUS_LABELS[value] ?? value;
}

function dateText(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

function pointCoordinates(geometry: PointGeometry) {
  const coordinates = geometry?.coordinates;
  if (!Array.isArray(coordinates)) return null;
  const longitude = Number(coordinates[0]);
  const latitude = Number(coordinates[1]);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

function statusClass(status: string) {
  if (["REVIEWED", "CONFIRMED"].includes(status))
    return "border-success/30 bg-success/10 text-success";
  if (["FAILED", "REJECTED", "CRITICAL"].includes(status))
    return "border-destructive/30 bg-destructive/10 text-destructive";
  if (["SUCCEEDED", "PENDING_HUMAN_REVIEW", "HIGH", "MEDIUM"].includes(status))
    return "border-warning/40 bg-warning/10 text-warning";
  return "border-gov/30 bg-gov/10 text-gov";
}

async function readJson<T>(response: Response) {
  const data = (await response.json()) as T & { message?: string };
  if (!response.ok) throw new Error(data.message ?? "Không thể hoàn tất yêu cầu.");
  return data;
}

function demoDetectionsFor(media: Media): DemoDetection[] {
  const source = `${media.title} ${media.fileRef ?? ""}`.toUpperCase();
  const baseExplanation = {
    source: "NV5_DEMO_SCENARIO",
    authoritative: false,
    note: "Kết quả mô phỏng có kiểm soát trên ảnh minh họa; cần cán bộ xác nhận.",
  };
  if (source.includes("TREE") || source.includes("VEGETATION")) {
    return [
      {
        label: "TREE_INTRUSION",
        confidence: 0.94,
        riskScore: 0.92,
        bbox: { x: 0, y: 0, width: 900, height: 760 },
        explanation: baseExplanation,
      },
      {
        label: "TREE_NEAR_CONDUCTOR",
        confidence: 0.87,
        riskScore: 0.82,
        bbox: { x: 510, y: 12, width: 985, height: 610 },
        explanation: baseExplanation,
      },
    ];
  }
  if (source.includes("CONSTRUCTION")) {
    return [
      {
        label: "CONSTRUCTION_INTRUSION",
        confidence: 0.93,
        riskScore: 0.9,
        bbox: { x: 615, y: 405, width: 890, height: 570 },
        explanation: baseExplanation,
      },
      {
        label: "TREE_NEAR_CONDUCTOR",
        confidence: 0.76,
        riskScore: 0.64,
        bbox: { x: 0, y: 490, width: 300, height: 500 },
        explanation: baseExplanation,
      },
    ];
  }
  return [
    {
      label: "BROKEN_INSULATOR",
      confidence: 0.91,
      riskScore: 0.89,
      bbox: { x: 355, y: 0, width: 540, height: 760 },
      explanation: baseExplanation,
    },
    {
      label: "OTHER",
      confidence: 0.84,
      riskScore: 0.78,
      bbox: { x: 250, y: 360, width: 800, height: 330 },
      explanation: {
        ...baseExplanation,
        finding: "Đầu nối có dấu hiệu phát nhiệt hoặc tiếp xúc không ổn định.",
      },
    },
  ];
}

function defaultReview(detection: Detection): ReviewDraft {
  return {
    decision: "CONFIRM",
    reviewer: "Cán bộ an toàn điện",
    finalLabel: detection.label || "OTHER",
    finalSeverity: detection.suggestedSeverity || "MEDIUM",
    finalViolationType: detection.suggestedViolationType || "OTHER",
    createViolation: true,
    note: "Đã đối chiếu ảnh hiện trường và vị trí tài sản trước khi xác nhận.",
  };
}

export function SafetyAIVisionWorkspace() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [runs, setRuns] = useState<VisionRun[]>([]);
  const [runtime, setRuntime] = useState<Runtime>({ endpointConfigured: false });
  const [selectedMediaId, setSelectedMediaId] = useState("");
  const [selectedRun, setSelectedRun] = useState<RunDetail | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reviewDetection, setReviewDetection] = useState<Detection | null>(null);
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [inspectionData, runData] = await Promise.all([
        readJson<{ items: Inspection[] }>(
          await fetch("/api/safety/inspections", { cache: "no-store" }),
        ),
        readJson<{ items: VisionRun[]; runtime?: Runtime }>(
          await fetch("/api/safety/ai-vision/runs?page=1&pageSize=50", { cache: "no-store" }),
        ),
      ]);
      const inspectionRows = inspectionData.items ?? [];
      const mediaGroups = await Promise.all(
        inspectionRows.map(async (inspection) => {
          const response = await readJson<{ items: Omit<Media, "inspection">[] }>(
            await fetch(`/api/safety/inspections/${inspection.id}/media`, { cache: "no-store" }),
          );
          return (response.items ?? []).map((item) => ({ ...item, inspection }));
        }),
      );
      const mediaRows = mediaGroups.flat().filter((item) =>
        isDemoInspectionImage(item.fileRef ?? item.sourceUrl),
      );
      setInspections(inspectionRows);
      setMedia(mediaRows);
      setRuns(runData.items ?? []);
      setRuntime(runData.runtime ?? { endpointConfigured: false });
      setSelectedMediaId((current) =>
        mediaRows.some((item) => item.id === current) ? current : (mediaRows[0]?.id ?? ""),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải dữ liệu AI an toàn điện.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selectedMedia = media.find((item) => item.id === selectedMediaId) ?? null;
  const selectedImage =
    selectedMedia?.fileRef ??
    selectedMedia?.sourceUrl ??
    selectedRun?.mediaFileRef ??
    selectedRun?.mediaSourceUrl ??
    null;
  const latestRunByMedia = useMemo(() => {
    const result = new Map<string, VisionRun>();
    for (const run of runs) if (!result.has(run.mediaId)) result.set(run.mediaId, run);
    return result;
  }, [runs]);
  const mapMarkers = useMemo<MissionMarker[]>(
    () =>
      inspections.flatMap((inspection) => {
        const point = pointCoordinates(inspection.geometry);
        return point
          ? [
              {
                id: inspection.id,
                code: inspection.inspectionCode,
                name: inspection.corridorName || "Phiếu kiểm tra an toàn",
                category: `${inspection.mediaCount} ảnh · ${inspection.violationCount} nguy cơ`,
                status: inspection.status,
                lat: point.latitude,
                lng: point.longitude,
              },
            ]
          : [];
      }),
    [inspections],
  );
  const totalDetections = runs.reduce((sum, item) => sum + item.detectionCount, 0);
  const pendingDetections = runs.reduce((sum, item) => sum + item.pendingDetectionCount, 0);
  const reviewedRuns = runs.filter((item) => item.status === "REVIEWED").length;

  const loadRun = async (runId: string, shouldOpen = true) => {
    setError("");
    try {
      const data = await readJson<{ item: Omit<RunDetail, "detections">; detections: Detection[] }>(
        await fetch(`/api/safety/ai-vision/runs/${runId}`, { cache: "no-store" }),
      );
      setSelectedRun({ ...data.item, detections: data.detections ?? [] });
      setSelectedMediaId(data.item.mediaId);
      if (shouldOpen) setDialogOpen(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể mở chi tiết lần chạy AI.");
    }
  };

  const openMedia = (item: Media) => {
    setSelectedMediaId(item.id);
    setSelectedRun(null);
    setWarning("");
    setDialogOpen(true);
    const latest = latestRunByMedia.get(item.id);
    if (latest) void loadRun(latest.id, false);
  };

  const openInspection = (inspectionId: string) => {
    const item = media.find((candidate) => candidate.inspectionId === inspectionId);
    if (item) openMedia(item);
  };

  const runAnalysis = async () => {
    if (!selectedMedia) return;
    setAnalyzing(true);
    setError("");
    setWarning("");
    const demoDetections = demoDetectionsFor(selectedMedia);
    const isExternal = runtime.endpointConfigured;
    try {
      const response = await readJson<{ item: VisionRun; warnings?: string[] }>(
        await fetch("/api/safety/ai-vision/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mediaId: selectedMedia.id,
            assetId: selectedMedia.inspection.assetId,
            modelProvider: isExternal ? "AI Vision Gateway" : "Kịch bản minh họa Nhiệm vụ 5",
            modelName: isExternal ? "grid-safety-vision" : "safety-vision-demo",
            modelVersion: "1.0",
            configVersion: "nv5-vision-v2",
            executionMode: isExternal ? "HTTP_ENDPOINT" : "MODEL_OUTPUT_IMPORT",
            rawOutput: isExternal
              ? {}
              : {
                  detections: demoDetections,
                  source: "NV5_DEMO_SCENARIO",
                  authoritative: false,
                  recommendation:
                    "Kết quả chỉ hỗ trợ sàng lọc; cán bộ phải duyệt từng phát hiện trước khi lập hồ sơ.",
                },
            detections: isExternal ? undefined : demoDetections,
            createdBy: "Workspace AI an toàn điện",
          }),
        }),
      );
      setWarning(
        response.warnings?.filter(Boolean).join(" ") ||
          (isExternal
            ? "AI đã hoàn tất phân tích ảnh."
            : "Đã tạo kết quả mô phỏng có kiểm soát; dữ liệu chưa phải kết luận hiện trường."),
      );
      await reload();
      await loadRun(response.item.id, false);
      toast.success("Đã lưu lần phân tích và các vùng phát hiện.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Không thể phân tích ảnh.";
      setError(message);
      toast.error(message);
    } finally {
      setAnalyzing(false);
    }
  };

  const startReview = (detection: Detection) => {
    setReviewDetection(detection);
    setReviewDraft(defaultReview(detection));
  };

  const submitReview = async () => {
    if (!reviewDetection || !reviewDraft || !selectedRun) return;
    const inspection = inspections.find((item) => item.id === selectedRun.inspectionId);
    const sourceMedia = media.find((item) => item.id === selectedRun.mediaId);
    const point = pointCoordinates(sourceMedia?.geometry ?? inspection?.geometry ?? null);
    const createViolation = reviewDraft.decision !== "REJECT" && reviewDraft.createViolation;
    if (createViolation && !inspection?.corridorId) {
      setError("Phiếu kiểm tra chưa gắn hành lang bảo vệ nên chưa thể lập hồ sơ vi phạm.");
      return;
    }
    setReviewing(true);
    setError("");
    try {
      await readJson(
        await fetch(`/api/safety/ai-vision/detections/${reviewDetection.id}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...reviewDraft,
            createViolation,
            corridorId: createViolation ? inspection?.corridorId : null,
            distanceM: selectedRun.matchedDistanceM,
            latitude: point?.latitude ?? null,
            longitude: point?.longitude ?? null,
          }),
        }),
      );
      setReviewDetection(null);
      setReviewDraft(null);
      await loadRun(selectedRun.id, false);
      await reload();
      toast.success(
        reviewDraft.decision === "REJECT"
          ? "Đã loại phát hiện AI."
          : "Đã lưu kết quả rà soát của cán bộ.",
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Không thể lưu kết quả rà soát.";
      setError(message);
      toast.error(message);
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="min-h-full bg-surface">
      <PageHeader
        title="AI kiểm tra an toàn bằng hình ảnh"
        description="Sàng lọc ảnh hiện trường, khoanh vùng nguy cơ, đối chiếu tài sản GIS và bắt buộc cán bộ duyệt trước khi lập hồ sơ vi phạm."
        variant="panel"
        icon={ShieldCheck}
        crumbs={[
          { label: "Năng lượng", to: "/energy" },
          { label: "Nhiệm vụ 5", to: "/energy/nhiem-vu-5" },
          { label: "AI an toàn điện" },
        ]}
        actions={
          <>
            <Badge
              variant="outline"
              className={cn(
                "rounded-md",
                runtime.endpointConfigured
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-warning/40 bg-warning/10 text-warning",
              )}
            >
              <Sparkles className="size-3" />
              {runtime.endpointConfigured ? "AI Vision Service" : "Mô phỏng có kiểm soát"}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
              <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Cập nhật
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/energy/nhiem-vu-5/quan-ly">
                <Settings2 className="size-4" /> Quản lý dữ liệu
              </Link>
            </Button>
          </>
        }
      />

      <main className="space-y-4 px-2 pb-8 sm:px-4 lg:px-6">
        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Ảnh hiện trường"
            value={media.length.toLocaleString("vi-VN")}
            icon={ImageIcon}
            tone="gov"
          />
          <StatCard
            label="Lần chạy AI"
            value={runs.length.toLocaleString("vi-VN")}
            icon={BrainCircuit}
            tone="analytics"
          />
          <StatCard
            label="Vùng phát hiện"
            value={totalDetections.toLocaleString("vi-VN")}
            icon={AlertTriangle}
            tone="warning"
          />
          <StatCard
            label="Chờ cán bộ duyệt"
            value={pendingDetections.toLocaleString("vi-VN")}
            icon={Clock3}
            tone={pendingDetections ? "danger" : "success"}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="gov-card overflow-hidden">
            <header className="flex items-center gap-3 border-b border-border px-4 py-3">
              <span className="flex size-9 items-center justify-center rounded-md bg-gov/10 text-gov">
                <MapPinned className="size-5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
                  Bản đồ phiếu kiểm tra
                </h2>
                <p className="text-xs text-muted-foreground">
                  Chọn một điểm để mở ảnh hiện trường và kết quả AI gần nhất.
                </p>
              </div>
            </header>
            <div className="p-3">
              <MissionGisMap
                missionId={5}
                markers={mapMarkers}
                selectedId={selectedMedia?.inspectionId}
                onSelect={openInspection}
              />
            </div>
          </div>

          <div className="gov-card overflow-hidden">
            <header className="flex items-center gap-3 border-b border-border px-4 py-3">
              <span className="flex size-9 items-center justify-center rounded-md bg-warning/15 text-warning">
                <ShieldCheck className="size-5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
                  Quy trình kiểm soát AI
                </h2>
                <p className="text-xs text-muted-foreground">
                  Không tự động biến phát hiện thành kết luận vi phạm.
                </p>
              </div>
            </header>
            <div className="space-y-3 p-4">
              {[
                [
                  "01",
                  "Ảnh và tọa độ",
                  "Tư liệu lấy từ phiếu kiểm tra đã lưu trong hệ thống GIS.",
                ],
                [
                  "02",
                  "AI khoanh vùng",
                  "Mô hình trả nhãn, độ tin cậy, mức rủi ro và bounding box.",
                ],
                [
                  "03",
                  "Đối chiếu lưới",
                  "Hệ thống ghép ảnh với đường dây hoặc tài sản gần nhất theo GIS.",
                ],
                [
                  "04",
                  "Cán bộ phê duyệt",
                  "Xác nhận, điều chỉnh hoặc loại trước khi tạo hồ sơ xử lý.",
                ],
              ].map(([step, title, description]) => (
                <div
                  key={step}
                  className="flex gap-3 rounded-lg border border-border bg-background p-3"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy font-mono text-xs font-bold text-white">
                    {step}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-navy">{title}</div>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
                  </div>
                </div>
              ))}
              <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2.5 text-xs leading-5 text-success">
                <strong>{reviewedRuns} lần chạy đã hoàn tất rà soát.</strong> Mọi quyết định được
                lưu cùng người duyệt và thời điểm thực hiện.
              </div>
            </div>
          </div>
        </section>

        <section className="gov-card overflow-hidden">
          <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
            <span className="flex size-9 items-center justify-center rounded-md bg-analytics/10 text-analytics">
              <ImageIcon className="size-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
                Thư viện ảnh kiểm tra
              </h2>
              <p className="text-xs text-muted-foreground">
                Giao diện tác nghiệp theo mẫu phiếu ảnh: mở ảnh, chạy AI và xem vùng nguy cơ ngay
                trên tư liệu.
              </p>
            </div>
            <Badge variant="outline" className="ml-auto rounded-md">
              {media.length} tư liệu
            </Badge>
          </header>
          <div className="grid gap-3 border-b border-border bg-muted/20 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <label className="block space-y-1.5 text-sm font-medium text-navy" htmlFor="nv5-demo-image">
              <span>Chọn ảnh demo để đánh giá an toàn điện</span>
              <select
                id="nv5-demo-image"
                value={selectedMediaId}
                disabled={!media.length || loading}
                onChange={(event) => {
                  setSelectedMediaId(event.target.value);
                  setSelectedRun(null);
                  setWarning("");
                  setError("");
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
              >
                {!media.length ? <option value="">Chưa có ảnh minh họa</option> : null}
                {media.map((item) => (
                  <option key={item.id} value={item.id}>
                    {demoImageName(item)} · {item.inspection.inspectionCode}
                  </option>
                ))}
              </select>
              <span className="block text-xs font-normal text-muted-foreground">
                Ảnh được gửi dạng multipart tới API AI Vision cùng tọa độ kiểm tra.
              </span>
            </label>
            <Button
              type="button"
              onClick={() => selectedMedia && openMedia(selectedMedia)}
              disabled={!selectedMedia || loading}
            >
              <Play className="size-4" />
              Mở ảnh và đánh giá AI
            </Button>
          </div>
          {loading ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              <RefreshCw className="mr-2 size-4 animate-spin" /> Đang tải tư liệu…
            </div>
          ) : media.length ? (
            <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {media.map((item) => {
                const imageUrl = item.fileRef ?? item.sourceUrl;
                const latest = latestRunByMedia.get(item.id);
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => openMedia(item)}
                    className={cn(
                      "group overflow-hidden rounded-xl border bg-background text-left shadow-sm transition hover:-translate-y-0.5 hover:border-gov/40 hover:shadow-md",
                      selectedMediaId === item.id && "border-gov ring-2 ring-gov/15",
                    )}
                  >
                    <div className="relative aspect-[3/2] overflow-hidden bg-muted">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={item.title}
                          className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-muted-foreground">
                          <ImageIcon className="size-10" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
                      <Badge
                        variant="outline"
                        className={cn(
                          "absolute right-3 top-3 rounded-md border-white/30 bg-black/50 text-white",
                          latest && statusClass(latest.status),
                        )}
                      >
                        {latest ? statusText(latest.status) : "Chưa phân tích"}
                      </Badge>
                      <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between text-white">
                        <span className="font-mono text-[11px]">
                          {item.inspection.inspectionCode}
                        </span>
                        <span className="text-[11px]">
                          {latest ? `${latest.detectionCount} phát hiện` : "Mở để phân tích"}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1.5 p-4">
                      <h3 className="line-clamp-1 text-sm font-semibold text-navy">{item.title}</h3>
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {item.inspection.corridorCode} · {item.inspection.corridorName}
                      </p>
                      <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                        <span>{item.inspection.inspector}</span>
                        <span>{dateText(item.capturedAt)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Chưa có ảnh hiện trường. Hãy thêm ảnh tại trang Quản lý dữ liệu.
            </div>
          )}
        </section>

        <section className="gov-card overflow-hidden">
          <header className="flex items-center gap-3 border-b border-border px-4 py-3">
            <span className="flex size-9 items-center justify-center rounded-md bg-gov/10 text-gov">
              <History className="size-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
                Lịch sử phân tích AI
              </h2>
              <p className="text-xs text-muted-foreground">
                Lưu mô hình, phiên bản, mã đầu vào, số phát hiện và trạng thái rà soát.
              </p>
            </div>
          </header>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tư liệu / thời gian</TableHead>
                <TableHead>Mô hình</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Phát hiện</TableHead>
                <TableHead>Đối chiếu GIS</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>
                    <div className="font-medium text-navy">{run.mediaTitle}</div>
                    <div className="text-xs text-muted-foreground">
                      {dateText(run.startedAt)} · {run.id.slice(0, 8)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>{run.modelName}</div>
                    <div className="text-xs text-muted-foreground">
                      {run.modelProvider} · v{run.modelVersion}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("rounded-md", statusClass(run.status))}>
                      {statusText(run.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold">{run.detectionCount}</div>
                    <div className="text-xs text-warning">
                      {run.pendingDetectionCount} chờ duyệt
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">{run.matchedAssetMethod ?? "Chưa đối chiếu"}</div>
                    <div className="text-xs text-muted-foreground">
                      {run.matchedDistanceM == null ? "—" : `${run.matchedDistanceM.toFixed(1)} m`}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => void loadRun(run.id)}
                      aria-label="Mở kết quả"
                    >
                      <Eye className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!runs.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Chưa có lịch sử. Mở một ảnh và chạy phân tích để bắt đầu.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </section>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[94dvh] max-w-[min(96vw,1240px)] overflow-y-auto p-0">
          <DialogHeader className="border-b border-border px-5 py-4 pr-12">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle>
                {selectedMedia?.title ?? selectedRun?.mediaTitle ?? "Phân tích ảnh an toàn"}
              </DialogTitle>
              {selectedRun ? (
                <Badge
                  variant="outline"
                  className={cn("rounded-md", statusClass(selectedRun.status))}
                >
                  {statusText(selectedRun.status)}
                </Badge>
              ) : null}
            </div>
            <DialogDescription>
              {selectedMedia?.inspection.inspectionCode ?? selectedRun?.inspectionCode} ·{" "}
              {selectedMedia?.inspection.corridorName ?? "Tư liệu kiểm tra hiện trường"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-[420px] xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.75fr)]">
            <div className="border-b border-border bg-slate-950 p-4 xl:border-b-0 xl:border-r">
              <AnnotatedInspectionImage
                imageUrl={selectedImage}
                detections={selectedRun?.detections ?? []}
              />
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm border-2 border-red-400" /> Nguy cơ cao
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm border-2 border-amber-300" /> Cần theo dõi
                </span>
                <span className="ml-auto">
                  Bounding box do mô hình trả về, không phải kết luận pháp lý.
                </span>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <DetailMetric
                  label="Phiếu kiểm tra"
                  value={
                    selectedMedia?.inspection.inspectionCode ?? selectedRun?.inspectionCode ?? "—"
                  }
                />
                <DetailMetric
                  label="Tọa độ GIS"
                  value={(() => {
                    const point = pointCoordinates(
                      selectedMedia?.geometry ?? selectedMedia?.inspection.geometry ?? null,
                    );
                    return point
                      ? `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`
                      : "Chưa có";
                  })()}
                />
                <DetailMetric
                  label="Thời điểm chụp"
                  value={dateText(selectedMedia?.capturedAt ?? selectedRun?.capturedAt)}
                />
                <DetailMetric
                  label="Đối chiếu tài sản"
                  value={selectedRun?.matchedAssetMethod ?? selectedMedia?.assetHint ?? "Chưa chạy"}
                />
              </div>

              {warning ? (
                <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs leading-5 text-warning">
                  {warning}
                </div>
              ) : null}

              {analyzing ? (
                <div className="space-y-2 rounded-lg border border-gov/30 bg-gov/5 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-navy">
                    <BrainCircuit className="size-4 animate-pulse text-gov" /> Đang phân tích ảnh và
                    đối chiếu GIS…
                  </div>
                  <Progress value={68} className="h-1.5" />
                </div>
              ) : null}

              {selectedRun?.detections.length ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Kết quả phát hiện
                    </h3>
                    <Badge variant="outline" className="rounded-md">
                      {selectedRun.detections.length} vùng
                    </Badge>
                  </div>
                  {selectedRun.detections.map((detection, index) => (
                    <div
                      key={detection.id}
                      className="rounded-lg border border-border bg-surface p-3"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-bold",
                            ["HIGH", "CRITICAL"].includes(detection.suggestedSeverity ?? "")
                              ? "bg-destructive/10 text-destructive"
                              : "bg-warning/10 text-warning",
                          )}
                        >
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <strong className="text-sm text-navy">
                              {labelText(detection.label)}
                            </strong>
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-md",
                                statusClass(detection.suggestedSeverity ?? ""),
                              )}
                            >
                              {SEVERITY_LABELS[detection.suggestedSeverity ?? ""] ??
                                detection.suggestedSeverity}
                            </Badge>
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                            <span>Độ tin cậy {(detection.confidence * 100).toFixed(1)}%</span>
                            <span>
                              Rủi ro{" "}
                              {detection.riskScore == null
                                ? "—"
                                : `${(detection.riskScore * 100).toFixed(1)}%`}
                            </span>
                          </div>
                          <Progress
                            value={detection.confidence * 100}
                            className="mt-2 h-1.5"
                            barClassName={
                              ["HIGH", "CRITICAL"].includes(detection.suggestedSeverity ?? "")
                                ? "bg-destructive"
                                : "bg-warning"
                            }
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
                        <span className="text-[11px] text-muted-foreground">
                          {STATUS_LABELS[detection.reviewStatus] ?? detection.reviewStatus}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={detection.reviewStatus !== "PENDING_HUMAN_REVIEW"}
                          onClick={() => startReview(detection)}
                        >
                          {detection.reviewStatus === "PENDING_HUMAN_REVIEW"
                            ? "Cán bộ rà soát"
                            : "Đã xử lý"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : selectedRun?.status === "SUCCEEDED" ? (
                <div className="rounded-lg border border-success/30 bg-success/10 p-5 text-center text-sm text-success">
                  <CheckCircle2 className="mx-auto mb-2 size-8" />
                  <strong>Không phát hiện vùng nguy cơ</strong>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    AI đã phân tích ảnh thành công. Cán bộ vẫn cần kiểm tra trực quan trước khi kết
                    luận hiện trường.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                  <BrainCircuit className="mx-auto mb-2 size-8 opacity-40" />
                  Chưa có kết quả. Chạy phân tích để AI khoanh vùng đối tượng nguy cơ trên ảnh.
                </div>
              )}

              <Button
                className="w-full"
                onClick={() => void runAnalysis()}
                disabled={!selectedMedia || analyzing}
              >
                {analyzing ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                {runtime.endpointConfigured
                  ? selectedRun
                    ? "Phân tích lại bằng AI"
                    : "Phân tích ảnh bằng AI"
                  : selectedRun
                    ? "Chạy lại mô phỏng AI"
                    : "Chạy mô phỏng AI"}
              </Button>
              {!runtime.endpointConfigured ? (
                <p className="text-center text-[11px] leading-4 text-muted-foreground">
                  Cấu hình <code>AI_VISION_ENDPOINT</code> để gửi tư liệu tới mô hình thật. Hiện tại
                  kết quả được gắn cờ minh họa và vẫn lưu lịch sử riêng.
                </p>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(reviewDetection && reviewDraft)}
        onOpenChange={(open) => {
          if (!open) {
            setReviewDetection(null);
            setReviewDraft(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cán bộ rà soát phát hiện AI</DialogTitle>
            <DialogDescription>
              Kết quả AI chỉ được chuyển sang hồ sơ vi phạm sau bước xác nhận này.
            </DialogDescription>
          </DialogHeader>
          {reviewDetection && reviewDraft ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                <strong>{labelText(reviewDetection.label)}</strong> · độ tin cậy{" "}
                {(reviewDetection.confidence * 100).toFixed(1)}% · đề xuất{" "}
                {SEVERITY_LABELS[reviewDetection.suggestedSeverity ?? ""] ??
                  reviewDetection.suggestedSeverity}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Quyết định">
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={reviewDraft.decision}
                    onChange={(event) =>
                      setReviewDraft({
                        ...reviewDraft,
                        decision: event.target.value as ReviewDraft["decision"],
                        createViolation:
                          event.target.value === "REJECT" ? false : reviewDraft.createViolation,
                      })
                    }
                  >
                    <option value="CONFIRM">Xác nhận kết quả AI</option>
                    <option value="ADJUST">Điều chỉnh kết quả</option>
                    <option value="REJECT">Loại phát hiện sai</option>
                  </select>
                </Field>
                <Field label="Cán bộ rà soát">
                  <input
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={reviewDraft.reviewer}
                    onChange={(event) =>
                      setReviewDraft({ ...reviewDraft, reviewer: event.target.value })
                    }
                  />
                </Field>
                <Field label="Nhãn kết luận">
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={reviewDraft.finalLabel}
                    onChange={(event) =>
                      setReviewDraft({ ...reviewDraft, finalLabel: event.target.value })
                    }
                  >
                    {Object.entries(LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Mức độ cuối cùng">
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={reviewDraft.finalSeverity}
                    onChange={(event) =>
                      setReviewDraft({ ...reviewDraft, finalSeverity: event.target.value })
                    }
                  >
                    {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Loại hồ sơ vi phạm">
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={reviewDraft.finalViolationType}
                    onChange={(event) =>
                      setReviewDraft({ ...reviewDraft, finalViolationType: event.target.value })
                    }
                  >
                    {Object.entries(VIOLATION_TYPES).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <label className="flex items-center gap-2 self-end rounded-md border border-border px-3 py-2.5 text-sm">
                  <Checkbox
                    checked={reviewDraft.createViolation}
                    disabled={reviewDraft.decision === "REJECT"}
                    onCheckedChange={(checked) =>
                      setReviewDraft({ ...reviewDraft, createViolation: checked === true })
                    }
                  />{" "}
                  Lập hồ sơ vi phạm sau khi xác nhận
                </label>
              </div>
              <Field label="Ghi chú rà soát">
                <textarea
                  className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={reviewDraft.note}
                  onChange={(event) => setReviewDraft({ ...reviewDraft, note: event.target.value })}
                />
              </Field>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReviewDetection(null);
                setReviewDraft(null);
              }}
            >
              Hủy
            </Button>
            <Button
              onClick={() => void submitReview()}
              disabled={reviewing || !reviewDraft?.reviewer.trim()}
            >
              {reviewing ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <FileCheck2 className="size-4" />
              )}{" "}
              Lưu kết quả rà soát
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AnnotatedInspectionImage({
  imageUrl,
  detections,
}: {
  imageUrl: string | null;
  detections: Detection[];
}) {
  const [naturalSize, setNaturalSize] = useState({ width: 1536, height: 1024 });
  if (!imageUrl)
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed border-slate-700 text-sm text-slate-400">
        Tư liệu chưa có đường dẫn ảnh.
      </div>
    );
  return (
    <div className="flex min-h-[280px] items-center justify-center">
      <div className="relative inline-block max-w-full overflow-hidden rounded-lg shadow-2xl">
        <img
          src={imageUrl}
          alt="Ảnh kiểm tra an toàn điện"
          className="block max-h-[42dvh] w-full object-contain"
          onLoad={(event) =>
            setNaturalSize({
              width: event.currentTarget.naturalWidth || 1536,
              height: event.currentTarget.naturalHeight || 1024,
            })
          }
        />
        {detections.map((detection, index) => {
          const bbox = detection.bbox ?? {};
          const x = Number(bbox.x ?? 0);
          const y = Number(bbox.y ?? 0);
          const width = Number(bbox.width ?? 0);
          const height = Number(bbox.height ?? 0);
          const fractional = Math.max(x, y, width, height) <= 1;
          const style = {
            left: `${fractional ? x * 100 : (x / naturalSize.width) * 100}%`,
            top: `${fractional ? y * 100 : (y / naturalSize.height) * 100}%`,
            width: `${fractional ? width * 100 : (width / naturalSize.width) * 100}%`,
            height: `${fractional ? height * 100 : (height / naturalSize.height) * 100}%`,
          };
          const critical = ["HIGH", "CRITICAL"].includes(detection.suggestedSeverity ?? "");
          return (
            <div
              key={detection.id}
              className={cn(
                "absolute border-2 bg-warning/10 shadow-[0_0_0_1px_rgba(0,0,0,.35)]",
                critical ? "border-red-400 bg-red-500/10" : "border-amber-300",
              )}
              style={style}
            >
              <span
                className={cn(
                  "absolute -top-7 left-[-2px] whitespace-nowrap rounded-t px-2 py-1 text-[11px] font-semibold text-slate-950",
                  critical ? "bg-red-400" : "bg-amber-300",
                )}
              >
                {index + 1} · {labelText(detection.label)} {(detection.confidence * 100).toFixed(0)}
                %
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 line-clamp-2 text-xs font-medium text-navy">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-navy">
      <span>{label}</span>
      {children}
    </label>
  );
}
