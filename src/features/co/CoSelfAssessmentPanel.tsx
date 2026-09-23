import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/common/ChartCard";
import { TT40_CONDITIONS, TT40_REF } from "@/lib/co/co-regulation";
import { toast } from "sonner";

interface AssessmentPayload {
  regulation: typeof TT40_REF;
  conditions: typeof TT40_CONDITIONS;
  assessment: {
    items: { id: string; met: boolean; note?: string }[];
    assessedBy: string;
    assessedAt: string;
  };
  allMet: boolean;
}

async function fetchAssessment(): Promise<AssessmentPayload> {
  const res = await fetch("/api/co/self-assessment");
  if (!res.ok) throw new Error("Không thể đọc bản tự đánh giá");
  return res.json();
}

export function CoSelfAssessmentPanel() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["co-self-assessment"],
    queryFn: fetchAssessment,
    retry: 1,
  });

  const [items, setItems] = useState<Record<string, { met: boolean; note: string }> | null>(null);
  const [assessedBy, setAssessedBy] = useState("");

  const current =
    items ??
    Object.fromEntries(
      (data?.assessment.items ?? TT40_CONDITIONS.map((c) => ({ id: c.id, met: false, note: "" }))).map(
        (i) => [i.id, { met: i.met, note: i.note ?? "" }],
      ),
    );
  const by = assessedBy || data?.assessment.assessedBy || "";

  const saveMutation = useMutation({
    mutationFn: async (payload: unknown) => {
      const res = await fetch("/api/co/self-assessment", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Không thể lưu");
      return body as AssessmentPayload;
    },
    onSuccess: (body) => {
      toast.success(
        body.allMet
          ? "Đã lưu — đáp ứng đủ 5 điều kiện cấp C/O (Điều 5 TT 40/2025)."
          : "Đã lưu bản tự đánh giá (chưa đủ điều kiện).",
      );
      void queryClient.invalidateQueries({ queryKey: ["co-self-assessment"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSave = () => {
    if (!by.trim()) {
      toast.error("Nhập đơn vị/ người tự đánh giá.");
      return;
    }
    saveMutation.mutate({
      items: TT40_CONDITIONS.map((c) => ({
        id: c.id,
        met: current[c.id]?.met ?? false,
        note: current[c.id]?.note ?? "",
      })),
      assessedBy: by.trim(),
      assessedAt: new Date().toISOString().slice(0, 10),
    });
    setItems(null);
  };

  const metCount = TT40_CONDITIONS.filter((c) => current[c.id]?.met).length;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Đang tải bản tự đánh giá...
      </div>
    );
  }

  return (
    <ChartCard
      title="Tự đánh giá điều kiện cấp C/O (Điều 5 & Phụ lục III TT 40/2025)"
      subtitle={`${metCount}/${TT40_CONDITIONS.length} điều kiện đạt — hiệu lực ${TT40_REF.effectiveDate}`}
      actions={
        <span
          className={
            metCount === TT40_CONDITIONS.length
              ? "rounded-md bg-success/10 px-2 py-1 text-xs font-medium text-success"
              : "rounded-md bg-warning/10 px-2 py-1 text-xs font-medium text-warning"
          }
        >
          {metCount === TT40_CONDITIONS.length ? "Đủ điều kiện cấp" : "Chưa đủ điều kiện"}
        </span>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Căn cứ: {TT40_REF.number} ngày {TT40_REF.date} — {TT40_REF.legalBasis}. Kết quả tự đánh
          giá gửi Bộ trưởng Bộ Công Thương và UBND cấp tỉnh (Điều 4.3).
        </p>

        {TT40_CONDITIONS.map((c) => {
          const state = current[c.id] ?? { met: false, note: "" };
          return (
            <div
              key={c.id}
              className="rounded-md border border-border bg-surface p-3"
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={state.met}
                  onChange={(e) =>
                    setItems({
                      ...current,
                      [c.id]: { ...state, met: e.target.checked },
                    })
                  }
                  className="mt-1 size-4 accent-gov"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-medium text-navy">
                    <ClipboardCheck
                      className={`size-3.5 ${state.met ? "text-success" : "text-muted-foreground"}`}
                    />
                    Điều {c.order}. {c.requirement}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{c.detail}</span>
                </span>
              </label>
              <input
                value={state.note}
                onChange={(e) =>
                  setItems({ ...current, [c.id]: { ...state, note: e.target.value } })
                }
                placeholder="Ghi chú giải trình (vd: 03 người ký đã tập huấn)..."
                className="mt-2 h-8 w-full rounded-md border border-border bg-card px-3 text-xs outline-none focus:border-gov"
              />
            </div>
          );
        })}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cơ quan tự đánh giá
            </label>
            <input
              value={by}
              onChange={(e) => setAssessedBy(e.target.value)}
              placeholder="Sở Công Thương tỉnh Tây Ninh"
              className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-gov"
            />
          </div>
          <div className="flex items-end">
            <Button
              className="w-full bg-gov text-white hover:bg-gov/90"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Đang lưu..." : "Lưu kết quả tự đánh giá"}
            </Button>
          </div>
        </div>

        {data?.assessment.assessedAt && (
          <p className="text-[11px] text-muted-foreground">
            Lần đánh giá gần nhất: {data.assessment.assessedAt} — {data.assessment.assessedBy}
          </p>
        )}
      </div>
    </ChartCard>
  );
}
