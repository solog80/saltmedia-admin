'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ThemeSelector } from '../components/ThemeSelector';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); // Clear previous errors

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.role === 'admin') {
          router.push('/home');
        } else {
          setError('You do not have admin privileges.');
        }
      } else {
        setError(data.message || 'Login failed.');
      }
    } catch (err: any) {
      console.error('Client-side login error:', err);
      setError(err.message || 'An unexpected error occurred.');
    }
  };

  return (
    <div className='relative flex items-center justify-center min-h-screen bg-background'>
      <div className='absolute top-4 right-4'>
        <ThemeSelector />
      </div>
      <div className='w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800'>
        <h1 className='text-2xl font-bold text-center text-foreground'>Login</h1>
        <form className='space-y-6' onSubmit={handleLogin}>
          <div>
            <label
              htmlFor='email'
              className='block text-sm font-medium text-foreground'
            >
              Email
            </label>
            <input
              id='email'
              name='email'
              type='email'
              required
              className='w-full px-3 py-2 mt-1 border rounded-md shadow-sm bg-background text-foreground focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor='password'
              className='block text-sm font-medium text-foreground'
            >
              Password
            </label>
            <input
              id='password'
              name='password'
              type='password'
              required
              className='w-full px-3 py-2 mt-1 border rounded-md shadow-sm bg-background text-foreground focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <button
              type='submit'
              className='w-full px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md shadow-sm btn-primary hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'
            >
              Login
            </button>
          </div>
          {error && <p className='text-red-500 text-sm mt-2'>{error}</p>}
        </form>
      </div>
    </div>
  );
}
