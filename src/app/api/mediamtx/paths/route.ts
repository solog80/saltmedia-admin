import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebaseAdmin';
import { previewToken } from '@/lib/mediamtxAuth';

export const dynamic = 'force-dynamic';

const API_ORIGIN = (process.env.MEDIAMTX_API_ORIGIN || 'http://139.144.77.47:9997').replace(/\/$/, '');

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get('firebaseToken')?.value);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const res = await fetch(`${API_ORIGIN}/v3/paths/list`, {
      headers: { Authorization: `Bearer ${previewToken()}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ error: `MediaMTX ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    const items = Array.isArray(data.items)
      ? data.items.map((item: any) => ({
          name: item.name,
          ready: item.ready === true,
          readers: Array.isArray(item.readers) ? item.readers.length : 0,
          source: item.source ?? null,
        }))
      : [];
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: `MediaMTX unavailable: ${e}` }, { status: 502 });
  }
}
