import { createHmac } from 'crypto';

const API_BASE = (process.env.MEDIAMTX_API_ORIGIN || 'http://139.144.77.47:9997').replace(/\/$/, '');
const API_USER = process.env.MEDIAMTX_API_USER || 'dashboard';

export function mediaMtxApiPassword(): string {
  const secret = process.env.SERVICE_ROLE_KEY || '';
  return createHmac('sha256', secret).update('mediamtx-api').digest('hex');
}

export function mediaMtxHeaders(): HeadersInit {
  return {
    Authorization: `Basic ${Buffer.from(`${API_USER}:${mediaMtxApiPassword()}`).toString('base64')}`,
    'Content-Type': 'application/json',
  };
}

export async function getMediaMtxPath(name: string): Promise<Response> {
  return fetch(`${API_BASE}/v3/config/paths/get/${encodeURIComponent(name)}`, {
    headers: mediaMtxHeaders(),
    cache: 'no-store',
  });
}

export async function addMediaMtxPath(name: string, passphrase: string): Promise<Response> {
  return fetch(`${API_BASE}/v3/config/paths/add/${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: mediaMtxHeaders(),
    body: JSON.stringify({ source: 'publisher', srtPublishPassphrase: passphrase }),
    cache: 'no-store',
  });
}

export async function deleteMediaMtxPath(name: string): Promise<Response> {
  return fetch(`${API_BASE}/v3/config/paths/delete/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers: mediaMtxHeaders(),
    cache: 'no-store',
  });
}

export async function listMediaMtxPaths(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/v3/paths/list`, {
    headers: mediaMtxHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`MediaMTX paths failed: ${res.status}`);
  const body = await res.json();
  return Array.isArray(body?.items) ? body.items : [];
}
