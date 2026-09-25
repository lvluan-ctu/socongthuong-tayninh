import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@/lib/router-compat";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  FileDown,
  FileSpreadsheet,
  FileText,
  FileUp,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
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
import { PageHeader } from "@/components/common/PageHeader";
import { ChartCard } from "@/components/common/ChartCard";
import { StatCard } from "@/components/common/StatCard";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ThinkingDots } from "@/components/common/ThinkingDots";
import { MiniBarChart, MiniDonutChart } from "@/components/dashboard/MiniCharts";
import { NhiemVuTracker, TongHopDashboard } from "@/components/analytics/TongHopNganh";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  REPORT_COLUMNS,
  SAMPLE_CSV_CONTENT,
  SAMPLE_WORD_HTML,
  SAMPLE_XNK_DATASET,
  SAMPLE_XNK_ROWS,
} from "@/data/report-mock";
import {
  SCT_IIP_MONTHLY,
  SCT_STATISTICAL_DATASETS,
  SCT_TMDV_MONTHLY,
  SCT_TMDV_TONGMUC_DATASET,
} from "@/data/statistical-sct-2026";
import {
  SCT_CHITIEU_DATASETS,
} from "@/data/chi-tieu-nganh";
import {
  answerQuestion,
  buildChartData,
  computeKpis,
  datasetToCsv,
  datasetToHtml,
  exportReport,
  extractFromFile,
  formatDateTime,
  formatNumber,
  formatPercent,
  readReportDatasets,
  summarizeDataset,
  writeReportDatasets,
  type ExtractStep,
} from "@/lib/report-service";
import { usePersistentState } from "@/lib/persist";
import type { ReportAnswer, ReportColumn, ReportDataset, ReportRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analytics")({
  validateSearch: (search: Record<string, unknown>): { ds?: string } => {
    const ds = search["ds"];
    return typeof ds === "string" ? { ds } : {};
  },
  head: () => ({
    meta: [
      { title: "Báo cáo & BI | Nền tảng ngành Công Thương" },
      {
        name: "description",
        content:
          "Tiếp nhận báo cáo từ Word/Excel/PDF, trích xuất và chuẩn hóa bảng dữ liệu, lưu vào CSDL ngành, tạo biểu đồ Dashboard và xuất lại báo cáo.",
      },
      { property: "og:title", content: "Báo cáo & BI" },
      {
        property: "og:description",
        content:
          "Pipeline tiếp nhận → trích xuất → chuẩn hóa → phê duyệt → CSDL → biểu đồ/Dashboard/xuất báo cáo.",
      },
    ],
  }),
  component: Page,
});

const GOV = "oklch(0.513 0.16 255.7)";
const TEAL = "oklch(0.566 0.101 182.5)";
const SUCCESS = "oklch(0.523 0.135 144.2)";
const WARNING = "oklch(0.743 0.15 72.1)";
const DESTRUCTIVE = "oklch(0.539 0.194 26.7)";
const MUTED = "oklch(0.554 0.041 257.4)";
const BORDER = "oklch(0.918 0.017 250.8)";
const AXIS_TICK = { fontSize: 10, fill: MUTED } as const;
const GRID = { strokeDasharray: "3 3", stroke: BORDER, vertical: false } as const;
const PIE_COLORS = [GOV, TEAL, SUCCESS, WARNING, DESTRUCTIVE, MUTED];

const YEARS = [2026, 2025, 2024];
const QUARTERS = ["6T", "9T", "Q1", "Q2", "Q3", "Q4", "Cả năm"];
const ACCEPT = ".csv,.txt,.xlsx,.xls,.docx,.doc,.pdf";

