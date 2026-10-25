import { NextRequest, NextResponse } from 'next/server';

const REST_BASE = process.env.REST_BASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

const DEFAULTS = {
  liveAdsEnabled: true,
  liveIntervalMinutes: 30,
  liveMaxPerSession: 2,
  liveSkipAfterSeconds: 5,
  liveSkipMinDurationSeconds: 12,
};

async function restFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${REST_BASE}/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
    cache: 'no-store',
  });

  const text = await res.text();
  if (!res.ok) throw new Error(text || `PostgREST ${res.status}`);
  return text;
}

function toSettings(raw: Record<string, any> | null | undefined) {
  if (!raw) return DEFAULTS;
  return {
    liveAdsEnabled:
      typeof raw.live_ads_enabled === 'boolean'
        ? raw.live_ads_enabled
        : DEFAULTS.liveAdsEnabled,
    liveIntervalMinutes:
      Number(raw.live_interval_minutes) || DEFAULTS.liveIntervalMinutes,
    liveMaxPerSession:
      Number(raw.live_max_per_session) || DEFAULTS.liveMaxPerSession,
    liveSkipAfterSeconds:
      Number(raw.live_skip_after_seconds) || DEFAULTS.liveSkipAfterSeconds,
    liveSkipMinDurationSeconds:
      Number(raw.live_skip_min_duration_seconds) ||
      DEFAULTS.liveSkipMinDurationSeconds,
  };
}

export async function GET() {
  try {
    const body = await restFetch(
      'ad_settings?select=*&id=eq.global&limit=1',
    );
    const rows = JSON.parse(body);
    return NextResponse.json(toSettings(rows?.[0]));
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to load live ad settings' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = await request.json();
    const interval = Number(payload.liveIntervalMinutes);
    const maxPerSession = Number(payload.liveMaxPerSession);
    const skipAfter = Number(payload.liveSkipAfterSeconds);
    const skipMinDuration = Number(payload.liveSkipMinDurationSeconds);

    if (!Number.isFinite(interval) || interval < 5 || interval > 240) {
      return NextResponse.json(
        { error: 'Live interval must be between 5 and 240 minutes' },
        { status: 400 },
      );
    }
    if (
      !Number.isFinite(maxPerSession) ||
      maxPerSession < 1 ||
      maxPerSession > 10
    ) {
      return NextResponse.json(
        { error: 'Max per session must be between 1 and 10' },
        { status: 400 },
      );
    }
    if (!Number.isFinite(skipAfter) || skipAfter < 0 || skipAfter > 60) {
      return NextResponse.json(
        { error: 'Skip delay must be between 0 and 60 seconds' },
        { status: 400 },
      );
    }
    if (
      !Number.isFinite(skipMinDuration) ||
      skipMinDuration < 0 ||
      skipMinDuration > 120
    ) {
      return NextResponse.json(
        { error: 'Skip minimum duration must be between 0 and 120 seconds' },
        { status: 400 },
      );
    }

    await restFetch('ad_settings?id=eq.global', {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        live_ads_enabled: payload.liveAdsEnabled !== false,
        live_interval_minutes: Math.round(interval),
        live_max_per_session: Math.round(maxPerSession),
        live_skip_after_seconds: Math.round(skipAfter),
        live_skip_min_duration_seconds: Math.round(skipMinDuration),
        updated_at: new Date().toISOString(),
      }),
    });

    const body = await restFetch(
      'ad_settings?select=*&id=eq.global&limit=1',
    );
    const rows = JSON.parse(body);
    return NextResponse.json(toSettings(rows?.[0]));
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to save live ad settings' },
      { status: 500 },
    );
  }
}
