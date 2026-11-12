import { NextRequest, NextResponse } from 'next/server';
import { firebaseAdmin, verifySession } from '@/lib/firebaseAdmin';
import { hashPassword, MEDIAMTX_MAX_VIEWERS, MEDIAMTX_USERS_COLLECTION } from '@/lib/mediamtxAuth';

export const dynamic = 'force-dynamic';

async function requireAdmin(request: NextRequest) {
  const session = await verifySession(request.cookies.get('firebaseToken')?.value);
  return session?.role === 'admin' ? session : null;
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const snap = await firebaseAdmin.firestore().collection(MEDIAMTX_USERS_COLLECTION).get();
  const items = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      username: data.username,
      enabled: data.enabled !== false,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
    };
  });
  return NextResponse.json({ items, max: MEDIAMTX_MAX_VIEWERS });
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const username = body.username?.trim() || '';
  const password = body.password || '';
  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
    return NextResponse.json({ error: 'Username must be 3-32 characters (letters, numbers, . _ -)' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const col = firebaseAdmin.firestore().collection(MEDIAMTX_USERS_COLLECTION);
  const existing = await col.where('username', '==', username).limit(1).get();
  if (!existing.empty) {
    return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
  }

  const all = await col.get();
  if (all.size >= MEDIAMTX_MAX_VIEWERS) {
    return NextResponse.json({ error: `Limit of ${MEDIAMTX_MAX_VIEWERS} viewers reached` }, { status: 409 });
  }

  const { salt, hash } = hashPassword(password);
  const ref = await col.add({
    username,
    salt,
    hash,
    enabled: true,
    createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
    createdBy: session.uid,
  });

  return NextResponse.json({ id: ref.id, username });
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  await firebaseAdmin.firestore().collection(MEDIAMTX_USERS_COLLECTION).doc(body.id).delete();
  return NextResponse.json({ success: true });
}
