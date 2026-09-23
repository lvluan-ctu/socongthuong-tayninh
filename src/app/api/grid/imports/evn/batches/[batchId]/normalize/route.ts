import { NextResponse } from 'next/server';
import { normalizeEvnGridBatch } from '@/server/evn/evn-grid-normalizer';
import { rebuildFeedersFromEvnMetadata, rebuildPowerStructures } from '@/server/grid/grid-enrichment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ batchId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { batchId } = await context.params;
    if (!batchId) {
      return NextResponse.json({ message: 'Thiếu batchId.' }, { status: 400 });
    }

    const result = await normalizeEvnGridBatch(batchId);
    const enrichment: Record<string, unknown> = {};
    const warnings: string[] = [];

    try {
      enrichment.powerStructures = await rebuildPowerStructures();
    } catch (error) {
      warnings.push(`Không thể chuẩn hóa trụ/tháp: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`);
    }

    try {
      enrichment.feeders = await rebuildFeedersFromEvnMetadata();
    } catch (error) {
      warnings.push(`Không thể suy diễn phát tuyến: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`);
    }

    return NextResponse.json({ ...result, enrichment, warnings });
  } catch (error) {
    console.error('EVN normalization failed', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Không thể chuẩn hóa EVN Grid batch.' },
      { status: 500 },
    );
  }
}
