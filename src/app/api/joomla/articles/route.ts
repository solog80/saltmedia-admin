import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/firebaseAdmin";

const API_BASE = process.env.API_BASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

/** Proxies Joomla article ops to the mesh (cached reads + writes w/ invalidation). */

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
    return NextResponse.json(data || { error: `joomla articles ${res.status}` }, { status: res.status });
  }
  return NextResponse.json(data);
}

export async function GET(request: NextRequest) {
  const q = new URLSearchParams(request.nextUrl.searchParams.toString());
  return proxy(`getNewsArticles${q.toString() ? '?' + q.toString() : ''}`);
}

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies.get('firebaseToken')?.value);
  if (!session || !['admin', 'editor', 'moderator'].includes(session.role ?? '')) {
    return NextResponse.json({ error: 'Unauthorized: editor or admin access required' }, { status: 403 });
  }
  const body = await request.json();
  return proxy('createJoomlaArticle', { method: 'POST', body: JSON.stringify(body) });
}