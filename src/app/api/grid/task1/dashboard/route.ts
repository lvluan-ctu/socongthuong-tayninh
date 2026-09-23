import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Row = Record<string, unknown>;

function num(value: unknown, fallback = 0) {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: unknown, fallback = '') {
  return value == null || value === '' ? fallback : String(value);
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function json(value: unknown) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value) as unknown; } catch { return null; }
}

function lineRoute(value: unknown): [number, number][] {
  const parsed = json(value) as { type?: string; coordinates?: unknown[] } | null;
  if (!parsed || parsed.type !== 'LineString' || !Array.isArray(parsed.coordinates)) return [];
  return parsed.coordinates.flatMap((coordinate) => {
    if (!Array.isArray(coordinate) || coordinate.length < 2) return [];
    return [[num(coordinate[1]), num(coordinate[0])] as [number, number]];
  });
}

function polygons(value: unknown): [number, number][][] {
  const parsed = json(value) as { type?: string; coordinates?: unknown } | null;
  if (!parsed || !Array.isArray(parsed.coordinates)) return [];
  const rings = parsed.type === 'MultiPolygon'
    ? (parsed.coordinates as unknown[][][]).flat(1)
    : parsed.coordinates as unknown[][];
  return rings.flatMap((ring) => {
    if (!Array.isArray(ring)) return [];
    const points = ring.flatMap((coordinate) => {
      if (!Array.isArray(coordinate) || coordinate.length < 2) return [];
      return [[num(coordinate[1]), num(coordinate[0])] as [number, number]];
    });
    return points.length ? [points] : [];
  });
}

function voltageLabel(value: unknown) {
  const voltage = num(value, 22);
  if (voltage >= 500) return '500kV';
  if (voltage >= 220) return '220kV';
  if (voltage >= 110) return '110kV';
  return '22kV';
}

function operationStatus(value: unknown) {
  const status = text(value).toUpperCase();
  if (status.includes('MAINTENANCE')) return 'MAINTENANCE';
  if (status.includes('STOP') || status.includes('INACTIVE') || status.includes('DECOMMISSION') || status.includes('ARCHIV') || status.includes('DELETED')) return 'STOPPED';
  if (status.includes('CONSTRUCTION')) return 'CONSTRUCTION';
  if (status.includes('PLAN')) return 'PLANNED';
  return 'OPERATING';
}

function displayStatus(value: unknown) {
  const status = text(value).toUpperCase();
  return status.includes('PLAN') ? 'Quy hoạch' : status.includes('CONSTRUCTION') ? 'Đang xây dựng' : status.includes('STOP') || status.includes('INACTIVE') || status.includes('DECOMMISSION') || status.includes('ARCHIV') || status.includes('DELETED') ? 'Ngừng vận hành' : 'Vận hành';
}

