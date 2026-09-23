import { index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { energyAssets, energyDataSources, energyParties, energySites } from './core';

export const energyGenerationProjects = pgTable('energy_generation_projects', {
  assetId: uuid('asset_id').primaryKey().references(() => energyAssets.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').references(() => energySites.id, { onDelete: 'set null' }),
  investorPartyId: uuid('investor_party_id').references(() => energyParties.id, { onDelete: 'set null' }),
  operatorPartyId: uuid('operator_party_id').references(() => energyParties.id, { onDelete: 'set null' }),
  sourceType: text('source_type').notNull(),
  designedCapacityMw: numeric('designed_capacity_mw', { precision: 14, scale: 3 }).notNull(),
  actualCapacityMw: numeric('actual_capacity_mw', { precision: 14, scale: 3 }),
  operationStatus: text('operation_status').notNull().default('PLANNED'),
  gridConnectionAssetId: uuid('grid_connection_asset_id').references(() => energyAssets.id, { onDelete: 'set null' }),
  technicalSpecs: jsonb('technical_specs').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [index('energy_generation_type_status_idx').on(t.sourceType, t.operationStatus)]);

export const energyGenerationUnits = pgTable('energy_generation_units', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectAssetId: uuid('project_asset_id').notNull().references(() => energyAssets.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  name: text('name').notNull(),
  unitType: text('unit_type').notNull(),
  designedCapacityMw: numeric('designed_capacity_mw', { precision: 14, scale: 3 }),
  availableCapacityMw: numeric('available_capacity_mw', { precision: 14, scale: 3 }),
  manufacturer: text('manufacturer'),
  model: text('model'),
  serialNumber: text('serial_number'),
  commissionedAt: timestamp('commissioned_at', { withTimezone: true }),
  status: text('status').notNull().default('ACTIVE'),
  technicalSpecs: jsonb('technical_specs').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('energy_generation_units_project_code_uq').on(t.projectAssetId, t.code),
  index('energy_generation_units_project_status_idx').on(t.projectAssetId, t.status),
]);

export const energyGenerationOperationalSnapshots = pgTable('energy_generation_operational_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectAssetId: uuid('project_asset_id').notNull().references(() => energyAssets.id, { onDelete: 'cascade' }),
  unitId: uuid('unit_id').references(() => energyGenerationUnits.id, { onDelete: 'set null' }),
  measuredAt: timestamp('measured_at', { withTimezone: true }).notNull(),
  activePowerMw: numeric('active_power_mw', { precision: 16, scale: 4 }),
  energyMwh: numeric('energy_mwh', { precision: 20, scale: 4 }),
  availableCapacityMw: numeric('available_capacity_mw', { precision: 16, scale: 4 }),
  availabilityPct: numeric('availability_pct', { precision: 7, scale: 3 }),
  efficiencyPct: numeric('efficiency_pct', { precision: 7, scale: 3 }),
  operationStatus: text('operation_status'),
  sourceId: uuid('source_id').references(() => energyDataSources.id, { onDelete: 'set null' }),
  quality: text('quality').notNull().default('GOOD'),
  resourceMetrics: jsonb('resource_metrics').$type<Record<string, unknown>>().notNull().default({}),
  notes: text('notes'),
}, (t) => [
  uniqueIndex('energy_generation_snapshot_project_unit_time_uq').on(t.projectAssetId, t.unitId, t.measuredAt),
  index('energy_generation_snapshot_project_time_idx').on(t.projectAssetId, t.measuredAt),
]);

export const energyFuelStorages = pgTable('energy_fuel_storages', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectAssetId: uuid('project_asset_id').notNull().references(() => energyAssets.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  name: text('name'),
  fuelType: text('fuel_type').notNull(),
  capacity: numeric('capacity', { precision: 18, scale: 4 }).notNull(),
  unit: text('unit').notNull(),
  minimumReserve: numeric('minimum_reserve', { precision: 18, scale: 4 }),
  locationDescription: text('location_description'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [uniqueIndex('energy_fuel_storages_code_uq').on(t.code), index('energy_fuel_storages_project_idx').on(t.projectAssetId)]);

export const energyFuelInventorySnapshots = pgTable('energy_fuel_inventory_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  storageId: uuid('storage_id').notNull().references(() => energyFuelStorages.id, { onDelete: 'cascade' }),
  measuredAt: timestamp('measured_at', { withTimezone: true }).notNull(),
  quantity: numeric('quantity', { precision: 18, scale: 4 }).notNull(),
  usableQuantity: numeric('usable_quantity', { precision: 18, scale: 4 }),
  dailyInboundAvg: numeric('daily_inbound_avg', { precision: 18, scale: 4 }),
  dailyConsumptionAvg: numeric('daily_consumption_avg', { precision: 18, scale: 4 }),
  netBurnRate: numeric('net_burn_rate', { precision: 18, scale: 4 }),
  runwayDays: numeric('runway_days', { precision: 10, scale: 2 }),
  sustainableCapacityPct: numeric('sustainable_capacity_pct', { precision: 7, scale: 3 }),
  maxSustainableCapacityMw: numeric('max_sustainable_capacity_mw', { precision: 14, scale: 3 }),
  energyEquivalentMwh: numeric('energy_equivalent_mwh', { precision: 20, scale: 3 }),
  status: text('status').notNull().default('NORMAL'),
  calculationMethod: text('calculation_method'),
  calculationVersion: text('calculation_version'),
  capacityMethod: text('capacity_method'),
  sourceRef: text('source_ref'),
  notes: text('notes'),
}, (t) => [uniqueIndex('energy_fuel_inventory_storage_time_uq').on(t.storageId, t.measuredAt)]);

export const energyFuelMovements = pgTable('energy_fuel_movements', {
  id: uuid('id').defaultRandom().primaryKey(),
  storageId: uuid('storage_id').notNull().references(() => energyFuelStorages.id, { onDelete: 'cascade' }),
  movementType: text('movement_type').notNull(),
  quantity: numeric('quantity', { precision: 18, scale: 4 }).notNull(),
  unit: text('unit').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  supplierPartyId: uuid('supplier_party_id').references(() => energyParties.id, { onDelete: 'set null' }),
  referenceNo: text('reference_no'),
  documentRef: text('document_ref'),
  notes: text('notes'),
}, (t) => [index('energy_fuel_movements_storage_time_idx').on(t.storageId, t.occurredAt)]);

export const energyFuelSupplyContracts = pgTable('energy_fuel_supply_contracts', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectAssetId: uuid('project_asset_id').notNull().references(() => energyAssets.id, { onDelete: 'cascade' }),
  storageId: uuid('storage_id').references(() => energyFuelStorages.id, { onDelete: 'set null' }),
  supplierPartyId: uuid('supplier_party_id').references(() => energyParties.id, { onDelete: 'set null' }),
  contractNo: text('contract_no').notNull(),
  fuelType: text('fuel_type').notNull(),
  contractedQuantity: numeric('contracted_quantity', { precision: 18, scale: 4 }),
  unit: text('unit'),
  startAt: timestamp('start_at', { withTimezone: true }),
  endAt: timestamp('end_at', { withTimezone: true }),
  deliveryRatePerDay: numeric('delivery_rate_per_day', { precision: 18, scale: 4 }),
  status: text('status').notNull().default('ACTIVE'),
  documentRef: text('document_ref'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [uniqueIndex('energy_fuel_supply_contract_no_uq').on(t.contractNo), index('energy_fuel_supply_contract_project_idx').on(t.projectAssetId, t.status)]);

/**
 * Generic operational reserve for source types that are not well represented by a fuel warehouse.
 * Examples: hydro reservoir usable water/energy, waste feedstock buffer, biomass collection reserve,
 * LNG terminal usable reserve, battery/other stored-energy reserve supplied by the operator.
 * Values are never summed across incompatible units unless energyEquivalentMwh is explicitly supplied.
 */
export const energyGenerationResourceReserves = pgTable('energy_generation_resource_reserves', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectAssetId: uuid('project_asset_id').notNull().references(() => energyAssets.id, { onDelete: 'cascade' }),
  resourceType: text('resource_type').notNull(),
  resourceName: text('resource_name').notNull(),
  measuredAt: timestamp('measured_at', { withTimezone: true }).notNull(),
  quantity: numeric('quantity', { precision: 20, scale: 4 }).notNull(),
  usableQuantity: numeric('usable_quantity', { precision: 20, scale: 4 }),
  unit: text('unit').notNull(),
  dailyInboundAvg: numeric('daily_inbound_avg', { precision: 20, scale: 4 }),
  dailyConsumptionAvg: numeric('daily_consumption_avg', { precision: 20, scale: 4 }),
  runwayDays: numeric('runway_days', { precision: 10, scale: 2 }),
  energyEquivalentMwh: numeric('energy_equivalent_mwh', { precision: 20, scale: 3 }),
  maxSustainableCapacityMw: numeric('max_sustainable_capacity_mw', { precision: 14, scale: 3 }),
  sustainableCapacityPct: numeric('sustainable_capacity_pct', { precision: 7, scale: 3 }),
  status: text('status').notNull().default('NORMAL'),
  calculationMethod: text('calculation_method'),
  calculationVersion: text('calculation_version'),
  sourceType: text('source_type').notNull().default('OPERATOR_REPORTED'),
  sourceRef: text('source_ref'),
  notes: text('notes'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [
  index('energy_generation_resource_reserve_project_time_idx').on(t.projectAssetId, t.measuredAt),
  index('energy_generation_resource_reserve_type_time_idx').on(t.resourceType, t.measuredAt),
]);

export const energyGenerationPlans = pgTable('energy_generation_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectAssetId: uuid('project_asset_id').notNull().references(() => energyAssets.id, { onDelete: 'cascade' }),
  planLevel: text('plan_level').notNull(),
  planCode: text('plan_code'),
  planName: text('plan_name').notNull(),
  plannedCapacityMw: numeric('planned_capacity_mw', { precision: 14, scale: 3 }),
  expectedOperationYear: numeric('expected_operation_year', { precision: 4, scale: 0 }),
  status: text('status').notNull().default('PROPOSED'),
  meetingMinutesRef: text('meeting_minutes_ref'),
  decisionRef: text('decision_ref'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [index('energy_generation_plans_level_status_idx').on(t.planLevel, t.status)]);

export const energyGenerationPlanningDocuments = pgTable('energy_generation_planning_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectAssetId: uuid('project_asset_id').references(() => energyAssets.id, { onDelete: 'cascade' }),
  documentType: text('document_type').notNull(),
  documentNo: text('document_no'),
  title: text('title').notNull(),
  issuingAuthority: text('issuing_authority'),
  issuedAt: timestamp('issued_at', { withTimezone: true }),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }),
  planLevel: text('plan_level'),
  status: text('status').notNull().default('ACTIVE'),
  fileRef: text('file_ref'),
  notes: text('notes'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('energy_generation_planning_docs_project_idx').on(t.projectAssetId, t.documentType), index('energy_generation_planning_docs_level_idx').on(t.planLevel, t.status)]);

export const energyGenerationPlanDocuments = pgTable('energy_generation_plan_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  planId: uuid('plan_id').notNull().references(() => energyGenerationPlans.id, { onDelete: 'cascade' }),
  documentId: uuid('document_id').notNull().references(() => energyGenerationPlanningDocuments.id, { onDelete: 'cascade' }),
  relationType: text('relation_type').notNull().default('BASIS'),
  sequenceNo: integer('sequence_no'),
}, (t) => [uniqueIndex('energy_generation_plan_document_uq').on(t.planId, t.documentId, t.relationType)]);
