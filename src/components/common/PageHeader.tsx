import type { ReactNode } from "react";
import { Link } from "@/lib/router-compat";
import type { LucideIcon } from "lucide-react";
import { ChevronRight, Home } from "lucide-react";

export interface Crumb {
  label: string;
  to?: string;
}

export function PageHeader({
  title,
  description,
  crumbs = [],
  actions,
  variant = "default",
  icon,
}: {
  title: string;
  description?: string | undefined;
  crumbs?: Crumb[];
  actions?: ReactNode;
  variant?: "default" | "panel";
  icon?: LucideIcon;
}) {
  if (variant === "panel") {
    const Icon = icon;
    return (
      <div className="mx-2 mt-3 mb-3 overflow-hidden rounded-xl border border-border bg-card shadow-panel sm:mx-4 sm:mt-4 sm:mb-4 lg:mx-6 lg:mt-6">
        <div className="h-1 bg-gradient-to-r from-navy via-gov to-teal" />
        <div className="px-4 py-4 sm:px-6">
          <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Link to="/" className="flex items-center gap-1 hover:text-gov">
              <Home className="size-3.5" />
              Trang chủ
            </Link>
            {crumbs.map((c) => (
              <span key={c.label} className="flex items-center gap-1.5">
                <ChevronRight className="size-3.5" />
                {c.to ? (
                  <Link to={c.to} className="hover:text-gov">
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-foreground">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              {Icon ? (
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gov to-info text-white shadow-sm">
                  <Icon className="size-5" />
                </div>
              ) : null}
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-navy uppercase">
                  {title}
                </h1>
                {description ? (
                  <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
                ) : null}
              </div>
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border bg-card px-4 py-4 sm:px-6">
      <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Link to="/" className="flex items-center gap-1 hover:text-gov">
          <Home className="size-3.5" />
          Trang chủ
        </Link>
        {crumbs.map((c) => (
          <span key={c.label} className="flex items-center gap-1.5">
            <ChevronRight className="size-3.5" />
            {c.to ? (
              <Link to={c.to} className="hover:text-gov">
                {c.label}
              </Link>
            ) : (
              <span className="text-foreground">{c.label}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-navy uppercase">{title}</h1>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
