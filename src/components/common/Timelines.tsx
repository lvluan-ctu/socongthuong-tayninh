import { cn } from "@/lib/utils";
import { CheckCircle2, Circle } from "lucide-react";

export interface TimelineEntry {
  actor: string;
  role: string;
  action: string;
  time: string;
}

export function ApprovalTimeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {entries.map((e, i) => (
        <li key={`${e.actor}-${e.time}`} className="relative">
          <span className="absolute -left-[27px] top-0.5 flex size-4 items-center justify-center rounded-full bg-card">
            {i === entries.length - 1 ? (
              <Circle className="size-4 text-gov" strokeWidth={2} />
            ) : (
              <CheckCircle2 className="size-4 text-success" strokeWidth={2} />
            )}
          </span>
          <p className="text-sm font-medium text-foreground">{e.action}</p>
          <p className="text-xs text-muted-foreground">
            {e.actor} · {e.role} · {e.time}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function ActivityTimeline({
  items,
}: {
  items: { title: string; time: string; tone?: string }[];
}) {
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.title} className="flex gap-3">
          <span className={cn("mt-1.5 size-2 shrink-0 rounded-full bg-gov", i.tone)} />
          <div>
            <p className="text-sm text-foreground">{i.title}</p>
            <p className="text-xs text-muted-foreground">{i.time}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
