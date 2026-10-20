import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

/**
 * Proxies to the cluster Go service /api/v1/getVideoTrafficAffidavit (TimescaleDB).
 * Supports format=json (default) and format=csv (proof-of-performance download).
 * channel=0 returns all TV channels.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = searchParams.get('days') || '30';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const client = searchParams.get('client') || '';
    const channel = searchParams.get('channel') || '0';
    const format = searchParams.get('format') || '';

    const params = new URLSearchParams({ days, channel });
    if (startDate) {
      params.set(
        'start',
        startDate.includes('T') ? startDate : `${startDate}T00:00:00+03:00`
      );
    }
    if (endDate) {
      params.set(
        'end',
        endDate.includes('T') ? endDate : `${endDate}T23:59:59+03:00`
      );
    }
    if (client && client !== 'ALL') {
      params.set('client', client);
    }
    if (format) {
      params.set('format', format);
    }

    const response = await fetch(
      `${API_BASE}/getVideoTrafficAffidavit?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      throw new Error(`TV traffic affidavit API returned ${response.status}`);
    }

    if (format.toLowerCase() === 'csv') {
      const csv = await response.text();
      const safeClient = (client || 'all_clients')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .toLowerCase();
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="salttv_affidavit_${safeClient}.csv"`,
        },
      });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('TV traffic affidavit API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch TV traffic affidavit logs' },
      { status: 500 }
    );
  }
}
