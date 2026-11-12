'use client';

import { useCallback, useEffect, useState } from 'react';
import BroadcastTabs from '../BroadcastTabs';

type Viewer = {
  id: string;
  username: string;
  enabled: boolean;
  createdAt?: string | null;
};

export default function StreamViewersPage() {
  const [items, setItems] = useState<Viewer[]>([]);
  const [max, setMax] = useState(10);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/mediamtx/users', { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Unable to load viewers');
      return;
    }
    setItems(data.items || []);
    setMax(data.max || 10);
    setError('');
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createViewer(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/mediamtx/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unable to create viewer');
        return;
      }
      setUsername('');
      setPassword('');
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function removeViewer(id: string) {
    if (!confirm('Delete this viewer?')) return;
    const res = await fetch('/api/mediamtx/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Unable to delete viewer');
      return;
    }
    await load();
  }

  return (
    <div className="p-6 space-y-6">
      <BroadcastTabs />
      <div>
        <h1 className="text-2xl font-bold text-white">WHEP Viewers</h1>
        <p className="text-sm text-white/50">
          Dashboard-managed credentials for direct WHEP playback. SRT publishing still uses its path passphrases.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-white">Viewer accounts</h2>
            <span className="text-xs text-white/50">{items.length}/{max}</span>
          </div>
          {error && <p className="mb-3 text-sm text-red-300">{error}</p>}
          <div className="divide-y divide-white/10">
            {items.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/40">No viewer accounts yet.</p>
            ) : items.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-mono text-sm text-white">{item.username}</p>
                  <p className="text-xs text-white/40">
                    {item.enabled ? 'Active' : 'Disabled'}
                    {item.createdAt ? ` · ${new Date(item.createdAt).toLocaleString()}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => removeViewer(item.id)}
                  className="rounded border border-red-400/30 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-400/10"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </section>

        <form onSubmit={createViewer} className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <h2 className="font-semibold text-white">Create viewer</h2>
          <p className="text-xs text-white/40">
            Use these credentials with the WHEP player or direct WHEP URL. Passwords are stored hashed.
          </p>
          <label className="block text-sm text-white/70">
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded border border-white/20 bg-white/10 px-3 py-2 text-white"
              autoComplete="off"
            />
          </label>
          <label className="block text-sm text-white/70">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded border border-white/20 bg-white/10 px-3 py-2 text-white"
              autoComplete="new-password"
            />
          </label>
          <button
            type="submit"
            disabled={saving || items.length >= max}
            className="w-full rounded bg-amber-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
          >
            {saving ? 'Creating…' : items.length >= max ? 'Viewer limit reached' : 'Create viewer'}
          </button>
        </form>
      </div>
    </div>
  );
}
