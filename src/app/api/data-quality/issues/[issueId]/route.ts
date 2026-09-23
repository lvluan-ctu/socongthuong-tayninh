import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyDataQualityIssues } from '@/db/schema';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ issueId: string }> };

const updateSchema = z.object({
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'IGNORED']),
  resolution: z.string().trim().max(3000).optional().nullable(),
  resolvedBy: z.string().trim().min(2).max(200).optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { issueId } = await context.params;
    const payload = updateSchema.parse(await request.json());
    const closing = payload.status === 'RESOLVED' || payload.status === 'IGNORED';

    const [updated] = await db
      .update(energyDataQualityIssues)
      .set({
        status: payload.status,
        resolution: payload.resolution ?? null,
        resolvedBy: closing ? (payload.resolvedBy ?? 'energy-admin') : null,
        resolvedAt: closing ? new Date() : null,
      })
      .where(eq(energyDataQualityIssues.id, issueId))
      .returning();

    if (!updated) return NextResponse.json({ message: 'Không tìm thấy vấn đề dữ liệu.' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Dữ liệu cập nhật không hợp lệ.', issues: error.issues }, { status: 400 });
    }
    console.error('Data quality issue update failed', error);
    return NextResponse.json({ message: 'Không thể cập nhật trạng thái chất lượng dữ liệu.' }, { status: 500 });
  }
}
