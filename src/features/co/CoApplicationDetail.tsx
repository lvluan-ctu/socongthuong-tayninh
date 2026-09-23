import { useState } from "react";
import { DetailDrawer } from "@/components/common/DetailDrawer";
import { CoStatusBadge } from "@/components/co/CoStatusBadge";
import { CoCertificateView } from "@/features/co/CoCertificateView";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatNumber } from "@/lib/co/co-service";
import { CO_FTA_MAP, CO_FORMS_MAP, CO_COUNTRIES_MAP, getHsCode } from "@/lib/co/co-constants";
import {
  getAvailableTransitions,
  PROVINCE_RECEIVING_AGENCY,
} from "@/lib/co/co-regulation";
import {
  CO_STATUS_LABELS,
  CO_WORKFLOW_ACTION_LABELS,
  type CoApplication,
  type CoWorkflowAction,
} from "@/lib/co/co-types";

interface CoApplicationDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: CoApplication | null;
  onUpdated?: (app: CoApplication) => void;
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm font-medium text-navy">{children}</div>
    </div>
  );
}

export function CoApplicationDetail({
  open,
  onOpenChange,
  application,
  onUpdated,
}: CoApplicationDetailProps) {
  const [note, setNote] = useState("");
  const [pendingAction, setPendingAction] = useState<CoWorkflowAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCert, setShowCert] = useState(false);

  if (!application) return null;

  const fta = CO_FTA_MAP.get(application.ftaCode);
  const form = CO_FORMS_MAP.get(application.formCode);
  const totalFob = application.items.reduce((s, i) => s + i.fobValue, 0);
  const transitions = getAvailableTransitions(application.status);

  const runTransition = async (
    action: CoWorkflowAction,
    label: string,
    requireNote: boolean,
  ) => {
    if (requireNote && !note.trim()) {
      setPendingAction(action);
      toast.error("Thao tác này bắt buộc nhập ghi chú/lý do.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/co/applications/${application.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          by: "Chuyên viên C/O",
          note: note.trim() || undefined,
          approvedBy: application.approvedBy ?? undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.message || `Không thể thực hiện "${label}".`);
        return;
      }
      toast.success(
        `${label} — ${CO_STATUS_LABELS[body.status as keyof typeof CO_STATUS_LABELS] ?? body.status}` +
          (body.coNumber ? ` · Số C/O: ${body.coNumber}` : ""),
      );
      setNote("");
      setPendingAction(null);
      onUpdated?.(body as CoApplication);
    } catch {
      toast.error("Lỗi kết nối — không thể chuyển trạng thái.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={`Hồ sơ C/O — ${application.applicationNo}`}
      widthClass="sm:max-w-2xl"
    >
      <div className="space-y-4">
        {/* Header info */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CoStatusBadge status={application.status} />
          <div className="flex items-center gap-2 text-xs">
            {application.coNumber && (
              <span className="font-medium text-gov">{application.coNumber}</span>
            )}
            <span className="text-muted-foreground">
              {application.certificateType === "SELF_CERT"
                ? "Văn bản chấp thuận"
                : "Giấy chứng nhận C/O"}
            </span>
            {application.status === "ISSUED" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() => setShowCert(true)}
              >
                <Printer className="size-3.5" /> Xem/In C/O
              </Button>
            )}
          </div>
        </div>

        {/* Workflow actions */}
        <div className="rounded-md border border-gov/30 bg-gov/5 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gov">
            Thao tác theo luồng TT 40/2025
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Cơ quan tiếp nhận: {application.receivingAgency || PROVINCE_RECEIVING_AGENCY}
          </p>
          {transitions.length > 0 ? (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap gap-2">
                {transitions.map((t) => (
                  <Button
                    key={`${t.from}-${t.action}`}
                    size="sm"
                    variant={t.action === "ISSUE" ? "default" : "outline"}
                    disabled={busy}
                    className={t.action === "ISSUE" ? "bg-gov text-white hover:bg-gov/90" : ""}
                    onClick={() => runTransition(t.action, t.label, Boolean(t.requireNote))}
                  >
                    {t.label}
                    {t.requireNote ? " *" : ""}
                  </Button>
                ))}
              </div>
              {transitions.some((t) => t.requireNote) || pendingAction ? (
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Ghi chú / lý do (* bắt buộc với các thao tác đánh dấu *)
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="VD: Cần bổ sung chứng từ vận tải..."
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-gov"
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Hồ sơ ở trạng thái kết thúc — không còn thao tác luồng.
            </p>
          )}
        </div>

        {/* Reviewer note */}
        {application.reviewerNote && (
          <div className="rounded-md border border-warning/30 bg-warning/5 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-warning">
              Ghi chú thẩm định
            </p>
            <p className="mt-1 text-sm text-foreground">{application.reviewerNote}</p>
          </div>
        )}

        {/* Basic info */}
        <div className="grid grid-cols-2 gap-2">
          <InfoRow label="Số hồ sơ">{application.applicationNo}</InfoRow>
          <InfoRow label="Mẫu C/O">{form?.name ?? application.formCode}</InfoRow>
          <InfoRow label="FTA">{fta?.name ?? application.ftaCode}</InfoRow>
          <InfoRow label="Giá trị FOB">{formatCurrency(totalFob)}</InfoRow>
          <InfoRow label="Người duyệt">{application.approvedBy ?? "—"}</InfoRow>
          <InfoRow label="Ngày cấp">
            {application.coIssuedDate
              ? new Date(application.coIssuedDate).toLocaleDateString("vi-VN")
              : "—"}
          </InfoRow>
        </div>

        {/* Exporter */}
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
            Đơn vị xuất khẩu
          </p>
          <p className="text-sm font-medium text-navy">{application.exporter.name}</p>
          <p className="text-xs text-muted-foreground">{application.exporter.address}</p>
          <p className="text-xs text-muted-foreground">MST: {application.exporter.taxCode}</p>
        </div>

        {/* Consignee */}
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
            Đơn vị nhập khẩu
          </p>
          <p className="text-sm font-medium text-navy">{application.consignee.name}</p>
          <p className="text-xs text-muted-foreground">{application.consignee.address}</p>
        </div>

        {/* Transport */}
        <div className="grid grid-cols-2 gap-2">
          <InfoRow label="Ngày xuất khẩu">{application.transport.departureDate}</InfoRow>
          <InfoRow label="Phương tiện/Tàu">{application.transport.vessel || "—"}</InfoRow>
          <InfoRow label="Cảng xếp">{application.transport.portLoading || "—"}</InfoRow>
          <InfoRow label="Cảng dỡ">{application.transport.portDischarge || "—"}</InfoRow>
        </div>

        {/* Items */}
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
            Hàng hóa ({application.items.length} mặt hàng)
          </p>
          <div className="space-y-2">
            {application.items.map((item) => {
              const hs = getHsCode(item.hsCode);
              return (
                <div key={item.itemNumber} className="rounded-md border border-border bg-surface p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-navy">
                        {item.itemNumber}. {item.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        HS: {item.hsCode} — {hs?.nameVi ?? item.description}
                      </p>
                    </div>
                    <span className="text-xs font-medium">{formatCurrency(item.fobValue)}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">SL: </span>
                      <span className="font-medium">{formatNumber(item.quantity)} {item.unit}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">XXGC: </span>
                      <span className="font-medium">{item.originCriterion}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">NCXX: </span>
                      <span className="font-medium">{item.countryOfOrigin}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">HĐ: </span>
                      <span className="font-medium">{item.invoiceNumber}</span>
                    </div>
                  </div>
                  {item.rvcPercentage !== undefined && (
                    <div className="mt-1 text-xs">
                      <span className="text-muted-foreground">Tỷ lệ RVC: </span>
                      <span className="font-medium">{item.rvcPercentage}%</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Declaration */}
        <div className="grid grid-cols-2 gap-2">
          <InfoRow label="Nước XK">{application.declaration.exportingCountry}</InfoRow>
          <InfoRow label="Nước NK">{application.declaration.importingCountry}</InfoRow>
          <InfoRow label="Ngày ký">{application.declaration.signDate || "—"}</InfoRow>
          <InfoRow label="Người ký">{application.declaration.signerName || "—"}</InfoRow>
        </div>

        {/* Status history */}
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
            Nhật ký xử lý hồ sơ
          </p>
          <ol className="space-y-2">
            {application.statusHistory.map((ev, i) => (
              <li
                key={`${ev.at}-${i}`}
                className="rounded-md border border-border bg-surface px-3 py-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="font-medium text-navy">
                    {CO_WORKFLOW_ACTION_LABELS[ev.action] ?? ev.action}
                    {ev.from ? `: ${CO_STATUS_LABELS[ev.from] ?? ev.from} → ` : ""}
                    {CO_STATUS_LABELS[ev.to] ?? ev.to}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {new Date(ev.at).toLocaleString("vi-VN")}
                  </span>
                </div>
                <p className="mt-0.5 text-muted-foreground">Thực hiện: {ev.by}</p>
                {ev.note && <p className="mt-0.5 text-foreground">Lý do: {ev.note}</p>}
              </li>
            ))}
          </ol>
        </div>

        {/* Metadata */}
        {Object.keys(application.metadata).length > 0 && (
          <div className="rounded-md border border-warning/20 bg-warning/5 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-warning mb-1">
              Ghi chú
            </p>
            {Object.entries(application.metadata).map(([k, v]) => (
              <p key={k} className="text-xs">
                <span className="text-muted-foreground">{k}: </span>
                <span className="font-medium">{String(v)}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Bản xem trước / in C/O (chỉ hồ sơ đã cấp) */}
      <CoCertificateView
        open={showCert}
        onOpenChange={setShowCert}
        application={application}
      />
    </DetailDrawer>
  );
}
