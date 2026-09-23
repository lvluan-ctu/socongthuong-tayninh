import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL } from "@/lib/constants";
import type { DataStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONE: Record<DataStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  checking: "bg-info/10 text-info border-info/30",
  need_more: "bg-warning/15 text-warning border-warning/40",
  pending: "bg-gov/10 text-gov border-gov/30",
  approved: "bg-success/10 text-success border-success/30",
  locked: "bg-navy/10 text-navy border-navy/25",
  published: "bg-teal/10 text-teal border-teal/30",
  error: "bg-destructive/10 text-destructive border-destructive/30",
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: DataStatus;
  label?: string;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("rounded-md font-medium", TONE[status], className)}>
      {label ?? STATUS_LABEL[status]}
    </Badge>
  );
}
