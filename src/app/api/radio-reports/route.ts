import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

/**
 * Proxies to the cluster Go service /api/v1/getRadioReports (TimescaleDB +
 * EPG). Server-side service-role key; never ships to the browser.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = searchParams.get('days') || '30';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const params = new URLSearchParams({ days });
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const url = `${API_BASE}/getRadioReports?${params.toString()}`;

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
      throw new Error(`Radio reports returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Radio reports API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch radio reports' },
      { status: 500 }
    );
  }
}
