import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  BrainCircuit,
  Check,
  History,
  Info,
  Loader2,
  LocateFixed,
  MapPin,
  Search,
  Send,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { EnergyMapExtraCircle, EnergyMapExtraMarker } from "@/components/energy/EnergyMap";
import {
  getChargingDemandForecast,
  getChargingLocationAnalysis,
  getChargingStationSuggestions,
} from "@/lib/energy-service";
import type {
  ChargingForecastHorizon,
  ChargingLocationAnalysis,
  ChargingStation,
  ChargingStationSuggestion,
} from "@/lib/energy-types";
import { cn } from "@/lib/utils";

const HORIZONS: ChargingForecastHorizon[] = ["7 ngày", "1 tháng", "Quý", "1 năm"];

const CHARGING_DISTRICTS = [
  "Toàn tỉnh",
  "TP. Tây Ninh",
  "Trảng Bàng",
  "Tân Biên",
  "Gò Dầu",
  "Bến Cầu",
  "Châu Thành",
];

const RISK_TONE: Record<string, string> = {
  Cao: "border-destructive/30 bg-destructive/10 text-destructive",
  "Trung bình": "border-warning/40 bg-warning/15 text-warning",
  Thấp: "border-success/30 bg-success/10 text-success",
};

const fmt = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);

function districtCenter(stations: ChargingStation[], district: string) {
  const rows =
    district === "Toàn tỉnh" ? stations : stations.filter((s) => s.district === district);
  const withCoord = rows.filter((s) => s.latitude && s.longitude);
  if (!withCoord.length) return null;
  const lat = withCoord.reduce((s, r) => s + (r.latitude ?? 0), 0) / withCoord.length;
  const lng = withCoord.reduce((s, r) => s + (r.longitude ?? 0), 0) / withCoord.length;
  return { lat, lng };
}

