import { useState, useMemo } from "react";
import { Search, Scale, TrendingDown, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChartCard } from "@/components/common/ChartCard";
import { DataTable, type Column } from "@/components/common/DataTable";
import { calculateTaxComparison, formatCurrency } from "@/lib/co/co-service";
import { searchHsCodes, CO_ORIGIN_CRITERIA, CO_FORMS_MAP, CO_FTA_MAP } from "@/lib/co/co-constants";
import type { CoHsCode } from "@/lib/co/co-types";

export function CoVerificationPanel() {
  const [hsQuery, setHsQuery] = useState("");
  const [selectedHs, setSelectedHs] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<CoHsCode[]>([]);

  const handleSearch = () => {
    if (!hsQuery.trim()) return;
    setSearchResults(searchHsCodes(hsQuery.trim()));
  };

  const comparison = useMemo(
    () => (selectedHs ? calculateTaxComparison(selectedHs) : null),
    [selectedHs],
  );

  const hsColumns: Column<CoHsCode>[] = [
    {
      key: "code",
      header: "Mã HS",
      render: (r) => <span className="font-mono text-xs font-medium">{r.code}</span>,
    },
    {
      key: "nameVi",
      header: "Tên hàng hóa",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-navy">{r.nameVi}</p>
          <p className="truncate text-[11px] text-muted-foreground">{r.nameEn}</p>
        </div>
      ),
    },
    { key: "unit", header: "ĐVT", render: (r) => <span className="text-xs">{r.unit}</span> },
    { key: "chapter", header: "Chương", render: (r) => <span className="text-xs">{r.chapter}</span> },
    {
      key: "code",
      header: "",
      render: (r) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedHs(r.code);
          }}
        >
          <Scale className="size-3 mr-1" /> So sánh thuế
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* HS Lookup */}
      <ChartCard title="Tra cứu mã HS" subtitle="Tìm kiếm mã HS và so sánh thuế suất">
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={hsQuery}
              onChange={(e) => setHsQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Nhập mã HS hoặc tên hàng hóa (vd: 40012100, cao su, áo thun)..."
              className="w-full rounded-md border border-border bg-surface pl-9 pr-3 py-2 text-sm text-navy placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gov/30"
            />
          </div>
          <Button onClick={handleSearch}>
            <Search className="size-4 mr-1.5" /> Tra cứu
          </Button>
        </div>
        {searchResults.length > 0 && (
          <DataTable columns={hsColumns} rows={searchResults.map(h => ({ ...h, id: h.code }))} />
        )}
        {hsQuery && searchResults.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Không tìm thấy mã HS phù hợp
          </p>
        )}
      </ChartCard>

      {/* Tax Comparison */}
      {comparison && (
        <ChartCard
          title={`So sánh thuế — ${comparison.hsCode}`}
          subtitle={comparison.description}
        >
          <div className="space-y-4">
            {/* MFN Rate */}
            <div className="rounded-md border border-border bg-surface p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-navy">Thuế suất MFN (không ưu đãi)</span>
                <span className="text-lg font-bold text-destructive">{comparison.mfnRate}%</span>
              </div>
            </div>

            {/* FTA Options */}
            {comparison.options.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Lựa chọn ưu đãi ({comparison.options.length} FTA áp dụng được)
                </p>
                {comparison.options.map((opt) => {
                  const form = CO_FORMS_MAP.get(opt.formCO);
                  const fta = CO_FTA_MAP.get(opt.fta);
                  const isBest = opt.fta === comparison.bestOption;
                  return (
                    <div
                      key={opt.fta}
                      className={`flex items-center justify-between rounded-md border p-3 ${
                        isBest
                          ? "border-success/40 bg-success/5"
                          : "border-border bg-surface"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isBest ? (
                          <CheckCircle2 className="size-4 text-success" />
                        ) : (
                          <TrendingDown className="size-4 text-muted-foreground" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-navy">
                            {fta?.shortName ?? opt.fta}
                            {isBest && (
                              <Badge variant="outline" className="ml-2 rounded-md text-[10px] border-success/30 bg-success/10 text-success">
                                Tốt nhất
                              </Badge>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Mẫu C/O: {opt.formCO} — {form?.name ?? opt.formCO}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-success">{opt.rate}%</p>
                        <p className="text-[11px] text-success font-medium">
                          Tiết kiệm {opt.savings}% (−{formatCurrency(opt.savings)})
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/5 p-3">
                <AlertCircle className="size-4 text-warning" />
                <p className="text-sm text-warning">Không có FTA nào áp dụng được cho mã HS này</p>
              </div>
            )}
          </div>
        </ChartCard>
      )}

      {/* Origin Criteria Reference */}
      <ChartCard
        title="Tiêu chí xuất xứ (Origin Criteria)"
        subtitle={`${CO_ORIGIN_CRITERIA.length} tiêu chí theo TT 40/2025/TT-BCT`}
      >
        <div className="space-y-2">
          {CO_ORIGIN_CRITERIA.map((c) => (
            <div
              key={c.code}
              className="rounded-md border border-border bg-surface p-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-navy">
                    <span className="font-mono text-gov">{c.code}</span> — {c.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.nameVi}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {c.appliesTo.slice(0, 4).map((f) => (
                    <Badge key={f} variant="outline" className="rounded-md text-[10px]">
                      {f}
                    </Badge>
                  ))}
                  {c.appliesTo.length > 4 && (
                    <Badge variant="outline" className="rounded-md text-[10px]">
                      +{c.appliesTo.length - 4}
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{c.description}</p>
              {c.formula && (
                <p className="mt-1 font-mono text-[11px] text-teal bg-teal/5 rounded px-2 py-1">
                  {c.formula}
                </p>
              )}
            </div>
          ))}
        </div>
      </ChartCard>
    </div>
  );
}
