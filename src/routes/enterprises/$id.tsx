import { createFileRoute, Link, notFound } from "@/lib/router-compat";
import { useMemo } from "react";
import {
  AlertTriangle,
  Boxes,
  BrainCircuit,
  Factory,
  FileCheck2,
  Mail,
  Ship,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { ChartCard } from "@/components/common/ChartCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ENTERPRISES, LICENSES } from "@/data/mock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/enterprises/$id")({
  head: () => ({
    meta: [
      { title: "Hồ sơ doanh nghiệp 360 độ | Ngành Công Thương" },
      {
        name: "description",
        content:
          "Hồ sơ số 360 độ của doanh nghiệp: thông tin pháp lý, cơ sở sản xuất, sản phẩm, giấy phép, năng lượng và xuất nhập khẩu.",
      },
      { property: "og:title", content: "Hồ sơ doanh nghiệp 360 độ" },
      {
        property: "og:description",
        content: "Hồ sơ số tổng hợp của doanh nghiệp ngành Công Thương.",
      },
    ],
  }),
  component: EnterpriseDetail,
});

type LicenseRow = (typeof LICENSES)[number];

const LICENSE_STATUS_LABEL: Record<LicenseRow["status"], string> = {
  valid: "Còn hiệu lực",
  expiring: "Sắp hết hạn",
  expired: "Hết hạn",
};

const LICENSE_STATUS_TONE: Record<LicenseRow["status"], string> = {
  valid: "bg-success/10 text-success border-success/30",
  expiring: "bg-warning/15 text-warning border-warning/40",
  expired: "bg-destructive/10 text-destructive border-destructive/30",
};

const DAY_MS = 86_400_000;
const daysUntil = (iso: string) =>
  Math.ceil((new Date(`${iso}T00:00:00`).getTime() - Date.now()) / DAY_MS);
const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const licenseColumns: Column<LicenseRow>[] = [
  { key: "code", header: "Mã GP", sortable: true },
  { key: "type", header: "Loại giấy phép", sortable: true },
  {
    key: "issuedAt",
    header: "Ngày cấp",
    sortable: true,
    value: (r) => formatDate(r.issuedAt),
    render: (r) => formatDate(r.issuedAt),
  },
  {
    key: "expiresAt",
    header: "Ngày hết hạn",
    sortable: true,
    value: (r) => formatDate(r.expiresAt),
    render: (r) => formatDate(r.expiresAt),
  },
  {
    key: "daysLeft",
    header: "Còn lại",
    render: (r) => {
      if (r.status === "expired") {
        return <span className="font-medium tabular-nums text-muted-foreground">Đã hết hạn</span>;
      }
      const d = daysUntil(r.expiresAt);
      return (
        <span
          className={cn(
            "font-medium tabular-nums",
            d <= 7 ? "text-destructive" : d <= 30 ? "text-warning" : "text-success",
          )}
        >
          {d} ngày
        </span>
      );
    },
  },
  {
    key: "status",
    header: "Trạng thái",
    sortable: true,
    render: (r) => (
      <Badge
        variant="outline"
        className={cn("rounded-md font-medium", LICENSE_STATUS_TONE[r.status])}
      >
        {LICENSE_STATUS_LABEL[r.status]}
      </Badge>
    ),
  },
];

