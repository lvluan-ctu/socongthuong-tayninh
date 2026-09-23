import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FIELD_LABELS,
  type Business,
  type BusinessField,
  type BusinessType,
} from "@/lib/market-types";
import { cn } from "@/lib/utils";

const FIELD_OPTIONS = Object.entries(FIELD_LABELS).map(([v, l]) => ({
  value: v as BusinessField,
  label: l,
}));

export function BusinessFormDrawer({
  open,
  onOpenChange,
  business,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  business?: Business | null;
  onSave?: (data: Partial<Business>) => void;
}) {
  const [type, setType] = useState<BusinessType>(business?.type ?? "company");
  const [name, setName] = useState(business?.name ?? "");
  const [taxCode, setTaxCode] = useState(business?.taxCode ?? "");
  const [representative, setRepresentative] = useState(business?.representative ?? "");
  const [phone, setPhone] = useState(business?.phone ?? "");
  const [field, setField] = useState<BusinessField>(business?.field ?? "xang_dau");
  const [mainProduct, setMainProduct] = useState(business?.mainProduct ?? "");
  const [district, setDistrict] = useState(business?.district ?? "");
  const [ward, setWard] = useState(business?.ward ?? "");
  const [gcnNumber, setGcnNumber] = useState(business?.gcnNumber ?? "");
  const [gcnExpiryDate, setGcnExpiryDate] = useState(business?.gcnExpiryDate ?? "");

  const handleSave = () => {
    onSave?.({
      id: business?.id ?? `NEW-${Date.now()}`,
      type,
      name,
      taxCode,
      representative,
      phone,
      field,
      mainProduct,
      district,
      ward,
      gcnNumber,
      gcnExpiryDate,
      province: "Tây Ninh",
      nationality: "Việt Nam",
      businessForm: "Bán lẻ",
      status: business?.status ?? "active",
      lat: business?.lat ?? 11.31,
      lng: business?.lng ?? 106.19,
      licenses: business?.licenses ?? [],
      violations: business?.violations ?? [],
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-navy">
            {business ? "Sửa thông tin" : "Thêm thực thể mới"}
          </SheetTitle>
          <SheetDescription>
            {business
              ? `Chỉnh sửa thông tin "${business.name}"`
              : "Điền thông tin doanh nghiệp / hộ kinh doanh"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Loại hình */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Loại hình
            </label>
            <div className="flex gap-2">
              {(["company", "household"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    type === t
                      ? "border-gov bg-gov/10 text-gov"
                      : "border-border bg-surface text-muted-foreground hover:border-gov/50",
                  )}
                >
                  {t === "company" ? "🏢 Doanh nghiệp" : "🏪 Hộ kinh doanh"}
                </button>
              ))}
            </div>
          </div>

          {/* Tên */}
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tên {type === "company" ? "doanh nghiệp" : "hộ kinh doanh"}
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập tên..." />
          </div>

          {/* MST / CCCD */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {type === "company" ? "Mã số thuế" : "CCCD"}
              </label>
              <Input value={taxCode} onChange={(e) => setTaxCode(e.target.value)} placeholder="MST/CCCD" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Người đại diện
              </label>
              <Input value={representative} onChange={(e) => setRepresentative(e.target.value)} />
            </div>
          </div>

          {/* SĐT */}
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Số điện thoại
            </label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xx..." />
          </div>

          {/* Lĩnh vực */}
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Lĩnh vực kinh doanh
            </label>
            <select
              value={field}
              onChange={(e) => setField(e.target.value as BusinessField)}
              className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-gov"
            >
              {FIELD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Mặt hàng */}
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Mặt hàng chính
            </label>
            <Input value={mainProduct} onChange={(e) => setMainProduct(e.target.value)} />
          </div>

          {/* Địa chỉ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Huyện/TP/Thị xã
              </label>
              <Input value={district} onChange={(e) => setDistrict(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Xã/Phường/Thị trấn
              </label>
              <Input value={ward} onChange={(e) => setWard(e.target.value)} />
            </div>
          </div>

          {/* GCN */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Số GCNĐK
              </label>
              <Input value={gcnNumber} onChange={(e) => setGcnNumber(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Ngày hết hạn GCN
              </label>
              <Input type="date" value={gcnExpiryDate} onChange={(e) => setGcnExpiryDate(e.target.value)} />
            </div>
          </div>

          {/* Action */}
          <div className="flex gap-2 pt-2">
            <Button className="flex-1 bg-gov text-white hover:bg-gov/90" onClick={handleSave}>
              {business ? "Cập nhật" : "Thêm mới"}
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
