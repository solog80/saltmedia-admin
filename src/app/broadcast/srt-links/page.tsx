'use client';

import { useCallback, useEffect, useState } from 'react';
import BroadcastTabs from '../BroadcastTabs';

type SrtLink = {
  id: string;
  name: string;
  path: string;
  link: string;
  createdAt?: string | null;
};

export default function SrtLinksPage() {
  const [items, setItems] = useState<SrtLink[]>([]);
  const [max, setMax] = useState(10);
  const [name, setName] = useState('');
  const [path, setPath] = useState('presenter1');
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/srt-links', { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Unable to load SRT links');
      return;
    }
    setItems(data.items || []);
    setMax(data.max || 10);
    setError('');
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createLink(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/srt-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, path, passphrase }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unable to create SRT link');
        return;
      }
      setName('');
      setPassphrase('');
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function removeLink(id: string) {
    if (!confirm('Delete this SRT link?')) return;
    const res = await fetch('/api/srt-links', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Unable to delete SRT link');
      return;
    }
    await load();
  }

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link);
    setCopied(link);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="p-6 space-y-6">
      <BroadcastTabs />
      <div>
        <h1 className="text-2xl font-bold text-white">SRT Links</h1>
        <p className="text-sm text-white/50">
          Create up to {max} publish links for presenters. Use the MediaMTX path and its passphrase.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-white">Links</h2>
            <span className="text-xs text-white/50">{items.length}/{max}</span>
          </div>
          {error && <p className="mb-3 text-sm text-red-300">{error}</p>}
          <div className="divide-y divide-white/10">
            {items.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/40">No SRT links yet.</p>
            ) : items.map((item) => (
              <div key={item.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{item.name}</p>
                    <p className="font-mono text-xs text-amber-300">{item.path}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyLink(item.link)}
                      className="rounded border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10"
                    >
                      {copied === item.link ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      onClick={() => removeLink(item.id)}
                      className="rounded border border-red-400/30 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-400/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <code className="mt-2 block break-all rounded bg-black/30 p-2 text-[11px] text-white/60">
                  {item.link}
                </code>
              </div>
            ))}
          </div>
        </section>

        <form onSubmit={createLink} className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <h2 className="font-semibold text-white">Create SRT link</h2>
          <p className="text-xs text-white/40">
            If the path does not exist, it will be created on MediaMTX with this passphrase. Existing paths are left unchanged.
          </p>
          <label className="block text-sm text-white/70">
            Link name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Presenter 3"
              className="mt-1 w-full rounded border border-white/20 bg-white/10 px-3 py-2 text-white"
            />
          </label>
          <label className="block text-sm text-white/70">
            MediaMTX path
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="presenter1"
              className="mt-1 w-full rounded border border-white/20 bg-white/10 px-3 py-2 font-mono text-white"
            />
          </label>
          <label className="block text-sm text-white/70">
            Path passphrase
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="mt-1 w-full rounded border border-white/20 bg-white/10 px-3 py-2 text-white"
              autoComplete="new-password"
            />
          </label>
          <button
            type="submit"
            disabled={saving || items.length >= max}
            className="w-full rounded bg-amber-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
          >
            {saving ? 'Creating…' : items.length >= max ? 'Link limit reached' : 'Create link'}
          </button>
        </form>
      </div>
    </div>
  );
}
