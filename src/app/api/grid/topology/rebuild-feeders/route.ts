import { NextResponse } from 'next/server';
import { rebuildFeedersFromEvnMetadata } from '@/server/grid/grid-enrichment';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await rebuildFeedersFromEvnMetadata();
    return NextResponse.json({
      ...result,
      message: `Đã liên kết ${result.linkedLines} đường dây vào phát tuyến; tạo mới ${result.created} phát tuyến.`,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Không thể dựng phát tuyến từ dữ liệu EVN.' },
      { status: 500 },
    );
  }
}
