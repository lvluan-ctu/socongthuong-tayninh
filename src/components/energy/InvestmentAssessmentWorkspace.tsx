"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
import {
  Alert,
  Badge,
  Button,
  NumberInput,
  Paper,
  Progress,
  RingProgress,
  Select,
  Slider,
  Tabs,
  TextInput,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BatteryCharging,
  Building2,
  Cable,
  CheckCircle2,
  ClipboardCheck,
  CloudCog,
  Crosshair,
  Database,
  Factory,
  Gauge,
  Leaf,
  LoaderCircle,
  MapPinned,
  Navigation,
  PlugZap,
  Printer,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  TriangleAlert,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { EnergyMap } from "@/components/energy/EnergyMap";
import {
  INVESTMENT_GIS_CHROME_CONFIG,
  INVESTMENT_GIS_LAYER_OPTIONS,
} from "@/config/investment-gis";
import type { EnergyDashboardBundle } from "@/lib/energy-types";
import {
  INVESTMENT_TYPE_LABELS,
  type AssessmentBreakdownItem,
  type InvestmentAssessmentQuery,
  type InvestmentAssessmentResponse,
  type InvestmentType,
} from "@/lib/investment-assessment";
import { cn } from "@/lib/utils";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const DEFAULT_FORM: InvestmentAssessmentQuery = {
  lat: 10.555,
  lng: 106.414,
  radiusKm: 10,
  investmentType: "INDUSTRIAL",
  expectedDemandKw: 1_500,
  landAreaHa: 5,
  roofAreaM2: 10_000,
};

const TYPE_OPTIONS = Object.entries(INVESTMENT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const STATUS_LABEL = {
  READY: "Sẵn sàng sơ bộ",
  CONDITIONAL: "Có điều kiện",
  CAPACITY_REVIEW: "Rà soát công suất",
  SCREENING: "Đang sàng lọc",
  CONFIRMATION_REQUIRED: "Cần xác nhận",
} as const;

const SCORE_ICONS: Record<string, LucideIcon> = {
  GRID: Cable,
  RENEWABLE: Sun,
  RESILIENCE: ShieldCheck,
  MOBILITY: BatteryCharging,
  ENVIRONMENT: Leaf,
  ECOSYSTEM: Building2,
  DATA: Database,
};

function numeric(value: string | number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function fmt(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("vi-VN", { maximumFractionDigits: digits });
}

function time(value: string) {
  return new Date(value).toLocaleString("vi-VN");
}

function scoreTone(status: AssessmentBreakdownItem["status"]) {
  return status === "GOOD"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : status === "WATCH"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-rose-200 bg-rose-50 text-rose-800";
}

function gradeColor(grade: InvestmentAssessmentResponse["assessment"]["grade"]) {
  return grade === "FAVORABLE" ? "teal" : grade === "CONDITIONAL" ? "yellow" : "red";
}

async function fetchAssessment(input: InvestmentAssessmentQuery) {
  const params = new URLSearchParams({
    radiusKm: String(input.radiusKm),
    investmentType: input.investmentType,
    expectedDemandKw: String(input.expectedDemandKw),
    landAreaHa: String(input.landAreaHa),
    roofAreaM2: String(input.roofAreaM2),
  });
  if (input.address?.trim()) {
    params.set("address", input.address.trim());
  } else if (input.lat != null && input.lng != null) {
    params.set("lat", String(input.lat));
    params.set("lng", String(input.lng));
  }
  const response = await fetch(`/api/gis/investment-assessment?${params}`, {
    cache: "no-store",
  });
  const body = (await response.json()) as InvestmentAssessmentResponse & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Không thể đánh giá vị trí đầu tư.");
  return body;
}

async function fetchGisBundle() {
  const response = await fetch("/api/energy/overview", { cache: "no-store" });
  const body = (await response.json()) as EnergyDashboardBundle & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Không thể tải các lớp dữ liệu GIS.");
  return body;
}

export function InvestmentAssessmentWorkspace() {
  const [form, setForm] = useState<InvestmentAssessmentQuery>(DEFAULT_FORM);
  const [address, setAddress] = useState("Phường Long An");
  const [submitted, setSubmitted] = useState<InvestmentAssessmentQuery>(DEFAULT_FORM);
  const [selectedMapKey, setSelectedMapKey] = useState<string | null>(null);
  const [selectedLineKey, setSelectedLineKey] = useState<string | null>(null);
  const gisQuery = useQuery({
    queryKey: ["investment-assessment", "gis"],
    queryFn: fetchGisBundle,
    staleTime: 60_000,
  });
  const assessmentQuery = useQuery({
    queryKey: ["investment-assessment", submitted],
    queryFn: () => fetchAssessment(submitted),
    retry: 1,
  });

  useEffect(() => {
    if (!assessmentQuery.data) return;
    setForm((current) => ({
      ...current,
      lat: assessmentQuery.data.location.lat,
      lng: assessmentQuery.data.location.lng,
    }));
  }, [assessmentQuery.data]);

  const result = assessmentQuery.data;
  const radarOption = useMemo<EChartsOption>(() => {
    if (!result) return {};
    return {
      color: ["#1565c0"],
      tooltip: { trigger: "item" },
      radar: {
        radius: "62%",
        splitNumber: 5,
        axisName: { color: "#334155", fontSize: 11 },
        splitArea: { areaStyle: { color: ["#f8fafc", "#eef5fb"] } },
        splitLine: { lineStyle: { color: "#dbe5ef" } },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        indicator: result.scoreBreakdown.map((item) => ({
          name: item.label,
          max: item.maxScore,
        })),
      },
      series: [
        {
          type: "radar",
          data: [
            {
              name: "Điểm đạt được",
              value: result.scoreBreakdown.map((item) => item.score),
              areaStyle: { color: "rgba(21,101,192,.24)" },
              lineStyle: { width: 2 },
              symbolSize: 6,
            },
          ],
        },
      ],
    };
  }, [result]);

  const capacityOption = useMemo<EChartsOption>(() => {
    if (!result) return {};
    const values = [
      result.metrics.estimatedConnectionHeadroomKw,
      result.profile.expectedDemandKw,
      result.metrics.rooftopPotentialKwp,
      result.metrics.evPowerKw,
    ];
    return {
      color: ["#1565c0"],
      tooltip: { trigger: "axis", valueFormatter: (value) => `${fmt(Number(value))} kW` },
      grid: { left: 55, right: 20, top: 20, bottom: 70 },
      xAxis: {
        type: "category",
        axisLabel: { interval: 0, rotate: 18, color: "#475569" },
        data: ["Dư địa đấu nối", "Phụ tải dự kiến", "ĐMT mái nhà", "Trạm sạc lân cận"],
      },
      yAxis: {
        type: "value",
        name: "kW / kWp",
        axisLabel: { formatter: (value: number) => fmt(value) },
        splitLine: { lineStyle: { color: "#e2e8f0" } },
      },
      series: [
        {
          type: "bar",
          barMaxWidth: 50,
          label: { show: true, position: "top", formatter: "{c}" },
          data: values.map((value, index) => ({
            value,
            itemStyle: {
              color: ["#1565c0", "#f59e0b", "#16a34a", "#7c3aed"][index],
              borderRadius: [7, 7, 0, 0],
            },
          })),
        },
      ],
    };
  }, [result]);

  const submitCoordinates = () => {
    if (form.lat == null || form.lng == null) return;
    setSubmitted({ ...form, address: undefined });
  };

  const submitAddress = () => {
    if (address.trim().length < 2) return;
    setSubmitted({ ...form, lat: undefined, lng: undefined, address: address.trim() });
  };

  const selectPoint = (point: { lat: number; lng: number }) => {
    const next = { ...form, ...point, address: undefined };
    setAddress("");
    setForm(next);
    setSelectedMapKey(null);
    setSelectedLineKey(null);
    setSubmitted(next);
  };

  return (
    <>
      <PageHeader
        title="Đánh giá đầu tư năng lượng"
        description="Chọn một vị trí để sàng lọc lưới điện, nguồn năng lượng, an toàn, phát thải, trạm sạc, hệ sinh thái phụ tải và các kịch bản triển khai từ dữ liệu hệ thống GIS."
        crumbs={[{ label: "Dữ liệu GIS", to: "/gis/map" }, { label: "Đánh giá đầu tư" }]}
        variant="panel"
        icon={MapPinned}
        actions={
          result ? (
            <Button
              variant="light"
              leftSection={<Printer className="size-4" />}
              onClick={() => window.print()}
            >
              In báo cáo
            </Button>
          ) : null
        }
      />

      <main className="space-y-5 px-3 pb-8 sm:px-5 lg:px-6">
        <section className="relative overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-[#062943] via-[#0b4f78] to-[#087f8c] p-5 text-white shadow-panel sm:p-7">
          <div className="absolute -right-24 -top-24 size-72 rounded-full bg-cyan-300/10 blur-2xl" />
          <div className="absolute -bottom-28 left-1/3 size-64 rounded-full bg-blue-300/10 blur-2xl" />
          <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div>
              <Badge color="cyan" variant="light" leftSection={<Sparkles className="size-3.5" />}>
                Sàng lọc đa tiêu chí có truy vết dữ liệu
              </Badge>
              <h2 className="mt-3 max-w-4xl text-2xl font-bold tracking-tight sm:text-3xl">
                Chọn một điểm trên bản đồ, hệ thống sẽ tự động rà soát các lớp dữ liệu GIS thực tế và đánh giá khả năng đầu tư năng lượng.
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-50/85">
                Các số liệu được tính toán từ dữ liệu GIS thực tế, bao gồm lưới điện, nguồn năng lượng, an toàn, phát thải, trạm sạc, hệ sinh thái phụ tải và các kịch bản triển khai. Kết quả được trình bày trong báo cáo có thể in ra hoặc xuất PDF.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_410px]">
          <Paper withBorder radius="lg" className="overflow-hidden shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="font-semibold text-slate-900">Chọn vị trí khảo sát</h2>
                <p className="text-xs text-slate-500">
                  Nhấp trực tiếp lên bản đồ để phân tích ngay
                </p>
              </div>
              {result ? (
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Crosshair className="size-4 text-blue-600" />
                  {result.location.lat.toFixed(6)}, {result.location.lng.toFixed(6)}
                </div>
              ) : null}
            </div>
            <div className="relative min-h-[570px] bg-slate-100">
              {gisQuery.data ? (
                <EnergyMap
                  data={gisQuery.data.gis}
                  height={570}
                  selectedKey={selectedMapKey}
                  selectedLineKey={selectedLineKey}
                  selectedExtraKey="extra:investment-location"
                  layerOptions={INVESTMENT_GIS_LAYER_OPTIONS}
                  mapChrome={INVESTMENT_GIS_CHROME_CONFIG}
                  onSelectEntity={(entity) => {
                    setSelectedMapKey(`${entity.kind}:${entity.item.id}`);
                    setSelectedLineKey(null);
                  }}
                  onMapClick={selectPoint}
                  extraCircles={
                    result
                      ? [
                          {
                            id: "investment-radius",
                            lat: result.location.lat,
                            lng: result.location.lng,
                            radiusMeters: result.location.radiusKm * 1_000,
                            color: "#0ea5e9",
                            fillOpacity: 0.06,
                            label: `Vùng phân tích ${result.location.radiusKm} km`,
                            popup: "Các số liệu trong báo cáo được lọc theo vùng này.",
                            interactive: false,
                          },
                        ]
                      : []
                  }
                  extraMarkers={
                    result
                      ? [
                          {
                            id: "investment-location",
                            lat: result.location.lat,
                            lng: result.location.lng,
                            color: "#dc2626",
                            glyph: "ĐT",
                            label: result.location.adminArea?.name ?? "Vị trí đầu tư",
                            sublabel: `${result.profile.investmentTypeLabel} · ${fmt(result.profile.expectedDemandKw)} kW`,
                            onSelect: () =>
                              document
                                .getElementById("investment-assessment-report")
                                ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                          },
                        ]
                      : []
                  }
                />
              ) : gisQuery.isLoading ? (
                <div className="grid h-[570px] place-items-center text-sm text-slate-500">
                  <span className="flex items-center gap-2">
                    <LoaderCircle className="size-5 animate-spin" /> Đang tải các lớp GIS thực tế…
                  </span>
                </div>
              ) : (
                <div className="grid h-[570px] place-items-center p-6 text-center text-sm text-rose-700">
                  Không tải được nền GIS. Biểu mẫu tọa độ và API đánh giá vẫn có thể sử dụng.
                </div>
              )}
            </div>
          </Paper>

          <Paper withBorder radius="lg" p="md" className="shadow-sm">
            <div className="mb-4 flex items-start gap-3">
              <ThemeIcon color="brand" variant="light" size="lg" radius="md">
                <Navigation className="size-5" />
              </ThemeIcon>
              <div>
                <h2 className="font-semibold text-slate-900">Thông tin dự án dự kiến</h2>
                <p className="text-xs leading-5 text-slate-500">
                  Các trường này được dùng để tính nhu cầu, phát thải và kịch bản mái nhà.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                <TextInput
                  label="Tìm theo địa chỉ/địa bàn"
                  placeholder="Ví dụ: Phường Long An"
                  value={address}
                  onChange={(event) => setAddress(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submitAddress();
                  }}
                  leftSection={<Search className="size-4" />}
                  rightSection={
                    assessmentQuery.isFetching ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : null
                  }
                />
                <Button
                  mt="xs"
                  fullWidth
                  variant="light"
                  leftSection={<MapPinned className="size-4" />}
                  disabled={address.trim().length < 2 || assessmentQuery.isFetching}
                  onClick={submitAddress}
                >
                  Tìm và đánh giá địa chỉ
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <NumberInput
                  label="Vĩ độ"
                  value={form.lat}
                  decimalScale={6}
                  min={10.2}
                  max={12.25}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      lat: numeric(value, current.lat ?? 10.555),
                    }))
                  }
                />
                <NumberInput
                  label="Kinh độ"
                  value={form.lng}
                  decimalScale={6}
                  min={105.4}
                  max={107.1}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      lng: numeric(value, current.lng ?? 106.414),
                    }))
                  }
                />
              </div>

              <Select
                label="Loại hình đầu tư"
                data={TYPE_OPTIONS}
                value={form.investmentType}
                allowDeselect={false}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    investmentType: (value ?? "INDUSTRIAL") as InvestmentType,
                  }))
                }
              />
              <div className="grid grid-cols-2 gap-3">
                <NumberInput
                  label="Phụ tải cực đại"
                  suffix=" kW"
                  thousandSeparator="."
                  decimalSeparator=","
                  min={10}
                  max={200_000}
                  value={form.expectedDemandKw}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      expectedDemandKw: numeric(value, current.expectedDemandKw),
                    }))
                  }
                />
                <NumberInput
                  label="Diện tích khu đất"
                  suffix=" ha"
                  decimalScale={2}
                  min={0.1}
                  value={form.landAreaHa}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      landAreaHa: numeric(value, current.landAreaHa),
                    }))
                  }
                />
              </div>
              <NumberInput
                label="Diện tích mái có thể khai thác"
                suffix=" m²"
                thousandSeparator="."
                decimalSeparator=","
                min={0}
                value={form.roofAreaM2}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    roofAreaM2: numeric(value, current.roofAreaM2),
                  }))
                }
              />
              <div>
                <div className="mb-2 flex justify-between text-sm font-medium text-slate-700">
                  <span>Bán kính rà soát</span>
                  <span>{form.radiusKm} km</span>
                </div>
                <Slider
                  min={1}
                  max={30}
                  step={1}
                  value={form.radiusKm}
                  marks={[
                    { value: 5, label: "5" },
                    { value: 10, label: "10" },
                    { value: 20, label: "20" },
                    { value: 30, label: "30 km" },
                  ]}
                  onChange={(value) => setForm((current) => ({ ...current, radiusKm: value }))}
                />
              </div>

              <Button
                size="md"
                fullWidth
                mt="md"
                leftSection={
                  assessmentQuery.isFetching ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Radar className="size-4" />
                  )
                }
                disabled={assessmentQuery.isFetching}
                onClick={submitCoordinates}
              >
                {assessmentQuery.isFetching
                  ? "Đang rà soát PostGIS…"
                  : "Phân tích toàn diện vị trí"}
              </Button>
              <p className="text-center text-[11px] leading-4 text-slate-500">
                Mọi con số ước tính đều được gắn giả định và không thay thế xác nhận của cơ quan/đơn
                vị quản lý.
              </p>
            </div>
          </Paper>
        </section>

        {assessmentQuery.isError ? (
          <Alert
            color="red"
            icon={<AlertTriangle className="size-5" />}
            title="Không thể hoàn tất đánh giá"
          >
            {assessmentQuery.error instanceof Error
              ? assessmentQuery.error.message
              : "Vui lòng thử lại."}
          </Alert>
        ) : null}

        {assessmentQuery.isLoading && !result ? <AssessmentSkeleton /> : null}
        {result ? (
          <AssessmentReport
            result={result}
            radarOption={radarOption}
            capacityOption={capacityOption}
            selectedMapKey={selectedMapKey}
            selectedLineKey={selectedLineKey}
            onSelectMapKey={setSelectedMapKey}
            onSelectLineKey={setSelectedLineKey}
          />
        ) : null}
      </main>
    </>
  );
}

