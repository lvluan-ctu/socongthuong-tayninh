import { NextResponse } from 'next/server';
import { getEfficiencyAnalytics } from '@/server/efficiency/analytics';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    return NextResponse.json(await getEfficiencyAnalytics(new URL(request.url).searchParams));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải efficiency analytics.' }, { status: 400 });
  }
}
