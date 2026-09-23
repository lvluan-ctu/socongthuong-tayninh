import { ArrowLeft, Download, FileText, Scale, Globe2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CO_FORMS, CO_FTA_MAP, CO_ORIGIN_CRITERIA } from "@/lib/co/co-constants";

interface CoFormDetailProps {
  formCode: string;
  onBack: () => void;
}

export function CoFormDetail({ formCode, onBack }: CoFormDetailProps) {
  const form = CO_FORMS.find((f) => f.code === formCode);
  if (!form) return null;

  const fta = form.ftaCode ? CO_FTA_MAP.get(form.ftaCode) : null;
  const criteria = CO_ORIGIN_CRITERIA.filter((c) =>
    form.originCriteria.includes(c.code),
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4 mr-1" /> Quay lại
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-navy">{form.name}</h2>
            <Badge
              variant="outline"
              className={`rounded-md text-[11px] ${
                form.isPreferential
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-muted bg-muted/10 text-muted-foreground"
              }`}
            >
              {form.isPreferential ? "Ưu đãi" : "Không ưu đãi"}
            </Badge>
          </div>
          {form.description && (
            <p className="text-sm text-muted-foreground mt-0.5">{form.description}</p>
          )}
        </div>
        {form.pdfUrl && (
          <a href={form.pdfUrl} download>
            <Button variant="outline" size="sm">
              <Download className="size-4 mr-1.5" /> Tải PDF
            </Button>
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* PDF Viewer — 2/3 width */}
        <div className="lg:col-span-2">
          {form.pdfUrl ? (
            <div className="rounded-lg border border-border bg-surface overflow-hidden">
              <iframe
                src={form.pdfUrl}
                className="w-full h-[700px]"
                title={`Mẫu C/O ${form.name}`}
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-surface p-12 text-center">
              <FileText className="size-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-navy">Chưa có file PDF</p>
              <p className="text-xs text-muted-foreground mt-1">
                Mẫu C/O {form.code} chưa được tải lên hệ thống
              </p>
            </div>
          )}
        </div>

        {/* Sidebar info — 1/3 width */}
        <div className="space-y-3">
          {/* Thông tin chung */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
              Thông tin chung
            </h3>
            <div className="space-y-2">
              <InfoRow label="Mã mẫu">{form.code}</InfoRow>
              <InfoRow label="Tên mẫu">{form.name}</InfoRow>
              <InfoRow label="Số ô">{form.totalBoxes} ô</InfoRow>
              <InfoRow label="Cơ quan cấp">{form.authority}</InfoRow>
            </div>
          </div>

          {/* FTA */}
          {fta && (
            <div className="rounded-lg border border-border bg-surface p-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
                Hiệp định thương mại
              </h3>
              <div className="flex items-center gap-2 mb-2">
                <Globe2 className="size-4 text-gov" />
                <span className="text-sm font-medium text-navy">{fta.shortName}</span>
              </div>
              <p className="text-xs text-muted-foreground">{fta.name}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {fta.members.slice(0, 6).map((m) => (
                  <Badge key={m} variant="outline" className="rounded text-[9px] px-1">
                    {m}
                  </Badge>
                ))}
                {fta.members.length > 6 && (
                  <Badge variant="outline" className="rounded text-[9px] px-1">
                    +{fta.members.length - 6}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Tiêu chí xuất xứ */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
              Tiêu chí xuất xứ ({form.originCriteria.length})
            </h3>
            <div className="space-y-2">
              {criteria.map((c) => (
                <div key={c.code} className="rounded-md bg-surface/50 p-2">
                  <p className="text-xs font-medium text-navy">
                    <span className="font-mono text-gov">{c.code}</span> — {c.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{c.nameVi}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Căn cứ pháp lý */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
              Căn cứ pháp lý
            </h3>
            <div className="flex items-start gap-2">
              <BookOpen className="size-4 text-gov mt-0.5 shrink-0" />
              <p className="text-xs text-navy">{form.legalBasis || "Chưa cập nhật"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-navy">{children}</span>
    </div>
  );
}
