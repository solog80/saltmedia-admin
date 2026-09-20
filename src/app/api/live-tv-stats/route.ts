import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE_URL || 'https://edge.solofx.net/api/v1';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const path = searchParams.get('path') || 'viewers';
    const minutes = searchParams.get('minutes') || '5';
    const countries = searchParams.get('countries') || '1';
    const filterDc = searchParams.get('filter_dc') || '1';

    let url: string;
    if (action === 'stats') {
      url = `${API_BASE}/getViewerStats?minutes=${minutes}`;
    } else if (action === 'countries') {
      url = `${API_BASE}/getViewerCountries?minutes=${minutes}`;
    } else if (action === 'peak_bq') {
      url = `${API_BASE}/getViewerPeak${minutes ? `?minutes=${minutes}` : ''}`;
    } else {
      url = `${API_BASE}/getLiveTvStats?path=${path}&minutes=${minutes}&countries=${countries}&filter_dc=${filterDc}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (SERVICE_ROLE_KEY) {
      headers['apikey'] = SERVICE_ROLE_KEY;
      headers['Authorization'] = `Bearer ${SERVICE_ROLE_KEY}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Mesh stats API error: ${response.status}`, details: errorText },
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
