import { z } from 'zod';

export const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Kỳ phải có dạng YYYY-MM.');

function toIndex(period: string) {
  const [year, month] = period.split('-').map(Number);
  return year * 12 + month - 1;
}

function fromIndex(index: number) {
  const year = Math.floor(index / 12);
  const month = index % 12 + 1;
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}`;
}

export function shiftPeriod(period: string, months: number) {
  return fromIndex(toIndex(period) + months);
}

export type PeriodRange = { from: string; to: string; compareFrom: string; compareTo: string; label: string };

export function resolvePeriodRange(params: URLSearchParams): PeriodRange {
  const period = params.get('period');
  const from = params.get('from');
  const to = params.get('to');
  let currentFrom: string;
  let currentTo: string;
  let label: string;
  if (from || to) {
    if (!from || !to) throw new Error('Cần truyền đồng thời from và to theo dạng YYYY-MM.');
    periodSchema.parse(from);
    periodSchema.parse(to);
    if (from > to) throw new Error('from phải trước hoặc bằng to.');
    currentFrom = from;
    currentTo = to;
    label = `${from} → ${to}`;
  } else if (period && /^\d{4}$/.test(period)) {
    currentFrom = `${period}-01`;
    currentTo = `${period}-12`;
    label = period;
  } else if (period) {
    periodSchema.parse(period);
    currentFrom = period;
    currentTo = period;
    label = period;
  } else {
    const now = new Date();
    currentFrom = `${now.getFullYear()}-01`;
    currentTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    label = `${now.getFullYear()} YTD`;
  }
  const compareFrom = params.get('compareFrom') ?? shiftPeriod(currentFrom, -12);
  const compareTo = params.get('compareTo') ?? shiftPeriod(currentTo, -12);
  periodSchema.parse(compareFrom);
  periodSchema.parse(compareTo);
  if (compareFrom > compareTo) throw new Error('compareFrom phải trước hoặc bằng compareTo.');
  return { from: currentFrom, to: currentTo, compareFrom, compareTo, label };
}

export function numberOrNull(value: unknown) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseGeoJson(value: unknown) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const parsed = JSON.parse(value) as { type?: unknown; coordinates?: unknown };
    if (typeof parsed.type !== 'string' || !('coordinates' in parsed)) return null;
    return parsed as { type: string; coordinates: unknown };
  } catch {
    return null;
  }
}
