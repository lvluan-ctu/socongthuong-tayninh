import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyCarbonReportSubmissions, energyReportingObligations } from '@/db/schema';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const schema = z.object({
  status: z.enum(['UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'NEEDS_REVISION']),
  reviewedBy: z.string().trim().min(2).max(200),
  reviewDecision: z.string().trim().min(2).max(100),
  reviewNote: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = schema.parse(await request.json());
    const [submission] = await db.select().from(energyCarbonReportSubmissions).where(eq(energyCarbonReportSubmissions.id, id)).limit(1);
    if (!submission) return NextResponse.json({ message: 'Không tìm thấy hồ sơ báo cáo.' }, { status: 404 });

    const result = await db.transaction(async (tx) => {
      const [updated] = await tx.update(energyCarbonReportSubmissions).set({
        status: payload.status,
        reviewedBy: payload.reviewedBy,
        reviewedAt: new Date(),
        reviewDecision: payload.reviewDecision,
        reviewNote: payload.reviewNote ?? null,
      }).where(eq(energyCarbonReportSubmissions.id, id)).returning();

      const obligationStatus = payload.status === 'ACCEPTED'
        ? 'COMPLETED'
        : payload.status === 'NEEDS_REVISION' || payload.status === 'REJECTED'
          ? 'PENDING'
          : 'UNDER_REVIEW';
      await tx.update(energyReportingObligations).set({ status: obligationStatus }).where(eq(energyReportingObligations.id, submission.obligationId));
      return updated;
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin rà soát không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật hồ sơ.' }, { status: 400 });
  }
}
