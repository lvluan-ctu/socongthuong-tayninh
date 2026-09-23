import { Factory, Landmark, Ship, ShoppingCart, Handshake, MapPin } from "lucide-react";
import { SectionHeader } from "@/components/public/SectionHeader";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES: { name: string; icon: LucideIcon; grad: string }[] = [
  { name: "Công nghiệp", icon: Factory, grad: "from-gov to-sky-500" },
  { name: "Năng lượng", icon: Landmark, grad: "from-amber-500 to-orange-500" },
  { name: "Thương mại", icon: ShoppingCart, grad: "from-teal-500 to-emerald-500" },
  { name: "Xuất nhập khẩu", icon: Ship, grad: "from-violet-600 to-fuchsia-500" },
  { name: "Xúc tiến thương mại", icon: Handshake, grad: "from-rose-500 to-pink-500" },
  { name: "Khu/Cụm công nghiệp", icon: MapPin, grad: "from-slate-800 to-navy" },
];

export function IndustryCategories({
  active,
  onChange,
}: {
  active: string | null;
  onChange: (name: string) => void;
}) {
  return (
    <section id="linh-vuc" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <SectionHeader
        eyebrow="Tra cứu theo chuyên mục"
        title="Lĩnh vực ngành Công Thương"
        description="Chọn một lĩnh vực để xem nhanh các tin tức và nội dung liên quan."
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {CATEGORIES.map((c) => {
          const selected = active === c.name;
          return (
            <button
              key={c.name}
              type="button"
              onClick={() => onChange(c.name)}
              className={cn(
                "group flex flex-col items-center gap-3 rounded-3xl border border-border bg-white p-5 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg",
                selected && "border-gov ring-2 ring-gov/30",
              )}
            >
              <span
                className={cn(
                  "grid size-12 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-sm transition-transform group-hover:scale-110",
                  c.grad,
                )}
              >
                <c.icon className="size-6" strokeWidth={1.8} />
              </span>
              <span className="text-sm font-semibold leading-tight text-navy">{c.name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
