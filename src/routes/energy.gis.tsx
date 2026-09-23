import { useMemo, useState } from "react";
import { createFileRoute } from "@/lib/router-compat";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BatteryCharging,
  BrainCircuit,
  Cable,
  CheckCircle2,
  Cloud,
  Crosshair,
  Factory,
  Leaf,
  LoaderCircle,
  Map as MapIcon,
  MapPin,
  PlugZap,
  RadioTower,
  Search,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import {
  EnergyError,
  EnergyLoading,
  EntityDetailDrawer,
  FieldGrid,
  SearchShell,
} from "@/components/energy/EnergyShared";
import { EnergyMap, type EnergyMapEntity } from "@/components/energy/EnergyMap";
import { getEnergyGisData } from "@/lib/energy-service";
import { cn } from "@/lib/utils";

type InvestmentAssessment = {
  location: {
    lat: number;
    lng: number;
    displayName: string | null;
    adminArea: { code: string; name: string; level: string } | null;
    radiusKm: number;
  };
  assessment: {
    score: number;
    grade: "FAVORABLE" | "CONDITIONAL" | "REVIEW_REQUIRED";
    label: string;
    conclusion: string;
    recommendations: string[];
    disclaimer: string;
  };
  metrics: {
    projects: number;
    generationCapacityMw: number;
    substations: number;
    availableCapacityMva: number;
    nearestSubstationKm: number | null;
    lines: number;
    nearestLineKm: number | null;
    rooftopSystems: number;
    rooftopCapacityMw: number;
    activeIncidents: number;
  };
  nearby: {
    projects: Array<{ id: string; name: string; capacityMw: number; distanceKm: number }>;
    substations: Array<{
      id: string;
      name: string;
      voltageKv: number;
      availableCapacityMva: number;
      loadFactorPct: number;
      distanceKm: number;
    }>;
    lines: Array<{
      id: string;
      name: string;
      voltageKv: number;
      distanceKm: number;
    }>;
  };
};

async function assessInvestment(input: {
  lat?: number;
  lng?: number;
  address?: string;
  radiusKm: number;
}) {
  const params = new URLSearchParams({ radiusKm: String(input.radiusKm) });
  if (input.lat != null && input.lng != null) {
    params.set("lat", String(input.lat));
    params.set("lng", String(input.lng));
  } else if (input.address) {
    params.set("address", input.address);
  }
  const response = await fetch(`/api/gis/investment-assessment?${params}`, {
    cache: "no-store",
  });
  const body = (await response.json()) as InvestmentAssessment & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Không thể đánh giá vị trí đầu tư.");
  return body;
}

