import { createHash } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyDataSources, energyVbdhRecords, energyVbdhSyncRuns } from '@/db/schema';
import { vbdhSyncSchema } from '@/lib/carbon-schemas';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

function checksumFor(rawText: string | null | undefined, payload: Record<string, unknown>) {
  return createHash('sha256').update(rawText ?? JSON.stringify(payload)).digest('hex');
}

export async function POST(request: Request) {
  try {
    const payload = vbdhSyncSchema.parse(await request.json());
    const result = await db.transaction(async (tx) => {
      await tx.insert(energyDataSources).values({
        code: 'VBDH_CARBON_RAW', name: 'VBDH Carbon raw import', provider: 'VBDH', sourceType: 'DOCUMENT_IMPORT',
        owner: 'VBDH', refreshCadence: 'ON_DEMAND', authoritativeLevel: 'AUTHORITATIVE', sourceVersion: 'RAW_IMPORT_V1',
        endpointRef: payload.endpointRef ?? null, status: 'ACTIVE', classification: 'RESTRICTED', config: { mode: 'RAW_IMPORT_ONLY', integrationStatus: 'READY' },
      }).onConflictDoNothing({ target: energyDataSources.code });
      const [source] = await tx.select().from(energyDataSources).where(eq(energyDataSources.code, 'VBDH_CARBON_RAW')).limit(1);
      if (!source) throw new Error('Không thể khởi tạo data source VBDH.');
      await tx.update(energyDataSources).set({ owner: 'VBDH', refreshCadence: 'ON_DEMAND', authoritativeLevel: 'AUTHORITATIVE', sourceVersion: 'RAW_IMPORT_V1', updatedAt: new Date() }).where(eq(energyDataSources.id, source.id));
      const [run] = await tx.insert(energyVbdhSyncRuns).values({
        sourceId: source.id, mode: 'RAW_IMPORT', endpointRef: payload.endpointRef ?? null, createdBy: payload.createdBy ?? null,
        status: 'RECEIVED', recordsReceived: payload.records.length,
        metadata: { integrationStatus: 'READY_RAW_IMPORT_ONLY', liveEndpointCalled: false },
      }).returning();
      const sourceRecordIds = [...new Set(payload.records.map((record) => record.sourceRecordId))];
      const existing = sourceRecordIds.length ? await tx.select({ sourceRecordId: energyVbdhRecords.sourceRecordId }).from(energyVbdhRecords).where(and(eq(energyVbdhRecords.sourceId, source.id), inArray(energyVbdhRecords.sourceRecordId, sourceRecordIds))) : [];
      const existingIds = new Set(existing.map((record) => record.sourceRecordId));
      const seen = new Set<string>();
      const duplicateIds: string[] = [];
      const toInsert = payload.records.filter((record) => {
        if (existingIds.has(record.sourceRecordId) || seen.has(record.sourceRecordId)) { duplicateIds.push(record.sourceRecordId); return false; }
        seen.add(record.sourceRecordId); return true;
      });
      if (toInsert.length) {
        await tx.insert(energyVbdhRecords).values(toInsert.map((record) => ({
          syncRunId: run.id, sourceId: source.id, sourceRecordId: record.sourceRecordId, documentNo: record.documentNo ?? null,
          sourceDocumentRef: record.sourceDocumentRef ?? null, sourceUrl: record.sourceUrl ?? null, senderUnit: record.senderUnit ?? null,
          issuedAt: record.issuedAt ? new Date(record.issuedAt) : null, receivedAt: record.receivedAt ? new Date(record.receivedAt) : null,
          rawPayload: record.rawPayload, rawText: record.rawText ?? null, checksum: record.checksum ?? checksumFor(record.rawText, record.rawPayload),
          parserVersion: record.parserVersion, mappingVersion: record.mappingVersion, validationStatus: 'NEEDS_REVIEW', metadata: { importedBy: payload.createdBy ?? null },
        })));
      }
      const [completed] = await tx.update(energyVbdhSyncRuns).set({
        status: toInsert.length ? (duplicateIds.length ? 'PARTIALLY_ACCEPTED' : 'COMPLETED') : 'DUPLICATE_ONLY',
        completedAt: new Date(), recordsMapped: 0, recordsNeedsReview: toInsert.length, recordsRejected: duplicateIds.length,
        metadata: { integrationStatus: 'READY_RAW_IMPORT_ONLY', liveEndpointCalled: false, duplicateSourceRecordIds: duplicateIds },
      }).where(eq(energyVbdhSyncRuns.id, run.id)).returning();
      await tx.update(energyDataSources).set({ lastSyncAt: new Date() }).where(eq(energyDataSources.id, source.id));
      return { run: completed, source, duplicateSourceRecordIds: duplicateIds, accepted: toInsert.length };
    });
    return NextResponse.json({ ...result, warnings: ['VBDH_INTEGRATION_READY: hệ thống hiện chỉ nhận RAW_IMPORT; chưa gọi endpoint VBDH live.'] }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Payload VBDH raw không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể nhận dữ liệu VBDH raw.' }, { status: 400 });
  }
}
