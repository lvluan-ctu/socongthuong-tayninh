// ============================================================
// TỔNG HỢP NGÀNH CÔNG THƯƠNG — tab trong Báo cáo & BI.
// Nguồn: file Chỉ tiêu ngành + 16 file SoLieuThongKe đã parse.
// Nhiệm vụ: công chức hiệu chỉnh tay, lưu localStorage (sct.nhiemvu.overrides).
// Gantt: frappe-gantt (view Month/Year).
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import Gantt from "frappe-gantt";
import {
  ArrowUp,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  Factory,
  PlugZap,
  Ship,
  ShoppingCart,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/common/ChartCard";
import { StatCard } from "@/components/common/StatCard";
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
import {
  DIEN_HOGD_DATASET,
  NK_MONTHLY,
  TMBLHH_KH,
  TMBLHH_MONTHLY,
  XK_MONTHLY,
  XNK_KH,
} from "@/data/chi-tieu-nganh";
import { SCT_IIP_MONTHLY } from "@/data/statistical-sct-2026";
import { formatNumber, formatPercent } from "@/lib/report-service";
import { usePersistentState } from "@/lib/persist";
import { cn } from "@/lib/utils";

const GOV = "oklch(0.513 0.16 255.7)";
const TEAL = "oklch(0.566 0.101 182.5)";
const SUCCESS = "oklch(0.523 0.135 144.2)";
const WARNING = "oklch(0.743 0.15 72.1)";
const DESTRUCTIVE = "oklch(0.539 0.194 26.7)";
const MUTED = "oklch(0.554 0.041 257.4)";
const BORDER = "oklch(0.918 0.017 250.8)";
const AXIS_TICK = { fontSize: 10, fill: MUTED } as const;
const GRID = { strokeDasharray: "3 3", stroke: BORDER, vertical: false } as const;

const r2 = (n: number) => Math.round(n * 100) / 100;
const sum26 = (arr: { v2026: number }[]) => r2(arr.reduce((s, r) => s + r.v2026, 0));

// ---------------- Dashboard chỉ tiêu ----------------

export function TongHopDashboard({ onViewDataset }: { onViewDataset: (id: string) => void }) {
  const [hogd, setHogd] = usePersistentState<number>("chitieu.dien-hogd", 99.9);

  const tmTotal = useMemo(() => sum26(TMBLHH_MONTHLY), []);
  const xkTotal = useMemo(() => sum26(XK_MONTHLY), []);
  const nkTotal = useMemo(() => sum26(NK_MONTHLY), []);
  const iip8T = SCT_IIP_MONTHLY[SCT_IIP_MONTHLY.length - 1]?.luyke ?? 0;

  const xnkChart = useMemo(
    () =>
      XK_MONTHLY.map((r, i) => ({
        month: r.month,
        xk2026: r.v2026,
        nk2026: NK_MONTHLY[i]?.v2026 ?? 0,
        xk2025: r.v2025,
        nk2025: NK_MONTHLY[i]?.v2025 ?? 0,
      })),
    [],
  );

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="IIP lũy kế 8 tháng"
          value={formatPercent(iip8T - 100)}
          icon={Factory}
          tone="gov"
        />
        <StatCard
          label="Tổng mức 8T (tỷ đồng)"
          value={formatNumber(tmTotal, 0)}
          icon={ShoppingCart}
          tone="teal"
        />
        <StatCard
          label="Hoàn thành KH tổng mức"
          value={`${formatNumber((tmTotal / TMBLHH_KH.value) * 100, 1)}%`}
          icon={BarChart3}
          tone="analytics"
        />
        <StatCard
          label="XK 8T (tr.USD) · %KH"
          value={`${formatNumber(xkTotal, 1)} · ${formatNumber((xkTotal / XNK_KH.xk) * 100, 1)}%`}
          icon={Ship}
          tone="success"
        />
        <StatCard
          label="NK 8T (tr.USD) · %KH"
          value={`${formatNumber(nkTotal, 1)} · ${formatNumber((nkTotal / XNK_KH.nk) * 100, 1)}%`}
          icon={ArrowUp}
          tone="warning"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Tổng mức bán lẻ T1-T8/2026 so cùng kỳ"
          subtitle={`Tỷ đồng · KH 2026: ${formatNumber(TMBLHH_KH.value, 0)} tỷ (+${formatPercent(TMBLHH_KH.tocdo * 100)})`}
          actions={
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs text-gov"
              onClick={() => onViewDataset("SCT-TMBLHH-8T26")}
            >
              <BarChart3 className="size-3.5" /> Xem dataset
            </Button>
          }
        >
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={TMBLHH_MONTHLY} margin={{ top: 4, right: 4, left: 8, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="month" tick={AXIS_TICK} />
                <YAxis tick={AXIS_TICK} />
                <Tooltip
                  cursor={{ fill: "oklch(0.955 0.011 252)" }}
                  formatter={(value) => [`${formatNumber(Number(value) || 0)} tỷ`, ""]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="v2025" name="2025" fill={MUTED} radius={[3, 3, 0, 0]} />
                <Bar dataKey="v2026" name="2026" fill={GOV} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Xuất – nhập khẩu theo tháng"
          subtitle={`Triệu USD · KH 2026: XK ${formatNumber(XNK_KH.xk, 0)} / NK ${formatNumber(XNK_KH.nk, 0)}`}
          actions={
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs text-gov"
              onClick={() => onViewDataset("SCT-XK-8T26")}
            >
              <BarChart3 className="size-3.5" /> Xem dataset
            </Button>
          }
        >
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={xnkChart} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="month" tick={AXIS_TICK} />
                <YAxis tick={AXIS_TICK} />
                <Tooltip cursor={{ stroke: BORDER }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="xk2026"
                  name="XK 2026"
                  stroke={GOV}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="nk2026"
                  name="NK 2026"
                  stroke={TEAL}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="xk2025"
                  name="XK 2025"
                  stroke={MUTED}
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="nk2025"
                  name="NK 2025"
                  stroke={WARNING}
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </section>

      <ChartCard
        title="Tỷ lệ hộ dân sử dụng điện"
        subtitle="Sheet TLHDSD điện đang trống — số demo do công chức nhập tay, lưu trên trình duyệt"
        actions={
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs text-gov"
            onClick={() => onViewDataset(DIEN_HOGD_DATASET.id)}
          >
            <BarChart3 className="size-3.5" /> Xem dataset
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-teal/10 text-teal">
            <PlugZap className="size-5" />
          </span>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={hogd}
              onChange={(e) => setHogd(Number(e.target.value))}
              className="h-9 w-28 text-right tabular-nums"
            />
            <span className="text-sm font-semibold text-navy">%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Năm 2025: 99,97% (mục tiêu file Chỉ tiêu) · Demo 2026: {formatNumber(hogd, 2)}% — cập
            nhật số thật khi có, dataset trong kho sẽ dùng số mới khi lưu lại.
          </p>
        </div>
      </ChartCard>

      <p className="text-[11px] leading-5 text-muted-foreground">
        Nguồn: sheet TMBLHH/XNK của file Chỉ tiêu ngành. Số TMBLHH T1–T8/2026 tại đây (đơn vị tỷ
        đồng) lệch nhẹ với 16 file SoLieuThongKe (đơn vị triệu đồng) do hai lần chốt số khác nhau —
        lấy file Chỉ tiêu làm chuẩn theo dõi kế hoạch.
      </p>
    </div>
  );
}

// ---------------- Theo dõi nhiệm vụ trọng tâm ----------------

export type TaskStatus = "completed" | "in_progress" | "pending" | "recurring" | "blocked";

export const STATUS_META: Record<
  TaskStatus,
  { label: string; badge: string; progress: number; gantt: string }
> = {
  completed: {
    label: "Hoàn thành",
    badge: "border-success/30 bg-success/10 text-success",
    progress: 100,
    gantt: "bar-completed",
  },
  in_progress: {
    label: "Đang thực hiện",
    badge: "border-gov/30 bg-gov/10 text-gov",
    progress: 55,
    gantt: "bar-in_progress",
  },
  recurring: {
    label: "Thường xuyên",
    badge: "border-teal/30 bg-teal/10 text-teal",
    progress: 70,
    gantt: "bar-recurring",
  },
  blocked: {
    label: "Vướng mắc",
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
    progress: 10,
    gantt: "bar-blocked",
  },
  pending: {
    label: "Chưa rõ",
    badge: "border-warning/40 bg-warning/10 text-warning",
    progress: 0,
    gantt: "bar-pending",
  },
};

interface ParsedTask {
  stt: number;
  noidung: string;
  tiendo: string;
  vanban: string;
  deadline: { month: number; year: number; isQuarter: boolean; raw: string } | null;
  statusAuto: TaskStatus;
}
interface ParsedUnit {
  unit: string;
  tasks: ParsedTask[];
}
interface TaskOverride {
  status?: TaskStatus;
  tiendo?: string;
  vanban?: string;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const lastDayOf = (y: number, m: number) => new Date(y, m, 0).getDate();

export function deadlineLabel(t: ParsedTask): string {
  if (!t.deadline) return "Cả năm";
  return `${t.deadline.isQuarter ? "Q" : "T"}${t.deadline.month}/${t.deadline.year}`;
}

export const XTTM_UNIT_NAME = "Trung tâm Khuyến công và Xúc tiến Thương mại";

export interface NhiemVuRow extends ParsedTask {
  id: string;
  unit: string;
  status: TaskStatus;
}

// Nguồn duy nhất cho nhiệm vụ trọng tâm: JSON đã parse + override hiệu chỉnh tay
// (khóa sct.nhiemvu.overrides) — dùng chung giữa tab Tổng hợp ngành và trang XTTM.
export function useNhiemVuData() {
  const [units, setUnits] = useState<ParsedUnit[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [overrides, setOverrides] = usePersistentState<Record<string, TaskOverride>>(
    "nhiemvu.overrides",
    {},
  );

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch("/ChiTieuNganh/parsed/tasks_by_unit.json");
        const data = (await res.json()) as ParsedUnit[];
        if (live) setUnits(data);
      } catch {
        if (live) setLoadError(true);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const rows = useMemo(() => {
    if (!units) return [];
    const out: NhiemVuRow[] = [];
    units.forEach((u, ui) => {
      u.tasks.forEach((t) => {
        const ov = overrides[`${ui}-${t.stt}`];
        out.push({
          ...t,
          id: `${ui}-${t.stt}`,
          unit: u.unit,
          status: ov?.status ?? t.statusAuto,
          tiendo: ov?.tiendo ?? t.tiendo,
          vanban: ov?.vanban ?? t.vanban,
        });
      });
    });
    return out;
  }, [units, overrides]);

  const patch = (id: string, p: TaskOverride) =>
    setOverrides((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...p } }));

  return { units, loadError, rows, patch };
}

export function NhiemVuTracker() {
  const { units, loadError, rows: allRows, patch } = useNhiemVuData();
  const [unitFilter, setUnitFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [ganttMode, setGanttMode] = useState("Month");
  const ganttRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(
    () =>
      allRows.filter(
        (r) =>
          (unitFilter === "all" || r.unit === unitFilter) &&
          (statusFilter === "all" || r.status === statusFilter) &&
          (!query.trim() ||
            `${r.noidung} ${r.tiendo} ${r.vanban}`
              .toLowerCase()
              .includes(query.trim().toLowerCase())),
      ),
    [allRows, unitFilter, statusFilter, query],
  );

  const stats = useMemo(() => {
    const c: Record<TaskStatus, number> = {
      completed: 0,
      in_progress: 0,
      pending: 0,
      recurring: 0,
      blocked: 0,
    };
    rows.forEach((r) => {
      c[r.status] += 1;
    });
    return c;
  }, [rows]);

  const ganttTasks = useMemo(
    () =>
      rows.map((r) => {
        const meta = STATUS_META[r.status];
        const start = r.deadline
          ? `${r.deadline.year}-${pad2(Math.max(1, r.deadline.month - 1))}-01`
          : "2026-01-01";
        const end = r.deadline
          ? `${r.deadline.year}-${pad2(r.deadline.month)}-${pad2(lastDayOf(r.deadline.year, r.deadline.month))}`
          : "2026-12-31";
        return {
          id: r.id,
          name: `${r.unit.split(" ").slice(-2).join(" ")}: ${r.noidung.slice(0, 64)}`,
          start,
          end,
          progress: meta.progress,
          custom_class: meta.gantt,
        };
      }),
    [rows],
  );

  useEffect(() => {
    const el = ganttRef.current;
    if (!el) return;
    el.innerHTML = "";
    if (!ganttTasks.length) return;
    const gantt = new Gantt(el, ganttTasks, { view_mode: ganttMode, bar_height: 20, padding: 18 });
    return () => {
      gantt.refresh([]);
      el.innerHTML = "";
    };
  }, [ganttTasks, ganttMode]);

  if (!units && !loadError) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Đang tải nhiệm vụ…</p>;
  }
  if (loadError || !units) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Không tải được nhiệm vụ. Hãy chắc chắn đã chạy{" "}
        <code>node scripts/parse-chi-tieu-nganh.mjs</code>.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap gap-2">
        {(Object.keys(STATUS_META) as TaskStatus[]).map((s) => (
          <Badge
            key={s}
            variant="outline"
            className={cn("gap-1 rounded-md font-medium", STATUS_META[s].badge)}
          >
            {STATUS_META[s].label}: {stats[s]}
          </Badge>
        ))}
        <Badge variant="outline" className="gap-1 rounded-md border-border font-medium text-navy">
          Tổng: {rows.length}
        </Badge>
      </section>

      <ChartCard
        title="Sơ đồ Gantt 2026"
        subtitle="Thanh theo hạn hoàn thành (suy từ text) · Thường xuyên = cả năm · màu theo trạng thái"
        actions={
          <div className="flex gap-1">
            {["Month", "Year"].map((m) => (
              <Button
                key={m}
                variant={ganttMode === m ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-7 px-2.5 text-xs",
                  ganttMode === m && "bg-gov text-white hover:bg-gov/90",
                )}
                onClick={() => setGanttMode(m)}
              >
                {m === "Month" ? "Tháng" : "Năm"}
              </Button>
            ))}
          </div>
        }
      >
        {ganttTasks.length ? (
          <div className="overflow-x-auto rounded-md border border-border bg-card">
            <div ref={ganttRef} className="min-w-[720px] p-2" />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Không có nhiệm vụ theo bộ lọc.
          </p>
        )}
      </ChartCard>

      <ChartCard
        title="Danh sách nhiệm vụ"
        subtitle="Trạng thái auto từ text — công chức hiệu chỉnh tay, tự lưu trên trình duyệt"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm nội dung, tiến độ, văn bản…"
              className="h-8 w-56 text-xs"
            />
            <Select value={unitFilter} onValueChange={setUnitFilter}>
              <SelectTrigger className="h-8 w-56 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả đơn vị</SelectItem>
                {units.map((u) => (
                  <SelectItem key={u.unit} value={u.unit}>
                    {u.unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Mọi trạng thái</SelectItem>
                {(Object.keys(STATUS_META) as TaskStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_META[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      >
        <div className="max-h-[560px] overflow-auto rounded-md border border-border">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface-strong text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Đơn vị</th>
                <th className="px-3 py-2 font-medium">Nội dung</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Hạn</th>
                <th className="px-3 py-2 font-medium">Trạng thái</th>
                <th className="px-3 py-2 font-medium">Văn bản giao (2.3)</th>
                <th className="px-3 py-2 font-medium">Tiến độ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface/50">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="max-w-36 px-3 py-2 font-medium text-navy">{r.unit}</td>
                  <td className="min-w-64 px-3 py-2" title={r.noidung}>
                    {r.noidung.length > 140 ? `${r.noidung.slice(0, 140)}…` : r.noidung}
                  </td>
                  <td
                    className="whitespace-nowrap px-3 py-2 tabular-nums"
                    title={r.deadline?.raw ?? ""}
                  >
                    {deadlineLabel(r)}
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={r.status}
                      onValueChange={(v) => patch(r.id, { status: v as TaskStatus })}
                    >
                      <SelectTrigger
                        className={cn("h-7 w-36 text-[11px]", STATUS_META[r.status].badge)}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_META) as TaskStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_META[s].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={r.vanban}
                      onChange={(e) => patch(r.id, { vanban: e.target.value })}
                      placeholder="Số hiệu VB…"
                      className="h-7 min-w-32 text-[11px]"
                    />
                  </td>
                  <td className="min-w-56 px-3 py-2">
                    <Input
                      value={r.tiendo}
                      onChange={(e) => patch(r.id, { tiendo: e.target.value })}
                      className="h-7 text-[11px]"
                      title={r.tiendo}
                    />
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    Không có nhiệm vụ theo bộ lọc.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <CheckCircle2 className="size-3.5 text-success" />
          Mọi hiệu chỉnh tự lưu trên trình duyệt (khóa sct.nhiemvu.overrides).
          <CalendarRange className="ml-2 size-3.5" /> Hạn suy từ text “hoàn thành trong tháng/quý…”
          — kiểm lại với văn bản gốc trước khi báo cáo.
        </p>
      </ChartCard>
    </div>
  );
}
