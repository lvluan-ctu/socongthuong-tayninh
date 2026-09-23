import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyParties } from '@/db/schema';
import { partyPatchSchema } from '@/lib/core-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ partyId: string }> };
function invalidId(value: string) { return !z.string().uuid().safeParse(value).success; }
function num(value: unknown) { return value == null ? 0 : Number(value); }

export async function GET(_request: Request, context: Context) {
  try {
    const { partyId } = await context.params;
    if (invalidId(partyId)) return NextResponse.json({ message: 'Mã Party không hợp lệ.' }, { status: 400 });
    const [party] = await db.select().from(energyParties).where(eq(energyParties.id, partyId)).limit(1);
    if (!party) return NextResponse.json({ message: 'Không tìm thấy Party.' }, { status: 404 });
    const result = await db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM energy_sites site WHERE site.party_id = ${partyId}) AS "siteCount",
        (SELECT COUNT(*)::int FROM energy_customer_accounts account WHERE account.party_id = ${partyId}) AS "customerAccountCount",
        (SELECT COALESCE(SUM(consumption.energy_kwh), 0)::double precision
         FROM energy_customer_consumption_monthly consumption
         JOIN energy_customer_accounts account ON account.id = consumption.account_id
         WHERE account.party_id = ${partyId}) AS "consumptionKwh",
        (SELECT COUNT(*)::int
         FROM energy_rooftop_systems system
         LEFT JOIN energy_customer_accounts account ON account.id = system.customer_account_id
         JOIN energy_assets asset ON asset.id = system.asset_id
         WHERE account.party_id = ${partyId} OR asset.owner_party_id = ${partyId}) AS "rooftopSystemCount",
        (SELECT COALESCE(SUM(system.installed_capacity_kwp), 0)::double precision
         FROM energy_rooftop_systems system
         LEFT JOIN energy_customer_accounts account ON account.id = system.customer_account_id
         JOIN energy_assets asset ON asset.id = system.asset_id
         WHERE account.party_id = ${partyId} OR asset.owner_party_id = ${partyId}) AS "rooftopInstalledKwp",
        (SELECT COUNT(*)::int FROM energy_consumers consumer WHERE consumer.party_id = ${partyId}) AS "consumerCount",
        (SELECT COALESCE(SUM(CASE WHEN activity.metric_code IN ('ENERGY_KWH', 'CONSUMPTION_KWH', 'ENERGY_CONSUMPTION') THEN activity.value ELSE 0 END), 0)::double precision
         FROM energy_consumer_activity_metrics activity
         JOIN energy_consumers consumer ON consumer.id = activity.consumer_id
         WHERE consumer.party_id = ${partyId}) AS "efficiencyEnergyKwh",
        (SELECT COUNT(*)::int FROM energy_emission_sources source WHERE source.party_id = ${partyId}) AS "carbonSourceCount",
        (SELECT COUNT(*)::int FROM energy_emission_activities activity JOIN energy_emission_sources source ON source.id = activity.source_id WHERE source.party_id = ${partyId}) AS "carbonActivityCount",
        (SELECT COALESCE(SUM(activity.co2e_kg), 0)::double precision FROM energy_emission_activities activity JOIN energy_emission_sources source ON source.id = activity.source_id WHERE source.party_id = ${partyId} AND activity.status IN ('VERIFIED','APPROVED')) AS "verifiedCo2eKg",
        (SELECT COUNT(*)::int FROM energy_reduction_plans plan WHERE plan.party_id = ${partyId}) AS "reductionPlanCount",
        (SELECT COUNT(*)::int FROM energy_carbon_projects project WHERE project.party_id = ${partyId}) AS "carbonProjectCount",
        (SELECT COUNT(*)::int FROM energy_ev_station_applications application WHERE application.applicant_party_id = ${partyId}) AS "evApplicationCount",
        (SELECT COALESCE(SUM(application.requested_power_kw), 0)::double precision FROM energy_ev_station_applications application WHERE application.applicant_party_id = ${partyId}) AS "evRequestedPowerKw",
        (SELECT COALESCE(SUM(CASE WHEN application.status IN ('APPROVED','CONVERTED') THEN COALESCE(application.approved_power_kw, 0) ELSE 0 END), 0)::double precision FROM energy_ev_station_applications application WHERE application.applicant_party_id = ${partyId}) AS "evApprovedPowerKw",
        (SELECT COUNT(*)::int FROM energy_ev_stations station WHERE station.operator_party_id = ${partyId}) AS "evStationCount",
        (SELECT COALESCE(SUM(COALESCE(station.installed_power_kw, station.total_power_kw)), 0)::double precision FROM energy_ev_stations station WHERE station.operator_party_id = ${partyId} AND station.operation_status <> 'DECOMMISSIONED') AS "evInstalledPowerKw"
    `);
    const metrics = result.rows[0] as Record<string, unknown>;
    return NextResponse.json({ party, metrics: Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, num(value)])), method: { source: 'Shared Party/Site domain tables', links: ['customer accounts → consumption', 'rooftop systems', 'efficiency consumers', 'carbon sources/activities', 'EV applications/stations'], identity: 'energy_parties is the single business identity; no duplicate customer master' } });
  } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải Party 360.' }, { status: 500 }); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { partyId } = await context.params;
    if (invalidId(partyId)) return NextResponse.json({ message: 'Mã Party không hợp lệ.' }, { status: 400 });
    const [current] = await db.select().from(energyParties).where(eq(energyParties.id, partyId)).limit(1);
    if (!current) return NextResponse.json({ message: 'Không tìm thấy Party.' }, { status: 404 });
    const payload = partyPatchSchema.parse(await request.json());
    if (payload.code && payload.code !== current.code) {
      const [duplicate] = await db.select({ id: energyParties.id }).from(energyParties).where(eq(energyParties.code, payload.code)).limit(1);
      if (duplicate) return NextResponse.json({ message: `Mã Party ${payload.code} đã tồn tại.` }, { status: 409 });
    }
    const [updated] = await db.update(energyParties).set({
      ...(payload.partyType === undefined ? {} : { partyType: payload.partyType }),
      ...(payload.code === undefined ? {} : { code: payload.code }),
      ...(payload.name === undefined ? {} : { name: payload.name }),
      ...(payload.taxCode === undefined ? {} : { taxCode: payload.taxCode }),
      ...(payload.phone === undefined ? {} : { phone: payload.phone }),
      ...(payload.email === undefined ? {} : { email: payload.email }),
      ...(payload.address === undefined ? {} : { address: payload.address }),
      ...(payload.adminAreaCode === undefined ? {} : { adminAreaCode: payload.adminAreaCode }),
      ...(payload.status === undefined ? {} : { status: payload.status }),
      ...(payload.classification === undefined ? {} : { classification: payload.classification }),
      ...(payload.metadata === undefined ? {} : { metadata: payload.metadata }),
      updatedAt: new Date(),
    }).where(eq(energyParties.id, partyId)).returning();
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin Party không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật Party.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { partyId } = await context.params;
    if (invalidId(partyId)) return NextResponse.json({ message: 'Mã Party không hợp lệ.' }, { status: 400 });
    const [updated] = await db.update(energyParties).set({ status: 'ARCHIVED', updatedAt: new Date() }).where(eq(energyParties.id, partyId)).returning({ id: energyParties.id, code: energyParties.code, status: energyParties.status });
    if (!updated) return NextResponse.json({ message: 'Không tìm thấy Party.' }, { status: 404 });
    return NextResponse.json({ ...updated, message: 'Party đã chuyển sang ARCHIVED để bảo toàn liên kết và lịch sử.' });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu trữ Party.' }, { status: 400 });
  }
}
