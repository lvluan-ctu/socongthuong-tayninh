import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await db.execute(sql`
      UPDATE energy_power_lines AS line
      SET geometry = source.geometry
      FROM (
        SELECT
          line_asset_id,
          ST_MakeLine(location::geometry ORDER BY sequence_no) AS geometry
        FROM energy_line_positions
        GROUP BY line_asset_id
        HAVING COUNT(*) >= 2
      ) AS source
      WHERE line.asset_id = source.line_asset_id
    `);

    return NextResponse.json({
      message: 'Đã dựng LineString từ các vị trí đường dây có tối thiểu 2 điểm theo sequence number.',
    });
  } catch (error) {
    console.error('Rebuild line geometry failed', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Không thể dựng lại geometry đường dây.' },
      { status: 500 },
    );
  }
}
