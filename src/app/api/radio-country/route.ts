import { NextRequest, NextResponse } from 'next/server';

const FUNCTION_URL =
  'https://europe-west1-salt-media-app1.cloudfunctions.net/getRadioCountryDetails';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country');
    if (!country) {
      return NextResponse.json({ error: 'country param required' }, { status: 400 });
    }

    const url = `${FUNCTION_URL}?country=${encodeURIComponent(country)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) throw new Error(`Cloud Function returned ${response.status}`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Radio country API error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
