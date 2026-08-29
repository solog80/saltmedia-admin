import { NextRequest, NextResponse } from "next/server";

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
  const { id } = await params;
  const body = await request.json();
  return proxy(`updateJoomlaArticle?id=${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  return proxy(`deleteJoomlaArticle?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}