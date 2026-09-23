import { NextResponse } from "next/server";
import type { QueryResultRow } from "pg";
import {
  findMissionDataResource,
  getMissionDataResources,
  MISSION_DASHBOARD_DATA_TABLES,
  MISSION_PRIMARY_DATA_TABLE,
  type MissionDataAccess,
  type MissionDataScope,
} from "@/lib/mission-data-catalog";
import { energyPool } from "@/lib/db";

export const dynamic = "force-dynamic";

type DatabaseColumn = {
  name: string;
  dataType: string;
  udtName: string;
  nullable: boolean;
  defaultValue: string | null;
  generated: boolean;
  primaryKey: boolean;
  referencedTable: string | null;
  referencedColumn: string | null;
};

type ColumnRow = QueryResultRow & {
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: "YES" | "NO";
  column_default: string | null;
  is_generated: string;
};

const MUTATION_PERMISSIONS: Record<MissionDataAccess, { create: boolean; update: boolean; delete: boolean }> = {
  full: { create: true, update: true, delete: true },
  append: { create: true, update: false, delete: false },
  review: { create: false, update: true, delete: false },
  readonly: { create: false, update: false, delete: false },
  workflow: { create: false, update: false, delete: false },
};

const CONSISTENCY_SQL: Record<number, { label: string; sql: string; sample: string }> = {
  1: {
    label: "Trạm biến áp đang khai thác",
    sql: `SELECT count(*)::bigint AS total,
      count(*) FILTER (WHERE COALESCE(a.location, s.location) IS NOT NULL)::bigint AS located
      FROM energy_substations x JOIN energy_assets a ON a.id=x.asset_id
      LEFT JOIN energy_sites s ON s.id=a.site_id
      WHERE a.status NOT IN ('ARCHIVED','DECOMMISSIONED','DELETED')`,
    sample: `SELECT a.id::text AS id,a.code,a.name FROM energy_substations x
      JOIN energy_assets a ON a.id=x.asset_id LEFT JOIN energy_sites s ON s.id=a.site_id
      WHERE a.status NOT IN ('ARCHIVED','DECOMMISSIONED','DELETED')
      AND COALESCE(a.location,s.location) IS NULL ORDER BY a.name LIMIT 8`,
  },
  2: {
    label: "Dự án nguồn điện đang quản lý",
    sql: `SELECT count(*)::bigint AS total,
      count(*) FILTER (WHERE COALESCE(a.location, s.location) IS NOT NULL)::bigint AS located
      FROM energy_generation_projects x JOIN energy_assets a ON a.id=x.asset_id
      LEFT JOIN energy_sites s ON s.id=COALESCE(x.site_id,a.site_id)
      WHERE a.status NOT IN ('ARCHIVED','DECOMMISSIONED','DELETED')
      AND x.operation_status <> 'DECOMMISSIONED'`,
    sample: `SELECT a.id::text AS id,a.code,a.name FROM energy_generation_projects x
      JOIN energy_assets a ON a.id=x.asset_id LEFT JOIN energy_sites s ON s.id=COALESCE(x.site_id,a.site_id)
      WHERE a.status NOT IN ('ARCHIVED','DECOMMISSIONED','DELETED')
      AND x.operation_status <> 'DECOMMISSIONED' AND COALESCE(a.location,s.location) IS NULL
      ORDER BY a.name LIMIT 8`,
  },
  3: {
    label: "Hệ điện mặt trời mái nhà đang quản lý",
    sql: `SELECT count(*)::bigint AS total,
      count(*) FILTER (WHERE COALESCE(a.location, s.location) IS NOT NULL)::bigint AS located
      FROM energy_rooftop_systems x JOIN energy_assets a ON a.id=x.asset_id
      LEFT JOIN energy_sites s ON s.id=a.site_id
      WHERE a.status NOT IN ('ARCHIVED','DECOMMISSIONED','DELETED')
      AND x.operation_status NOT IN ('DECOMMISSIONED','DELETED')`,
    sample: `SELECT a.id::text AS id,a.code,a.name FROM energy_rooftop_systems x
      JOIN energy_assets a ON a.id=x.asset_id LEFT JOIN energy_sites s ON s.id=a.site_id
      WHERE a.status NOT IN ('ARCHIVED','DECOMMISSIONED','DELETED')
      AND x.operation_status NOT IN ('DECOMMISSIONED','DELETED') AND COALESCE(a.location,s.location) IS NULL
      ORDER BY a.name LIMIT 8`,
  },
  4: {
    label: "Cơ sở sử dụng năng lượng đang quản lý",
    sql: `SELECT count(*)::bigint AS total,
      count(*) FILTER (WHERE s.location IS NOT NULL)::bigint AS located
      FROM energy_consumers x LEFT JOIN energy_sites s ON s.id=x.site_id
      WHERE x.status <> 'ARCHIVED'`,
    sample: `SELECT x.id::text AS id,p.code,p.name FROM energy_consumers x
      JOIN energy_parties p ON p.id=x.party_id LEFT JOIN energy_sites s ON s.id=x.site_id
      WHERE x.status <> 'ARCHIVED' AND s.location IS NULL ORDER BY p.name LIMIT 8`,
  },
  5: {
    label: "Vi phạm hành lang đã ghi nhận",
    sql: `SELECT count(*)::bigint AS total,
      count(*) FILTER (WHERE location IS NOT NULL)::bigint AS located
      FROM energy_corridor_violations WHERE status <> 'ARCHIVED'`,
    sample: `SELECT id::text AS id,code,violation_type AS name FROM energy_corridor_violations
      WHERE status <> 'ARCHIVED' AND location IS NULL ORDER BY detected_at DESC LIMIT 8`,
  },
  6: {
    label: "Nguồn phát thải đang hoạt động",
    sql: `SELECT count(*)::bigint AS total,
      count(*) FILTER (WHERE s.location IS NOT NULL)::bigint AS located
      FROM energy_emission_sources x LEFT JOIN energy_sites s ON s.id=x.site_id
      WHERE x.status <> 'INACTIVE'`,
    sample: `SELECT x.id::text AS id,x.code,x.name FROM energy_emission_sources x
      LEFT JOIN energy_sites s ON s.id=x.site_id WHERE x.status <> 'INACTIVE'
      AND s.location IS NULL ORDER BY x.name LIMIT 8`,
  },
  7: {
    label: "Trạm sạc đang quản lý",
    sql: `SELECT count(*)::bigint AS total,
      count(*) FILTER (WHERE COALESCE(a.location, s.location) IS NOT NULL)::bigint AS located
      FROM energy_ev_stations x JOIN energy_assets a ON a.id=x.asset_id
      LEFT JOIN energy_sites s ON s.id=COALESCE(x.site_id,a.site_id)
      WHERE a.status NOT IN ('ARCHIVED','DECOMMISSIONED','DELETED')
      AND x.operation_status <> 'DECOMMISSIONED'`,
    sample: `SELECT a.id::text AS id,a.code,a.name FROM energy_ev_stations x
      JOIN energy_assets a ON a.id=x.asset_id LEFT JOIN energy_sites s ON s.id=COALESCE(x.site_id,a.site_id)
      WHERE a.status NOT IN ('ARCHIVED','DECOMMISSIONED','DELETED')
      AND x.operation_status <> 'DECOMMISSIONED' AND COALESCE(a.location,s.location) IS NULL
      ORDER BY a.name LIMIT 8`,
  },
  8: {
    label: "Cơ sở dầu khí đang quản lý",
    sql: `SELECT count(*)::bigint AS total,
      count(*) FILTER (WHERE a.location IS NOT NULL)::bigint AS located
      FROM energy_oil_facilities x JOIN energy_assets a ON a.id=x.asset_id
      WHERE a.status NOT IN ('ARCHIVED','DECOMMISSIONED','DELETED')`,
    sample: `SELECT a.id::text AS id,a.code,a.name FROM energy_oil_facilities x
      JOIN energy_assets a ON a.id=x.asset_id
      WHERE a.status NOT IN ('ARCHIVED','DECOMMISSIONED','DELETED')
      AND a.location IS NULL ORDER BY a.name LIMIT 8`,
  },
};

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function parseMission(params: URLSearchParams) {
  const mission = Number(params.get("mission"));
  return Number.isInteger(mission) && mission >= 1 && mission <= 8 ? mission : null;
}