export function ChargingAiPanel({
  stations,
  onCirclesChange,
  onMarkersChange,
  onFocusStation,
  onFocusExtra,
}: {
  stations: ChargingStation[];
  onCirclesChange: (circles: EnergyMapExtraCircle[]) => void;
  onMarkersChange: (markers: EnergyMapExtraMarker[]) => void;
  onFocusStation: (stationId: string) => void;
  onFocusExtra: (extraKey: string) => void;
}) {
  const [district, setDistrict] = useState<string>("Toàn tỉnh");
  const [horizon, setHorizon] = useState<ChargingForecastHorizon>("Quý");
  const [proposals, setProposals] = useState<ChargingStationSuggestion[]>([]);
  const [activeSuggestionId, setActiveSuggestionId] = useState<string | null>(null);

  const forecastQuery = useQuery({
    queryKey: ["energy", "charging-forecast", district, horizon],
    queryFn: () => getChargingDemandForecast(district, horizon),
  });
  const suggestionsQuery = useQuery({
    queryKey: ["energy", "charging-suggestions"],
    queryFn: getChargingStationSuggestions,
  });

  const suggestions = useMemo(() => suggestionsQuery.data ?? [], [suggestionsQuery.data]);
  const data = forecastQuery.data;

  useEffect(() => {
    setProposals(suggestions);
  }, [suggestions]);

  // Cảnh báo AI: vùng nhu cầu sạc cao (vượt ngưỡng) → circle trên bản đồ.
  useEffect(() => {
    const center = districtCenter(stations, district);
    if (data && data.risk !== "Thấp" && center) {
      onCirclesChange([
        {
          id: `forecast-${district}`,
          lat: center.lat,
          lng: center.lng,
          radiusMeters: 7000,
          color: data.risk === "Cao" ? "#C62828" : "#E59A23",
          fillOpacity: 0.12,
          label: `Cảnh báo nhu cầu sạc ${district}`,
          popup: `<div style="color:#64748b;font-size:11px">${data.note}</div>`,
        },
      ]);
    } else {
      onCirclesChange([]);
    }
  }, [data, district, onCirclesChange, stations]);

  // Marker AI: vị trí trạm sạc đề xuất.
  useEffect(() => {
    const markers: EnergyMapExtraMarker[] = suggestions.slice(0, 6).map((s) => ({
      id: s.id,
      lat: s.latitude,
      lng: s.longitude,
      label: s.title,
      sublabel: `Điểm số ${s.score}/100 · đề xuất ${s.demandKw} kW · ${s.reasons[0] ?? ""}`,
      color: "#7C3AED",
      glyph: "NEW",
      onSelect: () => {
        setActiveSuggestionId(s.id);
        onFocusExtra(`extra:${s.id}`);
      },
    }));
    onMarkersChange(markers);
  }, [onFocusExtra, onMarkersChange, suggestions]);

  const setProposalStatus = (
    id: string,
    workflowStatus: ChargingStationSuggestion["workflowStatus"],
  ) => {
    const label =
      workflowStatus === "PENDING"
        ? "Đã trình duyệt đề xuất."
        : workflowStatus === "APPROVED"
          ? "Đã duyệt đề xuất."
          : "Đã trả về đề xuất.";
    setProposals((prev) => prev.map((p) => (p.id === id ? { ...p, workflowStatus } : p)));
    toast.success(label);
  };

  return (
    <div className="space-y-4">
      {/* ─────────── 1. Dự báo nhu cầu sạc ─────────── */}
      <section className="gov-card flex flex-col overflow-hidden">
        <header className="flex flex-wrap items-center gap-3 border-b border-border bg-grad-gov/60 px-4 py-3">
          <span className="flex size-9 items-center justify-center rounded-md bg-analytics/15 text-analytics">
            <BrainCircuit className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
                AI dự báo nhu cầu sạc điện
              </h2>
              <Badge
                variant="outline"
                className="rounded-md border-analytics/30 bg-analytics/10 text-analytics"
              >
                <Sparkles className="size-3" />
                Bản phân tích AI
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Hồi quy tuyến tính + phân rã mùa vụ trên chuỗi 12 kỳ nhu cầu sạc theo huyện — hỗ trợ
              quy hoạch trạm sạc giai đoạn tới.
            </p>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-3">
          <Select value={district} onValueChange={setDistrict}>
            <SelectTrigger className="h-8 w-44 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHARGING_DISTRICTS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 rounded-md border border-border bg-background p-1">
            {HORIZONS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHorizon(h)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                  horizon === h
                    ? "bg-gov text-white shadow-sm"
                    : "text-muted-foreground hover:bg-surface hover:text-navy",
                )}
              >
                {h}
              </button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {data ? <RiskBadge risk={data.risk} /> : null}
          </div>
        </div>

        <div className="flex-1 p-4">
          {forecastQuery.isLoading || !data ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
              <Skeleton className="h-64 rounded-xl sm:col-span-2 lg:col-span-4" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <SummaryChip label="Nhu cầu kỳ gần nhất" value={`${fmt(data.lastActualKwh)} kWh`} />
                <SummaryChip
                  label="Nhu cầu dự báo đỉnh"
                  value={`${fmt(data.peakForecastKwh)} kWh`}
                />
                <SummaryChip label="Tăng trưởng/năm" value={`~${data.growthPerYearPct}%`} />
                <SummaryChip label="Độ tin cậy" value={`${data.confidencePct}%`} />
              </div>

              <div className="rounded-md border border-border">
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart
                    data={data.points}
                    margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="chargeBandGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#7C3AED" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      domain={[
                        0,
                        (dataMax: number) =>
                          Math.ceil((Math.max(dataMax, data.thresholdKwh) * 1.1) / 1000) * 1000,
                      ]}
                    />
                    <Tooltip
                      formatter={(value: unknown, name: string) => {
                        if (typeof value !== "number") return [String(value ?? ""), name];
                        const label =
                          name === "actual"
                            ? "Thực tế"
                            : name === "base"
                              ? "Dự báo"
                              : name === "min"
                                ? "Cận dưới"
                                : name === "max"
                                  ? "Cận trên"
                                  : name === "threshold"
                                    ? "Ngưỡng"
                                    : name;
                        return [`${fmt(value)} kWh`, label];
                      }}
                    />
                    <ReferenceLine
                      y={data.thresholdKwh}
                      stroke="#E59A23"
                      strokeDasharray="5 5"
                      label={{ value: "Ngưỡng", position: "insideTopRight", fontSize: 10 }}
                    />
                    <Area
                      stackId="conf"
                      type="monotone"
                      dataKey="min"
                      stroke="none"
                      fill="url(#chargeBandGrad)"
                      connectNulls
                    />
                    <Area
                      stackId="conf"
                      type="monotone"
                      dataKey="band"
                      stroke="none"
                      fill="transparent"
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      name="actual"
                      stroke="#94A3B8"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="base"
                      name="base"
                      stroke="#7C3AED"
                      strokeWidth={2.5}
                      dot={{ r: 2.5 }}
                      connectNulls
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-[#94A3B8]" /> Thực tế
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-[#7C3AED]" /> Dự báo
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 border-t-2 border-dashed border-[#E59A23]" /> Ngưỡng cảnh báo
                </span>
                <span className="ml-auto">
                  Ngưỡng = công suất lắp đặt {data.installedCapacityKw} kW × 16h × 30 ngày × 85%
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {data.scenarios.map((s) => {
                  const tone =
                    s.key === "low"
                      ? "border-success/30 bg-success/10 text-success"
                      : s.key === "base"
                        ? "border-gov/30 bg-gov/10 text-gov"
                        : "border-destructive/30 bg-destructive/10 text-destructive";
                  return (
                    <div key={s.key} className={cn("rounded-md border px-3 py-2", tone)}>
                      <p className="text-[11px] opacity-80">{s.label}</p>
                      <p className="mt-0.5 text-base font-semibold">
                        {fmt(s.value)} <span className="text-[11px] font-normal">kWh</span>
                      </p>
                      <p className="text-[10px] opacity-70">cuối kỳ {horizon}</p>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-md border border-gov/25 bg-gov/5 px-4 py-3">
                <p className="flex items-start gap-1.5 text-xs leading-5 text-navy">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-gov" />
                  <span>
                    <span className="font-semibold">Nhận định AI: </span>
                    {data.note}
                  </span>
                </p>
                <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
                  Phương pháp: {data.method}. Vùng mờ là khoảng tin cậy {data.confidencePct}%.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* ─────────── 2. Đề xuất vị trí trạm sạc mới ─────────── */}
        <section className="gov-card flex flex-col overflow-hidden">
          <header className="flex flex-wrap items-center gap-3 border-b border-border bg-grad-gov/60 px-4 py-3">
            <span className="flex size-9 items-center justify-center rounded-md bg-gov/10 text-gov">
              <MapPin className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
                  Đề xuất vị trí trạm sạc mới
                </h2>
                <Badge variant="outline" className="rounded-md border-gov/30 bg-gov/10 text-gov">
                  <Sparkles className="size-3" />
                  Gợi ý AI
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Dựa trên độ phủ nhu cầu, tăng trưởng & trạm quá tải của từng huyện. Chọn đề xuất để
                định vị trên bản đồ.
              </p>
            </div>
          </header>

          <div className="flex-1 space-y-2 p-3">
            {suggestionsQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            ) : proposals.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Chưa có đề xuất phù hợp.
              </p>
            ) : (
              proposals.map((p) => {
                const active = activeSuggestionId === p.id;
                return (
                  <article
                    key={p.id}
                    className={cn(
                      "rounded-md border border-border bg-surface p-3 transition-colors",
                      active && "border-gov ring-1 ring-gov/30",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-md",
                          p.kind === "new"
                            ? "border-gov/30 bg-gov/10 text-gov"
                            : "border-warning/40 bg-warning/15 text-warning",
                        )}
                      >
                        {p.kind === "new" ? "Trạm mới" : "Mở rộng"}
                      </Badge>
                      <span className="text-xs font-semibold text-navy">{p.title}</span>
                      <span className="ml-auto rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                        Điểm {p.score}/100
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {p.reasons.join(" · ")}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Công suất đề xuất {p.demandKw} kW · {p.district} · {p.createdAt}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setActiveSuggestionId(p.id);
                          onFocusExtra(`extra:${p.id}`);
                        }}
                      >
                        <MapPin />
                        Định vị trên bản đồ
                      </Button>
                      {p.workflowStatus === "DRAFT" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setProposalStatus(p.id, "PENDING")}
                        >
                          <Send />
                          Trình duyệt
                        </Button>
                      ) : null}
                      {p.workflowStatus === "PENDING" ? (
                        <>
                          <Button size="sm" onClick={() => setProposalStatus(p.id, "APPROVED")}>
                            <Check />
                            Duyệt
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setProposalStatus(p.id, "RETURNED")}
                          >
                            <Undo2 />
                            Trả về
                          </Button>
                        </>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setProposals((prev) => prev.filter((x) => x.id !== p.id));
                          toast.info(`Đã xóa đề xuất "${p.title}".`);
                        }}
                      >
                        <Trash2 />
                        Xoá
                      </Button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        {/* ─────────── 3. Công cụ phân tích vị trí ─────────── */}
        <LocationAnalysisTool stations={stations} onFocusStation={onFocusStation} />
      </div>

      <p className="flex items-start gap-1.5 text-[11px] leading-5 text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0 opacity-60" />
        Kết quả phân tích và dự báo chỉ hỗ trợ công tác chuyên môn, không thay thế việc kiểm tra số
        liệu và quyết định của cơ quan có thẩm quyền.
      </p>
    </div>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  return (
    <Badge variant="outline" className={cn("rounded-md font-medium", RISK_TONE[risk])}>
      <AlertTriangle className="size-3" />
      Rủi ro {risk}
    </Badge>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-navy">{value}</p>
    </div>
  );
}

// ─────────────────────────── Công cụ phân tích vị trí ───────────────────────────
type HistoryEntry = ChargingLocationAnalysis & { name: string };

function LocationAnalysisTool({
  stations,
  onFocusStation,
}: {
  stations: ChargingStation[];
  onFocusStation: (stationId: string) => void;
}) {
  const presets = useMemo(() => {
    const map = new Map<string, { lat: number; lng: number; count: number }>();
    for (const s of stations) {
      if (!s.latitude || !s.longitude) continue;
      const cur = map.get(s.district) ?? { lat: 0, lng: 0, count: 0 };
      map.set(s.district, {
        lat: (cur.lat * cur.count + s.latitude) / (cur.count + 1),
        lng: (cur.lng * cur.count + s.longitude) / (cur.count + 1),
        count: cur.count + 1,
      });
    }
    return Array.from(map.entries()).map(([district, v]) => ({
      district,
      lat: v.lat,
      lng: v.lng,
    }));
  }, [stations]);

  const [name, setName] = useState("Trạm sạc mới");
  const [demandKw, setDemandKw] = useState("120");
  const [lat, setLat] = useState(String(presets[0]?.lat ?? 11.31));
  const [lng, setLng] = useState(String(presets[0]?.lng ?? 106.1));
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [active, setActive] = useState<HistoryEntry | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const demand = Number(demandKw);
  const latNum = Number(lat);
  const lngNum = Number(lng);
  const valid =
    Number.isFinite(demand) && demand > 0 && Number.isFinite(latNum) && Number.isFinite(lngNum);

  const analysisQuery = useQuery({
    queryKey: ["energy", "charging-location", latNum, lngNum, demand],
    queryFn: () => getChargingLocationAnalysis(latNum, lngNum, demand),
    enabled: submitted && valid,
  });

  const handleSearch = () => {
    if (!valid) return;
    setSubmitted(true);
  };

  const handleSave = (r: ChargingLocationAnalysis) => {
    const entry: HistoryEntry = { ...r, name };
    setActive(entry);
    setHistory((prev) => [entry, ...prev.filter((h) => h.name !== name)]);
  };

  return (
    <section className="gov-card flex flex-col overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-grad-gov/60 px-4 py-3">
        <span className="flex size-9 items-center justify-center rounded-md bg-teal/15 text-teal">
          <LocateFixed className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
            Phân tích vị trí trạm sạc mới
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Nhập công suất dự kiến &amp; tọa độ → đánh giá trạm gần nhất, dư địa cấp điện và độ phủ
            cổng trống.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Tên trạm dự kiến</label>
            <Input
              className="h-9 text-xs"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Trạm sạc KCN Trảng Bàng..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">
              Công suất dự kiến (kW)
            </label>
            <Input
              className="h-9 text-xs"
              type="number"
              min="0"
              step="10"
              value={demandKw}
              onChange={(e) => setDemandKw(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Vĩ độ</label>
              <Input
                className="h-9 text-xs"
                type="number"
                step="0.0001"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Kinh độ</label>
              <Input
                className="h-9 text-xs"
                type="number"
                step="0.0001"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
              />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Vị trí mẫu theo huyện
            </p>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.district}
                  type="button"
                  onClick={() => {
                    setLat(String(p.lat));
                    setLng(String(p.lng));
                  }}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    Math.abs(latNum - p.lat) < 0.0005 && Math.abs(lngNum - p.lng) < 0.0005
                      ? "border-gov bg-gov/10 text-gov"
                      : "border-border bg-surface text-muted-foreground hover:border-gov/50 hover:text-gov",
                  )}
                >
                  {p.district}
                </button>
              ))}
            </div>
          </div>

          <Button className="w-full" size="sm" onClick={handleSearch} disabled={!valid}>
            {valid ? <Search /> : <MapPin />}
            Phân tích vị trí
          </Button>

          {history.length ? (
            <div>
              <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <History className="size-3" />
                Lịch sử phân tích
              </p>
              <div className="max-h-44 space-y-1.5 overflow-y-auto">
                {history.map((h) => (
                  <button
                    key={`${h.name}-${h.lat}-${h.lng}`}
                    type="button"
                    onClick={() => setActive(h)}
                    className="flex w-full items-center justify-between rounded-md border border-border bg-surface px-3 py-1.5 text-left text-[11px] hover:border-gov/50"
                  >
                    <span className="min-w-0">
                      <span className="font-semibold text-navy">{h.name}</span>
                      <span className="ml-2 text-muted-foreground">{h.demandKw} kW</span>
                    </span>
                    <span className="ml-2 shrink-0 text-gov">
                      {h.nearStation ? h.nearStation.name : "Không có trạm"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div>
          {!submitted ? (
            <div className="grid h-full min-h-64 place-items-center rounded-lg border border-dashed border-border text-center">
              <div className="max-w-xs space-y-2 px-4">
                <LocateFixed className="mx-auto size-8 text-muted-foreground" />
                <p className="text-sm font-semibold text-navy">Chưa có kết quả phân tích</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  Nhập thông tin (hoặc chọn vị trí mẫu) và nhấn <b>Phân tích vị trí</b>. Dữ liệu
                  tính trên {stations.length} trạm sạc hiện có.
                </p>
              </div>
            </div>
          ) : analysisQuery.isLoading ? (
            <div className="grid h-full min-h-64 place-items-center text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Đang tính khoảng cách &amp; dư địa cấp điện...
              </span>
            </div>
          ) : analysisQuery.data ? (
            <LocationResult
              result={analysisQuery.data}
              onSave={handleSave}
              onFocusStation={onFocusStation}
            />
          ) : (
            <div className="grid h-full min-h-64 place-items-center text-sm text-destructive">
              Không có kết quả. Vui lòng kiểm tra lại thông tin.
            </div>
          )}
        </div>
      </div>

      {active ? (
        <div className="border-t border-border bg-surface px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-navy">
              <b>{active.name}</b> ({active.demandKw} kW) →{" "}
              <b className="text-gov">{active.nearStation?.name ?? "Không tìm thấy trạm"}</b>
            </p>
            {active.nearStation ? (
              <p className="text-[11px] text-muted-foreground">
                {active.distanceKm} km · dư địa {active.spareKw} kW
              </p>
            ) : null}
          </div>
          <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
            {active.recommendation}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function LocationResult({
  result,
  onSave,
  onFocusStation,
}: {
  result: ChargingLocationAnalysis;
  onSave: (r: ChargingLocationAnalysis) => void;
  onFocusStation: (stationId: string) => void;
}) {
  if (!result.nearStation || result.distanceKm === null) {
    return (
      <div className="grid h-full min-h-64 place-items-center rounded-lg border border-dashed border-border text-center">
        <div className="max-w-xs space-y-2 px-4">
          <MapPin className="mx-auto size-8 text-muted-foreground" />
          <p className="text-sm font-semibold text-navy">Không tìm thấy trạm sạc vận hành</p>
          <p className="text-xs leading-5 text-muted-foreground">{result.recommendation}</p>
        </div>
      </div>
    );
  }

  const station = result.nearStation;
  const tone = result.canSupply
    ? "border-success/30 bg-success/10 text-success"
    : "border-warning/40 bg-warning/15 text-warning";

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-navy">Trạm gần nhất: {station.name}</p>
          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", tone)}>
            {result.canSupply ? "Đủ dư địa cấp điện" : "Cần đầu tư bổ sung"}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <ResultChip label="Khoảng cách" value={`${result.distanceKm} km`} />
          <ResultChip label="Dư địa trạm" value={`${result.spareKw} kW`} />
          <ResultChip label="Độ phủ cổng trống" value={`${result.coveragePct}%`} />
        </div>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
          {station.code} · {station.district} · công suất {station.powerKw} kW · {station.freePorts}{" "}
          cổng trống
        </p>
      </div>

      <p className="rounded-md border border-gov/25 bg-gov/5 px-3 py-2 text-xs leading-relaxed text-navy">
        {result.recommendation}
      </p>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => onFocusStation(station.id)}
        >
          <MapPin />
          Xem trên bản đồ
        </Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={() => onSave(result)}>
          <History />
          Lưu lịch sử
        </Button>
      </div>
    </div>
  );
}

function ResultChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background px-2 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xs font-bold tabular-nums text-navy">{value}</p>
    </div>
  );
}
