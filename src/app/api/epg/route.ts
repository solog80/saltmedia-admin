import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

/**
 * Proxies EPG operations to the cluster Go service. Reads are public;
 * writes (add/update/delete/invalidate) use the server-side service-role key.
 */

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
    return NextResponse.json(data || { error: `EPG ${res.status}` }, { status: res.status });
  }
  return NextResponse.json(data);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('search');
  if (q && q.trim()) {
    return proxy(`searchEpg?q=${encodeURIComponent(q.trim())}&limit=25`);
  }
  if (searchParams.get('admin') === '1') return proxy('getAdminEPGData');
  return proxy('getEPGData');
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const action = body?.action;
  delete body?.action;

  switch (action) {
    case 'addProgram':
      return proxy('addEPGProgram', { method: 'POST', body: JSON.stringify(body) });
    case 'updateProgram':
      return proxy('updateEPGProgram', { method: 'POST', body: JSON.stringify(body) });
    case 'deleteProgram':
      return proxy('deleteEPGProgram', { method: 'POST', body: JSON.stringify(body) });
    case 'invalidate':
      return proxy('invalidateEPGCache', { method: 'POST', body: '{}' });
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
