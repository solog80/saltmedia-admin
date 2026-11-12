import { NextRequest, NextResponse } from 'next/server';
import { firebaseAdmin, verifySession } from '@/lib/firebaseAdmin';
import { addMediaMtxPath, deleteMediaMtxPath, getMediaMtxPath } from '@/lib/mediamtxApi';

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
  const streamId = `publish:${path}`;
  const query = [
    `streamid=${streamId}`,
    `passphrase=${encodeURIComponent(passphrase)}`,
    'pbkeylen=16',
  ].join('&');
  return `srt://${SRT_HOST}:${SRT_PORT}?${query}`;
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
      link: String(data.link || '').replace('streamid=publish%3A', 'streamid=publish:'),
      managedPath: data.managedPath === true,
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

  let managedPath = false;
  try {
    const existing = await getMediaMtxPath(path);
    if (existing.status === 404) {
      const created = await addMediaMtxPath(path, passphrase);
      if (!created.ok) {
        const detail = await created.text();
        return NextResponse.json({ error: `MediaMTX path creation failed: ${detail || created.status}` }, { status: 502 });
      }
      managedPath = true;
    } else if (!existing.ok) {
      return NextResponse.json({ error: `MediaMTX path lookup failed: ${existing.status}` }, { status: 502 });
    }
  } catch (e) {
    return NextResponse.json({ error: `MediaMTX unavailable: ${e}` }, { status: 502 });
  }

  const link = buildLink(path, passphrase);
  const ref = await col.add({
    name,
    path,
    link,
    managedPath,
    createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
    createdBy: session.uid,
  });

  return NextResponse.json({ id: ref.id, name, path, link, managedPath });
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

  const doc = await firebaseAdmin.firestore().collection(COLLECTION).doc(body.id).get();
  if (!doc.exists) {
    return NextResponse.json({ error: 'Link not found' }, { status: 404 });
  }

  const data = doc.data() || {};
  if (data.managedPath === true && data.path) {
    try {
      const removed = await deleteMediaMtxPath(String(data.path));
      if (!removed.ok && removed.status !== 404) {
        return NextResponse.json({ error: `MediaMTX path removal failed: ${removed.status}` }, { status: 502 });
      }
    } catch (e) {
      return NextResponse.json({ error: `MediaMTX unavailable: ${e}` }, { status: 502 });
    }
  }

  await doc.ref.delete();
  return NextResponse.json({ success: true });
}
