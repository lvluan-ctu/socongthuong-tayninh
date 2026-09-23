import { NextResponse } from 'next/server';

export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export type Pagination = {
  page: number;
  pageSize: number;
  offset: number;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parsePagination(searchParams: URLSearchParams, defaultPageSize = DEFAULT_PAGE_SIZE): Pagination {
  const page = positiveInteger(searchParams.get('page'), 1);
  const requestedPageSize = positiveInteger(searchParams.get('pageSize'), defaultPageSize);
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize as (typeof PAGE_SIZE_OPTIONS)[number])
    ? requestedPageSize
    : defaultPageSize;

  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function paginationMeta(pagination: Pagination, total: number): PaginationMeta {
  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
  };
}

export function paginatedResponse<T>(
  items: T[],
  pagination: Pagination,
  total: number,
  extra: Record<string, unknown> = {},
) {
  return NextResponse.json({
    ...extra,
    items,
    pagination: paginationMeta(pagination, total),
  });
}
