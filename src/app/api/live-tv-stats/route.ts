import { NextRequest, NextResponse } from 'next/server';

const EDGE_STATS = 'http://198.204.224.170:8099';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path') || 'viewers';
    const minutes = searchParams.get('minutes') || '5';
    const countries = searchParams.get('countries') || '1';
    const filterDc = searchParams.get('filter_dc') || '1';

    let url: string;
    if (path === 'peak') {
      url = `${EDGE_STATS}/api/viewers/peak?minutes=${minutes}`;
    } else {
      url = `${EDGE_STATS}/api/viewers?minutes=${minutes}&countries=${countries}&filter_dc=${filterDc}`;
    }

    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Edge stats API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Live TV stats proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch live TV stats', details: String(error) },
      { status: 500 }
    );
  }
}
