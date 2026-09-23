"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BatteryCharging,
  Calculator,
  CheckCircle2,
  Download,
  Eye,
  History,
  Home,
  Loader2,
  RotateCcw,
  Sun,
  WalletCards,
  Zap,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataTable, type Column } from "@/components/common/DataTable";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  calculateCitizenSolar,
  type BatteryPriority,
  type CitizenSolarInput,
  type CitizenSolarResult,
  type RoofSize,
} from "@/lib/citizen-solar";
import { Link } from "@/lib/router-compat";
import { cn } from "@/lib/utils";
import { CitizenSolarScene } from "./CitizenSolarScene";

type Consultation = {
  id: string;
  code: string;
  customerName: string | null;
  district: string | null;
  propertyType: CitizenSolarInput["propertyType"];
  monthlyBillVnd: string;
  roofSize: RoofSize;
  roofAreaM2: string;
  wantsBattery: boolean;
  batteryPriority: BatteryPriority | null;
  result: CitizenSolarResult;
  methodVersion: string;
  createdAt: string;
};

const PROPERTY_OPTIONS = [
  { value: "townhouse", label: "Nhà phố", description: "Mái vừa, nhu cầu gia đình" },
  { value: "villa", label: "Biệt thự", description: "Mái rộng, phụ tải cao" },
  { value: "garden", label: "Nhà vườn", description: "Ít che bóng, dễ bố trí" },
  { value: "business", label: "Cửa hàng / xưởng", description: "Dùng điện nhiều" },
] as const;

const ROOF_OPTIONS: Array<{ value: RoofSize; label: string; description: string }> = [
  { value: "small", label: "Mái nhỏ", description: "Khoảng 24 m²" },
  { value: "medium", label: "Mái vừa", description: "Khoảng 45 m²" },
  { value: "large", label: "Mái lớn", description: "Khoảng 80 m²" },
  { value: "custom", label: "Tôi biết diện tích", description: "Nhập số m²" },
];

const formatMoney = (value: number) => new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
}).format(value);

const formatNumberInput = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

const initialInput: CitizenSolarInput = {
  customerName: "",
  district: "",
  propertyType: "townhouse",
  monthlyBillVnd: 2_000_000,
  roofSize: "medium",
  roofAreaM2: 45,
  wantsBattery: false,
  batteryPriority: "evening",
};

