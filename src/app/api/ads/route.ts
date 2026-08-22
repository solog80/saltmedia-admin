import { NextRequest, NextResponse } from 'next/server';

const REST_BASE = process.env.REST_BASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

/**
 * Proxies ads CRUD to the Supabase cluster's PostgREST API.
 * The service-role key lives server-side only (never shipped to the browser).
 * Admin reads intentionally use the raw `ads` table (service role bypasses RLS)
 * so all ads — including inactive/pending — are visible, matching the old
 * Firestore behavior.
 */

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
  if (!res.ok) {
    throw new Error(text || `PostgREST ${res.status}`);
  }
  return text;
}

// Ad camelCase -> PostgREST snake_case column map (all nullable fields).
const FIELD_MAP: Record<string, string> = {
  adName: 'ad_name',
  adType: 'ad_type',
  status: 'status',
  placementType: 'placement_type',
  targetingRules: 'targeting_rules',
  creativeUrl: 'creative_url',
  creativeType: 'creative_type',
  landingPageUrl: 'landing_page_url',
  durationSeconds: 'duration_seconds',
  vastTagUrl: 'vast_tag_url',
  vastWrapperLimit: 'vast_wrapper_limit',
  thumbnailUrl: 'thumbnail_url',
  midRollTriggerType: 'mid_roll_trigger_type',
  midRollTriggerValue: 'mid_roll_trigger_value',
  priority: 'priority',
  frequencyCap: 'frequency_cap',
  startDate: 'start_date',
  endDate: 'end_date',
};

// Flatten to snake_case; timestamps as ISO strings; drop undefined/empty.
function toRow(payload: Record<string, any>): Record<string, any> {
  const row: Record<string, any> = {};
  for (const [key, value] of Object.entries(payload)) {
    const col = FIELD_MAP[key];
    if (!col || value === undefined || value === null) continue;
    if (value instanceof Date) {
      row[col] = value.toISOString();
    } else if (key === 'placementType' && Array.isArray(value)) {
      row[col] = value;
    } else {
      row[col] = value;
    }
  }
  return row;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (id) {
      const body = await restFetch(`ads_api?select=*&id=eq.${encodeURIComponent(id)}`);
      const rows = JSON.parse(body);
      return NextResponse.json(rows);
    }
    const body = await restFetch('ads_api?select=*&order=priority.desc');
    return NextResponse.json(JSON.parse(body));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const row = toRow(payload);
    if (!row.ad_name || !Array.isArray(row.placement_type) || row.placement_type.length === 0) {
      return NextResponse.json({ error: 'adName and placementType are required' }, { status: 400 });
    }
    row.created_at = new Date().toISOString();
    row.updated_at = new Date().toISOString();

    // Prefer: return=representation gives back the inserted row (incl. id).
    const body = await restFetch('ads', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify([row]),
    });
    const created = JSON.parse(body);
    const ad = Array.isArray(created) ? created[0] : created;
    return NextResponse.json({ id: ad.id, ...ad }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
    }
    const payload = await request.json();
    const row = toRow(payload);
    row.updated_at = new Date().toISOString();

    await restFetch(`ads?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(row),
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
    }
    await restFetch(`ads?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
