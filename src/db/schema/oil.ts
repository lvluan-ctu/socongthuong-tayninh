import { index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { energyAssets, geography, geometry } from './core';

export const energyOilFacilities = pgTable('energy_oil_facilities', {
  assetId: uuid('asset_id').primaryKey().references(() => energyAssets.id, { onDelete: 'cascade' }),
  facilityType: text('facility_type').notNull(),
  operator: text('operator'),
  address: text('address'),
  phone: text('phone'),
  operationStatus: text('operation_status').notNull().default('ACTIVE'),
  openingTime: text('opening_time'),
  closingTime: text('closing_time'),
  operatingHours: text('operating_hours'),
  storageCapacityM3: numeric('storage_capacity_m3', { precision: 14, scale: 3 }).notNull().default('0'),
  tankCount: integer('tank_count').notNull().default(0),
  pumpCount: integer('pump_count').notNull().default(0),
  throughputLitresPerDay: numeric('throughput_litres_per_day', { precision: 18, scale: 3 }).notNull().default('0'),
  fuelTypes: text('fuel_types'),
  auxiliaryServices: text('auxiliary_services'),
  importance: text('importance'),
  estimatedAreaM2: numeric('estimated_area_m2', { precision: 14, scale: 3 }),
  representative: text('representative'),
  sourceFile: text('source_file').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [index('energy_oil_facilities_type_status_idx').on(t.facilityType, t.operationStatus), index('energy_oil_facilities_importance_idx').on(t.importance)]);

export const energyOilPipelines = pgTable('energy_oil_pipelines', {
  assetId: uuid('asset_id').primaryKey().references(() => energyAssets.id, { onDelete: 'cascade' }),
  sourceFacilityCode: text('source_facility_code'),
  destinationCode: text('destination_code'),
  pipelineType: text('pipeline_type').notNull(),
  lengthKm: numeric('length_km', { precision: 14, scale: 3 }),
  geometry: geometry('geometry').notNull(),
  sourceFile: text('source_file').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [index('energy_oil_pipelines_geometry_gist').using('gist', t.geometry), uniqueIndex('energy_oil_pipelines_code_uq').on(t.assetId)]);

export const energyOilFacilitySnapshots = pgTable('energy_oil_facility_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  facilityAssetId: uuid('facility_asset_id').notNull().references(() => energyAssets.id, { onDelete: 'cascade' }),
  measuredAt: timestamp('measured_at', { withTimezone: true }).notNull(),
  throughputLitres: numeric('throughput_litres', { precision: 18, scale: 3 }).notNull(),
  utilizationPct: numeric('utilization_pct', { precision: 7, scale: 3 }).notNull(),
  source: text('source').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [index('energy_oil_facility_snapshots_idx').on(t.facilityAssetId, t.measuredAt), uniqueIndex('energy_oil_facility_snapshots_uq').on(t.facilityAssetId, t.measuredAt)]);

export const energyOilAlerts = pgTable('energy_oil_alerts', {
  id: uuid('id').defaultRandom().primaryKey(),
  facilityAssetId: uuid('facility_asset_id').notNull().references(() => energyAssets.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  alertType: text('alert_type').notNull(),
  severity: text('severity').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  recommendation: text('recommendation').notNull(),
  status: text('status').notNull().default('OPEN'),
  detectedAt: timestamp('detected_at', { withTimezone: true }).notNull(),
  source: text('source').notNull().default('MANUAL'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [uniqueIndex('energy_oil_alerts_code_uq').on(t.code), index('energy_oil_alerts_facility_idx').on(t.facilityAssetId, t.detectedAt), index('energy_oil_alerts_severity_idx').on(t.alertType, t.severity, t.status)]);