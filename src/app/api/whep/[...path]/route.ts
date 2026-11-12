import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const WHEP_ORIGIN = process.env.MEDIAMTX_WHEP_ORIGIN || 'http://139.144.77.47:8889';
const WHEP_PREFIX = '/api/whep';

function upstreamUrl(path: string[], search: string) {
  const url = new URL(path.join('/'), `${WHEP_ORIGIN.replace(/\/$/, '')}/`);
  url.search = search;
  return url;
}

async function proxy(request: NextRequest, path: string[]) {
  const pathname = path.join('/');
  if (!pathname || pathname.includes('..')) {
    return new NextResponse('Bad request', { status: 400 });
  }

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);
  const accept = request.headers.get('accept');
  if (accept) headers.set('Accept', accept);

  const body =
    request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS'
      ? undefined
      : await request.text();

  const upstream = await fetch(upstreamUrl(path, request.nextUrl.search), {
    method: request.method,
    headers,
    body,
    cache: 'no-store',
  });

  const responseHeaders = new Headers();
  const responseContentType = upstream.headers.get('content-type');
  if (responseContentType) responseHeaders.set('Content-Type', responseContentType);
  const link = upstream.headers.get('link');
  if (link) responseHeaders.set('Link', link);
  const location = upstream.headers.get('location');
  if (location) {
    const rewritten = location.startsWith(WHEP_ORIGIN)
      ? `${WHEP_PREFIX}${location.slice(WHEP_ORIGIN.length)}`
      : location;
    responseHeaders.set('Location', rewritten);
  }
  responseHeaders.set('Cache-Control', 'no-store');

  return new NextResponse(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, { params }: Context) {
  return proxy(request, (await params).path);
}
export async function POST(request: NextRequest, { params }: Context) {
  return proxy(request, (await params).path);
}
export async function PATCH(request: NextRequest, { params }: Context) {
  return proxy(request, (await params).path);
}
export async function DELETE(request: NextRequest, { params }: Context) {
  return proxy(request, (await params).path);
}
export async function OPTIONS(request: NextRequest, { params }: Context) {
  return proxy(request, (await params).path);
}
