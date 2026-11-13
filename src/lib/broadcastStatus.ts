import { listMediaMtxPaths } from './mediamtxApi';

const REST_BASE = (process.env.REST_BASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SERVICE_ROLE_KEY || '';

type StatusRow = {
  user_id: string;
  stream_url?: string | null;
  is_live?: boolean;
  last_seen?: string | null;
};

function headers(): HeadersInit {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
}

export function broadcastPathFromStreamUrl(raw?: string | null): string | null {
  if (!raw?.startsWith('srt://')) return null;
  try {
    const url = new URL(raw.replace(/^srt:/, 'http:'));
    const streamId = url.searchParams.get('streamid') || '';
    const match = streamId.match(/^(?:publish|read):([^:&]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function readRows(): Promise<StatusRow[]> {
  if (!REST_BASE || !SERVICE_KEY) return [];
  const res = await fetch(`${REST_BASE}/broadcast_status?select=user_id,stream_url,is_live,last_seen&limit=1000`, {
    headers: headers(),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`status read failed: ${res.status}`);
  return (await res.json()) as StatusRow[];
}

async function patchRow(userId: string, live: boolean) {
  const now = new Date().toISOString();
  const res = await fetch(`${REST_BASE}/broadcast_status?user_id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ is_live: live, last_seen: now, updated_at: now }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`status patch failed: ${res.status}`);
}

async function applyReadyPaths(ready: Map<string, boolean>) {
  const rows = await readRows();
  await Promise.all(rows.map(async (row) => {
    const path = broadcastPathFromStreamUrl(row.stream_url);
    if (!path || !ready.has(path)) return;
    const isLive = ready.get(path) === true;
    const seen = row.last_seen ? new Date(row.last_seen).getTime() : 0;
    const stale = Date.now() - seen > 45_000;
    if (row.is_live !== isLive || stale) await patchRow(row.user_id, isLive);
  }));
}

export async function syncBroadcastStatusFromMediaMtx() {
  const items = await listMediaMtxPaths();
  const ready = new Map<string, boolean>();
  for (const item of items) {
    if (typeof item?.name === 'string') ready.set(item.name, item.ready === true);
  }
  await applyReadyPaths(ready);
  return ready;
}

export async function applyMediaMtxHook(path: string, event: string) {
  if (!path || path.endsWith('_whep')) return;
  if (!['ready', 'notready', 'unpublish'].includes(event)) return;
  await applyReadyPaths(new Map([[path, event === 'ready']]));
}
