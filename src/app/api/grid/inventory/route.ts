import { asc, count, eq, inArray, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import {
  energyAssets,
  energyFeeders,
  energyLinePositions,
  energyPowerLines,
  energyPowerStructures,
  energySubstations,
  energyTransformers,
} from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const entities = ['substations', 'transformers', 'feeders', 'lines', 'positions'] as const;
type Entity = (typeof entities)[number];

function requestedEntity(value: string | null): Entity {
  return entities.includes(value as Entity) ? value as Entity : 'substations';
}

function numberValue(value: unknown) {
  return value == null ? null : Number(value);
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const entity = requestedEntity(params.get('entity'));
    const pagination = parsePagination(params);

    if (entity === 'substations') {
      const query = db.select({
        assetId: energyAssets.id, code: energyAssets.code, name: energyAssets.name, status: energyAssets.status, commissionedAt: energyAssets.commissionedAt,
        voltageLevelKv: energySubstations.voltageLevelKv, substationType: energySubstations.substationType,
        installedCapacityMva: energySubstations.installedCapacityMva, designedCapacityMva: energySubstations.designedCapacityMva,
        currentLoadMva: energySubstations.currentLoadMva, loadFactorPct: energySubstations.loadFactorPct,
        availableCapacityMva: energySubstations.availableCapacityMva, overloadStatus: energySubstations.overloadStatus, operator: energySubstations.operator,
      }).from(energySubstations).innerJoin(energyAssets, eq(energyAssets.id, energySubstations.assetId)).orderBy(asc(energyAssets.name));
      const [rows, totalRows] = await Promise.all([query.limit(pagination.pageSize).offset(pagination.offset), db.select({ value: count() }).from(energySubstations)]);
      return paginatedResponse(rows, pagination, Number(totalRows[0]?.value ?? 0), { entity });
    }

    if (entity === 'transformers') {
      const query = db.select({
        assetId: energyAssets.id, code: energyAssets.code, name: energyAssets.name, status: energyAssets.status, commissionedAt: energyAssets.commissionedAt,
        substationAssetId: energyTransformers.substationAssetId,
        substationName: sql<string | null>`(select name from energy_assets where id = ${energyTransformers.substationAssetId})`,
        primaryVoltageKv: energyTransformers.primaryVoltageKv, secondaryVoltageKv: energyTransformers.secondaryVoltageKv,
        tertiaryVoltageKv: energyTransformers.tertiaryVoltageKv, ratedCapacityMva: energyTransformers.ratedCapacityMva,
        manufacturer: energyTransformers.manufacturer, model: energyTransformers.model, serialNumber: energyTransformers.serialNumber,
      }).from(energyTransformers).innerJoin(energyAssets, eq(energyAssets.id, energyTransformers.assetId)).orderBy(asc(energyAssets.name));
      const [rows, totalRows] = await Promise.all([query.limit(pagination.pageSize).offset(pagination.offset), db.select({ value: count() }).from(energyTransformers)]);
      return paginatedResponse(rows, pagination, Number(totalRows[0]?.value ?? 0), { entity });
    }

    if (entity === 'feeders') {
      const query = db.select({
        assetId: energyAssets.id, code: energyAssets.code, name: energyAssets.name, status: energyAssets.status, commissionedAt: energyAssets.commissionedAt,
        feederCode: energyFeeders.feederCode, voltageLevelKv: energyFeeders.voltageLevelKv, ratedCapacityMw: energyFeeders.ratedCapacityMw,
        currentLoadMw: energyFeeders.currentLoadMw, headroomMw: energyFeeders.headroomMw,
        substationName: sql<string | null>`(select name from energy_assets where id = ${energyFeeders.substationAssetId})`,
      }).from(energyFeeders).innerJoin(energyAssets, eq(energyAssets.id, energyFeeders.assetId)).orderBy(asc(energyAssets.name));
      const [rows, totalRows] = await Promise.all([query.limit(pagination.pageSize).offset(pagination.offset), db.select({ value: count() }).from(energyFeeders)]);
      return paginatedResponse(rows, pagination, Number(totalRows[0]?.value ?? 0), { entity });
    }

    if (entity === 'lines') {
      const query = db.select({
        assetId: energyAssets.id, code: energyAssets.code, name: energyAssets.name, status: energyAssets.status, commissionedAt: energyAssets.commissionedAt,
        voltageLevelKv: energyPowerLines.voltageLevelKv, lineType: energyPowerLines.lineType, conductorType: energyPowerLines.conductorType,
        circuitCount: energyPowerLines.circuitCount, lengthM: energyPowerLines.lengthM, ratedCapacityMw: energyPowerLines.ratedCapacityMw,
        currentLoadMw: energyPowerLines.currentLoadMw,
        feederName: sql<string | null>`(select name from energy_assets where id = ${energyPowerLines.feederAssetId})`,
      }).from(energyPowerLines).innerJoin(energyAssets, eq(energyAssets.id, energyPowerLines.assetId)).orderBy(energyPowerLines.voltageLevelKv, energyAssets.name);
      const [rows, totalRows] = await Promise.all([query.limit(pagination.pageSize).offset(pagination.offset), db.select({ value: count() }).from(energyPowerLines)]);
      return paginatedResponse(rows, pagination, Number(totalRows[0]?.value ?? 0), { entity });
    }

    const query = db.select({
      id: energyLinePositions.id, assetId: energyLinePositions.assetId, lineAssetId: energyLinePositions.lineAssetId,
      code: energyAssets.code, name: energyAssets.name, commissionedAt: energyAssets.commissionedAt,
      positionCode: energyLinePositions.positionCode, sequenceNo: energyLinePositions.sequenceNo,
      distanceFromPreviousM: energyLinePositions.distanceFromPreviousM, circuitCount: energyLinePositions.circuitCount,
      groundingResistanceOhm: energyLinePositions.groundingResistanceOhm,
      latitude: sql<number | null>`ST_Y(${energyLinePositions.location}::geometry)`, longitude: sql<number | null>`ST_X(${energyLinePositions.location}::geometry)`,
      lineName: sql<string | null>`(select name from energy_assets where id = ${energyLinePositions.lineAssetId})`,
    }).from(energyLinePositions).leftJoin(energyAssets, eq(energyAssets.id, energyLinePositions.assetId)).orderBy(energyLinePositions.lineAssetId, energyLinePositions.sequenceNo);
    const [rows, totalRows] = await Promise.all([query.limit(pagination.pageSize).offset(pagination.offset), db.select({ value: count() }).from(energyLinePositions)]);
    const assetIds = rows.map((row) => row.assetId).filter((id): id is string => Boolean(id));
    const structures = assetIds.length ? await db.select({ assetId: energyPowerStructures.assetId, structureType: energyPowerStructures.structureType, circuitCount: energyPowerStructures.circuitCount, groundingResistanceOhm: energyPowerStructures.groundingResistanceOhm }).from(energyPowerStructures).where(inArray(energyPowerStructures.assetId, assetIds)) : [];
    const structureByAsset = new Map(structures.map((row) => [row.assetId, row]));
    return paginatedResponse(rows.map((row) => {
      const structure = row.assetId ? structureByAsset.get(row.assetId) : undefined;
      return { ...row, structureType: structure?.structureType ?? null, structureCircuitCount: structure?.circuitCount ?? null, structureGroundingResistanceOhm: structure?.groundingResistanceOhm ?? null, latitude: numberValue(row.latitude), longitude: numberValue(row.longitude) };
    }), pagination, Number(totalRows[0]?.value ?? 0), { entity });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải danh mục hạ tầng lưới điện.' }, { status: 500 });
  }
}
