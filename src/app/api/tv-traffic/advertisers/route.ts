import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

/**
 * Proxies to the cluster Go service /api/v1/getVideoTrafficAdvertisers (TimescaleDB).
 * channel=0 returns all TV channels.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = searchParams.get('days') || '30';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const channel = searchParams.get('channel') || '0';

    const params = new URLSearchParams({ days, channel });
    if (startDate) {
      params.set(
        'start',
        startDate.includes('T') ? startDate : `${startDate}T00:00:00+03:00`
      );
    }
    if (endDate) {
      params.set(
        'end',
        endDate.includes('T') ? endDate : `${endDate}T23:59:59+03:00`
      );
    }

    const response = await fetch(
      `${API_BASE}/getVideoTrafficAdvertisers?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      throw new Error(`TV traffic advertisers API returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('TV traffic advertisers API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch TV traffic advertisers summary' },
      { status: 500 }
    );
  }
}
