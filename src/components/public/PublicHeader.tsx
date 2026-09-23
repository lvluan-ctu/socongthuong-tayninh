import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "@/lib/router-compat";
import { Menu, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { portalDetailTo } from "@/components/public/PublicShared";
import { SITE_CONFIG } from "@/lib/site-config";
import { formatPortalDate, searchPortal } from "@/lib/portal-service";
import type { PortalPost } from "@/lib/types";
import { cn } from "@/lib/utils";

type NavLink = { label: string; muc: string; to?: string };

const NAV_LINKS: NavLink[] = [
  { label: "Trang chủ", muc: "" },
  { label: "Tin tức", muc: "tin-tuc" },
  { label: "Sự kiện", muc: "su-kien" },
  { label: "Đầu tư", muc: "dau-tu" },
  { label: "Khuyến mại", muc: "khuyen-mai" },
  { label: "Thị trường", muc: "thi-truong" },
  { label: "Thông báo", muc: "thong-bao" },
  { label: "Lãnh đạo đơn vị", muc: "", to: "/trang-thong-tin/lanh-dao-don-vi" },
];

// Thứ tự các section trên landing page (trang /trang-thong-tin) — dùng cho scroll-spy.
const SECTION_IDS = ["tin-tuc", "su-kien", "dau-tu", "khuyen-mai", "thi-truong", "thong-bao"];

export function PublicHeader() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PortalPost[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [spyMuc, setSpyMuc] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  const isLanding = location.pathname === "/trang-thong-tin";

  // Scroll-spy: highlight nav item của section đang hiển thị khi lướt trang.
  useEffect(() => {
    if (!isLanding) {
      setSpyMuc("");
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const offset = (headerRef.current?.offsetHeight ?? 0) + 1;
      let current = "";
      for (const id of SECTION_IDS) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= offset) current = id;
      }
      setSpyMuc(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [isLanding]);

  useEffect(() => {
    setResults(searchPortal(query, 8));
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const closeAll = () => {
    setMobileOpen(false);
    setSearchOpen(false);
  };

  const onNavClick = (muc: string) => {
    closeAll();
    // Mục "Trang chủ" (không có muc) — khi đang ở trang chủ thì cuộn lên đầu.
    if (!muc && location.pathname === "/trang-thong-tin") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    // Các mục còn lại: Link cập nhật ?muc=… → useEffect trong trang chủ tự scroll tới section.
  };

  return (
    <header
      ref={headerRef}
      id="site-header"
      className="sticky top-0 z-50 border-b border-navy/10 bg-white/95 shadow-[0_1px_4px_rgba(23,50,100,0.07)] backdrop-blur"
    >
      {/* Header top: Logo.gif */}
      <div className="bg-navy text-navy-foreground">
        <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4 lg:px-6">
          <Link
            to="/trang-thong-tin"
            className="block"
            onClick={() => onNavClick("")}
            aria-label={SITE_CONFIG.organization.shortName}
          >
            <img
              src="/img/Logo.gif"
              alt={SITE_CONFIG.organization.shortName}
              className="block h-auto max-h-14 w-full max-w-full object-contain sm:max-h-16 lg:max-h-20"
            />
          </Link>
        </div>
      </div>

      {/* Main bar: Navigation | Search */}
      <div className="mx-auto flex min-h-[64px] max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:min-h-[72px] lg:px-8 xl:gap-6">
        {/* Navigation (một dòng duy nhất) */}
        <nav className="hidden min-w-0 flex-1 items-center gap-0.5 lg:flex lg:gap-1 2xl:gap-3">
          {NAV_LINKS.map((l) => {
            const active = l.to ? location.pathname === l.to : isLanding && spyMuc === l.muc;
            return (
              <Link
                key={l.label}
                to={l.to ?? "/trang-thong-tin"}
                search={l.muc ? { muc: l.muc } : {}}
                resetScroll={!!l.to}
                onClick={() => onNavClick(l.muc)}
                className={cn(
                  "group relative whitespace-nowrap rounded-lg px-2 py-2 text-sm transition-all duration-200 xl:px-3 xl:text-[15px]",
                  active
                    ? "font-semibold text-navy"
                    : "font-medium text-navy/70 hover:bg-gov/5 hover:text-gov",
                )}
              >
                {l.label}
                <span
                  className={cn(
                    "absolute inset-x-3 bottom-1 h-0.5 origin-left rounded-full transition-all duration-200",
                    active ? "scale-x-100 bg-gov" : "scale-x-0 bg-gov group-hover:scale-x-100",
                  )}
                />
              </Link>
            );
          })}
        </nav>

        {/* RIGHT — Search + hamburger */}
        <div className="flex shrink-0 items-center gap-2">
          <div ref={searchRef} className="relative hidden md:block">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Tìm kiếm thông tin..."
              className="h-10 w-36 rounded-full border-navy/15 pl-8 sm:w-44 lg:w-48 xl:w-64"
            />
            {searchOpen && query.trim() ? (
              <div className="absolute right-0 top-11 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-xl border border-border bg-white shadow-xl sm:w-80">
                <p className="border-b border-border bg-surface px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Kết quả tìm kiếm
                </p>
                {results.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">
                    Không tìm thấy nội dung phù hợp.
                  </p>
                ) : (
                  <ul className="max-h-72 overflow-y-auto">
                    {results.map((r) => (
                      <li key={r.id}>
                        <Link
                          to={portalDetailTo(r)}
                          onClick={closeAll}
                          className="block px-3 py-2.5 transition-colors hover:bg-surface"
                        >
                          <span className="block truncate text-sm font-medium text-navy">
                            {r.title}
                          </span>
                          <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="text-gov">{r.category}</span>
                            <span>{formatPortalDate(r.publishedAt)}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Mở menu"
            className="grid size-10 place-items-center rounded-md text-navy hover:bg-surface lg:hidden"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile / tablet nav (dưới lg) */}
      {mobileOpen ? (
        <div className="border-t border-border bg-white lg:hidden">
          <div className="mx-auto max-w-7xl space-y-1 px-4 py-3 sm:px-6 lg:px-8">
            <div className="relative mb-2 md:hidden">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchOpen(true);
                }}
                placeholder="Tìm kiếm thông tin..."
                className="h-10 rounded-full border-navy/15 pl-8"
              />
              {searchOpen && query.trim() ? (
                <div className="absolute inset-x-0 top-11 z-10 overflow-hidden rounded-xl border border-border bg-white shadow-xl">
                  {results.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-muted-foreground">
                      Không tìm thấy nội dung phù hợp.
                    </p>
                  ) : (
                    <ul className="max-h-72 overflow-y-auto">
                      {results.map((r) => (
                        <li key={r.id}>
                          <Link
                            to={portalDetailTo(r)}
                            onClick={closeAll}
                            className="block px-3 py-2.5 transition-colors hover:bg-surface"
                          >
                            <span className="block truncate text-sm font-medium text-navy">
                              {r.title}
                            </span>
                            <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span className="text-gov">{r.category}</span>
                              <span>{formatPortalDate(r.publishedAt)}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
            {NAV_LINKS.map((l) => {
              const active = l.to ? location.pathname === l.to : isLanding && spyMuc === l.muc;
              return (
                <Link
                  key={l.label}
                  to={l.to ?? "/trang-thong-tin"}
                  search={l.muc ? { muc: l.muc } : {}}
                  resetScroll={!!l.to}
                  onClick={() => onNavClick(l.muc)}
                  className={cn(
                    "block rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    active ? "bg-gov/10 font-semibold text-gov" : "text-navy/85 hover:bg-surface",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </header>
  );
}
