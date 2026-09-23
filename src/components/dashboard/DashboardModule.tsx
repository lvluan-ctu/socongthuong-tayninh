import type { ReactNode } from "react";
import { Link } from "@/lib/router-compat";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type ModuleTone =
  "blue" | "teal" | "cyan" | "green" | "indigo" | "orange" | "emerald" | "slate";

interface ToneDef {
  header: string;
  border: string;
  hover: string;
  action: string;
}

export const MODULE_TONE: Record<ModuleTone, ToneDef> = {
  blue: {
    header: "bg-gov/10 text-gov",
    border: "border-gov/20",
    hover: "hover:border-gov/50",
    action: "text-gov hover:bg-gov/5",
  },
  teal: {
    header: "bg-teal/10 text-teal",
    border: "border-teal/20",
    hover: "hover:border-teal/50",
    action: "text-teal hover:bg-teal/5",
  },
  cyan: {
    header: "bg-cyan-50 text-cyan-700",
    border: "border-cyan-200",
    hover: "hover:border-cyan-400",
    action: "text-cyan-700 hover:bg-cyan-50",
  },
  green: {
    header: "bg-emerald-50 text-emerald-700",
    border: "border-emerald-200",
    hover: "hover:border-emerald-400",
    action: "text-emerald-700 hover:bg-emerald-50",
  },
  indigo: {
    header: "bg-indigo-50 text-indigo-700",
    border: "border-indigo-200",
    hover: "hover:border-indigo-400",
    action: "text-indigo-700 hover:bg-indigo-50",
  },
  orange: {
    header: "bg-orange-50 text-orange-700",
    border: "border-orange-200",
    hover: "hover:border-orange-400",
    action: "text-orange-700 hover:bg-orange-50",
  },
  emerald: {
    header: "bg-teal/10 text-teal",
    border: "border-teal/20",
    hover: "hover:border-teal/50",
    action: "text-teal hover:bg-teal/5",
  },
  slate: {
    header: "bg-slate-100 text-slate-700",
    border: "border-slate-200",
    hover: "hover:border-slate-400",
    action: "text-slate-700 hover:bg-slate-50",
  },
};

export function DashboardModule({
  title,
  subtitle,
  icon: Icon,
  tone = "blue",
  to,
  actionLabel,
  headerExtra,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  tone?: ModuleTone;
  to?: string;
  actionLabel?: string;
  headerExtra?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const t = MODULE_TONE[tone];

  const content = (
    <>
      <header className={cn("flex items-center gap-2 border-b px-4 py-2.5", t.header, t.border)}>
        <Icon className="size-4 shrink-0" strokeWidth={1.9} />
        <div className="min-w-0">
          <h3 className="truncate text-xs font-bold uppercase tracking-wide">{title}</h3>
          {subtitle ? <p className="truncate text-[11px] opacity-75">{subtitle}</p> : null}
        </div>
        {headerExtra ? <span className="ml-auto shrink-0">{headerExtra}</span> : null}
      </header>

      <div className="flex flex-1 flex-col gap-3 p-4">{children}</div>

      {to && actionLabel ? (
        <div
          className={cn(
            "flex items-center justify-between border-t px-4 py-2 text-xs font-semibold",
            t.border,
            t.action,
          )}
        >
          {actionLabel}
          <ArrowRight className="size-3.5" />
        </div>
      ) : null}
    </>
  );

  const cardClass = cn(
    "gov-card flex flex-col overflow-hidden transition-shadow",
    t.hover,
    className,
  );

  if (to) {
    return (
      <Link to={to as never} className={cardClass}>
        {content}
      </Link>
    );
  }

  return <div className={cardClass}>{content}</div>;
}

export function KpiMiniCard({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate text-xl font-semibold tabular-nums text-navy",
          valueClassName,
        )}
      >
        {value}
      </p>
    </div>
  );
}
