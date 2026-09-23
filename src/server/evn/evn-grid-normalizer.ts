import { and, eq } from 'drizzle-orm';
import {
  energyAssetRelations,
  energyAssets,
  energyBays,
  energyElectricalEquipment,
  energyExternalIdentifiers,
  energyImportBatches,
  energyImportRecords,
  energyLinePositions,
  energyPowerLines,
  energySubstations,
  energyTransformers,
} from '@/db/schema';
import { db } from '@/lib/db';
import type { EvnCellValue, EvnEntityType } from './evn-import.types';

const PROVIDER = 'EVN';
const IDENTIFIER_TYPE = 'DEVICE_ID';

const ASSET_TYPES: Record<EvnEntityType, string> = {
  SUBSTATION: 'SUBSTATION',
  TRANSFORMER: 'TRANSFORMER',
  BAY: 'BAY',
  POWER_LINE: 'POWER_LINE',
  LINE_POSITION: 'LINE_POSITION',
  CABLE: 'CABLE',
  ELECTRICAL_EQUIPMENT: 'ELECTRICAL_EQUIPMENT',
  MEASUREMENT_REPORT: 'MEASUREMENT_REPORT',
  UNKNOWN: 'UNKNOWN',
};

function normalizeText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function pick(data: Record<string, EvnCellValue>, aliases: string[]) {
  for (const [key, value] of Object.entries(data)) {
    const normalizedKey = normalizeText(key);
    if (aliases.some((alias) => normalizedKey === alias || normalizedKey.includes(alias))) {
      if (value != null && String(value).trim() !== '') return value;
    }
  }
  return null;
}

