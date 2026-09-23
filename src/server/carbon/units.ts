import { and, eq, lte, or, isNull, gte } from 'drizzle-orm';
import { energyUnitConversions, energyUnitDefinitions } from '@/db/schema';
import { db } from '@/lib/db';

const aliases: Record<string, string> = {
  kwh: 'kWh', mwh: 'MWh', gwh: 'GWh', kg: 'kg', t: 'tonne', tonne: 'tonne', ton: 'tonne',
  kgco2e: 'kgCO2e', 'kgco₂e': 'kgCO2e', tco2e: 'tCO2e', 'tco₂e': 'tCO2e', l: 'L', litre: 'L',
};

export function normalizeUnitCode(value: string) {
  const trimmed = value.trim();
  return aliases[trimmed.toLowerCase()] ?? trimmed;
}

type UnitDefinition = typeof energyUnitDefinitions.$inferSelect;

export type UnitConversionResult = {
  value: number;
  fromUnit: string;
  toUnit: string;
  compatible: boolean;
  factor: number | null;
  method: string;
  warning?: string;
  dimension?: string;
  sourceRef?: string | null;
};

async function getDefinition(code: string) {
  const [row] = await db.select().from(energyUnitDefinitions).where(eq(energyUnitDefinitions.code, code)).limit(1);
  return row;
}

export async function convertUnit(value: number, fromUnitInput: string, toUnitInput: string, at = new Date()): Promise<UnitConversionResult> {
  const fromUnit = normalizeUnitCode(fromUnitInput);
  const toUnit = normalizeUnitCode(toUnitInput);
  if (fromUnit === toUnit) return { value, fromUnit, toUnit, compatible: true, factor: 1, method: 'IDENTITY' };
  const [from, to] = await Promise.all([getDefinition(fromUnit), getDefinition(toUnit)]);
  if (!from || !to) return { value, fromUnit, toUnit, compatible: false, factor: null, method: 'UNRESOLVED_UNIT', warning: `Chưa có unit definition cho ${!from ? fromUnit : toUnit}.` };
  if (from.status !== 'ACTIVE' || to.status !== 'ACTIVE') return { value, fromUnit, toUnit, compatible: false, factor: null, method: 'INACTIVE_UNIT', warning: 'Đơn vị nguồn hoặc đích không ở trạng thái ACTIVE.' };
  if (from.dimension !== to.dimension) return { value, fromUnit, toUnit, compatible: false, factor: null, method: 'DIMENSION_MISMATCH', warning: `Không thể đổi ${from.dimension} sang ${to.dimension}.` };

  const validity = and(
    eq(energyUnitConversions.fromUnit, fromUnit),
    eq(energyUnitConversions.toUnit, toUnit),
    or(isNull(energyUnitConversions.validFrom), lte(energyUnitConversions.validFrom, at)),
    or(isNull(energyUnitConversions.validTo), gte(energyUnitConversions.validTo, at)),
  );
  const [conversion] = await db.select().from(energyUnitConversions).where(validity).limit(1);
  if (conversion) {
    const factor = Number(conversion.factor);
    return { value: value * factor, fromUnit, toUnit, compatible: Number.isFinite(factor), factor, method: 'EXPLICIT_CONVERSION', sourceRef: conversion.sourceRef };
  }
  if (from.canonicalUnit === to.canonicalUnit) {
    const factor = Number(from.multiplierToCanonical) / Number(to.multiplierToCanonical);
    return { value: value * factor, fromUnit, toUnit, compatible: Number.isFinite(factor), factor, method: 'CANONICAL_REGISTRY_RATIO', dimension: from.dimension, sourceRef: from.sourceRef ?? to.sourceRef };
  }
  return { value, fromUnit, toUnit, compatible: false, factor: null, method: 'MISSING_CONVERSION', warning: `Chưa có conversion có provenance từ ${fromUnit} sang ${toUnit}.` };
}

export function unitDefinitionSnapshot(unit: UnitDefinition | undefined) {
  return unit ? { code: unit.code, dimension: unit.dimension, canonicalUnit: unit.canonicalUnit, multiplierToCanonical: Number(unit.multiplierToCanonical), sourceRef: unit.sourceRef } : null;
}
