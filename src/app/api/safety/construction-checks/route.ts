import { count, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyAssets, energyConstructionClearanceChecks } from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const schema = z.object({
  caseCode: z.string().trim().min(2).max(120),
  applicantName: z.string().trim().max(250).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  structureType: z.string().trim().max(100).default('BUILDING'),
  reviewedBy: z.string().trim().max(200).nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const wantsPagination = params.has('page') || params.has('pageSize');
    const pagination = parsePagination(params);
    const listQuery = db.select({
      id: energyConstructionClearanceChecks.id,
      caseCode: energyConstructionClearanceChecks.caseCode,
      applicantName: energyConstructionClearanceChecks.applicantName,
      address: energyConstructionClearanceChecks.address,
      nearestGridAssetId: energyConstructionClearanceChecks.nearestGridAssetId,
      nearestGridAssetName: energyAssets.name,
      nearestDistanceM: energyConstructionClearanceChecks.nearestDistanceM,
      requiredClearanceM: energyConstructionClearanceChecks.requiredClearanceM,
      result: energyConstructionClearanceChecks.result,
      ruleId: energyConstructionClearanceChecks.ruleId,
      reviewedBy: energyConstructionClearanceChecks.reviewedBy,
      reviewedAt: energyConstructionClearanceChecks.reviewedAt,
      explanation: energyConstructionClearanceChecks.explanation,
    }).from(energyConstructionClearanceChecks)
      .leftJoin(energyAssets, eq(energyAssets.id, energyConstructionClearanceChecks.nearestGridAssetId))
      .orderBy(desc(energyConstructionClearanceChecks.reviewedAt));
    const rows = wantsPagination
      ? await listQuery.limit(pagination.pageSize).offset(pagination.offset)
      : await listQuery.limit(500);
    const [totalRows, summaryRows] = wantsPagination
      ? await Promise.all([
        db.select({ value: count() }).from(energyConstructionClearanceChecks),
        db.select({
          passed: sql<number>`COUNT(*) FILTER (WHERE ${energyConstructionClearanceChecks.result} = 'PASS')`,
          failed: sql<number>`COUNT(*) FILTER (WHERE ${energyConstructionClearanceChecks.result} = 'FAIL')`,
          needsRule: sql<number>`COUNT(*) FILTER (WHERE ${energyConstructionClearanceChecks.result} = 'NEEDS_RULE')`,
        }).from(energyConstructionClearanceChecks),
      ])
      : [[], []];
    const items = rows.map((row) => ({
      ...row,
      nearestDistanceM: row.nearestDistanceM == null ? null : Number(row.nearestDistanceM),
      requiredClearanceM: row.requiredClearanceM == null ? null : Number(row.requiredClearanceM),
    }));
    const summary = summaryRows[0]
      ? { passed: Number(summaryRows[0].passed ?? 0), failed: Number(summaryRows[0].failed ?? 0), needsRule: Number(summaryRows[0].needsRule ?? 0) }
      : undefined;
    return wantsPagination
      ? paginatedResponse(items, pagination, Number(totalRows[0]?.value ?? 0), { summary })
      : NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải lịch sử kiểm tra xây dựng.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const pointWkt = `SRID=4326;POINT(${payload.longitude} ${payload.latitude})`;

    const nearestResult = await db.execute(sql`
      SELECT a.id AS "assetId", a.code, a.name,
             pl.voltage_level_kv::double precision AS "voltageLevelKv",
             pl.line_type AS "lineType",
             ST_Distance(ST_SetSRID(ST_Point(${payload.longitude}, ${payload.latitude}),4326)::geography, pl.geometry::geography)::double precision AS "distanceM"
      FROM energy_power_lines pl
      JOIN energy_assets a ON a.id = pl.asset_id
      WHERE pl.geometry IS NOT NULL
      ORDER BY ST_Distance(ST_SetSRID(ST_Point(${payload.longitude}, ${payload.latitude}),4326)::geography, pl.geometry::geography)
      LIMIT 1
    `);
    const nearest = nearestResult.rows[0] as { assetId?: string; code?: string; name?: string; voltageLevelKv?: number|string; lineType?: string|null; distanceM?: number|string } | undefined;
    if (!nearest?.assetId) return NextResponse.json({ message: 'Không tìm thấy đường dây có geometry để kiểm tra.' }, { status: 422 });

    const ruleResult = await db.execute(sql`
      SELECT cr.id AS "ruleId",
             cr.horizontal_clearance_m::double precision AS "horizontalClearanceM",
             cr.vertical_clearance_m::double precision AS "verticalClearanceM",
             cr.corridor_width_m::double precision AS "corridorWidthM",
             sr.code AS "regulationCode", sr.name AS "regulationName", sr.legal_document_ref AS "legalDocumentRef"
      FROM energy_clearance_rules cr
      JOIN energy_safety_regulations sr ON sr.id = cr.regulation_id
      WHERE sr.status = 'ACTIVE'
        AND cr.voltage_level_kv = ${Number(nearest.voltageLevelKv)}
        AND (cr.line_type IS NULL OR cr.line_type = ${nearest.lineType ?? null})
        AND (cr.structure_type IS NULL OR cr.structure_type = ${payload.structureType})
      ORDER BY sr.effective_from DESC,
               CASE WHEN cr.line_type = ${nearest.lineType ?? null} THEN 0 ELSE 1 END,
               CASE WHEN cr.structure_type = ${payload.structureType} THEN 0 ELSE 1 END
      LIMIT 1
    `);
    const rule = ruleResult.rows[0] as {
      ruleId?: string; horizontalClearanceM?: number|string|null; corridorWidthM?: number|string|null;
      regulationCode?: string; regulationName?: string; legalDocumentRef?: string;
    } | undefined;

    const nearestDistanceM = Number(nearest.distanceM ?? 0);
    const requiredClearanceM = rule
      ? Number(rule.horizontalClearanceM ?? (rule.corridorWidthM == null ? 0 : Number(rule.corridorWidthM) / 2))
      : null;
    const result = !rule ? 'NEEDS_RULE' : nearestDistanceM >= Number(requiredClearanceM) ? 'PASS' : 'FAIL';
    const explanation = {
      mode: 'POINT_TO_NEAREST_POWER_LINE',
      input: { latitude: payload.latitude, longitude: payload.longitude, structureType: payload.structureType },
      nearestLine: { assetId: nearest.assetId, code: nearest.code, name: nearest.name, voltageLevelKv: Number(nearest.voltageLevelKv), lineType: nearest.lineType },
      regulation: rule ? { code: rule.regulationCode, name: rule.regulationName, legalDocumentRef: rule.legalDocumentRef } : null,
      note: result === 'NEEDS_RULE'
        ? 'Chưa có rule có hiệu lực phù hợp cấp điện áp/loại tuyến/công trình; không được tự kết luận đạt.'
        : 'Kết quả sơ bộ theo khoảng cách điểm đại diện. Hồ sơ cấp phép chính thức cần đối chiếu polygon công trình và khảo sát chuyên môn.',
    };

    const [created] = await db.insert(energyConstructionClearanceChecks).values({
      caseCode: payload.caseCode,
      applicantName: payload.applicantName ?? null,
      address: payload.address ?? null,
      proposedGeometry: pointWkt,
      nearestGridAssetId: nearest.assetId,
      nearestDistanceM: String(nearestDistanceM),
      requiredClearanceM: requiredClearanceM == null ? null : String(requiredClearanceM),
      result,
      ruleId: rule?.ruleId ?? null,
      reviewedBy: payload.reviewedBy ?? null,
      reviewedAt: payload.reviewedBy ? new Date() : null,
      explanation,
    }).returning();

    return NextResponse.json({
      check: { ...created, nearestDistanceM, requiredClearanceM },
      nearestLine: explanation.nearestLine,
      regulation: explanation.regulation,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin hồ sơ kiểm tra không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể kiểm tra hành lang.' }, { status: 400 });
  }
}
