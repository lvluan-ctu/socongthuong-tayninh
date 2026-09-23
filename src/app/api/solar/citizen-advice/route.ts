import { randomUUID } from "node:crypto";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { energySolarConsultations } from "@/db/schema";
import { db } from "@/lib/db";
import {
  calculateCitizenSolar,
  SOLAR_METHOD_VERSION,
  type CitizenSolarInput,
} from "@/lib/citizen-solar";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  customerName: z.string().trim().max(160).optional().default(""),
  district: z.string().trim().max(160).optional().default(""),
  propertyType: z.enum(["townhouse", "villa", "garden", "business"]),
  monthlyBillVnd: z.coerce.number().min(100_000).max(1_000_000_000),
  roofSize: z.enum(["small", "medium", "large", "custom"]),
  roofAreaM2: z.coerce.number().min(10).max(500).optional(),
  wantsBattery: z.boolean(),
  batteryPriority: z.enum(["evening", "backup"]).optional(),
}).superRefine((value, context) => {
  if (value.roofSize === "custom" && value.roofAreaM2 == null) {
    context.addIssue({ code: "custom", path: ["roofAreaM2"], message: "Vui lòng nhập diện tích mái." });
  }
  if (value.wantsBattery && !value.batteryPriority) {
    context.addIssue({ code: "custom", path: ["batteryPriority"], message: "Vui lòng chọn mục đích dùng pin." });
  }
});

export async function GET(request: Request) {
  try {
    const limit = Math.max(1, Math.min(100, Number(new URL(request.url).searchParams.get("limit") ?? 30)));
    const items = await db.select().from(energySolarConsultations)
      .orderBy(desc(energySolarConsultations.createdAt))
      .limit(limit);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Không thể tải lịch sử tư vấn." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json()) as CitizenSolarInput;
    const result = calculateCitizenSolar(input);
    const now = new Date();
    const code = `TVMT-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const designState = {
      roofAreaM2: result.roofAreaM2,
      panelCount: result.panelCount,
      capacityKwp: result.recommendedCapacityKwp,
      batteryKwh: result.batteryKwh,
      propertyType: input.propertyType,
    };
    const [item] = await db.insert(energySolarConsultations).values({
      code,
      customerName: input.customerName || null,
      district: input.district || null,
      propertyType: input.propertyType,
      monthlyBillVnd: String(input.monthlyBillVnd),
      roofSize: input.roofSize,
      roofAreaM2: String(result.roofAreaM2),
      wantsBattery: input.wantsBattery,
      batteryPriority: input.wantsBattery ? input.batteryPriority : null,
      result,
      designState,
      methodVersion: SOLAR_METHOD_VERSION,
      createdAt: now,
      updatedAt: now,
    }).returning();
    return NextResponse.json({ item, result }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ.", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : "Không thể tạo tư vấn." }, { status: 500 });
  }
}
