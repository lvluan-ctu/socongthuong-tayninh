import 'dotenv/config';
import pg from 'pg';

const baseUrl = (process.env.MANAGEMENT_TEST_BASE_URL || 'http://localhost:3113').replace(/\/$/, '');
const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const results = [];
const cleanup = [];
const createdIds = new Map();
const baselineByMission = new Map();
const canUseLocalDatabaseCleanup = /localhost|127\.0\.0\.1/.test(baseUrl) && Boolean(process.env.DATABASE_URL);

async function request(path, { method = 'GET', body, expected = [200] } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!expected.includes(response.status)) {
    throw new Error(`${method} ${path}: expected ${expected.join('/')} but received ${response.status}: ${text.slice(0, 500)}`);
  }
  return { status: response.status, data };
}

async function check(label, work) {
  try {
    const detail = await work();
    results.push({ label, status: 'PASS', detail: detail || 'OK' });
  } catch (error) {
    results.push({ label, status: 'FAIL', detail: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

function first(items, predicate = () => true) {
  const item = (items || []).find(predicate);
  if (!item) throw new Error('Không tìm thấy dữ liệu nền phù hợp để kiểm thử.');
  return item;
}

async function missionState(taskId) {
  if (taskId === 1) {
    const response = await request('/api/grid/task1/dashboard');
    return {
      count: Number(response.data.overview?.totalSubstations ?? 0),
      markerIds: new Set((response.data.substations ?? []).map((item) => item.id)),
    };
  }
  const response = await request(`/api/energy/tasks/${taskId}/summary`);
  const kpiIndex = taskId === 5 ? 3 : 0;
  return {
    count: Number(response.data.kpis?.[kpiIndex]?.value ?? 0),
    markerIds: new Set((response.data.markers ?? []).map((item) => item.id)),
  };
}

async function assertMissionMapped(taskId, entityId) {
  const baseline = baselineByMission.get(taskId);
  if (baseline == null) throw new Error(`Thiếu baseline Nhiệm vụ ${taskId}.`);
  const state = await missionState(taskId);
  if (state.count !== baseline + 1) {
    throw new Error(`KPI chưa đồng bộ: dự kiến ${baseline + 1}, thực tế ${state.count}.`);
  }
  if (!state.markerIds.has(entityId)) throw new Error('Bản ghi mới chưa xuất hiện trong dữ liệu GIS dashboard.');
  if (taskId !== 5) {
    const consistency = await request(`/api/management/mission-data?mission=${taskId}&view=consistency`);
    if (Number(consistency.data.tableCount) !== state.count) throw new Error('Số bản ghi catalog và KPI không khớp.');
    if (Number(consistency.data.gisMissingCount) !== 0) throw new Error('Bản ghi mới làm phát sinh dữ liệu thiếu tọa độ GIS.');
  }
  createdIds.set(taskId, entityId);
  return `KPI ${baseline} → ${state.count}; GIS contains ${entityId}`;
}

async function hardCleanupQaRecords() {
  if (!canUseLocalDatabaseCleanup) return 'Skipped: API không trỏ localhost hoặc thiếu DATABASE_URL.';
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const assetIds = [1, 2, 3, 7].map((taskId) => createdIds.get(taskId)).filter(Boolean);
    const incidentId = createdIds.get(5);
    const sourceId = createdIds.get(6);
    if (incidentId) await client.query(`DELETE FROM energy_grid_incidents WHERE id=$1::uuid AND code LIKE 'QA-INC-%'`, [incidentId]);
    if (sourceId) await client.query(`DELETE FROM energy_emission_sources WHERE id=$1::uuid AND code LIKE 'QA-CO2-%'`, [sourceId]);
    if (assetIds.length) await client.query(`DELETE FROM energy_assets WHERE id=ANY($1::uuid[]) AND code LIKE 'QA-%'`, [assetIds]);
    await client.query(`DELETE FROM energy_sites WHERE code=ANY($1::text[])`, [[
      `QA-SITE-TBA-${stamp}`,
      `QA-GEN-SITE-${stamp}`,
      `CONSUMER-SITE:QA-CONS-${stamp}`,
      `QA-EV-SITE-${stamp}`,
    ]]);
    await client.query(`DELETE FROM energy_parties WHERE code=ANY($1::text[])`, [[
      `QA-INV-${stamp}`,
      `QA-OP-${stamp}`,
      `QA-CONS-${stamp}`,
    ]]);
    if (process.env.MANAGEMENT_TEST_PURGE_ARCHIVED_QA === 'true') {
      await client.query(`DELETE FROM energy_grid_incidents
        WHERE code ~ '^QA-INC-[0-9]{14}$' AND metadata->>'archived'='true'`);
      await client.query(`DELETE FROM energy_emission_sources
        WHERE code ~ '^QA-CO2(-BAD)?-[0-9]{14}$' AND status='INACTIVE'`);
      await client.query(`DELETE FROM energy_assets
        WHERE code ~ '^QA-(TBA|GEN|RT|EV)-[0-9]{14}$'
        AND status IN ('ARCHIVED','DECOMMISSIONED','DELETED')`);
      await client.query(`DELETE FROM energy_sites
        WHERE code ~ '^(QA-(SITE-TBA|GEN-SITE|EV-SITE)-[0-9]{14}|CONSUMER-SITE:QA-CONS-[0-9]{14})$'`);
      await client.query(`DELETE FROM energy_parties
        WHERE code ~ '^QA-(INV|OP|CONS)-[0-9]{14}$'`);
    }
    await client.query('COMMIT');
    return process.env.MANAGEMENT_TEST_PURGE_ARCHIVED_QA === 'true' ? 'Current run + archived QA fixtures purged' : 'Current QA records purged';
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

try {
  const [areaResponse, partyResponse, gridResponse, customerResponse, siteResponse, energyTypeResponse] = await Promise.all([
    request('/api/core/admin-areas'),
    request('/api/core/parties'),
    request('/api/grid/assets/options?types=SUBSTATION,FEEDER,POWER_LINE'),
    request('/api/solar/customers?limit=200'),
    request('/api/core/sites?options=true'),
    request('/api/carbon/energy-types'),
  ]);
  const area = first(areaResponse.data.items, (item) => item.level === 'COMMUNE');
  const party = first(partyResponse.data.items, (item) => item.status === 'ACTIVE');
  const gridAsset = first(gridResponse.data.items, (item) => item.status === 'ACTIVE' && item.assetType === 'SUBSTATION');
  const customer = first(customerResponse.data.items, (item) => item.status === 'ACTIVE' && item.latitude != null && item.longitude != null);
  const carbonSite = first(siteResponse.data.items, (item) => item.status === 'ACTIVE' && item.partyId && item.latitude != null && item.longitude != null);
  const energyType = first(energyTypeResponse.data.items, (item) => item.status === 'ACTIVE');
  const baselineStates = await Promise.all([1, 2, 3, 4, 5, 6, 7].map((taskId) => missionState(taskId)));
  baselineStates.forEach((state, index) => baselineByMission.set(index + 1, state.count));

  await check('NV1 rejects invalid substation', async () => {
    const response = await request('/api/grid/substations', { method: 'POST', body: {}, expected: [400] });
    if (!response.data.issues?.length) throw new Error('API không trả danh sách trường sai.');
    return `${response.data.issues.length} validation issues`;
  });
  await check('NV1 create/read/update/archive substation', async () => {
    const code = `QA-TBA-${stamp}`;
    const created = await request('/api/grid/substations', { method: 'POST', body: {
      code, name: `Trạm QA ${stamp}`, status: 'ACTIVE', voltageLevelKv: 110, substationType: 'GIS',
      designedCapacityMva: 63, installedCapacityMva: 63, currentLoadMva: 31.5,
      operator: 'Đội vận hành QA', commissionedAt: '2026-01-01', siteCode: `QA-SITE-TBA-${stamp}`,
      address: 'Phường Long An, tỉnh Tây Ninh', adminAreaCode: area.code, latitude: 10.535, longitude: 106.405,
    }, expected: [201] });
    const id = created.data.data.id;
    createdIds.set(1, id);
    cleanup.push(() => request(`/api/grid/substations/${id}`, { method: 'DELETE' }));
    const detail = await request(`/api/grid/substations/${id}`);
    if (detail.data.code !== code || detail.data.adminAreaCode !== area.code) throw new Error('Đọc lại không khớp mã/địa bàn.');
    const updated = await request(`/api/grid/substations/${id}`, { method: 'PATCH', body: {
      code, name: `Trạm QA cập nhật ${stamp}`, status: 'MAINTENANCE', voltageLevelKv: 110, substationType: 'GIS',
      designedCapacityMva: 63, installedCapacityMva: 63, currentLoadMva: 40,
      operator: 'Đội vận hành QA 2', commissionedAt: '2026-01-01', siteCode: `QA-SITE-TBA-${stamp}`,
      address: 'Phường Long An, tỉnh Tây Ninh', adminAreaCode: area.code, latitude: 10.535, longitude: 106.405,
    } });
    if (updated.data.name !== `Trạm QA cập nhật ${stamp}`) throw new Error('PATCH không lưu tên mới.');
    return assertMissionMapped(1, id);
  });

  await check('NV2 rejects incomplete operating project', async () => {
    const response = await request('/api/generation/projects', { method: 'POST', body: {
      code: `QA-GEN-BAD-${stamp}`, name: 'Dự án QA thiếu dữ liệu', sourceType: 'SOLAR', designedCapacityMw: 10,
      operationStatus: 'OPERATING', investorCode: `QA-INV-BAD-${stamp}`, investorName: 'Nhà đầu tư QA',
      siteCode: `QA-GEN-SITE-BAD-${stamp}`, siteName: 'Site QA', address: 'Tây Ninh', adminAreaCode: area.code,
      latitude: 10.54, longitude: 106.41,
    }, expected: [400] });
    if (!response.data.issues?.some((issue) => issue.path?.[0] === 'commissionedAt')) throw new Error('Thiếu cảnh báo ngày vận hành.');
    return 'commissionedAt/actualCapacity validated';
  });
  await check('NV2 create/read/update/archive generation project', async () => {
    const code = `QA-GEN-${stamp}`;
    const created = await request('/api/generation/projects', { method: 'POST', body: {
      code, name: `Dự án nguồn QA ${stamp}`, sourceType: 'SOLAR', designedCapacityMw: 20, actualCapacityMw: 18,
      operationStatus: 'OPERATING', commissionedAt: '2026-01-10', investorCode: `QA-INV-${stamp}`,
      investorName: 'Công ty đầu tư QA', operatorCode: `QA-OP-${stamp}`, operatorName: 'Đơn vị vận hành QA',
      siteCode: `QA-GEN-SITE-${stamp}`, siteName: 'Site nguồn QA', address: 'Phường Long An, tỉnh Tây Ninh',
      adminAreaCode: area.code, latitude: 10.54, longitude: 106.41, gridConnectionAssetId: gridAsset.id,
      technology: 'Mono PERC', unitCount: 4, notes: 'Bản ghi kiểm thử CRUD',
    }, expected: [201] });
    const id = created.data.asset.id;
    createdIds.set(2, id);
    cleanup.push(() => request(`/api/generation/projects/${id}`, { method: 'DELETE' }));
    const detail = await request(`/api/generation/projects/${id}`);
    if (detail.data.code !== code || detail.data.latitude == null) throw new Error('Project 360 thiếu mã/tọa độ.');
    const updated = await request(`/api/generation/projects/${id}`, { method: 'PATCH', body: { name: `Dự án nguồn QA cập nhật ${stamp}`, operationStatus: 'OPERATING', designedCapacityMw: 20, actualCapacityMw: 19, commissionedAt: '2026-01-10', latitude: 10.541, longitude: 106.411 } });
    if (updated.data.name !== `Dự án nguồn QA cập nhật ${stamp}`) throw new Error('PATCH không lưu tên mới.');
    return assertMissionMapped(2, id);
  });

  await check('NV3 rejects active rooftop without commissioning date', async () => {
    const response = await request('/api/solar/systems', { method: 'POST', body: {
      code: `QA-RT-BAD-${stamp}`, name: 'Rooftop QA thiếu ngày', customerAccountId: customer.id,
      installedCapacityKwp: 8, operationStatus: 'ACTIVE', installationType: 'ROOFTOP', source: 'MANUAL',
    }, expected: [400] });
    if (!response.data.issues?.some((issue) => issue.path?.[0] === 'commissionedAt')) throw new Error('Thiếu cảnh báo ngày vận hành.');
    return 'commissionedAt validated';
  });
  await check('NV3 create/read/update/archive rooftop system', async () => {
    const code = `QA-RT-${stamp}`;
    const created = await request('/api/solar/systems', { method: 'POST', body: {
      code, name: `Rooftop QA ${stamp}`, customerAccountId: customer.id, buildingAssetId: null, roofSurfaceId: null,
      installedCapacityKwp: 12, inverterCapacityKw: 10, batteryCapacityKwh: 5, gridConnectionAssetId: gridAsset.id,
      commissionedAt: '2026-01-05', operationStatus: 'ACTIVE', ownershipModel: 'SELF_OWNED', installationType: 'ROOFTOP',
      installerPartyId: null, evRegistrationNo: `EVN-QA-${stamp}`, evnAcceptanceAt: '2026-01-05', meteringScheme: 'BIDIRECTIONAL',
      exportLimitKw: 8, annualYieldKwh: 18000, selfConsumptionPct: 65, source: 'MANUAL', sourceId: null,
      sourceRef: null, lastVerifiedAt: '2026-08-20', confidence: 95,
    }, expected: [201] });
    const id = created.data.asset.id;
    createdIds.set(3, id);
    cleanup.push(() => request(`/api/solar/systems/${id}`, { method: 'DELETE' }));
    const detail = await request(`/api/solar/systems/${id}`);
    if (detail.data.system?.assetCode !== code && detail.data.assetCode !== code) throw new Error('Không đọc lại được hệ rooftop.');
    await request(`/api/solar/systems/${id}`, { method: 'PATCH', body: { name: `Rooftop QA cập nhật ${stamp}`, installedCapacityKwp: 13 } });
    return assertMissionMapped(3, id);
  });

  await check('NV4 rejects standalone consumer without location', async () => {
    const response = await request('/api/efficiency/consumers', { method: 'POST', body: {
      partyCode: `QA-CONS-BAD-${stamp}`, partyName: 'Đơn vị QA thiếu địa chỉ', consumerGroup: 'ENTERPRISE',
      importanceLevel: 'NORMAL', sector: 'Sản xuất', reportingRequired: 'YES',
      classificationSourceDocumentNo: 'QA-DECISION-01',
    }, expected: [400] });
    if (!response.data.issues?.some((issue) => issue.path?.[0] === 'address')) throw new Error('Thiếu cảnh báo địa chỉ.');
    return 'address/adminAreaCode validated';
  });
  await check('NV4 create/read/update/archive consumer', async () => {
    const created = await request('/api/efficiency/consumers', { method: 'POST', body: {
      customerAccountId: null, partyCode: `QA-CONS-${stamp}`, partyName: `Đơn vị năng lượng QA ${stamp}`,
      address: 'Phường Long An, tỉnh Tây Ninh', adminAreaCode: area.code, consumerGroup: 'ENTERPRISE',
      latitude: 10.537, longitude: 106.407,
      importanceLevel: 'KEY', classification: 'KEY', classificationValidFrom: '2026-08-01T00:00:00+07:00',
      classificationSourceDocumentNo: `QA-QD-${stamp}`, classificationSourceDocumentRef: null,
      classificationReason: 'Kiểm thử CRUD', classificationIssuedBy: 'Sở Công Thương', sector: 'Sản xuất',
      industryZoneCode: 'KCN-QA', reportingRequired: 'YES',
    }, expected: [201] });
    const id = created.data.id;
    createdIds.set(4, id);
    cleanup.push(() => request(`/api/efficiency/consumers/${id}`, { method: 'DELETE' }));
    const detail = await request(`/api/efficiency/consumers/${id}`);
    if (!detail.data.consumer || detail.data.consumer.history.length < 1) throw new Error('Thiếu hồ sơ/lịch sử phân loại.');
    await request(`/api/efficiency/consumers/${id}`, { method: 'PATCH', body: { sector: 'Sản xuất công nghiệp', address: 'Phường Long An, tỉnh Tây Ninh', adminAreaCode: area.code } });
    return assertMissionMapped(4, id);
  });

  await check('NV5 rejects resolved incident without recovery time', async () => {
    const response = await request('/api/safety/incidents', { method: 'POST', body: {
      code: `QA-INC-BAD-${stamp}`, incidentType: 'MẤT ĐIỆN', severity: 'HIGH', startedAt: '2026-08-20T08:00:00+07:00', status: 'RESOLVED',
    }, expected: [400] });
    if (!response.data.issues?.some((issue) => issue.path?.[0] === 'resolvedAt')) throw new Error('Thiếu cảnh báo thời điểm khôi phục.');
    return 'resolvedAt validated';
  });
  await check('NV5 create/read/update/archive incident with asset/location context', async () => {
    const code = `QA-INC-${stamp}`;
    const created = await request('/api/safety/incidents', { method: 'POST', body: {
      code, assetId: gridAsset.id, incidentType: 'MẤT ĐIỆN', severity: 'HIGH', startedAt: '2026-08-20T08:00:00+07:00',
      resolvedAt: null, status: 'INVESTIGATING', affectedCustomers: 125, affectedLoadMw: 2.5,
      cause: 'Kiểm thử sự cố vận hành', notes: 'Bản ghi QA',
    }, expected: [201] });
    const id = created.data.id;
    createdIds.set(5, id);
    cleanup.push(() => request(`/api/safety/incidents/${id}`, { method: 'DELETE' }));
    const detail = await request(`/api/safety/incidents/${id}`);
    if (detail.data.item.code !== code) throw new Error('Không đọc lại được sự cố.');
    const updated = await request(`/api/safety/incidents/${id}`, { method: 'PATCH', body: { status: 'RESOLVED', resolvedAt: '2026-08-20T09:30:00+07:00', cause: 'Đã xác định nguyên nhân QA' } });
    if (updated.data.item.status !== 'RESOLVED') throw new Error('PATCH trạng thái sự cố thất bại.');
    return assertMissionMapped(5, id);
  });

  await check('NV6 rejects incomplete carbon source', async () => {
    const response = await request('/api/carbon/sources', { method: 'POST', body: { code: `QA-CO2-BAD-${stamp}`, name: 'Nguồn thiếu liên kết', sourceType: 'COMBUSTION', scope: 'SCOPE_1', status: 'ACTIVE', classification: 'INTERNAL' }, expected: [400] });
    if (!response.data.issues?.length) throw new Error('API không trả validation issues.');
    return `${response.data.issues.length} validation issues`;
  });
  await check('NV6 create/read/update/archive carbon source', async () => {
    const code = `QA-CO2-${stamp}`;
    const created = await request('/api/carbon/sources', { method: 'POST', body: {
      partyId: carbonSite.partyId, siteId: carbonSite.id, code, name: `Nguồn phát thải QA ${stamp}`,
      sourceType: 'COMBUSTION', energyTypeCode: energyType.code, fuelTypeCode: energyType.code,
      processType: 'BOILER', equipmentRef: `BOILER-${stamp}`, meterRef: `METER-${stamp}`,
      sourceCategory: 'STATIONARY_COMBUSTION', scope: 'SCOPE_1', sector: 'Công nghiệp', status: 'ACTIVE', classification: 'INTERNAL',
    }, expected: [201] });
    const id = created.data.id;
    createdIds.set(6, id);
    cleanup.push(() => request(`/api/carbon/sources/${id}`, { method: 'DELETE' }));
    const detail = await request(`/api/carbon/sources/${id}`);
    if (detail.data.item?.code !== code && detail.data.code !== code) throw new Error('Không đọc lại được nguồn phát thải.');
    await request(`/api/carbon/sources/${id}`, { method: 'PATCH', body: { name: `Nguồn phát thải QA cập nhật ${stamp}`, sector: 'Công nghiệp chế biến' } });
    return assertMissionMapped(6, id);
  });

  await check('NV7 rejects charging station without GIS coordinates', async () => {
    const response = await request('/api/ev/stations', { method: 'POST', body: {
      code: `QA-EV-BAD-${stamp}`, name: 'Trạm QA thiếu GIS', operatorPartyId: party.id,
      siteCode: `QA-EV-SITE-BAD-${stamp}`, siteName: 'Site QA', address: 'Tây Ninh', adminAreaCode: area.code,
      totalPowerKw: 120, connectorCount: 2, connectorTypes: ['CCS2'], connectorPowerKw: 60, operationStatus: 'ACTIVE',
    }, expected: [400] });
    if (!response.data.issues?.some((issue) => issue.path?.[0] === 'latitude')) throw new Error('Thiếu cảnh báo latitude.');
    return 'latitude/longitude validated';
  });
  await check('NV7 create/read/update/snapshot/archive charging station', async () => {
    const code = `QA-EV-${stamp}`;
    const created = await request('/api/ev/stations', { method: 'POST', body: {
      code, name: `Trạm sạc QA ${stamp}`, operatorPartyId: party.id, siteCode: `QA-EV-SITE-${stamp}`,
      siteName: 'Site trạm sạc QA', address: 'Phường Long An, tỉnh Tây Ninh', adminAreaCode: area.code,
      latitude: 10.536, longitude: 106.406, totalPowerKw: 120, connectorCount: 2,
      connectorTypes: ['CCS2', 'TYPE2'], connectorPowerKw: 60, gridAssetId: gridAsset.id, operationStatus: 'ACTIVE',
    }, expected: [201] });
    const id = created.data.asset.id;
    createdIds.set(7, id);
    cleanup.push(() => request(`/api/ev/stations/${id}`, { method: 'DELETE' }));
    const detail = await request(`/api/ev/stations/${id}`);
    if (detail.data.station.code !== code || detail.data.connectors.length !== 2) throw new Error('Station 360 không khớp mã/connector.');
    await request(`/api/ev/stations/${id}`, { method: 'PATCH', body: { name: `Trạm sạc QA cập nhật ${stamp}`, installedPowerKw: 120, connectionCapacityKw: 150, actualPeakPowerKw: 80, operationStatus: 'ACTIVE' } });
    await request('/api/ev/stations/snapshots', { method: 'POST', body: { stationAssetId: id, measuredAt: '2026-08-20T10:00:00+07:00', availableCount: 2, occupiedCount: 2, faultedCount: 0, utilizationPct: 50, energyDeliveredKwh: 50, peakPowerKw: 80, source: 'QA_TEST' }, expected: [400] });
    await request('/api/ev/stations/snapshots', { method: 'POST', body: { stationAssetId: id, measuredAt: '2026-08-20T10:00:00+07:00', availableCount: 1, occupiedCount: 1, faultedCount: 0, utilizationPct: 50, energyDeliveredKwh: 50, peakPowerKw: 80, source: 'QA_TEST' }, expected: [201] });
    const list = await request('/api/ev/stations?options=true');
    const listed = list.data.items.find((item) => item.assetId === id);
    if (!listed || listed.latitude == null || listed.longitude == null) throw new Error('Danh sách trạm không hiển thị tọa độ đã nhập.');
    return assertMissionMapped(7, id);
  });
} finally {
  for (const dispose of cleanup.reverse()) {
    try { await dispose(); } catch (error) { results.push({ label: 'Cleanup', status: 'WARN', detail: error instanceof Error ? error.message : String(error) }); }
  }
  for (const taskId of baselineByMission.keys()) {
    try {
      const state = await missionState(taskId);
      const expected = baselineByMission.get(taskId);
      const createdId = createdIds.get(taskId);
      if (state.count !== expected) throw new Error(`KPI sau cleanup là ${state.count}, dự kiến ${expected}.`);
      if (createdId && state.markerIds.has(createdId)) throw new Error('Bản ghi đã archive/xóa vẫn còn trên GIS dashboard.');
      results.push({ label: `NV${taskId} cleanup restores statistics/GIS`, status: 'PASS', detail: `KPI=${state.count}; marker removed` });
    } catch (error) {
      results.push({ label: `NV${taskId} cleanup restores statistics/GIS`, status: 'FAIL', detail: error instanceof Error ? error.message : String(error) });
    }
  }
  try {
    results.push({ label: 'Hard cleanup QA fixtures', status: 'PASS', detail: await hardCleanupQaRecords() });
  } catch (error) {
    results.push({ label: 'Hard cleanup QA fixtures', status: 'FAIL', detail: error instanceof Error ? error.message : String(error) });
  }
  console.table(results);
}

if (results.some((item) => item.status === 'FAIL')) process.exitCode = 1;
