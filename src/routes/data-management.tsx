import { useState } from "react";
import { createFileRoute } from "@/lib/router-compat";
import {
  CheckCircle2,
  FileScan,
  GitCompareArrows,
  ScanText,
  ShieldAlert,
  UploadCloud,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { ChartCard } from "@/components/common/ChartCard";
import { DataLifecycle } from "@/components/common/DataLifecycle";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { MASTER_RECORDS, OCR_EXTRACTION, QUALITY_ISSUES } from "@/data/mock";
import type { MasterRecord, QualityIssue } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/data-management")({
  head: () => ({
    meta: [
      { title: "Quản trị dữ liệu & số hóa OCR/AI" },
      {
        name: "description",
        content:
          "Số hóa hồ sơ bằng OCR/AI, chuẩn hóa master data, kiểm tra chất lượng dữ liệu và đối soát trước khi trình phê duyệt.",
      },
      { property: "og:title", content: "Quản trị dữ liệu & số hóa OCR/AI" },
      {
        property: "og:description",
        content: "Số hóa, chuẩn hóa và kiểm soát chất lượng dữ liệu ngành Công Thương.",
      },
    ],
  }),
  component: DataManagement,
});

const masterColumns: Column<MasterRecord>[] = [
  { key: "id", header: "Mã", sortable: true },
  { key: "type", header: "Nhóm dữ liệu", sortable: true },
  { key: "name", header: "Tên bộ dữ liệu", sortable: true, className: "font-medium text-navy" },
  { key: "source", header: "Nguồn", sortable: true },
  { key: "owner", header: "Đơn vị chủ quản", sortable: true },
  { key: "updatedAt", header: "Cập nhật", sortable: true },
  { key: "status", header: "Trạng thái", render: (r) => <StatusBadge status={r.status} /> },
];

const qualityColumns: Column<QualityIssue>[] = [
  { key: "field", header: "Trường dữ liệu", sortable: true, className: "font-medium text-navy" },
  { key: "issue", header: "Lỗi phát hiện", sortable: true },
  { key: "records", header: "Số bản ghi", sortable: true, className: "text-right tabular-nums" },
  { key: "severity", header: "Mức độ", sortable: true },
  { key: "assignee", header: "Người xử lý", sortable: true },
  { key: "status", header: "Trạng thái", render: (r) => <StatusBadge status={r.status} /> },
];

