import 'server-only';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/db/schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required for the Energy database.');
}

const globalForDb = globalThis as unknown as { energyPool?: Pool };
const pool = globalForDb.energyPool ?? new Pool({ connectionString, max: 12 });
if (process.env.NODE_ENV !== 'production') globalForDb.energyPool = pool;

export const energyPool = pool;
export const db = drizzle(pool, { schema });
