"use client";

import { Download, FileText, Eye, Trash2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DocumentAttachment, DocumentType } from "@/lib/industrial-clusters/industrial-cluster-types";
import { DOCUMENT_TYPE_LABELS } from "@/lib/industrial-clusters/industrial-cluster-types";

interface DocumentAttachmentItemProps {
  document: DocumentAttachment;
  readOnly?: boolean;
  onDelete?: (id: string) => void;
  onDownload?: (url: string, name: string) => void;
  onView?: (url: string) => void;
}

export function DocumentAttachmentItem({ document, readOnly = false, onDelete, onDownload, onView }: DocumentAttachmentItemProps) {
  const getFileIcon = (url: string) => {
    const ext = url.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf": return "📄";
      case "doc":
      case "docx": return "📝";
      case "xls":
      case "xlsx": return "📊";
      case "jpg":
      case "jpeg":
      case "png": return "🖼️";
      default: return "📎";
    }
  };

  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-surface p-2.5">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="size-8 flex items-center justify-center text-lg">{getFileIcon(document.url)}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-navy truncate">{document.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className="rounded-full text-[10px] border-gov/30 bg-gov/10 text-gov">
              {DOCUMENT_TYPE_LABELS[document.type] ?? document.type}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {document.size ? `${(document.size / 1024).toFixed(1)} KB` : "—"}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {new Date(document.uploadedAt).toLocaleDateString("vi-VN")}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 ml-2">
        {onView && (
          <Button variant="ghost" size="icon" className="size-7" onClick={() => onView?.(document.url)} title="Xem">
            <Eye className="size-3.5" />
          </Button>
        )}
        {onDownload && (
          <Button variant="ghost" size="icon" className="size-7" onClick={() => onDownload?.(document.url, document.name)} title="Tải về">
            <Download className="size-3.5" />
          </Button>
        )}
        {!readOnly && onDelete && (
          <Button variant="ghost" size="icon" className="size-7 text-destructive hover:bg-destructive/10" onClick={() => onDelete?.(document.id)} title="Xóa">
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}