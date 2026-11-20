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

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const { res, data } = await mailAdmin('/accounts');
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: `${e}` }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = body.action;
    delete body.action;

    if (action === 'create') {
      const { res, data } = await mailAdmin('/accounts', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return NextResponse.json(data, { status: res.status });
    }

    if (action === 'preview') {
      const { res, data } = await mailAdmin('/preview', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: `${e}` }, { status: 502 });
  }
}
