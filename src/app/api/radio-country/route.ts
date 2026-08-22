import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

/** Proxies to the cluster Go service /api/v1/getRadioCountryDetails (TSDB). */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country');
    if (!country) {
      return NextResponse.json({ error: 'country param required' }, { status: 400 });
    }
    const url = `${API_BASE}/getRadioCountryDetails?country=${encodeURIComponent(country)}`;

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
      throw new Error(`Radio country returned ${response.status}`);
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Radio country API error:', error);
    return NextResponse.json({ error: 'Failed to fetch country details' }, { status: 500 });
  }
}
