'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Camera,
  Mic,
  MicOff,
  RadioTower,
  RefreshCw,
  Users,
} from 'lucide-react';
import BroadcastTabs from '@/app/broadcast/BroadcastTabs';

type Participant = {
  Channel?: string;
  CallerIDNum?: string;
  CallerIDName?: string;
  Muted?: string;
  Admin?: string;
  extension?: string;
  userId?: string;
  displayName?: string;
  avatarUrl?: string;
};

type RosterEntry = {
  extension: string;
  userId?: string;
  displayName?: string;
  avatarUrl?: string;
  enabled?: boolean;
  lineName?: string;
  registrarPort?: number;
};

type ParticipantsPayload = {
  success?: boolean;
  conference?: string;
  comrexInRoom?: boolean;
  participants?: Participant[];
  roster?: RosterEntry[];
  error?: string;
};

const AVATAR_COLORS = [
  'bg-amber-500',
  'bg-emerald-500',
  'bg-sky-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-cyan-600',
  'bg-orange-500',
  'bg-teal-500',
];

const CARD = 'frosted-glass rounded-xl';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function displayChannel(channel?: string): string {
  return (channel || '').replace(/^PJSIP\//, '');
}

function isComrex(p: Participant): boolean {
  return (
    p.CallerIDNum === '100' ||
    (p.Channel || '').startsWith('PJSIP/station-')
  );
}

function PresenterAvatar({
  name,
  url,
  onAir,
}: {
  name: string;
  url?: string;
  onAir: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  const ring = onAir
    ? 'ring-2 ring-red-400/70 ring-offset-2 ring-offset-[#141416]'
    : '';

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`h-12 w-12 shrink-0 rounded-full object-cover ${ring}`}
      />
    );
  }

  return (
    <div
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(name)} ${ring}`}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}

export default function RadioStudioPage() {
  const [payload, setPayload] = useState<ParticipantsPayload | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [comrexBusy, setComrexBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const load = useCallback(async (fresh = false) => {
    try {
      const res = await fetch(
        `/api/radio/participants${fresh ? '?fresh=1' : ''}`,
        { cache: 'no-store' },
      );
      const json = (await res.json().catch(() => ({}))) as ParticipantsPayload;
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setPayload(json);
      setError('');
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 2500);
    return () => clearInterval(timer);
  }, [load]);

  const setMuted = async (participant: Participant, muted: boolean) => {
    const channel = participant.Channel || '';
    if (!channel) return;

    // Optimistic: switch the card immediately. The AMI action is the only
    // thing we wait for; polling reconciles the authoritative state.
    setPayload((prev) =>
      prev?.participants
        ? {
            ...prev,
            participants: prev.participants.map((p) =>
              p.Channel === channel
                ? { ...p, Muted: muted ? 'Yes' : 'No' }
                : p,
            ),
          }
        : prev,
    );
    setBusy(channel);
    try {
      const res = await fetch('/api/radio/mute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channel, muted }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      // Refresh in the background; do not block the button/card on it.
      void load();
    } catch (e) {
      setError(String(e));
      await load();
    } finally {
      setBusy(null);
    }
  };

  const toggleComrex = async (connect: boolean) => {
    setComrexBusy(true);
    try {
      const res = await fetch('/api/radio/comrex', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ connected: connect }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      await load();
    } catch (e) {
      setError(String(e).replace(/Comrex/g, 'Studio'));
    } finally {
      setComrexBusy(false);
    }
  };

  const uploadAvatar = async (extension: string, file: File) => {
    setUploading(extension);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('extension', extension);
      const res = await fetch('/api/radio/avatar', {
        method: 'POST',
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      await load(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(null);
    }
  };

  const participants = payload?.participants || [];
  const comrex = participants.find(isComrex);
  const presenters = participants.filter((p) => !isComrex(p));
  const onAir = presenters.filter((p) => p.Muted !== 'Yes').length;
  const live = participants.length > 0;

  const roster = payload?.roster || [];
  const liveExtensions = new Set(
    presenters.map((p) => (p.extension || '').toLowerCase()).filter(Boolean),
  );
  const offline = roster.filter(
    (r) => r.extension && !liveExtensions.has(r.extension.toLowerCase()),
  );

  type PresenterCard = {
    key: string;
    online: boolean;
    name: string;
    avatarUrl?: string;
    extension: string;
    channel?: string;
    callerId?: string;
    muted: boolean;
    enabled: boolean;
    registrarPort?: number;
    participant?: Participant;
  };

  const cards: PresenterCard[] = [
    ...presenters.map((p) => ({
      key: p.Channel || p.extension || p.CallerIDNum || 'live',
      online: true,
      name: p.displayName || p.CallerIDName || p.CallerIDNum || 'Unknown',
      avatarUrl: p.avatarUrl,
      extension: p.extension || '',
      channel: p.Channel,
      callerId: p.CallerIDNum,
      muted: p.Muted === 'Yes',
      enabled: true,
      participant: p,
    })),
    ...offline.map((r) => ({
      key: `offline-${r.extension}`,
      online: false,
      name: r.displayName || r.lineName || r.extension,
      avatarUrl: r.avatarUrl,
      extension: r.extension,
      muted: true,
      enabled: r.enabled !== false,
      registrarPort: r.registrarPort,
    })),
  ];

  return (
    <div className="space-y-5 p-6">
      <BroadcastTabs />

      <div className={`${CARD} relative z-20 flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between`}>
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white sm:text-3xl">
              Live Radio
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                live
                  ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                  : 'border-white/20 bg-white/10 text-white/60'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  live ? 'animate-pulse bg-emerald-400' : 'bg-white/40'
                }`}
              />
              {live ? 'Conference Live' : 'Idle'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
              New joins muted
            </span>
          </div>
          <p className="mt-1 text-xs text-white/70 sm:text-sm">
            Producer control for the SIP presenter conference ·{' '}
            <code className="rounded bg-white/15 px-1.5 py-0.5 font-mono text-xs text-white">
              {payload?.conference || 'presenters'}
            </code>
            {' · '}
            {cards.length} provisioned · {presenters.length} online
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void load()}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-black transition hover:bg-amber-400 sm:text-sm"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`${CARD} flex items-center justify-between p-5`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Presenters
            </p>
            <p className="mt-1 text-3xl font-bold text-white">
              {cards.length}
            </p>
            <p className="mt-1 text-xs font-medium text-white/60">
              {presenters.length} online right now
            </p>
          </div>
          <div className="rounded-xl border border-blue-400/40 bg-blue-500/25 p-3 text-blue-300">
            <Users size={24} />
          </div>
        </div>

        <div className={`${CARD} flex items-center justify-between p-5`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
              On Air
            </p>
            <p className="mt-1 text-3xl font-bold text-white">{onAir}</p>
            <p className="mt-1 text-xs font-medium text-emerald-300">
              Routed to the studio bus
            </p>
          </div>
          <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/25 p-3 text-emerald-300">
            <Mic size={24} />
          </div>
        </div>

        <div className={`${CARD} flex items-center justify-between p-5`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Muted
            </p>
            <p className="mt-1 text-3xl font-bold text-white">
              {presenters.length - onAir}
            </p>
            <p className="mt-1 text-xs font-medium text-amber-300">
              Waiting for the producer
            </p>
          </div>
          <div className="rounded-xl border border-amber-400/40 bg-amber-500/25 p-3 text-amber-300">
            <MicOff size={24} />
          </div>
        </div>

        <div className={`${CARD} flex items-center justify-between p-5`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Studio
            </p>
            <p
              className={`mt-1 text-2xl font-bold ${
                payload?.comrexInRoom ? 'text-emerald-300' : 'text-white/60'
              }`}
            >
              {payload?.comrexInRoom ? 'IN ROOM' : 'OFFLINE'}
            </p>
            <p className="mt-1 text-xs font-medium text-white/45">
              Admin-controlled
            </p>
          </div>
          <div className="rounded-xl border border-purple-400/40 bg-purple-500/25 p-3 text-purple-300">
            <RadioTower size={24} />
          </div>
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">
            Studio
          </h2>
          <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
            ADMIN CONTROL
          </span>
        </div>

        <article className={`${CARD} flex flex-wrap items-center justify-between gap-4 p-4`}>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-purple-400/40 bg-purple-500/25 text-purple-300">
              <RadioTower size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-white">Studio</h3>
              <p className="text-xs text-white/50">
                {comrex
                  ? `${displayChannel(comrex.Channel)} · live`
                  : 'Not in the conference yet'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                payload?.comrexInRoom
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-white/10 text-white/50'
              }`}
            >
              {payload?.comrexInRoom ? 'IN ROOM' : 'NOT CONNECTED'}
            </span>
            <button
              disabled={comrexBusy}
              onClick={() => void toggleComrex(!payload?.comrexInRoom)}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition disabled:opacity-40 ${
                payload?.comrexInRoom
                  ? 'border border-white/20 bg-white/10 text-white/80 hover:bg-white/15'
                  : 'bg-amber-500 text-black hover:bg-amber-400'
              }`}
            >
              {comrexBusy
                ? 'Working…'
                : payload?.comrexInRoom
                  ? 'Disconnect Studio'
                  : 'Connect Studio'}
            </button>
          </div>
        </article>
      </section>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">
            Presenters
          </h2>
          <div className="flex items-center gap-3 text-[10px] text-white/40">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Connected
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              On air
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-white/30" />
              Offline
            </span>
          </div>
        </div>
        <span className="text-xs text-white/40">
          {onAir} on air · {presenters.length} online · {offline.length} offline
        </span>
      </div>

      {cards.length === 0 ? (
        <div className={`${CARD} p-10 text-center text-white/40`}>
          No presenters provisioned yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((card) => {
            const channel = card.channel || '';
            const muted = card.muted;
            const name = card.name;
            return (
              <article
                key={card.key}
                className={`${CARD} p-4 transition-colors ${
                  !card.online
                    ? 'border-white/15'
                    : muted
                      ? 'border-emerald-500/30'
                      : 'border-red-500/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative shrink-0">
                      <PresenterAvatar
                        name={name}
                        url={card.avatarUrl}
                        onAir={card.online && !muted}
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5">
                        {card.online && (
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                        )}
                        <span
                          className={`relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-[#141416] ${
                            card.online ? 'bg-emerald-400' : 'bg-white/30'
                          }`}
                        />
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-white">
                        {name}
                      </h3>
                      <p className="text-xs text-white/60">
                        {card.callerId
                          ? `Ext ${card.callerId}`
                          : card.extension || '—'}
                        {card.registrarPort
                          ? ` · :${card.registrarPort}`
                          : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        card.online
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-white/5 text-white/40'
                      }`}
                    >
                      {card.online
                        ? 'CONNECTED'
                        : card.enabled
                          ? 'OFFLINE'
                          : 'DISABLED'}
                    </span>
                    {card.online && (
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          muted
                            ? 'bg-white/10 text-white/60'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {muted ? 'MUTED' : 'ON AIR'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-white/35">
                    {card.online ? 'Channel' : 'SIP line'}
                  </div>
                  <code className="block truncate rounded border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-white/50">
                    {displayChannel(card.online ? channel : card.extension)}
                  </code>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    disabled={!card.online || busy === channel}
                    onClick={() =>
                      card.participant
                        ? void setMuted(card.participant, !muted)
                        : undefined
                    }
                    className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition disabled:opacity-40 ${
                      !card.online
                        ? 'border border-white/10 bg-white/5 text-white/30'
                        : muted
                          ? 'bg-amber-500 text-black hover:bg-amber-400'
                          : 'border border-white/20 bg-white/10 text-white/80 hover:bg-white/15'
                    }`}
                  >
                    {!card.online ? (
                      <RadioTower size={14} />
                    ) : muted ? (
                      <Mic size={14} />
                    ) : (
                      <MicOff size={14} />
                    )}
                    {!card.online
                      ? 'Not connected'
                      : busy === channel
                        ? 'Working…'
                        : muted
                          ? 'Route (Unmute)'
                          : 'Mute'}
                  </button>

                  {card.extension && (
                    <label
                      className={`inline-flex cursor-pointer items-center gap-1 text-[10px] font-medium ${
                        uploading === card.extension
                          ? 'text-white/30'
                          : 'text-white/50 hover:text-white'
                      }`}
                      title="Upload a custom S3 photo (overrides the Google photo)"
                    >
                      <Camera size={12} />
                      {uploading === card.extension
                        ? 'Uploading…'
                        : card.avatarUrl
                          ? 'Change photo'
                          : 'Add photo'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading === card.extension}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.currentTarget.value = '';
                          if (file) void uploadAvatar(card.extension, file);
                        }}
                      />
                    </label>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="text-xs text-white/30">
        Dev environment: Asterisk <code>asterisk-dev</code> on 5062. Live radio
        on 5060 is untouched.
      </p>
    </div>
  );
}
