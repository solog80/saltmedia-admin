import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = ['/login', '/api/login', '/_next', '/favicon.ico', '/Salt_Media_App_Logo.png', '/Dolmites.jpg', '/google.svg'];
const moderatorAllowed = ['/ondemand', '/api', '/home', '/login', '/news'];

function decodeToken(token: string) {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return decoded;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicPaths.some(p => pathname.startsWith(p))) {
    if (pathname.startsWith('/login')) {
      const token = request.cookies.get('firebaseToken');
      if (token) {
        return NextResponse.redirect(new URL('/home', request.url));
      }
    }
    return NextResponse.next();
  }

  const tokenCookie = request.cookies.get('firebaseToken');
  if (!tokenCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const decoded = decodeToken(tokenCookie.value);
  const role = decoded?.role;

  if (role === 'moderator') {
    const allowed = moderatorAllowed.some(p => pathname.startsWith(p));
    if (!allowed) {
      return NextResponse.redirect(new URL('/ondemand', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
