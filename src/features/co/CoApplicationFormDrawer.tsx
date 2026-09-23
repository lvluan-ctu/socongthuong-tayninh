import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CO_FTA, CO_FORMS_MAP, getFormsForTayNinh } from "@/lib/co/co-constants";
import { coCreateSchema, type CoCreateInput } from "@/lib/co/co-schemas";

interface FormItemDraft {
  hsCode: string;
  description: string;
  quantity: string;
  unit: string;
  fobValue: string;
  originCriterion: string;
  countryOfOrigin: string;
  invoiceNumber: string;
  invoiceDate: string;
}

const emptyItem = (): FormItemDraft => ({
  hsCode: "",
  description: "",
  quantity: "",
  unit: "Cái",
  fobValue: "",
  originCriterion: "WO",
  countryOfOrigin: "VN",
  invoiceNumber: "",
  invoiceDate: "",
});

const FIELD_LABEL = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground";
const FIELD_INPUT =
  "h-9 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-gov";

export function CoApplicationFormDrawer({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
}) {
  const forms = getFormsForTayNinh();
  const [formCode, setFormCode] = useState("D");
  const [ftaCode, setFtaCode] = useState("ATIGA");
  const [certificateType, setCertificateType] = useState<"CO" | "SELF_CERT">("CO");

  const [exporterName, setExporterName] = useState("");
  const [exporterAddress, setExporterAddress] = useState("");
  const [exporterTaxCode, setExporterTaxCode] = useState("");
  const [exporterCountry, setExporterCountry] = useState("VN");

  const [consigneeName, setConsigneeName] = useState("");
  const [consigneeAddress, setConsigneeAddress] = useState("");
  const [consigneeCountry, setConsigneeCountry] = useState("");

  const [departureDate, setDepartureDate] = useState("");
  const [vessel, setVessel] = useState("");
  const [portLoading, setPortLoading] = useState("");
  const [portDischarge, setPortDischarge] = useState("");

  const [exportingCountry, setExportingCountry] = useState("VIET NAM");
  const [importingCountry, setImportingCountry] = useState("");
  const [signDate, setSignDate] = useState("");
  const [signerName, setSignerName] = useState("");

  const [items, setItems] = useState<FormItemDraft[]>([emptyItem()]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const updateItem = (index: number, patch: Partial<FormItemDraft>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const resetForm = () => {
    setFormCode("D");
    setFtaCode("ATIGA");
    setCertificateType("CO");
    setExporterName("");
    setExporterAddress("");
    setExporterTaxCode("");
    setExporterCountry("VN");
    setConsigneeName("");
    setConsigneeAddress("");
    setConsigneeCountry("");
    setDepartureDate("");
    setVessel("");
    setPortLoading("");
    setPortDischarge("");
    setExportingCountry("VIET NAM");
    setImportingCountry("");
    setSignDate("");
    setSignerName("");
    setItems([emptyItem()]);
    setErrors([]);
  };

  const handleSubmit = async () => {
    const payload: CoCreateInput = {
      formCode,
      ftaCode,
      certificateType,
      exporter: {
        name: exporterName.trim(),
        address: exporterAddress.trim(),
        taxCode: exporterTaxCode.trim(),
        country: exporterCountry.trim() || "VN",
      },
      consignee: {
        name: consigneeName.trim(),
        address: consigneeAddress.trim(),
        country: consigneeCountry.trim(),
      },
      transport: {
        departureDate,
        vessel: vessel.trim(),
        portLoading: portLoading.trim(),
        portDischarge: portDischarge.trim(),
      },
      items: items.map((it, i) => ({
        itemNumber: i + 1,
        hsCode: it.hsCode.trim(),
        description: it.description.trim(),
        quantity: Number(it.quantity) || 0,
        unit: it.unit.trim() || "Cái",
        fobValue: Number(it.fobValue) || 0,
        originCriterion: it.originCriterion.trim() || "WO",
        countryOfOrigin: it.countryOfOrigin.trim() || "VN",
        invoiceNumber: it.invoiceNumber.trim() || "-",
        invoiceDate: it.invoiceDate || departureDate || "2026-01-01",
      })),
      declaration: {
        exportingCountry: exportingCountry.trim() || "VIET NAM",
        importingCountry: importingCountry.trim(),
        signDate: signDate.trim(),
        signerName: signerName.trim(),
      },
    };

    const parsed = coCreateSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
      return;
    }

    setErrors([]);
    setSaving(true);
    try {
      const res = await fetch("/api/co/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = await res.json();
      if (!res.ok) {
        const detail = Array.isArray(body.issues)
          ? body.issues.map((i: { message: string }) => i.message).join("; ")
          : body.message;
        toast.error(detail || "Không thể tạo hồ sơ C/O.");
        return;
      }
      toast.success(`Đã tạo hồ sơ ${body.applicationNo} (nháp).`);
      resetForm();
      onCreated?.();
      onOpenChange(false);
    } catch {
      toast.error("Lỗi kết nối — không thể tạo hồ sơ C/O.");
    } finally {
      setSaving(false);
    }
  };

  const formEntry = CO_FORMS_MAP.get(formCode);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-navy">Tạo hồ sơ C/O mới</SheetTitle>
          <SheetDescription>
            Tiếp nhận hồ sơ cấp C/O — theo TT 40/2025/TT-BCT & QĐ 34/2025/QĐ-UBND (Sở Công
            Thương Tây Ninh).
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {errors.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-xs font-semibold text-destructive">Dữ liệu chưa hợp lệ:</p>
              <ul className="mt-1 list-inside list-disc text-xs text-destructive">
                {errors.slice(0, 8).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Mẫu C/O & FTA */}
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy">
              1. Mẫu C/O & hiệp định
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={FIELD_LABEL}>Mẫu C/O (Phụ lục II)</label>
                <select
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className={FIELD_INPUT}
                >
                  {forms.map((f) => (
                    <option key={f.code} value={f.code}>
                      {f.code} — {f.name}
                    </option>
                  ))}
                </select>
                {formEntry?.legalBasis && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Căn cứ: {formEntry.legalBasis}
                  </p>
                )}
              </div>
              <div>
                <label className={FIELD_LABEL}>Hiệp định (FTA)</label>
                <select
                  value={ftaCode}
                  onChange={(e) => setFtaCode(e.target.value)}
                  className={FIELD_INPUT}
                >
                  {CO_FTA.map((f) => (
                    <option key={f.code} value={f.code}>
                      {f.shortName} — {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              {(["CO", "SELF_CERT"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCertificateType(t)}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    certificateType === t
                      ? "border-gov bg-gov/10 text-gov"
                      : "border-border bg-surface text-muted-foreground hover:border-gov/50",
                  )}
                >
                  {t === "CO" ? "📄 Giấy chứng nhận C/O" : "✍️ Văn bản chấp thuận tự chứng nhận"}
                </button>
              ))}
            </div>
          </section>

          {/* Xuất khẩu */}
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy">
              2. Đơn vị xuất khẩu
            </p>
            <div>
              <label className={FIELD_LABEL}>Tên doanh nghiệp</label>
              <Input
                value={exporterName}
                onChange={(e) => setExporterName(e.target.value)}
                placeholder="Công ty TNHH ..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={FIELD_LABEL}>Mã số thuế</label>
                <Input
                  value={exporterTaxCode}
                  onChange={(e) => setExporterTaxCode(e.target.value)}
                  placeholder="37..."
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>Quốc gia</label>
                <Input
                  value={exporterCountry}
                  onChange={(e) => setExporterCountry(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className={FIELD_LABEL}>Địa chỉ</label>
              <Input
                value={exporterAddress}
                onChange={(e) => setExporterAddress(e.target.value)}
                placeholder="KCN ..., tỉnh Tây Ninh"
              />
            </div>
          </section>

          {/* Nhập khẩu */}
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy">
              3. Đơn vị nhập khẩu (consignee)
            </p>
            <div>
              <label className={FIELD_LABEL}>Tên đơn vị</label>
              <Input
                value={consigneeName}
                onChange={(e) => setConsigneeName(e.target.value)}
                placeholder="Import Co., Ltd"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={FIELD_LABEL}>Quốc gia (mã)</label>
                <Input
                  value={consigneeCountry}
                  onChange={(e) => setConsigneeCountry(e.target.value)}
                  placeholder="KH / TH / US ..."
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>Nước NK (tuyên bố)</label>
                <Input
                  value={importingCountry}
                  onChange={(e) => setImportingCountry(e.target.value)}
                  placeholder="CAMBODIA ..."
                />
              </div>
            </div>
            <div>
              <label className={FIELD_LABEL}>Địa chỉ</label>
              <Input
                value={consigneeAddress}
                onChange={(e) => setConsigneeAddress(e.target.value)}
              />
            </div>
          </section>

          {/* Vận tải */}
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy">4. Vận tải</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={FIELD_LABEL}>Ngày xuất khẩu</label>
                <Input
                  type="date"
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>Phương tiện / Tàu</label>
                <Input value={vessel} onChange={(e) => setVessel(e.target.value)} />
              </div>
              <div>
                <label className={FIELD_LABEL}>Cảng / cửa khẩu xếp</label>
                <Input
                  value={portLoading}
                  onChange={(e) => setPortLoading(e.target.value)}
                  placeholder="Mộc Bài ..."
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>Cảng / cửa khẩu dỡ</label>
                <Input
                  value={portDischarge}
                  onChange={(e) => setPortDischarge(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Mặt hàng */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy">
                5. Mặt hàng ({items.length})
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItems((prev) => [...prev, emptyItem()])}
              >
                + Thêm mặt hàng
              </Button>
            </div>
            {items.map((it, index) => (
              <div key={index} className="space-y-2 rounded-md border border-border bg-surface p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-navy">Mặt hàng #{index + 1}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      className="text-xs text-destructive hover:underline"
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                    >
                      Xóa
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={FIELD_LABEL}>Mã HS</label>
                    <Input
                      value={it.hsCode}
                      onChange={(e) => updateItem(index, { hsCode: e.target.value })}
                      placeholder="40012100"
                    />
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>Tiêu chí XXGC</label>
                    <select
                      value={it.originCriterion}
                      onChange={(e) => updateItem(index, { originCriterion: e.target.value })}
                      className={FIELD_INPUT}
                    >
                      {["WO", "CTH", "CTC", "RVC", "PE"].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={FIELD_LABEL}>Mô tả hàng hóa</label>
                  <Input
                    value={it.description}
                    onChange={(e) => updateItem(index, { description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className={FIELD_LABEL}>Số lượng</label>
                    <Input
                      type="number"
                      value={it.quantity}
                      onChange={(e) => updateItem(index, { quantity: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>ĐVT</label>
                    <Input
                      value={it.unit}
                      onChange={(e) => updateItem(index, { unit: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>FOB (USD)</label>
                    <Input
                      type="number"
                      value={it.fobValue}
                      onChange={(e) => updateItem(index, { fobValue: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className={FIELD_LABEL}>Số HĐ</label>
                    <Input
                      value={it.invoiceNumber}
                      onChange={(e) => updateItem(index, { invoiceNumber: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>Ngày HĐ</label>
                    <Input
                      type="date"
                      value={it.invoiceDate}
                      onChange={(e) => updateItem(index, { invoiceDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>NCXX</label>
                    <Input
                      value={it.countryOfOrigin}
                      onChange={(e) => updateItem(index, { countryOfOrigin: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </section>

          {/* Tuyên bố */}
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy">
              6. Tuyên bố xuất xứ
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={FIELD_LABEL}>Nước XK</label>
                <Input
                  value={exportingCountry}
                  onChange={(e) => setExportingCountry(e.target.value)}
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>Người ký</label>
                <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={FIELD_LABEL}>Ngày ký (tùy chọn)</label>
              <Input type="date" value={signDate} onChange={(e) => setSignDate(e.target.value)} />
            </div>
          </section>

          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1 bg-gov text-white hover:bg-gov/90"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? "Đang lưu..." : "Tạo hồ sơ (Nháp)"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
