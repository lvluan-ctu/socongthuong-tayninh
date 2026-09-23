import { Badge } from "@/components/ui/badge";
import { WORKFLOW_STATUS_LABEL } from "@/lib/grid-types";
import type { WorkflowStatus } from "@/lib/grid-types";
import { cn } from "@/lib/utils";

export function WorkflowStatusBadge({ status }: { status: WorkflowStatus }) {
  const tone =
    status === "APPROVED"
      ? "border-success/30 bg-success/10 text-success"
      : status === "PENDING"
        ? "border-warning/40 bg-warning/15 text-warning"
        : status === "RETURNED"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-border bg-surface text-muted-foreground";
  return (
    <Badge variant="outline" className={cn("rounded-md font-medium", tone)}>
      {WORKFLOW_STATUS_LABEL[status]}
    </Badge>
  );
}
