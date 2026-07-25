import { NextRequest, NextResponse } from 'next/server';

const FUNCTION_URL =
  'https://europe-west1-salt-media-app1.cloudfunctions.net/getRadioReports';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = searchParams.get('days') || '30';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const params = new URLSearchParams({ days });
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
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
    console.error('Radio reports API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch radio reports' },
      { status: 500 }
    );
  }
}
