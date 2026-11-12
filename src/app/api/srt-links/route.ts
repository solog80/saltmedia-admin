import { NextRequest, NextResponse } from 'next/server';
import { firebaseAdmin, verifySession } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

const COLLECTION = 'srt_links';
const MAX_LINKS = 10;
const SRT_HOST = process.env.SRT_LINK_HOST || '139.144.77.47';
const SRT_PORT = process.env.SRT_LINK_PORT || '7105';

async function requireAdmin(request: NextRequest) {
  const session = await verifySession(request.cookies.get('firebaseToken')?.value);
  return session?.role === 'admin' ? session : null;
}

function buildLink(path: string, passphrase: string) {
  const query = new URLSearchParams({
    streamid: `publish:${path}`,
    passphrase,
    pbkeylen: '16',
  });
  return `srt://${SRT_HOST}:${SRT_PORT}?${query.toString()}`;
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const snap = await firebaseAdmin.firestore().collection(COLLECTION).orderBy('createdAt', 'desc').get();
  const items = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      path: data.path,
      link: data.link,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
    };
  });
  return NextResponse.json({ items, max: MAX_LINKS });
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: { name?: string; path?: string; passphrase?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const name = body.name?.trim() || '';
  const path = body.path?.trim() || '';
  const passphrase = body.passphrase || '';

  if (!name || name.length > 64) {
    return NextResponse.json({ error: 'Name is required (max 64 characters)' }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9._-]{1,64}$/.test(path)) {
    return NextResponse.json({ error: 'Path may contain letters, numbers, . _ -' }, { status: 400 });
  }
  if (passphrase.length < 10 || passphrase.length > 79) {
    return NextResponse.json({ error: 'Passphrase must be 10-79 characters' }, { status: 400 });
  }

  const col = firebaseAdmin.firestore().collection(COLLECTION);
  const all = await col.get();
  if (all.size >= MAX_LINKS) {
    return NextResponse.json({ error: `Limit of ${MAX_LINKS} SRT links reached` }, { status: 409 });
  }

  const link = buildLink(path, passphrase);
  const ref = await col.add({
    name,
    path,
    link,
    createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
    createdBy: session.uid,
  });

  return NextResponse.json({ id: ref.id, name, path, link });
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

  await firebaseAdmin.firestore().collection(COLLECTION).doc(body.id).delete();
  return NextResponse.json({ success: true });
}
