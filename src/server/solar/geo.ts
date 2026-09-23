export type GeoJsonGeometry = {
  type: 'Point' | 'Polygon' | 'MultiPolygon' | 'LineString' | 'MultiLineString' | 'MultiPoint';
  coordinates: unknown;
};

export type GeoJsonFeature = {
  type: 'Feature';
  id?: string;
  geometry: GeoJsonGeometry | null;
  properties: Record<string, unknown>;
};

export function parseGeoJson(value: unknown): GeoJsonGeometry | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value) as GeoJsonGeometry;
    return parsed && typeof parsed === 'object' && typeof parsed.type === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export function feature(
  id: string,
  geometry: GeoJsonGeometry | null,
  properties: Record<string, unknown>,
): GeoJsonFeature {
  return { type: 'Feature', id, geometry, properties };
}

export function numeric(value: unknown): number | null {
  if (value == null || value === '') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

export function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function serializeGeometry(value: unknown) {
  return parseGeoJson(value);
}
