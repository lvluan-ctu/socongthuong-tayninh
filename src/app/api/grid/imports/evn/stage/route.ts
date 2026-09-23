import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  energyDataQualityIssues,
  energyDataSources,
  energyImportBatches,
  energyImportRecords,
} from '@/db/schema';
import { parseEvnWorkbook } from '@/server/evn/evn-workbook-parser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const SOURCE_CODE = 'EVN_GRID_EXCEL';

function parseObservationDate(value: FormDataEntryValue | null) {
  if (!value || typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(`${value}T00:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateTime(value: FormDataEntryValue | null) {
  if (!value || typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function warningMessage(code: string) {
  if (code === 'COORDINATE_OUT_OF_WGS84_RANGE') return 'Tọa độ X/Y nằm ngoài miền WGS84 hợp lệ; cần kiểm tra hệ tọa độ hoặc mapping X/Y.';
  if (code === 'TIME_24H_ROLLS_TO_NEXT_DAY') return 'Giá trị 24:00 sẽ được hiểu là 00:00 của ngày kế tiếp khi nhập telemetry.';
  if (code === 'OPERATION_DATE_SUSPICIOUS') return 'Ngày vận hành có năm trước 1950; giữ nguyên dữ liệu nguồn và yêu cầu cán bộ xác minh.';
  return `Cảnh báo dữ liệu nguồn: ${code}`;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const observationDate = parseObservationDate(formData.get('observationDate'));
    const sourceUpdatedAtValue = formData.get('sourceUpdatedAt');
    const sourceUpdatedAt = parseDateTime(sourceUpdatedAtValue);
    if (sourceUpdatedAtValue && !sourceUpdatedAt) {
      return NextResponse.json({ message: 'sourceUpdatedAt không phải ngày giờ hợp lệ.' }, { status: 400 });
    }
    const parserVersionValue = formData.get('parserVersion');
    const mappingVersionValue = formData.get('mappingVersion');
    const parserVersion = typeof parserVersionValue === 'string' && parserVersionValue.trim() ? parserVersionValue.trim() : 'evn-workbook-v2';
    const mappingVersion = typeof mappingVersionValue === 'string' && mappingVersionValue.trim() ? mappingVersionValue.trim() : 'evn-grid-normalization-v1';
    const submittedByValue = formData.get('submittedBy');
    const submittedBy = typeof submittedByValue === 'string' && submittedByValue.trim()
      ? submittedByValue.trim()
      : 'system-import';

    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'Vui lòng chọn file Excel EVN.' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json({ message: 'Hiện tại Import Center hỗ trợ file .xlsx.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ message: 'File vượt quá giới hạn 25 MB.' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseEvnWorkbook(buffer, file.name);

    if (parsed.preview.acceptedRows === 0) {
      return NextResponse.json({ message: 'Không tìm thấy dòng dữ liệu EVN hợp lệ trong workbook.' }, { status: 422 });
    }

    if (parsed.preview.requiresObservationDate && !observationDate) {
      return NextResponse.json(
        { message: 'Workbook có dữ liệu đo đếm nhưng không xác định được ngày đo. Vui lòng chọn ngày dữ liệu.' },
        { status: 422 },
      );
    }

    const checksum = createHash('sha256').update(buffer).digest('hex');

    const result = await db.transaction(async (tx) => {
      let [source] = await tx
        .select()
        .from(energyDataSources)
        .where(eq(energyDataSources.code, SOURCE_CODE))
        .limit(1);

      if (!source) {
        [source] = await tx
          .insert(energyDataSources)
          .values({
            code: SOURCE_CODE,
            name: 'EVN Grid Excel',
            provider: 'EVN',
            sourceType: 'EXCEL',
            refreshCadence: 'ON_DEMAND',
            authoritativeLevel: 'AUTHORITATIVE',
            status: 'ACTIVE',
            classification: 'RESTRICTED',
            sourceVersion: parserVersion,
            config: {
              parser: parserVersion,
              preservesRawRows: true,
              coordinatePolicy: 'template-driven',
              telemetryPolicy: 'source-sign-preserved',
            },
          })
          .returning();
      }
      await tx.update(energyDataSources).set({ owner: 'EVN', refreshCadence: 'ON_DEMAND', authoritativeLevel: 'AUTHORITATIVE', sourceVersion: parserVersion, updatedAt: new Date() }).where(eq(energyDataSources.id, source.id));

      const [existingBatch] = await tx
        .select({ id: energyImportBatches.id, status: energyImportBatches.status })
        .from(energyImportBatches)
        .where(and(eq(energyImportBatches.sourceId, source.id), eq(energyImportBatches.checksum, checksum)))
        .limit(1);
      if (existingBatch) return { duplicate: true as const, existingBatch, source };

      const [batch] = await tx
        .insert(energyImportBatches)
        .values({
          sourceId: source.id,
          fileName: file.name,
          checksum,
          entityType: 'EVN_GRID_WORKBOOK',
          status: 'STAGED',
          observationDate,
          recordsRead: parsed.preview.acceptedRows + parsed.preview.skippedRows,
          recordsAccepted: parsed.preview.acceptedRows,
          recordsRejected: 0,
          submittedBy,
          parserVersion,
          mappingVersion,
          sourceUpdatedAt,
          importedAt: new Date(),
          metadata: {
            parserVersion,
            mappingVersion,
            sourceUpdatedAt: sourceUpdatedAt?.toISOString() ?? null,
            sheetCount: parsed.preview.sheetCount,
            skippedRows: parsed.preview.skippedRows,
            warningCount: parsed.preview.warningCount,
            requiresObservationDate: parsed.preview.requiresObservationDate,
            sheets: parsed.preview.sheets.map((sheet) => ({
              sheetName: sheet.sheetName,
              entityType: sheet.entityType,
              headerRowNumber: sheet.headerRowNumber,
              acceptedRows: sheet.acceptedRows,
              skippedRows: sheet.skippedRows,
              detectedReportDate: sheet.detectedReportDate,
              context: sheet.context,
            })),
          },
        })
        .returning();

      const chunkSize = 400;
      for (let start = 0; start < parsed.records.length; start += chunkSize) {
        const chunk = parsed.records.slice(start, start + chunkSize);
        const insertedRows = await tx.insert(energyImportRecords).values(
          chunk.map((record) => ({
            batchId: batch.id,
            sheetName: record.sheetName,
            rowNumber: record.rowNumber,
            externalKey: record.externalKey,
            parentExternalKey: record.parentExternalKey,
            payload: {
              entityTypeHint: record.entityType,
              headerRowNumber: record.headerRowNumber,
              warnings: record.warnings,
              context: record.context,
              data: record.data,
            },
            validationStatus: record.warnings.length > 0 ? 'WARNING' : 'ACCEPTED',
          })),
        ).returning({ id: energyImportRecords.id, rowNumber: energyImportRecords.rowNumber });

        const insertedByRow = new Map(insertedRows.map((row) => [row.rowNumber, row.id]));
        const qualityRows = chunk.flatMap((record) => record.warnings.map((warning) => ({
          batchId: batch.id,
          recordId: insertedByRow.get(record.rowNumber) ?? null,
          severity: warning === 'OPERATION_DATE_SUSPICIOUS' || warning === 'COORDINATE_OUT_OF_WGS84_RANGE' ? 'WARNING' : 'INFO',
          issueCode: warning,
          message: warningMessage(warning),
          metadata: {
            sourceSheet: record.sheetName,
            sourceRowNumber: record.rowNumber,
            externalKey: record.externalKey,
            parentExternalKey: record.parentExternalKey,
          },
        })));
        if (qualityRows.length > 0) {
          await tx.insert(energyDataQualityIssues).values(qualityRows).onConflictDoNothing();
        }
      }

      return { duplicate: false as const, batch, source };
    });

    if (result.duplicate) {
      return NextResponse.json({ message: 'Workbook này đã được import vào staging theo cùng checksum.', batchId: result.existingBatch.id, status: result.existingBatch.status }, { status: 409 });
    }

    return NextResponse.json({
      batchId: result.batch.id,
      sourceId: result.source.id,
      status: result.batch.status,
      checksum,
      preview: parsed.preview,
    });
  } catch (error) {
    console.error('EVN stage import failed', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Không thể lưu batch EVN vào staging.' },
      { status: 500 },
    );
  }
}