function parseScope(value: string | null): MissionDataScope | undefined {
  return value === "domain" || value === "shared" || value === "ai" ? value : undefined;
}

function columnKind(column: Pick<DatabaseColumn, "dataType" | "udtName">) {
  if (column.udtName === "geometry" || column.udtName === "geography") return "geometry";
  if (column.dataType === "json" || column.dataType === "jsonb") return "json";
  if (column.dataType === "boolean") return "boolean";
  if (column.dataType.includes("timestamp") || column.dataType === "date") return "datetime";
  if (["smallint", "integer", "bigint", "numeric", "decimal", "real", "double precision"].includes(column.dataType)) return "number";
  if (column.dataType === "ARRAY") return "array";
  if (column.dataType === "uuid") return "uuid";
  return "text";
}

async function loadColumns(table: string): Promise<DatabaseColumn[]> {
  const [columnResult, keyResult, foreignKeyResult] = await Promise.all([
    energyPool.query<ColumnRow>(`SELECT column_name,data_type,udt_name,is_nullable,column_default,is_generated
      FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [table]),
    energyPool.query<{ column_name: string }>(`SELECT kcu.column_name FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=tc.constraint_name
        AND kcu.table_schema=tc.table_schema AND kcu.table_name=tc.table_name
      WHERE tc.table_schema='public' AND tc.table_name=$1 AND tc.constraint_type='PRIMARY KEY'
      ORDER BY kcu.ordinal_position`, [table]),
    energyPool.query<{ column_name: string; foreign_table_name: string; foreign_column_name: string }>(`SELECT
      kcu.column_name,ccu.table_name AS foreign_table_name,ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=tc.constraint_name
        AND kcu.table_schema=tc.table_schema AND kcu.table_name=tc.table_name
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name
        AND ccu.table_schema=tc.table_schema
      WHERE tc.table_schema='public' AND tc.table_name=$1 AND tc.constraint_type='FOREIGN KEY'`, [table]),
  ]);
  const keys = new Set(keyResult.rows.map((row) => row.column_name));
  const foreignKeys = new Map(foreignKeyResult.rows.map((row) => [row.column_name, row]));
  return columnResult.rows.map((row) => {
    const foreignKey = foreignKeys.get(row.column_name);
    return {
      name: row.column_name,
      dataType: row.data_type,
      udtName: row.udt_name,
      nullable: row.is_nullable === "YES",
      defaultValue: row.column_default,
      generated: row.is_generated !== "NEVER",
      primaryKey: keys.has(row.column_name),
      referencedTable: foreignKey?.foreign_table_name ?? null,
      referencedColumn: foreignKey?.foreign_column_name ?? null,
    };
  });
}

async function loadCatalog(mission: number, scope?: MissionDataScope) {
  const resources = getMissionDataResources(mission, scope);
  const tableNames = resources.map((item) => item.table);
  const existingResult = await energyPool.query<{ table_name: string }>(`SELECT table_name
    FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1::text[])`, [tableNames]);
  const existing = new Set(existingResult.rows.map((row) => row.table_name));
  const existingResources = resources.filter((item) => existing.has(item.table));
  const countResult = existingResources.length
    ? await energyPool.query<{ table_name: string; row_count: string }>(existingResources.map((item) =>
        `SELECT '${item.table}'::text AS table_name,count(*)::bigint AS row_count FROM ${quoteIdentifier(item.table)}`,
      ).join(" UNION ALL "))
    : { rows: [] };
  const counts = new Map(countResult.rows.map((row) => [row.table_name, Number(row.row_count)]));
  return resources.map((item) => ({
    ...item,
    available: existing.has(item.table),
    rowCount: counts.get(item.table) ?? 0,
    permissions: MUTATION_PERMISSIONS[item.access],
  }));
}

function selectExpression(column: DatabaseColumn) {
  const identifier = quoteIdentifier(column.name);
  if (column.udtName === "geometry") return `CASE WHEN ${identifier} IS NULL THEN NULL ELSE ST_AsGeoJSON(${identifier})::jsonb END AS ${identifier}`;
  if (column.udtName === "geography") return `CASE WHEN ${identifier} IS NULL THEN NULL ELSE ST_AsGeoJSON(${identifier}::geometry)::jsonb END AS ${identifier}`;
  return identifier;
}

async function loadRows(table: string, columns: DatabaseColumn[], params: URLSearchParams) {
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(params.get("pageSize")) || 25));
  const search = params.get("search")?.trim() ?? "";
  const filterColumn = params.get("filterColumn")?.trim() ?? "";
  const filterValue = params.get("filterValue")?.trim() ?? "";
  const searchable = columns.filter((column) => ["text", "uuid", "number"].includes(columnKind(column))).slice(0, 12);
  const queryValues: unknown[] = [];
  const conditions: string[] = [];
  if (search && searchable.length) {
    queryValues.push(`%${search}%`);
    conditions.push(`(${searchable.map((column) => `CAST(${quoteIdentifier(column.name)} AS text) ILIKE $1`).join(" OR ")})`);
  }
  const filter = columns.find((column) => column.name === filterColumn);
  if (filter && filterValue) {
    queryValues.push(`%${filterValue}%`);
    conditions.push(`CAST(${quoteIdentifier(filter.name)} AS text) ILIKE $${queryValues.length}`);
  }
  const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
  const orderColumn = columns.find((column) => column.name === "created_at")
    ?? columns.find((column) => column.name === "updated_at")
    ?? columns.find((column) => column.primaryKey)
    ?? columns[0];
  const direction = orderColumn && ["created_at", "updated_at", "measured_at", "occurred_at", "detected_at"].includes(orderColumn.name) ? "DESC" : "ASC";
  const offset = (page - 1) * pageSize;
  const countValues = queryValues.slice();
  const limitIndex = queryValues.push(pageSize);
  const offsetIndex = queryValues.push(offset);
  const tableIdentifier = quoteIdentifier(table);
  const [rowResult, countResult] = await Promise.all([
    energyPool.query(`SELECT ${columns.map(selectExpression).join(",")}
      FROM ${tableIdentifier}${where}${orderColumn ? ` ORDER BY ${quoteIdentifier(orderColumn.name)} ${direction} NULLS LAST` : ""}
      LIMIT $${limitIndex} OFFSET $${offsetIndex}`, queryValues),
    energyPool.query<{ total: string }>(`SELECT count(*)::bigint AS total FROM ${tableIdentifier}${where}`, countValues),
  ]);
  return {
    items: rowResult.rows,
    pagination: { page, pageSize, total: Number(countResult.rows[0]?.total ?? 0) },
  };
}

function prepareValue(column: DatabaseColumn, raw: unknown) {
  if (raw === "" && column.nullable) return null;
  const kind = columnKind(column);
  if (kind === "json") {
    if (typeof raw === "string") return raw.trim() ? JSON.parse(raw) : null;
    return raw;
  }
  if (kind === "boolean") {
    if (typeof raw === "boolean") return raw;
    return raw === "true" || raw === "1" || raw === 1;
  }
  if (kind === "number" && raw !== null && raw !== "") {
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`${column.name} phải là một số hợp lệ.`);
    return value;
  }
  if (kind === "array" && typeof raw === "string") {
    const parsed = raw.trim() ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) throw new Error(`${column.name} phải là một mảng JSON.`);
    return parsed;
  }
  return raw;
}

function valueSql(column: DatabaseColumn, value: unknown, parameter: number) {
  const placeholder = `$${parameter}`;
  if (value == null || (column.udtName !== "geometry" && column.udtName !== "geography")) return placeholder;
  const raw = typeof value === "string" ? value.trim() : JSON.stringify(value);
  const geometry = raw.startsWith("{")
    ? `ST_SetSRID(ST_GeomFromGeoJSON(${placeholder}),4326)`
    : raw.toUpperCase().startsWith("SRID=")
      ? `ST_GeomFromEWKT(${placeholder})`
      : `ST_SetSRID(ST_GeomFromText(${placeholder}),4326)`;
  return column.udtName === "geography" ? `${geometry}::geography` : geometry;
}

function prepareEntries(values: unknown, columns: DatabaseColumn[], mode: "create" | "update") {
  if (!values || typeof values !== "object" || Array.isArray(values)) throw new Error("Payload values không hợp lệ.");
  const source = values as Record<string, unknown>;
  return columns.flatMap((column) => {
    if (column.generated || (mode === "update" && column.primaryKey)) return [];
    if (!Object.prototype.hasOwnProperty.call(source, column.name)) return [];
    const raw = source[column.name];
    if (mode === "create" && raw === "" && column.defaultValue != null) return [];
    return [{ column, value: prepareValue(column, raw) }];
  });
}

function keyWhere(keys: unknown, columns: DatabaseColumn[], startIndex = 1) {
  if (!keys || typeof keys !== "object" || Array.isArray(keys)) throw new Error("Thiếu khóa chính của bản ghi.");
  const source = keys as Record<string, unknown>;
  const primaryKeys = columns.filter((column) => column.primaryKey);
  if (!primaryKeys.length) throw new Error("Bảng không có khóa chính; không thể cập nhật an toàn.");
  const values: unknown[] = [];
  const expressions = primaryKeys.map((column, index) => {
    if (!Object.prototype.hasOwnProperty.call(source, column.name)) throw new Error(`Thiếu khóa ${column.name}.`);
    values.push(prepareValue(column, source[column.name]));
    return `${quoteIdentifier(column.name)}=$${startIndex + index}`;
  });
  return { sql: expressions.join(" AND "), values };
}

function mutationError(error: unknown) {
  const detail = error as { code?: string; detail?: string; constraint?: string; message?: string };
  const conflict = detail.code === "23503" || detail.code === "23505";
  const invalid = detail.code?.startsWith("22") || detail.code === "23502" || detail.code === "23514";
  return NextResponse.json({
    message: conflict
      ? "Bản ghi đang trùng khóa hoặc còn được dữ liệu khác tham chiếu."
      : invalid
        ? "Giá trị chưa đúng kiểu hoặc vi phạm ràng buộc dữ liệu."
        : detail.message ?? "Không thể cập nhật bảng dữ liệu.",
    code: detail.code ?? null,
    detail: detail.detail ?? null,
    constraint: detail.constraint ?? null,
  }, { status: conflict ? 409 : 400 });
}

async function consistency(mission: number) {
  const config = CONSISTENCY_SQL[mission];
  const [countResult, sampleResult, catalog] = await Promise.all([
    energyPool.query<{ total: string; located: string }>(config.sql),
    energyPool.query(config.sample),
    loadCatalog(mission),
  ]);
  const total = Number(countResult.rows[0]?.total ?? 0);
  const located = Number(countResult.rows[0]?.located ?? 0);
  const domainResources = getMissionDataResources(mission, "domain");
  const dashboardTableOrder = MISSION_DASHBOARD_DATA_TABLES[mission] ?? [];
  const dashboardSources = dashboardTableOrder
    .map((table) => catalog.find((item) => item.table === table))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({
      table: item.table,
      label: item.label,
      scope: item.scope,
      rowCount: item.rowCount,
      available: item.available,
    }));
  return {
    mission,
    label: config.label,
    tableCount: total,
    statisticsCount: total,
    gisLocatedCount: located,
    gisMissingCount: Math.max(0, total - located),
    gisCoveragePct: total ? Math.round((located / total) * 10_000) / 100 : 100,
    dashboardMarkerLimit: mission === 1 ? null : 500,
    missingLocationSample: sampleResult.rows,
    mappedTables: domainResources.length,
    primaryTable: MISSION_PRIMARY_DATA_TABLE[mission],
    dashboardSources,
    statisticTables: dashboardSources.map((item) => item.table),
    gisTables: domainResources.filter((item) => item.impacts.includes("GIS")).map((item) => item.table),
    dashboardPath: `/energy/nhiem-vu-${mission}`,
    summaryApi: mission === 1 ? "/api/grid/task1/dashboard" : `/api/energy/tasks/${mission}/summary`,
  };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const mission = parseMission(params);
  if (!mission) return NextResponse.json({ message: "Nhiệm vụ phải nằm trong khoảng 1–8." }, { status: 400 });
  try {
    if (params.get("view") === "consistency") return NextResponse.json(await consistency(mission));
    const table = params.get("resource");
    if (!table) {
      const resources = await loadCatalog(mission, parseScope(params.get("scope")));
      return NextResponse.json({ mission, resources, total: resources.length });
    }
    const resource = findMissionDataResource(mission, table);
    if (!resource) return NextResponse.json({ message: "Bảng không thuộc phạm vi nhiệm vụ." }, { status: 404 });
    const columns = await loadColumns(table);
    if (!columns.length) return NextResponse.json({ message: "Bảng chưa được provision trong database." }, { status: 404 });
    const data = await loadRows(table, columns, params);
    return NextResponse.json({
      mission,
      resource: { ...resource, permissions: MUTATION_PERMISSIONS[resource.access] },
      columns: columns.map((column) => ({ ...column, kind: columnKind(column) })),
      primaryKeys: columns.filter((column) => column.primaryKey).map((column) => column.name),
      ...data,
    });
  } catch (error) {
    console.error("Cannot load mission data catalog", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Không thể tải danh mục dữ liệu." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const params = new URL(request.url).searchParams;
  const mission = parseMission(params);
  const table = params.get("resource") ?? "";
  const resource = mission ? findMissionDataResource(mission, table) : null;
  if (!mission || !resource) return NextResponse.json({ message: "Phạm vi bảng không hợp lệ." }, { status: 404 });
  if (!MUTATION_PERMISSIONS[resource.access].create) return NextResponse.json({ message: "Bảng này chỉ được cập nhật qua workflow hoặc chế độ duyệt." }, { status: 405 });
  try {
    const columns = await loadColumns(table);
    const body = await request.json() as { values?: unknown };
    const entries = prepareEntries(body.values, columns, "create");
    if (!entries.length) throw new Error("Chưa có trường dữ liệu để tạo.");
    const values = entries.map((entry) => entry.column.udtName === "geometry" || entry.column.udtName === "geography"
      ? (typeof entry.value === "string" ? entry.value : JSON.stringify(entry.value))
      : entry.value);
    const result = await energyPool.query(`INSERT INTO ${quoteIdentifier(table)}
      (${entries.map((entry) => quoteIdentifier(entry.column.name)).join(",")}) VALUES
      (${entries.map((entry, index) => valueSql(entry.column, entry.value, index + 1)).join(",")}) RETURNING *`, values);
    return NextResponse.json({ item: result.rows[0] }, { status: 201 });
  } catch (error) {
    return mutationError(error);
  }
}

export async function PATCH(request: Request) {
  const params = new URL(request.url).searchParams;
  const mission = parseMission(params);
  const table = params.get("resource") ?? "";
  const resource = mission ? findMissionDataResource(mission, table) : null;
  if (!mission || !resource) return NextResponse.json({ message: "Phạm vi bảng không hợp lệ." }, { status: 404 });
  if (!MUTATION_PERMISSIONS[resource.access].update) return NextResponse.json({ message: "Bảng này không cho phép sửa trực tiếp." }, { status: 405 });
  try {
    const columns = await loadColumns(table);
    const body = await request.json() as { keys?: unknown; values?: unknown };
    const entries = prepareEntries(body.values, columns, "update");
    if (!entries.length) throw new Error("Chưa có trường dữ liệu để cập nhật.");
    const preparedValues = entries.map((entry) => entry.column.udtName === "geometry" || entry.column.udtName === "geography"
      ? (typeof entry.value === "string" ? entry.value : JSON.stringify(entry.value))
      : entry.value);
    const keys = keyWhere(body.keys, columns, preparedValues.length + 1);
    const hasUpdatedAt = columns.some((column) => column.name === "updated_at") && !entries.some((entry) => entry.column.name === "updated_at");
    const sets = entries.map((entry, index) => `${quoteIdentifier(entry.column.name)}=${valueSql(entry.column, entry.value, index + 1)}`);
    if (hasUpdatedAt) sets.push(`${quoteIdentifier("updated_at")}=NOW()`);
    const result = await energyPool.query(`UPDATE ${quoteIdentifier(table)} SET ${sets.join(",")}
      WHERE ${keys.sql} RETURNING *`, [...preparedValues, ...keys.values]);
    if (!result.rows[0]) return NextResponse.json({ message: "Không tìm thấy bản ghi." }, { status: 404 });
    return NextResponse.json({ item: result.rows[0] });
  } catch (error) {
    return mutationError(error);
  }
}

export async function DELETE(request: Request) {
  const params = new URL(request.url).searchParams;
  const mission = parseMission(params);
  const table = params.get("resource") ?? "";
  const resource = mission ? findMissionDataResource(mission, table) : null;
  if (!mission || !resource) return NextResponse.json({ message: "Phạm vi bảng không hợp lệ." }, { status: 404 });
  if (!MUTATION_PERMISSIONS[resource.access].delete) return NextResponse.json({ message: "Bảng này không cho phép xóa trực tiếp." }, { status: 405 });
  try {
    const columns = await loadColumns(table);
    const body = await request.json() as { keys?: unknown };
    const keys = keyWhere(body.keys, columns);
    const result = await energyPool.query(`DELETE FROM ${quoteIdentifier(table)} WHERE ${keys.sql} RETURNING *`, keys.values);
    if (!result.rows[0]) return NextResponse.json({ message: "Không tìm thấy bản ghi." }, { status: 404 });
    return NextResponse.json({ deleted: true, item: result.rows[0] });
  } catch (error) {
    return mutationError(error);
  }
}
