import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  at: z.string().datetime({ offset: true }).optional(),
});

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse(Object.fromEntries(params));
  if (!parsed.success) {
    return NextResponse.json({ message: "Vui lòng nhập đúng vĩ độ, kinh độ và thời điểm tra cứu.", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    let latitude = parsed.data.latitude;
    let longitude = parsed.data.longitude;
    let at = parsed.data.at ? new Date(parsed.data.at) : new Date();
    let demoAddress: string | null = null;
    if (params.get("demo") === "true") {
      const demo = await db.execute(sql`
        SELECT ST_Y(ST_PointOnSurface(affected_geometry)::geometry) AS latitude,
          ST_X(ST_PointOnSurface(affected_geometry)::geometry) AS longitude,
          start_at + interval '1 hour' AS at
        FROM energy_outage_plans
        WHERE code LIKE 'NV5-OUTAGE-%' AND affected_geometry IS NOT NULL
        ORDER BY start_at ASC LIMIT 1
      `);
      const row = demo.rows[0] as Record<string, unknown> | undefined;
      if (row) {
        latitude = Number(row.latitude);
        longitude = Number(row.longitude);
        at = new Date(String(row.at));
        demoAddress = "Quán cơm chay Âu Lạc, gần tuyến đường dây 110kV Long An";
      }
    }
    if (latitude == null || longitude == null) {
      return NextResponse.json({ message: "Vui lòng nhập đủ vĩ độ và kinh độ vị trí nhà." }, { status: 400 });
    }
    const result = await db.execute(sql`
      SELECT o.id::text, o.code, o.title, o.source, o.source_type AS "sourceType",
        o.status, o.start_at AS "startAt", o.end_at AS "endAt",
        o.affected_customers::double precision AS "affectedCustomers",
        o.reason, o.impact_method AS "impactMethod",
        EXISTS (
          SELECT 1 FROM energy_outage_affected_areas oa
          WHERE oa.outage_id = o.id
        ) AS "hasAffectedAreas"
      FROM energy_outage_plans o
      WHERE o.status <> 'ARCHIVED'
        AND o.start_at <= ${at}
        AND o.end_at > ${at}
        AND o.affected_geometry IS NOT NULL
        AND ST_Intersects(
          o.affected_geometry,
          ST_SetSRID(ST_Point(${longitude}, ${latitude}), 4326)
        )
      ORDER BY o.start_at ASC
    `);
    const items = (result.rows as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      code: String(row.code ?? ""),
      title: String(row.title ?? ""),
      source: String(row.source ?? ""),
      sourceType: String(row.sourceType ?? ""),
      status: String(row.status ?? ""),
      startAt: row.startAt,
      endAt: row.endAt,
      affectedCustomers: row.affectedCustomers == null ? null : Number(row.affectedCustomers),
      reason: row.reason == null ? null : String(row.reason),
      impactMethod: String(row.impactMethod ?? "NOT_CALCULATED"),
      hasAffectedAreas: Boolean(row.hasAffectedAreas),
    }));
    return NextResponse.json({
      checkedAt: at.toISOString(),
      location: { latitude, longitude },
      demoAddress,
      affected: items.length > 0,
      items,
      note: items.some((item) => item.impactMethod === "RADIUS_ESTIMATE")
        ? "Một hoặc nhiều kết quả là phạm vi bán kính dự kiến, cần đối chiếu thông báo chính thức của đơn vị điện lực."
        : "Kết quả dựa trên vùng ảnh hưởng đã được công bố trong hệ thống.",
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Không thể tra cứu lịch cắt điện." }, { status: 500 });
  }
}
