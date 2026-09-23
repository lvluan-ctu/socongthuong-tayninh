import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link, useRouterState } from "@/lib/router-compat";
import { ChevronDown, ChevronLeft, ExternalLink, Layers } from "lucide-react";
import { NAV_GROUPS, type NavChild, type NavItem } from "@/lib/nav";
import { CLUSTERS } from "@/data/mock";
import { clusterCountByIndustry, useGisLayer } from "@/lib/gis-layer-context";
import { INDUSTRIES } from "@/lib/constants";
import { Checkbox } from "@/components/ui/checkbox";
import { useRole } from "@/lib/role-context";
import { cn } from "@/lib/utils";

export function AppSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { navItems } = useRole();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-border bg-navy text-navy-foreground lg:flex",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group) => {
          const items = navItems.filter((i) => i.group === group);
          if (!items.length) return null;
          return (
            <div key={group} className="mb-4">
              {!collapsed ? (
                <p className="mb-1.5 px-2 text-[10px] font-bold tracking-widest text-white/45">
                  {group}
                </p>
              ) : (
                <div className="mx-2 mb-2 border-t border-white/10" />
              )}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const activeItem =
                    item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                  return (
                    <li key={item.code}>
                      {item.children?.length && !collapsed ? (
                        <SubmenuNavItem item={item} active={activeItem} />
                      ) : item.external ? (
                        <a
                          href={item.to}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={item.label}
                          className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors hover:bg-white/10 hover:text-white text-white/75"
                        >
                          <item.icon className="size-4.5 shrink-0" strokeWidth={1.7} />
                          {!collapsed ? (
                            <span className="flex flex-1 items-center justify-between truncate">
                              {item.label}
                              <ExternalLink className="size-3.5 opacity-60" />
                            </span>
                          ) : null}
                        </a>
                      ) : (
                        <Link
                          to={item.to}
                          title={item.label}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors",
                            activeItem
                              ? "bg-white/15 font-medium text-white"
                              : "text-white/75 hover:bg-white/10 hover:text-white",
                          )}
                        >
                          <item.icon className="size-4.5 shrink-0" strokeWidth={1.7} />
                          {!collapsed ? <span className="truncate">{item.label}</span> : null}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <button
        onClick={onToggle}
        className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
      >
        <ChevronLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
        {!collapsed ? "Thu gọn menu" : null}
      </button>
    </aside>
  );
}

function SubmenuNavItem({ item, active }: { item: NavItem; active: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(active || isDescendantActive(item.children, pathname));

  useEffect(() => {
    if (active || isDescendantActive(item.children, pathname)) setOpen(true);
  }, [pathname, item, active]);

  return (
    <>
      <div
        className={cn(
          "flex items-center rounded-md transition-colors",
          active ? "bg-white/15" : "hover:bg-white/10",
        )}
      >
        <Link
          to={item.to}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5 px-2 py-2 text-sm transition-colors",
            active ? "font-medium text-white" : "text-white/75 hover:text-white",
          )}
        >
          <item.icon className="size-4.5 shrink-0" strokeWidth={1.7} />
          <span className="truncate">{item.label}</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Thu gọn mục con" : "Mở rộng mục con"}
          aria-expanded={open}
          className="mr-1 grid size-7 shrink-0 place-items-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open ? <NavChildrenList children={item.children ?? []} /> : null}
    </>
  );
}

