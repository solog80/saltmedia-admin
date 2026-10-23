import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebaseAdmin';

const BFF_URL = process.env.RADIO_BFF_URL || 'https://edge.solofx.net';
const CONTROL_KEY = process.env.RADIO_CONTROL_KEY || '';

export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get('firebaseToken')?.value);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  if (!CONTROL_KEY) {
    return NextResponse.json(
      { error: 'RADIO_CONTROL_KEY is not configured' },
      { status: 500 },
    );
  }
  const body = await req.json().catch(() => ({}));
  const channel = typeof body.channel === 'string' ? body.channel : '';
  const muted = body.muted === true;
  if (!channel) {
    return NextResponse.json({ error: 'channel required' }, { status: 400 });
  }
  try {
    const res = await fetch(`${BFF_URL}/api/v1/bff/radio/mute`, {
      method: 'POST',
      headers: {
        'x-radio-key': CONTROL_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ channel, muted }),
      cache: 'no-store',
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Radio mute failed: ${e}` },
      { status: 502 },
    );
  }
}
