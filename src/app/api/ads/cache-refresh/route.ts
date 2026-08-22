import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

/**
 * Proxies to the cluster Go service /api/v1/refreshAdCache (admin-gated by the
 * service-role key), which rebuilds the in-memory ad cache. The scheduled
 * hourly refresh in the old code is replaced by the cache TTL + this endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    const res = await fetch(`${API_BASE}/refreshAdCache`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      cache: 'no-store',
    });
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json({ error: text || `refreshAdCache ${res.status}` }, { status: res.status });
    }
    return new NextResponse(text, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
