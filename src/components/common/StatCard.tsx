import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tone = "gov" | "navy" | "teal" | "success" | "warning" | "danger" | "analytics";

export const TONE_TEXT: Record<Tone, string> = {
  gov: "text-gov",
  navy: "text-navy",
  teal: "text-teal",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  analytics: "text-analytics",
};

export const TONE_BG: Record<Tone, string> = {
  gov: "bg-gov/10",
  navy: "bg-navy/10",
  teal: "bg-teal/10",
  success: "bg-success/10",
  warning: "bg-warning/15",
  danger: "bg-destructive/10",
  analytics: "bg-analytics/10",
};

export function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = "gov",
  active,
  onClick,
}: {
  label: string;
  value: string | number;
  delta?: string | undefined;
  icon?: LucideIcon | undefined;
  tone?: Tone | undefined;
  active?: boolean;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "gov-card flex w-full items-start gap-3 p-4 text-left transition-colors",
        TONE_BG[tone],
        onClick && "hover:border-gov/50 hover:bg-surface",
        active && "border-gov ring-1 ring-gov/30",
      )}
    >
      {Icon ? (
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-md",
            TONE_BG[tone],
          )}
        >
          <Icon className={cn("size-5", TONE_TEXT[tone])} strokeWidth={1.75} />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="mt-1 block text-2xl font-semibold tabular-nums text-navy">{value}</span>
        {delta ? (
          <span className={cn("mt-0.5 block text-xs font-medium", TONE_TEXT[tone])}>{delta}</span>
        ) : null}
      </span>
    </Comp>
  );
}
