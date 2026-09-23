import type { ReactNode } from "react";
import { Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FilterDef {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}

export function FilterBar({ filters, children }: { filters: FilterDef[]; children?: ReactNode }) {
  return (
    <div className="gov-card flex flex-wrap items-end gap-3 p-3">
      <span className="flex items-center gap-1.5 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Filter className="size-3.5" /> Bộ lọc
      </span>
      {filters.map((f) => (
        <label key={f.label} className="flex min-w-40 flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{f.label}</span>
          <Select value={f.value} onValueChange={f.onChange}>
            <SelectTrigger className="h-9 bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {f.options.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      ))}
      {children ? <div className="flex items-center gap-2 pb-0.5">{children}</div> : null}
    </div>
  );
}
