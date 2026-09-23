import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { energyAssets, energyGridIncidents } from "@/db/schema";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ incidentId: string }> };

const patchSchema = z.object({
  code: z.string().trim().min(2).max(120).optional(),
  assetId: z.string().uuid().nullable().optional(),
  incidentType: z.string().trim().min(2).max(120).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  startedAt: z.string().min(1).optional(),
  resolvedAt: z.string().nullable().optional(),
  status: z.enum(["OPEN", "INVESTIGATING", "RESTORING", "RESOLVED", "CLOSED"]).optional(),
  affectedCustomers: z.number().int().nonnegative().nullable().optional(),
  affectedLoadMw: z.number().nonnegative().nullable().optional(),
  cause: z.string().trim().max(2000).nullable().optional(),
  notes: z.string().max(3000).nullable().optional(),
});

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function load(incidentId: string) {
  const [item] = await db
    .select()
    .from(energyGridIncidents)
    .where(eq(energyGridIncidents.id, incidentId))
    .limit(1);
  return item ?? null;
}

export async function GET(_request: Request, context: Context) {
  try {
    const { incidentId } = await context.params;
    z.string().uuid().parse(incidentId);
    const item = await load(incidentId);
    return item
      ? NextResponse.json({ item })
      : NextResponse.json({ message: "Không tìm thấy sự cố." }, { status: 404 });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { message: "Mã sự cố không hợp lệ.", issues: error.issues },
        { status: 400 },
      );
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể tải sự cố." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { incidentId } = await context.params;
    z.string().uuid().parse(incidentId);
    const payload = patchSchema.parse(await request.json());
    const existing = await load(incidentId);
    if (!existing) return NextResponse.json({ message: "Không tìm thấy sự cố." }, { status: 404 });

    const startedAt =
      payload.startedAt === undefined ? existing.startedAt : parseDate(payload.startedAt);
    const resolvedAt =
      payload.resolvedAt === undefined ? existing.resolvedAt : parseDate(payload.resolvedAt);
    const status = payload.status ?? existing.status;
    if (!startedAt)
      return NextResponse.json(
        {
          message: "Thời điểm xảy ra không hợp lệ.",
          issues: [{ path: ["startedAt"], message: "Thời điểm xảy ra không hợp lệ." }],
        },
        { status: 400 },
      );
    if (resolvedAt && resolvedAt < startedAt)
      return NextResponse.json(
        {
          message: "Thời điểm khôi phục không hợp lệ.",
          issues: [
            { path: ["resolvedAt"], message: "Thời điểm khôi phục không được trước lúc xảy ra." },
          ],
        },
        { status: 400 },
      );
    if (["RESOLVED", "CLOSED"].includes(status) && !resolvedAt)
      return NextResponse.json(
        {
          message: "Sự cố đã xử lý phải có thời điểm khôi phục.",
          issues: [{ path: ["resolvedAt"], message: "Nhập thời điểm khôi phục." }],
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

    const metadata =
      existing.metadata && typeof existing.metadata === "object"
        ? (existing.metadata as Record<string, unknown>)
        : {};
    const [updated] = await db
      .update(energyGridIncidents)
      .set({
        ...(payload.code !== undefined ? { code: payload.code } : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, "assetId")
          ? { assetId: payload.assetId ?? null }
          : {}),
        ...(payload.incidentType !== undefined ? { incidentType: payload.incidentType } : {}),
        ...(payload.severity !== undefined ? { severity: payload.severity } : {}),
        startedAt,
        resolvedAt,
        status,
        ...(Object.prototype.hasOwnProperty.call(payload, "affectedCustomers")
          ? {
              affectedCustomers:
                payload.affectedCustomers == null ? null : String(payload.affectedCustomers),
            }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, "affectedLoadMw")
          ? {
              affectedLoadMw:
                payload.affectedLoadMw == null ? null : String(payload.affectedLoadMw),
            }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(payload, "cause")
          ? { cause: payload.cause ?? null }
          : {}),
        metadata: {
          ...metadata,
          ...(Object.prototype.hasOwnProperty.call(payload, "notes")
            ? { notes: payload.notes ?? null }
            : {}),
        },
      })
      .where(eq(energyGridIncidents.id, incidentId))
      .returning();
    return NextResponse.json({ item: updated });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { message: "Thông tin sự cố không hợp lệ.", issues: error.issues },
        { status: 400 },
      );
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể cập nhật sự cố." },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { incidentId } = await context.params;
    z.string().uuid().parse(incidentId);
    const existing = await load(incidentId);
    if (!existing) return NextResponse.json({ message: "Không tìm thấy sự cố." }, { status: 404 });
    const metadata =
      existing.metadata && typeof existing.metadata === "object"
        ? (existing.metadata as Record<string, unknown>)
        : {};
    const [updated] = await db
      .update(energyGridIncidents)
      .set({
        status: "CLOSED",
        resolvedAt: existing.resolvedAt ?? new Date(),
        metadata: { ...metadata, archived: true, archivedAt: new Date().toISOString() },
      })
      .where(eq(energyGridIncidents.id, incidentId))
      .returning({ id: energyGridIncidents.id, status: energyGridIncidents.status });
    return NextResponse.json({ item: updated, archived: true });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { message: "Mã sự cố không hợp lệ.", issues: error.issues },
        { status: 400 },
      );
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể archive sự cố." },
      { status: 400 },
    );
  }
}
