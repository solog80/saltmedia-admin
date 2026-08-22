import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

/** Proxies to the cluster Go service /api/v1/getRadioShowAnalytics (TSDB). */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = searchParams.get('days') || '30';
    const url = `${API_BASE}/getRadioShowAnalytics?days=${days}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Show analytics returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Radio shows API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch show analytics' },
      { status: 500 }
    );
  }
}
