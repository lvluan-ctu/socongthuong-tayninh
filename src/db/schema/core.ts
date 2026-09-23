import { customType, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const geometry = customType<{ data: string; driverData: string }>({ dataType: () => 'geometry' });
export const geography = customType<{ data: string; driverData: string }>({ dataType: () => 'geography' });

export const energyAdminAreas = pgTable('energy_admin_areas', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  level: text('level').notNull(),
  parentCode: text('parent_code'),
  boundary: geometry('boundary'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [uniqueIndex('energy_admin_areas_code_uq').on(t.code), index('energy_admin_areas_boundary_gist').using('gist', t.boundary)]);

export const energyParties = pgTable('energy_parties', {
  id: uuid('id').defaultRandom().primaryKey(),
  partyType: text('party_type').notNull(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  taxCode: text('tax_code'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  adminAreaCode: text('admin_area_code'),
  status: text('status').notNull().default('ACTIVE'),
  classification: text('classification').notNull().default('INTERNAL'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('energy_parties_code_uq').on(t.code), index('energy_parties_type_status_idx').on(t.partyType, t.status)]);

export const energySites = pgTable('energy_sites', {
  id: uuid('id').defaultRandom().primaryKey(),
  partyId: uuid('party_id').references(() => energyParties.id, { onDelete: 'set null' }),
  code: text('code').notNull(),
  name: text('name').notNull(),
  siteType: text('site_type').notNull(),
  address: text('address'),
  adminAreaCode: text('admin_area_code'),
  location: geography('location'),
  boundary: geometry('boundary'),
  classification: text('classification').notNull().default('INTERNAL'),
  status: text('status').notNull().default('ACTIVE'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('energy_sites_code_uq').on(t.code),
  index('energy_sites_admin_type_idx').on(t.adminAreaCode, t.siteType),
  index('energy_sites_location_gist').using('gist', t.location),
  index('energy_sites_boundary_gist').using('gist', t.boundary),
]);

export const energyAssets = pgTable('energy_assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  siteId: uuid('site_id').references(() => energySites.id, { onDelete: 'set null' }),
  ownerPartyId: uuid('owner_party_id').references(() => energyParties.id, { onDelete: 'set null' }),
  assetType: text('asset_type').notNull(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  status: text('status').notNull().default('ACTIVE'),
  commissionedAt: timestamp('commissioned_at', { withTimezone: true }),
  location: geography('location'),
  boundary: geometry('boundary'),
  classification: text('classification').notNull().default('INTERNAL'),
  sourceUpdatedAt: timestamp('source_updated_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('energy_assets_code_uq').on(t.code),
  index('energy_assets_type_status_idx').on(t.assetType, t.status),
  index('energy_assets_location_gist').using('gist', t.location),
]);

export const energyExternalIdentifiers = pgTable('energy_external_identifiers', {
  id: uuid('id').defaultRandom().primaryKey(),
  assetId: uuid('asset_id').references(() => energyAssets.id, { onDelete: 'cascade' }),
  partyId: uuid('party_id').references(() => energyParties.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  identifierType: text('identifier_type').notNull(),
  identifierValue: text('identifier_value').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [uniqueIndex('energy_external_ids_provider_value_uq').on(t.provider, t.identifierType, t.identifierValue), index('energy_external_ids_asset_idx').on(t.assetId)]);

export const energyAssetRelations = pgTable('energy_asset_relations', {
  id: uuid('id').defaultRandom().primaryKey(),
  fromAssetId: uuid('from_asset_id').notNull().references(() => energyAssets.id, { onDelete: 'cascade' }),
  toAssetId: uuid('to_asset_id').notNull().references(() => energyAssets.id, { onDelete: 'cascade' }),
  relationType: text('relation_type').notNull(),
  sourceRelationType: text('source_relation_type'),
  sequenceNo: integer('sequence_no'),
  validFrom: timestamp('valid_from', { withTimezone: true }),
  validTo: timestamp('valid_to', { withTimezone: true }),
  inferred: integer('inferred').notNull().default(0),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [uniqueIndex('energy_asset_relations_uq').on(t.fromAssetId, t.toAssetId, t.relationType), index('energy_asset_relations_to_idx').on(t.toAssetId, t.relationType)]);

export const energyDataSources = pgTable('energy_data_sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  provider: text('provider').notNull(),
  sourceType: text('source_type').notNull(),
  owner: text('owner'),
  endpointRef: text('endpoint_ref'),
  schedule: text('schedule'),
  refreshCadence: text('refresh_cadence'),
  authoritativeLevel: text('authoritative_level').notNull().default('REFERENCE'),
  status: text('status').notNull().default('ACTIVE'),
  classification: text('classification').notNull().default('INTERNAL'),
  sourceVersion: text('source_version'),
  lastSourceUpdatedAt: timestamp('last_source_updated_at', { withTimezone: true }),
  config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('energy_data_sources_code_uq').on(t.code),
  index('energy_data_sources_governance_idx').on(t.provider, t.sourceType, t.authoritativeLevel, t.status),
]);

export const energyImportBatches = pgTable('energy_import_batches', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceId: uuid('source_id').references(() => energyDataSources.id, { onDelete: 'restrict' }),
  fileName: text('file_name'),
  checksum: text('checksum'),
  entityType: text('entity_type').notNull(),
  status: text('status').notNull().default('UPLOADED'),
  observationDate: timestamp('observation_date', { withTimezone: true }),
  recordsRead: integer('records_read').notNull().default(0),
  recordsAccepted: integer('records_accepted').notNull().default(0),
  recordsRejected: integer('records_rejected').notNull().default(0),
  submittedBy: text('submitted_by'),
  parserVersion: text('parser_version'),
  mappingVersion: text('mapping_version'),
  sourceUpdatedAt: timestamp('source_updated_at', { withTimezone: true }),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('energy_import_batches_status_created_idx').on(t.status, t.createdAt),
  uniqueIndex('energy_import_batches_source_checksum_uq').on(t.sourceId, t.checksum),
]);

export const energyImportRecords = pgTable('energy_import_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id').notNull().references(() => energyImportBatches.id, { onDelete: 'cascade' }),
  sheetName: text('sheet_name'),
  rowNumber: integer('row_number').notNull(),
  externalKey: text('external_key'),
  parentExternalKey: text('parent_external_key'),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  validationStatus: text('validation_status').notNull().default('PENDING'),
  resolvedAssetId: uuid('resolved_asset_id').references(() => energyAssets.id, { onDelete: 'set null' }),
  errorMessage: text('error_message'),
}, (t) => [uniqueIndex('energy_import_records_batch_row_uq').on(t.batchId, t.rowNumber), index('energy_import_records_validation_idx').on(t.batchId, t.validationStatus)]);

export const energyMetricDefinitions = pgTable('energy_metric_definitions', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  unit: text('unit').notNull(),
  aggregation: text('aggregation').notNull().default('AVG'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
});

export const energyMeasurementPoints = pgTable('energy_measurement_points', {
  id: uuid('id').defaultRandom().primaryKey(),
  assetId: uuid('asset_id').references(() => energyAssets.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  name: text('name').notNull(),
  provider: text('provider'),
  externalCode: text('external_code'),
  voltageLevelKv: numeric('voltage_level_kv', { precision: 10, scale: 3 }),
  status: text('status').notNull().default('ACTIVE'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [uniqueIndex('energy_measurement_points_code_uq').on(t.code), index('energy_measurement_points_asset_idx').on(t.assetId)]);

export const energyMeasurements = pgTable('energy_measurements', {
  id: uuid('id').defaultRandom().primaryKey(),
  measurementPointId: uuid('measurement_point_id').notNull().references(() => energyMeasurementPoints.id, { onDelete: 'cascade' }),
  metricCode: text('metric_code').notNull().references(() => energyMetricDefinitions.code, { onDelete: 'restrict' }),
  measuredAt: timestamp('measured_at', { withTimezone: true }).notNull(),
  value: numeric('value', { precision: 20, scale: 6 }).notNull(),
  unit: text('unit').notNull(),
  quality: text('quality').notNull().default('GOOD'),
  sourceId: uuid('source_id').references(() => energyDataSources.id, { onDelete: 'set null' }),
  batchId: uuid('batch_id').references(() => energyImportBatches.id, { onDelete: 'set null' }),
  rawValue: text('raw_value'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [uniqueIndex('energy_measurements_point_metric_time_uq').on(t.measurementPointId, t.metricCode, t.measuredAt), index('energy_measurements_metric_time_idx').on(t.metricCode, t.measuredAt)]);
