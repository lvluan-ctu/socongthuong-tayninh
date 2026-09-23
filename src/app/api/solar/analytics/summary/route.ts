import { NextResponse } from 'next/server';
import { loadRooftopAnalytics } from '@/server/solar/rooftop-analytics';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const rawYear = Number(new URL(request.url).searchParams.get('year'));
    const year = Number.isInteger(rawYear) && rawYear >= 2000 && rawYear <= 2200 ? rawYear : new Date().getUTCFullYear();
    const analytics = await loadRooftopAnalytics(year);
    return NextResponse.json({ year: analytics.year, generatedAt: analytics.generatedAt, summary: analytics.summary, dataQuality: analytics.dataQuality });
  } catch (error) {
    console.error('Rooftop analytics summary failed', error);
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải tổng hợp rooftop solar.' }, { status: 500 });
  }
}
