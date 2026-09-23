import { index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { energyAssets } from './core';
import { energyLinePositions } from './grid';

/**
 * First-class pole/tower/support model for Mission 1.
 * EVN position rows remain in energy_line_positions for route geometry; this table
 * stores engineering attributes of the physical support when the position is a pole/tower.
 */
export const energyPowerStructures = pgTable('energy_power_structures', {
  assetId: uuid('asset_id').primaryKey().references(() => energyAssets.id, { onDelete: 'cascade' }),
  positionId: uuid('position_id').references(() => energyLinePositions.id, { onDelete: 'set null' }),
  lineAssetId: uuid('line_asset_id').references(() => energyAssets.id, { onDelete: 'set null' }),
  structureType: text('structure_type').notNull().default('POLE'),
  material: text('material'),
  heightM: numeric('height_m', { precision: 10, scale: 3 }),
  foundationType: text('foundation_type'),
  circuitCount: integer('circuit_count'),
  groundingType: text('grounding_type'),
  groundingResistanceOhm: numeric('grounding_resistance_ohm', { precision: 10, scale: 3 }),
  operator: text('operator'),
  technicalSpecs: jsonb('technical_specs').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [
  uniqueIndex('energy_power_structures_position_uq').on(t.positionId),
  index('energy_power_structures_line_type_idx').on(t.lineAssetId, t.structureType),
]);

/**
 * Operational history for substations/feeders/lines. The specialized grid tables
 * keep the latest denormalized values for fast dashboards; this table preserves
 * the time-stamped history and source/provenance of each update.
 */
export const energyGridOperatingSnapshots = pgTable('energy_grid_operating_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  assetId: uuid('asset_id').notNull().references(() => energyAssets.id, { onDelete: 'cascade' }),
  measuredAt: timestamp('measured_at', { withTimezone: true }).notNull(),
  currentLoadMva: numeric('current_load_mva', { precision: 14, scale: 3 }),
  currentLoadMw: numeric('current_load_mw', { precision: 14, scale: 3 }),
  ratedCapacityMva: numeric('rated_capacity_mva', { precision: 14, scale: 3 }),
  ratedCapacityMw: numeric('rated_capacity_mw', { precision: 14, scale: 3 }),
  loadFactorPct: numeric('load_factor_pct', { precision: 7, scale: 3 }),
  availableCapacityMva: numeric('available_capacity_mva', { precision: 14, scale: 3 }),
  availableCapacityMw: numeric('available_capacity_mw', { precision: 14, scale: 3 }),
  overloadStatus: text('overload_status').notNull().default('NORMAL'),
  source: text('source').notNull().default('MANUAL'),
  sourceRef: text('source_ref'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('energy_grid_operating_asset_time_idx').on(t.assetId, t.measuredAt),
  index('energy_grid_operating_status_time_idx').on(t.overloadStatus, t.measuredAt),
]);

/**
 * Switching, energizing, maintenance and incident-response history displayed by
 * Mission 1. Events are immutable operational facts; corrections are recorded in
 * metadata instead of overwriting the original source description.
 */
export const energyGridOperationEvents = pgTable('energy_grid_operation_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull(),
  assetId: uuid('asset_id').references(() => energyAssets.id, { onDelete: 'set null' }),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  eventType: text('event_type').notNull(),
  reason: text('reason').notNull(),
  affectedDescription: text('affected_description').notNull(),
  actor: text('actor').notNull(),
  status: text('status').notNull().default('RECORDED'),
  source: text('source').notNull(),
  sourceRef: text('source_ref'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('energy_grid_operation_events_code_uq').on(t.code),
  index('energy_grid_operation_events_asset_time_idx').on(t.assetId, t.occurredAt),
  index('energy_grid_operation_events_type_time_idx').on(t.eventType, t.occurredAt),
]);

/**
 * Materialized alerts generated from telemetry/snapshots. Keeping the alert and
 * its calculation provenance lets the dashboard explain why a warning exists.
 */
export const energyGridAlerts = pgTable('energy_grid_alerts', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull(),
  assetId: uuid('asset_id').references(() => energyAssets.id, { onDelete: 'cascade' }),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull(),
  severity: text('severity').notNull(),
  currentValue: numeric('current_value', { precision: 14, scale: 3 }).notNull(),
  forecastValue: numeric('forecast_value', { precision: 14, scale: 3 }),
  trend: text('trend').notNull().default('FLAT'),
  riskLevel: text('risk_level').notNull(),
  reason: text('reason').notNull(),
  recommendation: text('recommendation').notNull(),
  status: text('status').notNull().default('OPEN'),
  source: text('source').notNull(),
  sourceRef: text('source_ref'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('energy_grid_alerts_code_uq').on(t.code),
  index('energy_grid_alerts_asset_time_idx').on(t.assetId, t.generatedAt),
  index('energy_grid_alerts_status_severity_idx').on(t.status, t.severity, t.generatedAt),
]);
