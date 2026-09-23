import { BrainCircuit, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { GridWarning } from "@/lib/grid-types";
import { cn } from "@/lib/utils";

const SEVERITY_TONE: Record<GridWarning["severity"], string> = {
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  warning: "border-warning/40 bg-warning/15 text-warning",
  info: "border-gov/30 bg-gov/10 text-gov",
};

const SEVERITY_LABEL: Record<GridWarning["severity"], string> = {
  danger: "Nguy hiểm",
  warning: "Cảnh báo",
  info: "Thông tin",
};

export function GridAIPanel({
  warnings,
  onOpenAi,
}: {
  warnings: GridWarning[];
  onOpenAi: () => void;
}) {
  return (
    <div className="space-y-4">
      <section className="gov-card flex flex-col">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="flex size-8 items-center justify-center rounded-md bg-destructive/10 text-destructive">
            <ShieldAlert className="size-4.5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
              Cảnh báo cần quan tâm
            </h2>
            <p className="text-xs text-muted-foreground">Đối tượng vượt ngưỡng theo GRID_CONFIG</p>
          </div>
          <Badge variant="outline" className="ml-auto shrink-0 rounded-md bg-surface">
            {warnings.length} cảnh báo
          </Badge>
        </header>
        <div className="max-h-[360px] space-y-2 overflow-y-auto p-3">
          {warnings.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Không có cảnh báo trong kỳ hiện tại.
            </p>
          ) : (
            warnings.map((w) => (
              <article key={w.id} className="rounded-md border border-border bg-surface p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("rounded-md", SEVERITY_TONE[w.severity])}>
                    {SEVERITY_LABEL[w.severity]}
                  </Badge>
                  <span className="text-xs font-semibold text-navy">{w.label}</span>
                  <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                    {w.trend === "up" ? (
                      <TrendingUp className="size-3.5 text-destructive" />
                    ) : w.trend === "down" ? (
                      <TrendingDown className="size-3.5 text-success" />
                    ) : null}
                    {w.current} → {w.forecast}%
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{w.reason}</p>
                <p className="mt-1.5 rounded-md bg-gov/5 px-2 py-1.5 text-xs leading-5 text-navy">
                  <span className="font-semibold">Đề xuất: </span>
                  {w.recommendation}
                </p>
              </article>
            ))
          )}
        </div>
      </section>

      <div
        role="button"
        tabIndex={0}
        onClick={onOpenAi}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenAi();
          }
        }}
        className="gov-card group flex w-full items-center gap-3 border-gov/20 px-4 py-3 text-left transition-colors hover:border-gov/40"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-gov/10 text-gov">
          <BrainCircuit className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-semibold text-navy">
            AI hỗ trợ dự báo
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Dự báo tải từ lịch sử 12 kỳ + dữ liệu GIS &amp; thống kê lưới
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-xs transition-colors group-hover:bg-gov group-hover:text-white">
          Mở phân tích →
        </span>
      </div>
    </div>
  );
}
