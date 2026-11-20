import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

const MAILADMIN_URL = process.env.MAILADMIN_URL || '';
const MAILADMIN_TOKEN = process.env.MAILADMIN_TOKEN || '';

async function requireAdmin(request: NextRequest) {
  const session = await verifySession(request.cookies.get('firebaseToken')?.value);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  return null;
}

async function mailAdmin(path: string, init: RequestInit = {}) {
  if (!MAILADMIN_URL || !MAILADMIN_TOKEN) {
    throw new Error('mail admin API is not configured');
  }
  const res = await fetch(`${MAILADMIN_URL.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MAILADMIN_TOKEN}`,
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  return { res, data };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> },
) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const { email } = await params;
    const body = await request.json();
    const { res, data } = await mailAdmin(`/accounts/${encodeURIComponent(email)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: `${e}` }, { status: 502 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> },
) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const { email } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = body.action;
    if (action === 'password') {
      const { res, data } = await mailAdmin(`/accounts/${encodeURIComponent(email)}/password`, {
        method: 'POST',
        body: JSON.stringify({ password: body.password }),
      });
      return NextResponse.json(data, { status: res.status });
    }
    if (action === 'avatar') {
      const { res, data } = await mailAdmin(`/accounts/${encodeURIComponent(email)}/avatar`, {
        method: 'POST',
        body: JSON.stringify({ image: body.image }),
      });
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: `${e}` }, { status: 502 });
  }
}
