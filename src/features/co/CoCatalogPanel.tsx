import { useState } from "react";
import { Globe2, FileCheck2, Hash, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ChartCard } from "@/components/common/ChartCard";
import { DataTable, type Column } from "@/components/common/DataTable";
import { CoFormGallery } from "@/features/co/CoFormGallery";
import { CoFormDetail } from "@/features/co/CoFormDetail";
import {
  CO_FTA,
  CO_FORMS,
  CO_HS_CODES,
  CO_ORIGIN_CRITERIA,
  CO_COUNTRIES,
  CO_LEGAL_BASIS,
} from "@/lib/co/co-constants";
import type { CoFta, CoHsCode, CoOriginCriterion, CoCountry } from "@/lib/co/co-types";

type CatalogTab = "fta" | "forms" | "form-detail" | "hs" | "criteria" | "countries" | "legal";

const TABS: { key: CatalogTab; label: string; icon: typeof Globe2; count?: number }[] = [
  { key: "fta", label: "Hiệp định (FTA)", icon: Globe2, count: CO_FTA.length },
  { key: "forms", label: "Mẫu C/O", icon: FileCheck2, count: CO_FORMS.length },
  { key: "hs", label: "Mã HS", icon: Hash, count: CO_HS_CODES.length },
  { key: "criteria", label: "Tiêu chí XX", icon: Scale, count: CO_ORIGIN_CRITERIA.length },
  { key: "countries", label: "Quốc gia", icon: Globe2, count: CO_COUNTRIES.length },
  { key: "legal", label: "Căn cứ PL", icon: Scale, count: CO_LEGAL_BASIS.length },
];