function EnterpriseDetail() {
  const { id } = Route.useParams();
  const e = ENTERPRISES.find((x) => x.id === id);
  if (!e) throw notFound();

  const licenses = useMemo(() => LICENSES.filter((l) => l.enterpriseId === e.id), [e.id]);
  const valid = licenses.filter((l) => l.status === "valid").length;
  const expiring = licenses.filter((l) => l.status === "expiring");
  const expired = licenses.filter((l) => l.status === "expired").length;

  const sendEmail = () => {
    const subject = encodeURIComponent(`Thông báo giấy phép sắp hết hạn — ${e.name}`);
    const body = encodeURIComponent(
      [
        `Kính gửi ${e.name},`,
        "",
        "Hệ thống dữ liệu ngành Công Thương tỉnh Tây Ninh ghi nhận các giấy phép sau đây sắp hết hiệu lực trong 30 ngày tới:",
        "",
        ...expiring.map(
          (l) =>
            `- ${l.code} (${l.type}): hết hạn ${formatDate(l.expiresAt)} — còn ${daysUntil(l.expiresAt)} ngày`,
        ),
        "",
        "Đề nghị doanh nghiệp liên hệ Sở Công Thương để thực hiện thủ tục gia hạn kịp thời.",
        "",
        "Trân trọng.",
        "Sở Công Thương tỉnh Tây Ninh",
      ].join("\n"),
    );
    window.location.href = `mailto:${e.email}?subject=${subject}&body=${body}`;
    toast.success(`Đã mở email gửi đến ${e.email} với danh sách giấy phép sắp hết hạn.`);
  };

  return (
    <>
      <PageHeader
        title={e.name}
        description={`MST ${e.taxCode} · ${e.sector} · ${e.district}`}
        crumbs={[
          { label: "Dữ liệu" },
          { label: "Dữ liệu doanh nghiệp", to: "/co?tab=doanh-nghiep" },
          { label: "Hồ sơ doanh nghiệp" },
        ]}
        actions={
          <Button asChild variant="outline">
            <Link to="/co" search={{ tab: "doanh-nghiep" }}>Về danh sách</Link>
          </Button>
        }
      />
      <div className="space-y-5 p-4 sm:p-6">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Cơ sở SXKD" value={e.links.facilities} icon={Factory} tone="gov" />
          <StatCard label="Sản phẩm" value={e.links.products} icon={Boxes} tone="teal" />
          <StatCard label="Giấy phép" value={e.links.licenses} icon={FileCheck2} tone="success" />
          <StatCard label="Hồ sơ XNK" value={e.links.trades} icon={Ship} tone="analytics" />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Thông tin pháp lý">
            <dl className="divide-y divide-border text-sm">
              {[
                ["Người đại diện", e.representative],
                ["Địa chỉ", e.address],
                ["Email liên hệ", e.email],
                ["Lao động", `${e.employees} người`],
                ["Doanh thu", `${e.revenue} tỷ đồng`],
                ["Nguồn dữ liệu", e.source],
                ["Đơn vị chủ quản dữ liệu", e.owner],
                ["Cập nhật", e.updatedAt],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium text-navy">{v}</dd>
                </div>
              ))}
            </dl>
          </ChartCard>
          <ChartCard title="Trạng thái dữ liệu" subtitle="Vòng đời phê duyệt của hồ sơ">
            <StatusBadge status={e.dataStatus} />
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Hồ sơ được tổng hợp từ nhiều phân hệ nghiệp vụ. Chỉ các trường đã phê duyệt hoặc đã
              khóa kỳ được sử dụng cho báo cáo điều hành và cổng tra cứu công khai.
            </p>
          </ChartCard>
        </section>

        <ChartCard
          title="Giấy phép đã cấp"
          subtitle="Loại giấy phép · ngày cấp · ngày hết hạn · hiệu lực còn lại"
          actions={
            <span className="text-xs text-muted-foreground">
              {licenses.length} GP · {expiring.length} sắp hết hạn · {expired} hết hạn
            </span>
          }
        >
          <DataTable
            columns={licenseColumns}
            rows={licenses}
            searchPlaceholder="Tìm kiếm giấy phép..."
            emptyText="Chưa có giấy phép cho doanh nghiệp này"
          />
        </ChartCard>

        <section className="rounded-2xl border border-analytics/30 bg-analytics/[0.08] p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BrainCircuit className="size-5 text-analytics" />
              <h3 className="text-sm font-semibold uppercase tracking-wide text-navy">
                AI cảnh báo dữ liệu sắp hết hạn
              </h3>
            </div>
            <Badge
              variant="outline"
              className="rounded-md border-analytics/40 bg-analytics/10 text-analytics"
            >
              <Sparkles className="mr-1 size-3" />
              Bản phân tích AI
            </Badge>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-3 text-sm">
              {expiring.length > 0 ? (
                <>
                  <p className="leading-relaxed text-foreground">
                    Doanh nghiệp có <span className="font-semibold text-success">{valid}</span> giấy
                    phép còn hiệu lực và{" "}
                    <span className="font-semibold text-warning">{expiring.length}</span> giấy phép
                    sắp hết hạn trong 30 ngày tới ({expired} giấy phép đã hết hạn).
                  </p>
                  <p className="mt-2 leading-relaxed text-muted-foreground">
                    Giấy phép cần lưu ý nhất là{" "}
                    <span className="font-semibold text-foreground">
                      {expiring[0]?.code} ({expiring[0]?.type})
                    </span>{" "}
                    hết hạn vào{" "}
                    <span className="font-semibold text-foreground">
                      {expiring[0] ? formatDate(expiring[0].expiresAt) : ""}
                    </span>
                    , còn {expiring[0] ? daysUntil(expiring[0].expiresAt) : 0} ngày. Đề nghị cán bộ
                    phụ trách chủ động liên hệ doanh nghiệp để gia hạn kịp thời.
                  </p>
                </>
              ) : (
                <p className="leading-relaxed text-muted-foreground">
                  Không có giấy phép nào sắp hết hạn trong 30 ngày tới. Hồ sơ giấy phép của doanh
                  nghiệp đang trong trạng thái ổn định.
                </p>
              )}
            </div>

            <div className="space-y-2">
              {expiring.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {l.code} · {l.type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Hết hạn {formatDate(l.expiresAt)} — còn {daysUntil(l.expiresAt)} ngày
                    </p>
                  </div>
                  <AlertTriangle className="size-4 shrink-0 text-warning" />
                </div>
              ))}
              {expiring.length === 0 ? (
                <p className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                  Không có giấy phép sắp hết hạn.
                </p>
              ) : null}
              <Button size="sm" onClick={sendEmail} disabled={expiring.length === 0}>
                <Mail className="size-4" />
                Gửi email cho doanh nghiệp
              </Button>
            </div>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Bản phân tích AI dựa trên dữ liệu giấy phép đã được kiểm duyệt trong hệ thống. Email
            được soạn sẵn theo mẫu, cán bộ kiểm tra và gửi qua ứng dụng thư đang dùng.
          </p>
        </section>
      </div>
    </>
  );
}
