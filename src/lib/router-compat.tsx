"use client";

import NextLink from "next/link";
import {
  notFound,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import type { ComponentProps, ComponentType } from "react";

type SearchValues = Record<string, unknown>;
type Params = Record<string, string | number>;

type RouteOptions<TSearch extends object> = {
  component: ComponentType;
  validateSearch?: (search: Record<string, unknown>) => TSearch;
  [key: string]: unknown;
};

export function createFileRoute<TPath extends string>(path: TPath) {
  return function createRoute<TSearch extends object = SearchValues>(
    options: RouteOptions<TSearch>,
  ) {
    return {
      path,
      options,
      useParams() {
        const pathname = usePathname();
        return matchParams(path, pathname) as Record<string, string>;
      },
      useSearch() {
        const searchParams = useSearchParams();
        const raw = Object.fromEntries(searchParams.entries());
        return options.validateSearch ? options.validateSearch(raw) : (raw as unknown as TSearch);
      },
    };
  };
}

type CompatLinkProps = Omit<ComponentProps<typeof NextLink>, "href" | "prefetch"> & {
  to: string;
  params?: Params;
  search?: SearchValues;
  preload?: unknown;
  prefetch?: boolean;
  resetScroll?: boolean;
};

export function Link({
  to,
  params,
  search,
  preload,
  prefetch,
  resetScroll,
  ...props
}: CompatLinkProps) {
  void preload;
  return (
    <NextLink
      {...props}
      href={buildHref(to, params, search)}
      prefetch={prefetch}
      scroll={resetScroll}
    />
  );
}

type NavigateOptions = {
  to: string;
  params?: Params;
  search?: SearchValues;
  replace?: boolean;
};

export function useNavigate() {
  const router = useRouter();
  return ({ to, params, search, replace }: NavigateOptions) => {
    const href = buildHref(to, params, search);
    if (replace) router.replace(href);
    else router.push(href);
  };
}

export function useRouterState<T>({
  select,
}: {
  select: (state: { location: { pathname: string } }) => T;
}) {
  const pathname = usePathname();
  return select({ location: { pathname } });
}

export function useLocation() {
  return { pathname: usePathname() };
}

function buildHref(to: string, params?: Params, search?: SearchValues) {
  let pathname = to;
  for (const [key, value] of Object.entries(params ?? {})) {
    pathname = pathname.replace(`$${key}`, encodeURIComponent(String(value)));
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(search ?? {})) {
    if (value == null || value === "") continue;
    if (Array.isArray(value)) value.forEach((item) => query.append(key, String(item)));
    else query.set(key, String(value));
  }

  const queryString = query.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

function matchParams(pattern: string, pathname: string) {
  const patternSegments = pattern.split("/").filter(Boolean);
  const pathSegments = pathname.split("/").filter(Boolean);
  const params: Record<string, string> = {};

  patternSegments.forEach((segment, index) => {
    if (segment.startsWith("$")) {
      params[segment.slice(1)] = decodeURIComponent(pathSegments[index] ?? "");
    }
  });

  return params;
}

export { notFound };