function NavChildrenList({ children }: { children: NavChild[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <ul className="mb-1 ml-3 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
      {children.map((child) => (
        <li key={child.code ?? child.to}>
          {child.code === "05-gis" ? (
            <GisChildItem child={child} />
          ) : child.children?.length ? (
            <ExpandableChild child={child} />
          ) : (
            <Link
              to={child.to}
              search={child.search as never}
              className={cn(
                "block rounded-md px-2 py-1.5 text-[13px] transition-colors",
                isChildActive(child, pathname, searchParams)
                  ? "bg-white/15 font-medium text-white"
                  : "text-white/65 hover:bg-white/10 hover:text-white",
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

function ExpandableChild({ child }: { child: NavChild }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = isChildActive(child, pathname, searchParams);

  useEffect(() => {
    if (active || isDescendantActive(child.children, pathname)) {
      setOpen(true);
    }
  }, [pathname, child, active]);

  return (
    <>
      <div
        className={cn(
          "flex items-center rounded-md",
          active ? "bg-white/15" : "hover:bg-white/10",
        )}
      >
        <Link
          to={child.to}
          search={child.search as never}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-[13px] transition-colors",
            active
              ? "font-medium text-white"
              : "text-white/65 hover:text-white",
          )}
        >
          {child.label}
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Thu gọn mục con" : "Mở rộng mục con"}
          aria-expanded={open}
          className="mr-1 grid size-6 shrink-0 place-items-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open ? <NavChildrenList children={child.children ?? []} /> : null}
    </>
  );
}

function GisChildItem({ child }: { child: NavChild }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (isRouteActive(child.to, pathname)) setOpen(true);
  }, [pathname, child]);

  return (
    <>
      <div
        className={cn(
          "flex items-center rounded-md",
          isRouteActive(child.to, pathname) ? "bg-white/15" : "hover:bg-white/10",
        )}
      >
        <Link
          to={child.to}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-[13px] transition-colors",
            isRouteActive(child.to, pathname)
              ? "font-medium text-white"
              : "text-white/65 hover:text-white",
          )}
        >
          {child.label}
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Thu gọn bộ lọc" : "Mở rộng bộ lọc"}
          aria-expanded={open}
          className="mr-1 grid size-6 shrink-0 place-items-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open ? <GisLayerSubmenu /> : null}
    </>
  );
}

function usePathname() {
  return useRouterState({ select: (s) => s.location.pathname });
}

function isRouteActive(to: string, pathname: string, exact = false) {
  return to === "/" || exact ? pathname === to : pathname.startsWith(to);
}

function isChildActive(child: NavChild, pathname: string, searchParams: { get(name: string): string | null }) {
  if (!isRouteActive(child.to, pathname, child.exact)) return false;
  if (child.search) {
    return Object.entries(child.search).every(([key, value]) => searchParams.get(key) === String(value));
  }
  if (child.exact && pathname === child.to) {
    const siblingMode = searchParams.get("mode");
    if (siblingMode && ["station", "grid"].includes(siblingMode)) return false;
  }
  return true;
}

function isDescendantActive(children: NavChild[] | undefined, pathname: string): boolean {
  if (!children) return false;
  return children.some(
    (c) => isRouteActive(c.to, pathname, c.exact) || isDescendantActive(c.children, pathname),
  );
}

function GisLayerSubmenu() {
  const {
    selectedClusterIds,
    toggleCluster,
    setSelectedClusterIds,
    selectedIndustries,
    toggleIndustry,
    setSelectedIndustries,
  } = useGisLayer();

  const allClusters = selectedClusterIds.length === CLUSTERS.length;
  const allIndustries = selectedIndustries.length === INDUSTRIES.length;

  return (
    <div className="mb-2 ml-3 mt-1 space-y-3 rounded-md border border-white/10 bg-white/[0.04] p-2.5">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gov">
        <Layers className="size-3.5" /> Bộ lọc GIS
      </p>

      <section>
        <div className="mb-1 flex items-center justify-between gap-1">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/50">
            Ngành nghề
          </h4>
          <button
            type="button"
            onClick={() => setSelectedIndustries(allIndustries ? [] : INDUSTRIES)}
            className="text-[10px] font-medium text-gov hover:underline"
          >
            {allIndustries ? "Bỏ chọn" : "Chọn tất cả"}
          </button>
        </div>
        <ul className="max-h-44 space-y-0.5 overflow-y-auto pr-0.5">
          {INDUSTRIES.map((ind) => {
            const checked = selectedIndustries.includes(ind);
            const count = clusterCountByIndustry(ind);
            return (
              <li
                key={ind}
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggleIndustry(ind)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-white/10",
                  checked ? "text-white" : "text-white/65",
                )}
              >
                <Checkbox
                  checked={checked}
                  className="size-3.5 border-teal/60 bg-transparent data-[state=checked]:bg-teal data-[state=checked]:text-white"
                />
                <span className="min-w-0 flex-1 truncate">{ind}</span>
                <span className="rounded-full bg-white/10 px-1.5 py-px text-[10px] tabular-nums text-white/45">
                  {count} KCN
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-1 text-[10px] leading-relaxed text-white/40">
          Chọn ngành để bản đồ chỉ hiển thị KCN có ngành đó và nhà máy tương ứng.
        </p>
      </section>

      <section>
        <div className="mb-1 flex items-center justify-between gap-1">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/50">
            Khu/Cụm công nghiệp
          </h4>
          <button
            type="button"
            onClick={() => setSelectedClusterIds(allClusters ? [] : CLUSTERS.map((c) => c.id))}
            className="text-[10px] font-medium text-gov hover:underline"
          >
            {allClusters ? "Bỏ chọn" : "Chọn tất cả"}
          </button>
        </div>
        <ul className="max-h-52 space-y-0.5 overflow-y-auto pr-0.5">
          {CLUSTERS.map((c) => {
            const checked = selectedClusterIds.includes(c.id);
            return (
              <li
                key={c.id}
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggleCluster(c.id)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-white/10",
                  checked ? "text-white" : "text-white/65",
                )}
              >
                <Checkbox
                  checked={checked}
                  className="size-3.5 border-gov/60 bg-transparent data-[state=checked]:bg-gov data-[state=checked]:text-white"
                />
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <span className="rounded-full bg-white/10 px-1.5 py-px text-[10px] tabular-nums text-white/45">
                  {c.enterprises}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h4 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/50">
          Chú giải màu
        </h4>
        <div className="space-y-1 text-[11px] text-white/65">
          <LegendItem dot="bg-success" label="Lấp đầy ≥ 75%" />
          <LegendItem dot="bg-gov" label="Lấp đầy 50 – 74%" />
          <LegendItem dot="bg-warning" label="Lấp đầy < 50%" />
        </div>
        <p className="mt-1.5 text-[10px] leading-relaxed text-white/40">
          Đường đứt nét là ranh giới xã/phường (chính quyền 2 cấp), polygon là ranh giới KCN/CCN.
          Nhấn vào để khoan xuống từng tầng cho tới doanh nghiệp.
        </p>
      </section>
    </div>
  );
}

function LegendItem({ dot, label }: { dot: string; label: string }) {
  return (
    <p className="flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", dot)} /> {label}
    </p>
  );
}
