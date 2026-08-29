'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user && !loading) {
      router.push('/home');
    }
  }, [user, loading, router]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Firebase sign-in OK, email:', userCredential.user.email);
      const idToken = await userCredential.user.getIdToken();
      console.log('ID token obtained');

      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      const data = await res.json();
      console.log('API /api/login responded:', res.status, data);

      if (!res.ok) {
        throw new Error(data.message || 'Unauthorized');
      }

      console.log('Login successful, redirecting based on role:', data.role);
      router.push(data.role === 'editor' ? '/news' : '/home');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      console.log('Google sign-in OK, email:', result.user.email);
      const idToken = await result.user.getIdToken();

      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      const data = await res.json();
      console.log('API /api/login responded:', res.status, data);

      if (!res.ok) {
        throw new Error(data.message || 'Unauthorized');
      }

      console.log('Google login successful, redirecting based on role:', data.role);
      router.push(data.role === 'editor' ? '/news' : '/home');
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 overflow-hidden"
      style={{
        backgroundImage: "url('/Dolmites.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="fixed inset-0 bg-black/20 pointer-events-none" />

      <div
        className="relative w-full max-w-md rounded-2xl border border-white/30 bg-white/10 p-8 shadow-2xl"
        style={{
          backdropFilter: 'blur(10px)',
        }}
      >
        <div className="flex flex-col items-center">
          {/* Logo */}
          <img
            src="/Salt_Media_App_Logo.png"
            alt="Salt Media Logo"
            className="mb-6 h-32"
          />

          {/* Title */}
          <h1 className="mb-6 text-center text-2xl font-bold text-white">
            Login Form
          </h1>

          {/* Form */}
          <form onSubmit={handleLogin} className="w-full space-y-4">
            {/* Email Field */}
            <div>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-gray-300 outline-none transition focus:border-white/40 focus:bg-white/20"
              />
            </div>

            {/* Password Field */}
            <div>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-gray-300 outline-none transition focus:border-white/40 focus:bg-white/20"
              />
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 text-white">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-white/30 bg-white/10 text-blue-600 accent-blue-600"
                />
                <span className="text-sm">Remember me</span>
              </label>
              <button
                type="button"
                className="text-sm text-white/80 hover:text-white transition"
              >
                Forgot password?
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-lg border border-red-400/50 bg-red-400/10 p-3 text-sm text-red-200">
                {error}
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg border border-blue-400 bg-blue-600 px-4 py-2.5 font-medium text-white transition enabled:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </button>

            {/* Google Sign In Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full rounded-lg border border-blue-400/30 bg-blue-500 px-4 py-2.5 font-medium text-white transition enabled:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              <img
                src="/google.svg"
                alt="Google"
                className="mr-2 h-5 w-5 invert"
              />
              Sign in with Google
            </button>
          </form>

          {/* Register Link */}
          <div className="mt-6 flex items-center justify-center space-x-1 text-sm text-white">
            <span>Don't have an account?</span>
            <button className="text-white hover:underline transition">
              Register
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