export function CitizenSolarAdvisor() {
  const [input, setInput] = useState<CitizenSolarInput>(initialInput);
  const [monthlyBillText, setMonthlyBillText] = useState(formatNumberInput(initialInput.monthlyBillVnd));
  const [history, setHistory] = useState<Consultation[]>([]);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  const [saving, setSaving] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [substations, setSubstations] = useState<Array<{
    id: string;
    code: string;
    name: string;
    voltageLevel: string;
    district: string;
    designCapacity?: number;
    operatingCapacity?: number;
    loadFactor?: number;
  }>>([]);
  const [selectedSubstationId, setSelectedSubstationId] = useState("");

  useEffect(() => {
    void fetch("/api/energy/overview", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Không thể tải danh sách trạm biến áp.");
        return response.json() as Promise<{ substations?: typeof substations }>;
      })
      .then((payload) => {
        const items = payload.substations ?? [];
        setSubstations(items);
        setSelectedSubstationId((current) => current || items[0]?.id || "");
      })
      .catch(() => undefined);
  }, []);

  const reloadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch("/api/solar/citizen-advice?limit=50", { cache: "no-store" });
      const payload = await response.json() as { items?: Consultation[]; message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Không thể tải lịch sử tư vấn.");
      setHistory(payload.items ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải lịch sử tư vấn.");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { void reloadHistory(); }, [reloadHistory]);

  const preview = useMemo(() => calculateCitizenSolar(input), [input]);
  const displayedResult = selectedConsultation?.result ?? preview;
  const selectedSubstation = substations.find((item) => item.id === selectedSubstationId);
  const substationAdvice = useMemo(() => {
    if (!selectedSubstation) return null;
    const capacityMva = selectedSubstation.operatingCapacity ?? selectedSubstation.designCapacity ?? 0;
    const loadFactor = Math.max(0, Math.min(100, selectedSubstation.loadFactor ?? 0));
    const spareKw = Math.max(0, Math.round(capacityMva * (1 - loadFactor / 100) * 1_000));
    const recommendedPanels = Math.min(displayedResult.panelCount, Math.max(0, Math.floor(spareKw / 0.55)));
    const panelCount = recommendedPanels > 0 ? recommendedPanels : 0;
    return {
      spareKw,
      panelCount,
      recommendation: panelCount >= displayedResult.panelCount
        ? `Trạm còn dư địa khoảng ${spareKw.toLocaleString("vi-VN")} kW, phù hợp với phương án ${displayedResult.panelCount} tấm pin.`
        : panelCount > 0
          ? `Trạm chỉ còn khoảng ${spareKw.toLocaleString("vi-VN")} kW, nên ưu tiên tối đa ${panelCount} tấm pin thay vì ${displayedResult.panelCount} tấm.`
          : "Trạm gần đầy tải; cần khảo sát phương án đấu nối hoặc nâng công suất trước khi lắp đặt.",
    };
  }, [displayedResult.panelCount, selectedSubstation]);

  const runAdvice = async () => {
    const normalizedInput = {
      ...input,
      monthlyBillVnd: Math.max(100_000, input.monthlyBillVnd || 0),
    };
    setInput(normalizedInput);
    setMonthlyBillText(formatNumberInput(normalizedInput.monthlyBillVnd));
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/solar/citizen-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizedInput),
      });
      const payload = await response.json() as { item?: Consultation; result?: CitizenSolarResult; message?: string };
      if (!response.ok || !payload.result || !payload.item) throw new Error(payload.message ?? "Không thể lưu kết quả tư vấn.");
      setSelectedConsultation(payload.item);
      setMessage("Đã tính và lưu phương án tư vấn vào cơ sở dữ liệu.");
      await reloadHistory();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể lưu kết quả tư vấn.");
    } finally {
      setSaving(false);
    }
  };

  const reportText = useMemo(() => [
    "# Báo cáo tư vấn điện mặt trời mái nhà",
    "",
    `- Tiền điện trung bình: ${formatMoney(input.monthlyBillVnd)}/tháng`,
    `- Công suất đề xuất: ${displayedResult.recommendedCapacityKwp} kWp (${displayedResult.panelCount} tấm pin)`,
    `- Sản lượng dự kiến: ${displayedResult.annualYieldKwh.toLocaleString("vi-VN")} kWh/năm`,
    `- Pin lưu trữ: ${displayedResult.batteryKwh ? `${displayedResult.batteryKwh} kWh` : "Không"}`,
    `- Chi phí tham khảo: ${formatMoney(displayedResult.estimatedCapexVnd)}`,
    `- Tiết kiệm tham khảo: ${formatMoney(displayedResult.monthlySavingVnd)}/tháng`,
    `- Hoàn vốn đơn giản: ${displayedResult.paybackYears} năm`,
    "",
    "## Lưu ý",
    ...displayedResult.assumptions.map((item) => `- ${item}`),
  ].join("\n"), [displayedResult, input.monthlyBillVnd]);

  const downloadReport = () => {
    const url = URL.createObjectURL(new Blob([reportText], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "tu-van-dien-mat-troi.md";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const monthlyChart = useMemo(() => {
    const factors = [0.82, 0.86, 0.94, 1.01, 1.06, 1.08, 1.05, 1.02, 0.98, 0.93, 0.86, 0.79];
    const sum = factors.reduce((total, value) => total + value, 0);
    return factors.map((factor, index) => ({
      month: `T${index + 1}`,
      generation: Math.round(displayedResult.annualYieldKwh * factor / sum),
      consumption: Math.round(displayedResult.annualConsumptionKwh / 12),
    }));
  }, [displayedResult]);

  const viewConsultation = useCallback((consultation: Consultation) => {
    setInput({
      customerName: consultation.customerName ?? "",
      district: consultation.district ?? "",
      propertyType: consultation.propertyType,
      monthlyBillVnd: Number(consultation.monthlyBillVnd),
      roofSize: consultation.roofSize,
      roofAreaM2: Number(consultation.roofAreaM2),
      wantsBattery: consultation.wantsBattery,
      batteryPriority: consultation.batteryPriority ?? "evening",
    });
    setMonthlyBillText(formatNumberInput(Number(consultation.monthlyBillVnd)));
    setSelectedConsultation(consultation);
    setMessage(`Đang xem lại phương án ${consultation.code}.`);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const historyColumns = useMemo<Column<Consultation>[]>(() => [
    { key: "createdAt", header: "Thời gian", sortable: true, value: (row) => row.createdAt, render: (row) => new Date(row.createdAt).toLocaleString("vi-VN") },
    { key: "code", header: "Mã tư vấn", sortable: true, className: "font-mono text-xs text-gov" },
    { key: "customerName", header: "Người dùng", sortable: true, value: (row) => row.customerName || "Ẩn danh" },
    { key: "monthlyBillVnd", header: "Tiền điện/tháng", sortable: true, value: (row) => Number(row.monthlyBillVnd), render: (row) => formatMoney(Number(row.monthlyBillVnd)) },
    { key: "capacity", header: "Phương án", sortable: true, value: (row) => Number(row.result.recommendedCapacityKwp), render: (row) => <span className="font-semibold text-navy">{row.result.recommendedCapacityKwp} kWp · {row.result.panelCount} tấm</span> },
    { key: "battery", header: "Lưu trữ", value: (row) => row.wantsBattery ? "Có" : "Không", render: (row) => <Badge variant="outline" className={cn("rounded-md", row.wantsBattery && "border-success/30 bg-success/10 text-success")}>{row.wantsBattery ? `${row.result.batteryKwh} kWh` : "Không"}</Badge> },
    { key: "payback", header: "Hoàn vốn", sortable: true, value: (row) => Number(row.result.paybackYears), render: (row) => `${row.result.paybackYears} năm` },
    { key: "action", header: "Thao tác", render: (row) => <Button variant="outline" size="sm" onClick={() => viewConsultation(row)}><Eye className="size-4" /> Xem lại</Button> },
  ], [viewConsultation]);

  return (
    <div className="min-h-full bg-surface">
      <PageHeader
        title="Tư vấn điện mặt trời cho hộ dân"
        description="Nhập vài thông tin dễ hiểu để nhận phương án sơ bộ, xem bố trí 3D và lưu lịch sử tư vấn."
        variant="panel"
        icon={Sun}
        crumbs={[{ label: "Năng lượng", to: "/energy" }, { label: "Nhiệm vụ 3", to: "/energy/nhiem-vu-3" }, { label: "Tư vấn điện mặt trời" }]}
        actions={<><Button variant="outline" size="sm" asChild><Link to="/energy/nhiem-vu-3"><ArrowLeft className="size-4" /> Về Nhiệm vụ 3</Link></Button><Button variant="outline" size="sm" onClick={downloadReport}><Download className="size-4" /> Tải báo cáo</Button></>}
      />

      <main className="space-y-5 px-2 pb-8 sm:px-4 lg:px-6">
        <section className="grid gap-5 xl:grid-cols-[minmax(330px,0.72fr)_minmax(0,1.28fr)]">
          <div className="gov-card overflow-hidden">
            <header className="border-b border-border bg-gradient-to-r from-warning/15 to-transparent px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-navy"><Calculator className="size-5 text-warning" /> 1. Thông tin của bạn</h2>
              <p className="mt-1 text-xs text-muted-foreground">Không cần mã khách hàng hoặc thông số kỹ thuật.</p>
            </header>
            <div className="space-y-5 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm font-medium text-navy">Tên (không bắt buộc)<Input value={input.customerName} onChange={(event) => setInput((old) => ({ ...old, customerName: event.target.value }))} placeholder="Quản trị" /></label>
                <label className="space-y-1.5 text-sm font-medium text-navy">Phường/xã (không bắt buộc)<Input value={input.district} onChange={(event) => setInput((old) => ({ ...old, district: event.target.value }))} placeholder="Ví dụ: Hòa Thành" /></label>
              </div>
              <label className="space-y-1.5 text-sm font-medium text-navy">
                Trạm biến áp tham chiếu
                <select
                  value={selectedSubstationId}
                  onChange={(event) => setSelectedSubstationId(event.target.value)}
                  disabled={!substations.length}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal text-navy outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {!substations.length ? <option value="">Đang tải danh sách trạm...</option> : null}
                  {substations.map((station) => (
                    <option key={station.id} value={station.id}>
                      {station.name} · {station.voltageLevel}{
                        station.district && station.district !== "Chưa xác định địa bàn"
                          ? ` · ${station.district}`
                          : ""
                      }
                    </option>
                  ))}
                </select>
                {selectedSubstation ? (
                  <span className="block text-[11px] font-normal text-muted-foreground">
                    {selectedSubstation.code} · tải hiện tại {selectedSubstation.loadFactor ?? 0}%
                  </span>
                ) : null}
              </label>

              <FieldTitle step="A" title="Bạn ở loại công trình nào?" />
              <div className="grid grid-cols-2 gap-2">
                {PROPERTY_OPTIONS.map((option) => <ChoiceCard key={option.value} active={input.propertyType === option.value} title={option.label} description={option.description} onClick={() => setInput((old) => ({ ...old, propertyType: option.value }))} />)}
              </div>

              <div>
                <FieldTitle step="B" title="Tiền điện trung bình mỗi tháng?" />
                <div className="mt-2 flex items-center gap-3"><Input type="text" inputMode="numeric" value={monthlyBillText} onChange={(event) => { const digits = event.target.value.replace(/\D/g, ""); setMonthlyBillText(digits ? formatNumberInput(Number(digits)) : ""); setInput((old) => ({ ...old, monthlyBillVnd: Number(digits) || 0 })); }} onBlur={() => { const value = Math.max(100_000, input.monthlyBillVnd || 0); setInput((old) => ({ ...old, monthlyBillVnd: value })); setMonthlyBillText(formatNumberInput(value)); }} aria-label="Tiền điện mỗi tháng dạng số" className="text-base font-semibold" /><span className="shrink-0 text-sm text-muted-foreground">đồng/tháng</span></div>
                <input aria-label="Tiền điện mỗi tháng" type="range" min={500000} max={20000000} step={250000} value={Math.min(20000000, input.monthlyBillVnd)} onChange={(event) => setInput((old) => ({ ...old, monthlyBillVnd: Number(event.target.value) }))} className="mt-3 w-full accent-amber-500" />
              </div>

              <FieldTitle step="C" title="Mái nhà rộng khoảng bao nhiêu?" />
              <div className="grid grid-cols-2 gap-2">
                {ROOF_OPTIONS.map((option) => <ChoiceCard key={option.value} active={input.roofSize === option.value} title={option.label} description={option.description} onClick={() => setInput((old) => ({ ...old, roofSize: option.value }))} />)}
              </div>
              {input.roofSize === "custom" ? <label className="space-y-1.5 text-sm font-medium text-navy">Diện tích mái có thể lắp (m²)<Input type="number" min={10} max={500} value={input.roofAreaM2 ?? 45} onChange={(event) => setInput((old) => ({ ...old, roofAreaM2: Number(event.target.value) }))} /></label> : null}

              <FieldTitle step="D" title="Bạn có muốn dùng pin lưu trữ?" />
              <div className="grid grid-cols-2 gap-2"><ChoiceCard active={!input.wantsBattery} title="Không cần" description="Ưu tiên tiết kiệm chi phí" onClick={() => setInput((old) => ({ ...old, wantsBattery: false }))} /><ChoiceCard active={input.wantsBattery} title="Có lưu trữ" description="Dùng tối hoặc khi mất điện" onClick={() => setInput((old) => ({ ...old, wantsBattery: true }))} /></div>
              {input.wantsBattery ? <div className="grid grid-cols-2 gap-2"><ChoiceCard active={input.batteryPriority === "evening"} title="Dùng buổi tối" description="Tăng tự dùng điện mặt trời" onClick={() => setInput((old) => ({ ...old, batteryPriority: "evening" as BatteryPriority }))} /><ChoiceCard active={input.batteryPriority === "backup"} title="Dự phòng mất điện" description="Ưu tiên thời gian cấp điện" onClick={() => setInput((old) => ({ ...old, batteryPriority: "backup" as BatteryPriority }))} /></div> : null}

              {selectedConsultation ? <div className="flex items-center justify-between gap-3 rounded-md border border-gov/25 bg-gov/5 px-3 py-2 text-xs text-gov"><span>Đang xem lại <strong>{selectedConsultation.code}</strong></span><Button variant="outline" size="sm" onClick={() => { setSelectedConsultation(null); setMessage(""); }}>Chỉnh sửa phương án</Button></div> : null}
              <div className="flex flex-wrap gap-2 border-t border-border pt-4"><Button onClick={() => void runAdvice()} disabled={saving} className="flex-1"><Sun className="size-4" /> {saving ? "Đang lưu phương án…" : "Tính và lưu phương án"}</Button><Button variant="outline" onClick={() => { setInput(initialInput); setMonthlyBillText(formatNumberInput(initialInput.monthlyBillVnd)); setSelectedConsultation(null); setMessage(""); }}><RotateCcw className="size-4" /> Đặt lại</Button></div>
              {message ? <p className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-success"><CheckCircle2 className="size-4" /> {message}</p> : null}
              {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p> : null}
            </div>
          </div>

          <div className="space-y-4">
            <CitizenSolarScene
              propertyType={input.propertyType}
              roofSize={input.roofSize}
              panelCount={displayedResult.panelCount}
              wantsBattery={displayedResult.batteryKwh > 0}
            />
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard label="Công suất đề xuất" value={`${displayedResult.recommendedCapacityKwp} kWp`} icon={Sun} tone="warning" />
              <StatCard label="Số tấm pin" value={`${displayedResult.panelCount} tấm`} icon={Home} tone="gov" />
              <StatCard label="Sản lượng/năm" value={`${displayedResult.annualYieldKwh.toLocaleString("vi-VN")} kWh`} icon={Zap} tone="success" />
              <StatCard label="Pin lưu trữ" value={displayedResult.batteryKwh ? `${displayedResult.batteryKwh} kWh` : "Không dùng"} icon={BatteryCharging} tone="analytics" />
              <StatCard
                label="Dư địa tải tại trạm"
                value={substationAdvice ? `${substationAdvice.spareKw.toLocaleString("vi-VN")} kW` : "Chọn trạm"}
                delta={substationAdvice?.recommendation}
                icon={Zap}
                tone={substationAdvice?.panelCount && substationAdvice.panelCount < displayedResult.panelCount ? "warning" : "teal"}
              />
            </section>
            <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
              <div className="gov-card p-4"><h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy">Điện tiêu thụ và điện mặt trời dự kiến</h3><ResponsiveContainer width="100%" height={270}><BarChart data={monthlyChart}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} width={46} /><Tooltip formatter={(value) => `${Number(value).toLocaleString("vi-VN")} kWh`} /><Bar dataKey="consumption" name="Tiêu thụ" fill="#94a3b8" radius={[3, 3, 0, 0]} /><Bar dataKey="generation" name="Điện mặt trời" fill="#e59a23" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>
              <div className="gov-card p-4"><h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-navy"><WalletCards className="size-4 text-success" /> Hiệu quả tham khảo</h3><dl className="mt-4 space-y-3 text-sm"><Metric label="Tỷ lệ đáp ứng điện" value={`${displayedResult.consumptionCoveragePct}%`} /><Metric label="Chi phí đầu tư" value={formatMoney(displayedResult.estimatedCapexVnd)} /><Metric label="Tiết kiệm mỗi tháng" value={formatMoney(displayedResult.monthlySavingVnd)} positive /><Metric label="Hoàn vốn đơn giản" value={`${displayedResult.paybackYears} năm`} /><Metric label="CO₂ tránh phát thải" value={`${displayedResult.avoidedCo2KgYear.toLocaleString("vi-VN")} kg/năm`} positive /></dl><div className="mt-4 rounded-md bg-surface p-3 text-[11px] leading-5 text-muted-foreground">{displayedResult.assumptions.map((item) => <p key={item}>• {item}</p>)}</div></div>
            </section>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2"><History className="size-5 text-analytics" /><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold uppercase tracking-wide text-navy">Lịch sử tư vấn</h2><p className="text-xs text-muted-foreground">Các phương án đã lưu trong PostgreSQL để cán bộ tiếp tục khảo sát và tư vấn.</p></div><Button variant="outline" size="sm" onClick={() => void reloadHistory()} disabled={historyLoading}>{historyLoading ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Làm mới</Button></div>
          <DataTable columns={historyColumns} rows={history} pageSize={8} searchPlaceholder="Tìm mã tư vấn, tên người dùng…" emptyText={historyLoading ? "Đang tải lịch sử…" : "Chưa có phương án tư vấn nào"} />
        </section>
      </main>
    </div>
  );
}

function FieldTitle({ step, title }: { step: string; title: string }) {
  return <div className="flex items-center gap-2 text-sm font-semibold text-navy"><span className="grid size-6 place-items-center rounded-full bg-gov/10 text-xs text-gov">{step}</span>{title}</div>;
}

function ChoiceCard({ active, title, description, onClick }: { active: boolean; title: string; description: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("rounded-lg border p-3 text-left transition", active ? "border-gov bg-gov/8 ring-1 ring-gov/20" : "border-border bg-background hover:border-gov/40")}><span className={cn("block text-sm font-semibold", active ? "text-gov" : "text-navy")}>{title}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{description}</span></button>;
}

function Metric({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-2"><dt className="text-muted-foreground">{label}</dt><dd className={cn("text-right font-semibold tabular-nums text-navy", positive && "text-success")}>{value}</dd></div>;
}
