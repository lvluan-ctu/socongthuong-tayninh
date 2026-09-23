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

function Page() {
  const { ds } = Route.useSearch();
  const [datasets, setDatasets, resetDatasets] = usePersistentState<ReportDataset[]>(
    "report.datasets",
    [SAMPLE_XNK_DATASET],
  );
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
    writeReportDatasets([SAMPLE_XNK_DATASET]);
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
                  Demo: CSV được đọc thật; XLSX/DOCX/PDF mô phỏng trích xuất bảng theo mẫu báo cáo
                  XNK. Pipeline: Đọc file → Trích xuất bảng → Chuẩn hóa → Kiểm tra → CSDL ngành.
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
