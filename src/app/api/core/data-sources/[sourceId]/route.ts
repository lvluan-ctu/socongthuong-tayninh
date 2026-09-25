import { desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyDataQualityIssues, energyDataSources, energyImportBatches } from '@/db/schema';
import { dataSourcePatchSchema } from '@/lib/core-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ sourceId: string }> };

function invalidId(value: string) { return !z.string().uuid().safeParse(value).success; }
function dateOrNull(value: string | null | undefined) { return value ? new Date(value) : null; }

export async function GET(_request: Request, context: Context) {
  try {
    const { sourceId } = await context.params;
    if (invalidId(sourceId)) return NextResponse.json({ message: 'Mã nguồn dữ liệu không hợp lệ.' }, { status: 400 });
    const [source] = await db.select().from(energyDataSources).where(eq(energyDataSources.id, sourceId)).limit(1);
    if (!source) return NextResponse.json({ message: 'Không tìm thấy nguồn dữ liệu.' }, { status: 404 });
    const [summary] = await db.select({ batchCount: sql<number>`count(*)::int` }).from(energyImportBatches).where(eq(energyImportBatches.sourceId, sourceId));
    const batches = await db.select({
      id: energyImportBatches.id,
      fileName: energyImportBatches.fileName,
      checksum: energyImportBatches.checksum,
      entityType: energyImportBatches.entityType,
      status: energyImportBatches.status,
      observationDate: energyImportBatches.observationDate,
      parserVersion: energyImportBatches.parserVersion,
      mappingVersion: energyImportBatches.mappingVersion,
      sourceUpdatedAt: energyImportBatches.sourceUpdatedAt,
      importedAt: energyImportBatches.importedAt,
      createdAt: energyImportBatches.createdAt,
      recordsRead: energyImportBatches.recordsRead,
      recordsAccepted: energyImportBatches.recordsAccepted,
      recordsRejected: energyImportBatches.recordsRejected,
    }).from(energyImportBatches).where(eq(energyImportBatches.sourceId, sourceId)).orderBy(desc(energyImportBatches.createdAt)).limit(50);
    const [quality] = await db.select({
      open: db.$count(energyDataQualityIssues, eq(energyDataQualityIssues.status, 'OPEN')),
      acknowledged: db.$count(energyDataQualityIssues, eq(energyDataQualityIssues.status, 'ACKNOWLEDGED')),
    }).from(energyDataQualityIssues).innerJoin(energyImportBatches, eq(energyImportBatches.id, energyDataQualityIssues.batchId)).where(eq(energyImportBatches.sourceId, sourceId));
    return NextResponse.json({ source, summary: { batchCount: Number(summary?.batchCount ?? batches.length), openQualityIssues: Number(quality?.open ?? 0) + Number(quality?.acknowledged ?? 0) }, batches });
  } catch (error) {
    console.error('Data source detail failed', error);
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải chi tiết nguồn dữ liệu.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { sourceId } = await context.params;
    if (invalidId(sourceId)) return NextResponse.json({ message: 'Mã nguồn dữ liệu không hợp lệ.' }, { status: 400 });
    const current = await db.select().from(energyDataSources).where(eq(energyDataSources.id, sourceId)).limit(1);
    if (!current[0]) return NextResponse.json({ message: 'Không tìm thấy nguồn dữ liệu.' }, { status: 404 });
    const payload = dataSourcePatchSchema.parse(await request.json());
    if (payload.code && payload.code !== current[0].code) {
      const [duplicate] = await db.select({ id: energyDataSources.id }).from(energyDataSources).where(eq(energyDataSources.code, payload.code)).limit(1);
      if (duplicate) return NextResponse.json({ message: `Mã nguồn ${payload.code} đã tồn tại.` }, { status: 409 });
    }
    const [updated] = await db.update(energyDataSources).set({
      ...(payload.code === undefined ? {} : { code: payload.code }),
      ...(payload.name === undefined ? {} : { name: payload.name }),
      ...(payload.provider === undefined ? {} : { provider: payload.provider }),
      ...(payload.sourceType === undefined ? {} : { sourceType: payload.sourceType }),
      ...(payload.owner === undefined ? {} : { owner: payload.owner }),
      ...(payload.endpointRef === undefined ? {} : { endpointRef: payload.endpointRef }),
      ...(payload.schedule === undefined ? {} : { schedule: payload.schedule }),
      ...(payload.refreshCadence === undefined ? {} : { refreshCadence: payload.refreshCadence }),
      ...(payload.authoritativeLevel === undefined ? {} : { authoritativeLevel: payload.authoritativeLevel }),
      ...(payload.status === undefined ? {} : { status: payload.status }),
      ...(payload.classification === undefined ? {} : { classification: payload.classification }),
      ...(payload.sourceVersion === undefined ? {} : { sourceVersion: payload.sourceVersion }),
      ...(payload.lastSourceUpdatedAt === undefined ? {} : { lastSourceUpdatedAt: dateOrNull(payload.lastSourceUpdatedAt) }),
      ...(payload.config === undefined ? {} : { config: payload.config }),
      updatedAt: new Date(),
    }).where(eq(energyDataSources.id, sourceId)).returning();
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Thông tin nguồn dữ liệu không hợp lệ.', issues: error.issues }, { status: 400 });
    console.error('Data source update failed', error);
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể cập nhật nguồn dữ liệu.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { sourceId } = await context.params;
    if (invalidId(sourceId)) return NextResponse.json({ message: 'Mã nguồn dữ liệu không hợp lệ.' }, { status: 400 });
    const [updated] = await db.update(energyDataSources).set({ status: 'DEPRECATED', updatedAt: new Date() }).where(eq(energyDataSources.id, sourceId)).returning({ id: energyDataSources.id, code: energyDataSources.code, status: energyDataSources.status });
    if (!updated) return NextResponse.json({ message: 'Không tìm thấy nguồn dữ liệu.' }, { status: 404 });
    return NextResponse.json({ ...updated, message: 'Nguồn dữ liệu đã chuyển sang DEPRECATED để bảo toàn provenance.' });
  } catch (error) {
    console.error('Data source archive failed', error);
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu trữ nguồn dữ liệu.' }, { status: 500 });
  }
}
