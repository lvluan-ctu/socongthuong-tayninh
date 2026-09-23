import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyAssets, energyEvApplicationHistory, energyEvApplicationReviews, energyEvGridAssessments, energyEvStationApplications } from '@/db/schema';
import { evApplicationReviewSchema } from '@/lib/ev-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

function invalidId(id: string) {
  return !z.string().uuid().safeParse(id).success;
}

const transitions: Record<string, string[]> = {
  DRAFT: ['UNDER_REVIEW', 'NEEDS_INFO', 'REJECTED'],
  SUBMITTED: ['UNDER_REVIEW', 'NEEDS_INFO', 'PRELIMINARY_OK', 'APPROVED', 'REJECTED'],
  UNDER_REVIEW: ['UNDER_REVIEW', 'NEEDS_INFO', 'PRELIMINARY_OK', 'APPROVED', 'REJECTED'],
  NEEDS_INFO: ['UNDER_REVIEW', 'NEEDS_INFO', 'PRELIMINARY_OK', 'REJECTED'],
  PRELIMINARY_OK: ['UNDER_REVIEW', 'APPROVED', 'REJECTED'],
};

function defaultResult(status: string) {
  if (status === 'APPROVED') return 'APPROVED' as const;
  if (status === 'REJECTED') return 'REJECTED' as const;
  if (status === 'NEEDS_INFO') return 'NEEDS_INFO' as const;
  if (status === 'PRELIMINARY_OK') return 'PASS' as const;
  return 'CONDITIONAL' as const;
}

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (invalidId(id)) return NextResponse.json({ message: 'Mã hồ sơ không hợp lệ.' }, { status: 400 });
    const rows = await db.select({
      id: energyEvApplicationReviews.id,
      applicationId: energyEvApplicationReviews.applicationId,
      reviewType: energyEvApplicationReviews.reviewType,
      reviewer: energyEvApplicationReviews.reviewer,
      reviewedAt: energyEvApplicationReviews.reviewedAt,
      result: energyEvApplicationReviews.result,
      approvedPowerKw: energyEvApplicationReviews.approvedPowerKw,
      conditions: energyEvApplicationReviews.conditions,
      note: energyEvApplicationReviews.note,
      documentRef: energyEvApplicationReviews.documentRef,
      assessmentId: energyEvApplicationReviews.assessmentId,
      assessmentType: energyEvGridAssessments.assessmentType,
      metadata: energyEvApplicationReviews.metadata,
    }).from(energyEvApplicationReviews)
      .leftJoin(energyEvGridAssessments, eq(energyEvGridAssessments.id, energyEvApplicationReviews.assessmentId))
      .where(eq(energyEvApplicationReviews.applicationId, id));
    return NextResponse.json({ items: rows.map((row) => ({ ...row, approvedPowerKw: row.approvedPowerKw == null ? null : Number(row.approvedPowerKw) })) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải lịch sử thẩm định.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (invalidId(id)) return NextResponse.json({ message: 'Mã hồ sơ không hợp lệ.' }, { status: 400 });
    const payload = evApplicationReviewSchema.parse(await request.json());
    const [existing] = await db.select().from(energyEvStationApplications).where(eq(energyEvStationApplications.id, id)).limit(1);
    if (!existing) return NextResponse.json({ message: 'Không tìm thấy hồ sơ đăng ký.' }, { status: 404 });
    if (!transitions[existing.status]?.includes(payload.status)) return NextResponse.json({ message: `Không thể chuyển hồ sơ từ ${existing.status} sang ${payload.status}.` }, { status: 409 });
    if (payload.approvedPowerKw != null && payload.approvedPowerKw > Number(existing.requestedPowerKw)) return NextResponse.json({ message: 'Approved power không được lớn hơn requested power.' }, { status: 422 });
    if (payload.status === 'APPROVED' && payload.connectionCapacityKw != null && payload.approvedPowerKw != null && payload.connectionCapacityKw < payload.approvedPowerKw) return NextResponse.json({ message: 'Connection capacity phải lớn hơn hoặc bằng approved power.' }, { status: 422 });
    if (payload.assessmentId) {
      const [assessment] = await db.select({ id: energyEvGridAssessments.id, applicationId: energyEvGridAssessments.applicationId }).from(energyEvGridAssessments).where(eq(energyEvGridAssessments.id, payload.assessmentId)).limit(1);
      if (!assessment || assessment.applicationId !== id) return NextResponse.json({ message: 'Assessment không thuộc hồ sơ.' }, { status: 422 });
    }
    if (payload.connectionPointAssetId) {
      const [asset] = await db.select({ id: energyAssets.id }).from(energyAssets).where(eq(energyAssets.id, payload.connectionPointAssetId)).limit(1);
      if (!asset) return NextResponse.json({ message: 'Không tìm thấy điểm đấu nối được tham chiếu.' }, { status: 404 });
    }

    const result = await db.transaction(async (tx) => {
      const approved = payload.status === 'APPROVED';
      const [updated] = await tx.update(energyEvStationApplications).set({
        status: payload.status,
        reviewedBy: payload.reviewedBy,
        reviewedAt: new Date(),
        reviewNote: payload.reviewNote ?? null,
        approvedPowerKw: approved && payload.approvedPowerKw != null ? String(payload.approvedPowerKw) : existing.approvedPowerKw,
        approvedAt: approved ? new Date() : existing.approvedAt,
        approvalNo: approved ? payload.approvalNo ?? existing.approvalNo : existing.approvalNo,
        connectionCapacityKw: approved && payload.connectionCapacityKw != null ? String(payload.connectionCapacityKw) : existing.connectionCapacityKw,
        connectionPointAssetId: approved && payload.connectionPointAssetId !== undefined ? payload.connectionPointAssetId : existing.connectionPointAssetId,
        connectionMethod: approved && payload.connectionMethod !== undefined ? payload.connectionMethod : existing.connectionMethod,
        connectionSourceRef: approved && payload.connectionSourceRef !== undefined ? payload.connectionSourceRef : existing.connectionSourceRef,
      }).where(eq(energyEvStationApplications.id, id)).returning();
      const [review] = await tx.insert(energyEvApplicationReviews).values({
        applicationId: id,
        reviewType: payload.reviewType,
        reviewer: payload.reviewedBy,
        reviewedAt: new Date(),
        result: payload.result ?? defaultResult(payload.status),
        approvedPowerKw: payload.approvedPowerKw == null ? null : String(payload.approvedPowerKw),
        conditions: payload.conditions ?? null,
        note: payload.reviewNote ?? null,
        documentRef: payload.documentRef ?? null,
        assessmentId: payload.assessmentId ?? null,
        metadata: { fromStatus: existing.status, toStatus: payload.status, requestedPowerKw: existing.requestedPowerKw },
      }).returning();
      await tx.insert(energyEvApplicationHistory).values({
        applicationId: id,
        fromStatus: existing.status,
        toStatus: payload.status,
        action: 'REVIEW',
        actor: payload.reviewedBy,
        note: payload.reviewNote ?? null,
        metadata: { reviewId: review.id, reviewType: payload.reviewType, approvedPowerKw: payload.approvedPowerKw ?? null, assessmentId: payload.assessmentId ?? null },
      });
      return { updated, review };
    });
    return NextResponse.json({ ...result, application: { ...result.updated, approvedPowerKw: result.updated.approvedPowerKw == null ? null : Number(result.updated.approvedPowerKw), connectionCapacityKw: result.updated.connectionCapacityKw == null ? null : Number(result.updated.connectionCapacityKw) }, review: { ...result.review, approvedPowerKw: result.review.approvedPowerKw == null ? null : Number(result.review.approvedPowerKw) } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin thẩm định không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật hồ sơ.' }, { status: 400 });
  }
}
