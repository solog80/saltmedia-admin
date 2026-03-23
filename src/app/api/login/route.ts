import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (!user) {
      return NextResponse.json({ message: 'Authentication failed.' }, { status: 401 });
    }

    const idTokenResult = await user.getIdTokenResult();
    const role = idTokenResult.claims.role;

    if (role === 'admin') {
      const response = NextResponse.json({ message: 'Login successful', role: 'admin' });
      response.cookies.set('firebaseToken', idTokenResult.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24, // 1 day
        path: '/',
      });
      return response;
    } else {
      return NextResponse.json({ message: 'Unauthorized', role: role }, { status: 403 });
    }
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
