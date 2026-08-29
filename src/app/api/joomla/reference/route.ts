import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_BASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

/** Proxies Joomla reference data (categories/authors/tags) to the mesh (cached). */

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type') || 'categories';
  const res = await fetch(`${API_BASE}/getJoomlaReference?type=${encodeURIComponent(type)}`, {
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    cache: 'no-store',
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    return NextResponse.json(data || { error: `joomla reference ${res.status}` }, { status: res.status });
  }
  return NextResponse.json(data);
}