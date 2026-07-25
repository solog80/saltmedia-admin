import { NextRequest, NextResponse } from 'next/server';

const FUNCTION_URL =
  'https://europe-west1-salt-media-app1.cloudfunctions.net/getRadioHistory';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = new URLSearchParams({
      days: searchParams.get('days') || '7',
      limit: searchParams.get('limit') || '100',
      offset: searchParams.get('offset') || '0',
      sortBy: searchParams.get('sortBy') || 'played_at',
      sortDir: searchParams.get('sortDir') || 'desc',
    });
    const search = searchParams.get('search');
    if (search) params.set('search', search);

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
    console.error('Radio history API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch radio history',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