function parseNum(v: string | number): number {
  if (typeof v === "number") return Math.round(v * 100) / 100;
  const s = String(v ?? "")
    .trim()
    .replace(/[%\s]/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

function normalizeCell(type: ReportColumn["type"], v: string | number): string | number {
  if (type === "text") return String(v ?? "").trim();
  const n = parseNum(v);
  return Number.isFinite(n) ? n : String(v ?? "").trim();
}

function firstTextKey(ds: ReportDataset): string {
  return ds.columns.find((c) => c.type === "text")?.key ?? ds.columns[0]!.key;
}

function measureLabels(ds: ReportDataset): { prev?: string; current: string } {
  const nums = ds.columns.filter((c) => c.type === "number");
  return {
    ...(nums.length >= 2 ? { prev: nums[0]!.header } : {}),
    current: nums[nums.length - 1]?.header ?? ds.columns[0]!.header,
  };
}

function rowNum(row: ReportRow, key?: string): number {
  if (!key) return 0;
  const v = parseNum(row.cells[key] ?? "");
  return Number.isFinite(v) ? v : 0;
}

function downloadSample(kind: "csv" | "word") {
  const blob =
    kind === "csv"
      ? new Blob(["\uFEFF" + SAMPLE_CSV_CONTENT], { type: "text/csv;charset=utf-8" })
      : new Blob(["\uFEFF" + SAMPLE_WORD_HTML], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    kind === "csv"
      ? "bao-cao-xnk-theo-quoc-gia-dau-tu-6t2026.csv"
      : "bao-cao-xnk-theo-quoc-gia-dau-tu-6t2026.doc";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function SimpleTable({ dataset, highlight }: { dataset: ReportDataset; highlight?: string }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-surface-strong text-muted-foreground">
          <tr>
            {dataset.columns.map((c) => (
              <th key={c.key} className="whitespace-nowrap px-3 py-2 font-medium">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface/50">
          {dataset.rows.map((r) => (
            <tr key={r.id}>
              {dataset.columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    "whitespace-nowrap px-3 py-2",
                    c.type === "text" ? "font-medium text-navy" : "text-right tabular-nums",
                  )}
                >
                  {c.key === highlight
                    ? formatPercent(rowNum(r, c.key))
                    : String(r.cells[c.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditableTable({
  columns,
  rows,
  onChangeColumns,
  onChangeRows,
}: {
  columns: ReportColumn[];
  rows: ReportRow[];
  onChangeColumns: (c: ReportColumn[]) => void;
  onChangeRows: (r: ReportRow[]) => void;
}) {
  const updateCell = (rowId: string, key: string, value: string) => {
    onChangeRows(
      rows.map((r) => (r.id === rowId ? { ...r, cells: { ...r.cells, [key]: value } } : r)),
    );
  };
  const updateHeader = (key: string, header: string) => {
    onChangeColumns(columns.map((c) => (c.key === key ? { ...c, header } : c)));
  };
  const updateType = (key: string, type: ReportColumn["type"]) => {
    onChangeColumns(columns.map((c) => (c.key === key ? { ...c, type } : c)));
  };
  const addRow = () => {
    const id = `R-${Date.now()}`;
    const cells: Record<string, string> = {};
    columns.forEach((c) => (cells[c.key] = ""));
    onChangeRows([...rows, { id, cells }]);
  };
  const removeRow = (id: string) => onChangeRows(rows.filter((r) => r.id !== id));

  return (
    <div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-strong">
            <tr>
              <th className="w-8 px-2 py-2" />
              {columns.map((c) => (
                <th key={c.key} className="px-2 py-2">
                  <div className="flex flex-col gap-1">
                    <Input
                      value={c.header}
                      onChange={(e) => updateHeader(c.key, e.target.value)}
                      className="h-7 min-w-24 bg-background text-xs font-medium text-navy"
                    />
                    <Select
                      value={c.type}
                      onValueChange={(v) => updateType(c.key, v as ReportColumn["type"])}
                    >
                      <SelectTrigger className="h-6 min-w-24 bg-background text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Văn bản</SelectItem>
                        <SelectItem value="number">Số liệu</SelectItem>
                        <SelectItem value="percent">Phần trăm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </th>
              ))}
              <th className="w-8 px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface/50">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-2 py-1.5 text-center text-muted-foreground">
                  {String(rows.indexOf(r) + 1).padStart(2, "0")}
                </td>
                {columns.map((c) => (
                  <td key={c.key} className="px-1 py-1">
                    <input
                      value={String(r.cells[c.key] ?? "")}
                      onChange={(e) => updateCell(r.id, c.key, e.target.value)}
                      className={cn(
                        "h-8 w-full min-w-24 rounded border border-transparent bg-transparent px-2 text-sm outline-none hover:border-border focus:border-gov focus:bg-background",
                        c.type === "text" ? "font-medium" : "text-right tabular-nums",
                      )}
                    />
                  </td>
                ))}
                <td className="px-2 py-1 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(r.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Xóa dòng"
                  >
                    <X className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 2}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  Chưa có dữ liệu. Upload file hoặc tải dữ liệu mẫu.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Button variant="outline" size="sm" className="mt-2 gap-1 text-xs" onClick={addRow}>
        <Plus className="size-3.5" /> Thêm dòng
      </Button>
    </div>
  );
}

function RankList({ data }: { data: { name: string; growth: number }[] }) {
  const max = Math.max(...data.map((d) => Math.abs(d.growth)), 1);
  return (
    <ul className="space-y-1.5">
      {data.slice(0, 10).map((r, i) => (
        <li key={r.name} className="flex items-center gap-2 text-sm">
          <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {i + 1}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium text-navy">{r.name}</span>
          <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-surface-strong sm:block">
            <span
              className={cn(
                "block h-full rounded-full",
                r.growth >= 0 ? "bg-success" : "bg-destructive",
              )}
              style={{ width: `${Math.min((Math.abs(r.growth) / max) * 100, 100)}%` }}
            />
          </span>
          <span
            className={cn(
              "w-16 shrink-0 text-right text-xs font-semibold tabular-nums",
              r.growth >= 0 ? "text-success" : "text-destructive",
            )}
          >
            {formatPercent(r.growth)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ComparisonCard({ datasets }: { datasets: ReportDataset[] }) {
  const approved = datasets.filter((d) => d.status !== "draft");
  const [aId, setAId] = useState<string>(approved[0]?.id ?? "");
  const [bId, setBId] = useState<string>(approved[1]?.id ?? approved[0]?.id ?? "");

  // Đồng bộ lại khi datasets load async từ localStorage (tránh stale aId/bId)
  useEffect(() => {
    if (!approved.some((d) => d.id === aId)) setAId(approved[0]?.id ?? "");
    if (!approved.some((d) => d.id === bId)) setBId(approved[1]?.id ?? approved[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasets]);

  const a = approved.find((d) => d.id === aId);
  const b = approved.find((d) => d.id === bId);

  const rows = useMemo(() => {
    if (!a || !b) return [];
    const dimA = firstTextKey(a);
    const dimB = firstTextKey(b);
    const numsA = a.columns.filter((c) => c.type === "number");
    const numsB = b.columns.filter((c) => c.type === "number");
    const curA = numsA[numsA.length - 1]?.key ?? dimA;
    const curB = numsB[numsB.length - 1]?.key ?? dimB;
    return a.rows
      .map((ra) => {
        const name = String(ra.cells[dimA] ?? "");
        const rb = b.rows.find(
          (x) => String(x.cells[dimB] ?? "").toLowerCase() === name.toLowerCase(),
        );
        const av = rowNum(ra, curA);
        const bv = rb ? rowNum(rb, curB) : 0;
        return { name, a: av, b: bv, growth: av ? ((bv - av) / av) * 100 : 0 };
      })
      .filter((r) => r.name)
      .sort((x, y) => y.b - x.b);
  }, [a, b]);

  if (!a || !b || approved.length < 2) {
    return (
      <ChartCard
        title="So sánh giữa các kỳ"
        subtitle="Chọn 2 báo cáo cùng cấu trúc để so sánh, lọc theo quốc gia và đánh giá biến động"
      >
        <p className="py-8 text-center text-sm text-muted-foreground">
          Cần ít nhất 2 báo cáo (đã phê duyệt) để so sánh giữa các kỳ.
        </p>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="So sánh giữa các kỳ"
      subtitle="Chọn kỳ gốc và kỳ hiện tại — hệ thống ghép theo quốc gia và tính chênh lệch %"
      actions={
        <div className="flex items-center gap-2">
          <Select value={aId} onValueChange={setAId}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {approved.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.period}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ArrowUp className="size-3.5 text-muted-foreground" />
          <Select value={bId} onValueChange={setBId}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {approved.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.period}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      <div className="mb-3 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows.slice(0, 10)} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="name" tick={AXIS_TICK} interval={0} />
            <YAxis tick={AXIS_TICK} />
            <Tooltip cursor={{ fill: "oklch(0.955 0.011 252)" }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="a" name={a.period} fill={MUTED} radius={[3, 3, 0, 0]} />
            <Bar dataKey="b" name={b.period} fill={GOV} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-strong text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Quốc gia</th>
              <th className="px-3 py-2 text-right font-medium">{a.period}</th>
              <th className="px-3 py-2 text-right font-medium">{b.period}</th>
              <th className="px-3 py-2 text-right font-medium">Chênh lệch</th>
              <th className="px-3 py-2 text-right font-medium">Tăng/giảm (%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface/50">
            {rows.slice(0, 12).map((r) => (
              <tr key={r.name}>
                <td className="px-3 py-2 font-medium text-navy">{r.name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.a)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.b)}</td>
                <td
                  className={cn(
                    "px-3 py-2 text-right tabular-nums",
                    r.b - r.a >= 0 ? "text-success" : "text-destructive",
                  )}
                >
                  {r.b - r.a >= 0 ? "+" : ""}
                  {formatNumber(r.b - r.a)}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right font-medium tabular-nums",
                    r.growth >= 0 ? "text-success" : "text-destructive",
                  )}
                >
                  {formatPercent(r.growth)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

function ReportAssistant({ dataset }: { dataset: ReportDataset }) {
  const [chats, setChats] = useState<{ q: string; a: ReportAnswer | null }[]>([]);
  const [q, setQ] = useState("");
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [chats, thinking]);

  const ask = () => {
    const text = q.trim();
    if (!text || thinking) return;
    setChats((prev) => [...prev, { q: text, a: null }]);
    setQ("");
    setThinking(true);
    setTimeout(
      () => {
        setChats((prev) =>
          prev.map((c) => (c.a === null ? { ...c, a: answerQuestion(dataset, text) } : c)),
        );
        setThinking(false);
      },
      1500 + Math.random() * 1500,
    );
  };
  return (
    <ChartCard
      title="Trợ lý báo cáo (AI)"
      subtitle="Đặt câu hỏi về dữ liệu đã chuẩn hóa: lọc quốc gia, so sánh kỳ, xếp hạng tăng/giảm"
      actions={
        <Badge
          variant="outline"
          className="gap-1 rounded-md border-teal/30 bg-teal/10 font-medium text-teal"
        >
          <BrainCircuit className="size-3" /> Tự động tính từ dữ liệu
        </Badge>
      }
    >
      <div
        ref={listRef}
        className="flex max-h-64 min-h-40 flex-col gap-2.5 overflow-y-auto rounded-md border border-border bg-surface/50 p-3"
      >
        {chats.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Thử hỏi: “quốc gia tăng mạnh nhất?”, “xếp hạng theo mức tăng”, “so sánh 2025 và 2026”…
          </p>
        ) : (
          chats.map((c, i) => (
            <div key={i} className="space-y-1.5">
              <p className="justify-self-end rounded-xl rounded-br-sm bg-gov px-3 py-1.5 text-xs text-white">
                {c.q}
              </p>
              {c.a ? (
                <div className="rounded-xl rounded-bl-sm border border-border bg-card px-3 py-2 text-xs leading-relaxed">
                  <p className="whitespace-pre-line">{c.a.text}</p>
                  {c.a.rows?.length ? (
                    <ul className="mt-2 space-y-1 border-t border-border pt-2">
                      {c.a.rows.map((r) => (
                        <li key={r.label} className="flex items-center justify-between gap-3">
                          <span className="min-w-0 flex-1 truncate text-muted-foreground">
                            {r.label}
                          </span>
                          <span
                            className={cn(
                              "font-medium tabular-nums",
                              r.tone === "up"
                                ? "text-success"
                                : r.tone === "down"
                                  ? "text-destructive"
                                  : "",
                            )}
                          >
                            {r.value}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl rounded-bl-sm border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                  <ThinkingDots />
                  AI đang suy nghĩ...
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="Đặt câu hỏi về báo cáo này..."
          className="h-9 flex-1"
          disabled={thinking}
        />
        <Button
          size="sm"
          className="h-9 gap-1 bg-gov text-white hover:bg-gov/90"
          onClick={ask}
          disabled={thinking || !q.trim()}
        >
          <Send className="size-3.5" /> Hỏi
        </Button>
      </div>
    </ChartCard>
  );
}

const DEFAULT_DATASETS: ReportDataset[] = [
  SAMPLE_XNK_DATASET,
  ...SCT_STATISTICAL_DATASETS,
  ...SCT_CHITIEU_DATASETS,
];

const SCT_SEED_DATASETS: ReportDataset[] = [...SCT_STATISTICAL_DATASETS, ...SCT_CHITIEU_DATASETS];

// --- Thống kê SCT theo từng tháng (đọc JSON đã parse từ 16 file Excel gốc) ---
type SctMonthType = "tongmuc" | "banle" | "iip" | "spcn";

const SCT_MONTH_TYPES: { value: SctMonthType; label: string }[] = [
  { value: "tongmuc", label: "Tổng mức bán lẻ & dịch vụ" },
  { value: "banle", label: "Bán lẻ theo nhóm hàng" },
  { value: "iip", label: "Chỉ số công nghiệp (IIP)" },
  { value: "spcn", label: "Sản phẩm công nghiệp chủ yếu" },
];

interface SctTmdvRow {
  chitieu: string;
  uoc_thang: number | null;
  pct_thang: number | null;
  v2025_thang: number | null;
}
interface SctIipRow {
  nganh: string;
  c1: number | null;
  c2: number | null;
  c3: number | null;
  c4: number | null;
}
interface SctSpcnRow {
  sanpham: string;
  dvt: string;
  uoc_thang: number | null;
  pct_thang: number | null;
  v2025_thang: number | null;
}
interface SctMonthBlock<R> {
  month: number;
  file: string;
  sheet: string;
  header?: { c1: string; c2: string; c3: string; c4: string };
  rows: R[];
}
interface SctParsedFiles {
  tongmuc: SctMonthBlock<SctTmdvRow>[];
  banle: SctMonthBlock<SctTmdvRow>[];
  iip: SctMonthBlock<SctIipRow>[];
  spcn: SctMonthBlock<SctSpcnRow>[];
}

function sctNum(n: number | null): number {
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function SctMonthlyExplorer({ onSave }: { onSave: (ds: ReportDataset) => void }) {
  const [month, setMonth] = useState(8);
  const [mtype, setMtype] = useState<SctMonthType>("tongmuc");
  const [files, setFiles] = useState<SctParsedFiles | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [tongmuc, banle, iip, spcn] = await Promise.all(
          ["tmdv_tongmuc.json", "tmdv_banle.json", "iip_monthly.json", "spcn_monthly.json"].map(
            (f) => fetch(`/SoLieuThongKe/parsed/${f}`).then((r) => r.json()),
          ),
        );
        if (live) setFiles({ tongmuc, banle, iip, spcn } as SctParsedFiles);
      } catch {
        if (live) setLoadError(true);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const view = useMemo(() => {
    if (!files) return null;
    const tag = `T${month}`;
    if (mtype === "iip") {
      const block = files.iip.find((b) => b.month === month);
      if (!block) return null;
      const h = block.header ?? { c1: "Cột 1", c2: "Cột 2", c3: "Cột 3", c4: "Lũy kế" };
      const columns: ReportColumn[] = [
        { key: "dim", header: "Ngành công nghiệp", type: "text" },
        { key: "c1", header: h.c1, type: "number" },
        { key: "c2", header: h.c2, type: "number" },
        { key: "c3", header: h.c3, type: "number" },
        { key: "c4", header: h.c4, type: "number" },
        { key: "growth", header: "Tăng/giảm vs cùng kỳ (%)", type: "percent" },
      ];
      const rows: ReportRow[] = block.rows.map((r, i) => ({
        id: `R-${String(i + 1).padStart(2, "0")}`,
        cells: {
          dim: r.nganh,
          c1: sctNum(r.c1),
          c2: sctNum(r.c2),
          c3: sctNum(r.c3),
          c4: sctNum(r.c4),
          growth: sctNum(r.c3 === null ? null : r.c3 - 100),
        },
      }));
      const rank = block.rows
        .filter((r) => r.nganh && r.c3 !== null)
        .map((r) => ({ name: r.nganh, growth: sctNum(r.c3! - 100) }))
        .sort((a, b) => b.growth - a.growth);
      const dataset: ReportDataset = {
        id: `SCT-T${month}-IIP-26`,
        name: `Chỉ số sản xuất công nghiệp (IIP) tháng ${month}/2026`,
        fileName: block.file,
        fileType: "XLSX",
        period: `Tháng ${month}/2026 (so cùng kỳ 2025)`,
        year: 2026,
        source: "Sở Công Thương – Số liệu thống kê T1-T8/2026",
        columns,
        rows,
        status: "approved",
        extractedAt: formatDateTime(),
        savedAt: formatDateTime(),
        via: "sample",
        summary: `IIP ${block.rows.find((r) => /toàn ngành/i.test(r.nganh))?.nganh ?? "toàn ngành"} tháng ${month}/2026.`,
      };
      return { dataset, rank, chart: null as null, file: block.file, sheet: block.sheet, tag };
    }
    const blocks =
      mtype === "tongmuc" ? files.tongmuc : mtype === "banle" ? files.banle : files.spcn;
    const block = blocks.find((b) => b.month === month);
    if (!block) return null;
    const isSpcn = mtype === "spcn";
    const columns: ReportColumn[] = isSpcn
      ? [
          { key: "dim", header: "Sản phẩm", type: "text" },
          { key: "dvt", header: "ĐVT", type: "text" },
          { key: "v2025", header: `T${month}/2025`, type: "number" },
          { key: "v2026", header: `T${month}/2026`, type: "number" },
          { key: "growth", header: "Tăng/giảm (%)", type: "percent" },
        ]
      : [
          { key: "dim", header: mtype === "banle" ? "Nhóm hàng" : "Chỉ tiêu", type: "text" },
          { key: "v2025", header: `T${month}/2025 (triệu đồng)`, type: "number" },
          { key: "v2026", header: `T${month}/2026 (triệu đồng)`, type: "number" },
          { key: "growth", header: "Tăng/giảm (%)", type: "percent" },
        ];
    const rows: ReportRow[] = block.rows.map((r, i) => {
      const name = isSpcn ? (r as SctSpcnRow).sanpham : (r as SctTmdvRow).chitieu;
      const cells: Record<string, string | number> = {
        dim: name,
        v2025: sctNum(r.v2025_thang),
        v2026: sctNum(r.uoc_thang),
        growth: sctNum(r.pct_thang === null ? null : r.pct_thang - 100),
      };
      if (isSpcn) cells.dvt = (r as SctSpcnRow).dvt || "—";
      return { id: `R-${String(i + 1).padStart(2, "0")}`, cells };
    });
    const typeLabel = SCT_MONTH_TYPES.find((t) => t.value === mtype)?.label ?? mtype;
    const dataset: ReportDataset = {
      id: `SCT-T${month}-${mtype.toUpperCase()}-26`,
      name: `${typeLabel} tháng ${month}/2026 so cùng kỳ 2025`,
      fileName: block.file,
      fileType: "XLSX",
      period: `Tháng ${month}/2026 (so cùng kỳ 2025)`,
      year: 2026,
      source: "Sở Công Thương – Số liệu thống kê T1-T8/2026",
      columns,
      rows,
      status: "approved",
      extractedAt: formatDateTime(),
      savedAt: formatDateTime(),
      via: "sample",
    };
    const chart = [...rows]
      .sort((a, b) => Number(b.cells.v2026) - Number(a.cells.v2026))
      .slice(0, rows.length > 10 ? 8 : rows.length)
      .map((r) => ({
        name: String(r.cells.dim).slice(0, 22),
        a: Number(r.cells.v2025),
        b: Number(r.cells.v2026),
      }));
    return { dataset, rank: null as null, chart, file: block.file, sheet: block.sheet, tag };
  }, [files, month, mtype]);

  return (
    <ChartCard
      title="Chi tiết từng tháng"
      subtitle="Lọc tháng T1–T8 và loại số liệu — chi tiết từng dòng như file Excel gốc"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((m) => (
              <Button
                key={m}
                variant={month === m ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-7 px-2.5 text-xs",
                  month === m && "bg-gov text-white hover:bg-gov/90",
                )}
                onClick={() => setMonth(m)}
              >
                T{m}
              </Button>
            ))}
          </div>
          <Select value={mtype} onValueChange={(v) => setMtype(v as SctMonthType)}>
            <SelectTrigger className="h-8 w-56 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCT_MONTH_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      {!files && !loadError ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Đang tải số liệu chi tiết…</p>
      ) : null}
      {loadError || (files && !view) ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {mtype === "banle" && month === 1
            ? "Tháng 1 không có chi tiết bán lẻ theo nhóm hàng (file Excel gốc không có sheet này)."
            : "Không tải được số liệu chi tiết. Hãy chắc chắn thư mục public/SoLieuThongKe/parsed tồn tại."}
        </p>
      ) : null}
      {view ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Nguồn: <span className="font-medium text-navy">{view.file}</span> · sheet{" "}
              <span className="font-medium text-navy">{view.sheet}</span> · cột 2025 back-calculate
              từ % cùng kỳ (demo cân đối)
            </p>
            <Button
              size="sm"
              className="gap-1 bg-gov text-xs text-white hover:bg-gov/90"
              onClick={() => onSave(view.dataset)}
            >
              <CheckCircle2 className="size-3.5" /> Lưu vào kho & xem dashboard
            </Button>
          </div>
          {view.chart ? (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={view.chart} margin={{ top: 4, right: 4, left: 8, bottom: 0 }}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="name" tick={AXIS_TICK} interval={0} />
                  <YAxis tick={AXIS_TICK} />
                  <Tooltip
                    cursor={{ fill: "oklch(0.955 0.011 252)" }}
                    formatter={(value) => [`${formatNumber(Number(value) || 0)}`, ""]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="a" name={`${view.tag}/2025`} fill={MUTED} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="b" name={`${view.tag}/2026`} fill={GOV} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}
          {view.rank ? (
            <ChartCard title="Xếp hạng tăng/giảm vs cùng kỳ" subtitle="Toàn bộ ngành công nghiệp">
              <RankList data={view.rank} />
            </ChartCard>
          ) : null}
          <div className="max-h-[480px] overflow-auto">
            <SimpleTable dataset={view.dataset} highlight="growth" />
          </div>
        </div>
      ) : null}
    </ChartCard>
  );
}

function Page() {
  const { ds } = Route.useSearch();
  const [datasets, setDatasets, resetDatasets] = usePersistentState<ReportDataset[]>(
    "report.datasets",
    DEFAULT_DATASETS,
  );
  // Gộp các bộ số liệu thống kê SCT T1-T8/2026 cho kho đã lưu từ phiên bản cũ.
  useEffect(() => {
    const missing = SCT_SEED_DATASETS.filter((s) => !datasets.some((d) => d.id === s.id));
    if (missing.length) {
      const next = [...datasets, ...missing];
      setDatasets(next);
      writeReportDatasets(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [activeTab, setActiveTab] = useState("warehouse");
  const [selectedId, setSelectedId] = useState<string | null>(SAMPLE_XNK_DATASET.id);
  const [deleteTarget, setDeleteTarget] = useState<ReportDataset | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (ds && datasets.some((d) => d.id === ds)) {
      setSelectedId(ds);
      setActiveTab("dashboard");
    }
  }, [ds, datasets]);

  // Editor (tab Tiếp nhận)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState<ReportDataset["fileType"]>("CSV");
  const [meta, setMeta] = useState({
    name: "",
    period: "6 tháng đầu 2026",
    year: 2026,
    quarter: "6T",
    source: "",
  });
  const [cols, setCols] = useState<ReportColumn[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractStep, setExtractStep] = useState<ExtractStep | null>(null);

  const drafts = useMemo(() => datasets.filter((d) => d.status === "draft"), [datasets]);
  const selected = datasets.find((d) => d.id === selectedId) ?? null;

  useEffect(() => {
    if (activeTab === "intake") setDatasets(readReportDatasets());
  }, [activeTab, setDatasets]);

  const handleFile = async (file: File) => {
    setExtracting(true);
    setExtractStep({ step: "Bắt đầu", pct: 5 });
    try {
      const extracted = await extractFromFile(file, setExtractStep);
      setEditingId(null);
      setFileName(file.name);
      setFileType(extracted.fileType as ReportDataset["fileType"]);
      setCols(extracted.columns.map((c) => ({ ...c })));
      setRows(extracted.rows.map((r) => ({ ...r, cells: { ...r.cells } })));
      setMeta((m) => ({ ...m, name: extracted.name, source: m.source || "Phòng QLTM" }));
      toast.success(
        `Đã trích xuất ${extracted.rows.length} dòng · ${extracted.columns.length} cột.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không trích xuất được file.");
    } finally {
      setExtracting(false);
      setExtractStep(null);
    }
  };

  const loadSample = () => {
    setEditingId(null);
    setFileName("bao-cao-xnk-theo-quoc-gia-dau-tu-6t2026.csv");
    setFileType("MẪU");
    setCols(REPORT_COLUMNS.map((c) => ({ ...c })));
    setRows(SAMPLE_XNK_ROWS.map((r) => ({ ...r, cells: { ...r.cells } })));
    setMeta({
      name: SAMPLE_XNK_DATASET.name,
      period: "6 tháng đầu 2026",
      year: 2026,
      quarter: "6T",
      source: "Phòng QLTM",
    });
    toast.info("Đã nạp dữ liệu mẫu vào bảng kiểm tra.");
  };

  const loadDraft = (d: ReportDataset) => {
    setEditingId(d.id);
    setFileName(d.fileName);
    setFileType(d.fileType);
    setCols(d.columns.map((c) => ({ ...c })));
    setRows(d.rows.map((r) => ({ ...r, cells: { ...r.cells } })));
    setMeta({
      name: d.name,
      period: d.period,
      year: d.year,
      quarter: d.quarter ?? "6T",
      source: d.source,
    });
    toast.info(`Đã nạp báo cáo nháp "${d.name}" để kiểm tra.`);
  };

  const saveReport = () => {
    if (!meta.name.trim()) {
      toast.error("Vui lòng nhập tên báo cáo.");
      return;
    }
    if (!rows.length) {
      toast.error("Bảng dữ liệu đang trống.");
      return;
    }
    const normCols = cols.map((c, i) => ({ ...c, key: c.key || `col${i}` }));
    const normRows = rows.map((r) => ({
      id: r.id,
      cells: Object.fromEntries(
        normCols.map((c) => [c.key, normalizeCell(c.type, r.cells[c.key] ?? "")]),
      ),
    }));
    const existing = editingId ? datasets.find((d) => d.id === editingId) : undefined;
    const now = formatDateTime();
    const ds: ReportDataset = {
      id: editingId ?? `BC-${Date.now()}`,
      name: meta.name.trim(),
      fileName: fileName || "du-lieu-nhap.csv",
      fileType,
      period: meta.period.trim() || `Năm ${meta.year}`,
      year: meta.year,
      source: meta.source.trim() || "Chưa xác định",
      columns: normCols,
      rows: normRows,
      status: "approved",
      extractedAt: existing?.extractedAt ?? now,
      savedAt: now,
      via: existing?.via ?? "upload",
      ...(meta.quarter ? { quarter: meta.quarter } : {}),
      summary:
        existing?.summary ??
        summarizeDataset({
          id: "tmp",
          name: meta.name.trim(),
          fileName: fileName || "du-lieu-nhap.csv",
          fileType,
          period: meta.period.trim() || `Năm ${meta.year}`,
          year: meta.year,
          source: meta.source.trim() || "Chưa xác định",
          columns: normCols,
          rows: normRows,
          status: "approved",
          extractedAt: now,
          savedAt: now,
          via: existing?.via ?? "upload",
        }),
    };
    const next = editingId ? datasets.map((d) => (d.id === editingId ? ds : d)) : [ds, ...datasets];
    setDatasets(next);
    writeReportDatasets(next);
    setSelectedId(ds.id);
    setActiveTab("dashboard");
    toast.success(`Đã lưu báo cáo "${ds.name}" vào CSDL ngành (đã phê duyệt).`);
  };

  const saveSctDataset = (ds: ReportDataset) => {
    const next = datasets.some((d) => d.id === ds.id)
      ? datasets.map((d) => (d.id === ds.id ? ds : d))
      : [ds, ...datasets];
    setDatasets(next);
    writeReportDatasets(next);
    setSelectedId(ds.id);
    setActiveTab("dashboard");
    toast.success(`Đã lưu "${ds.name}" vào kho báo cáo.`);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const next = datasets.filter((d) => d.id !== deleteTarget.id);
    setDatasets(next);
    writeReportDatasets(next);
    toast.success(`Đã xóa báo cáo "${deleteTarget.name}".`);
    setDeleteTarget(null);
  };

  const resetAll = () => {
    resetDatasets();
    writeReportDatasets(DEFAULT_DATASETS);
    toast.info("Đã khôi phục kho báo cáo về mặc định.");
  };

  const warehouseColumns: Column<ReportDataset>[] = [
    {
      key: "name",
      header: "Báo cáo",
      value: (d) => d.name,
      render: (d) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-navy">{d.name}</p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <FileText className="size-3" />
            {d.fileName} · {d.columns.length} cột · {d.rows.length} dòng
          </p>
        </div>
      ),
    },
    { key: "period", header: "Kỳ", sortable: true, value: (d) => d.period },
    { key: "source", header: "Đơn vị", sortable: true, value: (d) => d.source },
    {
      key: "savedAt",
      header: "Lưu lúc",
      sortable: true,
      className: "whitespace-nowrap",
      value: (d) => d.savedAt,
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (d) => <StatusBadge status={d.status} />,
    },
    {
      key: "actions",
      header: "Thao tác",
      className: "w-44",
      render: (d) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2 text-xs text-gov hover:bg-gov/5"
            onClick={() => {
              setSelectedId(d.id);
              setActiveTab("dashboard");
            }}
          >
            <BarChart3 className="size-3.5" /> Xem
          </Button>
          {d.status === "draft" ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-2 text-xs text-warning hover:bg-warning/5"
              onClick={() => {
                loadDraft(d);
                setActiveTab("intake");
              }}
            >
              <Pencil className="size-3.5" /> Kiểm tra
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2 text-xs text-destructive hover:bg-destructive/5"
            onClick={() => setDeleteTarget(d)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Báo cáo & BI"
        description="Tiếp nhận báo cáo từ Word/Excel/PDF → trích xuất & chuẩn hóa bảng → kiểm tra/phê duyệt → lưu CSDL ngành → biểu đồ, Dashboard và xuất lại báo cáo."
        crumbs={[{ label: "Báo cáo" }, { label: "Báo cáo & BI" }]}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                downloadSample("csv");
                toast.success("Đã tải file mẫu CSV — thử upload lại để xem pipeline trích xuất.");
              }}
            >
              <FileSpreadsheet className="size-4" /> File mẫu CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                downloadSample("word");
                toast.success(
                  "Đã tải file mẫu Word (.doc) — thử upload lại để xem pipeline trích xuất.",
                );
              }}
            >
              <FileText className="size-4" /> File mẫu Word
            </Button>
            <Button onClick={() => setActiveTab("intake")}>
              <FileUp className="size-4" /> Tiếp nhận báo cáo
            </Button>
          </>
        }
      />

      <div className="space-y-5 p-4 sm:p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="warehouse">Kho báo cáo</TabsTrigger>
              <TabsTrigger value="intake">Tiếp nhận báo cáo</TabsTrigger>
              <TabsTrigger value="dashboard">Dashboard & BI</TabsTrigger>
              <TabsTrigger value="sct">Thống kê SCT</TabsTrigger>
              <TabsTrigger value="tong-hop">Tổng hợp ngành</TabsTrigger>
              <TabsTrigger value="export">Xuất báo cáo</TabsTrigger>
            </TabsList>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={resetAll}
            >
              <RotateCcw className="size-3.5" /> Khôi phục mặc định
            </Button>
          </div>

          {/* ---------------- KHO BÁO CÁO ---------------- */}
          <TabsContent value="warehouse" className="mt-4 space-y-4">
            {drafts.length ? (
              <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-warning">
                <FileUp className="size-4 shrink-0" />
                <span>
                  Có <strong>{drafts.length}</strong> báo cáo nháp chờ kiểm tra (từ ChatBot) — hãy
                  kiểm tra, chỉnh sửa và xác nhận.
                </span>
                <Button
                  size="sm"
                  className="ml-auto bg-warning text-white hover:bg-warning/90"
                  onClick={() => setActiveTab("intake")}
                >
                  Xử lý nháp
                </Button>
              </div>
            ) : null}
            <ComparisonCard datasets={datasets} />
            <DataTable
              columns={warehouseColumns}
              rows={datasets}
              searchPlaceholder="Tìm báo cáo theo tên, kỳ, đơn vị..."
            />
          </TabsContent>

          {/* ---------------- TIẾP NHẬN BÁO CÁO ---------------- */}
          <TabsContent value="intake" className="mt-4">
            {drafts.length ? (
              <div className="mb-4 rounded-md border border-border bg-card p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Bản nháp từ ChatBot
                </p>
                <div className="flex flex-wrap gap-2">
                  {drafts.slice(0, 5).map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs"
                    >
                      <span className="max-w-56 truncate font-medium text-navy">{d.name}</span>
                      <span className="text-muted-foreground">
                        {d.rows.length} dòng · {d.fileName}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => loadDraft(d)}
                      >
                        Nạp
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-5">
              <ChartCard
                title="Tải file báo cáo"
                subtitle="Word (.doc/.docx) · Excel (.xls/.xlsx) · PDF · CSV"
                className="lg:col-span-2"
              >
                <div
                  onClick={() => !extracting && fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleFile(f);
                  }}
                  className="grid cursor-pointer place-items-center rounded-lg border-2 border-dashed border-border bg-surface p-8 text-center transition-colors hover:border-gov/60 hover:bg-gov/5"
                >
                  <UploadCloud className="size-10 text-gov" strokeWidth={1.5} />
                  <p className="mt-3 text-sm font-medium text-navy">
                    Kéo thả file hoặc bấm để chọn
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Hệ thống tự đọc, trích xuất bảng và chuẩn hóa cấu trúc
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPT}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                      e.target.value = "";
                    }}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={loadSample}
                  >
                    <CheckCircle2 className="size-3.5" /> Dùng dữ liệu mẫu
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => downloadSample("csv")}
                  >
                    <FileSpreadsheet className="size-3.5" /> Tải mẫu CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => downloadSample("word")}
                  >
                    <FileText className="size-3.5" /> Tải mẫu Word
                  </Button>
                </div>

                {extracting ? (
                  <div className="mt-3 rounded-md border border-border bg-surface p-3">
                    {extractStep ? (
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 font-medium text-navy">
                          <Loader2 className="size-3.5 animate-spin text-gov" />
                          {extractStep.step}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {extractStep.pct}%
                        </span>
                      </div>
                    ) : null}
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-strong">
                      <div
                        className="h-full rounded-full bg-gov transition-all"
                        style={{ width: `${extractStep?.pct ?? 0}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
                  CSV và Excel (.xls/.xlsx, kể cả file thống kê SCT) được đọc thật; DOCX/PDF mô
                  phỏng trích xuất bảng theo mẫu báo cáo XNK. Pipeline: Đọc file → Trích xuất bảng →
                  Chuẩn hóa → Kiểm tra → CSDL ngành.
                </p>
              </ChartCard>

              <ChartCard
                title="Bảng dữ liệu chuẩn hóa"
                subtitle="Kiểm tra, chỉnh sửa ô, đổi tên cột, thêm/xóa dòng trước khi xác nhận"
                className="lg:col-span-3"
                actions={
                  cols.length ? (
                    <Badge
                      variant="outline"
                      className="rounded-md border-gov/25 bg-gov/5 font-medium text-gov"
                    >
                      {cols.length} cột · {rows.length} dòng
                    </Badge>
                  ) : null
                }
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="r-name">Tên báo cáo *</Label>
                    <Input
                      id="r-name"
                      value={meta.name}
                      onChange={(e) => setMeta((m) => ({ ...m, name: e.target.value }))}
                      placeholder="VD: Trị giá XNK theo Quốc gia đầu tư 6T/2026"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label>Kỳ (quý)</Label>
                      <Select
                        value={meta.quarter}
                        onValueChange={(v) => setMeta((m) => ({ ...m, quarter: v }))}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {QUARTERS.map((q) => (
                            <SelectItem key={q} value={q}>
                              {q}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Năm</Label>
                      <Select
                        value={String(meta.year)}
                        onValueChange={(v) => setMeta((m) => ({ ...m, year: Number(v) }))}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {YEARS.map((y) => (
                            <SelectItem key={y} value={String(y)}>
                              {y}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="r-period">Kỳ hiển thị</Label>
                    <Input
                      id="r-period"
                      value={meta.period}
                      onChange={(e) => setMeta((m) => ({ ...m, period: e.target.value }))}
                      placeholder="VD: 6 tháng đầu 2026"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="r-source">Đơn vị cung cấp</Label>
                    <Input
                      id="r-source"
                      value={meta.source}
                      onChange={(e) => setMeta((m) => ({ ...m, source: e.target.value }))}
                      placeholder="VD: Phòng QLTM"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  {cols.length ? (
                    <EditableTable
                      columns={cols}
                      rows={rows}
                      onChangeColumns={setCols}
                      onChangeRows={setRows}
                    />
                  ) : (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      Upload file hoặc nạp dữ liệu mẫu để bắt đầu chuẩn hóa.
                    </p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
                  {editingId ? (
                    <span className="text-xs text-muted-foreground">
                      Đang chỉnh sửa báo cáo nháp — lưu sẽ chuyển sang trạng thái Đã phê duyệt.
                    </span>
                  ) : null}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      setCols([]);
                      setRows([]);
                      setMeta({
                        name: "",
                        period: "6 tháng đầu 2026",
                        year: 2026,
                        quarter: "6T",
                        source: "",
                      });
                    }}
                  >
                    Hủy
                  </Button>
                  <Button
                    className="bg-gov text-white hover:bg-gov/90"
                    onClick={saveReport}
                    disabled={!cols.length || !rows.length}
                  >
                    <CheckCircle2 className="size-4" /> Xác nhận & lưu vào CSDL
                  </Button>
                </div>
              </ChartCard>
            </div>
          </TabsContent>

          {/* ---------------- DASHBOARD & BI ---------------- */}
          <TabsContent value="dashboard" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="gap-1 rounded-md border-gov/25 bg-gov/5 font-medium text-gov"
              >
                <BarChart3 className="size-3" /> Báo cáo đang xem
              </Badge>
              <Select value={selectedId ?? ""} onValueChange={setSelectedId}>
                <SelectTrigger className="h-8 w-full max-w-md bg-card">
                  <SelectValue placeholder="Chọn báo cáo" />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} · {d.period}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selected ? (
              <DashboardView dataset={selected} />
            ) : (
              <div className="gov-card p-10 text-center text-sm text-muted-foreground">
                Chưa có báo cáo. Hãy tiếp nhận báo cáo hoặc dùng dữ liệu mẫu.
              </div>
            )}
          </TabsContent>

          {/* ---------------- THỐNG KÊ SCT T1-T8/2026 ---------------- */}
          <TabsContent value="sct" className="mt-4 space-y-4">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Tổng mức T8/2026"
                value="20.150 tỷ đồng"
                icon={BarChart3}
                tone="gov"
              />
              <StatCard label="Tăng so cùng kỳ T8" value="+20,2%" icon={ArrowUp} tone="success" />
              <StatCard
                label="Lũy kế 8 tháng"
                value="153.938 tỷ đồng"
                icon={FileText}
                tone="teal"
              />
              <StatCard
                label="IIP lũy kế 8 tháng"
                value="+15,0%"
                icon={BrainCircuit}
                tone="analytics"
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <ChartCard
                title="Tổng mức bán lẻ T1-T8/2026 so cùng kỳ 2025"
                subtitle="Triệu đồng · cột 2025 back-calculate từ % cùng kỳ (demo cân đối)"
              >
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={SCT_TMDV_MONTHLY}
                      margin={{ top: 4, right: 4, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid {...GRID} />
                      <XAxis dataKey="month" tick={AXIS_TICK} />
                      <YAxis
                        tick={AXIS_TICK}
                        tickFormatter={(v: number) => `${Math.round(v / 1e6)}tr`}
                      />
                      <Tooltip
                        cursor={{ fill: "oklch(0.955 0.011 252)" }}
                        formatter={(value) => [`${formatNumber(Number(value) || 0)} tr.đ`, ""]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="v2025" name="Cùng kỳ 2025" fill={MUTED} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="v2026" name="Năm 2026" fill={GOV} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard
                title="Chỉ số sản xuất công nghiệp toàn ngành"
                subtitle="IIP tháng so cùng kỳ và lũy kế (% so cùng kỳ)"
              >
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={SCT_IIP_MONTHLY}
                      margin={{ top: 4, right: 4, left: -18, bottom: 0 }}
                    >
                      <CartesianGrid {...GRID} />
                      <XAxis dataKey="month" tick={AXIS_TICK} />
                      <YAxis tick={AXIS_TICK} domain={[90, 130]} />
                      <Tooltip cursor={{ stroke: BORDER }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line
                        type="monotone"
                        dataKey="index"
                        name="IIP tháng"
                        stroke={GOV}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="luyke"
                        name="Lũy kế"
                        stroke={TEAL}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </section>

            <SctMonthlyExplorer onSave={saveSctDataset} />

            <ChartCard
              title="Số liệu theo tháng"
              subtitle="Tổng mức bán lẻ (triệu đồng) và IIP toàn ngành (%) — nguồn: 16 file Excel SCT T1-T8/2026"
            >
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-strong text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Tháng</th>
                      <th className="px-3 py-2 text-right font-medium">Tổng mức 2025</th>
                      <th className="px-3 py-2 text-right font-medium">Tổng mức 2026</th>
                      <th className="px-3 py-2 text-right font-medium">Tăng/giảm</th>
                      <th className="px-3 py-2 text-right font-medium">IIP tháng</th>
                      <th className="px-3 py-2 text-right font-medium">IIP lũy kế</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-surface/50">
                    {SCT_TMDV_MONTHLY.map((r, i) => (
                      <tr key={r.month}>
                        <td className="px-3 py-2 font-medium text-navy">{r.month}/2026</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatNumber(r.v2025)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatNumber(r.v2026)}
                        </td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums text-success">
                          {formatPercent(r.growth)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatNumber(SCT_IIP_MONTHLY[i]?.index ?? 0, 1)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatNumber(SCT_IIP_MONTHLY[i]?.luyke ?? 0, 1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                Cột 2025 là giá trị demo back-calculate từ % so cùng kỳ trong file gốc để đối sánh
                cân đối; số 2026 là số thực từ file. Chi tiết từng bộ số liệu đã nạp sẵn trong kho:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SCT_STATISTICAL_DATASETS.map((d) => (
                  <Button
                    key={d.id}
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => {
                      setSelectedId(d.id);
                      setActiveTab("dashboard");
                    }}
                  >
                    <BarChart3 className="size-3.5" /> {d.name}
                  </Button>
                ))}
              </div>
            </ChartCard>

            <ChartCard
              title="Tổng mức theo nhóm (T8/2026)"
              subtitle="Nhấn vào bộ số liệu để xem dashboard đầy đủ"
            >
              <SimpleTable dataset={SCT_TMDV_TONGMUC_DATASET} highlight="growth" />
            </ChartCard>
          </TabsContent>

          {/* ---------------- TỔNG HỢP NGÀNH CÔNG THƯƠNG ---------------- */}
          <TabsContent value="tong-hop" className="mt-4 space-y-4">
            <TongHopDashboard
              onViewDataset={(id) => {
                setSelectedId(id);
                setActiveTab("dashboard");
              }}
            />
            <NhiemVuTracker />
          </TabsContent>

          {/* ---------------- XUẤT BÁO CÁO ---------------- */}
          <TabsContent value="export" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="gap-1 rounded-md border-gov/25 bg-gov/5 font-medium text-gov"
              >
                <FileDown className="size-3" /> Xuất báo cáo
              </Badge>
              <Select value={selectedId ?? ""} onValueChange={setSelectedId}>
                <SelectTrigger className="h-8 w-full max-w-md bg-card">
                  <SelectValue placeholder="Chọn báo cáo" />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} · {d.period}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selected ? (
              <div className="grid gap-4 lg:grid-cols-5">
                <ChartCard
                  title="Định dạng xuất"
                  subtitle="Tạo lại báo cáo từ dữ liệu đã chuẩn hóa"
                  className="lg:col-span-2"
                >
                  <p className="text-xs leading-5 text-muted-foreground">
                    Hệ thống tự sinh lại báo cáo từ dữ liệu đã lưu trong CSDL ngành (bảng chuẩn hóa
                    + tóm tắt AI). Chọn định dạng để tải về:
                  </p>
                  <div className="mt-4 space-y-2">
                    <Button
                      className="w-full justify-start"
                      onClick={() => exportReport(selected, "csv")}
                    >
                      <FileSpreadsheet className="size-4" /> Xuất CSV (.csv)
                    </Button>
                    <Button
                      className="w-full justify-start"
                      onClick={() => exportReport(selected, "xls")}
                    >
                      <FileSpreadsheet className="size-4" /> Xuất Excel (.xls)
                    </Button>
                    <Button
                      className="w-full justify-start"
                      onClick={() => exportReport(selected, "doc")}
                    >
                      <FileText className="size-4" /> Xuất Word (.doc)
                    </Button>
                    <Button
                      className="w-full justify-start"
                      onClick={() => exportReport(selected, "pdf")}
                    >
                      <FileDown className="size-4" /> Xuất PDF (in ấn)
                    </Button>
                  </div>
                  <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
                    CSV/Excel/Word tải ngay tại trình duyệt. PDF mở bản in để chọn "Save as PDF".
                  </p>
                </ChartCard>

                <ChartCard
                  title="Xem trước báo cáo"
                  subtitle={`${selected.name} · ${selected.period}`}
                  className="lg:col-span-3"
                >
                  <div className="rounded-md border border-border bg-surface/50 p-4">
                    <p className="text-center text-sm font-semibold uppercase tracking-wide text-navy">
                      Sở Công Thương tỉnh Tây Ninh
                    </p>
                    <h3 className="mt-1 text-center text-sm font-medium text-navy">
                      {selected.name}
                    </h3>
                    <p className="mt-0.5 text-center text-[11px] text-muted-foreground">
                      Kỳ: {selected.period} · Đơn vị: {selected.source} · Lưu lúc {selected.savedAt}
                    </p>
                    <p className="mt-3 whitespace-pre-line rounded-md border border-border bg-card px-3 py-2 text-xs leading-relaxed">
                      {selected.summary ?? summarizeDataset(selected)}
                    </p>
                    <div className="mt-3">
                      <SimpleTable dataset={selected} />
                    </div>
                  </div>
                </ChartCard>
              </div>
            ) : (
              <div className="gov-card p-10 text-center text-sm text-muted-foreground">
                Chưa có báo cáo để xuất.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa báo cáo?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn sắp xóa "{deleteTarget?.name}" ({deleteTarget?.period}) khỏi CSDL ngành. Thao tác
              này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Dùng trong saveReport để tạo summary trước khi có object dataset.

function DashboardView({ dataset }: { dataset: ReportDataset }) {
  const kpis = useMemo(() => computeKpis(dataset), [dataset]);
  const charts = useMemo(() => buildChartData(dataset), [dataset]);
  const labels = useMemo(() => measureLabels(dataset), [dataset]);

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label={labels.current}
          value={`${formatNumber(kpis.totalCurrent)}`}
          icon={BarChart3}
          tone="gov"
        />
        <StatCard
          label="Tăng/giảm so kỳ trước"
          value={formatPercent(kpis.growth)}
          icon={kpis.growth >= 0 ? ArrowUp : ArrowDown}
          tone={kpis.growth >= 0 ? "success" : "danger"}
        />
        <StatCard label="Số đối tượng" value={kpis.count} icon={FileText} tone="teal" />
        <StatCard
          label="Quốc gia dẫn đầu"
          value={kpis.leader?.name ?? "—"}
          icon={CheckCircle2}
          tone="analytics"
        />
        <StatCard
          label="Tăng trưởng dương"
          value={`${kpis.rising}/${kpis.count}`}
          icon={BrainCircuit}
          tone="success"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={labels.current} subtitle="Top 10 đối tượng theo trị giá kỳ hiện tại">
          <MiniBarChart data={charts.bar.slice(0, 10)} fill={GOV} height={230} />
        </ChartCard>

        <ChartCard title="Cơ cấu theo đối tượng" subtitle="Tỷ trọng trong kỳ hiện tại">
          <MiniDonutChart data={charts.pie} colors={PIE_COLORS} height={230} />
        </ChartCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={labels.prev ? `So sánh ${labels.prev} và ${labels.current}` : "So sánh các kỳ"}
          subtitle="Biến động theo từng đối tượng (top 8)"
        >
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={charts.compare.slice(0, 8)}
                margin={{ top: 4, right: 4, left: -18, bottom: 0 }}
              >
                <CartesianGrid {...GRID} />
                <XAxis dataKey="name" tick={AXIS_TICK} interval={0} />
                <YAxis tick={AXIS_TICK} />
                <Tooltip cursor={{ fill: "oklch(0.955 0.011 252)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {labels.prev ? (
                  <Bar dataKey="a" name={labels.prev} fill={MUTED} radius={[3, 3, 0, 0]} />
                ) : null}
                <Bar dataKey="b" name={labels.current} fill={TEAL} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Xếp hạng tăng/giảm"
          subtitle="Sắp xếp theo biến động % — lọc nhanh đối tượng nổi bật"
        >
          <RankList data={charts.ranking} />
        </ChartCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Báo cáo tổng hợp (AI)"
          subtitle="Tự động tổng hợp từ dữ liệu chuẩn hóa"
          actions={
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => toast.success("Báo cáo tổng hợp đã được sinh mới.")}
            >
              <BrainCircuit className="size-3.5" /> Sinh lại
            </Button>
          }
        >
          <p className="whitespace-pre-line rounded-md border border-border bg-surface p-3 text-sm leading-relaxed">
            {dataset.summary ?? summarizeDataset(dataset)}
          </p>
        </ChartCard>

        <ReportAssistant dataset={dataset} />
      </section>
    </>
  );
}
