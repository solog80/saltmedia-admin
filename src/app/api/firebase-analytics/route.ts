import { NextRequest, NextResponse } from 'next/server';

const FIREBASE_ANALYTICS_FUNCTION_URL =
  'https://europe-west1-salt-media-app1.cloudfunctions.net/getFirebaseAnalytics';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const period = searchParams.get('period') || '30d';

    const url = new URL(FIREBASE_ANALYTICS_FUNCTION_URL);

    if (startDate && endDate) {
      url.searchParams.set('startDate', startDate);
      url.searchParams.set('endDate', endDate);
    } else {
      url.searchParams.set('period', period);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Cloud Function returned ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('Firebase Analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch firebase analytics' },
      { status: 500 }
    );
  }
}