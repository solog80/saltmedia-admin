import { NextRequest, NextResponse } from 'next/server';
import { purgeOnDemandCache } from '@/lib/newsCache';

const API_BASE = process.env.API_BASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

/**
 * Proxies on-demand operations to the cluster Go service. Reads are public;
 * writes (create/update/delete) use the server-side service-role key.
 */


async function proxy(
  path: string,
  init: RequestInit = {},
  purgeOnSuccess = false,
) {
  try {
    const res = await fetch(`${API_BASE}/${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        ...init.headers,
      },
      cache: 'no-store',
    });
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      return NextResponse.json(
        data || { error: text || `On-demand ${res.status}` },
        { status: res.status }
      );
    }
    if (purgeOnSuccess) {
      await purgeOnDemandCache();
    }
    return NextResponse.json(data);
  } catch (err: any) {
    console.error(`[api/ondemand] Proxy error for ${path}:`, err);
    return NextResponse.json(
      { error: `On-demand proxy error: ${err?.message || err}` },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode');
  const showId = searchParams.get('showId') || '';
  const seasonId = searchParams.get('seasonId') || '';
  const refresh = searchParams.get('refresh') === '1';

  if (mode === 'show') {
    return proxy('getOnDemandShowById', { method: 'POST', body: JSON.stringify({ showId }) });
  }
  if (mode === 'season') {
    return proxy('getOnDemandSeasonEpisodes', { method: 'POST', body: JSON.stringify({ showId, seasonId }) });
  }
  if (refresh) {
    return proxy('refreshOnDemandCache', { method: 'POST', body: '{}' }, true);
  }
  return proxy('getOnDemandData');
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const action = body?.action;
  delete body?.action;

  switch (action) {
    case 'createShow':
      return proxy('createOnDemandShow', { method: 'POST', body: JSON.stringify(body) }, true);
    case 'updateShow':
      return proxy('updateOnDemandShow', { method: 'POST', body: JSON.stringify(body) }, true);
    case 'deleteShow':
      return proxy('deleteOnDemandShow', { method: 'POST', body: JSON.stringify(body) }, true);
    case 'createSeason':
      return proxy('createOnDemandSeason', { method: 'POST', body: JSON.stringify(body) }, true);
    case 'updateSeason':
      return proxy('updateOnDemandSeason', { method: 'POST', body: JSON.stringify(body) }, true);
    case 'deleteSeason':
      return proxy('deleteOnDemandSeason', { method: 'POST', body: JSON.stringify(body) }, true);
    case 'updateEpisode':
      return proxy('updateOnDemandEpisode', { method: 'POST', body: JSON.stringify(body) }, true);
    case 'deleteEpisode':
      return proxy('deleteOnDemandEpisode', { method: 'POST', body: JSON.stringify(body) }, true);
    case 'createSfxEpisode':
      return proxy('createSfxEpisode', { method: 'POST', body: JSON.stringify(body) }, true);
    case 'createEpisodeFromBunnyUpload':
      return proxy('createEpisodeFromBunnyUpload', { method: 'POST', body: JSON.stringify(body) }, true);
    case 'getPlaybackUrl':
      return proxy('getEpisodePlaybackUrl', { method: 'POST', body: JSON.stringify(body) });
    case 'uploadPoster':
      return proxy('uploadShowPoster', { method: 'POST', body: JSON.stringify(body) }, true);
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
