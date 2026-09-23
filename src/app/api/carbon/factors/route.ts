import { count, desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyEmissionFactors } from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const schema = z.object({
  code: z.string().trim().min(2).max(100),
  gas: z.string().trim().min(2).max(30),
  activityType: z.string().trim().min(2).max(120),
  factorValue: z.number().positive(),
  factorUnit: z.string().trim().min(2).max(100),
  sourceRef: z.string().trim().min(2).max(500),
  sourceVersion: z.string().trim().min(1).max(100),
  validFrom: z.string().min(1),
  validTo: z.string().nullable().optional(),
});

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const wantsPagination = params.get('options') !== 'true' && (params.has('page') || params.has('pageSize'));
    const pagination = parsePagination(params);
    const query = db.select().from(energyEmissionFactors).orderBy(desc(energyEmissionFactors.validFrom));
    if (!wantsPagination) return NextResponse.json({ items: (await query).map((row) => ({ ...row, factorValue: Number(row.factorValue) })) });
    const [rows, totalRows] = await Promise.all([
      query.limit(pagination.pageSize).offset(pagination.offset),
      db.select({ value: count() }).from(energyEmissionFactors),
    ]);
    return paginatedResponse(rows.map((row) => ({ ...row, factorValue: Number(row.factorValue) })), pagination, Number(totalRows[0]?.value ?? 0));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải hệ số phát thải.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const validFrom = parseDate(payload.validFrom);
    const validTo = parseDate(payload.validTo);
    if (!validFrom) return NextResponse.json({ message: 'Ngày hiệu lực không hợp lệ.' }, { status: 400 });
    const [created] = await db.insert(energyEmissionFactors).values({
      code: payload.code,
      gas: payload.gas,
      activityType: payload.activityType,
      factorValue: String(payload.factorValue),
      factorUnit: payload.factorUnit,
      sourceRef: payload.sourceRef,
      sourceVersion: payload.sourceVersion,
      validFrom,
      validTo,
    }).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Hệ số phát thải không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu hệ số phát thải.' }, { status: 400 });
  }
}
