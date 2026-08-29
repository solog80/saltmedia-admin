import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';
const STORAGE_BASE = API_BASE.replace(/\/api\/v1\/?$/, '') + '/storage/v1';

/** Proxies notification ops to the mesh Go service (FCM + Supabase sent log). */

async function proxy(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API_BASE}/${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      ...init.headers,
    },
    cache: 'no-store',
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    return NextResponse.json(data || { error: `notifications ${res.status}` }, { status: res.status });
  }
  return NextResponse.json(data);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = new URLSearchParams();
  const limit = searchParams.get('limit');
  const offset = searchParams.get('offset');
  if (limit) q.set('limit', limit);
  if (offset) q.set('offset', offset);
  const qs = q.toString();
  return proxy(`getSentNotifications${qs ? '?' + qs : ''}`);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const action = body?.action;
  delete body?.action;

  switch (action) {
    case 'send':
      return proxy('sendNotification', { method: 'POST', body: JSON.stringify(body) });
    case 'clearAll':
      return proxy('clearSentNotifications', { method: 'POST' });
    case 'deleteMany':
      return proxy('deleteNotifications', { method: 'POST', body: JSON.stringify(body) });
    case 'getLinkMetadata':
      return proxy('getLinkMetadata', { method: 'POST', body: JSON.stringify(body) });
    case 'uploadImage': {
      const { imageBase64 } = body;
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return NextResponse.json({ error: 'imageBase64 is required' }, { status: 400 });
      }
      const filename = `notifications/${Date.now()}.jpg`;
      const res = await fetch(`${STORAGE_BASE}/object/epg-images/${filename}`, {
        method: 'POST',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
        },
        body: Buffer.from(imageBase64, 'base64'),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        return NextResponse.json({ error: `upload failed ${res.status}: ${t.slice(0, 120)}` }, { status: 500 });
      }
      return NextResponse.json({ url: `${STORAGE_BASE}/object/public/epg-images/${filename}` });
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }
  return proxy(`deleteNotification?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}