import { NextRequest, NextResponse } from 'next/server';
import { applyMediaMtxHook } from '@/lib/broadcastStatus';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const expected = process.env.MEDIAMTX_HOOK_SECRET || '';
  const supplied = req.headers.get('x-mtx-hook-secret') || '';
  if (!expected || supplied !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = (await req.json()) as { event?: string; path?: string };
    await applyMediaMtxHook(body.path || '', body.event || '');
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: `hook failed: ${e}` }, { status: 500 });
  }
}
