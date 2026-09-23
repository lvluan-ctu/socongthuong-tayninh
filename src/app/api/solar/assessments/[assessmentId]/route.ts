import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { energyCustomerAccounts, energyParties, energySolarAssessments } from "@/db/schema";
import { db } from "@/lib/db";
import { solarAssessmentReviewPatchSchema } from "@/lib/solar-schemas";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ assessmentId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { assessmentId } = await context.params;
    const [row] = await db
      .select({
        id: energySolarAssessments.id,
        assessedAt: energySolarAssessments.assessedAt,
        customerAccountId: energySolarAssessments.customerAccountId,
        customerCode: energyCustomerAccounts.customerCode,
        customerName: energyParties.name,
        buildingAssetId: energySolarAssessments.buildingAssetId,
        annualConsumptionKwh: energySolarAssessments.annualConsumptionKwh,
        daytimeSharePct: energySolarAssessments.daytimeSharePct,
        usableRoofAreaM2: energySolarAssessments.usableRoofAreaM2,
        irradiationKwhM2Year: energySolarAssessments.irradiationKwhM2Year,
        recommendedCapacityKwp: energySolarAssessments.recommendedCapacityKwp,
        recommendedPanelCount: energySolarAssessments.recommendedPanelCount,
        recommendedInverterKw: energySolarAssessments.recommendedInverterKw,
        recommendedBatteryKwh: energySolarAssessments.recommendedBatteryKwh,
        gridAssetId: energySolarAssessments.gridAssetId,
        feederAssetId: energySolarAssessments.feederAssetId,
        bayAssetId: energySolarAssessments.bayAssetId,
        substationAssetId: energySolarAssessments.substationAssetId,
        capacityAssessmentId: energySolarAssessments.capacityAssessmentId,
        gridServiceLinkId: energySolarAssessments.gridServiceLinkId,
        gridMatchIsInferred: energySolarAssessments.gridMatchIsInferred,
        gridAssessedAt: energySolarAssessments.gridAssessedAt,
        availableGridCapacityKw: energySolarAssessments.availableGridCapacityKw,
        score: energySolarAssessments.score,
        factors: energySolarAssessments.factors,
        methodVersion: energySolarAssessments.methodVersion,
        inputHash: energySolarAssessments.inputHash,
        consumptionFrom: energySolarAssessments.consumptionFrom,
        consumptionTo: energySolarAssessments.consumptionTo,
        roofSurfaceId: energySolarAssessments.roofSurfaceId,
        solarResourceRef: energySolarAssessments.solarResourceRef,
        solarResourceVersion: energySolarAssessments.solarResourceVersion,
        status: energySolarAssessments.status,
        confidence: energySolarAssessments.confidence,
        reviewedBy: energySolarAssessments.reviewedBy,
        reviewedAt: energySolarAssessments.reviewedAt,
        reviewNote: energySolarAssessments.reviewNote,
      })
      .from(energySolarAssessments)
      .innerJoin(
        energyCustomerAccounts,
        eq(energyCustomerAccounts.id, energySolarAssessments.customerAccountId),
      )
      .innerJoin(energyParties, eq(energyParties.id, energyCustomerAccounts.partyId))
      .where(eq(energySolarAssessments.id, assessmentId))
      .limit(1);

    if (!row)
      return NextResponse.json({ message: "Không tìm thấy assessment Solar." }, { status: 404 });
    return NextResponse.json({
      ...row,
      annualConsumptionKwh: Number(row.annualConsumptionKwh),
      daytimeSharePct: row.daytimeSharePct == null ? null : Number(row.daytimeSharePct),
      usableRoofAreaM2: row.usableRoofAreaM2 == null ? null : Number(row.usableRoofAreaM2),
      irradiationKwhM2Year:
        row.irradiationKwhM2Year == null ? null : Number(row.irradiationKwhM2Year),
      recommendedCapacityKwp: Number(row.recommendedCapacityKwp),
      recommendedInverterKw:
        row.recommendedInverterKw == null ? null : Number(row.recommendedInverterKw),
      recommendedBatteryKwh:
        row.recommendedBatteryKwh == null ? null : Number(row.recommendedBatteryKwh),
      availableGridCapacityKw:
        row.availableGridCapacityKw == null ? null : Number(row.availableGridCapacityKw),
      score: row.score == null ? null : Number(row.score),
      confidence: row.confidence == null ? null : Number(row.confidence),
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể tải assessment Solar." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { assessmentId } = await context.params;
    const payload = solarAssessmentReviewPatchSchema.parse(await request.json());
    if (!Object.keys(payload).length) {
      return NextResponse.json(
        { message: "KhÃ´ng cÃ³ trÆ°á»ng review nÃ o Ä‘á»ƒ cáº­p nháº­t." },
        { status: 400 },
      );
    }

    const [existing] = await db
      .select({
        id: energySolarAssessments.id,
        status: energySolarAssessments.status,
        reviewedBy: energySolarAssessments.reviewedBy,
        reviewedAt: energySolarAssessments.reviewedAt,
        reviewNote: energySolarAssessments.reviewNote,
        confidence: energySolarAssessments.confidence,
      })
      .from(energySolarAssessments)
      .where(eq(energySolarAssessments.id, assessmentId))
      .limit(1);
    if (!existing)
      return NextResponse.json(
        { message: "KhÃ´ng tÃ¬m tháº¥y assessment Solar." },
        { status: 404 },
      );

    const status =
      payload.status ?? (existing.status as NonNullable<z.infer<typeof solarAssessmentReviewPatchSchema>["status"]>);
    const reviewedBy = Object.prototype.hasOwnProperty.call(payload, "reviewedBy")
      ? (payload.reviewedBy ?? null)
      : existing.reviewedBy;
    if (["REVIEWED", "APPROVED"].includes(status) && !reviewedBy?.trim()) {
      return NextResponse.json(
        {
          message: "Assessment REVIEWED/APPROVED pháº£i cÃ³ ngÆ°á»i duyá»‡t.",
          issues: [{ path: ["reviewedBy"], message: "Cáº§n nháº­p ngÆ°á»i duyá»‡t." }],
        },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(energySolarAssessments)
      .set({
        status,
        reviewedBy,
        reviewedAt: ["REVIEWED", "APPROVED"].includes(status)
          ? new Date()
          : status === "DRAFT"
            ? null
            : existing.reviewedAt,
        reviewNote: Object.prototype.hasOwnProperty.call(payload, "reviewNote")
          ? (payload.reviewNote ?? null)
          : existing.reviewNote,
        confidence: Object.prototype.hasOwnProperty.call(payload, "confidence")
          ? payload.confidence == null
            ? null
            : String(payload.confidence)
          : existing.confidence,
      })
      .where(eq(energySolarAssessments.id, assessmentId))
      .returning();
    return NextResponse.json({ assessment: updated });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { message: "ThÃ´ng tin review assessment khÃ´ng há»£p lá»‡.", issues: error.issues },
        { status: 400 },
      );
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "KhÃ´ng thá»ƒ cáº­p nháº­t review assessment.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { assessmentId } = await context.params;
    const [existing] = await db
      .select({ id: energySolarAssessments.id })
      .from(energySolarAssessments)
      .where(eq(energySolarAssessments.id, assessmentId))
      .limit(1);
    if (!existing)
      return NextResponse.json(
        { message: "KhÃ´ng tÃ¬m tháº¥y assessment Solar." },
        { status: 404 },
      );
    const [assessment] = await db
      .update(energySolarAssessments)
      .set({ status: "ARCHIVED" })
      .where(eq(energySolarAssessments.id, assessmentId))
      .returning({ id: energySolarAssessments.id, status: energySolarAssessments.status });
    return NextResponse.json({
      deleted: true,
      assessment,
      message: "Assessment Ä‘Ã£ Ä‘Æ°á»£c archive Ä‘á»ƒ báº£o toÃ n káº¿t quáº£ vÃ  provenance.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "KhÃ´ng thá»ƒ archive assessment Solar.",
      },
      { status: 400 },
    );
  }
}
