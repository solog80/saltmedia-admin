import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

/**
 * Proxies ad analytics to the cluster's Go service (/api/v1/getAdAnalytics),
 * which aggregates the TimescaleDB ad_events hypertable (BigQuery replacement).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate query params are required' },
        { status: 400 }
      );
    }

    const params = new URLSearchParams({ startDate, endDate });
    const adId = searchParams.get('adId');
    if (adId) params.set('adId', adId);

    const res = await fetch(`${API_BASE}/getAdAnalytics?${params.toString()}`, {
      method: 'GET',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      cache: 'no-store',
    });
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json({ error: text || `Analytics ${res.status}` }, { status: res.status });
    }
    return new NextResponse(text, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
