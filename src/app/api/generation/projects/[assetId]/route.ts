import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { energyAssets, energyGenerationProjects, energyParties, energySites } from "@/db/schema";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ assetId: string }> };

const patchSchema = z
  .object({
    name: z.string().trim().min(3).max(250).optional(),
    operationStatus: z
      .enum([
        "PLANNED",
        "PREPARING_INVESTMENT",
        "CONSTRUCTION",
        "OPERATING",
        "ACTIVE",
        "SUSPENDED",
        "DECOMMISSIONED",
      ])
      .optional(),
    designedCapacityMw: z.number().positive().optional(),
    actualCapacityMw: z.number().nonnegative().nullable().optional(),
    gridConnectionAssetId: z.string().uuid().nullable().optional(),
    commissionedAt: z.string().nullable().optional(),
    address: z.string().max(500).nullable().optional(),
    adminAreaCode: z.string().max(50).nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    technology: z.string().max(250).nullable().optional(),
    unitCount: z.number().int().nonnegative().nullable().optional(),
    notes: z.string().max(4000).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (
      (value.latitude == null) !== (value.longitude == null) &&
      (value.latitude !== undefined || value.longitude !== undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: [value.latitude == null ? "latitude" : "longitude"],
        message: "Phải nhập đủ latitude và longitude.",
      });
    }
    if (value.operationStatus === "OPERATING" && !value.commissionedAt) {
      context.addIssue({
        code: "custom",
        path: ["commissionedAt"],
        message: "Dự án đang vận hành phải có ngày vận hành.",
      });
    }
    if (value.operationStatus === "OPERATING" && value.actualCapacityMw == null) {
      context.addIssue({
        code: "custom",
        path: ["actualCapacityMw"],
        message: "Nhập công suất thực tế của dự án đang vận hành.",
      });
    }
  });

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00+07:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function loadProject(assetId: string) {
  const [row] = await db
    .select({
      assetId: energyGenerationProjects.assetId,
      code: energyAssets.code,
      name: energyAssets.name,
      assetStatus: energyAssets.status,
      commissionedAt: energyAssets.commissionedAt,
      metadata: energyAssets.metadata,
      siteId: energyGenerationProjects.siteId,
      siteCode: energySites.code,
      siteName: energySites.name,
      address: energySites.address,
      adminAreaCode: energySites.adminAreaCode,
      latitude: sql<
        number | null
      >`CASE WHEN ${energyAssets.location} IS NULL THEN NULL ELSE ST_Y(${energyAssets.location}::geometry) END`,
      longitude: sql<
        number | null
      >`CASE WHEN ${energyAssets.location} IS NULL THEN NULL ELSE ST_X(${energyAssets.location}::geometry) END`,
      sourceType: energyGenerationProjects.sourceType,
      designedCapacityMw: energyGenerationProjects.designedCapacityMw,
      actualCapacityMw: energyGenerationProjects.actualCapacityMw,
      operationStatus: energyGenerationProjects.operationStatus,
      investorPartyId: energyGenerationProjects.investorPartyId,
      operatorPartyId: energyGenerationProjects.operatorPartyId,
      gridConnectionAssetId: energyGenerationProjects.gridConnectionAssetId,
      technicalSpecs: energyGenerationProjects.technicalSpecs,
    })
    .from(energyGenerationProjects)
    .innerJoin(energyAssets, eq(energyAssets.id, energyGenerationProjects.assetId))
    .leftJoin(energySites, eq(energySites.id, energyGenerationProjects.siteId))
    .where(eq(energyGenerationProjects.assetId, assetId))
    .limit(1);

  if (!row) return null;

  const partyIds = [row.investorPartyId, row.operatorPartyId].filter((id): id is string =>
    Boolean(id),
  );
  const parties = partyIds.length
    ? await db
        .select({ id: energyParties.id, code: energyParties.code, name: energyParties.name })
        .from(energyParties)
    : [];
  const map = new Map(parties.map((party) => [party.id, party]));

  return {
    ...row,
    designedCapacityMw: Number(row.designedCapacityMw),
    actualCapacityMw: row.actualCapacityMw == null ? null : Number(row.actualCapacityMw),
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    investor: row.investorPartyId ? (map.get(row.investorPartyId) ?? null) : null,
    operator: row.operatorPartyId ? (map.get(row.operatorPartyId) ?? null) : null,
  };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { assetId } = await context.params;
    const project = await loadProject(assetId);
    if (!project)
      return NextResponse.json({ message: "Không tìm thấy dự án nguồn điện." }, { status: 404 });
    return NextResponse.json(project);
  } catch (error) {
    console.error("Generation project detail failed", error);
    return NextResponse.json({ message: "Không thể tải hồ sơ Project 360." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { assetId } = await context.params;
    const payload = patchSchema.parse(await request.json());
    const current = await loadProject(assetId);
    if (!current)
      return NextResponse.json({ message: "Không tìm thấy dự án nguồn điện." }, { status: 404 });

    const location =
      payload.latitude != null && payload.longitude != null
        ? `SRID=4326;POINT(${payload.longitude} ${payload.latitude})`
        : undefined;

    await db.transaction(async (tx) => {
      await tx
        .update(energyAssets)
        .set({
          name: payload.name ?? current.name,
          status:
            ["OPERATING", "ACTIVE"].includes(payload.operationStatus ?? "")
              ? "ACTIVE"
              : (payload.operationStatus ?? current.assetStatus),
          commissionedAt:
            payload.commissionedAt !== undefined
              ? parseDate(payload.commissionedAt)
              : current.commissionedAt,
          location,
          updatedAt: new Date(),
        })
        .where(eq(energyAssets.id, assetId));

      const currentSpecs =
        current.technicalSpecs && typeof current.technicalSpecs === "object"
          ? (current.technicalSpecs as Record<string, unknown>)
          : {};

      await tx
        .update(energyGenerationProjects)
        .set({
          operationStatus: payload.operationStatus ?? current.operationStatus,
          designedCapacityMw:
            payload.designedCapacityMw == null
              ? current.designedCapacityMw.toString()
              : String(payload.designedCapacityMw),
          actualCapacityMw:
            payload.actualCapacityMw === undefined
              ? current.actualCapacityMw == null
                ? null
                : String(current.actualCapacityMw)
              : payload.actualCapacityMw == null
                ? null
                : String(payload.actualCapacityMw),
          gridConnectionAssetId:
            payload.gridConnectionAssetId === undefined
              ? current.gridConnectionAssetId
              : payload.gridConnectionAssetId,
          technicalSpecs: {
            ...currentSpecs,
            technology:
              payload.technology === undefined ? currentSpecs.technology : payload.technology,
            unitCount: payload.unitCount === undefined ? currentSpecs.unitCount : payload.unitCount,
            notes: payload.notes === undefined ? currentSpecs.notes : payload.notes,
          },
        })
        .where(eq(energyGenerationProjects.assetId, assetId));

      if (current.siteId) {
        await tx
          .update(energySites)
          .set({
            address: payload.address === undefined ? current.address : payload.address,
            adminAreaCode:
              payload.adminAreaCode === undefined ? current.adminAreaCode : payload.adminAreaCode,
            location,
            updatedAt: new Date(),
          })
          .where(eq(energySites.id, current.siteId));
      }
    });

    const updated = await loadProject(assetId);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { message: "Dữ liệu cập nhật dự án không hợp lệ.", issues: error.issues },
        { status: 400 },
      );
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể cập nhật dự án nguồn." },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { assetId } = await context.params;
    const current = await loadProject(assetId);
    if (!current)
      return NextResponse.json({ message: "Không tìm thấy dự án nguồn điện." }, { status: 404 });
    await db.transaction(async (tx) => {
      await tx
        .update(energyGenerationProjects)
        .set({ operationStatus: "DECOMMISSIONED" })
        .where(eq(energyGenerationProjects.assetId, assetId));
      await tx
        .update(energyAssets)
        .set({ status: "DECOMMISSIONED", updatedAt: new Date() })
        .where(eq(energyAssets.id, assetId));
      if (current.siteId) {
        await tx
          .update(energySites)
          .set({ status: "INACTIVE", updatedAt: new Date() })
          .where(eq(energySites.id, current.siteId));
      }
    });
    return NextResponse.json({ archived: true, assetId, status: "DECOMMISSIONED" });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Không thể ngừng khai thác dự án nguồn.",
      },
      { status: 400 },
    );
  }
}
