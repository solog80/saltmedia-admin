import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE_URL || 'https://edge.solofx.net/api/v1';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const path = searchParams.get('path') || 'viewers';
  const minutes = searchParams.get('minutes') || '5';
  const countries = searchParams.get('countries') || '1';
  const filterDc = searchParams.get('filter_dc') || '1';

  try {
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
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Mesh stats API ${action || 'live'} returned status ${response.status}: ${errorText}`);
      return getFallbackResponse(action, minutes);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Live TV stats proxy error:', error);
    return getFallbackResponse(action, minutes);
  }
}

function getFallbackResponse(action: string | null, minutesStr: string) {
  const minutes = parseInt(minutesStr, 10) || 5;
  if (action === 'stats') {
    return NextResponse.json({ viewers: [], minutes, fallback: true });
  } else if (action === 'countries') {
    return NextResponse.json({ countries: [], isps: [], minutes, fallback: true });
  } else if (action === 'peak_bq') {
    return NextResponse.json({
      peak_viewers: 0,
      current_viewers: 0,
      peak_time: new Date().toISOString(),
      window_minutes: minutes,
      fallback: true,
    });
  } else {
    return NextResponse.json({
      total_connections: 0,
      llhls_connections: 0,
      webrtc_connections: 0,
      avg_throughput_out: 0,
      avg_throughput_in: 0,
      viewers: 0,
      streams: {},
      fallback: true,
    });
  }
}
