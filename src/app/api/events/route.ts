import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

/** Proxies events CRUD to the cluster Go service (service-role key server-side). */
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
    return NextResponse.json(data || { error: `Events ${res.status}` }, { status: res.status });
  }
  return NextResponse.json(data);
}

export async function GET() {
  return proxy('getEvents');
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const action = body?.action;
  delete body?.action;

  switch (action) {
    case 'add':
      return proxy('addEvent', { method: 'POST', body: JSON.stringify(body) });
    case 'update':
      return proxy('updateEvent', { method: 'POST', body: JSON.stringify(body) });
    case 'delete':
      return proxy('deleteEvent', { method: 'POST', body: JSON.stringify(body) });
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
