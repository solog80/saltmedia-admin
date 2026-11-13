import { listMediaMtxPaths } from './mediamtxApi';

const REST_BASE = (process.env.REST_BASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SERVICE_ROLE_KEY || '';

type StatusRow = {
  user_id: string;
  stream_url?: string | null;
  is_live?: boolean;
  last_seen?: string | null;
};

type ConfigRow = {
  user_id: string;
  tv?: { destinations?: Array<Record<string, any>> } | null;
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

export async function readBroadcastStatusRows(): Promise<StatusRow[]> {
  if (!REST_BASE || !SERVICE_KEY) return [];
  const res = await fetch(`${REST_BASE}/broadcast_status?select=user_id,stream_url,is_live,last_seen&limit=1000`, {
    headers: headers(),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`status read failed: ${res.status}`);
  return (await res.json()) as StatusRow[];
}

async function readConfigs(): Promise<ConfigRow[]> {
  if (!REST_BASE || !SERVICE_KEY) return [];
  const res = await fetch(`${REST_BASE}/broadcast_config?select=user_id,tv&limit=1000`, {
    headers: headers(),
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return (await res.json()) as ConfigRow[];
}

function destinationPath(config: ConfigRow | undefined): string | null {
  for (const dest of config?.tv?.destinations || []) {
    const streamId = String(dest.streamId || '');
    const match = streamId.match(/^publish:([^:&]+)/);
    if (match) return match[1];
  }
  return null;
}

function rowPath(row: StatusRow, configs: Map<string, ConfigRow>): string | null {
  const direct = broadcastPathFromStreamUrl(row.stream_url);
  if (direct) return direct;
  return destinationPath(configs.get(row.user_id));
}

async function patchRow(userId: string, live: boolean, streamUrl?: string) {
  const now = new Date().toISOString();
  const body: Record<string, unknown> = { is_live: live, last_seen: now, updated_at: now };
  if (streamUrl) body.stream_url = streamUrl;
  const res = await fetch(`${REST_BASE}/broadcast_status?user_id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`status patch failed: ${res.status}`);
}

async function applyReadyPaths(ready: Map<string, boolean>) {
  const [rows, configRows] = await Promise.all([readBroadcastStatusRows(), readConfigs()]);
  const configs = new Map(configRows.map((config) => [config.user_id, config]));
  await Promise.all(rows.map(async (row) => {
    const path = rowPath(row, configs);
    if (!path || !ready.has(path)) return;
    const isLive = ready.get(path) === true;
    const seen = row.last_seen ? new Date(row.last_seen).getTime() : 0;
    const stale = Date.now() - seen > 45_000;
    const missingUrl = !row.stream_url && destinationPath(configs.get(row.user_id));
    if (row.is_live !== isLive || stale || missingUrl) {
      let streamUrl: string | undefined;
      if (missingUrl) {
        const dest = (configs.get(row.user_id)?.tv?.destinations || []).find((d) => {
          const sid = String(d.streamId || '');
          return sid.match(/^publish:([^:&]+)/)?.[1] === path;
        });
        if (dest?.host && dest?.port) {
          streamUrl = `srt://${dest.host}:${dest.port}?streamid=publish:${path}`;
        }
      }
      await patchRow(row.user_id, isLive, streamUrl);
    }
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
