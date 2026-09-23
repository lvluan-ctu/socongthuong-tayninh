import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { energyEmissionFactors } from '@/db/schema';
import { db } from '@/lib/db';
import { convertUnit, normalizeUnitCode } from './units';

type Factor = typeof energyEmissionFactors.$inferSelect;

function parseFactorUnit(factorUnit: string) {
  const parts = factorUnit.split('/').map((part) => normalizeUnitCode(part));
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { outputUnit: parts[0], denominatorUnit: parts[1] };
}

export type ActivityCalculationInput = {
  sourceId: string;
  factorId: string;
  period: string;
  quantity: number;
  activityUnit: string;
  co2eKg?: number | null;
};

export async function calculateActivityEmission(input: ActivityCalculationInput, factor: Factor) {
  const factorValue = Number(factor.factorValue);
  const parsedFactorUnit = parseFactorUnit(factor.factorUnit);
  const inputSnapshot = { sourceId: input.sourceId, factorId: input.factorId, period: input.period, quantity: input.quantity, activityUnit: input.activityUnit, co2eKgReported: input.co2eKg ?? null, factorCode: factor.code, factorVersion: factor.sourceVersion, factorValue, factorUnit: factor.factorUnit };
  if (input.co2eKg != null) {
    return {
      co2eKg: input.co2eKg,
      factorValue,
      inputSnapshot,
      outputSnapshot: { co2eKg: input.co2eKg, outputUnit: 'kgCO2e', method: 'SOURCE_REPORTED_CO2E' },
      inputHash: createHash('sha256').update(JSON.stringify(inputSnapshot)).digest('hex'),
      methodCode: 'SOURCE_REPORTED_CO2E', methodVersion: 'UNIT_REGISTRY_V1', compatible: Boolean(parsedFactorUnit),
      warnings: parsedFactorUnit ? ['SOURCE_REPORTED_CO2E: giá trị CO2e do nguồn cung cấp; cần review độc lập.'] : ['FACTOR_UNIT_UNPARSED: chưa xác minh được unit của hệ số.'],
    };
  }
  if (!parsedFactorUnit) return { co2eKg: null, factorValue, inputSnapshot, outputSnapshot: {}, inputHash: createHash('sha256').update(JSON.stringify(inputSnapshot)).digest('hex'), methodCode: 'UNRESOLVED_FACTOR_UNIT', methodVersion: 'UNIT_REGISTRY_V1', compatible: false, warnings: [`Không hiểu factor unit ${factor.factorUnit}; không được tự động nhân khác đơn vị.`] };
  const denominator = await convertUnit(input.quantity, input.activityUnit, parsedFactorUnit.denominatorUnit);
  if (!denominator.compatible) return { co2eKg: null, factorValue, inputSnapshot, outputSnapshot: { denominatorConversion: denominator }, inputHash: createHash('sha256').update(JSON.stringify(inputSnapshot)).digest('hex'), methodCode: 'UNIT_COMPATIBILITY_REVIEW', methodVersion: 'UNIT_REGISTRY_V1', compatible: false, warnings: [denominator.warning ?? 'Không tương thích đơn vị.'] };
  const factorOutput = denominator.value * factorValue;
  const outputConversion = await convertUnit(factorOutput, parsedFactorUnit.outputUnit, 'kgCO2e');
  if (!outputConversion.compatible) return { co2eKg: null, factorValue, inputSnapshot, outputSnapshot: { denominatorConversion: denominator, outputConversion }, inputHash: createHash('sha256').update(JSON.stringify(inputSnapshot)).digest('hex'), methodCode: 'OUTPUT_UNIT_REVIEW', methodVersion: 'UNIT_REGISTRY_V1', compatible: false, warnings: [outputConversion.warning ?? 'Không thể chuẩn hóa output về kgCO2e.'] };
  return {
    co2eKg: outputConversion.value,
    factorValue,
    inputSnapshot,
    outputSnapshot: { denominatorConversion: denominator, outputConversion, co2eKg: outputConversion.value, outputUnit: 'kgCO2e' },
    inputHash: createHash('sha256').update(JSON.stringify(inputSnapshot)).digest('hex'),
    methodCode: 'FACTOR_MULTIPLY_WITH_UNIT_CONVERSION', methodVersion: 'UNIT_REGISTRY_V1', compatible: true,
    warnings: [denominator.method === 'IDENTITY' ? null : `Đã chuẩn hóa ${input.activityUnit} → ${parsedFactorUnit.denominatorUnit} bằng ${denominator.method}.`].filter((item): item is string => Boolean(item)),
  };
}

export async function loadEmissionFactor(factorId: string) {
  const [factor] = await db.select().from(energyEmissionFactors).where(eq(energyEmissionFactors.id, factorId)).limit(1);
  return factor;
}
