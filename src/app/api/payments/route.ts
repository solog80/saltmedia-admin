import { NextRequest, NextResponse } from 'next/server';

const PAYMENTS_FUNCTION_URL =
  'https://europe-west1-salt-media-app1.cloudfunctions.net/getPaymentMetrics';

export async function GET(req: NextRequest) {
  try {
    const days = req.nextUrl.searchParams.get('days') || '30';
    const url = `${PAYMENTS_FUNCTION_URL}?days=${days}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Cloud Function returned ${response.status}`);
    }

    const metrics = await response.json();
    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Payments API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment metrics', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
