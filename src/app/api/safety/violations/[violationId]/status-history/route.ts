import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyCorridorViolations, energyViolationStatusHistory } from '@/db/schema';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ violationId: string }> };
const paramsSchema = z.object({ violationId: z.string().uuid() });

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { violationId } = paramsSchema.parse(await context.params);
    const [violation] = await db.select({ id: energyCorridorViolations.id }).from(energyCorridorViolations).where(eq(energyCorridorViolations.id, violationId)).limit(1);
    if (!violation) return NextResponse.json({ message: 'Violation not found.' }, { status: 404 });
    const items = await db.select().from(energyViolationStatusHistory).where(eq(energyViolationStatusHistory.violationId, violationId)).orderBy(desc(energyViolationStatusHistory.changedAt));
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Violation ID is invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load violation status history.' }, { status: 500 });
  }
}
