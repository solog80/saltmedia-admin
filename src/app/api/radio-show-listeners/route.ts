import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

/** Proxies to the cluster Go service /api/v1/getRadioShowListenerDetails (TSDB). */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const showName = searchParams.get('showName') || '';
    const page = searchParams.get('page') || '1';
    const pageSize = searchParams.get('pageSize') || '25';

    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (showName) params.set('showName', showName);
    params.set('page', page);
    params.set('pageSize', pageSize);

    const url = `${API_BASE}/getRadioShowListenerDetails?${params.toString()}`;
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
      throw new Error(`Show listener details returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Radio show listener details API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch show listener details' },
      { status: 500 }
    );
  }
}
