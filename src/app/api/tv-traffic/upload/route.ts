import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

/**
 * Proxies manual vMix VLog-*.csv uploads to /api/v1/uploadVideoTrafficLogFile.
 * Pass ?channel=401&channel_name=Salt%20TV%20One in the query string.
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channel = searchParams.get('channel') || '401';
    const channelName = searchParams.get('channel_name') || '';

    const incoming = await request.formData();
    const outbound = new FormData();
    const file = incoming.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Missing file form field' }, { status: 400 });
    }
    outbound.append('file', file, (file as File).name);

    const params = new URLSearchParams({ channel });
    if (channelName) params.set('channel_name', channelName);

    const response = await fetch(
      `${API_BASE}/uploadVideoTrafficLogFile?${params.toString()}`,
      {
        method: 'POST',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: outbound,
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Upload failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('TV traffic CSV upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload vMix VLog CSV file' },
      { status: 500 }
    );
  }
}
