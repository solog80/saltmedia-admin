import { NextRequest, NextResponse } from 'next/server';
import { firebaseAdmin, verifySession } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get('firebaseToken')?.value);
  if (!session || !['admin', 'moderator', 'editor'].includes(session.role ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = (await req.json()) as { id?: string; hlsUrl?: string };
    if (!body.id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const hlsUrl = typeof body.hlsUrl === 'string' ? body.hlsUrl.trim() : '';
    await firebaseAdmin.firestore().collection('broadcasts').doc(body.id).set(
      {
        hlsUrl,
        previewUpdatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({ success: true, id: body.id, hlsUrl });
  } catch (e) {
    return NextResponse.json({ error: `write failed: ${e}` }, { status: 502 });
  }
}
