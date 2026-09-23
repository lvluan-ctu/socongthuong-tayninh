import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Factory,
  History,
  Loader2,
  LocateFixed,
  MapPin,
  Search,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getNearestSubstationAnalysis } from "@/lib/grid-service";
import type { GridSubstation, NearestSubstationResult } from "@/lib/grid-types";
import { cn } from "@/lib/utils";

const PRESETS: { label: string; lat: number; lng: number }[] = [
  { label: "KCN Thuận Đạo", lat: 10.655, lng: 106.481 },
  { label: "KCN Long Hậu", lat: 10.675, lng: 106.729 },
  { label: "KCN Tân Kim", lat: 10.679, lng: 106.696 },
  { label: "TP. Tân An", lat: 10.535, lng: 106.413 },
  { label: "Bến Lức", lat: 10.642, lng: 106.493 },
];

type HistoryEntry = NearestSubstationResult & { loadName: string };

export function NewLoadPointTool({ substations }: { substations: GridSubstation[] }) {
  const operatingSubs = substations.filter((s) => s.status !== "Quy hoạch");
  const [name, setName] = useState("Phụ tải mới");
  const [capacityMw, setCapacityMw] = useState("25");
  const [lat, setLat] = useState(String(PRESETS[0]?.lat ?? 0));
  const [lng, setLng] = useState(String(PRESETS[0]?.lng ?? 0));
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [active, setActive] = useState<HistoryEntry | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const cap = Number(capacityMw);
  const latNum = Number(lat);
  const lngNum = Number(lng);
  const valid =
    Number.isFinite(cap) && cap > 0 && Number.isFinite(latNum) && Number.isFinite(lngNum);

  const resultQuery = useQuery({
    queryKey: ["grid", "nearest-substation", cap, latNum, lngNum],
    queryFn: () => getNearestSubstationAnalysis(latNum, lngNum, cap),
    enabled: submitted && valid && operatingSubs.length > 0,
  });

  const handleSearch = () => {
    if (!valid) return;
    setSubmitted(true);
  };

  const handleSave = (r: NearestSubstationResult) => {
    const entry: HistoryEntry = { ...r, loadName: name };
    setActive(entry);
    setHistory((prev) => [entry, ...prev.filter((h) => h.loadName !== name)]);
  };

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setLat(String(p.lat));
    setLng(String(p.lng));
  };

  return (
    <section className="gov-card overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-grad-gov/60 px-4 py-3">
        <span className="flex size-9 items-center justify-center rounded-md bg-gov/10 text-gov">
          <Zap className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
            Phụ tải mới — trạm biến áp gần nhất
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Nhập công suất dự kiến &amp; tọa độ (kèm preset khu công nghiệp) → gợi ý điểm đấu nối
            tối ưu theo khoảng cách thực tế và công suất dự phòng của trạm
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
        {/* Form nhập */}
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Tên phụ tải</label>
            <Input
              className="h-9 text-xs"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Nhà máy chế biến..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">
              Công suất dự kiến (MW)
            </label>
            <Input
              className="h-9 text-xs"
              type="number"
              min="0"
              step="0.5"
              value={capacityMw}
              onChange={(e) => setCapacityMw(e.target.value)}
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
              Vị trí mẫu (preset)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    Math.abs(latNum - p.lat) < 0.0005 && Math.abs(lngNum - p.lng) < 0.0005
                      ? "border-gov bg-gov/10 text-gov"
                      : "border-border bg-surface text-muted-foreground hover:border-gov/50 hover:text-gov",
                  )}
                >
                  <Factory className="mr-1 inline size-3" />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <Button className="w-full" size="sm" onClick={handleSearch} disabled={!valid}>
            {valid ? <Search /> : <MapPin />}
            Tra cứu điểm đấu nối
          </Button>

          {history.length ? (
            <div>
              <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <History className="size-3" />
                Lịch sử tra cứu
              </p>
              <div className="max-h-44 space-y-1.5 overflow-y-auto">
                {history.map((h) => (
                  <button
                    key={`${h.loadName}-${h.lat}-${h.lng}`}
                    type="button"
                    onClick={() => setActive(h)}
                    className="flex w-full items-center justify-between rounded-md border border-border bg-surface px-3 py-1.5 text-left text-[11px] hover:border-gov/50"
                  >
                    <span className="min-w-0">
                      <span className="font-semibold text-navy">{h.loadName}</span>
                      <span className="ml-2 text-muted-foreground">{h.demandMw} MW</span>
                    </span>
                    <span className="ml-2 shrink-0 text-gov">
                      {h.substation ? h.substation.name : "Không có trạm"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Kết quả */}
        <div>
          {!submitted ? (
            <div className="grid h-full min-h-64 place-items-center rounded-lg border border-dashed border-border text-center">
              <div className="max-w-xs space-y-2 px-4">
                <LocateFixed className="mx-auto size-8 text-muted-foreground" />
                <p className="text-sm font-semibold text-navy">Chưa có kết quả tra cứu</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  Nhập thông tin phụ tải mới (hoặc chọn vị trí mẫu) và nhấn{" "}
                  <b>Tra cứu điểm đấu nối</b>. Dữ liệu tính theo {operatingSubs.length} trạm biến áp
                  đang vận hành.
                </p>
              </div>
            </div>
          ) : resultQuery.isLoading ? (
            <div className="grid h-full min-h-64 place-items-center text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Đang tính khoảng cách &amp; công suất dự phòng...
              </span>
            </div>
          ) : resultQuery.data ? (
            <ResultView result={resultQuery.data} onSave={handleSave} />
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
            <Badge className="bg-gov/10 text-gov">
              <Building2 className="size-3" />
              Kết quả mới nhất
            </Badge>
            <p className="text-xs text-navy">
              <b>{active.loadName}</b> ({active.demandMw} MW) →{" "}
              <b className="text-gov">{active.substation?.name ?? "Không tìm thấy trạm"}</b>
            </p>
            {active.substation ? (
              <p className="text-[11px] text-muted-foreground">
                {active.distanceKm} km · dự phòng {active.spareMw} MW
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

function ResultView({
  result,
  onSave,
}: {
  result: NearestSubstationResult;
  onSave: (r: NearestSubstationResult) => void;
}) {
  if (!result.substation || result.distanceKm === null) {
    return (
      <div className="grid h-full min-h-64 place-items-center rounded-lg border border-dashed border-border text-center">
        <div className="max-w-xs space-y-2 px-4">
          <MapPin className="mx-auto size-8 text-muted-foreground" />
          <p className="text-sm font-semibold text-navy">Không tìm thấy trạm vận hành</p>
          <p className="text-xs leading-5 text-muted-foreground">{result.recommendation}</p>
        </div>
      </div>
    );
  }

  const nearest = result.substation;
  const tone = result.canSupply
    ? "border-success/30 bg-success/10 text-success"
    : "border-warning/40 bg-warning/15 text-warning";
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-navy">
            Trạm gần nhất: {nearest.name} ({nearest.voltageLevel})
          </p>
          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", tone)}>
            {result.canSupply ? "Đủ điều kiện đấu nối" : "Cần đầu tư bổ sung"}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <ResultChip label="Khoảng cách" value={`${result.distanceKm} km`} />
          <ResultChip label="Dự phòng trạm" value={`${result.spareMw} MW`} />
          <ResultChip label="Phụ tải yêu cầu" value={`${result.demandMw} MW`} />
        </div>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
          Trạm {nearest.code} · huyện {nearest.district}
        </p>
      </div>

      <p className="rounded-md border border-gov/25 bg-gov/5 px-3 py-2 text-xs leading-relaxed text-navy">
        {result.recommendation}
      </p>

      <Button size="sm" variant="outline" className="w-full" onClick={() => onSave(result)}>
        <History />
        Lưu vào lịch sử tra cứu
      </Button>
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
