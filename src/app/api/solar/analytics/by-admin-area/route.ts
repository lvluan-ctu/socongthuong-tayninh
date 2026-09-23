import { NextResponse } from 'next/server';
import { loadRooftopAnalytics } from '@/server/solar/rooftop-analytics';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const rawYear = Number(new URL(request.url).searchParams.get('year'));
    const year = Number.isInteger(rawYear) && rawYear >= 2000 && rawYear <= 2200 ? rawYear : new Date().getUTCFullYear();
    const analytics = await loadRooftopAnalytics(year);
    return NextResponse.json({ year: analytics.year, generatedAt: analytics.generatedAt, items: analytics.areas, dataQuality: analytics.dataQuality });
  } catch (error) {
    console.error('Rooftop analytics by area failed', error);
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải thống kê rooftop theo địa bàn.' }, { status: 500 });
  }
}
