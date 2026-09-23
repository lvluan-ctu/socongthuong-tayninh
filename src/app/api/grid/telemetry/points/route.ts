import { desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { energyAssets, energyMeasurementPoints, energyMeasurements } from '@/db/schema';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await db
      .select({
        id: energyMeasurementPoints.id,
        code: energyMeasurementPoints.code,
        name: energyMeasurementPoints.name,
        provider: energyMeasurementPoints.provider,
        externalCode: energyMeasurementPoints.externalCode,
        voltageLevelKv: energyMeasurementPoints.voltageLevelKv,
        status: energyMeasurementPoints.status,
        assetId: energyMeasurementPoints.assetId,
        assetCode: energyAssets.code,
        assetName: energyAssets.name,
        assetType: energyAssets.assetType,
        latestMeasuredAt: sql<string | null>`max(${energyMeasurements.measuredAt})`,
        measurementCount: sql<number>`count(${energyMeasurements.id})::int`,
      })
      .from(energyMeasurementPoints)
      .leftJoin(energyAssets, eq(energyAssets.id, energyMeasurementPoints.assetId))
      .leftJoin(energyMeasurements, eq(energyMeasurements.measurementPointId, energyMeasurementPoints.id))
      .groupBy(
        energyMeasurementPoints.id,
        energyAssets.id,
      )
      .orderBy(desc(sql`max(${energyMeasurements.measuredAt})`), energyMeasurementPoints.name);

    return NextResponse.json({ items: rows });
  } catch (error) {
    console.error('Grid telemetry points failed', error);
    return NextResponse.json({ message: 'Không thể tải danh sách điểm đo.' }, { status: 500 });
  }
}
