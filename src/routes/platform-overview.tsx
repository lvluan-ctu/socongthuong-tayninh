import { createFileRoute } from "@/lib/router-compat";
import { ArrowRight, Database, LayoutGrid, Layers, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { ModuleCard } from "@/components/common/ModuleCard";
import { ChartCard } from "@/components/common/ChartCard";
import { PLATFORM_MODULES } from "@/lib/nav";
import { ARCHITECTURE_LAYERS, PLATFORM_PRINCIPLES } from "@/data/mock";

export const Route = createFileRoute("/platform-overview")({
  head: () => ({
    meta: [
      { title: "Kiến trúc nền tảng số hóa dữ liệu ngành Công Thương" },
      {
        name: "description",
        content:
          "Sơ đồ kiến trúc 5 lớp, nguyên tắc dữ liệu dùng chung và danh mục 12 phân hệ nghiệp vụ của nền tảng.",
      },
      { property: "og:title", content: "Kiến trúc nền tảng số hóa dữ liệu ngành Công Thương" },
      {
        property: "og:description",
        content: "Kiến trúc 5 lớp, nguyên tắc dữ liệu và bản đồ phân hệ nghiệp vụ.",
      },
    ],
  }),
  component: PlatformOverview,
});

const LAYER_ICONS = [Database, Layers, ShieldCheck, LayoutGrid, ArrowRight];

function PlatformOverview() {
  return (
    <>
      <PageHeader
        title="Tổng quan nền tảng"
        description="Nền tảng số hóa dữ liệu ngành Công Thương được thiết kế theo kiến trúc 5 lớp, dữ liệu chuẩn hóa một lần – dùng chung nhiều nơi."
        crumbs={[{ label: "Điều hành" }, { label: "Tổng quan nền tảng" }]}
      />

      <div className="space-y-5 p-4 sm:p-6">
        <section className="gov-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
            Kiến trúc tổng thể
          </h2>
          <div className="mt-4 overflow-hidden rounded-md border border-border bg-white">
            <img
              src="/img/Nen tang tong the chi tiet.png"
              alt="Sơ đồ kiến trúc tổng thể nền tảng số hóa dữ liệu ngành Công Thương"
              className="h-auto w-full"
              loading="lazy"
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Sơ đồ kiến trúc tổng thể 5 lớp. Chi tiết từng lớp mô tả bên dưới:
          </p>
          <div className="mt-4 space-y-2">
            {ARCHITECTURE_LAYERS.map((l, i) => {
              const Icon = LAYER_ICONS[i]!;
              return (
                <div
                  key={l.name}
                  className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4 md:flex-row md:items-center"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-navy/10">
                    <Icon className="size-5 text-navy" strokeWidth={1.75} />
                  </span>
                  <div className="md:w-56 md:shrink-0">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Lớp {i + 1}
                    </p>
                    <p className="font-semibold text-navy">{l.name}</p>
                  </div>
                  <p className="flex-1 text-sm text-muted-foreground">{l.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {l.items.map((it) => (
                      <span
                        key={it}
                        className="rounded border border-gov/25 bg-gov/5 px-2 py-0.5 text-[11px] font-medium text-gov"
                      >
                        {it}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {PLATFORM_PRINCIPLES.map((p) => (
            <ChartCard key={p.title} title={p.title}>
              <p className="text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
            </ChartCard>
          ))}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-navy">
            Bản đồ phân hệ nghiệp vụ
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {PLATFORM_MODULES.map((m) => (
              <ModuleCard key={m.code} {...m} />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
