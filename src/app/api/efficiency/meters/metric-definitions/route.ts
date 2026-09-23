import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyMetricDefinitions } from '@/db/schema';
import { db } from '@/lib/db';
import { canonicalMetricCodeSchema, canonicalMetricCodes } from '@/lib/efficiency-schemas';
import { canonicalMetricDefinitions, ensureCanonicalMetricDefinition } from '@/server/efficiency/metrics';

export const dynamic = 'force-dynamic';

const schema = z.object({ metricCode: canonicalMetricCodeSchema });

export async function GET() {
  try {
    const rows = await db.select().from(energyMetricDefinitions);
    const byCode = new Map(rows.map((row) => [row.code, row]));
    return NextResponse.json({
      items: canonicalMetricCodes.map((code) => ({
        code,
        ...canonicalMetricDefinitions[code],
        configured: byCode.has(code),
        definition: byCode.get(code) ?? null,
      })),
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải danh mục metric canonical.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const definition = await db.transaction((tx) => ensureCanonicalMetricDefinition(tx, payload.metricCode));
    return NextResponse.json(definition, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Metric canonical không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể đăng ký metric canonical.' }, { status: 400 });
  }
}
