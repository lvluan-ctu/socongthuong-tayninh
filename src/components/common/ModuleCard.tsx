import { Link } from "@/lib/router-compat";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONE_BG, TONE_TEXT, type Tone } from "./StatCard";

export function ModuleCard({
  code,
  name,
  items,
  icon: Icon,
  tone = "gov",
  to,
  onClick,
}: {
  code?: string;
  name: string;
  items?: string[];
  icon: LucideIcon;
  tone?: Tone;
  to?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className="flex items-start gap-3">
        <span className={cn("flex size-11 items-center justify-center rounded-md", TONE_BG[tone])}>
          <Icon className={cn("size-6", TONE_TEXT[tone])} strokeWidth={1.6} />
        </span>
        <div className="min-w-0">
          {code ? (
            <span className={cn("text-xs font-bold tracking-widest", TONE_TEXT[tone])}>
              MODULE {code}
            </span>
          ) : null}
          <h3 className="text-base font-semibold text-navy">{name}</h3>
        </div>
      </div>
      {items?.length ? (
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          {items.slice(0, 6).map((i) => (
            <li key={i} className="flex gap-2">
              <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", TONE_BG[tone])} />
              {i}
            </li>
          ))}
        </ul>
      ) : null}
      <span
        className={cn("mt-4 inline-flex items-center gap-1 text-sm font-medium", TONE_TEXT[tone])}
      >
        Xem chi tiết <ArrowRight className="size-4" />
      </span>
    </>
  );

  const cls =
    "gov-card block p-4 text-left transition-colors hover:border-gov/50 hover:shadow-panel";

  if (onClick) {
    return (
      <button onClick={onClick} className={cn(cls, "w-full")}>
        {body}
      </button>
    );
  }
  return (
    <Link to={(to ?? "/") as "/"} className={cls}>
      {body}
    </Link>
  );
}
