import "dotenv/config";

const baseUrl = (process.env.MANAGEMENT_TEST_BASE_URL || 'http://localhost:3113').replace(/\/$/, '');
const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const checks = [];
const cleanup = [];

async function request(path, { method = 'GET', body, expected = [200] } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!expected.includes(response.status)) throw new Error(`${method} ${path}: HTTP ${response.status}: ${text.slice(0, 400)}`);
  return { status: response.status, data };
}

async function check(label, fn) {
  try {
    const detail = await fn();
    checks.push({ label, status: 'PASS', detail: detail ?? 'OK' });
  } catch (error) {
    checks.push({ label, status: 'FAIL', detail: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

function keysOf(payload, row) {
  return Object.fromEntries(payload.primaryKeys.map((key) => [key, row[key]]));
}

async function crud({ mission, table, create, patch, verifyField, verifyValue }) {
  const endpoint = `/api/management/mission-data?mission=${mission}&resource=${table}`;
  const metadata = await request(`${endpoint}&pageSize=5`);
  const created = await request(endpoint, { method: 'POST', body: { values: create }, expected: [201] });
  const keys = keysOf(metadata.data, created.data.item);
  cleanup.push(async () => request(endpoint, { method: 'DELETE', body: { keys }, expected: [200, 404] }));
  const updated = await request(endpoint, { method: 'PATCH', body: { keys, values: patch } });
  if (String(updated.data.item?.[verifyField]) !== String(verifyValue)) throw new Error(`PATCH không lưu ${verifyField}.`);
  const deleted = await request(endpoint, { method: 'DELETE', body: { keys } });
  cleanup.pop();
  if (!deleted.data.deleted) throw new Error('DELETE không xác nhận bản ghi đã xóa.');
  return JSON.stringify(keys);
}

try {
  const resources = [];
  for (let mission = 1; mission <= 7; mission += 1) {
    const response = await request(`/api/management/mission-data?mission=${mission}&scope=domain`);
    resources.push(...response.data.resources.map((item) => ({ mission, ...item })));
  }
  for (const scope of ['shared', 'ai']) {
    const response = await request(`/api/management/mission-data?mission=1&scope=${scope}`);
    resources.push(...response.data.resources.map((item) => ({ mission: 1, ...item })));
  }

  await check('Catalog covers every physical schema table', async () => {
    const unique = new Set(resources.map((item) => item.table));
    if (unique.size !== 129) throw new Error(`Catalog có ${unique.size}/129 bảng.`);
    const missing = resources.filter((item) => !item.available);
    if (missing.length) throw new Error(`Chưa migration: ${missing.map((item) => item.table).join(', ')}`);
    return '129/129 tables available';
  });

  await check('Every catalog table is readable and has a primary key', async () => {
    const failures = [];
    for (let index = 0; index < resources.length; index += 12) {
      const batch = resources.slice(index, index + 12);
      const outcomes = await Promise.allSettled(batch.map(async (item) => {
        const response = await request(`/api/management/mission-data?mission=${item.mission}&resource=${item.table}&pageSize=5`);
        if (!response.data.columns?.length) throw new Error('không có metadata cột');
        if (!response.data.primaryKeys?.length) throw new Error('không có khóa chính');
      }));
      outcomes.forEach((outcome, offset) => {
        if (outcome.status === 'rejected') failures.push(`${batch[offset].table}: ${outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)}`);
      });
    }
    if (failures.length) throw new Error(failures.join('; '));
    return `${resources.length} tables read successfully`;
  });

  const [projectResponse, stationResponse] = await Promise.all([
    request('/api/generation/projects?page=1&pageSize=1'),
    request('/api/ev/stations?options=true'),
  ]);
  const projectAssetId = projectResponse.data.items?.[0]?.assetId;
  const stationAssetId = stationResponse.data.items?.find((item) => item.operationStatus !== 'DECOMMISSIONED')?.assetId;
  if (!projectAssetId || !stationAssetId) throw new Error('Thiếu project/station nền để test bảng con.');

  await check('NV1 catalog CRUD + PostGIS geometry', () => crud({
    mission: 1,
    table: 'energy_load_zones',
    create: { code: `QA-ZONE-${stamp}`, name: `Vùng tải QA ${stamp}`, zone_type: 'QA_TEST', current_load_mw: 1.2, peak_load_mw: 2.4, geometry: 'POLYGON((106.400 10.530,106.410 10.530,106.410 10.540,106.400 10.540,106.400 10.530))', metadata: { qa: true } },
    patch: { name: `Vùng tải QA cập nhật ${stamp}` },
    verifyField: 'name', verifyValue: `Vùng tải QA cập nhật ${stamp}`,
  }));
  await check('NV2 catalog CRUD planning table', () => crud({
    mission: 2,
    table: 'energy_generation_plans',
    create: { project_asset_id: projectAssetId, plan_level: 'QA', plan_code: `QA-PLAN-${stamp}`, plan_name: `Kế hoạch QA ${stamp}`, planned_capacity_mw: 1, expected_operation_year: 2030, status: 'PROPOSED', metadata: { qa: true } },
    patch: { plan_name: `Kế hoạch QA cập nhật ${stamp}` },
    verifyField: 'plan_name', verifyValue: `Kế hoạch QA cập nhật ${stamp}`,
  }));
  await check('NV3 catalog CRUD solar resource + geometry', () => crud({
    mission: 3,
    table: 'energy_solar_resource_zones',
    create: { code: `QA-SOLAR-ZONE-${stamp}`, name: `Vùng bức xạ QA ${stamp}`, boundary: 'POLYGON((106.420 10.530,106.430 10.530,106.430 10.540,106.420 10.540,106.420 10.530))', annual_ghi_kwh_m2: 1500, source: 'QA_TEST', source_version: '1.0', quality: 'ESTIMATED', status: 'ACTIVE', metadata: { qa: true } },
    patch: { name: `Vùng bức xạ QA cập nhật ${stamp}` },
    verifyField: 'name', verifyValue: `Vùng bức xạ QA cập nhật ${stamp}`,
  }));
  await check('NV4 catalog CRUD benchmark', () => crud({
    mission: 4,
    table: 'energy_efficiency_benchmarks',
    create: { sector: 'QA_TEST', consumer_group: 'OTHER', metric_code: `QA_METRIC_${stamp}`, benchmark_value: 100, unit: 'kWh', method_version: 'qa-1', valid_from: '2026-01-01T00:00:00+07:00', status: 'DRAFT', metadata: { qa: true } },
    patch: { benchmark_value: 110 },
    verifyField: 'benchmark_value', verifyValue: '110.000000',
  }));
  await check('NV5 catalog CRUD legal document', () => crud({
    mission: 5,
    table: 'energy_safety_legal_documents',
    create: { code: `QA-LAW-${stamp}`, document_no: `QA/${stamp}`, title: `Văn bản QA ${stamp}`, document_type: 'QA_TEST', issuing_authority: 'QA', status: 'ACTIVE' },
    patch: { title: `Văn bản QA cập nhật ${stamp}` },
    verifyField: 'title', verifyValue: `Văn bản QA cập nhật ${stamp}`,
  }));
  await check('NV6 catalog CRUD unit definition', () => crud({
    mission: 6,
    table: 'energy_unit_definitions',
    create: { code: `QA_UNIT_${stamp}`, name: `Đơn vị QA ${stamp}`, dimension: 'QA_TEST', canonical_unit: `QA_UNIT_${stamp}`, multiplier_to_canonical: 1, status: 'ACTIVE' },
    patch: { name: `Đơn vị QA cập nhật ${stamp}` },
    verifyField: 'name', verifyValue: `Đơn vị QA cập nhật ${stamp}`,
  }));
  await check('NV7 catalog CRUD connector', () => crud({
    mission: 7,
    table: 'energy_ev_connectors',
    create: { station_asset_id: stationAssetId, code: `QA-CONNECTOR-${stamp}`, connector_type: 'CCS2', charging_mode: 'DC', power_kw: 22, status: 'AVAILABLE' },
    patch: { status: 'MAINTENANCE' },
    verifyField: 'status', verifyValue: 'MAINTENANCE',
  }));

  await check('Mutation guards preserve workflow/audit tables', async () => {
    await request('/api/management/mission-data?mission=1&resource=energy_substations', { method: 'POST', body: { values: {} }, expected: [405] });
    await request('/api/management/mission-data?mission=1&resource=energy_grid_operating_snapshots', { method: 'PATCH', body: { keys: {}, values: {} }, expected: [405] });
    await request('/api/management/mission-data?mission=1&resource=energy_ai_job_results', { method: 'POST', body: { values: {} }, expected: [405] });
    await request('/api/management/mission-data?mission=1&resource=energy_data_quality_issues', { method: 'DELETE', body: { keys: {} }, expected: [405] });
    return 'workflow, append-only, review and read-only guards passed';
  });
} finally {
  for (const dispose of cleanup.reverse()) {
    try { await dispose(); } catch (error) { checks.push({ label: 'Cleanup', status: 'WARN', detail: error instanceof Error ? error.message : String(error) }); }
  }
  console.table(checks);
}

if (checks.some((item) => item.status === 'FAIL')) process.exitCode = 1;
