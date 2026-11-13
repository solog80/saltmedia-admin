import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebaseAdmin';
import { readBroadcastStatusRows, syncBroadcastStatusFromMediaMtx } from '@/lib/broadcastStatus';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get('firebaseToken')?.value);
  if (!session || !['admin', 'moderator', 'editor'].includes(session.role ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  try {
    await syncBroadcastStatusFromMediaMtx();
    const items = await readBroadcastStatusRows();
    return NextResponse.json({ success: true, items });
  } catch (e) {
    return NextResponse.json({ error: `sync failed: ${e}` }, { status: 502 });
  }
}
