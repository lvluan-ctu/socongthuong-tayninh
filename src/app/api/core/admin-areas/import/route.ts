import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const geoJsonGeometrySchema = z.object({
  type: z.string(),
  coordinates: z.unknown(),
});

const featureSchema = z.object({
  type: z.literal('Feature'),
  properties: z.record(z.string(), z.unknown()).default({}),
  geometry: geoJsonGeometrySchema.nullable(),
});

const schema = z.object({
  featureCollection: z.object({
    type: z.literal('FeatureCollection'),
    features: z.array(featureSchema).min(1).max(10000),
  }),
  codeProperty: z.string().trim().min(1),
  nameProperty: z.string().trim().min(1),
  levelProperty: z.string().trim().optional(),
  parentCodeProperty: z.string().trim().optional(),
  defaultLevel: z.string().trim().min(1).default('COMMUNE'),
  sourceName: z.string().trim().max(250).default('GeoJSON import'),
});

function textProperty(properties: Record<string, unknown>, key: string | undefined) {
  if (!key) return null;
  const value = properties[key];
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    let inserted = 0;
    let updated = 0;
    let rejected = 0;
    const errors: Array<{ index: number; message: string }> = [];

    for (const [index, feature] of payload.featureCollection.features.entries()) {
      try {
        if (!feature.geometry || !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) {
          rejected += 1;
          errors.push({ index, message: 'Geometry phải là Polygon hoặc MultiPolygon.' });
          continue;
        }
        const code = textProperty(feature.properties, payload.codeProperty);
        const name = textProperty(feature.properties, payload.nameProperty);
        if (!code || !name) {
          rejected += 1;
          errors.push({ index, message: `Thiếu ${payload.codeProperty} hoặc ${payload.nameProperty}.` });
          continue;
        }
        const level = textProperty(feature.properties, payload.levelProperty) ?? payload.defaultLevel;
        const parentCode = textProperty(feature.properties, payload.parentCodeProperty);
        const geometryJson = JSON.stringify(feature.geometry);
        const metadata = JSON.stringify({ source: payload.sourceName, originalProperties: feature.properties });

        const existing = await db.execute(sql`SELECT id FROM energy_admin_areas WHERE code=${code} LIMIT 1`);
        await db.execute(sql`
          INSERT INTO energy_admin_areas (code, name, level, parent_code, boundary, metadata)
          VALUES (
            ${code}, ${name}, ${level}, ${parentCode},
            ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${geometryJson}), 4326)), 3)),
            ${metadata}::jsonb
          )
          ON CONFLICT (code) DO UPDATE SET
            name=EXCLUDED.name,
            level=EXCLUDED.level,
            parent_code=EXCLUDED.parent_code,
            boundary=EXCLUDED.boundary,
            metadata=EXCLUDED.metadata
        `);
        if (existing.rows.length) updated += 1; else inserted += 1;
      } catch (error) {
        rejected += 1;
        errors.push({ index, message: error instanceof Error ? error.message : 'Không thể import feature.' });
      }
    }

    return NextResponse.json({
      inserted,
      updated,
      rejected,
      errors: errors.slice(0, 100),
      message: `Đã import ${inserted + updated} địa giới; ${rejected} bản ghi bị từ chối.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'GeoJSON hoặc cấu hình mapping không hợp lệ.', issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể import địa giới.' }, { status: 500 });
  }
}