function numeric(data: Record<string, EvnCellValue>, aliases: string[]) {
  const value = pick(data, aliases);
  if (value == null) return null;
  const cleaned = String(value).replace(/\s+/g, '').replace(',', '.').replace(/[^0-9+\-.]/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? String(parsed) : null;
}

function dateValue(data: Record<string, EvnCellValue>) {
  const value = pick(data, ['ngay van hanh', 'ngay dua vao su dung', 'ngay dong dien']);
  if (!value) return null;
  const raw = String(value).trim();
  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const parsed = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00+07:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function voltageFrom(data: Record<string, EvnCellValue>, sheetName: string) {
  const explicit = numeric(data, ['cap dien ap', 'dien ap kv', 'u dinh muc kv', 'dien ap']);
  if (explicit) return explicit;
  const match = sheetName.match(/(500|220|110|35|22|15|10|6)[ ]*k?v/i);
  return match?.[1] ?? null;
}

function resolveLatLng(data: Record<string, EvnCellValue>) {
  const x = Number(pick(data, ['x']) ?? Number.NaN);
  const y = Number(pick(data, ['y']) ?? Number.NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  if (x >= 8 && x <= 24 && y >= 100 && y <= 110) return { latitude: x, longitude: y, convention: 'X_LAT_Y_LNG' };
  if (y >= 8 && y <= 24 && x >= 100 && x <= 110) return { latitude: y, longitude: x, convention: 'X_LNG_Y_LAT' };
  if (x >= -90 && x <= 90 && y >= -180 && y <= 180) return { latitude: x, longitude: y, convention: 'GENERIC_X_LAT_Y_LNG' };
  return null;
}

function equipmentType(sheetName: string) {
  const name = normalizeText(sheetName);
  if (name.includes('may cat')) return 'CIRCUIT_BREAKER';
  if (name.includes('dao cach ly')) return 'DISCONNECTOR';
  if (name.includes('bien dong')) return 'CURRENT_TRANSFORMER';
  if (name.includes('bien dien ap')) return 'VOLTAGE_TRANSFORMER';
  if (name.includes('chong set')) return 'SURGE_ARRESTER';
  if (name.includes('thanh cai')) return 'BUSBAR';
  if (name.includes('tu bu')) return 'CAPACITOR_BANK';
  if (name.includes('ro le')) return 'RELAY';
  if (name.includes('ac quy') && name.includes('nap')) return 'BATTERY_CHARGER';
  if (name.includes('ac quy')) return 'BATTERY';
  if (name.includes('lbs')) return 'LBS';
  if (name.includes('tu hop bo')) return 'SWITCHGEAR';
  return 'OTHER';
}

function payloadOf(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  const entityType = payload.entityTypeHint;
  const data = payload.data;
  if (typeof entityType !== 'string' || !data || typeof data !== 'object' || Array.isArray(data)) return null;
  return {
    entityType: entityType as EvnEntityType,
    data: data as Record<string, EvnCellValue>,
    warnings: Array.isArray(payload.warnings) ? payload.warnings.map(String) : [],
  };
}

function assetName(entityType: EvnEntityType, data: Record<string, EvnCellValue>, externalKey: string) {
  const value = pick(data, [
    'ten thiet bi',
    'ten tram',
    'ten duong day',
    'ten vi tri',
    'vi tri',
    'ten',
  ]);
  return String(value ?? `${ASSET_TYPES[entityType]} ${externalKey}`).trim();
}

async function findAssetId(externalKey: string | null) {
  if (!externalKey) return null;
  const [row] = await db
    .select({ assetId: energyExternalIdentifiers.assetId })
    .from(energyExternalIdentifiers)
    .where(and(
      eq(energyExternalIdentifiers.provider, PROVIDER),
      eq(energyExternalIdentifiers.identifierType, IDENTIFIER_TYPE),
      eq(energyExternalIdentifiers.identifierValue, externalKey),
    ))
    .limit(1);
  return row?.assetId ?? null;
}

export type EvnNormalizeResult = {
  batchId: string;
  createdAssets: number;
  reusedAssets: number;
  specializedRows: number;
  relations: number;
  linePositions: number;
  skipped: number;
  errors: Array<{ rowNumber: number; sheetName: string | null; message: string }>;
};

export async function normalizeEvnGridBatch(batchId: string): Promise<EvnNormalizeResult> {
  const [batch] = await db.select().from(energyImportBatches).where(eq(energyImportBatches.id, batchId)).limit(1);
  if (!batch) throw new Error('Không tìm thấy EVN import batch.');
  if (batch.entityType !== 'EVN_GRID_WORKBOOK') throw new Error('Batch không thuộc loại EVN_GRID_WORKBOOK.');

  const rows = await db
    .select()
    .from(energyImportRecords)
    .where(eq(energyImportRecords.batchId, batchId))
    .orderBy(energyImportRecords.rowNumber);

  const result: EvnNormalizeResult = {
    batchId,
    createdAssets: 0,
    reusedAssets: 0,
    specializedRows: 0,
    relations: 0,
    linePositions: 0,
    skipped: 0,
    errors: [],
  };

  const assetIdByExternalKey = new Map<string, string>();
  const entityTypeByExternalKey = new Map<string, EvnEntityType>();

  // Pass 1: establish internal UUID assets for every EVN object carrying a stable device ID.
  for (const row of rows) {
    const payload = payloadOf(row.payload);
    if (!payload || payload.entityType === 'UNKNOWN' || payload.entityType === 'MEASUREMENT_REPORT' || !row.externalKey) {
      result.skipped += 1;
      continue;
    }

    try {
      const existingAssetId = await findAssetId(row.externalKey);
      if (existingAssetId) {
        assetIdByExternalKey.set(row.externalKey, existingAssetId);
        entityTypeByExternalKey.set(row.externalKey, payload.entityType);
        result.reusedAssets += 1;
        await db.update(energyImportRecords).set({ resolvedAssetId: existingAssetId }).where(eq(energyImportRecords.id, row.id));
        continue;
      }

      const location = resolveLatLng(payload.data);
      const [asset] = await db.insert(energyAssets).values({
        assetType: ASSET_TYPES[payload.entityType],
        code: `EVN:${row.externalKey}`,
        name: assetName(payload.entityType, payload.data, row.externalKey),
        status: 'ACTIVE',
        commissionedAt: dateValue(payload.data),
        location: location ? `SRID=4326;POINT(${location.longitude} ${location.latitude})` : null,
        classification: 'RESTRICTED',
        metadata: {
          source: 'EVN',
          importedFromBatchId: batchId,
          sourceSheet: row.sheetName,
          coordinateConvention: location?.convention,
        },
      }).returning();

      await db.insert(energyExternalIdentifiers).values({
        assetId: asset.id,
        provider: PROVIDER,
        identifierType: IDENTIFIER_TYPE,
        identifierValue: row.externalKey,
        metadata: { importedFromBatchId: batchId },
      }).onConflictDoNothing();

      assetIdByExternalKey.set(row.externalKey, asset.id);
      entityTypeByExternalKey.set(row.externalKey, payload.entityType);
      result.createdAssets += 1;
      await db.update(energyImportRecords).set({ resolvedAssetId: asset.id }).where(eq(energyImportRecords.id, row.id));
    } catch (error) {
      result.errors.push({
        rowNumber: row.rowNumber,
        sheetName: row.sheetName,
        message: error instanceof Error ? error.message : 'Không thể tạo asset.',
      });
      await db.update(energyImportRecords).set({ validationStatus: 'ERROR', errorMessage: result.errors.at(-1)?.message }).where(eq(energyImportRecords.id, row.id));
    }
  }

  // Pass 2: create specialized grid records and preserve the original EVN parent relation.
  for (const row of rows) {
    const payload = payloadOf(row.payload);
    if (!payload || !row.externalKey) continue;
    const assetId = assetIdByExternalKey.get(row.externalKey);
    if (!assetId) continue;

    const parentAssetId = row.parentExternalKey
      ? assetIdByExternalKey.get(row.parentExternalKey) ?? await findAssetId(row.parentExternalKey)
      : null;
    const parentEntityType = row.parentExternalKey ? entityTypeByExternalKey.get(row.parentExternalKey) : undefined;

    try {
      if (parentAssetId) {
        const insertedRelation = await db.insert(energyAssetRelations).values({
          fromAssetId: parentAssetId,
          toAssetId: assetId,
          relationType: 'EVN_PARENT',
          sourceRelationType: 'EVN_PARENT',
          sequenceNo: Number(numeric(payload.data, ['stt']) ?? row.rowNumber),
          inferred: 0,
          metadata: { batchId, sourceSheet: row.sheetName },
        }).onConflictDoNothing().returning({ id: energyAssetRelations.id });
        if (insertedRelation.length > 0) result.relations += 1;
      }

      if (payload.entityType === 'SUBSTATION') {
        const voltageLevelKv = voltageFrom(payload.data, row.sheetName ?? '') ?? '22';
        const capacity = numeric(payload.data, ['tong cong suat', 'cong suat mva', 'cong suat']);
        const inserted = await db.insert(energySubstations).values({
          assetId,
          voltageLevelKv,
          substationType: String(pick(payload.data, ['kieu tram', 'loai tram']) ?? 'OTHER'),
          designedCapacityMva: capacity,
          installedCapacityMva: capacity,
          operator: String(pick(payload.data, ['don vi quan ly', 'don vi van hanh']) ?? '') || null,
          controlTechnology: String(pick(payload.data, ['he thong dieu khien', 'cong nghe ky thuat so']) ?? '') || null,
          technicalSpecs: payload.data,
        }).onConflictDoNothing().returning({ assetId: energySubstations.assetId });
        result.specializedRows += inserted.length;
      }

      if (payload.entityType === 'TRANSFORMER') {
        const explicitMva = numeric(payload.data, ['cong suat mva', 'cong suat dinh muc mva']);
        const kva = numeric(payload.data, ['cong suat kva', 'cong suat dinh muc kva']);
        const ratedCapacityMva = explicitMva ?? (kva ? String(Number(kva) / 1000) : null);
        const inserted = await db.insert(energyTransformers).values({
          assetId,
          substationAssetId: parentEntityType === 'SUBSTATION' ? parentAssetId : null,
          role: 'POWER',
          primaryVoltageKv: numeric(payload.data, ['u cao ap', 'dien ap so cap', 'primary voltage']),
          secondaryVoltageKv: numeric(payload.data, ['u trung ap', 'dien ap thu cap', 'secondary voltage']),
          tertiaryVoltageKv: numeric(payload.data, ['u ha', 'u can bang', 'tertiary voltage']),
          ratedCapacityMva,
          coolingMethod: String(pick(payload.data, ['phuong phap lam mat', 'lam mat']) ?? '') || null,
          vectorGroup: String(pick(payload.data, ['to dau day']) ?? '') || null,
          manufacturer: String(pick(payload.data, ['nha san xuat', 'hang san xuat']) ?? '') || null,
          model: String(pick(payload.data, ['model', 'kieu']) ?? '') || null,
          serialNumber: String(pick(payload.data, ['serial', 'so che tao']) ?? '') || null,
          technicalSpecs: payload.data,
        }).onConflictDoNothing().returning({ assetId: energyTransformers.assetId });
        result.specializedRows += inserted.length;
      }

      if (payload.entityType === 'BAY' && parentAssetId) {
        const inserted = await db.insert(energyBays).values({
          assetId,
          substationAssetId: parentAssetId,
          bayCode: String(pick(payload.data, ['ma ngan lo', 'ngan lo', 'ten ngan lo']) ?? row.externalKey),
          bayType: String(pick(payload.data, ['loai ngan lo']) ?? 'OTHER'),
          voltageLevelKv: voltageFrom(payload.data, row.sheetName ?? ''),
          ratedCurrentA: numeric(payload.data, ['dong dien dinh muc', 'rated current']),
          technicalSpecs: payload.data,
        }).onConflictDoNothing().returning({ assetId: energyBays.assetId });
        result.specializedRows += inserted.length;
      }

      if (payload.entityType === 'POWER_LINE') {
        const inserted = await db.insert(energyPowerLines).values({
          assetId,
          parentLineAssetId: parentEntityType === 'POWER_LINE' ? parentAssetId : null,
          voltageLevelKv: voltageFrom(payload.data, row.sheetName ?? '') ?? '22',
          lineType: String(pick(payload.data, ['loai duong day', 'loai tuyen']) ?? 'OVERHEAD'),
          conductorType: String(pick(payload.data, ['loai day dan', 'day dan']) ?? '') || null,
          circuitCount: Number(numeric(payload.data, ['so mach']) ?? 1),
          lengthM: numeric(payload.data, ['tong chieu dai', 'chieu dai m', 'chieu dai']),
          technicalSpecs: payload.data,
        }).onConflictDoNothing().returning({ assetId: energyPowerLines.assetId });
        result.specializedRows += inserted.length;
      }

      if (payload.entityType === 'LINE_POSITION' && parentAssetId) {
        const location = resolveLatLng(payload.data);
        if (!location) throw new Error('Vị trí đường dây thiếu tọa độ X/Y hợp lệ.');
        const sequenceNo = Number(numeric(payload.data, ['stt']) ?? row.rowNumber);
        const inserted = await db.insert(energyLinePositions).values({
          lineAssetId: parentAssetId,
          assetId,
          positionCode: String(pick(payload.data, ['vi tri', 'ten vi tri', 'ma vi tri']) ?? row.externalKey),
          sequenceNo,
          location: `SRID=4326;POINT(${location.longitude} ${location.latitude})`,
          distanceFromPreviousM: numeric(payload.data, ['khoang cot', 'khoang cach']),
          turnAngleDeg: numeric(payload.data, ['goc lai', 'goc chuyen huong']),
          circuitCount: Number(numeric(payload.data, ['so mach']) ?? 1),
          groundingResistanceOhm: numeric(payload.data, ['dien tro tiep dia']),
          metadata: { ...payload.data, coordinateConvention: location.convention },
        }).onConflictDoNothing().returning({ id: energyLinePositions.id });
        result.linePositions += inserted.length;
      }

      if (payload.entityType === 'ELECTRICAL_EQUIPMENT') {
        const inserted = await db.insert(energyElectricalEquipment).values({
          assetId,
          substationAssetId: parentEntityType === 'SUBSTATION' ? parentAssetId : null,
          bayAssetId: parentEntityType === 'BAY' ? parentAssetId : null,
          equipmentType: equipmentType(row.sheetName ?? ''),
          ratedVoltageKv: voltageFrom(payload.data, row.sheetName ?? ''),
          ratedCurrentA: numeric(payload.data, ['dong dien dinh muc', 'rated current']),
          manufacturer: String(pick(payload.data, ['nha san xuat', 'hang san xuat']) ?? '') || null,
          model: String(pick(payload.data, ['model', 'kieu']) ?? '') || null,
          serialNumber: String(pick(payload.data, ['serial', 'so che tao']) ?? '') || null,
          technicalSpecs: payload.data,
        }).onConflictDoNothing().returning({ assetId: energyElectricalEquipment.assetId });
        result.specializedRows += inserted.length;
      }

      await db.update(energyImportRecords).set({
        validationStatus: payload.warnings.length > 0 ? 'NORMALIZED_WITH_WARNING' : 'NORMALIZED',
        errorMessage: null,
      }).where(eq(energyImportRecords.id, row.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể chuẩn hóa dòng EVN.';
      result.errors.push({ rowNumber: row.rowNumber, sheetName: row.sheetName, message });
      await db.update(energyImportRecords).set({ validationStatus: 'ERROR', errorMessage: message }).where(eq(energyImportRecords.id, row.id));
    }
  }

  const existingMetadata = batch.metadata && typeof batch.metadata === 'object' && !Array.isArray(batch.metadata)
    ? batch.metadata as Record<string, unknown>
    : {};

  await db.update(energyImportBatches).set({
    status: result.errors.length > 0 ? 'NORMALIZED_WITH_ERRORS' : 'NORMALIZED',
    recordsRejected: result.errors.length,
    metadata: {
      ...existingMetadata,
      normalizedAt: new Date().toISOString(),
      normalizeVersion: 'evn-grid-normalizer-v1',
      normalizeResult: result,
    },
  }).where(eq(energyImportBatches.id, batchId));

  return result;
}
