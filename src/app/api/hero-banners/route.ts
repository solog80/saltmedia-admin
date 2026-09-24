import { NextRequest, NextResponse } from 'next/server';

const MESH_API_URL = process.env.REST_BASE_URL || process.env.NEXT_PUBLIC_MESH_API_URL || 'https://edge.solofx.net/rest/v1';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODczMzYyOTQsImV4cCI6MTk0NTAxNjI5NH0.ahzM4MIlGI6rkukPDvIQH0HkPx4dU95Pdn-Ewl-9C4s';
const ANON_KEY = process.env.NEXT_PUBLIC_MESH_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg3MzM2Mjk0LCJleHAiOjE5NDUwMTYyOTR9.9YCCl_oRCYHQIR3eAhUeLF-SiBqGIxaT9WqCS-YFtNw';

export async function GET() {
  try {
    const res = await fetch(`${MESH_API_URL}/rpc/get_hero_banners`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const items = Array.isArray(body) ? body : [body];
    const payload = items.map((item: any) => ({
      id: item.id,
      title: item.title,
      description: item.description || '',
      image_url: item.image_url || item.imageUrl || '',
      video_url: item.video_url || item.videoUrl || null,
      show_name: item.show_name || item.showName || null,
      show_id: item.show_id || item.showId || null,
      platform: item.platform || null,
      days: item.days || '',
      active: item.active !== false,
      position: item.position ?? item.order ?? 0,
    }));

    const res = await fetch(`${MESH_API_URL}/hero_banners?on_conflict=id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Hero Banners API] Save failed ${res.status}:`, errText);
      return NextResponse.json({ error: errText }, { status: res.status });
    }

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
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    const res = await fetch(`${MESH_API_URL}/hero_banners?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
