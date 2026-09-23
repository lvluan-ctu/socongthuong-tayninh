import { index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { energyAssets, geography, geometry } from './core';

export const energySubstations = pgTable('energy_substations', {
  assetId: uuid('asset_id').primaryKey().references(() => energyAssets.id, { onDelete: 'cascade' }),
  voltageLevelKv: numeric('voltage_level_kv', { precision: 10, scale: 3 }).notNull(),
  substationType: text('substation_type').notNull(),
  designedCapacityMva: numeric('designed_capacity_mva', { precision: 14, scale: 3 }),
  installedCapacityMva: numeric('installed_capacity_mva', { precision: 14, scale: 3 }),
  currentLoadMva: numeric('current_load_mva', { precision: 14, scale: 3 }),
  loadFactorPct: numeric('load_factor_pct', { precision: 7, scale: 3 }),
  availableCapacityMva: numeric('available_capacity_mva', { precision: 14, scale: 3 }),
  overloadStatus: text('overload_status').notNull().default('NORMAL'),
  operator: text('operator'),
  controlTechnology: text('control_technology'),
  technicalSpecs: jsonb('technical_specs').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [index('energy_substations_voltage_load_idx').on(t.voltageLevelKv, t.loadFactorPct)]);

export const energyTransformers = pgTable('energy_transformers', {
  assetId: uuid('asset_id').primaryKey().references(() => energyAssets.id, { onDelete: 'cascade' }),
  substationAssetId: uuid('substation_asset_id').references(() => energyAssets.id, { onDelete: 'set null' }),
  role: text('role').notNull().default('POWER'),
  primaryVoltageKv: numeric('primary_voltage_kv', { precision: 10, scale: 3 }),
  secondaryVoltageKv: numeric('secondary_voltage_kv', { precision: 10, scale: 3 }),
  tertiaryVoltageKv: numeric('tertiary_voltage_kv', { precision: 10, scale: 3 }),
  ratedCapacityMva: numeric('rated_capacity_mva', { precision: 14, scale: 3 }),
  coolingMethod: text('cooling_method'),
  vectorGroup: text('vector_group'),
  manufacturer: text('manufacturer'),
  model: text('model'),
  serialNumber: text('serial_number'),
  technicalSpecs: jsonb('technical_specs').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [index('energy_transformers_substation_idx').on(t.substationAssetId)]);

export const energyBays = pgTable('energy_bays', {
  assetId: uuid('asset_id').primaryKey().references(() => energyAssets.id, { onDelete: 'cascade' }),
  substationAssetId: uuid('substation_asset_id').notNull().references(() => energyAssets.id, { onDelete: 'cascade' }),
  bayCode: text('bay_code').notNull(),
  bayType: text('bay_type').notNull(),
  voltageLevelKv: numeric('voltage_level_kv', { precision: 10, scale: 3 }),
  ratedCurrentA: numeric('rated_current_a', { precision: 12, scale: 3 }),
  technicalSpecs: jsonb('technical_specs').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [index('energy_bays_substation_idx').on(t.substationAssetId, t.voltageLevelKv)]);

export const energyFeeders = pgTable('energy_feeders', {
  assetId: uuid('asset_id').primaryKey().references(() => energyAssets.id, { onDelete: 'cascade' }),
  substationAssetId: uuid('substation_asset_id').references(() => energyAssets.id, { onDelete: 'set null' }),
  sourceBayAssetId: uuid('source_bay_asset_id').references(() => energyAssets.id, { onDelete: 'set null' }),
  sourceTransformerAssetId: uuid('source_transformer_asset_id').references(() => energyAssets.id, { onDelete: 'set null' }),
  feederCode: text('feeder_code').notNull(),
  voltageLevelKv: numeric('voltage_level_kv', { precision: 10, scale: 3 }).notNull(),
  ratedCapacityMw: numeric('rated_capacity_mw', { precision: 14, scale: 3 }),
  currentLoadMw: numeric('current_load_mw', { precision: 14, scale: 3 }),
  headroomMw: numeric('headroom_mw', { precision: 14, scale: 3 }),
}, (t) => [
  uniqueIndex('energy_feeders_substation_code_uq').on(t.substationAssetId, t.feederCode),
  index('energy_feeders_substation_idx').on(t.substationAssetId),
]);

export const energyPowerLines = pgTable('energy_power_lines', {
  assetId: uuid('asset_id').primaryKey().references(() => energyAssets.id, { onDelete: 'cascade' }),
  feederAssetId: uuid('feeder_asset_id').references(() => energyAssets.id, { onDelete: 'set null' }),
  parentLineAssetId: uuid('parent_line_asset_id').references(() => energyAssets.id, { onDelete: 'set null' }),
  voltageLevelKv: numeric('voltage_level_kv', { precision: 10, scale: 3 }).notNull(),
  lineType: text('line_type').notNull(),
  conductorType: text('conductor_type'),
  circuitCount: integer('circuit_count').notNull().default(1),
  lengthM: numeric('length_m', { precision: 16, scale: 3 }),
  ratedCapacityMw: numeric('rated_capacity_mw', { precision: 14, scale: 3 }),
  currentLoadMw: numeric('current_load_mw', { precision: 14, scale: 3 }),
  geometry: geometry('geometry'),
  technicalSpecs: jsonb('technical_specs').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [index('energy_power_lines_feeder_idx').on(t.feederAssetId), index('energy_power_lines_geometry_gist').using('gist', t.geometry)]);

export const energyLinePositions = pgTable('energy_line_positions', {
  id: uuid('id').defaultRandom().primaryKey(),
  lineAssetId: uuid('line_asset_id').notNull().references(() => energyAssets.id, { onDelete: 'cascade' }),
  assetId: uuid('asset_id').references(() => energyAssets.id, { onDelete: 'set null' }),
  positionCode: text('position_code').notNull(),
  sequenceNo: integer('sequence_no').notNull(),
  location: geography('location').notNull(),
  distanceFromPreviousM: numeric('distance_from_previous_m', { precision: 12, scale: 3 }),
  turnAngleDeg: numeric('turn_angle_deg', { precision: 8, scale: 3 }),
  circuitCount: integer('circuit_count'),
  groundingResistanceOhm: numeric('grounding_resistance_ohm', { precision: 10, scale: 3 }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [uniqueIndex('energy_line_positions_line_seq_uq').on(t.lineAssetId, t.sequenceNo), index('energy_line_positions_location_gist').using('gist', t.location)]);

export const energyElectricalEquipment = pgTable('energy_electrical_equipment', {
  assetId: uuid('asset_id').primaryKey().references(() => energyAssets.id, { onDelete: 'cascade' }),
  substationAssetId: uuid('substation_asset_id').references(() => energyAssets.id, { onDelete: 'set null' }),
  bayAssetId: uuid('bay_asset_id').references(() => energyAssets.id, { onDelete: 'set null' }),
  equipmentType: text('equipment_type').notNull(),
  ratedVoltageKv: numeric('rated_voltage_kv', { precision: 10, scale: 3 }),
  ratedCurrentA: numeric('rated_current_a', { precision: 12, scale: 3 }),
  manufacturer: text('manufacturer'),
  model: text('model'),
  serialNumber: text('serial_number'),
  technicalSpecs: jsonb('technical_specs').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [index('energy_electrical_equipment_type_bay_idx').on(t.equipmentType, t.bayAssetId)]);

export const energyLoadZones = pgTable('energy_load_zones', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  adminAreaCode: text('admin_area_code'),
  zoneType: text('zone_type').notNull(),
  currentLoadMw: numeric('current_load_mw', { precision: 14, scale: 3 }),
  peakLoadMw: numeric('peak_load_mw', { precision: 14, scale: 3 }),
  geometry: geometry('geometry'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [uniqueIndex('energy_load_zones_code_uq').on(t.code), index('energy_load_zones_geometry_gist').using('gist', t.geometry)]);

export const energyGridCapacityAssessments = pgTable('energy_grid_capacity_assessments', {
  id: uuid('id').defaultRandom().primaryKey(),
  assetId: uuid('asset_id').notNull().references(() => energyAssets.id, { onDelete: 'cascade' }),
  assessedAt: timestamp('assessed_at', { withTimezone: true }).notNull().defaultNow(),
  availableCapacityMw: numeric('available_capacity_mw', { precision: 14, scale: 3 }).notNull(),
  hostingCapacityMw: numeric('hosting_capacity_mw', { precision: 14, scale: 3 }),
  loadFactorPct: numeric('load_factor_pct', { precision: 7, scale: 3 }),
  riskLevel: text('risk_level').notNull(),
  method: text('method').notNull(),
  methodVersion: text('method_version').notNull(),
  explanation: jsonb('explanation').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [index('energy_grid_capacity_asset_time_idx').on(t.assetId, t.assessedAt)]);
