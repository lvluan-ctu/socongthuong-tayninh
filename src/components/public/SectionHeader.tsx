import type { ReactNode } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionHeader({
  eyebrow,
  title,
  description,
  moreMuc,
  moreLabel = "Xem tất cả",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  moreMuc?: string;
  moreLabel?: string;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 sm:mb-10">
      <div className="max-w-2xl">
        {eyebrow ? (
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-gov/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-gov">
            <span className="size-1.5 rounded-full bg-gov" />
            {eyebrow}
          </span>
        ) : null}
        <h2 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">{title}</h2>
        {description ? (
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            {description}
          </p>
        ) : null}
      </div>
      {moreMuc ? (
        <Link
          to="/trang-thong-tin"
          search={{ muc: moreMuc }}
          className="group inline-flex items-center gap-1.5 rounded-full border border-gov/30 bg-gov/5 px-4 py-2 text-sm font-semibold text-gov transition-colors hover:bg-gov hover:text-white"
        >
          {moreLabel}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </div>
  );
}

export function Pill({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        className ?? "bg-gov/10 text-gov",
      )}
    >
      {children}
    </span>
  );
}
