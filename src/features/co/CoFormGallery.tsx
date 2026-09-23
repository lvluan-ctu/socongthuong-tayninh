import { useState, useMemo } from "react";
import { Search, FileText, Download, Eye, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CO_FORMS, CO_FTA_MAP } from "@/lib/co/co-constants";
import type { CoForm } from "@/lib/co/co-types";

interface CoFormGalleryProps {
  onSelectForm: (formCode: string) => void;
}

type FilterType = "all" | "preferential" | "non-preferential";

export function CoFormGallery({ onSelectForm }: CoFormGalleryProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const filtered = useMemo(() => {
    let result = CO_FORMS;
    if (filter === "preferential") result = result.filter((f) => f.isPreferential);
    if (filter === "non-preferential") result = result.filter((f) => !f.isPreferential);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (f) =>
          f.code.toLowerCase().includes(q) ||
          f.name.toLowerCase().includes(q) ||
          f.description?.toLowerCase().includes(q) ||
          f.ftaCode?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [search, filter]);

  const preferentialCount = CO_FORMS.filter((f) => f.isPreferential).length;
  const nonPreferentialCount = CO_FORMS.filter((f) => !f.isPreferential).length;

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-navy">
            {CO_FORMS.length} mẫu C/O — {preferentialCount} ưu đãi, {nonPreferentialCount} không ưu đãi
          </p>
          <p className="text-xs text-muted-foreground">
            Theo Thông tư 26/2026/TT-BCT — Phân cấp mẫu 17 (Cục XNK) & mẫu 18 (UBND cấp tỉnh)
          </p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm mã mẫu, tên, FTA..."
            className="w-full rounded-md border border-border bg-surface pl-9 pr-3 py-2 text-sm text-navy placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gov/30"
          />
        </div>
        <div className="flex gap-1">
          {([
            { key: "all", label: `Tất cả (${CO_FORMS.length})` },
            { key: "preferential", label: `Ưu đãi (${preferentialCount})` },
            { key: "non-preferential", label: `Không ưu đãi (${nonPreferentialCount})` },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                filter === f.key
                  ? "border-gov/40 bg-gov/10 text-gov"
                  : "border-border bg-surface text-muted-foreground hover:border-gov/20"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((form) => (
          <FormCard key={form.code} form={form} onSelect={onSelectForm} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-8">
          Không tìm thấy mẫu C/O phù hợp
        </p>
      )}
    </div>
  );
}

function FormCard({
  form,
  onSelect,
}: {
  form: CoForm;
  onSelect: (code: string) => void;
}) {
  const fta = form.ftaCode ? CO_FTA_MAP.get(form.ftaCode) : null;
  const hasPdf = !!form.pdfUrl;

  return (
    <div
      className={`group relative rounded-lg border bg-surface p-4 transition-all hover:shadow-md ${
        hasPdf
          ? "cursor-pointer border-border hover:border-gov/40"
          : "border-border/50 opacity-70"
      }`}
      onClick={() => hasPdf && onSelect(form.code)}
    >
      {/* Badge ưu đãi/không ưu đãi */}
      <div className="flex items-start justify-between mb-2">
        <Badge
          variant="outline"
          className={`rounded-md text-[10px] font-medium ${
            form.isPreferential
              ? "border-success/30 bg-success/10 text-success"
              : "border-muted bg-muted/10 text-muted-foreground"
          }`}
        >
          {form.isPreferential ? "Ưu đãi" : "Không ưu đãi"}
        </Badge>
        {hasPdf && (
          <Eye className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>

      {/* Mã mẫu */}
      <p className="text-2xl font-bold text-gov font-mono mb-1">{form.code}</p>

      {/* Tên mẫu */}
      <p className="text-sm font-medium text-navy mb-1">{form.name}</p>

      {/* FTA */}
      {fta && (
        <p className="text-xs text-muted-foreground mb-2">
          {fta.shortName} — {fta.name}
        </p>
      )}

      {/* Mô tả */}
      {form.description && (
        <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3">
          {form.description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto">
        <div className="flex flex-wrap gap-1">
          {form.originCriteria.slice(0, 3).map((c) => (
            <Badge key={c} variant="outline" className="rounded text-[9px] px-1">
              {c}
            </Badge>
          ))}
          {form.originCriteria.length > 3 && (
            <Badge variant="outline" className="rounded text-[9px] px-1">
              +{form.originCriteria.length - 3}
            </Badge>
          )}
        </div>
        {hasPdf ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(form.code);
            }}
          >
            <FileText className="size-3 mr-1" /> Xem
          </Button>
        ) : (
          <span className="text-[10px] text-muted-foreground italic">Chưa có PDF</span>
        )}
      </div>
    </div>
  );
}
