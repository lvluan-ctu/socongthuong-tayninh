import { count, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { energyAssets, energyGridIncidents } from "@/db/schema";
import { db } from "@/lib/db";
import { paginatedResponse, parsePagination } from "@/lib/pagination";

export const dynamic = "force-dynamic";

const incidentSchema = z
  .object({
    code: z.string().trim().min(2).max(120),
    assetId: z.string().uuid().nullable().optional(),
    incidentType: z.string().trim().min(2).max(120),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    startedAt: z.string().min(1),
    resolvedAt: z.string().nullable().optional(),
    status: z.enum(["OPEN", "INVESTIGATING", "RESTORING", "RESOLVED", "CLOSED"]).default("OPEN"),
    affectedCustomers: z.number().int().nonnegative().nullable().optional(),
    affectedLoadMw: z.number().nonnegative().nullable().optional(),
    cause: z.string().trim().max(2000).nullable().optional(),
    notes: z.string().max(3000).nullable().optional(),
  })
  .superRefine((value, context) => {
    const startedAt = value.startedAt ? new Date(value.startedAt) : null;
    const resolvedAt = value.resolvedAt ? new Date(value.resolvedAt) : null;
    if (startedAt && resolvedAt && resolvedAt < startedAt) {
      context.addIssue({
        code: "custom",
        path: ["resolvedAt"],
        message: "Thời điểm khôi phục không được trước lúc xảy ra.",
      });
    }
    if (["RESOLVED", "CLOSED"].includes(value.status) && !value.resolvedAt) {
      context.addIssue({
        code: "custom",
        path: ["resolvedAt"],
        message: "Sự cố đã xử lý phải có thời điểm khôi phục.",
      });
    }
  });

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const wantsPagination =
      params.get("options") !== "true" && (params.has("page") || params.has("pageSize"));
    const pagination = parsePagination(params);
    const listQuery = db
      .select({
        id: energyGridIncidents.id,
        code: energyGridIncidents.code,
        assetId: energyGridIncidents.assetId,
        assetCode: energyAssets.code,
        assetName: energyAssets.name,
        assetType: energyAssets.assetType,
        incidentType: energyGridIncidents.incidentType,
        severity: energyGridIncidents.severity,
        startedAt: energyGridIncidents.startedAt,
        resolvedAt: energyGridIncidents.resolvedAt,
        status: energyGridIncidents.status,
        affectedCustomers: energyGridIncidents.affectedCustomers,
        affectedLoadMw: energyGridIncidents.affectedLoadMw,
        cause: energyGridIncidents.cause,
        metadata: energyGridIncidents.metadata,
      })
      .from(energyGridIncidents)
      .leftJoin(energyAssets, eq(energyAssets.id, energyGridIncidents.assetId))
      .orderBy(desc(energyGridIncidents.startedAt));
    const rows = wantsPagination
      ? await listQuery.limit(pagination.pageSize).offset(pagination.offset)
      : await listQuery.limit(1000);
    const totalRows = wantsPagination
      ? await db.select({ value: count() }).from(energyGridIncidents)
      : [];
    const items = rows.map((row) => ({
      ...row,
      affectedCustomers: row.affectedCustomers == null ? null : Number(row.affectedCustomers),
      affectedLoadMw: row.affectedLoadMw == null ? null : Number(row.affectedLoadMw),
    }));
    return wantsPagination
      ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0))
      : NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể tải sự cố lưới điện." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = incidentSchema.parse(await request.json());
    const startedAt = parseDate(payload.startedAt);
    const resolvedAt = parseDate(payload.resolvedAt);
    if (!startedAt)
      return NextResponse.json(
        {
          message: "Thời điểm sự cố không hợp lệ.",
          issues: [{ path: ["startedAt"], message: "Thời điểm sự cố không hợp lệ." }],
        },
        { status: 400 },
      );
    if (payload.assetId) {
      const [asset] = await db
        .select({ id: energyAssets.id })
        .from(energyAssets)
        .where(eq(energyAssets.id, payload.assetId))
        .limit(1);
      if (!asset)
        return NextResponse.json(
          { message: "Không tìm thấy tài sản lưới liên quan." },
          { status: 404 },
        );
    }

    const [created] = await db
      .insert(energyGridIncidents)
      .values({
        code: payload.code,
        assetId: payload.assetId ?? null,
        incidentType: payload.incidentType,
        severity: payload.severity,
        startedAt,
        resolvedAt,
        status: payload.status,
        affectedCustomers:
          payload.affectedCustomers == null ? null : String(payload.affectedCustomers),
        affectedLoadMw: payload.affectedLoadMw == null ? null : String(payload.affectedLoadMw),
        cause: payload.cause ?? null,
        metadata: { notes: payload.notes ?? null, source: "MANUAL" },
      })
      .returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { message: "Thông tin sự cố không hợp lệ.", issues: error.issues },
        { status: 400 },
      );
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể lưu sự cố." },
      { status: 400 },
    );
  }
}
