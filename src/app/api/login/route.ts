import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();
    if (!idToken) {
      console.log('API login: No token provided');
      return NextResponse.json({ message: 'No token provided' }, { status: 400 });
    }

    console.log('API login: Verifying ID token...');
    const decoded = await admin.auth().verifyIdToken(idToken);
    console.log('API login: Token verified, uid:', decoded.uid, 'role:', decoded.role);

    const role = decoded.role;

    if (role !== 'admin' && role !== 'moderator') {
      console.log('API login: Unauthorized role:', role);
      return NextResponse.json({ message: 'Unauthorized - user role is not admin or moderator', role: role || 'none' }, { status: 403 });
    }

    const response = NextResponse.json({ message: 'Login successful', role: 'admin' });
    response.cookies.set('firebaseToken', idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    });
    console.log('API login: Cookie set, returning success');
    return response;
  } catch (error: any) {
    console.error('API login error:', error.message, error.stack);
    return NextResponse.json({ message: 'Server error: ' + error.message }, { status: 500 });
  }
}
