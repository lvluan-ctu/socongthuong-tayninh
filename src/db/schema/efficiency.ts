import { boolean, index, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { energyDataSources, energyMeasurementPoints, energyParties, energySites } from './core';
import { energyCustomerAccounts } from './solar';

export const energyConsumers = pgTable('energy_consumers', {
  id: uuid('id').defaultRandom().primaryKey(),
  partyId: uuid('party_id').notNull().references(() => energyParties.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').references(() => energySites.id, { onDelete: 'set null' }),
  customerAccountId: uuid('customer_account_id').references(() => energyCustomerAccounts.id, { onDelete: 'set null' }),
  classification: text('classification').notNull(),
  consumerGroup: text('consumer_group').notNull().default('OTHER'),
  importanceLevel: text('importance_level').notNull().default('NORMAL'),
  sector: text('sector').notNull(),
  industryZoneCode: text('industry_zone_code'),
  reportingRequired: text('reporting_required').notNull().default('NO'),
  status: text('status').notNull().default('ACTIVE'),
}, (t) => [
  index('energy_consumers_class_sector_idx').on(t.classification, t.sector),
  index('energy_consumers_group_importance_idx').on(t.consumerGroup, t.importanceLevel),
]);

export const energyConsumerClassificationHistory = pgTable('energy_consumer_classification_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  consumerId: uuid('consumer_id').notNull().references(() => energyConsumers.id, { onDelete: 'cascade' }),
  consumerGroup: text('consumer_group').notNull(),
  importanceLevel: text('importance_level').notNull(),
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
  validTo: timestamp('valid_to', { withTimezone: true }),
  sourceDocumentNo: text('source_document_no'),
  sourceDocumentRef: text('source_document_ref'),
  issuedBy: text('issued_by'),
  reason: text('reason'),
  status: text('status').notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('energy_consumer_class_history_consumer_time_idx').on(t.consumerId, t.validFrom),
  index('energy_consumer_class_history_status_idx').on(t.status),
]);

export const energySmartMeters = pgTable('energy_smart_meters', {
  id: uuid('id').defaultRandom().primaryKey(),
  consumerId: uuid('consumer_id').references(() => energyConsumers.id, { onDelete: 'set null' }),
  siteId: uuid('site_id').references(() => energySites.id, { onDelete: 'set null' }),
  customerAccountId: uuid('customer_account_id').references(() => energyCustomerAccounts.id, { onDelete: 'set null' }),
  measurementPointId: uuid('measurement_point_id').references(() => energyMeasurementPoints.id, { onDelete: 'set null' }),
  meterCode: text('meter_code').notNull(),
  provider: text('provider').notNull().default('EVN'),
  meterType: text('meter_type').notNull().default('SMART_METER'),
  manufacturer: text('manufacturer'),
  model: text('model'),
  serialNumber: text('serial_number'),
  phaseType: text('phase_type'),
  voltageLevelKv: numeric('voltage_level_kv', { precision: 10, scale: 3 }),
  installedAt: timestamp('installed_at', { withTimezone: true }),
  commissionedAt: timestamp('commissioned_at', { withTimezone: true }),
  lastInspectionAt: timestamp('last_inspection_at', { withTimezone: true }),
  nextInspectionDueAt: timestamp('next_inspection_due_at', { withTimezone: true }),
  replacementDueAt: timestamp('replacement_due_at', { withTimezone: true }),
  status: text('status').notNull().default('ACTIVE'),
  communicationType: text('communication_type'),
  sourceId: uuid('source_id').references(() => energyDataSources.id, { onDelete: 'set null' }),
  sourceRef: text('source_ref'),
  confidence: numeric('confidence', { precision: 7, scale: 3 }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('energy_smart_meters_code_uq').on(t.meterCode),
  index('energy_smart_meters_consumer_status_idx').on(t.consumerId, t.status),
  index('energy_smart_meters_measurement_point_idx').on(t.measurementPointId),
]);

export const energyMeterEvents = pgTable('energy_meter_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  smartMeterId: uuid('smart_meter_id').notNull().references(() => energySmartMeters.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  eventAt: timestamp('event_at', { withTimezone: true }).notNull(),
  description: text('description'),
  source: text('source').notNull().default('MANUAL'),
  sourceRef: text('source_ref'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('energy_meter_events_meter_time_idx').on(t.smartMeterId, t.eventAt),
  index('energy_meter_events_type_idx').on(t.eventType),
]);

export const energyConsumerReports = pgTable('energy_consumer_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  consumerId: uuid('consumer_id').notNull().references(() => energyConsumers.id, { onDelete: 'cascade' }),
  period: text('period').notNull(),
  reportType: text('report_type').notNull().default('MONTHLY'),
  periodFrom: text('period_from'),
  periodTo: text('period_to'),
  reportVersion: text('report_version').notNull().default('1.0'),
  reportedEnergyKwh: numeric('reported_energy_kwh', { precision: 18, scale: 3 }).notNull(),
  status: text('status').notNull().default('DRAFT'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  submittedBy: text('submitted_by'),
  documentRef: text('document_ref'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [uniqueIndex('energy_consumer_reports_period_uq').on(t.consumerId, t.period)]);

export const energyConsumerReportLines = pgTable('energy_consumer_report_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  reportId: uuid('report_id').notNull().references(() => energyConsumerReports.id, { onDelete: 'cascade' }),
  metricCode: text('metric_code').notNull(),
  value: numeric('value', { precision: 20, scale: 6 }).notNull(),
  unit: text('unit').notNull(),
  source: text('source').notNull().default('CONSUMER_REPORT'),
  sourceRef: text('source_ref'),
  quality: text('quality').notNull().default('REPORTED'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('energy_consumer_report_lines_metric_uq').on(t.reportId, t.metricCode),
  index('energy_consumer_report_lines_report_idx').on(t.reportId),
]);

export const energyReconciliationRuleSets = pgTable('energy_reconciliation_rule_sets', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  version: text('version').notNull(),
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
  validTo: timestamp('valid_to', { withTimezone: true }),
  status: text('status').notNull().default('DRAFT'),
  sourceDocumentNo: text('source_document_no'),
  sourceDocumentRef: text('source_document_ref'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('energy_reconciliation_rule_sets_code_version_uq').on(t.code, t.version),
  index('energy_reconciliation_rule_sets_status_valid_idx').on(t.status, t.validFrom),
]);

export const energyReconciliationRules = pgTable('energy_reconciliation_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  ruleSetId: uuid('rule_set_id').notNull().references(() => energyReconciliationRuleSets.id, { onDelete: 'cascade' }),
  metricCode: text('metric_code').notNull(),
  matchThresholdPct: numeric('match_threshold_pct', { precision: 9, scale: 4 }).notNull(),
  reviewThresholdPct: numeric('review_threshold_pct', { precision: 9, scale: 4 }).notNull(),
  minDenominator: numeric('min_denominator', { precision: 20, scale: 6 }).notNull().default('0'),
  severity: text('severity').notNull().default('ALERT'),
  unit: text('unit').notNull().default('%'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('energy_reconciliation_rules_metric_uq').on(t.ruleSetId, t.metricCode),
  index('energy_reconciliation_rules_set_idx').on(t.ruleSetId),
]);

export const energyReconciliationRuns = pgTable('energy_reconciliation_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  reportId: uuid('report_id').notNull().references(() => energyConsumerReports.id, { onDelete: 'cascade' }),
  evnEnergyKwh: numeric('evn_energy_kwh', { precision: 18, scale: 3 }).notNull(),
  reportedEnergyKwh: numeric('reported_energy_kwh', { precision: 18, scale: 3 }).notNull(),
  differenceKwh: numeric('difference_kwh', { precision: 18, scale: 3 }).notNull(),
  differencePct: numeric('difference_pct', { precision: 9, scale: 4 }).notNull(),
  result: text('result').notNull(),
  ruleVersion: text('rule_version').notNull(),
  ruleSetId: uuid('rule_set_id').references(() => energyReconciliationRuleSets.id, { onDelete: 'set null' }),
  inputHash: text('input_hash'),
  reportVersion: text('report_version').notNull().default('1.0'),
  executedAt: timestamp('executed_at', { withTimezone: true }).notNull().defaultNow(),
  evnSourceRef: text('evn_source_ref'),
  reportSourceRef: text('report_source_ref'),
  explanation: jsonb('explanation').$type<Record<string, unknown>>().notNull().default({}),
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewDecision: text('review_decision'),
}, (t) => [index('energy_reconciliation_result_idx').on(t.result)]);

export const energyEfficiencyBaselines = pgTable('energy_efficiency_baselines', {
  id: uuid('id').defaultRandom().primaryKey(),
  consumerId: uuid('consumer_id').notNull().references(() => energyConsumers.id, { onDelete: 'cascade' }),
  baselineType: text('baseline_type').notNull().default('HISTORICAL_AVERAGE'),
  periodFrom: text('period_from').notNull(),
  periodTo: text('period_to').notNull(),
  baselineKwh: numeric('baseline_kwh', { precision: 20, scale: 6 }).notNull(),
  normalizationMethod: text('normalization_method').notNull().default('NONE'),
  weatherAdjusted: boolean('weather_adjusted').notNull().default(false),
  productionAdjusted: boolean('production_adjusted').notNull().default(false),
  methodVersion: text('method_version').notNull(),
  sourceId: uuid('source_id').references(() => energyDataSources.id, { onDelete: 'set null' }),
  sourceRef: text('source_ref'),
  status: text('status').notNull().default('DRAFT'),
  notes: text('notes'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('energy_efficiency_baselines_consumer_period_idx').on(t.consumerId, t.periodFrom, t.periodTo),
  index('energy_efficiency_baselines_status_idx').on(t.status),
]);

export const energyConsumerActivityMetrics = pgTable('energy_consumer_activity_metrics', {
  id: uuid('id').defaultRandom().primaryKey(),
  consumerId: uuid('consumer_id').notNull().references(() => energyConsumers.id, { onDelete: 'cascade' }),
  period: text('period').notNull(),
  metricCode: text('metric_code').notNull(),
  value: numeric('value', { precision: 20, scale: 6 }).notNull(),
  unit: text('unit').notNull(),
  source: text('source').notNull().default('MANUAL'),
  sourceRef: text('source_ref'),
  quality: text('quality').notNull().default('REPORTED'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('energy_consumer_activity_metric_uq').on(t.consumerId, t.period, t.metricCode),
  index('energy_consumer_activity_metric_code_idx').on(t.metricCode, t.period),
]);

export const energyEfficiencyBenchmarks = pgTable('energy_efficiency_benchmarks', {
  id: uuid('id').defaultRandom().primaryKey(),
  sector: text('sector').notNull(),
  consumerGroup: text('consumer_group'),
  metricCode: text('metric_code').notNull(),
  benchmarkValue: numeric('benchmark_value', { precision: 20, scale: 6 }).notNull(),
  unit: text('unit').notNull(),
  lowerBound: numeric('lower_bound', { precision: 20, scale: 6 }),
  upperBound: numeric('upper_bound', { precision: 20, scale: 6 }),
  methodVersion: text('method_version').notNull(),
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
  validTo: timestamp('valid_to', { withTimezone: true }),
  sourceRef: text('source_ref'),
  status: text('status').notNull().default('DRAFT'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('energy_efficiency_benchmarks_lookup_idx').on(t.sector, t.consumerGroup, t.metricCode, t.validFrom),
]);

export const energySavingMeasures = pgTable('energy_saving_measures', {
  id: uuid('id').defaultRandom().primaryKey(),
  consumerId: uuid('consumer_id').notNull().references(() => energyConsumers.id, { onDelete: 'cascade' }),
  baselineId: uuid('baseline_id').references(() => energyEfficiencyBaselines.id, { onDelete: 'set null' }),
  measureCode: text('measure_code').notNull().default('GENERAL'),
  name: text('name').notNull(),
  status: text('status').notNull().default('PROPOSED'),
  estimatedSavingKwhYear: numeric('estimated_saving_kwh_year', { precision: 18, scale: 3 }),
  actualSavingKwhYear: numeric('actual_saving_kwh_year', { precision: 18, scale: 3 }),
  savingRatePct: numeric('saving_rate_pct', { precision: 9, scale: 4 }),
  investmentCost: numeric('investment_cost', { precision: 20, scale: 2 }),
  targetCompletionAt: timestamp('target_completion_at', { withTimezone: true }),
  sourceRef: text('source_ref'),
  evidenceRef: text('evidence_ref'),
  verifiedBy: text('verified_by'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('energy_saving_measures_consumer_status_idx').on(t.consumerId, t.status),
  index('energy_saving_measures_baseline_idx').on(t.baselineId),
]);
