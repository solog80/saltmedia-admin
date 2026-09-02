'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onIdTokenChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  role: string | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Refresh the httpOnly firebaseToken cookie whenever Firebase issues a fresh
  // ID token. ID tokens expire after ~1h, and server-side session checks
  // (verifySession in API routes) reject expired tokens, so we keep the cookie
  // in sync with the live token instead of relying on the one captured at login.
  const syncSessionCookie = async (u: User | null) => {
    setUser(u);
    if (u) {
      try {
        const token = await u.getIdToken();
        setRole((await u.getIdTokenResult()).claims.role as string || null);
        try {
          await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: token }),
          });
        } catch {
          // Non-fatal: cookie refresh is best-effort; the next onIdTokenChanged
          // or page load will retry.
        }
      } catch {
        setRole(null);
      }
    } else {
      setRole(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, (u) => {
      syncSessionCookie(u);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
