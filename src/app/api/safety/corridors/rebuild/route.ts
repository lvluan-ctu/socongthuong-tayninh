import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyProtectionCorridors } from '@/db/schema';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const querySchema = z.object({ asOf: z.string().trim().min(1).optional() });

function parseDate(value: string | undefined) {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

type RebuildCandidate = {
  assetId: string;
  voltageLevelKv: number | string;
  lineType: string;
  ruleId: string;
  regulationCode: string;
  regulationVersionNo: number;
  regulationEffectiveFrom: Date | string;
  regulationEffectiveTo: Date | string | null;
  ruleValidFrom: Date | string | null;
  ruleValidTo: Date | string | null;
  calculationMethod: string | null;
  bufferM: number | string | null;
  sourceLineGeometryHash: string;
};

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const query = querySchema.parse({ asOf: url.searchParams.get('asOf') ?? undefined });
    const asOf = parseDate(query.asOf);
    if (!asOf) return NextResponse.json({ message: 'asOf is invalid.', issues: [{ path: ['asOf'], message: 'Use an ISO date/time.' }] }, { status: 400 });

    const result = await db.execute(sql`
      SELECT pl.asset_id AS "assetId",
             pl.voltage_level_kv::double precision AS "voltageLevelKv",
             pl.line_type AS "lineType",
             rule.id AS "ruleId",
             rule.regulation_code AS "regulationCode",
             rule.regulation_version_no AS "regulationVersionNo",
             rule.regulation_effective_from AS "regulationEffectiveFrom",
             rule.regulation_effective_to AS "regulationEffectiveTo",
             rule.valid_from AS "ruleValidFrom",
             rule.valid_to AS "ruleValidTo",
             COALESCE(rule.calculation_method, 'ST_BUFFER_GEOGRAPHY_METERS') AS "calculationMethod",
             COALESCE(rule.corridor_width_m / 2.0, rule.horizontal_clearance_m)::double precision AS "bufferM",
             md5(ST_AsEWKT(pl.geometry)) AS "sourceLineGeometryHash"
      FROM energy_power_lines pl
      JOIN LATERAL (
        SELECT cr.*, sr.code AS regulation_code, sr.version_no AS regulation_version_no,
               sr.effective_from AS regulation_effective_from, sr.effective_to AS regulation_effective_to
        FROM energy_clearance_rules cr
        JOIN energy_safety_regulations sr ON sr.id = cr.regulation_id
        WHERE sr.status = 'ACTIVE'
          AND sr.effective_from <= ${asOf}
          AND (sr.effective_to IS NULL OR sr.effective_to >= ${asOf})
          AND (cr.valid_from IS NULL OR cr.valid_from <= ${asOf})
          AND (cr.valid_to IS NULL OR cr.valid_to >= ${asOf})
          AND cr.voltage_level_kv = pl.voltage_level_kv
          AND (cr.line_type IS NULL OR cr.line_type = pl.line_type)
          AND COALESCE(cr.corridor_width_m / 2.0, cr.horizontal_clearance_m) IS NOT NULL
        ORDER BY cr.priority ASC,
                 sr.effective_from DESC,
                 CASE WHEN cr.line_type = pl.line_type THEN 0 ELSE 1 END,
                 cr.id
        LIMIT 1
      ) rule ON TRUE
      WHERE pl.geometry IS NOT NULL
    `);

    let created = 0;
    let updated = 0;
    let versionsCreated = 0;
    const skipped: Array<{ assetId: string; reason: string }> = [];

    for (const raw of result.rows as RebuildCandidate[]) {
      const bufferM = Number(raw.bufferM);
      if (!Number.isFinite(bufferM) || bufferM <= 0) {
        skipped.push({ assetId: raw.assetId, reason: 'BUFFER_INVALID' });
        continue;
      }
      const ruleVersion = `${raw.regulationCode}@v${raw.regulationVersionNo}`;
      const calculationMethod = raw.calculationMethod ?? 'ST_BUFFER_GEOGRAPHY_METERS';
      const validFrom = raw.ruleValidFrom ?? raw.regulationEffectiveFrom;
      const validTo = raw.ruleValidTo ?? raw.regulationEffectiveTo ?? null;
      const inputSnapshot = {
        source: 'energy_power_lines',
        sourceLineGeometryHash: raw.sourceLineGeometryHash,
        assetId: raw.assetId,
        ruleId: raw.ruleId,
        regulationCode: raw.regulationCode,
        regulationVersionNo: raw.regulationVersionNo,
        voltageLevelKv: Number(raw.voltageLevelKv),
        lineType: raw.lineType,
        bufferM,
        asOf: asOf.toISOString(),
      };
      const now = new Date();

      await db.transaction(async (tx) => {
        const [existing] = await tx.select().from(energyProtectionCorridors)
          .where(eq(energyProtectionCorridors.assetId, raw.assetId)).limit(1);
        let corridorId: string;
        let versionNo: number;

        if (existing) {
          corridorId = existing.id;
          versionNo = Number(existing.versionNo) + 1;
          const legacyVersion = await tx.execute(sql`
            SELECT id FROM energy_protection_corridor_versions
            WHERE corridor_id = ${corridorId}::uuid
            LIMIT 1
          `);
          if (!legacyVersion.rows.length) {
            await tx.execute(sql`
              INSERT INTO energy_protection_corridor_versions
                (id, corridor_id, asset_id, rule_id, version_no, geometry, source_line_geometry_hash,
                 rule_version, calculated_at, valid_from, valid_to, calculation_method, input_snapshot)
              SELECT gen_random_uuid(), c.id, c.asset_id, c.rule_id, c.version_no, c.geometry,
                     c.source_line_geometry_hash, c.rule_version, c.calculated_at, c.valid_from,
                     c.valid_to, COALESCE(c.calculation_method, 'LEGACY_CORRIDOR_SNAPSHOT'), c.input_snapshot
              FROM energy_protection_corridors c
              WHERE c.id = ${corridorId}::uuid
              ON CONFLICT (corridor_id, version_no) DO NOTHING
            `);
            versionsCreated += 1;
          }
          await tx.execute(sql`
            UPDATE energy_protection_corridors c
            SET rule_id = ${raw.ruleId}::uuid,
                geometry = ST_Buffer(pl.geometry::geography, ${bufferM})::geometry,
                status = 'ACTIVE', version_no = ${versionNo},
                source_line_geometry_hash = ${raw.sourceLineGeometryHash}, rule_version = ${ruleVersion},
                calculated_at = ${now}, valid_from = ${validFrom}, valid_to = ${validTo},
                calculation_method = ${calculationMethod}, input_snapshot = ${JSON.stringify(inputSnapshot)}::jsonb,
                updated_at = ${now}
            FROM energy_power_lines pl
            WHERE c.id = ${corridorId}::uuid AND pl.asset_id = ${raw.assetId}::uuid
          `);
          updated += 1;
        } else {
          versionNo = 1;
          const inserted = await tx.execute(sql`
            INSERT INTO energy_protection_corridors
              (id, asset_id, rule_id, geometry, status, version_no, source_line_geometry_hash,
               rule_version, calculated_at, valid_from, valid_to, calculation_method, input_snapshot)
            SELECT gen_random_uuid(), pl.asset_id, ${raw.ruleId}::uuid,
                   ST_Buffer(pl.geometry::geography, ${bufferM})::geometry,
                   'ACTIVE', 1, ${raw.sourceLineGeometryHash}, ${ruleVersion}, ${now},
                   ${validFrom}, ${validTo}, ${calculationMethod}, ${JSON.stringify(inputSnapshot)}::jsonb
            FROM energy_power_lines pl
            WHERE pl.asset_id = ${raw.assetId}::uuid
            RETURNING id
          `);
          const insertedRow = inserted.rows[0] as { id?: string } | undefined;
          if (!insertedRow?.id) throw new Error(`Could not create corridor for asset ${raw.assetId}.`);
          corridorId = insertedRow.id;
          created += 1;
        }

        await tx.execute(sql`
          INSERT INTO energy_protection_corridor_versions
            (id, corridor_id, asset_id, rule_id, version_no, geometry, source_line_geometry_hash,
             rule_version, calculated_at, valid_from, valid_to, calculation_method, input_snapshot)
          SELECT gen_random_uuid(), c.id, c.asset_id, c.rule_id, c.version_no, c.geometry,
                 ${raw.sourceLineGeometryHash}, ${ruleVersion}, ${now}, ${validFrom}, ${validTo},
                 ${calculationMethod}, ${JSON.stringify(inputSnapshot)}::jsonb
          FROM energy_protection_corridors c
          WHERE c.id = ${corridorId}::uuid
          ON CONFLICT (corridor_id, version_no) DO NOTHING
        `);
        versionsCreated += 1;
      });
    }

    return NextResponse.json({ created, updated, versionsCreated, skipped, asOf: asOf.toISOString(), message: `Rebuilt ${created + updated} protection corridors from active versioned rules.` });
  } catch (error) {
    console.error('Rebuild protection corridors failed', error);
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Rebuild parameters are invalid.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not rebuild protection corridors.' }, { status: 500 });
  }
}
