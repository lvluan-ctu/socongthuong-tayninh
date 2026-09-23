import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await db.execute(sql`
      INSERT INTO energy_power_structures (
        asset_id, position_id, line_asset_id, structure_type, circuit_count,
        grounding_resistance_ohm, technical_specs
      )
      SELECT
        lp.asset_id,
        lp.id,
        lp.line_asset_id,
        CASE
          WHEN COALESCE(pl.voltage_level_kv, 0) >= 110 THEN 'TOWER'
          ELSE 'POLE'
        END,
        lp.circuit_count,
        lp.grounding_resistance_ohm,
        COALESCE(lp.metadata, '{}'::jsonb)
      FROM energy_line_positions lp
      LEFT JOIN energy_power_lines pl ON pl.asset_id = lp.line_asset_id
      WHERE lp.asset_id IS NOT NULL
      ON CONFLICT (asset_id) DO UPDATE SET
        position_id = EXCLUDED.position_id,
        line_asset_id = EXCLUDED.line_asset_id,
        circuit_count = EXCLUDED.circuit_count,
        grounding_resistance_ohm = EXCLUDED.grounding_resistance_ohm,
        technical_specs = EXCLUDED.technical_specs
      RETURNING asset_id
    `);
    return NextResponse.json({ updated: result.rows.length, message: `Đã chuẩn hóa ${result.rows.length} trụ/cột/tháp từ vị trí tuyến.` });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể chuẩn hóa trụ điện.' }, { status: 500 });
  }
}
