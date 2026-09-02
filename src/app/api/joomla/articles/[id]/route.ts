import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/firebaseAdmin";

const API_BASE = process.env.API_BASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

/** Proxies single-article Joomla ops to the mesh (cached reads + writes w/ invalidation). */

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
    return NextResponse.json(data || { error: `joomla article ${res.status}` }, { status: res.status });
  }
  return NextResponse.json(data);
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  return proxy(`getNewsArticle?id=${encodeURIComponent(id)}`);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const session = await verifySession(request.cookies.get('firebaseToken')?.value);
  if (!session || !['admin', 'editor', 'moderator'].includes(session.role ?? '')) {
    return NextResponse.json({ error: 'Unauthorized: editor or admin access required' }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json();
  return proxy(`updateJoomlaArticle?id=${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const session = await verifySession(request.cookies.get('firebaseToken')?.value);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized: only admins can delete articles' }, { status: 403 });
  }
  const { id } = await params;
  return proxy(`deleteJoomlaArticle?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}