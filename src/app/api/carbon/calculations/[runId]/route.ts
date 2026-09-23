import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { energyEmissionActivities, energyEmissionCalculationRuns, energyEmissionSources } from '@/db/schema';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ runId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { runId } = await context.params;
  const [row] = await db.select({ run: energyEmissionCalculationRuns, activity: energyEmissionActivities, sourceName: energyEmissionSources.name, sourceCode: energyEmissionSources.code }).from(energyEmissionCalculationRuns).innerJoin(energyEmissionActivities, eq(energyEmissionActivities.id, energyEmissionCalculationRuns.activityId)).innerJoin(energyEmissionSources, eq(energyEmissionSources.id, energyEmissionActivities.sourceId)).where(eq(energyEmissionCalculationRuns.id, runId)).limit(1);
  return row ? NextResponse.json({ item: row }) : NextResponse.json({ message: 'Không tìm thấy calculation run.' }, { status: 404 });
}
