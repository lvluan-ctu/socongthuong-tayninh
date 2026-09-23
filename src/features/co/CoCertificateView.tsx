import { DetailDrawer } from "@/components/common/DetailDrawer";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
import { CO_FTA_MAP, CO_FORMS_MAP } from "@/lib/co/co-constants";
import { PROVINCE_RECEIVING_AGENCY } from "@/lib/co/co-regulation";
import { formatCurrency, formatNumber } from "@/lib/co/co-service";
import type { CoApplication } from "@/lib/co/co-types";

/**
 * Giấy chứng nhận xuất xứ (C/O) — bản xem trước & in.
 * Layout A4 thân thiện in ấn; dùng chung print CSS báo cáo nhiệm vụ
 * (chỉ .mission-report-print hiện khi in — thêm class tương ứng tại đây).
 */
export function CoCertificateView({
  open,
  onOpenChange,
  application,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  application: CoApplication | null;
}) {
  if (!application || application.status !== "ISSUED") return null;

  const form = CO_FORMS_MAP.get(application.formCode);
  const fta = CO_FTA_MAP.get(application.ftaCode);
  const totalFob = application.items.reduce((s, i) => s + i.fobValue, 0);

  const handlePrint = () => window.print();

  const handleDownload = () => {
    const rows = [
      ["Số C/O", application.coNumber ?? ""],
      ["Số hồ sơ", application.applicationNo],
      ["Mẫu", form?.name ?? application.formCode],
      ["FTA", fta?.name ?? application.ftaCode],
      ["Xuất khẩu", application.exporter.name],
      ["MST", application.exporter.taxCode],
      ["Nhập khẩu", application.consignee.name],
      ["Ngày cấp", application.coIssuedDate ?? ""],
      ["Người duyệt", application.approvedBy ?? ""],
      ["Tổng FOB (USD)", totalFob],
      ...application.items.map((it) => [
        `MH${it.itemNumber}`,
        `${it.hsCode} | ${it.description} | ${it.quantity} ${it.unit} | ${formatCurrency(it.fobValue)} | ${it.originCriterion}`,
      ]),
    ];
    const esc = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = rows.map((r) => r.map(esc).join(",")).join("\r\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `co-${application.coNumber ?? application.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Giấy chứng nhận xuất xứ (C/O)"
      description={application.coNumber ?? application.applicationNo}
      widthClass="sm:max-w-3xl"
    >
      <div className="mb-3 flex justify-end gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="size-4" /> Tải dữ liệu
        </Button>
        <Button size="sm" className="bg-gov text-white hover:bg-gov/90" onClick={handlePrint}>
          <Printer className="size-4" /> In C/O
        </Button>
      </div>

      {/* Giấy chứng nhận — giữ lại khi in */}
      <div className="co-certificate-print rounded-lg border-2 border-navy bg-white p-6 text-black shadow-sm">
        <div className="text-center">
          <p className="text-sm font-bold uppercase">
            Cộng hòa xã hội chủ nghĩa Việt Nam — Độc lập · Tự do · Hạnh phúc
          </p>
          <p className="mt-1 text-xs">{PROVINCE_RECEIVING_AGENCY}</p>
          <p className="mt-4 text-lg font-bold uppercase tracking-wide">
            Giấy chứng nhận xuất xứ hàng hóa
          </p>
          <p className="text-sm italic">(Certificate of Origin)</p>
          <p className="mt-1 text-sm font-semibold">
            Số: {application.coNumber ?? "—"} — Mẫu {application.formCode}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          <p>
            <span className="font-semibold">1. Người xuất khẩu:</span> {application.exporter.name}
          </p>
          <p>
            <span className="font-semibold">4. Quốc gia nhập khẩu:</span>{" "}
            {application.declaration.importingCountry}
          </p>
          <p>
            <span className="font-semibold">2. Địa chỉ:</span> {application.exporter.address}
          </p>
          <p>
            <span className="font-semibold">5. Quốc gia xuất khẩu:</span>{" "}
            {application.declaration.exportingCountry}
          </p>
          <p>
            <span className="font-semibold">3. MST:</span> {application.exporter.taxCode}
          </p>
          <p>
            <span className="font-semibold">6. Ngày xuất khẩu:</span>{" "}
            {application.transport.departureDate}
          </p>
          <p>
            <span className="font-semibold">7. Người nhập khẩu:</span>{" "}
            {application.consignee.name}
          </p>
          <p>
            <span className="font-semibold">8. Phương tiện:</span>{" "}
            {application.transport.vessel || "—"} — {application.transport.portLoading} →{" "}
            {application.transport.portDischarge}
          </p>
        </div>

        <table className="mt-4 w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-400 px-2 py-1 text-left">STT</th>
              <th className="border border-slate-400 px-2 py-1 text-left">Mã HS</th>
              <th className="border border-slate-400 px-2 py-1 text-left">Mô tả hàng hóa</th>
              <th className="border border-slate-400 px-2 py-1 text-right">SL</th>
              <th className="border border-slate-400 px-2 py-1 text-right">FOB (USD)</th>
              <th className="border border-slate-400 px-2 py-1 text-center">Tiêu chí XX</th>
            </tr>
          </thead>
          <tbody>
            {application.items.map((it) => (
              <tr key={it.itemNumber}>
                <td className="border border-slate-400 px-2 py-1">{it.itemNumber}</td>
                <td className="border border-slate-400 px-2 py-1">{it.hsCode}</td>
                <td className="border border-slate-400 px-2 py-1">{it.description}</td>
                <td className="border border-slate-400 px-2 py-1 text-right">
                  {formatNumber(it.quantity)} {it.unit}
                </td>
                <td className="border border-slate-400 px-2 py-1 text-right">
                  {formatCurrency(it.fobValue)}
                </td>
                <td className="border border-slate-400 px-2 py-1 text-center">
                  {it.originCriterion}
                </td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-semibold">
              <td className="border border-slate-400 px-2 py-1" colSpan={4}>
                Tổng giá trị FOB
              </td>
              <td className="border border-slate-400 px-2 py-1 text-right">
                {formatCurrency(totalFob)}
              </td>
              <td className="border border-slate-400 px-2 py-1" />
            </tr>
          </tbody>
        </table>

        <div className="mt-3 text-xs">
          <p>
            <span className="font-semibold">Hiệp định:</span> {fta?.name ?? application.ftaCode} —{" "}
            {form?.legalBasis ?? ""}
          </p>
          <p className="mt-1">
            <span className="font-semibold">Tuyên bố:</span> Bên ký tên dưới đây tuyên bố rằng
            thông tin trên là đúng và hàng hóa đáp ứng quy tắc xuất xứ của hiệp định.
          </p>
        </div>

        <div className="mt-6 flex items-end justify-between text-xs">
          <div>
            <p className="font-semibold">Người có thẩm quyền ký</p>
            <p className="mt-8 italic">
              {application.declaration.signerName || application.approvedBy || "—"}
            </p>
            <p>(Ký, ghi rõ họ tên, đóng dấu)</p>
          </div>
          <div className="text-right">
            <p>
              <span className="font-semibold">Ngày cấp:</span>{" "}
              {application.coIssuedDate
                ? new Date(application.coIssuedDate).toLocaleDateString("vi-VN")
                : "—"}
            </p>
            <p>
              <span className="font-semibold">Cơ quan cấp:</span> {PROVINCE_RECEIVING_AGENCY}
            </p>
            <p className="mt-1 italic">Hồ sơ: {application.applicationNo}</p>
          </div>
        </div>
      </div>
    </DetailDrawer>
  );
}
