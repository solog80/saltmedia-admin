import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export const firebaseAdmin = admin;

export interface SessionUser {
  uid: string;
  email?: string;
  role?: string;
}

/**
 * Verifies the Firebase ID token from the httpOnly cookie and returns the
 * decoded session (uid/email/role). Returns null when absent or invalid.
 */
export async function verifySession(token?: string): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email ?? undefined,
      role: (decoded.role as string) ?? undefined,
    };
  } catch {
    return null;
  }
}
