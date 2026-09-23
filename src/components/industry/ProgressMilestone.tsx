"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Clock, AlertTriangle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DocumentAttachmentItem } from "@/components/industry/DocumentAttachmentItem";
import type { InvestmentMilestone, InvestmentMilestoneStatus } from "@/lib/industrial-clusters/industrial-cluster-types";
import { MILESTONE_STATUS_LABELS } from "@/lib/industrial-clusters/industrial-cluster-types";

interface ProgressMilestoneProps {
  milestone: InvestmentMilestone;
  onUpdate?: (data: Partial<InvestmentMilestone>) => void;
  readOnly?: boolean;
}

export function ProgressMilestone({ milestone, onUpdate, readOnly = false }: ProgressMilestoneProps) {
  const [expanded, setExpanded] = useState(false);
  const statusLabel = MILESTONE_STATUS_LABELS[milestone.status];

  const statusColors: Record<InvestmentMilestoneStatus, string> = {
    NOT_STARTED: "border-muted bg-muted/10 text-muted-foreground",
    IN_PROGRESS: "border-gov/30 bg-gov/10 text-gov",
    COMPLETED: "border-success/30 bg-success/10 text-success",
    DELAYED: "border-destructive/30 bg-destructive/10 text-destructive",
  };

  return (
    <Card className={`border-l-4 ${statusColors[milestone.status]}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 p-0"
              onClick={() => setExpanded(!expanded)}
              disabled={readOnly}
              aria-label={expanded ? "Thu gọn" : "Mở rộng"}
            >
              {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-gov text-sm">{milestone.code}</span>
                <span className="font-medium text-navy truncate">{milestone.name}</span>
                <Badge variant="outline" className={`rounded-full text-[10px] ${statusColors[milestone.status]}`}>
                  {MILESTONE_STATUS_LABELS[milestone.status].label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{milestone.plannedDate} → {milestone.actualDate ?? "Chưa có"}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono tabular-nums text-navy">{milestone.progressPercent}%</span>
              {milestone.status === "COMPLETED" && <CheckCircle2 className="size-4 text-success" />}
              {milestone.status === "DELAYED" && <AlertTriangle className="size-4 text-destructive" />}
              {milestone.status === "IN_PROGRESS" && <Loader2 className="size-4 text-gov animate-spin" />}
              {milestone.status === "NOT_STARTED" && <XCircle className="size-4 text-muted-foreground" />}
            </div>
          </div>
        </div>
        </CardHeader>

        <CardContent className="pt-0">
          <Progress value={milestone.progressPercent} className="h-2 mb-3" color={milestone.status === "COMPLETED" ? "success" : milestone.status === "IN_PROGRESS" ? "gov" : milestone.status === "DELAYED" ? "destructive" : "muted"} />
          
          <div className="grid grid-cols-2 gap-3 text-xs mb-3">
            <div className="rounded border border-border bg-surface p-2">
              <p className="text-muted-foreground">Kế hoạch</p>
              <p className="font-medium">{milestone.plannedDate}</p>
            </div>
            <div className="rounded border border-border bg-surface p-2">
              <p className="text-muted-foreground">Thực tế</p>
              <p className="font-medium">{milestone.actualDate ?? "—"}</p>
            </div>
          </div>

          {milestone.notes && (
            <p className="text-sm text-muted-foreground mb-3">{milestone.notes}</p>
          )}

          {milestone.attachments.length > 0 && (
            <div className="space-y-2 mb-3">
              <p className="text-xs font-medium text-muted-foreground">Tài liệu đính kèm ({milestone.attachments.length})</p>
              {milestone.attachments.map((doc) => (
                <DocumentAttachmentItem key={doc.id} document={doc} readOnly />
              ))}
            </div>
          )}

          {!readOnly && onUpdate && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
              <Badge variant="outline" className="rounded-full text-[10px] cursor-pointer" onClick={() => onUpdate({ progressPercent: 100, status: "COMPLETED", actualDate: new Date().toISOString().split("T")[0] })}>
                <CheckCircle2 className="size-3 mr-1" /> Hoàn thành
              </Badge>
              <Badge variant="outline" className="rounded-full text-[10px] cursor-pointer" onClick={() => onUpdate({ progressPercent: 50, status: "IN_PROGRESS" })}>
                <Loader2 className="size-3 mr-1" /> Đang thực hiện
              </Badge>
              <Badge variant="outline" className="rounded-full text-[10px] cursor-pointer" onClick={() => onUpdate({ status: "DELAYED" })}>
                <AlertTriangle className="size-3 mr-1" /> Chậm tiến độ
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
  );
}