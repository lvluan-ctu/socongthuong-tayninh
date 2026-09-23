import {
  boolean,
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

export const energyAiJobs = pgTable('energy_ai_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  missionCode: text('mission_code').notNull(),
  status: text('status').notNull().default('PENDING'),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  requestedBy: text('requested_by'),
  requestId: text('request_id').notNull(),
  externalRequestId: text('external_request_id'),
  externalJobId: text('external_job_id'),
  modelName: text('model_name'),
  modelVersion: text('model_version'),
  contractVersion: text('contract_version').notNull().default('1.0'),
  inputSnapshot: jsonb('input_snapshot').$type<Record<string, unknown>>(),
  inputHash: text('input_hash'),
  progressPct: integer('progress_pct'),
  progressStep: text('progress_step'),
  latencyMs: integer('latency_ms'),
  queuedAt: timestamp('queued_at', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').notNull().default(0),
  isMock: boolean('is_mock').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('energy_ai_jobs_request_id_uq').on(t.requestId),
  index('energy_ai_jobs_mission_created_idx').on(t.missionCode, t.createdAt),
  index('energy_ai_jobs_status_created_idx').on(t.status, t.createdAt),
  index('energy_ai_jobs_entity_created_idx').on(t.entityType, t.entityId, t.createdAt),
  index('energy_ai_jobs_requested_by_created_idx').on(t.requestedBy, t.createdAt),
  index('energy_ai_jobs_external_job_idx').on(t.externalJobId),
]);

export const energyAiJobResults = pgTable('energy_ai_job_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id').notNull().references(() => energyAiJobs.id, { onDelete: 'cascade' }),
  generatedAt: timestamp('generated_at', { withTimezone: true }),
  dataCutoff: timestamp('data_cutoff', { withTimezone: true }),
  horizonValue: integer('horizon_value'),
  horizonUnit: text('horizon_unit'),
  confidenceValue: numeric('confidence_value', { precision: 12, scale: 6 }),
  confidenceScale: text('confidence_scale'),
  summary: jsonb('summary').$type<Record<string, unknown>>().notNull().default({}),
  series: jsonb('series').$type<unknown[]>().notNull().default([]),
  alerts: jsonb('alerts').$type<unknown[]>().notNull().default([]),
  tableData: jsonb('table_data').$type<Record<string, unknown>>(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  rawResponse: jsonb('raw_response').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('energy_ai_job_results_job_uq').on(t.jobId),
  index('energy_ai_job_results_generated_idx').on(t.generatedAt),
]);

export const energyAiJobFiles = pgTable('energy_ai_job_files', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id').notNull().references(() => energyAiJobs.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('INPUT'),
  storageKey: text('storage_key').notNull(),
  originalName: text('original_name'),
  mimeType: text('mime_type'),
  sizeBytes: numeric('size_bytes', { precision: 20, scale: 0 }),
  sha256: text('sha256'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('energy_ai_job_files_job_role_idx').on(t.jobId, t.role),
  index('energy_ai_job_files_sha256_idx').on(t.sha256),
]);

export const energyAiJobReviews = pgTable('energy_ai_job_reviews', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id').notNull().references(() => energyAiJobs.id, { onDelete: 'cascade' }),
  reviewerId: text('reviewer_id').notNull(),
  decision: text('decision').notNull(),
  comment: text('comment'),
  corrections: jsonb('corrections').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('energy_ai_job_reviews_job_created_idx').on(t.jobId, t.createdAt),
  index('energy_ai_job_reviews_reviewer_created_idx').on(t.reviewerId, t.createdAt),
]);

export const energyAiForecastEvaluations = pgTable('energy_ai_forecast_evaluations', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id').notNull().references(() => energyAiJobs.id, { onDelete: 'cascade' }),
  metricName: text('metric_name').notNull(),
  metricValue: numeric('metric_value', { precision: 20, scale: 8 }).notNull(),
  evaluationWindowStart: timestamp('evaluation_window_start', { withTimezone: true }),
  evaluationWindowEnd: timestamp('evaluation_window_end', { withTimezone: true }),
  actualSource: text('actual_source'),
  details: jsonb('details').$type<Record<string, unknown>>(),
  evaluatedAt: timestamp('evaluated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('energy_ai_forecast_eval_job_metric_idx').on(t.jobId, t.metricName),
  index('energy_ai_forecast_eval_time_idx').on(t.evaluatedAt),
]);
