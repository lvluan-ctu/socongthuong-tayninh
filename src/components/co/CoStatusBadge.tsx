import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CO_STATUS_LABELS, CO_STATUS_COLORS, type CoApplicationStatus } from "@/lib/co/co-types";

interface CoStatusBadgeProps {
  status: CoApplicationStatus;
  className?: string;
}

export function CoStatusBadge({ status, className }: CoStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("rounded-md font-medium text-[11px]", CO_STATUS_COLORS[status], className)}
    >
      {CO_STATUS_LABELS[status]}
    </Badge>
  );
}
