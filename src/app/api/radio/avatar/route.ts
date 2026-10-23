import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebaseAdmin';

const API_BASE = (process.env.API_BASE_URL || '').replace(/\/$/, '');
const REST_URL = (process.env.REST_BASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SERVICE_ROLE_KEY || '';
const MAX_BYTES = 8 * 1024 * 1024;

function meshHeaders() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
  };
}

/**
 * Upload a custom presenter photo to the S3/media library and store it in
 * `broadcast_config.radio.avatarUrl` for the SIP line's user. Google sign-in
 * photos remain the default; a custom photo overrides when present.
 */
export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get('firebaseToken')?.value);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  if (!API_BASE || !REST_URL || !SERVICE_KEY) {
    return NextResponse.json(
      { error: 'storage is not configured' },
      { status: 500 },
    );
  }

  try {
    const form = await req.formData();
    const file = form.get('file');
    const extension = String(form.get('extension') || '').trim();

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(extension)) {
      return NextResponse.json(
        { error: 'valid extension is required' },
        { status: 400 },
      );
    }

    const blob = file as unknown as Blob;
    if (blob.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'image is too large (max 8 MB)' },
        { status: 413 },
      );
    }
    if (blob.type && !blob.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'file must be an image' },
        { status: 415 },
      );
    }

    // Find the broadcast_config row whose radio line uses this extension.
    const cfgRes = await fetch(
      `${REST_URL}/broadcast_config?select=user_id,radio`,
      { headers: meshHeaders(), cache: 'no-store' },
    );
    const rows = (await cfgRes.json().catch(() => [])) as Array<{
      user_id: string;
      radio?: Record<string, unknown>;
    }>;
    const row = rows.find((r) => {
      const radio = r.radio || {};
      return [radio.extension, radio.username].some(
        (v) =>
          typeof v === 'string' &&
          v.trim().toLowerCase() === extension.toLowerCase(),
      );
    });
    if (!cfgRes.ok || !row) {
      return NextResponse.json(
        { error: `No radio line found for extension "${extension}"` },
        { status: 404 },
      );
    }

    const fd = new FormData();
    fd.append(
      'file',
      new Blob([new Uint8Array(await blob.arrayBuffer())], {
        type: blob.type || 'image/jpeg',
      }),
      (file as { name?: string }).name || `${extension}.jpg`,
    );
    fd.append('scope', 'radio-avatars');
    fd.append('folder', extension);

    const upload = await fetch(`${API_BASE}/uploadImage`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_KEY}` },
      body: fd,
      cache: 'no-store',
    });
    const uploaded = await upload.json().catch(() => ({}));
    if (!upload.ok) {
      return NextResponse.json(
        { error: uploaded?.error || `Upload failed (${upload.status})` },
        { status: upload.status },
      );
    }
    const url = uploaded?.url || uploaded?.publicUrl;
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'upload did not return a URL' },
        { status: 502 },
      );
    }

    const radio = { ...(row.radio || {}), avatarUrl: url };
    const save = await fetch(
      `${REST_URL}/broadcast_config?user_id=eq.${encodeURIComponent(row.user_id)}`,
      {
        method: 'PATCH',
        headers: {
          ...meshHeaders(),
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ radio }),
        cache: 'no-store',
      },
    );
    if (!save.ok) {
      const detail = await save.text().catch(() => '');
      return NextResponse.json(
        { error: `Avatar uploaded but config update failed: ${detail}` },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, extension, url }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: `Avatar upload failed: ${e}` },
      { status: 500 },
    );
  }
}
