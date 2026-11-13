import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get('firebaseToken')?.value);
  if (!session || !['admin', 'moderator', 'editor'].includes(session.role ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = (await req.json()) as { id?: string; hlsUrl?: string };
    if (!body.id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const hlsUrl = typeof body.hlsUrl === 'string' ? body.hlsUrl.trim() : '';
    const base = (process.env.REST_BASE_URL || '').replace(/\/$/, '');
    const key = process.env.SERVICE_ROLE_KEY || '';
    if (!base || !key) {
      return NextResponse.json({ error: 'mesh not configured' }, { status: 500 });
    }
    const res = await fetch(`${base}/broadcast_status?on_conflict=user_id`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        user_id: body.id,
        hls_url: hlsUrl,
        updated_at: new Date().toISOString(),
      }),
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ error: `mesh write failed: ${res.status}` }, { status: 502 });
    }

    return NextResponse.json({ success: true, id: body.id, hlsUrl });
  } catch (e) {
    return NextResponse.json({ error: `write failed: ${e}` }, { status: 502 });
  }
}
