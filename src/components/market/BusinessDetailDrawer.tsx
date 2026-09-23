import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FIELD_LABELS,
  type Business,
  type LicenseStatus,
  type ViolationStatus,
} from "@/lib/market-types";
import { cn } from "@/lib/utils";

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function LicenseStatusBadge({ status }: { status: LicenseStatus }) {
  const cls =
    status === "valid"
      ? "border-success/30 bg-success/10 text-success"
      : status === "expiring"
        ? "border-warning/40 bg-warning/15 text-warning"
        : "border-destructive/30 bg-destructive/10 text-destructive";
  const label =
    status === "valid" ? "Còn hạn" : status === "expiring" ? "Sắp hết hạn" : "Hết hạn";
  return (
    <Badge variant="outline" className={cn("rounded-md font-medium text-[11px]", cls)}>
      {label}
    </Badge>
  );
}

function ViolationStatusBadge({ status }: { status: ViolationStatus }) {
  const cls =
    status === "resolved"
      ? "border-success/30 bg-success/10 text-success"
      : status === "appealing"
        ? "border-warning/40 bg-warning/15 text-warning"
        : "border-gov/30 bg-gov/10 text-gov";
  const label =
    status === "resolved" ? "Đã xử lý" : status === "appealing" ? "Đang khiếu nại" : "Chờ xử lý";
  return (
    <Badge variant="outline" className={cn("rounded-md font-medium text-[11px]", cls)}>
      {label}
    </Badge>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-0.5 text-sm font-medium text-navy">{children}</div>
    </div>
  );
}

export function BusinessDetailDrawer({
  open,
  onOpenChange,
  business,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  business: Business | null;
  onEdit?: (b: Business) => void;
}) {
  if (!business) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-navy">{business.name}</SheetTitle>
          <SheetDescription>
            {business.type === "company" ? "Doanh nghiệp" : "Hộ kinh doanh"} · {business.taxCode}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "rounded-md font-medium",
                business.status === "active"
                  ? "border-success/30 bg-success/10 text-success"
                  : business.status === "suspended"
                    ? "border-warning/40 bg-warning/15 text-warning"
                    : "border-destructive/30 bg-destructive/10 text-destructive",
              )}
            >
              {business.status === "active"
                ? "Đang hoạt động"
                : business.status === "suspended"
                  ? "Tạm ngừng"
                  : "Hết hạn"}
            </Badge>
            <Badge variant="outline" className="rounded-md border-gov/25 bg-gov/5 font-medium text-gov">
              {FIELD_LABELS[business.field]}
            </Badge>
            {business.violations.length > 0 && (
              <Badge
                variant="outline"
                className="rounded-md border-destructive/30 bg-destructive/10 font-medium text-destructive"
              >
                {business.violations.length} vi phạm
              </Badge>
            )}
          </div>

          {/* Thông tin cơ bản */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <InfoRow label="Loại hình">
              {business.type === "company" ? "🏢 Doanh nghiệp" : "🏪 Hộ kinh doanh"}
            </InfoRow>
            <InfoRow label="MST/CCCD">{business.taxCode}</InfoRow>
            <InfoRow label="Người đại diện">{business.representative}</InfoRow>
            <InfoRow label="Số điện thoại">{business.phone ?? "—"}</InfoRow>
            <InfoRow label="Lĩnh vực">{FIELD_LABELS[business.field]}</InfoRow>
            <InfoRow label="Mặt hàng chính">{business.mainProduct}</InfoRow>
            <InfoRow label="Hình thức">{business.businessForm}</InfoRow>
            <InfoRow label="Địa chỉ">
              {business.houseNumber ? `${business.houseNumber} ` : ""}
              {business.street ? `${business.street}, ` : ""}
              {business.ward}, {business.district}
            </InfoRow>
          </div>

          {/* Giấy phép */}
          {business.licenses.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy">
                Giấy phép ({business.licenses.length})
              </h4>
              <div className="space-y-2">
                {business.licenses.map((lic) => (
                  <div
                    key={lic.id}
                    className="rounded-md border border-border bg-surface/50 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-navy">{lic.type}</p>
                        <p className="text-xs text-muted-foreground">Số: {lic.number}</p>
                      </div>
                      <LicenseStatusBadge status={lic.status} />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>
                        <span className="font-medium">Cấp ngày:</span> {lic.issueDate}
                      </div>
                      <div>
                        <span className="font-medium">Hết hạn:</span> {lic.expiryDate}
                      </div>
                      <div className="col-span-2">
                        <span className="font-medium">Nơi cấp:</span> {lic.issuedBy}
                      </div>
                    </div>
                    {lic.status === "expiring" && (
                      <p className="mt-1.5 text-[11px] font-medium text-warning">
                        ⚠ Còn {daysUntil(lic.expiryDate)} ngày hết hạn
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vi phạm */}
          {business.violations.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy">
                Vi phạm ({business.violations.length})
              </h4>
              <div className="space-y-2">
                {business.violations.map((v) => (
                  <div
                    key={v.id}
                    className="rounded-md border border-border bg-surface/50 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-navy">{v.date}</p>
                      <ViolationStatusBadge status={v.status} />
                    </div>
                    <p className="mt-1 text-xs text-foreground">{v.content}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="font-medium">Kết quả:</span> {v.handlingResult}
                    </p>
                    {v.fineAmount && (
                      <p className="mt-0.5 text-xs text-destructive font-medium">
                        Tiền phạt: {v.fineAmount.toLocaleString("vi-VN")} đồng
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <span className="font-medium">Cán bộ:</span> {v.inspectorName}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {onEdit && (
            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1 bg-gov text-white hover:bg-gov/90"
                onClick={() => {
                  onEdit(business);
                  onOpenChange(false);
                }}
              >
                Chỉnh sửa
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
