import { NextRequest, NextResponse } from 'next/server';
import { firebaseAdmin } from '@/lib/firebaseAdmin';
import { isStaff } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isStaff(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const snap = await firebaseAdmin
    .firestore()
    .collection('broadcasts')
    .orderBy('lastSeen', 'desc')
    .get();

  const items = snap.docs.map((doc) => {
    const data = doc.data();
    const lastSeen = data.lastSeen?.toDate?.();
    return {
      id: doc.id,
      ...data,
      lastSeen: undefined,
      lastSeenMs: lastSeen ? lastSeen.getTime() : null,
    };
  });

  return NextResponse.json({ items });
}
