import { LIFECYCLE_STEPS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

// Pipeline vòng đời dữ liệu (V. Luồng nghiệp vụ cốt lõi)
export function DataLifecycle({ activeIndex = 6 }: { activeIndex?: number }) {
  return (
    <section className="gov-card p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
        Vòng đời dữ liệu ngành Công Thương
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Chỉ dữ liệu ở trạng thái “Đã phê duyệt” hoặc “Đã khóa kỳ” được sử dụng trên dashboard chính
        thức.
      </p>
      <ol className="mt-3 flex flex-wrap items-center gap-1.5">
        {LIFECYCLE_STEPS.map((step, i) => (
          <li key={step} className="flex items-center gap-1.5">
            <span
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-xs font-medium",
                i < activeIndex && "border-success/30 bg-success/10 text-success",
                i === activeIndex && "border-gov bg-gov text-gov-foreground",
                i > activeIndex && "border-border bg-surface text-muted-foreground",
              )}
            >
              <span className="mr-1 tabular-nums opacity-70">{String(i + 1).padStart(2, "0")}</span>
              {step}
            </span>
            {i < LIFECYCLE_STEPS.length - 1 ? (
              <ChevronRight className="size-3.5 text-muted-foreground" />
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
