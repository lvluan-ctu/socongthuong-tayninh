import { inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { energyAssets } from '@/db/schema';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const ALLOWED = ['SUBSTATION', 'TRANSFORMER', 'BAY', 'FEEDER', 'POWER_LINE', 'LINE_POSITION', 'ELECTRICAL_EQUIPMENT'];

export async function GET(request: Request) {
  try {
    const rawTypes = new URL(request.url).searchParams.get('types');
    const types = (rawTypes ? rawTypes.split(',') : ALLOWED).filter((type) => ALLOWED.includes(type));
    if (!types.length) return NextResponse.json({ items: [] });
    const rows = await db.select({ id: energyAssets.id, code: energyAssets.code, name: energyAssets.name, assetType: energyAssets.assetType, status: energyAssets.status })
      .from(energyAssets)
      .where(inArray(energyAssets.assetType, types))
      .orderBy(energyAssets.assetType, energyAssets.name)
      .limit(5000);
    return NextResponse.json({ items: rows });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải danh mục tài sản lưới.' }, { status: 500 });
  }
}
