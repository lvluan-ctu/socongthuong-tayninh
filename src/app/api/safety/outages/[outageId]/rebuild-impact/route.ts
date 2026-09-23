import { NextResponse } from 'next/server';
import { z } from 'zod';
import { outageImpactRebuildSchema } from '@/lib/safety-schemas';
import { rebuildOutageImpact } from '@/server/safety/outage-impact';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ outageId: string }> };
const paramsSchema = z.object({ outageId: z.string().uuid() });

export async function POST(request: Request, context: RouteContext) {
  try {
    const { outageId } = paramsSchema.parse(await context.params);
    const body = await request.json().catch(() => ({}));
    const payload = outageImpactRebuildSchema.parse(body);
    if (payload.determinationMethod !== 'TOPOLOGY_DERIVED') {
      return NextResponse.json({
        message: 'This rebuild endpoint only derives impact from EVN asset/customer references and grid topology. Use import data to persist an EVN polygon or customer list provenance.',
        issues: [{ path: ['determinationMethod'], message: 'Only TOPOLOGY_DERIVED is executable by this engine.' }],
      }, { status: 400 });
    }
    const impact = await rebuildOutageImpact(outageId, payload.determinationMethod);
    if (!impact) return NextResponse.json({ message: 'Outage plan not found.' }, { status: 404 });
    return NextResponse.json(impact);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Impact rebuild request is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not rebuild outage impact.' }, { status: 400 });
  }
}
