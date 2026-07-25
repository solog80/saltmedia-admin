import { NextRequest, NextResponse } from 'next/server';

const FUNCTION_URL =
  'https://europe-west1-salt-media-app1.cloudfunctions.net/getRadioShowListenerDetails';

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

    const url = `${FUNCTION_URL}?${params.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Cloud Function returned ${response.status}`);
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
