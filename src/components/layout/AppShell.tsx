import { Suspense, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@/lib/router-compat";
import { ChevronDown, ExternalLink } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ChatBot } from "@/components/common/ChatBot";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { NAV_GROUPS, type NavChild, type NavItem } from "@/lib/nav";
import { useRole } from "@/lib/role-context";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { navItems } = useRole();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader onMenu={() => setMobileOpen(true)} />
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <Suspense fallback={<aside className={cn("hidden shrink-0 border-r border-border bg-navy lg:block", collapsed ? "w-16" : "w-64")} />}>
          <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        </Suspense>
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <ChatBot />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 bg-navy p-0 text-navy-foreground">
          <nav className="overflow-y-auto px-3 py-12">
            {NAV_GROUPS.map((group) => {
              const items = navItems.filter((i) => i.group === group);
              if (!items.length) return null;
              return (
                <div key={group} className="mb-4">
                  <p className="mb-1.5 text-[10px] font-bold tracking-widest text-white/45">
                    {group}
                  </p>
                  <ul className="space-y-0.5">
                    {items.map((item) => (
                      <MobileNavItem
                        key={item.code}
                        item={item}
                        onNavigate={() => setMobileOpen(false)}
                      />
                    ))}
                  </ul>
                </div>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MobileNavItem({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hasChildren = !!item.children?.length;

  return (
    <li>
      <div className="flex items-center rounded-md">
        {item.external ? (
          <a
            href={item.to}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onNavigate}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-2 text-sm text-white/75"
          >
            <item.icon className="size-4.5" strokeWidth={1.7} />
            <span className="flex flex-1 items-center justify-between">
              {item.label}
              <ExternalLink className="size-3.5 opacity-60" />
            </span>
          </a>
        ) : (
          <Link
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-2 text-sm",
              pathname === item.to ? "bg-white/15 font-medium text-white" : "text-white/75",
            )}
          >
            <item.icon className="size-4.5" strokeWidth={1.7} />
            {item.label}
          </Link>
        )}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Thu gọn mục con" : "Mở rộng mục con"}
            aria-expanded={open}
            className="mr-1 grid size-7 shrink-0 place-items-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
          >
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          </button>
        ) : null}
      </div>
      {hasChildren && open ? (
        <MobileChildrenList children={item.children!} onNavigate={onNavigate} />
      ) : null}
    </li>
  );
}

function MobileChildrenList({
  children,
  onNavigate,
}: {
  children: NavChild[];
  onNavigate: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <ul className="mb-1 ml-3 space-y-0.5 border-l border-white/10 pl-3">
      {children.map((child) => (
        <li key={child.code ?? child.to}>
          {child.children?.length ? (
            <MobileExpandableChild child={child} onNavigate={onNavigate} />
          ) : (
            <Link
              to={child.to}
              search={child.search as never}
              onClick={onNavigate}
              className={cn(
                "block rounded-md px-2 py-1.5 text-[13px]",
                pathname.startsWith(child.to)
                  ? "bg-white/15 font-medium text-white"
                  : "text-white/65",
              )}
            >
              {child.label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

function MobileExpandableChild({ child, onNavigate }: { child: NavChild; onNavigate: () => void }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname.startsWith(child.to);

  return (
    <>
      <div
        className={cn("flex items-center rounded-md", active ? "bg-white/15" : "hover:bg-white/10")}
      >
        <Link
          to={child.to}
          onClick={onNavigate}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-[13px]",
            active ? "font-medium text-white" : "text-white/65",
          )}
        >
          {child.label}
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Thu gọn mục con" : "Mở rộng mục con"}
          aria-expanded={open}
          className="mr-1 grid size-6 shrink-0 place-items-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
        >
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open ? <MobileChildrenList children={child.children!} onNavigate={onNavigate} /> : null}
    </>
  );
}
