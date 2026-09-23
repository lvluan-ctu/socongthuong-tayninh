import { Link } from "@/lib/router-compat";
import { AlertTriangle, ArrowDownRight, CircleDashed } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function ProgressMetric({
  label,
  value,
  barClass = "bg-gov",
}: {
  label: string;
  value: number;
  barClass?: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums text-navy">{value}%</span>
      </div>
      <Progress value={value} className="mt-1 h-2" barClassName={barClass} />
    </div>
  );
}

export type AlertTone = "warning" | "gov" | "danger" | "orange";

const ALERT_TONE: Record<AlertTone, { dot: string; count: string }> = {
  warning: { dot: "bg-warning", count: "text-warning" },
  orange: { dot: "bg-orange-500", count: "text-orange-600" },
  gov: { dot: "bg-gov", count: "text-gov" },
  danger: { dot: "bg-destructive", count: "text-destructive" },
};

export function AlertItem({
  count,
  label,
  tone = "warning",
  to,
}: {
  count: number;
  label: string;
  tone?: AlertTone;
  to?: string;
}) {
  const t = ALERT_TONE[tone];
  const body = (
    <span className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2 text-xs transition-colors hover:border-current">
      <span className={cn("size-2 shrink-0 rounded-full", t.dot)} />
      <span className={cn("text-sm font-semibold tabular-nums", t.count)}>{count}</span>
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{label}</span>
    </span>
  );
  if (!to) return body;
  return (
    <Link to={to as never} className="contents">
      {body}
    </Link>
  );
}

export type TaskTone = "warning" | "danger" | "gov";

const TASK_TONE: Record<TaskTone, { tag: string; tagText: string }> = {
  warning: { tag: "bg-warning/15 text-warning", tagText: "Khẩn" },
  danger: { tag: "bg-destructive/10 text-destructive", tagText: "Quá hạn" },
  gov: { tag: "bg-gov/10 text-gov", tagText: "Đang xử lý" },
};

export function TaskItem({
  name,
  due,
  tone = "gov",
}: {
  name: string;
  due: string;
  tone?: TaskTone;
}) {
  const t = TASK_TONE[tone];
  return (
    <li className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-2.5 py-2">
      <div className="flex min-w-0 items-center gap-2">
        {tone === "danger" ? (
          <AlertTriangle className="size-3.5 shrink-0 text-destructive" />
        ) : tone === "warning" ? (
          <CircleDashed className="size-3.5 shrink-0 text-warning" />
        ) : (
          <ArrowDownRight className="size-3.5 shrink-0 text-gov" />
        )}
        <span className="truncate text-xs font-medium text-foreground">{name}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-[11px] text-muted-foreground">{due}</span>
        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", t.tag, t.tagText)}>
          {t.tagText}
        </span>
      </div>
    </li>
  );
}
