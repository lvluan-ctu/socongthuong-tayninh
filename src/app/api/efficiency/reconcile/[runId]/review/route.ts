import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyConsumerReports, energyReconciliationRuns } from '@/db/schema';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ runId: string }> };

const schema = z.object({
  decision: z.enum(['ACCEPT', 'REQUEST_EXPLANATION', 'REJECT', 'ACCEPT_WITH_NOTE']),
  reviewedBy: z.string().trim().min(2).max(200),
  note: z.string().trim().min(2).max(3000),
});

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const payload = schema.parse(await request.json());
    const [run] = await db.select().from(energyReconciliationRuns).where(eq(energyReconciliationRuns.id, runId)).limit(1);
    if (!run) return NextResponse.json({ message: 'Không tìm thấy kết quả đối soát.' }, { status: 404 });

    const reviewedAt = new Date();
    const [updated] = await db.update(energyReconciliationRuns).set({
      reviewedBy: payload.reviewedBy,
      reviewedAt,
      reviewDecision: payload.decision,
      explanation: {
        ...(run.explanation as Record<string, unknown>),
        reviewNote: payload.note,
      },
    }).where(eq(energyReconciliationRuns.id, runId)).returning();

    const reportStatus = ['ACCEPT', 'ACCEPT_WITH_NOTE'].includes(payload.decision) ? 'ACCEPTED' : payload.decision === 'REJECT' ? 'REJECTED' : 'UNDER_REVIEW';
    await db.update(energyConsumerReports).set({ status: reportStatus }).where(eq(energyConsumerReports.id, run.reportId));

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin review không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật review.' }, { status: 400 });
  }
}
