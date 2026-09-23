import { Hono } from 'hono';
import { z } from 'zod';
import { getLicenses, getLicense, createLicense, updateLicense, deleteLicense } from '@/lib/mineral/mineral-store';
import { computeReconciliation, computeKpis } from '@/lib/mineral/mineral-service';
import { toast } from 'sonner';

const mineral = new Hono();

// GET /api/mineral/licenses - List with filter & pagination
mineral.get('/', async (c) => {
  try {
    const { searchParams } = new URL(c.req.url);
    const filters = {
      status: searchParams.get('status') as any,
      mineralCategory: searchParams.get('mineralCategory') as any,
      district: searchParams.get('district') as any,
      search: searchParams.get('search') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '25'),
    };
    
    const result = await getLicenses(filters);
    return c.json(result);
  } catch (err) {
    console.error('Error fetching licenses:', err);
    return c.json({ error: 'Failed to fetch licenses' }, 500);
  }
});

// GET /api/mineral/licenses/:id - Get one license
mineral.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const license = await getLicense(id);
    if (!license) return c.json({ variable "sk" has been skipped because it appears like the last property)