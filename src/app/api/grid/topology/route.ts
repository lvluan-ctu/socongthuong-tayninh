import { desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { energyAssets, energySubstations } from '@/db/schema';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rootId = url.searchParams.get('rootId');

    const roots = await db
      .select({
        id: energyAssets.id,
        code: energyAssets.code,
        name: energyAssets.name,
        voltageLevelKv: energySubstations.voltageLevelKv,
        loadFactorPct: energySubstations.loadFactorPct,
        overloadStatus: energySubstations.overloadStatus,
      })
      .from(energySubstations)
      .innerJoin(energyAssets, eq(energyAssets.id, energySubstations.assetId))
      .orderBy(desc(energySubstations.voltageLevelKv), energyAssets.name)
      .limit(100);

    if (!rootId) {
      return NextResponse.json({ roots, nodes: [] });
    }

    const queryResult = await db.execute(sql`
      WITH RECURSIVE grid_tree AS (
        SELECT
          asset.id,
          asset.code,
          asset.name,
          asset.asset_type,
          asset.status,
          NULL::uuid AS parent_id,
          NULL::text AS relation_type,
          0::integer AS depth,
          ARRAY[asset.id]::uuid[] AS path
        FROM energy_assets AS asset
        WHERE asset.id = ${rootId}::uuid

        UNION ALL

        SELECT
          child.id,
          child.code,
          child.name,
          child.asset_type,
          child.status,
          parent.id AS parent_id,
          relation.relation_type,
          parent.depth + 1,
          parent.path || child.id
        FROM grid_tree AS parent
        JOIN energy_asset_relations AS relation ON relation.from_asset_id = parent.id
        JOIN energy_assets AS child ON child.id = relation.to_asset_id
        WHERE parent.depth < 8
          AND NOT child.id = ANY(parent.path)
      )
      SELECT id, code, name, asset_type, status, parent_id, relation_type, depth
      FROM grid_tree
      ORDER BY depth, name
      LIMIT 800
    `);

    const nodes = (queryResult.rows ?? []).map((row) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      assetType: String(row.asset_type),
      status: String(row.status),
      parentId: row.parent_id ? String(row.parent_id) : null,
      relationType: row.relation_type ? String(row.relation_type) : null,
      depth: Number(row.depth),
    }));

    return NextResponse.json({ roots, nodes });
  } catch (error) {
    console.error('Cannot load Grid topology', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Không thể tải Grid topology.' },
      { status: 500 },
    );
  }
}
