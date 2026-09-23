import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readOutageImpact } from '@/server/safety/outage-impact';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ outageId: string }> };
const paramsSchema = z.object({ outageId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Outage ID must be a PostgreSQL UUID.") });

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { outageId } = paramsSchema.parse(await context.params);
    const impact = await readOutageImpact(outageId);
    if (!impact) return NextResponse.json({ message: 'Outage plan not found.' }, { status: 404 });
    return NextResponse.json(impact);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Outage ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load outage impact.' }, { status: 500 });
  }
}
