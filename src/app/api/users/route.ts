import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

/**
 * Proxies user-management ops to the mesh Go service (Supabase master,
 * Firebase Auth + Firestore mirror). Service-role key server-side.
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
    return NextResponse.json(data || { error: `users ${res.status}` }, { status: res.status });
  }
  return NextResponse.json(data);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = new URLSearchParams();
  const lastVisibleId = searchParams.get('lastVisibleId');
  const searchTerm = searchParams.get('searchTerm');
  if (lastVisibleId) q.set('lastVisibleId', lastVisibleId);
  if (searchTerm) q.set('searchTerm', searchTerm);
  const qs = q.toString();
  return proxy(`getUsersPaginated${qs ? '?' + qs : ''}`);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const action = body?.action;
  delete body?.action;

  switch (action) {
    case 'createUser':
      return proxy('createUser', { method: 'POST', body: JSON.stringify(body) });
    case 'updateUserRole':
      return proxy('updateUserRole', { method: 'POST', body: JSON.stringify(body) });
    case 'deleteUser':
      return proxy('deleteUser', { method: 'POST', body: JSON.stringify(body) });
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}