function AssessmentReport({
  result,
  radarOption,
  capacityOption,
  selectedMapKey,
  selectedLineKey,
  onSelectMapKey,
  onSelectLineKey,
}: {
  result: InvestmentAssessmentResponse;
  radarOption: EChartsOption;
  capacityOption: EChartsOption;
  selectedMapKey: string | null;
  selectedLineKey: string | null;
  onSelectMapKey: (value: string | null) => void;
  onSelectLineKey: (value: string | null) => void;
}) {
  const metrics = result.metrics;

  return (
    <section id="investment-assessment-report" className="space-y-4">
      <Paper withBorder radius="lg" className="overflow-hidden shadow-sm">
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-blue-600 to-cyan-500" />
        <div className="grid gap-5 p-5 lg:grid-cols-[180px_minmax(0,1fr)_auto] lg:items-center">
          <div className="flex justify-center">
            <RingProgress
              size={150}
              thickness={13}
              roundCaps
              sections={[
                { value: result.assessment.score, color: gradeColor(result.assessment.grade) },
              ]}
              label={
                <div className="text-center">
                  <div className="text-3xl font-bold text-slate-900">{result.assessment.score}</div>
                  <div className="text-xs font-semibold uppercase text-slate-500">/ 100 điểm</div>
                </div>
              }
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge color={gradeColor(result.assessment.grade)} variant="light" size="lg">
                {result.assessment.label}
              </Badge>
              <Badge variant="outline">{result.profile.investmentTypeLabel}</Badge>
              <Badge variant="outline">Bán kính {result.location.radiusKm} km</Badge>
            </div>
            <h2 className="mt-3 text-xl font-bold text-slate-900">
              {result.location.adminArea?.name ?? result.location.displayName ?? "Vị trí đã chọn"}
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              {result.assessment.conclusion}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Crosshair className="size-3.5" />
                {result.location.lat.toFixed(6)}, {result.location.lng.toFixed(6)}
              </span>
              <span className="flex items-center gap-1.5">
                <Database className="size-3.5" />
                hệ thống GIS
              </span>
              <span className="flex items-center gap-1.5">
                <Gauge className="size-3.5" />
                Cập nhật {time(result.generatedAt)}
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center lg:min-w-44">
            <CheckCircle2 className="mx-auto size-7 text-emerald-600" />
            <div className="mt-2 text-sm font-bold text-emerald-900">Đề xuất bước tiếp theo</div>
            <div className="mt-1 text-xs leading-5 text-emerald-800">
              Khảo sát khả thi và tiền thỏa thuận đấu nối
            </div>
          </div>
        </div>
      </Paper>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          icon={Cable}
          label="Dư địa đấu nối sơ bộ"
          value={`${fmt(metrics.estimatedConnectionHeadroomKw)} kW`}
          detail={`${fmt(metrics.demandCoveragePct, 1)}% nhu cầu khai báo`}
          tone="blue"
        />
        <MetricTile
          icon={Zap}
          label="Cấp điện áp cao nhất"
          value={`${fmt(metrics.maxVoltageKv)} kV`}
          detail={
            metrics.has220Kv
              ? "Có lưới 220 kV trong bán kính"
              : "Chưa ghi nhận 220 kV trong bán kính"
          }
          tone={metrics.hasHighVoltageGrid ? "emerald" : "amber"}
        />
        <MetricTile
          icon={PlugZap}
          label="Khả năng điện 3 pha"
          value={
            metrics.threePhaseReadiness === "AVAILABLE_PRELIMINARY"
              ? "Sẵn sàng sơ bộ"
              : metrics.threePhaseReadiness === "LIMITED"
                ? "Có điều kiện"
                : "Cần khảo sát"
          }
          detail="Phải xác nhận điểm đấu nối"
          tone={metrics.threePhaseReadiness === "AVAILABLE_PRELIMINARY" ? "emerald" : "amber"}
        />
        <MetricTile
          icon={Sun}
          label="ĐMT mái nhà sàng lọc"
          value={`${fmt(metrics.rooftopPotentialKwp)} kWp`}
          detail={`${fmt(metrics.rooftopAnnualOutputMwh, 1)} MWh/năm (giả định)`}
          tone="emerald"
        />
        <MetricTile
          icon={BatteryCharging}
          label="Trạm sạc lân cận"
          value={`${fmt(metrics.evStations)} trạm`}
          detail={`${fmt(metrics.evPowerKw)} kW · ${fmt(metrics.evAvailableConnectors)} cổng trống`}
          tone="violet"
        />
        <MetricTile
          icon={ShieldCheck}
          label="Ổn định hồ sơ GIS"
          value={`${fmt(metrics.stabilityIndex)}/100`}
          detail={`${fmt(metrics.incidents12Months)} sự cố trong 12 tháng`}
          tone={metrics.stabilityIndex >= 85 ? "emerald" : "amber"}
        />
        <MetricTile
          icon={CloudCog}
          label="Phát thải kịch bản"
          value={`${fmt(metrics.estimatedOperationalCo2eTonnes, 1)} tCO₂e`}
          detail={`${fmt(metrics.estimatedAnnualElectricityMwh, 1)} MWh/năm`}
          tone="slate"
        />
        <MetricTile
          icon={Users}
          label="Hệ sinh thái phụ tải"
          value={`${fmt(metrics.consumers)} cơ sở`}
          detail={`${fmt(metrics.keyConsumers)} cơ sở trọng điểm/báo cáo`}
          tone="blue"
        />
      </div>

      <Tabs defaultValue="overview" variant="outline" radius="md">
        <Tabs.List className="investment-assessment-tabs rounded-t-xl border border-b-0 border-slate-200 bg-white px-2 pt-2">
          <Tabs.Tab
            value="overview"
            leftSection={<Gauge className="size-4" />}
            className="font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 data-[active]:bg-blue-50 data-[active]:font-bold data-[active]:text-blue-700 data-[active]:shadow-sm"
          >
            Tổng hợp đánh giá
          </Tabs.Tab>
          <Tabs.Tab
            value="grid"
            leftSection={<Cable className="size-4" />}
            className="font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 data-[active]:bg-blue-50 data-[active]:font-bold data-[active]:text-blue-700 data-[active]:shadow-sm"
          >
            Lưới & năng lượng
          </Tabs.Tab>
          <Tabs.Tab
            value="safety"
            leftSection={<ShieldCheck className="size-4" />}
            className="font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 data-[active]:bg-blue-50 data-[active]:font-bold data-[active]:text-blue-700 data-[active]:shadow-sm"
          >
            An toàn & phát thải
          </Tabs.Tab>
          <Tabs.Tab
            value="scenarios"
            leftSection={<Sparkles className="size-4" />}
            className="font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 data-[active]:bg-blue-50 data-[active]:font-bold data-[active]:text-blue-700 data-[active]:shadow-sm"
          >
            Kịch bản & thủ tục
          </Tabs.Tab>
          <Tabs.Tab
            value="evidence"
            leftSection={<Database className="size-4" />}
            className="font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 data-[active]:bg-blue-50 data-[active]:font-bold data-[active]:text-blue-700 data-[active]:shadow-sm"
          >
            Dữ liệu chứng minh
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview">
          <div className="space-y-4 rounded-b-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {result.scoreBreakdown.map((item) => (
                <ScoreCard key={item.key} item={item} />
              ))}
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <ChartPanel
                title="Hồ sơ năng lực theo 7 nhóm tiêu chí"
                subtitle="Điểm đạt được so với trọng số tối đa"
              >
                <ReactECharts
                  option={radarOption}
                  style={{ height: 390, width: "100%" }}
                  notMerge
                  lazyUpdate
                />
              </ChartPanel>
              <ChartPanel
                title="Cân đối công suất tại vị trí"
                subtitle="So sánh kW/kWp; dư địa là giá trị kỹ thuật sơ bộ"
              >
                <ReactECharts
                  option={capacityOption}
                  style={{ height: 390, width: "100%" }}
                  notMerge
                  lazyUpdate
                />
              </ChartPanel>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <FindingList
                title="Lợi thế được dữ liệu xác nhận"
                icon={CheckCircle2}
                items={result.assessment.strengths}
                tone="good"
              />
              <FindingList
                title="Điều kiện và khoảng trống cần xử lý"
                icon={TriangleAlert}
                items={result.assessment.constraints}
                tone="warn"
              />
            </div>
            <FindingList
              title="Khuyến nghị hành động"
              icon={ClipboardCheck}
              items={result.assessment.recommendations}
              tone="info"
            />
            <Alert
              color="blue"
              icon={<AlertTriangle className="size-5" />}
              title="Phạm vi sử dụng kết quả"
            >
              {result.assessment.disclaimer}
            </Alert>
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="grid">
          <div className="space-y-4 rounded-b-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <MiniSummary
                icon={Factory}
                label="Nguồn điện lân cận"
                value={`${metrics.projects} dự án · ${fmt(metrics.generationCapacityMw, 1)} MW`}
              />
              <MiniSummary
                icon={Sun}
                label="Hệ mái nhà hiện hữu"
                value={`${fmt(metrics.rooftopSystems)} hệ · ${fmt(metrics.rooftopCapacityMw, 2)} MWp`}
              />
              <MiniSummary
                icon={Cable}
                label="Lưới & trạm"
                value={`${metrics.lines} tuyến · ${metrics.substations} trạm`}
              />
            </div>
            <EvidenceSection
              title="Trạm biến áp gần vị trí"
              count={result.nearby.substations.length}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase text-slate-500">
                      <th className="p-3">Trạm</th>
                      <th className="p-3">Điện áp</th>
                      <th className="p-3">Khả dụng</th>
                      <th className="p-3">Mức tải</th>
                      <th className="p-3">Khoảng cách</th>
                      <th className="p-3">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.nearby.substations.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => onSelectMapKey(`substation:${row.id}`)}
                        className={cn(
                          "cursor-pointer border-b border-slate-100 hover:bg-blue-50",
                          selectedMapKey === `substation:${row.id}` && "bg-blue-50",
                        )}
                      >
                        <td className="p-3">
                          <div className="font-semibold text-slate-900">{row.name}</div>
                          <div className="text-xs text-slate-500">{row.code}</div>
                        </td>
                        <td className="p-3 font-semibold">{fmt(row.voltageKv)} kV</td>
                        <td className="p-3">{fmt(row.availableCapacityMva, 2)} MVA</td>
                        <td className="p-3">{fmt(row.loadFactorPct, 1)}%</td>
                        <td className="p-3">{fmt(row.distanceKm, 2)} km</td>
                        <td className="p-3">
                          <Badge color={row.loadFactorPct >= 90 ? "red" : "teal"} variant="light">
                            {row.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </EvidenceSection>
            <EvidenceSection title="Đường dây gần vị trí" count={result.nearby.lines.length}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase text-slate-500">
                      <th className="p-3">Đường dây</th>
                      <th className="p-3">Điện áp</th>
                      <th className="p-3">Định mức</th>
                      <th className="p-3">Tải hiện tại</th>
                      <th className="p-3">Dư địa</th>
                      <th className="p-3">Khoảng cách</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.nearby.lines.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => onSelectLineKey(`line:${row.id}`)}
                        className={cn(
                          "cursor-pointer border-b border-slate-100 hover:bg-blue-50",
                          selectedLineKey === `line:${row.id}` && "bg-blue-50",
                        )}
                      >
                        <td className="p-3">
                          <div className="font-semibold text-slate-900">{row.name}</div>
                          <div className="text-xs text-slate-500">{row.code}</div>
                        </td>
                        <td className="p-3 font-semibold">{fmt(row.voltageKv)} kV</td>
                        <td className="p-3">{fmt(row.capacityMw, 2)} MW</td>
                        <td className="p-3">{fmt(row.currentLoadMw, 2)} MW</td>
                        <td className="p-3 font-semibold text-emerald-700">
                          {fmt(row.headroomMw, 3)} MW
                        </td>
                        <td className="p-3">{fmt(row.distanceKm, 2)} km</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </EvidenceSection>
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="safety">
          <div className="space-y-4 rounded-b-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile
                icon={ShieldCheck}
                label="Chỉ số ổn định hồ sơ"
                value={`${metrics.stabilityIndex}/100`}
                detail="Chỉ số dẫn xuất, không phải SAIDI/SAIFI"
                tone="emerald"
              />
              <MetricTile
                icon={AlertTriangle}
                label="Sự cố 12 tháng"
                value={fmt(metrics.incidents12Months)}
                detail={`${metrics.activeIncidents} sự cố đang mở`}
                tone={metrics.incidents12Months ? "amber" : "emerald"}
              />
              <MetricTile
                icon={TriangleAlert}
                label="Vi phạm hành lang"
                value={fmt(metrics.corridorViolations)}
                detail="Hồ sơ chưa đóng trong bán kính"
                tone={metrics.corridorViolations ? "amber" : "emerald"}
              />
              <MetricTile
                icon={CloudCog}
                label="CO₂e lân cận đã ghi nhận"
                value={`${fmt(metrics.recordedCo2eTonnes, 1)} tấn`}
                detail={`${metrics.pendingReportingObligations} nghĩa vụ đang theo dõi`}
                tone="slate"
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <EvidenceSection
                title="Sự kiện an toàn gần vị trí"
                count={result.nearby.safetyEvents.length}
              >
                {result.nearby.safetyEvents.length ? (
                  <div className="divide-y divide-slate-100">
                    {result.nearby.safetyEvents.map((row) => (
                      <div key={row.id} className="flex items-start justify-between gap-3 p-3">
                        <div>
                          <div className="font-semibold text-slate-900">{row.name}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {row.code} ·{" "}
                            {row.kind === "GRID_INCIDENT" ? "Sự cố lưới" : "Hành lang an toàn"}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge
                            color={row.severity === "CRITICAL" ? "red" : "yellow"}
                            variant="light"
                          >
                            {row.severity}
                          </Badge>
                          <div className="mt-1 text-xs text-slate-500">
                            {fmt(row.distanceKm, 2)} km
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyEvidence text="Không ghi nhận sự kiện an toàn có vị trí trong vùng phân tích." />
                )}
              </EvidenceSection>
              <EvidenceSection
                title="Nguồn phát thải lân cận"
                count={result.nearby.emissionSources.length}
              >
                {result.nearby.emissionSources.length ? (
                  <div className="divide-y divide-slate-100">
                    {result.nearby.emissionSources.map((row) => (
                      <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 p-3">
                        <div>
                          <div className="font-semibold text-slate-900">{row.name}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {row.scope} · kỳ mới nhất {row.latestPeriod ?? "—"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-slate-900">
                            {fmt(row.recordedCo2eTonnes, 1)} tCO₂e
                          </div>
                          <div className="text-xs text-slate-500">{fmt(row.distanceKm, 2)} km</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyEvidence text="Chưa có nguồn phát thải gắn vị trí trong bán kính." />
                )}
              </EvidenceSection>
            </div>
            <EvidenceSection
              title="Giả định và nguồn số liệu của phép tính"
              count={result.assumptions.length}
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {result.assumptions.map((item) => (
                  <div key={item.key} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-slate-900">{item.label}</div>
                      <Badge
                        size="xs"
                        variant="light"
                        color={
                          item.classification === "DATABASE"
                            ? "blue"
                            : item.classification === "DERIVED"
                              ? "teal"
                              : "yellow"
                        }
                      >
                        {item.classification === "DATABASE"
                          ? "CSDL"
                          : item.classification === "DERIVED"
                            ? "Dẫn xuất"
                            : "Giả định"}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm text-slate-700">{item.value}</div>
                    <div className="mt-2 text-xs leading-5 text-slate-500">
                      Nguồn: {item.source}
                    </div>
                  </div>
                ))}
              </div>
            </EvidenceSection>
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="scenarios">
          <div className="space-y-4 rounded-b-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="grid gap-4 xl:grid-cols-3">
              {result.scenarios.map((scenario) => (
                <Paper
                  key={scenario.id}
                  withBorder
                  radius="lg"
                  p="md"
                  className={cn("shadow-sm", scenario.id === "BASE" && "ring-2 ring-blue-500")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {scenario.id === "BASE" ? "Khuyến nghị so sánh" : "Kịch bản"}
                      </div>
                      <h3 className="mt-1 font-bold text-slate-900">{scenario.label}</h3>
                    </div>
                    <Badge
                      color={
                        scenario.status === "READY"
                          ? "teal"
                          : scenario.status === "CONDITIONAL"
                            ? "yellow"
                            : "red"
                      }
                      variant="light"
                    >
                      {STATUS_LABEL[scenario.status]}
                    </Badge>
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <div className="text-3xl font-bold text-blue-700">{scenario.score}</div>
                      <div className="text-xs text-slate-500">điểm phù hợp</div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-semibold">{fmt(scenario.demandKw)} kW</div>
                      <div className="text-xs text-slate-500">phụ tải cực đại</div>
                    </div>
                  </div>
                  <Progress
                    mt="sm"
                    value={scenario.score}
                    color={scenario.score >= 80 ? "teal" : scenario.score >= 60 ? "yellow" : "red"}
                  />
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <ScenarioMetric label="ĐMT mái nhà" value={`${fmt(scenario.rooftopKwp)} kWp`} />
                    <ScenarioMetric
                      label="Tỷ lệ NL xanh"
                      value={`${fmt(scenario.renewableCoveragePct, 1)}%`}
                    />
                    <ScenarioMetric
                      label="Sản lượng mái"
                      value={`${fmt(scenario.rooftopAnnualOutputMwh, 1)} MWh`}
                    />
                    <ScenarioMetric
                      label="Phát thải"
                      value={`${fmt(scenario.estimatedAnnualCo2eTonnes, 1)} tCO₂e`}
                    />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-slate-800">{scenario.headline}</p>
                  <ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-600">
                    {scenario.rationale.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-blue-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </Paper>
              ))}
            </div>
            <EvidenceSection title="Lộ trình thủ tục đề xuất" count={result.procedures.length}>
              <div className="divide-y divide-slate-100">
                {result.procedures.map((item) => (
                  <div
                    key={item.step}
                    className="grid gap-3 p-4 md:grid-cols-[44px_minmax(0,1fr)_auto]"
                  >
                    <div className="grid size-10 place-items-center rounded-full bg-blue-600 font-bold text-white">
                      {item.step}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{item.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        <strong>Đơn vị phối hợp:</strong> {item.agency}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.requiredInputs.map((entry) => (
                          <Badge key={entry} size="xs" variant="outline">
                            {entry}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Badge
                      color={
                        item.status === "READY"
                          ? "teal"
                          : item.status === "SCREENING"
                            ? "blue"
                            : "yellow"
                      }
                      variant="light"
                      className="self-start"
                    >
                      {STATUS_LABEL[item.status]}
                    </Badge>
                  </div>
                ))}
              </div>
            </EvidenceSection>
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="evidence">
          <div className="space-y-4 rounded-b-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {result.dataCoverage.map((item) => (
                <Paper key={item.domain} withBorder radius="md" p="sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-slate-900">{item.label}</div>
                    <Badge
                      size="xs"
                      color={
                        item.status === "AVAILABLE"
                          ? "teal"
                          : item.status === "LIMITED"
                            ? "yellow"
                            : "gray"
                      }
                      variant="light"
                    >
                      {item.status === "AVAILABLE"
                        ? "Sẵn sàng"
                        : item.status === "LIMITED"
                          ? "Hạn chế"
                          : "Chưa có"}
                    </Badge>
                  </div>
                  <div className="mt-3 text-2xl font-bold text-blue-700">{fmt(item.records)}</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{item.note}</p>
                </Paper>
              ))}
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <EvidenceSection title="Trạm sạc gần vị trí" count={result.nearby.evStations.length}>
                <div className="divide-y divide-slate-100">
                  {result.nearby.evStations.map((row) => (
                    <div key={row.id} className="flex items-center justify-between gap-3 p-3">
                      <div>
                        <div className="font-semibold text-slate-900">{row.name}</div>
                        <div className="text-xs text-slate-500">
                          {row.code} · {fmt(row.distanceKm, 2)} km
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-violet-700">{fmt(row.powerKw)} kW</div>
                        <div className="text-xs text-slate-500">
                          {row.availableConnectors}/{row.connectors} cổng trống
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </EvidenceSection>
              <EvidenceSection
                title="Cơ sở phụ tải gần vị trí"
                count={result.nearby.consumers.length}
              >
                <div className="divide-y divide-slate-100">
                  {result.nearby.consumers.map((row) => (
                    <div key={row.id} className="flex items-start justify-between gap-3 p-3">
                      <div>
                        <div className="font-semibold text-slate-900">{row.name}</div>
                        <div className="text-xs text-slate-500">
                          {row.sector} · {fmt(row.distanceKm, 2)} km
                        </div>
                      </div>
                      <div className="text-right text-xs text-slate-600">
                        {fmt(row.reportedEnergyMwh, 1)} MWh
                      </div>
                    </div>
                  ))}
                </div>
              </EvidenceSection>
            </div>
            <EvidenceSection
              title="Dự án nguồn điện trong vùng"
              count={result.nearby.projects.length}
            >
              {result.nearby.projects.length ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {result.nearby.projects.map((row) => (
                    <div key={row.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="font-semibold text-slate-900">{row.name}</div>
                      <div className="mt-2 flex justify-between text-xs text-slate-500">
                        <span>{row.sourceType}</span>
                        <span>{fmt(row.distanceKm, 2)} km</span>
                      </div>
                      <div className="mt-2 text-lg font-bold text-emerald-700">
                        {fmt(row.capacityMw, 2)} MW
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyEvidence text="Không ghi nhận dự án nguồn điện trong bán kính đã chọn; hệ mái nhà và lưới điện vẫn được đánh giá riêng." />
              )}
            </EvidenceSection>
          </div>
        </Tabs.Panel>
      </Tabs>
    </section>
  );
}

function HeroFact({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-3 backdrop-blur">
      <div className="text-xl font-bold">{value}</div>
      <div className="mt-0.5 text-[11px] text-blue-50/75">{label}</div>
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "emerald" | "amber" | "violet" | "slate";
}) {
  const classes = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    violet: "bg-violet-50 text-violet-700 border-violet-100",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
  }[tone];
  return (
    <Paper withBorder radius="lg" p="md" className="shadow-sm">
      <div className="flex items-start gap-3">
        <div className={cn("grid size-10 shrink-0 place-items-center rounded-xl border", classes)}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </div>
          <div className="mt-1 truncate text-xl font-bold text-slate-900">{value}</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">{detail}</div>
        </div>
      </div>
    </Paper>
  );
}

function ScoreCard({ item }: { item: AssessmentBreakdownItem }) {
  const Icon = SCORE_ICONS[item.key] ?? Gauge;
  const pct = Math.round((item.score / item.maxScore) * 100);
  return (
    <Tooltip multiline w={320} label={item.evidence.join(" · ")}>
      <Paper withBorder radius="md" p="sm" className="shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "grid size-8 place-items-center rounded-lg border",
                scoreTone(item.status),
              )}
            >
              <Icon className="size-4" />
            </div>
            <div className="text-sm font-semibold text-slate-800">{item.label}</div>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-slate-900">{item.score}</span>
            <span className="text-xs text-slate-500">/{item.maxScore}</span>
          </div>
        </div>
        <Progress
          mt="sm"
          value={pct}
          color={item.status === "GOOD" ? "teal" : item.status === "WATCH" ? "yellow" : "red"}
        />
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{item.summary}</p>
      </Paper>
    </Tooltip>
  );
}

function ChartPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <Paper withBorder radius="lg" className="overflow-hidden shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
      </div>
      <div className="p-2">{children}</div>
    </Paper>
  );
}

function FindingList({
  title,
  icon: Icon,
  items,
  tone,
}: {
  title: string;
  icon: LucideIcon;
  items: string[];
  tone: "good" | "warn" | "info";
}) {
  const styles =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50/70 text-amber-950"
        : "border-blue-200 bg-blue-50/70 text-blue-950";
  return (
    <div className={cn("rounded-xl border p-4", styles)}>
      <div className="flex items-center gap-2 font-semibold">
        <Icon className="size-5" />
        {title}
      </div>
      <ul className="mt-3 space-y-2 text-sm leading-6">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-current opacity-70" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MiniSummary({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <Paper withBorder radius="md" p="sm">
      <div className="flex items-center gap-3">
        <ThemeIcon color="brand" variant="light" radius="md">
          <Icon className="size-4" />
        </ThemeIcon>
        <div>
          <div className="text-xs text-slate-500">{label}</div>
          <div className="font-semibold text-slate-900">{value}</div>
        </div>
      </div>
    </Paper>
  );
}

function EvidenceSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <Paper withBorder radius="lg" className="overflow-hidden shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <Badge variant="light" color="blue">
          {count} bản ghi
        </Badge>
      </div>
      {children}
    </Paper>
  );
}

function EmptyEvidence({ text }: { text: string }) {
  return <div className="p-6 text-center text-sm text-slate-500">{text}</div>;
}

function ScenarioMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <div className="text-slate-500">{label}</div>
      <div className="mt-0.5 font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function AssessmentSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => (
        <Paper key={index} withBorder radius="lg" p="md">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-1/2 rounded bg-slate-200" />
            <div className="h-7 w-3/4 rounded bg-slate-200" />
            <div className="h-3 w-full rounded bg-slate-100" />
          </div>
        </Paper>
      ))}
    </div>
  );
}
