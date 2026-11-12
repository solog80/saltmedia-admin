import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const HLS_ORIGIN = process.env.HLS_ORIGIN || 'http://139.144.77.47:8081';

function rewritePlaylist(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const value = line.trim();
      if (!value || value.startsWith('#')) return line;
      if (/^https?:\/\//i.test(value)) {
        const url = new URL(value);
        return `/api/hls${url.pathname}${url.search}`;
      }
      if (value.startsWith('/')) return `/api/hls${value}`;
      return line;
    })
    .join('\n');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const pathname = path.join('/');
  if (!pathname || pathname.includes('..')) {
    return new NextResponse('Bad request', { status: 400 });
  }

  const upstreamUrl = new URL(pathname, `${HLS_ORIGIN.replace(/\/$/, '')}/`);
  upstreamUrl.search = request.nextUrl.search;

  try {
    let upstream = await fetch(upstreamUrl, {
      cache: 'no-store',
      headers: request.headers.get('range')
        ? { Range: request.headers.get('range') as string }
        : undefined,
    });

    // Nimble has used both playlist.m3u8 and index.m3u8 for HLS origins.
    if (!upstream.ok && pathname.endsWith('/playlist.m3u8')) {
      const fallbackUrl = new URL(
        pathname.replace(/playlist\.m3u8$/, 'index.m3u8'),
        `${HLS_ORIGIN.replace(/\/$/, '')}/`,
      );
      fallbackUrl.search = request.nextUrl.search;
      upstream = await fetch(fallbackUrl, { cache: 'no-store' });
    }

    if (!upstream.ok) {
      return new NextResponse(upstream.statusText, { status: upstream.status });
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (pathname.endsWith('.m3u8') || contentType.includes('mpegurl')) {
      const text = await upstream.text();
      return new NextResponse(rewritePlaylist(text), {
        status: upstream.status,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-store',
        },
      });
    }

    return new NextResponse(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: {
        'Content-Type':
          contentType || 'application/octet-stream',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new NextResponse('HLS origin unavailable', { status: 502 });
  }
}
