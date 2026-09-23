"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Search, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type OutageResult = {
  id: string;
  code: string;
  title: string;
  status: string;
  startAt: string;
  endAt: string;
  affectedCustomers: number | null;
  reason: string | null;
  impactMethod: string;
};

type LookupResponse = {
  affected: boolean;
  items: OutageResult[];
  note: string;
  checkedAt?: string;
  location?: { latitude: number; longitude: number };
  demoAddress?: string | null;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

function toLocalInputValue(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function SafetyOutageLookup() {
  const [latitude, setLatitude] = useState(11.3);
  const [longitude, setLongitude] = useState(106.1);
  const [address, setAddress] = useState("Nhà demo, gần tuyến đường dây NV5-OUTAGE-001");
  const [at, setAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [result, setResult] = useState<LookupResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/safety/outages/check?demo=true", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as LookupResponse;
        if (!response.ok || !payload.location) return;
        setLatitude(payload.location.latitude);
        setLongitude(payload.location.longitude);
        setAddress(payload.demoAddress ?? "Nhà demo, gần tuyến đường dây NV5-OUTAGE-001");
        setAt(payload.checkedAt ? toLocalInputValue(payload.checkedAt) : new Date().toISOString().slice(0, 16));
        setResult(null);
      })
      .catch(() => undefined);
  }, []);

  async function check() {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), at: new Date(at).toISOString() });
      const response = await fetch(`/api/safety/outages/check?${query.toString()}`, { cache: "no-store" });
      const payload = await response.json() as LookupResponse & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Không thể tra cứu.");
      setResult(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tra cứu.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="gov-card p-4">
      <div className="flex flex-wrap items-start gap-3">
        <ShieldAlert className="mt-0.5 size-5 text-warning" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">Tra cứu cúp điện cho hộ dân</h2>
          <p className="mt-1 text-xs text-muted-foreground">Nhập tọa độ vị trí nhà và thời điểm cần kiểm tra để đối chiếu vùng ảnh hưởng cắt điện.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <label className="space-y-1 text-xs font-medium text-navy sm:col-span-2">Địa chỉ nhà<Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Nhập địa chỉ nhà" /></label>
        <label className="space-y-1 text-xs font-medium text-navy">Vĩ độ<Input type="number" step="any" value={latitude} onChange={(event) => setLatitude(Number(event.target.value))} /></label>
        <label className="space-y-1 text-xs font-medium text-navy">Kinh độ<Input type="number" step="any" value={longitude} onChange={(event) => setLongitude(Number(event.target.value))} /></label>
        <label className="space-y-1 text-xs font-medium text-navy">Thời điểm<Input type="datetime-local" value={at} onChange={(event) => setAt(event.target.value)} /></label>
      </div>
      <div className="mt-3 flex justify-end"><Button onClick={() => void check()} disabled={loading}><Search className="size-4" /> {loading ? "Đang tra cứu..." : "Kiểm tra vị trí"}</Button></div>
      {error ? <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p> : null}
      {result ? (
        <div className={`mt-4 rounded-md border px-3 py-3 text-sm ${result.affected ? "border-warning/40 bg-warning/10" : "border-success/30 bg-success/10"}`}>
          <div className="flex items-center gap-2 font-semibold text-navy">{result.affected ? <AlertCircle className="size-4 text-warning" /> : <CheckCircle2 className="size-4 text-success" />}{result.affected ? `Có ${result.items.length} lịch cắt điện giao với vị trí` : "Chưa có lịch cắt điện giao với vị trí"}</div>
          {result.items.length ? <div className="mt-3 space-y-2">{result.items.map((item) => <article key={item.id} className="rounded-md border border-border bg-background p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{item.code}</strong><span className="text-xs text-muted-foreground">{item.status}</span></div><p className="mt-1 text-sm text-navy">{item.title}</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="rounded-md border border-red-200 bg-red-50 px-3 py-2"><p className="text-[11px] font-bold uppercase text-red-700">Cúp điện</p><p className="mt-0.5 font-bold text-red-800">{formatDate(item.startAt)}</p></div><div className="rounded-md border border-green-200 bg-green-50 px-3 py-2"><p className="text-[11px] font-bold uppercase text-green-700">Có điện lại</p><p className="mt-0.5 font-bold text-green-800">{formatDate(item.endAt)}</p></div></div><p className="mt-2 text-xs text-muted-foreground">Phạm vi dự kiến: {item.affectedCustomers?.toLocaleString("vi-VN") ?? "—"} khách hàng</p><p className="mt-1 text-xs text-navy"><strong>Lý do:</strong> {item.reason ?? "Chưa có mô tả"}</p></article>)}</div> : null}
          <p className="mt-3 text-xs text-muted-foreground">{result.note}</p>
        </div>
      ) : null}
    </section>
  );
}
