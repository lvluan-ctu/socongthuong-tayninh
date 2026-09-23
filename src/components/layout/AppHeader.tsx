import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { Bell, CircleHelp, Landmark, Menu, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoleSwitcher } from "./RoleSwitcher";
import { useRole } from "@/lib/role-context";
import type { NavChild } from "@/lib/nav";

export function AppHeader({ onMenu }: { onMenu: () => void }) {
  const { navItems } = useRole();
  const [query, setQuery] = useState("");
  const results = query
    ? navItems
        .flatMap((i) => [
          { label: i.label, to: i.to },
          ...flattenNavChildren(i.label, i.children ?? []),
        ])
        .filter((r) => r.label.toLowerCase().includes(query.toLowerCase()))
    : [];

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-navy/40 bg-navy px-3 text-navy-foreground lg:px-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenu}
        className="text-white hover:bg-white/10 lg:hidden"
      >
        <Menu className="size-5" />
      </Button>

      <Link to="/" className="flex min-w-0 items-center gap-2.5">
        {/* Vùng placeholder cho logo/quốc huy — thay asset chính thức sau */}
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-white/25 bg-white/10">
          <Landmark className="size-5" strokeWidth={1.7} />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block text-[11px] font-semibold uppercase tracking-widest text-white/70">
            Sở Công Thương
          </span>
          <span className="hidden truncate text-sm font-semibold uppercase tracking-wide sm:block">
            Nền tảng số hóa dữ liệu ngành Công Thương
          </span>
        </span>
      </Link>

      <div className="relative ml-auto hidden w-72 md:block xl:w-96">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-white/60" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm kiếm toàn hệ thống..."
          className="h-9 border-white/20 bg-white/10 pl-8 text-white placeholder:text-white/60"
        />
        {results.length ? (
          <div className="absolute mt-1 w-full overflow-hidden rounded-md border border-border bg-card py-1 shadow-panel">
            {results.slice(0, 6).map((r) => (
              <Link
                key={r.to}
                to={r.to}
                onClick={() => setQuery("")}
                className="block px-3 py-2 text-sm text-foreground hover:bg-surface"
              >
                {r.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative ml-auto text-white hover:bg-white/10 md:ml-0"
          >
            <Bell className="size-5" />
            <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-warning" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] max-w-sm sm:w-80">
          <DropdownMenuLabel className="text-navy">Thông báo hệ thống</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="flex-col items-start">
            <span className="text-sm font-medium">37 giấy phép sắp hết hạn</span>
            <span className="text-xs text-muted-foreground">Cảnh báo điều hành · hôm nay</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="flex-col items-start">
            <span className="text-sm font-medium">12 hồ sơ chờ phê duyệt</span>
            <span className="text-xs text-muted-foreground">Workflow · 06/08/2026</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="flex-col items-start">
            <span className="text-sm font-medium">API /industry/sync lỗi 8,4%</span>
            <span className="text-xs text-muted-foreground">Tích hợp dữ liệu · 05/08/2026</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
        <CircleHelp className="size-5" />
      </Button>

      <RoleSwitcher />
    </header>
  );
}

function flattenNavChildren(prefix: string, children: NavChild[]): { label: string; to: string }[] {
  return children.flatMap((c) => [
    { label: `${prefix} / ${c.label}`, to: c.to },
    ...flattenNavChildren(`${prefix} / ${c.label}`, c.children ?? []),
  ]);
}
