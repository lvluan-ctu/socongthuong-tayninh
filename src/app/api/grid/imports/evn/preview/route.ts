import { NextResponse } from 'next/server';
import { parseEvnWorkbook } from '@/server/evn/evn-workbook-parser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 25 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

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

    return NextResponse.json(parsed.preview);
  } catch (error) {
    console.error('EVN preview failed', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Không thể đọc workbook EVN.' },
      { status: 500 },
    );
  }
}
