import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

/**
 * Proxies the User & Device analytics to the mesh /api/v1/getGa4Analytics
 * (Google Analytics for Firebase Data API, with fallback to the TimescaleDB
 * aggregate when GA4 is unreachable).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const qs = params.toString();

    const response = await fetch(`${API_BASE}/getGa4Analytics${qs ? '?' + qs : ''}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `getFirebaseAnalytics returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Firebase Analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch firebase analytics' },
      { status: 500 }
    );
  }
}
