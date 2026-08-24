import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

/** Proxies to the cluster Go service /api/v1/getRadioShowSnapshots (TSDB). */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const showName = searchParams.get('showName') || '';
    const limit = searchParams.get('limit') || '';
    const offset = searchParams.get('offset') || '';
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (showName) params.set('showName', showName);
    if (limit) params.set('limit', limit);
    if (offset) params.set('offset', offset);

    const url = `${API_BASE}/getRadioShowSnapshots?${params.toString()}`;
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
      throw new Error(`Show snapshots returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Radio show snapshots API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch show snapshots' },
      { status: 500 }
    );
  }
}
