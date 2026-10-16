import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

/**
 * Proxies manual StationPlaylist SLog-YYMMDD.csv file uploads to /api/v1/uploadTrafficLogFile
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const url = `${API_BASE}/uploadTrafficLogFile`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Upload failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const parsedCount = data.parsed ?? data.total_rows_parsed ?? 0;
    const insertedCount = data.inserted ?? data.spots_inserted ?? 0;

    return NextResponse.json({
      ...data,
      parsed: parsedCount,
      inserted: insertedCount,
      spots_inserted: insertedCount,
      total_rows_parsed: parsedCount,
    });
  } catch (error) {
    console.error('Radio traffic CSV upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload StationPlaylist CSV file' },
      { status: 500 }
    );
  }
}
