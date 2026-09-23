import { NextResponse } from 'next/server';
import { normalizeEvnTelemetryBatch } from '@/server/evn/evn-telemetry-normalizer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ batchId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { batchId } = await context.params;
    if (!batchId) return NextResponse.json({ message: 'Thiếu batchId.' }, { status: 400 });
    const result = await normalizeEvnTelemetryBatch(batchId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('EVN telemetry normalization failed', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Không thể chuẩn hóa dữ liệu đo EVN.' },
      { status: 500 },
    );
  }
}
