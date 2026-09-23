import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FIELD_LABELS,
  type BusinessField,
  type BusinessStatus,
  type BusinessType,
} from "@/lib/market-types";
import { cn } from "@/lib/utils";

const FIELD_OPTIONS: { value: BusinessField | "all"; label: string }[] = [
  { value: "all", label: "Tất cả lĩnh vực" },
  ...Object.entries(FIELD_LABELS).map(([v, l]) => ({
    value: v as BusinessField,
    label: l,
  })),
];

const STATUS_OPTIONS: { value: BusinessStatus | "all"; label: string }[] = [
  { value: "all", label: "Tất cả trạng thái" },
  { value: "active", label: "Đang hoạt động" },
  { value: "suspended", label: "Tạm ngừng" },
  { value: "expired", label: "Hết hạn" },
];

const TYPE_OPTIONS: { value: BusinessType | "all"; label: string }[] = [
  { value: "all", label: "Tất cả loại hình" },
  { value: "company", label: "Doanh nghiệp" },
  { value: "household", label: "Hộ kinh doanh" },
];

const DISTRICT_OPTIONS = [
  "Tất cả địa bàn",
  "TP. Tây Ninh",
  "Trảng Bàng",
  "Gò Dầu",
  "Bến Cầu",
  "Tân Biên",
  "Châu Thành",
  "Hòa Thành",
  "Tân Châu",
  "Dương Minh Châu",
  "Tân Ninh",
];

export interface BusinessFilterState {
  search: string;
  field: BusinessField | "all";
  status: BusinessStatus | "all";
  type: BusinessType | "all";
  district: string;
}

export function BusinessFilters({
  filters,
  onChange,
  total,
  filtered,
}: {
  filters: BusinessFilterState;
  onChange: (f: BusinessFilterState) => void;
  total: number;
  filtered: number;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Tìm tên doanh nghiệp, MST, người đại diện..."
            className="h-9 pl-8 text-xs"
          />
        </div>
        <Badge
          variant="outline"
          className="gap-1 rounded-md border-gov/25 bg-gov/5 font-medium text-gov"
        >
          {filtered}/{total} thực thể
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filters.field}
          onChange={(e) => onChange({ ...filters, field: e.target.value as BusinessField | "all" })}
          className="h-8 rounded-md border border-border bg-card px-2.5 text-xs outline-none focus:border-gov"
        >
          {FIELD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={(e) => onChange({ ...filters, status: e.target.value as BusinessStatus | "all" })}
          className="h-8 rounded-md border border-border bg-card px-2.5 text-xs outline-none focus:border-gov"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={filters.type}
          onChange={(e) => onChange({ ...filters, type: e.target.value as BusinessType | "all" })}
          className="h-8 rounded-md border border-border bg-card px-2.5 text-xs outline-none focus:border-gov"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={filters.district}
          onChange={(e) => onChange({ ...filters, district: e.target.value })}
          className="h-8 rounded-md border border-border bg-card px-2.5 text-xs outline-none focus:border-gov"
        >
          {DISTRICT_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        {(filters.field !== "all" ||
          filters.status !== "all" ||
          filters.type !== "all" ||
          filters.district !== "Tất cả địa bàn") && (
          <button
            type="button"
            onClick={() =>
              onChange({
                search: filters.search,
                field: "all",
                status: "all",
                type: "all",
                district: "Tất cả địa bàn",
              })
            }
            className="h-8 rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-navy"
          >
            Xóa bộ lọc
          </button>
        )}
      </div>
    </div>
  );
}