function DataManagement() {
  const [scanned, setScanned] = useState(false);
  const [progress, setProgress] = useState(0);

  const runOcr = () => {
    setProgress(0);
    setScanned(false);
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timer);
          setScanned(true);
          toast.success("Đã bóc tách 8 trường dữ liệu từ hồ sơ (mô phỏng OCR/AI)");
          return 100;
        }
        return p + 20;
      });
    }, 220);
  };

  return (
    <>
      <PageHeader
        title="Quản trị dữ liệu"
        description="Số hóa – chuẩn hóa – kiểm tra chất lượng – đối soát. Dữ liệu chỉ được đưa vào CSDL ngành sau khi qua đủ các bước kiểm soát."
        crumbs={[{ label: "Dữ liệu" }, { label: "Quản trị dữ liệu" }]}
        actions={
          <Button onClick={() => toast.success("Đã tạo bộ dữ liệu mới ở trạng thái Nháp")}>
            Tạo bộ dữ liệu
          </Button>
        }
      />

      <div className="space-y-5 p-4 sm:p-6">
        <DataLifecycle />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Bộ dữ liệu đang quản lý" value="7" icon={FileScan} tone="gov" />
          <StatCard
            label="Hồ sơ đã số hóa OCR/AI"
            value="12.480"
            delta="+364 tuần này"
            icon={ScanText}
            tone="teal"
          />
          <StatCard label="Lỗi chất lượng cần xử lý" value="320" icon={ShieldAlert} tone="danger" />
          <StatCard label="Bản ghi đã đối soát" value="94,2%" icon={CheckCircle2} tone="success" />
        </section>

        <Tabs defaultValue="ocr">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="ocr">Số hóa OCR/AI</TabsTrigger>
            <TabsTrigger value="master">Master Data</TabsTrigger>
            <TabsTrigger value="quality">Chất lượng dữ liệu</TabsTrigger>
            <TabsTrigger value="reconcile">Đối soát</TabsTrigger>
          </TabsList>

          <TabsContent value="ocr" className="mt-4 grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Tải hồ sơ cần số hóa"
              subtitle="Hỗ trợ PDF, ảnh scan, DOCX (mô phỏng)"
            >
              <div className="rounded-lg border-2 border-dashed border-border bg-surface p-8 text-center">
                <UploadCloud className="mx-auto size-10 text-gov" strokeWidth={1.5} />
                <p className="mt-3 text-sm font-medium text-navy">
                  Kéo thả tệp hoặc chọn hồ sơ từ máy trạm
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  BC-SXCN-T6-2026.pdf · 4,2 MB · 6 trang
                </p>
                <Input type="file" className="mx-auto mt-4 max-w-xs" />
                <Button className="mt-4" onClick={runOcr}>
                  <ScanText className="size-4" /> Bóc tách bằng OCR/AI
                </Button>
              </div>
              {progress > 0 ? (
                <div className="mt-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Tiến trình bóc tách</span>
                    <span className="font-medium tabular-nums">{progress}%</span>
                  </div>
                  <Progress value={progress} className="mt-1 h-2" />
                </div>
              ) : null}
            </ChartCard>

            <ChartCard
              title="Kết quả trích xuất tự động"
              subtitle="Chuyên viên đối chiếu và xác nhận trước khi lưu vào staging"
            >
              {scanned ? (
                <>
                  <ul className="divide-y divide-border">
                    {OCR_EXTRACTION.map((f) => (
                      <li key={f.field} className="flex items-center gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">{f.field}</p>
                          <p className="truncate text-sm font-medium text-navy">{f.value}</p>
                        </div>
                        <span
                          className={
                            f.confidence >= 95
                              ? "rounded bg-success/10 px-2 py-0.5 text-xs font-medium text-success"
                              : "rounded bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning"
                          }
                        >
                          {f.confidence}%
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => toast.success("Đã lưu vào staging, chờ chuẩn hóa")}
                    >
                      Xác nhận & lưu staging
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => toast.info("Đã gửi yêu cầu bóc tách lại")}
                    >
                      Bóc tách lại
                    </Button>
                  </div>
                </>
              ) : (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  Chưa có kết quả. Hãy tải hồ sơ và bấm “Bóc tách bằng OCR/AI”.
                </p>
              )}
            </ChartCard>
          </TabsContent>

          <TabsContent value="master" className="mt-4">
            <DataTable
              columns={masterColumns}
              rows={MASTER_RECORDS}
              searchPlaceholder="Tìm bộ dữ liệu, nguồn, đơn vị chủ quản..."
            />
          </TabsContent>

          <TabsContent value="quality" className="mt-4">
            <DataTable
              columns={qualityColumns}
              rows={QUALITY_ISSUES}
              searchPlaceholder="Tìm trường dữ liệu, lỗi, người xử lý..."
            />
          </TabsContent>

          <TabsContent value="reconcile" className="mt-4 grid gap-4 lg:grid-cols-2">
            <ChartCard title="Đối soát dữ liệu nội bộ – LGSP" subtitle="Kỳ đối soát: Quý II/2026">
              <ul className="space-y-2 text-sm">
                {[
                  { l: "Bản ghi khớp hoàn toàn", v: "11.762", tone: "text-success" },
                  { l: "Lệch thông tin cần rà soát", v: "418", tone: "text-warning" },
                  { l: "Chỉ có ở dữ liệu nội bộ", v: "184", tone: "text-gov" },
                  { l: "Chỉ có ở LGSP", v: "116", tone: "text-destructive" },
                ].map((r) => (
                  <li
                    key={r.l}
                    className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2"
                  >
                    <span className="text-muted-foreground">{r.l}</span>
                    <span className={`font-semibold tabular-nums ${r.tone}`}>{r.v}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="mt-4 w-full"
                onClick={() => toast.success("Đã chạy đối soát lại với LGSP (mô phỏng)")}
              >
                <GitCompareArrows className="size-4" /> Chạy đối soát
              </Button>
            </ChartCard>
            <ChartCard title="Phiên bản dữ liệu" subtitle="Versioning theo kỳ báo cáo">
              <ul className="divide-y divide-border text-sm">
                {[
                  { v: "v2026.06", note: "Khóa kỳ tháng 6/2026", by: "Hệ thống" },
                  { v: "v2026.05", note: "Khóa kỳ tháng 5/2026", by: "Hệ thống" },
                  { v: "v2026.Q1", note: "Khóa kỳ quý I/2026", by: "Quản trị" },
                ].map((r) => (
                  <li key={r.v} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="font-medium text-navy">{r.v}</p>
                      <p className="text-xs text-muted-foreground">{r.note}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{r.by}</span>
                  </li>
                ))}
              </ul>
            </ChartCard>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
