import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  energyAssets,
  energyDataSources,
  energyImportBatches,
  energyImportRecords,
  energyMeasurementPoints,
  energyMetricDefinitions,
} from './core';

/**
 * Maps a provider/source-specific telemetry field to the canonical Energy metric.
 * Important: sign conventions are explicit and source values are preserved in
 * energy_measurements.raw_value. We never silently invert P/Q during import.
 */
export const energyMetricSourceMappings = pgTable('energy_metric_source_mappings', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceId: uuid('source_id').notNull().references(() => energyDataSources.id, { onDelete: 'cascade' }),
  sourceMetricCode: text('source_metric_code').notNull(),
  canonicalMetricCode: text('canonical_metric_code').notNull().references(() => energyMetricDefinitions.code, { onDelete: 'restrict' }),
  sourceUnit: text('source_unit'),
  canonicalUnit: text('canonical_unit').notNull(),
  multiplier: numeric('multiplier', { precision: 20, scale: 8 }).notNull().default('1'),
  signConvention: text('sign_convention').notNull().default('SOURCE_AS_IS'),
  directionSemantic: text('direction_semantic'),
  isActive: integer('is_active').notNull().default(1),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('energy_metric_source_mapping_uq').on(t.sourceId, t.sourceMetricCode),
  index('energy_metric_source_mapping_canonical_idx').on(t.canonicalMetricCode, t.isActive),
]);

/**
 * Manual/automatic bridge from a report identifier (AppMeter, bay/feeder code,
 * report title...) to one internal measurement point. This makes telemetry
 * imports repeatable and lets an operator correct an ambiguous EVN mapping once.
 */
export const energyMeasurementPointMappings = pgTable('energy_measurement_point_mappings', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceId: uuid('source_id').notNull().references(() => energyDataSources.id, { onDelete: 'cascade' }),
  sourceKey: text('source_key').notNull(),
  sourceLabel: text('source_label'),
  measurementPointId: uuid('measurement_point_id').notNull().references(() => energyMeasurementPoints.id, { onDelete: 'cascade' }),
  assetId: uuid('asset_id').references(() => energyAssets.id, { onDelete: 'set null' }),
  matchMethod: text('match_method').notNull(),
  confidencePct: numeric('confidence_pct', { precision: 6, scale: 3 }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('energy_measurement_point_mapping_uq').on(t.sourceId, t.sourceKey),
  index('energy_measurement_point_mapping_point_idx').on(t.measurementPointId),
  index('energy_measurement_point_mapping_asset_idx').on(t.assetId),
]);

/**
 * A review queue for suspicious/invalid source data. Raw source values are kept
 * untouched in staging; reviewers resolve the issue by documenting a decision,
 * not by silently rewriting source history.
 */
export const energyDataQualityIssues = pgTable('energy_data_quality_issues', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id').references(() => energyImportBatches.id, { onDelete: 'cascade' }),
  recordId: uuid('record_id').references(() => energyImportRecords.id, { onDelete: 'cascade' }),
  assetId: uuid('asset_id').references(() => energyAssets.id, { onDelete: 'set null' }),
  severity: text('severity').notNull().default('WARNING'),
  issueCode: text('issue_code').notNull(),
  fieldName: text('field_name'),
  rawValue: text('raw_value'),
  message: text('message').notNull(),
  status: text('status').notNull().default('OPEN'),
  resolution: text('resolution'),
  resolvedBy: text('resolved_by'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('energy_data_quality_record_issue_uq').on(t.recordId, t.issueCode),
  index('energy_data_quality_issue_status_idx').on(t.status, t.severity, t.createdAt),
  index('energy_data_quality_issue_batch_idx').on(t.batchId, t.status),
  index('energy_data_quality_issue_asset_idx').on(t.assetId, t.status),
]);