export function CoCatalogPanel() {
  const [activeTab, setActiveTab] = useState<CatalogTab>("fta");
  const [selectedFormCode, setSelectedFormCode] = useState<string | null>(null);

  const ftaColumns: Column<CoFta>[] = [
    { key: "code", header: "Mã", render: (r) => <span className="font-mono text-xs font-medium">{r.code}</span> },
    { key: "shortName", header: "Tên ngắn", render: (r) => <span className="text-xs font-medium">{r.shortName}</span> },
    {
      key: "name",
      header: "Tên đầy đủ",
      render: (r) => <span className="text-xs max-w-[200px] truncate block" title={r.name}>{r.name}</span>,
    },
    { key: "region", header: "Khu vực", render: (r) => <Badge variant="outline" className="rounded-md text-[11px]">{r.region}</Badge> },
    { key: "members", header: "TV", render: (r) => <span className="text-xs">{r.members.length} quốc gia</span> },
    { key: "status", header: "Trạng thái", render: (r) => (
      <Badge variant="outline" className={`rounded-md text-[11px] ${r.status === "active" ? "border-success/30 bg-success/10 text-success" : "border-muted bg-muted/10 text-muted-foreground"}`}>
        {r.status === "active" ? "Hiệu lực" : "Chưa HL"}
      </Badge>
    )},
  ];

  const hsColumns: Column<CoHsCode>[] = [
    { key: "code", header: "Mã HS", render: (r) => <span className="font-mono text-xs font-medium">{r.code}</span> },
    { key: "nameVi", header: "Tên hàng", render: (r) => <span className="text-xs">{r.nameVi}</span> },
    { key: "unit", header: "ĐVT", render: (r) => <span className="text-xs">{r.unit}</span> },
    { key: "chapter", header: "Chương", render: (r) => <span className="text-xs">{r.chapter}</span> },
  ];

  const criteriaColumns: Column<CoOriginCriterion>[] = [
    { key: "code", header: "Mã", render: (r) => <span className="font-mono text-xs font-bold text-gov">{r.code}</span> },
    { key: "name", header: "Tên", render: (r) => <span className="text-xs font-medium">{r.name}</span> },
    { key: "nameVi", header: "Mô tả VN", render: (r) => <span className="text-xs">{r.nameVi}</span> },
    { key: "appliesTo", header: "Áp dụng", render: (r) => <span className="text-xs">{r.appliesTo.length} FTA</span> },
  ];

  const countryColumns: Column<CoCountry>[] = [
    { key: "code", header: "Mã", render: (r) => <span className="font-mono text-xs font-medium">{r.code}</span> },
    { key: "name", header: "Tên", render: (r) => <span className="text-xs font-medium">{r.name}</span> },
    { key: "nameEn", header: "English", render: (r) => <span className="text-xs text-muted-foreground">{r.nameEn}</span> },
    { key: "region", header: "Khu vực", render: (r) => <Badge variant="outline" className="rounded-md text-[11px]">{r.region}</Badge> },
    { key: "isAsean", header: "ASEAN", render: (r) => r.isAsean ? <Badge variant="outline" className="rounded-md text-[11px] border-success/30 bg-success/10 text-success">✓</Badge> : <span className="text-muted-foreground">—</span> },
    { key: "isEu", header: "EU", render: (r) => r.isEu ? <Badge variant="outline" className="rounded-md text-[11px] border-info/30 bg-info/10 text-info">✓</Badge> : <span className="text-muted-foreground">—</span> },
  ];

  return (
    <div className="space-y-4">
      {/* Tab selector */}
      {activeTab !== "form-detail" && (
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === t.key
                    ? "border-gov/40 bg-gov/10 text-gov"
                    : "border-border bg-surface text-muted-foreground hover:border-gov/20"
                }`}
              >
                <Icon className="size-3.5" />
                {t.label}
                {t.count !== undefined && (
                  <Badge variant="outline" className="ml-1 rounded-full text-[10px] px-1.5">
                    {t.count}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* FTA */}
      {activeTab === "fta" && (
        <ChartCard title="Hiệp định thương mại tự do (FTA)" subtitle={`${CO_FTA.length} hiệp định đang quản lý`}>
          <DataTable columns={ftaColumns} rows={CO_FTA.map(f => ({ ...f, id: f.code }))} searchPlaceholder="Tìm FTA..." />
        </ChartCard>
      )}

      {/* Forms — Gallery */}
      {activeTab === "forms" && (
        <CoFormGallery
          onSelectForm={(code) => {
            setSelectedFormCode(code);
            setActiveTab("form-detail");
          }}
        />
      )}

      {/* Form Detail — PDF viewer */}
      {activeTab === "form-detail" && selectedFormCode && (
        <CoFormDetail
          formCode={selectedFormCode}
          onBack={() => {
            setActiveTab("forms");
            setSelectedFormCode(null);
          }}
        />
      )}

      {/* HS Codes */}
      {activeTab === "hs" && (
        <ChartCard title="Mã HS" subtitle={`${CO_HS_CODES.length} mã HS đang quản lý`}>
          <DataTable columns={hsColumns} rows={CO_HS_CODES.map(h => ({ ...h, id: h.code }))} searchPlaceholder="Tìm mã HS, tên hàng..." />
        </ChartCard>
      )}

      {/* Criteria */}
      {activeTab === "criteria" && (
        <ChartCard title="Tiêu chí xuất xứ (Origin Criteria)" subtitle={`${CO_ORIGIN_CRITERIA.length} tiêu chí theo TT 40/2025/TT-BCT`}>
          <DataTable columns={criteriaColumns} rows={CO_ORIGIN_CRITERIA.map(c => ({ ...c, id: c.code }))} searchPlaceholder="Tìm tiêu chí..." />
        </ChartCard>
      )}

      {/* Countries */}
      {activeTab === "countries" && (
        <ChartCard title="Quốc gia" subtitle={`${CO_COUNTRIES.length} quốc gia trong danh mục`}>
          <DataTable columns={countryColumns} rows={CO_COUNTRIES.map(c => ({ ...c, id: c.code }))} searchPlaceholder="Tìm quốc gia..." />
        </ChartCard>
      )}

      {/* Legal */}
      {activeTab === "legal" && (
        <ChartCard title="Căn cứ pháp lý" subtitle={`${CO_LEGAL_BASIS.length} văn bản`}>
          <div className="space-y-2">
            {CO_LEGAL_BASIS.map((l, i) => (
              <div key={i} className="rounded-md border border-border bg-surface p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-navy">{l.number}</p>
                    <p className="text-xs text-muted-foreground">{l.name}</p>
                  </div>
                  <Badge variant="outline" className="rounded-md text-[10px]">{l.type}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{l.description}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Ngày: {l.date}</p>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}
