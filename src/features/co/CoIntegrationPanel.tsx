import { useState, useCallback, useRef } from "react";
import {
  BarChart3,
  Database,
  ExternalLink,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  RotateCcw,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChartCard } from "@/components/common/ChartCard";
import { getImportBatches } from "@/lib/co/co-service";
import { parseCoFile, type CoParseResult, type CoParsedRow, type CoParseError } from "@/lib/co/co-parser";
import type { CoImportBatch } from "@/lib/co/co-types";

const SOURCE_META: Record<string, { label: string; url: string; desc: string }> = {
  ECOSYS: {
    label: "eCoSys",
    url: "https://ecosys.gov.vn",
    desc: "Hệ thống quản lý C/O điện tử — Bộ Công Thương",
  },
  CO_MOIT: {
    label: "co.moit.gov.vn",
    url: "https://co.moit.gov.vn",
    desc: "Cổng thông tin C/O — Bộ Công Thương",
  },
};

export function CoIntegrationPanel() {
  const [batches] = useState<CoImportBatch[]>(getImportBatches);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<CoParseResult | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setParsing(true);
    setResult(null);
    try {
      const r = await parseCoFile(file);
      setResult(r);
    } catch (err) {
      setResult({
        fileName: file.name,
        totalRows: 0,
        accepted: [],
        rejected: [{ row: 0, column: "file", message: String(err) }],
        headers: [],
      });
    } finally {
      setParsing(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }, [handleFile]);

  const resetResult = useCallback(() => {
    setResult(null);
  }, []);

  return (
    <div className="space-y-4">
      {/* Pipeline diagram */}
      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard
          title="Pipeline tích hợp dữ liệu"
          subtitle="Từ hệ thống eCoSys / co.moit.gov.vn đến module C/O"
          className="lg:col-span-3"
        >
          <ol className="space-y-3">
            {[
              {
                icon: ExternalLink,
                title: "1. Hệ thống nguồn",
                desc: "eCoSys (ecosys.gov.vn) hoặc co.moit.gov.vn — xuất file Excel/CSV chứa dữ liệu C/O đã cấp.",
              },
              {
                icon: Upload,
                title: "2. Nhập file",
                desc: "Tải file lên hệ thống — hỗ trợ .xlsx, .xls, .csv. Kiểm tra định dạng, validate dữ liệu.",
              },
              {
                icon: Database,
                title: "3. Chẩn hóa & Lưu",
                desc: "Map cột, validate mã HS, FTA, số C/O — lưu vào cơ sở dữ liệu nội bộ.",
              },
              {
                icon: BarChart3,
                title: "4. KPI & Báo cáo",
                desc: "Dữ liệu cập nhật tự động vào KPI, biểu đồ, và Kho báo cáo (/analytics).",
              },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <li
                  key={s.title}
                  className="flex gap-3 rounded-md border border-border bg-surface p-3"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-gov/10 text-gov">
                    <Icon className="size-4.5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-navy">{s.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </ChartCard>

        {/* Nguồn dữ liệu */}
        <ChartCard
          title="Hệ thống nguồn"
          subtitle="Kết nối API hoặc nhập file"
          className="lg:col-span-2"
        >
          <div className="space-y-3">
            {Object.entries(SOURCE_META).map(([key, src]) => (
              <div
                key={key}
                className="rounded-md border border-border bg-surface p-3 transition-colors hover:border-gov/40"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="size-4 text-gov" />
                    <p className="text-sm font-semibold text-navy">{src.label}</p>
                  </div>
                  <Badge variant="outline" className="rounded-md text-[11px]">
                    <ExternalLink className="size-3 mr-1" />
                    <a href={src.url} target="_blank" rel="noopener noreferrer" className="underline">
                      Mở
                    </a>
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{src.desc}</p>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Upload zone */}
      <ChartCard title="Nhập file dữ liệu" subtitle="Hỗ trợ file Excel (.xlsx) và CSV (.csv)">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv,.txt"
          className="hidden"
          onChange={handleFileInput}
        />
        <div
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
            dragOver
              ? "border-gov bg-gov/5"
              : "border-border bg-surface hover:border-gov/40"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {parsing ? (
            <>
              <div className="size-8 animate-spin rounded-full border-2 border-gov border-t-transparent mb-3" />
              <p className="text-sm font-medium text-navy">Đang phân tích file...</p>
            </>
          ) : (
            <>
              <FileSpreadsheet className="size-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-navy">Kéo thả file vào đây</p>
              <p className="text-xs text-muted-foreground mt-1">
                hoặc chọn file từ máy tính — định dạng .xlsx, .xls, .csv
              </p>
              <Button variant="outline" className="mt-4" onClick={() => fileRef.current?.click()}>
                <Upload className="size-4 mr-1.5" /> Chọn file
              </Button>
            </>
          )}
        </div>

        {/* Kết quả parse */}
        {result && (
          <div className="mt-4 space-y-3">
            {/* Tóm tắt */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-gov" />
                <span className="text-sm font-medium text-navy">{result.fileName}</span>
              </div>
              <Badge variant="outline" className="rounded-md text-[11px]">
                {result.totalRows} dòng
              </Badge>
              {result.accepted.length > 0 && (
                <Badge variant="outline" className="rounded-md text-[11px] border-success/30 bg-success/10 text-success">
                  <CheckCircle2 className="size-3 mr-1" />
                  {result.accepted.length} hợp lệ
                </Badge>
              )}
              {result.rejected.length > 0 && (
                <Badge variant="outline" className="rounded-md text-[11px] border-destructive/30 bg-destructive/10 text-destructive">
                  <XCircle className="size-3 mr-1" />
                  {result.rejected.length} lỗi
                </Badge>
              )}
              <Button variant="ghost" size="sm" className="ml-auto" onClick={resetResult}>
                <RotateCcw className="size-3.5 mr-1" /> Import lại
              </Button>
            </div>

            {/* Lỗi chi tiết */}
            {result.rejected.length > 0 && (
              <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3">
                <p className="text-xs font-medium text-destructive mb-2">
                  <AlertTriangle className="size-3.5 inline mr-1" />
                  Chi tiết lỗi ({result.rejected.length})
                </p>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {result.rejected.map((err, i) => (
                    <p key={i} className="text-[11px] text-destructive">
                      Dòng {err.row} — <span className="font-medium">{err.column}</span>: {err.message}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Preview dữ liệu hợp lệ */}
            {result.accepted.length > 0 && (
              <div className="rounded-md border border-border bg-surface">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <p className="text-xs font-medium text-navy">
                    Preview ({result.accepted.length} bản ghi hợp lệ)
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => setShowRaw(!showRaw)}
                  >
                    {showRaw ? <EyeOff className="size-3 mr-1" /> : <Eye className="size-3 mr-1" />}
                    {showRaw ? "Ẩn" : "Xem raw"}
                  </Button>
                </div>
                <div className="max-h-64 overflow-auto">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-surface">
                      <tr className="border-b border-border">
                        <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">#</th>
                        <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Số H/S</th>
                        <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Mẫu</th>
                        <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">FTA</th>
                        <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Mã HS</th>
                        <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">XK</th>
                        <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">FOB</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.accepted.slice(0, 50).map((row, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                          <td className="px-2 py-1.5 font-medium text-navy">{row.applicationNo}</td>
                          <td className="px-2 py-1.5 font-mono text-gov">{row.formCode}</td>
                          <td className="px-2 py-1.5">{row.ftaCode || "—"}</td>
                          <td className="px-2 py-1.5 font-mono">{row.hsCode}</td>
                          <td className="px-2 py-1.5">{row.exporterName}</td>
                          <td className="px-2 py-1.5 text-right font-mono">
                            {row.fobValue.toLocaleString("vi-VN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.accepted.length > 50 && (
                    <p className="text-center text-[11px] text-muted-foreground py-2">
                      ... và {result.accepted.length - 50} bản ghi khác
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </ChartCard>

      {/* Import history */}
      <ChartCard
        title="Lịch sử nhập dữ liệu"
        subtitle={`Đã nhập ${batches.length} lô`}
      >
        <div className="space-y-2">
          {batches.map((batch) => (
            <div
              key={batch.id}
              className="flex items-center justify-between rounded-md border border-border bg-surface p-3"
            >
              <div className="flex items-center gap-3">
                {batch.rejectedRecords > 0 ? (
                  <AlertTriangle className="size-4 text-warning" />
                ) : (
                  <CheckCircle2 className="size-4 text-success" />
                )}
                <div>
                  <p className="text-sm font-medium text-navy">{batch.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    Nguồn: {SOURCE_META[batch.source]?.label ?? batch.source} —{" "}
                    {new Date(batch.importedAt).toLocaleDateString("vi-VN")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-success font-medium">{batch.acceptedRecords} bản ghi OK</span>
                {batch.rejectedRecords > 0 && (
                  <span className="text-destructive font-medium">{batch.rejectedRecords} lỗi</span>
                )}
                <Badge variant="outline" className="rounded-md text-[11px]">
                  {batch.status}
                </Badge>
              </div>
            </div>
          ))}
          {batches.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Chưa có dữ liệu nhập</p>
          )}
        </div>
      </ChartCard>
    </div>
  );
}