export async function GET() {
  try {
    const [subResult, lineResult, poleResult, planResult, zoneResult, incidentResult, eventResult, alertResult, renewableResult, historyResult, countsResult] = await Promise.all([
      db.execute(sql.raw(`
        SELECT a.id::text,a.code,a.name,a.status,a.commissioned_at,a.metadata,
          ST_Y(a.location::geometry) AS latitude,ST_X(a.location::geometry) AS longitude,
          s.voltage_level_kv,s.substation_type,s.designed_capacity_mva,s.installed_capacity_mva,
          s.current_load_mva,s.load_factor_pct,s.available_capacity_mva,s.overload_status,s.operator,
          COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'id',ta.id,'code',ta.code,'name',ta.name,'status',ta.status,'commissionedAt',ta.commissioned_at,
            'primaryVoltageKv',t.primary_voltage_kv,'secondaryVoltageKv',t.secondary_voltage_kv,
            'tertiaryVoltageKv',t.tertiary_voltage_kv,'ratedCapacityMva',t.rated_capacity_mva,
            'manufacturer',t.manufacturer,'model',t.model,'technicalSpecs',t.technical_specs))
            FROM energy_transformers t JOIN energy_assets ta ON ta.id=t.asset_id
            WHERE t.substation_asset_id=a.id),'[]'::jsonb) AS transformers
        FROM energy_substations s JOIN energy_assets a ON a.id=s.asset_id
        WHERE a.status NOT IN ('ARCHIVED','DECOMMISSIONED','DELETED')
        ORDER BY s.voltage_level_kv DESC,a.name
      `)),
      db.execute(sql.raw(`
        SELECT a.id::text,a.code,a.name,a.status,a.commissioned_at,a.metadata,
          l.voltage_level_kv,l.line_type,l.conductor_type,l.circuit_count,l.length_m,
          l.rated_capacity_mw,l.current_load_mw,l.technical_specs,ST_AsGeoJSON(l.geometry) AS geometry,
          parent.code AS parent_code,parent.name AS parent_name,
          COALESCE((SELECT count(*) FROM energy_grid_incidents i WHERE i.asset_id=a.id),0) AS incident_count
        FROM energy_power_lines l JOIN energy_assets a ON a.id=l.asset_id
        LEFT JOIN energy_assets parent ON parent.id=l.parent_line_asset_id
        WHERE a.status NOT IN ('ARCHIVED','DECOMMISSIONED','DELETED')
        UNION ALL
        SELECT a.id::text,a.code,a.name,a.status,a.commissioned_at,a.metadata,
          f.voltage_level_kv,'FEEDER' AS line_type,NULL AS conductor_type,1 AS circuit_count,
          NULL AS length_m,f.rated_capacity_mw,f.current_load_mw,'{}'::jsonb AS technical_specs,
          NULL AS geometry,parent.code AS parent_code,parent.name AS parent_name,
          COALESCE((SELECT count(*) FROM energy_grid_incidents i WHERE i.asset_id=a.id),0) AS incident_count
        FROM energy_feeders f JOIN energy_assets a ON a.id=f.asset_id
        LEFT JOIN energy_assets parent ON parent.id=f.substation_asset_id
        WHERE a.status NOT IN ('ARCHIVED','DECOMMISSIONED','DELETED')
        ORDER BY voltage_level_kv DESC,name
      `)),
      db.execute(sql.raw(`
        SELECT p.id::text,p.line_asset_id::text,p.position_code,p.sequence_no,p.circuit_count,
          p.grounding_resistance_ohm,p.metadata,ST_Y(p.location::geometry) AS latitude,
          ST_X(p.location::geometry) AS longitude,la.code AS line_code,la.name AS line_name,
          ps.structure_type,ps.material,ps.height_m,ps.foundation_type,ps.technical_specs,
          pa.id::text AS asset_id,pa.code,pa.name,pa.status,pa.commissioned_at
        FROM energy_line_positions p JOIN energy_assets la ON la.id=p.line_asset_id
        LEFT JOIN energy_power_structures ps ON ps.position_id=p.id
        LEFT JOIN energy_assets pa ON pa.id=p.asset_id
        WHERE p.location IS NOT NULL AND la.status NOT IN ('ARCHIVED','DECOMMISSIONED','DELETED') ORDER BY la.code,p.sequence_no
      `)),
      db.execute(sql.raw(`
        SELECT id::text,code,name,asset_type,status,metadata,
          ST_Y(location::geometry) AS latitude,ST_X(location::geometry) AS longitude
        FROM energy_assets WHERE asset_type IN ('PLANNED_SUBSTATION','PLANNED_POWER_LINE')
        AND status NOT IN ('ARCHIVED','DECOMMISSIONED','DELETED')
        ORDER BY COALESCE((metadata->>'targetYear')::int,9999),name
      `)),
      db.execute(sql.raw(`SELECT id::text,code,name,zone_type,current_load_mw,peak_load_mw,metadata,ST_AsGeoJSON(geometry) AS geometry FROM energy_load_zones WHERE metadata->>'mission'='1' ORDER BY zone_type,code`)),
      db.execute(sql.raw(`
        SELECT i.id::text,i.code,i.asset_id::text,i.incident_type,i.severity,i.started_at,i.resolved_at,
          i.status,i.affected_customers,i.affected_load_mw,i.cause,i.metadata,a.code AS asset_code,a.name AS asset_name
        FROM energy_grid_incidents i LEFT JOIN energy_assets a ON a.id=i.asset_id
        WHERE i.metadata->>'mission'='1' AND COALESCE(i.metadata->>'archived','false') <> 'true' ORDER BY i.started_at DESC
      `)),
      db.execute(sql.raw(`
        SELECT e.id::text,e.code,e.asset_id::text,e.occurred_at,e.event_type,e.reason,
          e.affected_description,e.actor,e.status,e.source,e.metadata
        FROM energy_grid_operation_events e ORDER BY e.occurred_at DESC LIMIT 100
      `)),
      db.execute(sql.raw(`
        SELECT w.id::text,w.code,w.asset_id::text,w.generated_at,w.severity,w.current_value,
          w.forecast_value,w.trend,w.risk_level,w.reason,w.recommendation,w.status,w.source,
          a.name AS asset_name,a.asset_type
        FROM energy_grid_alerts w LEFT JOIN energy_assets a ON a.id=w.asset_id
        WHERE w.status='OPEN' ORDER BY CASE w.severity WHEN 'DANGER' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END,w.current_value DESC
      `)),
      db.execute(sql.raw(`
        SELECT p.asset_id::text,a.code,a.name,p.source_type,p.designed_capacity_mw,p.actual_capacity_mw,
          p.operation_status,p.grid_connection_asset_id::text,ga.code AS grid_code,ga.name AS grid_name,
          investor.name AS owner,ST_Y(COALESCE(a.location,s.location)::geometry) AS latitude,
          ST_X(COALESCE(a.location,s.location)::geometry) AS longitude,
          nearest.id::text AS substation_id,nearest.code AS substation_code
        FROM energy_generation_projects p JOIN energy_assets a ON a.id=p.asset_id
        LEFT JOIN energy_sites s ON s.id=COALESCE(p.site_id,a.site_id)
        LEFT JOIN energy_assets ga ON ga.id=p.grid_connection_asset_id
        LEFT JOIN energy_parties investor ON investor.id=p.investor_party_id
        LEFT JOIN LATERAL (
          SELECT sa.id,sa.code FROM energy_substations ss JOIN energy_assets sa ON sa.id=ss.asset_id
          WHERE sa.location IS NOT NULL ORDER BY sa.location <-> COALESCE(a.location,s.location) LIMIT 1
        ) nearest ON COALESCE(a.location,s.location) IS NOT NULL
        WHERE p.grid_connection_asset_id IS NOT NULL
        AND a.status NOT IN ('ARCHIVED','DECOMMISSIONED','DELETED') AND p.operation_status <> 'DECOMMISSIONED'
        ORDER BY p.designed_capacity_mw DESC LIMIT 100
      `)),
      db.execute(sql.raw(`
        SELECT s.id::text,s.asset_id::text,a.asset_type,s.measured_at,s.current_load_mva,s.current_load_mw,
          s.rated_capacity_mva,s.rated_capacity_mw,s.load_factor_pct,s.source,s.metadata
        FROM energy_grid_operating_snapshots s JOIN energy_assets a ON a.id=s.asset_id
        WHERE a.status NOT IN ('ARCHIVED','DECOMMISSIONED','DELETED')
        ORDER BY s.measured_at,s.asset_id
      `)),
      db.execute(sql.raw(`
        SELECT (SELECT count(*) FROM energy_measurements) AS measurements,
          (SELECT count(*) FROM energy_line_positions WHERE location IS NOT NULL) AS gis_positions,
          (SELECT count(*) FROM energy_assets WHERE asset_type IN ('PLANNED_SUBSTATION','PLANNED_POWER_LINE') AND status NOT IN ('ARCHIVED','DECOMMISSIONED','DELETED')) AS planning_assets,
          (SELECT count(*) FROM energy_grid_operating_snapshots s JOIN energy_assets a ON a.id=s.asset_id WHERE a.status NOT IN ('ARCHIVED','DECOMMISSIONED','DELETED')) AS operating_snapshots,
          (SELECT max(measured_at) FROM energy_measurements) AS latest_measurement_at
      `)),
    ]);

    const eventsByAsset = new Map<string, Row[]>();
    for (const row of eventResult.rows as Row[]) {
      const key = text(row.asset_id);
      const items = eventsByAsset.get(key) ?? [];
      items.push(row);
      eventsByAsset.set(key, items);
    }
    const incidentsByAsset = new Map<string, Row[]>();
    for (const row of incidentResult.rows as Row[]) {
      const key = text(row.asset_id);
      const items = incidentsByAsset.get(key) ?? [];
      items.push(row);
      incidentsByAsset.set(key, items);
    }
    const operationLogs = (eventResult.rows as Row[]).map((row) => ({
      id: text(row.id), time: new Date(text(row.occurred_at)).toLocaleString('vi-VN'),
      type: text(row.event_type).toLowerCase() === 'energize' ? 'energize'
        : text(row.event_type).toLowerCase() === 'deenergize' ? 'deenergize'
          : text(row.event_type).toLowerCase() === 'maintenance' ? 'maintenance'
            : text(row.event_type).toLowerCase() === 'incident' ? 'incident' : 'switch',
      reason: text(row.reason), affected: text(row.affected_description), actor: text(row.actor),
    }));

    const substations = (subResult.rows as Row[]).map((row) => {
      const metadata = object(row.metadata);
      const design = num(row.installed_capacity_mva, num(row.designed_capacity_mva));
      const transformers = (Array.isArray(row.transformers) ? row.transformers : []) as Row[];
      return {
        id: text(row.id), code: text(row.code), name: text(row.name), type: text(row.substation_type),
        voltageLevel: voltageLabel(row.voltage_level_kv), district: text(metadata.district, 'Tân An'),
        address: text(metadata.address, text(row.name)), latitude: row.latitude == null ? undefined : num(row.latitude),
        longitude: row.longitude == null ? undefined : num(row.longitude), operator: text(row.operator, 'EVN'),
        designCapacity: design, operatingCapacity: design, availableCapacity: num(row.available_capacity_mva),
        loadFactor: num(row.load_factor_pct), transformerCount: transformers.length,
        transformerType: transformers.map((item) => text(item.name)).join(', '),
        yearCommissioned: row.commissioned_at ? new Date(text(row.commissioned_at)).getFullYear() : undefined,
        status: displayStatus(row.status), supplyArea: `Vùng cấp điện ${text(metadata.district, 'Tân An')}`,
        workflowStatus: 'APPROVED', supplyRadiusKm: num(metadata.supplyRadiusKm, 6),
        switchingState: operationStatus(row.status),
        transformers: transformers.map((item, index) => ({
          no: text(item.code, `MBA-${index + 1}`), type: text(item.name, 'Máy biến áp lực'),
          capacityMva: num(item.ratedCapacityMva),
          voltageRatio: [item.primaryVoltageKv, item.secondaryVoltageKv, item.tertiaryVoltageKv].filter(Boolean).map((value) => `${num(value)}kV`).join('/'),
          yearCommissioned: item.commissionedAt ? new Date(text(item.commissionedAt)).getFullYear() : undefined,
          loadFactorPct: num(row.load_factor_pct), status: displayStatus(item.status),
        })),
        connectionPoints: [],
        operationLogs: (eventsByAsset.get(text(row.id)) ?? []).map((item) => operationLogs.find((log) => log.id === text(item.id))).filter(Boolean),
      };
    });

    const incidentRecords = (incidentResult.rows as Row[]).map((row) => {
      const metadata = object(row.metadata);
      const severity = text(row.severity).toUpperCase();
      return {
        id: text(row.id), code: text(row.code), time: new Date(text(row.started_at)).toLocaleString('vi-VN'),
        source: text(metadata.source, 'CSDL vận hành NV1'), type: text(row.incident_type),
        severity: severity === 'SEVERE' ? 'severe' : severity === 'HIGH' ? 'high' : severity === 'MEDIUM' ? 'medium' : 'resolved',
        location: text(metadata.location, text(row.asset_name)), lineCode: text(row.asset_code), substationCode: '',
        affectedArea: text(metadata.location, 'Khu vực lưới điện'), customersAffected: num(row.affected_customers),
        lostLoadMw: num(row.affected_load_mw), outageDuration: row.resolved_at ? `${Math.max(1, Math.round((new Date(text(row.resolved_at)).getTime() - new Date(text(row.started_at)).getTime()) / 60000))} phút` : 'Đang xử lý',
        criticalInfra: '—', handler: text(metadata.handler, 'Đội quản lý vận hành'),
        responseTime: `${num(metadata.responseMinutes)} phút`, progress: text(row.status),
        recoveryTime: row.resolved_at ? new Date(text(row.resolved_at)).toLocaleString('vi-VN') : '—',
        latitude: metadata.latitude == null ? undefined : num(metadata.latitude), longitude: metadata.longitude == null ? undefined : num(metadata.longitude),
      };
    });

    const lines = (lineResult.rows as Row[]).map((row) => {
      const specs = object(row.technical_specs);
      const route = lineRoute(row.geometry);
      const loadFactor = num(row.rated_capacity_mw) > 0 ? num(row.current_load_mw) / num(row.rated_capacity_mw) * 100 : 0;
      const lineIncidents = incidentRecords.filter((incident) => incident.lineCode === text(row.code));
      return {
        id: text(row.id), code: text(row.code), name: text(row.name), voltageLevel: voltageLabel(row.voltage_level_kv),
        operator: text(specs.operator, 'EVN'), fromPoint: text(specs.fromPoint, route.length ? 'Điểm đầu tuyến GIS' : 'Chưa xác định'),
        toPoint: text(specs.toPoint, route.length ? 'Điểm cuối tuyến GIS' : 'Chưa xác định'), lengthKm: num(row.length_m) / 1000,
        districts: [text(object(row.metadata).district, 'Tân An')], status: displayStatus(row.status),
        capacityMw: num(row.rated_capacity_mw), actualLoadMw: num(row.current_load_mw), lossPct: num(specs.lossPct),
        incidents: num(row.incident_count), route, workflowStatus: 'APPROVED', corridorStatus: 'Đã dựng từ tim tuyến PostGIS',
        switchingState: operationStatus(row.status),
        technical: {
          conductorType: text(row.conductor_type, text(specs.conductorType, 'Chưa khai báo')),
          crossSectionMm2: text(specs.crossSectionMm2, 'Theo hồ sơ EVN'), strands: text(specs.strands, 'ACSR'),
          insulation: text(specs.insulation, 'Theo cấp điện áp'), groundingMethod: text(specs.groundingMethod, 'Theo hồ sơ tuyến'),
          lineCount: num(row.circuit_count, 1), avgHeightM: voltageLabel(row.voltage_level_kv) === '110kV' ? 32 : 14,
        },
        operation: { currentLoadA: 0, voltageDeviationPct: 0, hotSpot: lineIncidents[0]?.location ?? '—',
          lossPct: num(specs.lossPct), overloadCount: loadFactor >= 100 ? 1 : 0,
          faultRatePerYear: lineIncidents.length },
        operationLogs: (eventsByAsset.get(text(row.id)) ?? []).map((item) => operationLogs.find((log) => log.id === text(item.id))).filter(Boolean),
        incidentRecords: lineIncidents,
      };
    });

    const poles = (poleResult.rows as Row[]).map((row) => ({
      id: text(row.asset_id, text(row.id)), code: text(row.code, text(row.position_code)), number: text(row.position_code),
      lineCode: text(row.line_code), type: text(row.structure_type) === 'TOWER' ? 'Trụ thép' : 'Trụ bê tông',
      height: num(row.height_m, voltageLabel(object(row.metadata).voltageKv) === '110kV' ? 32 : 14),
      yearBuilt: row.commissioned_at ? new Date(text(row.commissioned_at)).getFullYear() : 0,
      foundationStatus: text(row.foundation_type, 'Theo hồ sơ kiểm tra'), technicalStatus: displayStatus(row.status),
      safetyCorridor: incidentRecords.some((item) => item.location.includes(text(row.position_code))) ? 'Cần kiểm tra' : 'Đạt',
      latitude: num(row.latitude), longitude: num(row.longitude), workflowStatus: 'APPROVED', images: [],
    }));

    const planned = (planResult.rows as Row[]).map((row) => {
      const metadata = object(row.metadata);
      const type = text(row.asset_type) === 'PLANNED_SUBSTATION' ? 'substation' : 'line';
      return {
        id: text(row.id), code: text(row.code), name: text(row.name), type,
        voltageLevel: voltageLabel(metadata.voltageKv ?? metadata.voltageLevel), district: text(metadata.district, 'Tây Ninh - Long An'),
        location: text(metadata.location, 'Theo hồ sơ quy hoạch nguồn'), investor: text(metadata.investor, 'Đơn vị đề xuất'),
        progress: text(metadata.progress, text(row.status)), phase: 'drafting', year: num(metadata.targetYear, 2030),
        latitude: row.latitude == null ? undefined : num(row.latitude), longitude: row.longitude == null ? undefined : num(row.longitude),
        description: metadata.capacityMw ? `${num(metadata.capacityMw)} MW` : text(metadata.description),
      };
    });

    const supplyAreas = (zoneResult.rows as Row[]).filter((row) => text(row.zone_type) === 'SUPPLY_AREA').map((row) => ({
      id: text(row.id), name: text(row.name), substationId: text(object(row.metadata).assetId), district: text(object(row.metadata).district, 'Tân An'), polygons: polygons(row.geometry),
    }));
    const loadAreas = (zoneResult.rows as Row[]).filter((row) => text(row.zone_type) === 'LOAD_AREA').map((row) => ({
      id: text(row.id), name: text(row.name), district: text(object(row.metadata).district, 'Tân An'), peakMw: num(row.peak_load_mw), polygons: polygons(row.geometry),
    }));
    const overloadZones = (zoneResult.rows as Row[]).filter((row) => text(row.zone_type) === 'OVERLOAD_ZONE').map((row) => ({
      id: text(row.id), label: text(row.name), kind: 'line', refId: text(object(row.metadata).assetId),
      district: text(object(row.metadata).district, 'Tân An'), loadFactorPct: num(object(row.metadata).loadFactorPct),
      note: 'Vùng cảnh báo dựng từ snapshot vận hành gần nhất.', polygons: polygons(row.geometry),
    }));
    const warnings = (alertResult.rows as Row[]).map((row) => ({
      id: text(row.id), entityId: text(row.asset_id), entityType: text(row.asset_type) === 'SUBSTATION' ? 'substation' : 'line',
      label: text(row.asset_name), severity: text(row.severity) === 'DANGER' ? 'danger' : text(row.severity) === 'WARNING' ? 'warning' : 'info',
      current: num(row.current_value), forecast: num(row.forecast_value), trend: text(row.trend).toLowerCase(),
      risk: text(row.risk_level) === 'HIGH' ? 'Cao' : text(row.risk_level) === 'MEDIUM' ? 'Trung bình' : 'Thấp',
      reason: text(row.reason), recommendation: text(row.recommendation),
    }));
    const renewables = (renewableResult.rows as Row[]).map((row) => ({
      id: text(row.asset_id), code: text(row.code), owner: text(row.owner, 'Chưa khai báo'), type: text(row.source_type),
      capacityKw: num(row.designed_capacity_mw) * 1000, installedKw: num(row.actual_capacity_mw, num(row.designed_capacity_mw)) * 1000,
      gridCapacityKw: num(row.designed_capacity_mw) * 1000, hostingCapacityKw: num(row.designed_capacity_mw) * 1000,
      overload: 'Không', hostSubstationId: text(row.substation_id), hostLineCode: text(row.grid_code),
      connectionPoint: text(row.grid_name), status: text(row.operation_status) === 'OPERATING' ? 'Vận hành' : text(row.operation_status),
      latitude: row.latitude == null ? undefined : num(row.latitude), longitude: row.longitude == null ? undefined : num(row.longitude),
    }));
    const loadHistory = (historyResult.rows as Row[]).map((row) => ({
      id: text(row.id), entityType: text(row.asset_type) === 'SUBSTATION' ? 'substation' : 'line', entityId: text(row.asset_id),
      timestamp: new Date(text(row.measured_at)).toLocaleDateString('vi-VN', { month: '2-digit', year: '2-digit' }),
      loadMw: num(row.current_load_mva, num(row.current_load_mw)), capacityMw: num(row.rated_capacity_mva, num(row.rated_capacity_mw)),
      loadFactorPct: num(row.load_factor_pct),
    }));

    const operatingSubs = substations.filter((item) => item.status !== 'Quy hoạch');
    const operatingLines = lines.filter((item) => item.status !== 'Quy hoạch');
    const counts = (countsResult.rows[0] ?? {}) as Row;
    const overview = {
      totalSubstations: operatingSubs.length,
      totalSubstationCapacityMva: Math.round(operatingSubs.reduce((sum, item) => sum + item.designCapacity, 0) * 10) / 10,
      totalOperatingCapacityMva: Math.round(operatingSubs.reduce((sum, item) => sum + item.operatingCapacity, 0) * 10) / 10,
      overloadedSubstations: operatingSubs.filter((item) => item.loadFactor >= 100).length,
      totalLines: operatingLines.length,
      totalLineLengthKm: Math.round(operatingLines.reduce((sum, item) => sum + item.lengthKm, 0) * 10) / 10,
      highLoadLines: operatingLines.filter((item) => item.capacityMw > 0 && item.actualLoadMw / item.capacityMw * 100 >= 90).length,
      avgLossPct: operatingLines.length ? Math.round(operatingLines.reduce((sum, item) => sum + item.lossPct, 0) / operatingLines.length * 10) / 10 : 0,
    };

    return NextResponse.json({
      substations, lines, poles, plannedPoles: [], planned, supplyAreas, loadAreas,
      incidents: incidentRecords, overloadZones, renewables, operationLogs, warnings, overview, loadHistory,
      provenance: {
        source: 'hệ thống GIS + EVN telemetry', measurements: num(counts.measurements),
        gisPositions: num(counts.gis_positions), planningAssets: num(counts.planning_assets),
        operatingSnapshots: num(counts.operating_snapshots), latestMeasurementAt: counts.latest_measurement_at,
        notes: [
          'Hình học tuyến và vị trí cột lấy từ dữ liệu nguồn NV1.',
          'Snapshot có telemetryBacked=true được tổng hợp từ phép đo EVN; phần thiếu được seed theo kịch bản kỹ thuật và gắn nguồn NV1_DASHBOARD_SEED_V1.',
          'Sự cố seed có authoritative=false để phân biệt với biên bản sự cố chính thức.',
        ],
      },
    });
  } catch (error) {
    console.error('Mission 1 dashboard query failed', error);
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải dashboard Nhiệm vụ 1.' }, { status: 500 });
  }
}
