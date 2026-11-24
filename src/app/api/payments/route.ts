import { NextRequest, NextResponse } from 'next/server';

const MESH_API_URL =
  (process.env.API_BASE_URL || 'https://edge.solofx.net/api/v1').replace(/\/$/, '');
const SERVICE_KEY = process.env.MESH_SERVICE_KEY || process.env.SERVICE_ROLE_KEY || '';

export async function GET(req: NextRequest) {
  try {
    if (!SERVICE_KEY) {
      return NextResponse.json(
        { error: 'Payment metrics unavailable', message: 'SERVICE_ROLE_KEY is not configured' },
        { status: 500 },
      );
    }

    const days = req.nextUrl.searchParams.get('days') || '30';
    const url = `${MESH_API_URL}/getPaymentMetrics?days=${encodeURIComponent(days)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Mesh returned ${response.status}: ${body}`);
    }

    const metrics = await response.json();
    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Payments API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment metrics', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
