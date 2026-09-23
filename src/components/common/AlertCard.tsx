import type { LucideIcon } from "lucide-react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONE_BG, TONE_TEXT, type Tone } from "./StatCard";

export function AlertCard({
  value,
  label,
  tone = "warning",
  icon: Icon = AlertTriangle,
  onClick,
}: {
  value: number | string;
  label: string;
  tone?: Tone;
  icon?: LucideIcon;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="gov-card flex items-center gap-3 p-4 text-left transition-colors hover:border-gov/50 hover:bg-surface"
    >
      <span className={cn("flex size-10 items-center justify-center rounded-md", TONE_BG[tone])}>
        <Icon className={cn("size-5", TONE_TEXT[tone])} strokeWidth={1.75} />
      </span>
      <span>
        <span className={cn("block text-2xl font-semibold tabular-nums", TONE_TEXT[tone])}>
          {value}
        </span>
        <span className="block text-sm text-muted-foreground">{label}</span>
      </span>
    </button>
  );
}
