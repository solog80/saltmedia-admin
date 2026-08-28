import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

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
    case 'getLinkMetadata':
      return proxy('getLinkMetadata', { method: 'POST', body: JSON.stringify(body) });
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}