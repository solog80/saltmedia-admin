import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebaseAdmin';

const REST_BASE = process.env.REST_BASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

/**
 * Broadcast settings (TV + radio) for a device.
 *
 * Protected by the admin session cookie (same as other dashboard APIs). Writes
 * use the mesh service-role key, so anon clients stay read-only while
 * Realtime subscriptions keep the dashboard and field app in sync.
 *
 * GET  /api/broadcast_settings?uid=<firebaseUid>  -> { tv, radio }
 * POST /api/broadcast_settings { uid, tv?, radio? }
 */

function meshHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function restFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${REST_BASE}/${path}`, {
    ...init,
    headers: { ...meshHeaders(), ...(init.headers || {}) },
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `PostgREST ${res.status}`);
  return text;
}

async function readRow(uid: string): Promise<{ tv: any; radio: any }> {
  const raw = await restFetch(
    `broadcast_config?user_id=eq.${encodeURIComponent(uid)}&select=tv,radio&limit=1`,
  );
  const rows = JSON.parse(raw) as any[];
  if (rows.length === 0) return { tv: {}, radio: {} };
  return { tv: rows[0].tv || {}, radio: rows[0].radio || {} };
}

export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get('firebaseToken')?.value);
  if (!session || !['admin', 'moderator', 'editor'].includes(session.role ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  const uid = req.nextUrl.searchParams.get('uid');
  if (!uid) {
    return NextResponse.json({ error: 'uid required' }, { status: 400 });
  }
  try {
    const { tv, radio } = await readRow(uid);
    return NextResponse.json({ success: true, uid, tv, radio });
  } catch (e) {
    return NextResponse.json({ error: `read failed: ${e}` }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get('firebaseToken')?.value);
  if (!session || !['admin', 'moderator', 'editor'].includes(session.role ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  if (!REST_BASE || !SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'mesh not configured' }, { status: 500 });
  }
  try {
    const body = (await req.json()) as {
      uid?: string;
      tv?: Record<string, unknown>;
      radio?: Record<string, unknown>;
    };
    const uid = body.uid;
    if (!uid) {
      return NextResponse.json({ error: 'uid required' }, { status: 400 });
    }

    // Read-merge-write so sending only `tv` or only `radio` doesn't clobber
    // the other section.
    const current = await readRow(uid);
    const tv = body.tv ? { ...current.tv, ...body.tv } : current.tv;
    const radio = body.radio ? { ...current.radio, ...body.radio } : current.radio;

    const raw = await restFetch(`broadcast_config?on_conflict=user_id`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ user_id: uid, tv, radio }),
    });

    return NextResponse.json({ success: true, uid, ...(JSON.parse(raw)?.[0] ?? {}) });
  } catch (e) {
    return NextResponse.json({ error: `write failed: ${e}` }, { status: 502 });
  }
}
