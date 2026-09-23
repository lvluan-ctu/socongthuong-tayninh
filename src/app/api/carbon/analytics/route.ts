import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có dạng YYYY-MM-DD.').refine((value) => { const date = new Date(`${value}T00:00:00.000Z`); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value; }, 'Ngày lịch không hợp lệ.');
const querySchema = z.object({ from: dateOnly, to: dateOnly, statusMode: z.enum(['OFFICIAL', 'SUBMITTED', 'ALL']).default('OFFICIAL') }).refine((value) => value.to >= value.from, { path: ['to'], message: 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.' });

type Row = Record<string, unknown>;
function number(value: unknown) { return value == null ? 0 : Number(value); }
function periodFilter(from: string, to: string) { return sql`CASE WHEN ea.period ~ '^[0-9]{4}$' THEN to_date(ea.period || '-01', 'YYYY-MM') ELSE to_date(ea.period, 'YYYY-MM') END BETWEEN ${from}::date AND ${to}::date`; }
function statusFilter(mode: 'OFFICIAL' | 'SUBMITTED' | 'ALL') { return mode === 'OFFICIAL' ? sql`ea.status IN ('VERIFIED', 'APPROVED')` : mode === 'SUBMITTED' ? sql`ea.status IN ('SUBMITTED', 'VERIFIED', 'APPROVED')` : sql`ea.status IN ('DRAFT', 'SUBMITTED', 'VERIFIED', 'APPROVED')`; }
function mapBreakdown(rows: Row[]) { return rows.map((row) => ({ ...row, co2eKg: number(row.co2eKg), activities: number(row.activities), sources: number(row.sources) })); }

export async function GET(request: Request) {
  try {
    const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const range = periodFilter(query.from, query.to); const statuses = statusFilter(query.statusMode);
    const [totals, byEnergyType, byScope, bySector, byArea, measurements, completeness, reduction, ledger] = await Promise.all([
      db.execute(sql`SELECT COALESCE(SUM(ea.co2e_kg), 0)::double precision AS "co2eKg", COUNT(*)::int AS activities, COUNT(DISTINCT ea.source_id)::int AS sources, COUNT(*) FILTER (WHERE ea.status = 'VERIFIED')::int AS verified, COUNT(*) FILTER (WHERE ea.status = 'APPROVED')::int AS approved FROM energy_emission_activities ea WHERE ${range} AND ${statuses}`),
      db.execute(sql`SELECT COALESCE(et.code, 'UNCLASSIFIED') AS code, COALESCE(et.name, 'Chưa phân loại') AS name, COALESCE(SUM(ea.co2e_kg), 0)::double precision AS "co2eKg", COUNT(*)::int AS activities, COUNT(DISTINCT ea.source_id)::int AS sources FROM energy_emission_activities ea JOIN energy_emission_sources es ON es.id = ea.source_id LEFT JOIN energy_energy_types et ON et.code = es.energy_type_code WHERE ${range} AND ${statuses} GROUP BY et.code, et.name ORDER BY SUM(ea.co2e_kg) DESC NULLS LAST`),
      db.execute(sql`SELECT es.scope AS code, es.scope AS name, COALESCE(SUM(ea.co2e_kg), 0)::double precision AS "co2eKg", COUNT(*)::int AS activities, COUNT(DISTINCT ea.source_id)::int AS sources FROM energy_emission_activities ea JOIN energy_emission_sources es ON es.id = ea.source_id WHERE ${range} AND ${statuses} GROUP BY es.scope ORDER BY SUM(ea.co2e_kg) DESC`),
      db.execute(sql`SELECT COALESCE(es.sector, 'UNCLASSIFIED') AS code, COALESCE(es.sector, 'Chưa phân loại') AS name, COALESCE(SUM(ea.co2e_kg), 0)::double precision AS "co2eKg", COUNT(*)::int AS activities, COUNT(DISTINCT ea.source_id)::int AS sources FROM energy_emission_activities ea JOIN energy_emission_sources es ON es.id = ea.source_id WHERE ${range} AND ${statuses} GROUP BY es.sector ORDER BY SUM(ea.co2e_kg) DESC NULLS LAST LIMIT 50`),
      db.execute(sql`SELECT COALESCE(aa.code, site.admin_area_code, 'UNCLASSIFIED') AS code, COALESCE(aa.name, site.admin_area_code, 'Chưa phân loại') AS name, COALESCE(SUM(ea.co2e_kg), 0)::double precision AS "co2eKg", COUNT(*)::int AS activities, COUNT(DISTINCT ea.source_id)::int AS sources FROM energy_emission_activities ea JOIN energy_emission_sources es ON es.id = ea.source_id LEFT JOIN energy_sites site ON site.id = es.site_id LEFT JOIN energy_admin_areas aa ON aa.code = site.admin_area_code WHERE ${range} AND ${statuses} GROUP BY aa.code, aa.name, site.admin_area_code ORDER BY SUM(ea.co2e_kg) DESC NULLS LAST LIMIT 50`),
      db.execute(sql`SELECT COUNT(*)::int AS measurements FROM energy_emission_measurements em WHERE em.measured_at BETWEEN ${query.from}::date AND (${query.to}::date + INTERVAL '1 day')`),
      db.execute(sql`SELECT COUNT(*) FILTER (WHERE es.energy_type_code IS NULL)::int AS "missingEnergyType", COUNT(*) FILTER (WHERE es.site_id IS NULL)::int AS "missingSite", COUNT(*) FILTER (WHERE es.party_id IS NULL)::int AS "missingParty" FROM energy_emission_sources es WHERE es.status <> 'INACTIVE'`),
      db.execute(sql`SELECT COUNT(*)::int AS actions, COALESCE(SUM(ra.expected_reduction_tco2e_year), 0)::double precision AS "expectedReductionTco2eYear", COALESCE(SUM(ra.actual_reduction_tco2e_year) FILTER (WHERE ra.status = 'COMPLETED'), 0)::double precision AS "verifiedActionReductionTco2eYear" FROM energy_reduction_actions ra WHERE ra.status <> 'CANCELLED'`),
      db.execute(sql`SELECT COALESCE(SUM(ecc.balance_delta_tco2e), 0)::double precision AS "availableTco2e", COALESCE(SUM(ecc.quantity_tco2e) FILTER (WHERE ecc.transaction_type = 'RETIRE'), 0)::double precision AS "retiredTco2e", COUNT(DISTINCT ecc.credit_batch_id)::int AS batches FROM energy_carbon_credit_transactions ecc`),
    ]);
    const total = (totals.rows[0] ?? {}) as Row; const measurement = (measurements.rows[0] ?? {}) as Row; const completenessRow = (completeness.rows[0] ?? {}) as Row; const reductionRow = (reduction.rows[0] ?? {}) as Row; const ledgerRow = (ledger.rows[0] ?? {}) as Row;
    const warnings: string[] = [];
    if (number(total.activities) === 0) warnings.push(query.statusMode === 'OFFICIAL' ? 'OFFICIAL_DATA_EMPTY: chưa có Activity VERIFIED/APPROVED trong kỳ; KPI bằng 0 và không phải dữ liệu giả.' : 'ACTIVITY_DATA_EMPTY: chưa có Activity trong kỳ.');
    if (number(completenessRow.missingEnergyType) > 0) warnings.push(`ENERGY_TYPE_MISSING: ${number(completenessRow.missingEnergyType)} nguồn ACTIVE chưa gắn canonical energy type.`);
    if (number(completenessRow.missingSite) > 0) warnings.push(`SITE_MISSING: ${number(completenessRow.missingSite)} nguồn ACTIVE chưa có Site.`);
    if (number(completenessRow.missingParty) > 0) warnings.push(`PARTY_MISSING: ${number(completenessRow.missingParty)} nguồn ACTIVE chưa có đơn vị quản lý.`);
    return NextResponse.json({
      period: { from: query.from, to: query.to, statusMode: query.statusMode },
      totals: { co2eKg: number(total.co2eKg), co2eTco2e: number(total.co2eKg) / 1000, activities: number(total.activities), sources: number(total.sources), verified: number(total.verified), approved: number(total.approved), measurements: number(measurement.measurements) },
      breakdowns: { energyTypes: mapBreakdown(byEnergyType.rows as Row[]), scopes: mapBreakdown(byScope.rows as Row[]), sectors: mapBreakdown(bySector.rows as Row[]), adminAreas: mapBreakdown(byArea.rows as Row[]) },
      reduction: { actions: number(reductionRow.actions), expectedReductionTco2eYear: number(reductionRow.expectedReductionTco2eYear), verifiedActionReductionTco2eYear: number(reductionRow.verifiedActionReductionTco2eYear) },
      ledger: { availableTco2e: number(ledgerRow.availableTco2e), retiredTco2e: number(ledgerRow.retiredTco2e), batches: number(ledgerRow.batches) },
      warnings,
      method: { activityPeriod: "CASE WHEN period is YYYY then first month, otherwise YYYY-MM", officialStatuses: ['VERIFIED', 'APPROVED'], submittedStatuses: ['SUBMITTED', 'VERIFIED', 'APPROVED'], co2eNormalization: 'kgCO2e / 1000 = tCO2e', source: 'PostgreSQL aggregates from energy_emission_activities; no synthetic KPI' },
    });
  } catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ message: 'Bộ lọc Carbon analytics không hợp lệ.', issues: error.issues }, { status: 400 }); return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải Carbon analytics.' }, { status: 500 }); }
}
