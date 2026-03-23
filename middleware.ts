import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('firebaseToken'); // Assuming you store the Firebase ID token in a cookie

  if (!token) {
    if (request.nextUrl.pathname.startsWith('/home')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  // In a real application, you would verify the token here
  // and check the user's role. For this example, we'll assume
  // if a token exists, the user is authenticated.
  // You would typically make a server-side call to verify the token
  // and get the custom claims.

  // For now, we'll just allow access if a token exists.
  // This is NOT secure for production.
  if (request.nextUrl.pathname.startsWith('/login') && token) {
    return NextResponse.redirect(new URL('/home', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/home/:path*', '/login'],
};
