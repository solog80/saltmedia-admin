import { NextRequest, NextResponse } from 'next/server';
import { findMediaMtxUser, isPreviewToken, verifyPassword } from '@/lib/mediamtxAuth';

export const dynamic = 'force-dynamic';

type AuthBody = {
  user?: string;
  password?: string;
  token?: string;
  action?: string;
  protocol?: string;
};

export async function POST(request: NextRequest) {
  let body: AuthBody;
  try {
    body = (await request.json()) as AuthBody;
  } catch {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }

  const action = body.action || '';
  const protocol = body.protocol || '';

  if (protocol === 'srt') {
    return new NextResponse(null, { status: 204 });
  }

  if (isPreviewToken(body.token)) {
    if (['read', 'playback', 'api'].includes(action)) {
      return new NextResponse(null, { status: 204 });
    }
    return new NextResponse(null, { status: 403 });
  }

  if (action !== 'read' && action !== 'playback') {
    return new NextResponse(null, { status: 403 });
  }

  if (!body.user || !body.password) {
    return new NextResponse(null, { status: 401 });
  }

  const doc = await findMediaMtxUser(body.user);
  if (!doc) {
    return new NextResponse(null, { status: 401 });
  }

  const data = doc.data();
  if (data.enabled === false || !verifyPassword(body.password, String(data.salt || ''), String(data.hash || ''))) {
    return new NextResponse(null, { status: 401 });
  }

  return new NextResponse(null, { status: 204 });
}