export const Route = createFileRoute("/energy/gis")({
  head: () => ({
    meta: [
      { title: "GIS Năng lượng | Nền tảng ngành Công Thương" },
      {
        name: "description",
        content: "Bản đồ GIS năng lượng độc lập: trạm, tuyến, dự án, sự cố, carbon và trạm sạc.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<EnergyMapEntity | null>(null);
  const [analysisPoint, setAnalysisPoint] = useState({ lat: 10.555, lng: 106.414 });
  const [address, setAddress] = useState("");
  const [radiusKm, setRadiusKm] = useState(10);
  const dataQuery = useQuery({ queryKey: ["energy", "gis"], queryFn: getEnergyGisData });
  const assessmentMutation = useMutation({
    mutationFn: assessInvestment,
    onSuccess: (result) => {
      setAnalysisPoint({ lat: result.location.lat, lng: result.location.lng });
    },
  });

  const evaluatePoint = (point: { lat: number; lng: number }) => {
    setAnalysisPoint(point);
    assessmentMutation.mutate({ ...point, radiusKm });
  };

  const searchHits = useMemo(() => {
    if (!dataQuery.data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const rows: EnergyMapEntity[] = [
      ...dataQuery.data.substations.map((item) => ({ kind: "substation" as const, item })),
      ...dataQuery.data.projects.map((item) => ({ kind: "project" as const, item })),
      ...dataQuery.data.rooftopSolar.map((item) => ({ kind: "rooftop" as const, item })),
      ...dataQuery.data.incidents.map((item) => ({ kind: "incident" as const, item })),
      ...dataQuery.data.emissionSources.map((item) => ({ kind: "emission" as const, item })),
      ...dataQuery.data.chargingStations.map((item) => ({ kind: "charging" as const, item })),
      ...dataQuery.data.keyConsumers.map((item) => ({ kind: "consumer" as const, item })),
    ];
    return rows
      .filter((entity) => JSON.stringify(entity.item).toLowerCase().includes(q))
      .slice(0, 6);
  }, [dataQuery.data, query]);

  if (dataQuery.isLoading) return <EnergyLoading />;
  if (dataQuery.isError || !dataQuery.data)
    return <EnergyError onRetry={() => void dataQuery.refetch()} />;

  const data = dataQuery.data;
  const overloadedSubstations = data.substations.filter(
    (item) => (item.loadFactor ?? 0) >= 100,
  ).length;
  const activeIncidents = data.incidents.filter(
    (item) => !["Hoàn thành", "Đã xử lý"].includes(item.progress ?? ""),
  ).length;
  const rooftopCapacityMw =
    data.rooftopSolar.reduce((sum, item) => sum + (item.installedCapacityKw ?? 0), 0) / 1000;
  const totalCo2e = data.emissionSources.reduce((sum, item) => sum + item.co2e, 0) / 1000;

  return (
    <>
      <PageHeader
        title="GIS Năng lượng"
        description="Bản đồ lớp năng lượng: base map, trạm biến áp, tuyến điện, trụ điện, dự án nguồn điện, ĐMT mái nhà, sự cố, carbon và trạm sạc."
        crumbs={[{ label: "Nguồn năng lượng tái tạo", to: "/energy" }, { label: "GIS Năng lượng" }]}
        variant="panel"
        icon={MapIcon}
        actions={
          <SearchShell
            value={query}
            onChange={setQuery}
            placeholder="Tìm trạm / dự án / trạm sạc..."
          />
        }
      />

      <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Lưới & trạm theo GIS"
              value={data.substations.length + data.lines.length}
              delta={`${data.substations.length} trạm, ${data.lines.length} tuyến`}
              icon={Cable}
              tone="gov"
            />
            <StatCard
              label="Công suất ĐMT mái nhà"
              value={`${fmt(rooftopCapacityMw)} MWp`}
              delta={`${data.rooftopSolar.length} hệ thống đấu nối`}
              icon={Leaf}
              tone="success"
            />
            <StatCard
              label="Dự án nguồn điện"
              value={data.projects.length}
              delta="Mặt trời, sinh khối, điện rác, gió"
              icon={Factory}
              tone="warning"
            />
            <StatCard
              label="Cảnh báo vận hành"
              value={overloadedSubstations + activeIncidents}
              delta={`${overloadedSubstations} trạm quá tải, ${activeIncidents} sự cố`}
              icon={AlertTriangle}
              tone="danger"
            />
            <StatCard
              label="Phát thải CO2e"
              value={`${fmt(totalCo2e)} nghìn tấn`}
              delta={`${data.emissionSources.length} nguồn/cơ sở phát thải`}
              icon={Cloud}
              tone="analytics"
            />
            <StatCard
              label="Hạ tầng sạc điện"
              value={data.chargingStations.length}
              delta="Theo dõi công suất, cổng trống, vùng quá tải"
              icon={BatteryCharging}
              tone="teal"
            />
          </section>

          <section className="gov-card grid grid-cols-1 gap-4 p-4 lg:grid-cols-[1.1fr_.9fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gov">
                Theo kế hoạch triển khai 2026-2030
              </p>
              <h2 className="mt-1 text-lg font-semibold text-navy">
                Bản đồ GIS là lớp điều hành dữ liệu năng lượng dùng chung
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Tài liệu yêu cầu quản lý toàn diện nguồn điện, lưới điện, phụ tải, năng lượng tái
                tạo, an toàn hành lang, phát thải carbon và trạm sạc trên nền GIS; đồng thời chuẩn
                bị dữ liệu cho AI dự báo quá tải, tiềm năng phát triển, sự cố và nhu cầu sử dụng
                điện.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {PLAN_FOCUS.map((item) => (
                <div
                  key={item.title}
                  className="rounded-md border border-border bg-surface px-3 py-2"
                >
                  <p className="text-sm font-semibold text-navy">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {searchHits.length ? (
            <div className="gov-card flex flex-wrap gap-2 p-3">
              {searchHits.map((hit) => (
                <button
                  key={`${hit.kind}:${hit.item.id}`}
                  type="button"
                  onClick={() => setSelected(hit)}
                  className="rounded-md border border-gov/25 bg-gov/5 px-3 py-1.5 text-xs font-medium text-gov hover:bg-gov/10"
                >
                  {entityTitle(hit)}
                </button>
              ))}
            </div>
          ) : null}

          <div className="gov-card overflow-hidden">
            <EnergyMap
              data={data}
              height={760}
              fill
              selectedKey={selected ? `${selected.kind}:${selected.item.id}` : null}
              onSelectEntity={setSelected}
              onMapClick={evaluatePoint}
              extraCircles={[
                {
                  id: "investment-radius",
                  lat: analysisPoint.lat,
                  lng: analysisPoint.lng,
                  radiusMeters: radiusKm * 1_000,
                  color: "#1565C0",
                  fillOpacity: 0.07,
                  label: `Vùng phân tích ${radiusKm} km`,
                },
              ]}
              extraMarkers={[
                {
                  id: "investment-location",
                  lat: analysisPoint.lat,
                  lng: analysisPoint.lng,
                  label: "Vị trí đang đánh giá",
                  sublabel: `${analysisPoint.lat.toFixed(6)}, ${analysisPoint.lng.toFixed(6)}`,
                  color: "#1565C0",
                  glyph: "ĐT",
                },
              ]}
              extraLegend={[{ color: "#1565C0", label: "Vị trí và bán kính đánh giá" }]}
            />
          </div>
        </div>

        <aside className="space-y-4">
          <section className="gov-card overflow-hidden border-gov/25">
            <div className="border-b border-border bg-gov/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <Crosshair className="size-4 text-gov" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
                  Hỗ trợ quyết định đầu tư
                </h2>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Nhấp bản đồ, nhập tọa độ hoặc tìm địa chỉ tại Tây Ninh để tổng hợp hạ tầng điện lân
                cận.
              </p>
            </div>

            <div className="space-y-3 p-4">
              <label className="block text-xs font-semibold text-navy">
                Địa chỉ
                <div className="mt-1 flex gap-2">
                  <input
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && address.trim()) {
                        assessmentMutation.mutate({ address: address.trim(), radiusKm });
                      }
                    }}
                    placeholder="Phường, xã, khu công nghiệp..."
                    className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-xs outline-none focus:border-gov"
                  />
                  <button
                    type="button"
                    aria-label="Tìm và đánh giá địa chỉ"
                    disabled={!address.trim() || assessmentMutation.isPending}
                    onClick={() => assessmentMutation.mutate({ address: address.trim(), radiusKm })}
                    className="grid size-9 shrink-0 place-items-center rounded-md bg-gov text-white disabled:opacity-50"
                  >
                    <Search className="size-4" />
                  </button>
                </div>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold text-navy">
                  Vĩ độ
                  <input
                    type="number"
                    step="0.000001"
                    value={analysisPoint.lat}
                    onChange={(event) =>
                      setAnalysisPoint((value) => ({ ...value, lat: Number(event.target.value) }))
                    }
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-xs tabular-nums outline-none focus:border-gov"
                  />
                </label>
                <label className="text-xs font-semibold text-navy">
                  Kinh độ
                  <input
                    type="number"
                    step="0.000001"
                    value={analysisPoint.lng}
                    onChange={(event) =>
                      setAnalysisPoint((value) => ({ ...value, lng: Number(event.target.value) }))
                    }
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-xs tabular-nums outline-none focus:border-gov"
                  />
                </label>
              </div>

              <div className="flex items-end gap-2">
                <label className="min-w-0 flex-1 text-xs font-semibold text-navy">
                  Bán kính phân tích
                  <select
                    value={radiusKm}
                    onChange={(event) => setRadiusKm(Number(event.target.value))}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-gov"
                  >
                    {[3, 5, 10, 15, 20, 30].map((value) => (
                      <option key={value} value={value}>
                        {value} km
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => evaluatePoint(analysisPoint)}
                  disabled={assessmentMutation.isPending}
                  className="flex h-9 items-center gap-1.5 rounded-md bg-gov px-3 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {assessmentMutation.isPending ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : (
                    <MapPin className="size-3.5" />
                  )}
                  Đánh giá
                </button>
              </div>

              {assessmentMutation.isError ? (
                <p className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs leading-5 text-destructive">
                  {assessmentMutation.error.message}
                </p>
              ) : null}

              {assessmentMutation.data ? (
                <InvestmentResult result={assessmentMutation.data} />
              ) : (
                <div className="rounded-md border border-dashed border-gov/30 bg-gov/5 px-3 py-4 text-center text-xs leading-5 text-muted-foreground">
                  Chọn một vị trí để xem trạm, tuyến điện, nguồn điện và công suất khả dụng trong
                  vùng lân cận.
                </div>
              )}
            </div>
          </section>

          <section className="gov-card overflow-hidden">
            <h2 className="border-b border-border px-4 py-3 text-sm font-semibold uppercase tracking-wide text-navy">
              Lớp dữ liệu cần thể hiện
            </h2>
            <div className="divide-y divide-border">
              {GIS_LAYER_GROUPS.map((item) => (
                <div key={item.title} className="flex gap-3 px-4 py-3">
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-md",
                      item.bg,
                    )}
                  >
                    <item.icon className={cn("size-4.5", item.fg)} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-navy">{item.title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="gov-card p-4">
            <div className="flex items-center gap-2">
              <BrainCircuit className="size-4 text-gov" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
                Gợi ý AI ưu tiên
              </h2>
            </div>
            <div className="mt-3 space-y-2">
              {AI_PRIORITIES.map((item) => (
                <div
                  key={item}
                  className="rounded-md border border-dashed border-gov/30 bg-gov/5 px-3 py-2 text-xs leading-5 text-navy"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="gov-card p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
              Hồ sơ đang chọn
            </h2>
            {selected ? (
              <div className="mt-3 rounded-md bg-surface p-3">
                <p className="text-sm font-semibold text-navy">{entityTitle(selected)}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {entitySubtitle(selected)}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Chọn một điểm trên bản đồ hoặc kết quả tìm kiếm để xem hồ sơ chi tiết.
              </p>
            )}
          </section>
        </aside>
      </div>

      <EntityDetailDrawer
        open={!!selected}
        onOpenChange={(value) => !value && setSelected(null)}
        title="Hồ sơ đối tượng GIS"
        description={selected ? entityTitle(selected) : undefined}
      >
        {selected ? (
          <FieldGrid
            items={Object.entries(selected.item)
              .filter(([, value]) => typeof value !== "object")
              .slice(0, 16)
              .map(([label, value]) => ({ label, value: String(value ?? "") }))}
          />
        ) : null}
      </EntityDetailDrawer>
    </>
  );
}

const PLAN_FOCUS = [
  {
    title: "Dữ liệu đầy đủ, cập nhật thường xuyên",
    description:
      "Mỗi lớp GIS cần gắn hồ sơ kỹ thuật, vận hành, quy hoạch và đơn vị chịu trách nhiệm cập nhật.",
  },
  {
    title: "Liên thông điều hành và chia sẻ dữ liệu",
    description:
      "Cấu trúc bản đồ phải sẵn sàng kết nối CSDL tỉnh, điện lực, địa phương và hệ thống quốc gia.",
  },
  {
    title: "AI có kiểm soát, có nhật ký vận hành",
    description:
      "Các dự báo quá tải, sự cố, phát thải, nhu cầu sạc phải đi kèm cơ chế giám sát và đánh giá rủi ro.",
  },
];

const GIS_LAYER_GROUPS: {
  title: string;
  description: string;
  icon: LucideIcon;
  bg: string;
  fg: string;
}[] = [
  {
    title: "Lưới điện và trạm biến áp",
    description:
      "Vị trí trạm, tuyến dây, trụ điện, hành lang an toàn, khu vực cấp điện và vùng phụ tải.",
    icon: Cable,
    bg: "bg-gov/10",
    fg: "text-gov",
  },
  {
    title: "Nguồn điện và ĐMT mái nhà",
    description:
      "Dự án tập trung, hệ thống mái nhà, điểm đấu nối, công suất, khả năng tiếp nhận và tiềm năng phát triển.",
    icon: Zap,
    bg: "bg-warning/15",
    fg: "text-warning",
  },
  {
    title: "Phụ tải, tiết kiệm điện, sự cố",
    description:
      "Cơ sở tiêu thụ trọng điểm, khu vực quá tải, điểm tổn thất, sự cố và phạm vi ảnh hưởng.",
    icon: PlugZap,
    bg: "bg-teal/10",
    fg: "text-teal",
  },
  {
    title: "Carbon và trạm sạc thông minh",
    description:
      "Nguồn phát thải, dự án giảm phát thải, trạm sạc, công suất cấp điện và số cổng còn trống.",
    icon: Cloud,
    bg: "bg-analytics/10",
    fg: "text-analytics",
  },
];

const AI_PRIORITIES = [
  "Dự báo quá tải trạm/tuyến và đề xuất nâng cấp công suất.",
  "Đánh giá khả năng giải tỏa công suất dự án năng lượng tái tạo.",
  "Dự báo sản lượng ĐMT mái nhà và khả năng tiếp nhận của lưới.",
  "Cảnh báo sự cố, vi phạm hành lang, phát thải và nhu cầu sạc điện.",
];

function fmt(value: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value);
}

function InvestmentResult({ result }: { result: InvestmentAssessment }) {
  const favorable = result.assessment.grade === "FAVORABLE";
  const conditional = result.assessment.grade === "CONDITIONAL";
  const tone = favorable
    ? "border-success/30 bg-success/10 text-success"
    : conditional
      ? "border-warning/35 bg-warning/10 text-warning"
      : "border-destructive/30 bg-destructive/10 text-destructive";
  const metrics = [
    {
      icon: RadioTower,
      label: "Trạm biến áp",
      value: `${result.metrics.substations} trạm`,
      detail:
        result.metrics.nearestSubstationKm == null
          ? "Chưa có trong bán kính"
          : `Gần nhất ${fmt(result.metrics.nearestSubstationKm)} km · còn ${fmt(result.metrics.availableCapacityMva)} MVA`,
    },
    {
      icon: Cable,
      label: "Tuyến điện",
      value: `${result.metrics.lines} tuyến`,
      detail:
        result.metrics.nearestLineKm == null
          ? "Chưa có trong bán kính"
          : `Gần nhất ${fmt(result.metrics.nearestLineKm)} km`,
    },
    {
      icon: Factory,
      label: "Nguồn điện",
      value: `${result.metrics.projects} dự án`,
      detail: `${fmt(result.metrics.generationCapacityMw)} MW thiết kế`,
    },
    {
      icon: Zap,
      label: "Điện mặt trời mái nhà",
      value: `${result.metrics.rooftopSystems.toLocaleString("vi-VN")} hệ thống`,
      detail: `${fmt(result.metrics.rooftopCapacityMw)} MWp`,
    },
  ];

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className={cn("rounded-lg border p-3", tone)}>
        <div className="flex items-center gap-3">
          <div className="grid size-12 shrink-0 place-items-center rounded-full border-4 border-current/20 bg-card text-base font-black tabular-nums">
            {result.assessment.score}
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-bold">
              <CheckCircle2 className="size-4" /> {result.assessment.label}
            </p>
            <p className="mt-0.5 text-[11px] opacity-80">
              {result.location.adminArea?.name ?? result.location.displayName ?? "Tọa độ đã chọn"}
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs leading-5 text-navy">{result.assessment.conclusion}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {metrics.map((item) => (
          <div key={item.label} className="rounded-md border border-border bg-surface p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <item.icon className="size-3 text-gov" /> {item.label}
            </div>
            <p className="mt-1 text-sm font-bold text-navy">{item.value}</p>
            <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{item.detail}</p>
          </div>
        ))}
      </div>

      <div className="rounded-md border border-border bg-surface p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy">Khuyến nghị</p>
        <ul className="mt-2 space-y-1.5">
          {result.assessment.recommendations.map((item) => (
            <li key={item} className="flex gap-2 text-xs leading-5 text-muted-foreground">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-gov" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {(result.nearby.substations.length || result.nearby.projects.length) > 0 ? (
        <details className="rounded-md border border-border bg-surface p-3">
          <summary className="cursor-pointer text-xs font-semibold text-navy">
            Xem đối tượng gần vị trí
          </summary>
          <div className="mt-2 max-h-44 space-y-1.5 overflow-y-auto">
            {result.nearby.substations.slice(0, 4).map((item) => (
              <div key={item.id} className="rounded bg-gov/5 px-2 py-1.5 text-[11px]">
                <p className="font-semibold text-navy">{item.name}</p>
                <p className="text-muted-foreground">
                  {item.voltageKv} kV · {fmt(item.distanceKm)} km · còn{" "}
                  {fmt(item.availableCapacityMva)} MVA
                </p>
              </div>
            ))}
            {result.nearby.projects.slice(0, 4).map((item) => (
              <div key={item.id} className="rounded bg-warning/5 px-2 py-1.5 text-[11px]">
                <p className="font-semibold text-navy">{item.name}</p>
                <p className="text-muted-foreground">
                  {fmt(item.capacityMw)} MW · {fmt(item.distanceKm)} km
                </p>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <p className="text-[10px] leading-4 text-muted-foreground">{result.assessment.disclaimer}</p>
    </div>
  );
}

function entityTitle(entity: EnergyMapEntity) {
  if (entity.kind === "substation") return entity.item.name;
  if (entity.kind === "project") return entity.item.name;
  if (entity.kind === "rooftop") return entity.item.owner;
  if (entity.kind === "incident") return entity.item.code;
  if (entity.kind === "emission") return entity.item.unit;
  if (entity.kind === "charging") return entity.item.name;
  return entity.item.name;
}

function entitySubtitle(entity: EnergyMapEntity) {
  if (entity.kind === "substation") {
    return `${entity.item.voltageLevel} · ${entity.item.district} · tải ${entity.item.loadFactor ?? 0}%`;
  }
  if (entity.kind === "project") {
    return `${entity.item.type} · ${entity.item.designCapacityMw ?? 0} MW · ${entity.item.status}`;
  }
  if (entity.kind === "rooftop") {
    return `${entity.item.customerType} · ${entity.item.installedCapacityKw ?? 0} kWp · ${entity.item.district}`;
  }
  if (entity.kind === "incident") {
    return `${entity.item.type} · ${entity.item.affectedArea} · ${entity.item.progress ?? "Đang cập nhật"}`;
  }
  if (entity.kind === "emission") {
    return `${entity.item.sourceType} · ${fmt(entity.item.co2e)} tấn CO2e · ${entity.item.district}`;
  }
  if (entity.kind === "charging") {
    return `${entity.item.type} · ${entity.item.powerKw} kW · ${entity.item.freePorts} cổng trống`;
  }
  return `${entity.item.type} · ${entity.item.sector} · ${fmt(entity.item.maxDemandKw)} kW cực đại`;
}
