'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  MessageSquare,
  Send,
  Radio,
  Phone,
  MessageCircle,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface Show {
  programName: string;
  roomId: string;
  startTime: string;
  endTime: string;
  image?: string | null;
  isActive: boolean;
}

interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string | null;
  user_name: string | null;
  message_content: string;
  is_admin_message: boolean;
  source: string; // 'app' | 'sms'
  sender_external_id: string | null;
  sender_external_name: string | null;
  created_at: string;
}

const POLL_MS = 5000;

// Privacy: show only the last 4 digits of an external SMS/WhatsApp number.
function maskExternal(n?: string | null): string {
  if (!n) return 'External';
  const digits = n.replace(/\D/g, '');
  if (digits.length <= 4) return n;
  return `••••${digits.slice(-4)}`;
}

export default function ProgramChatPage() {
  const { user } = useAuth();
  const [shows, setShows] = useState<Show[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingShows, setLoadingShows] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [maximized, setMaximized] = useState(false); // hide panel -> full-width messages
  const [isFullscreen, setIsFullscreen] = useState(false);
  const messagePaneRef = useRef<HTMLDivElement>(null);

  // Track browser fullscreen so the toggle icon stays accurate.
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const loadShows = useCallback(async () => {
    try {
      const res = await fetch('/api/chat', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load lineup');
      setShows(data.shows || []);
      setSelectedRoom((prev) => prev ?? data.activeRoomId ?? data.shows?.[0]?.roomId ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingShows(false);
    }
  }, []);

  const loadMessages = useCallback(async (roomId: string) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/chat?roomId=${encodeURIComponent(roomId)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load messages');
      setMessages(data.messages || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    loadShows();
  }, [loadShows]);

  useEffect(() => {
    const t = setInterval(loadShows, 30000);
    return () => clearInterval(t);
  }, [loadShows]);

  useEffect(() => {
    if (!selectedRoom) return;
    loadMessages(selectedRoom);
    const t = setInterval(() => loadMessages(selectedRoom), POLL_MS);
    return () => clearInterval(t);
  }, [selectedRoom, loadMessages]);

  // Fullscreen toggle for the whole messages area.
  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      messagePaneRef.current?.requestFullscreen?.().catch(() => {});
    }
  };

  async function handleSend() {
    const text = draft.trim();
    if (!text || !selectedRoom) return;
    setSending(true);
    setError(null);
    try {
      const body: { roomId: string; content: string; targetNumber?: string } = {
        roomId: selectedRoom,
        content: text,
      };
      if (replyTarget?.source === 'sms' && replyTarget.sender_external_id) {
        body.targetNumber = replyTarget.sender_external_id;
      }
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      setDraft('');
      setReplyTarget(null);
      loadMessages(selectedRoom);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  const selectedShow = shows.find((s) => s.roomId === selectedRoom);

  const LOCALE = 'en-GB';
  const TZ = 'Africa/Kampala';

  const fmtClock = (utcHHMM: string) => {
    if (!utcHHMM) return '';
    const [h, m] = utcHHMM.split(':').map((n) => parseInt(n, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return utcHHMM;
    const d = new Date();
    d.setUTCHours(h, m, 0, 0);
    return d.toLocaleTimeString(LOCALE, {
      timeZone: TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const header = (
    <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
      <div className="flex items-center gap-3 min-w-0">
        <MessageSquare size={24} className="text-blue-300 flex-shrink-0" />
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-white truncate">Program Chat</h1>
          <p className="text-xs text-white/60 truncate">
            {selectedShow
              ? `${selectedShow.programName} • ${fmtClock(selectedShow.startTime)}–${fmtClock(selectedShow.endTime)}`
              : 'Select a program'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={() => setPanelCollapsed((c) => !c)}
          title={panelCollapsed ? 'Expand programs' : 'Collapse programs to thumbs'}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white/80 text-sm"
        >
          {panelCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          <span className="hidden lg:inline">
            {panelCollapsed ? 'Shows' : 'Hide'}
          </span>
        </button>
        <button
          onClick={() => setMaximized((m) => !m)}
          title={maximized ? 'Show programs panel' : 'Maximize messages (hide programs)'}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white/80 text-sm"
        >
          {maximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          <span className="hidden lg:inline">{maximized ? 'Restore' : 'Maximize'}</span>
        </button>
        <button
          onClick={loadShows}
          title="Refresh"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white/80 text-sm"
        >
          <RefreshCw size={14} />
          <span className="hidden lg:inline">Refresh</span>
        </button>
      </div>
    </div>
  );

  // Show pill: compact (thumb + optional label) used in mobile rail and desktop.
  const showPill = (s: Show, selected: boolean, showLabel: boolean) => (
    <button
      key={s.roomId}
      onClick={() => setSelectedRoom(s.roomId)}
      title={`${s.programName} ${fmtClock(s.startTime)}–${fmtClock(s.endTime)}${s.isActive ? ' (LIVE)' : ''}`}
      className={`relative flex items-center gap-2 rounded-lg border transition flex-shrink-0 ${
        showLabel ? 'p-2 w-full text-left' : 'p-1'
      } ${
        selected
          ? 'bg-blue-600/30 border-blue-500/50'
          : 'border-white/10 bg-white/5 hover:bg-white/10'
      }`}
    >
      <div className="relative">
        {s.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={s.image}
            alt=""
            className={showLabel ? 'h-9 w-12 rounded object-cover' : 'h-12 w-12 rounded-md object-cover'}
          />
        ) : (
          <div
            className={
              showLabel
                ? 'h-9 w-12 rounded bg-white/10 flex items-center justify-center'
                : 'h-12 w-12 rounded-md bg-white/10 flex items-center justify-center'
            }
          >
            <Radio size={16} className="text-white/30" />
          </div>
        )}
        {s.isActive && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse ring-2 ring-black/40" />
        )}
      </div>
      {showLabel && (
        <div className="min-w-0">
          <div className="text-sm text-white font-medium truncate">{s.programName}</div>
          <div className="text-xs text-white/50">
            {fmtClock(s.startTime)}–{fmtClock(s.endTime)}
            {s.isActive && <span className="ml-2 text-green-400 font-semibold">LIVE</span>}
          </div>
        </div>
      )}
    </button>
  );

  return (
    <div className="h-screen flex flex-col p-3 sm:p-4">
      {header}

      {error && (
        <div className="mb-3 px-4 py-2 rounded bg-red-500/15 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 lg:gap-4">
        {/* LEFT: program lineup. Desktop = vertical panel (collapsible to
            thumbnail rail); mobile = horizontal thumb strip on top. */}
        {!maximized && (
          <>
            {/* Mobile strip */}
            <div className="lg:hidden frosted-glass rounded-xl p-2">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {loadingShows ? (
                  <div className="flex gap-2 px-1 py-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-12 w-12 bg-white/5 rounded animate-pulse" />
                    ))}
                  </div>
                ) : shows.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-white/40">No programs today</div>
                ) : (
                  shows.map((s) => showPill(s, s.roomId === selectedRoom, false))
                )}
              </div>
            </div>

            {/* Desktop panel / rail */}
            <div
              className={`hidden lg:flex flex-shrink-0 frosted-glass rounded-xl flex-col overflow-hidden ${
                panelCollapsed ? 'w-20' : 'w-72'
              }`}
            >
              <div
                className={`px-4 py-3 border-b border-white/10 flex items-center gap-2 ${
                  panelCollapsed ? 'justify-center px-2' : ''
                }`}
              >
                <Radio size={16} className="text-orange-400" />
                {!panelCollapsed && (
                  <span className="text-white font-semibold text-sm">Radio Programs</span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {loadingShows ? (
                  <div className="space-y-2 p-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-14 bg-white/5 rounded animate-pulse" />
                    ))}
                  </div>
                ) : shows.length === 0 ? (
                  <div className="p-4 text-center text-sm text-white/40">
                    No programs airing today
                  </div>
                ) : (
                  shows.map((s) => showPill(s, s.roomId === selectedRoom, !panelCollapsed))
                )}
              </div>
            </div>
          </>
        )}

        {/* RIGHT: messages */}
        <div
          ref={messagePaneRef}
          className="flex-1 min-w-0 frosted-glass rounded-xl flex flex-col overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <MessageCircle size={16} className="text-white/60 flex-shrink-0" />
              <span className="text-white font-semibold text-sm truncate">
                {selectedShow?.programName ?? 'Select a program'}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-white/40 hidden sm:inline">
                {messages.length} msg{messages.length === 1 ? '' : 's'} • auto
              </span>
              <button
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                className="p-1.5 rounded bg-white/10 hover:bg-white/20 text-white/70"
              >
                {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
            </div>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
            {!selectedRoom ? (
              <div className="h-full flex items-center justify-center text-white/40">
                Select a program to view its chat
              </div>
            ) : loadingMsgs && messages.length === 0 ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-white/5 rounded animate-pulse" />
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-white/40 gap-1">
                <MessageSquare size={28} className="opacity-40" />
                <span className="text-sm">No messages in this room yet</span>
              </div>
            ) : (
              messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  msg={m}
                  isMine={m.user_id === user?.uid}
                  onReply={() => setReplyTarget(m)}
                  isReplyTarget={replyTarget?.id === m.id}
                />
              ))
            )}
          </div>

          {/* Composer */}
          <div className="px-3 py-3 sm:px-4 border-t border-white/10">
            {replyTarget && (
              <div className="flex items-center justify-between mb-2 px-3 py-1.5 rounded bg-white/10 text-xs text-white/70">
                <span className="truncate">
                  Replying {replyTarget.source === 'sms' ? 'via SMS' : 'to'}{' '}
                  <b>
                    {replyTarget.source === 'sms'
                      ? maskExternal(replyTarget.user_name || replyTarget.sender_external_id)
                      : replyTarget.user_name || 'user'}
                  </b>
                </span>
                <button onClick={() => setReplyTarget(null)} className="text-white/50 hover:text-white ml-2">
                  ✕
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={
                  replyTarget?.source === 'sms'
                    ? `Reply to ${maskExternal(replyTarget.sender_external_id)} (SMS)...`
                    : 'Type a message...'
                }
                className="flex-1 rounded-md border border-input bg-white/10 px-3 py-2 text-white placeholder-white/40 text-sm outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={handleSend}
                disabled={sending || !draft.trim() || !selectedRoom}
                className="flex items-center gap-1.5 px-3 sm:px-4 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm flex-shrink-0"
              >
                <Send size={14} />
                <span className="hidden sm:inline">
                  {replyTarget?.source === 'sms' ? 'Send SMS' : 'Send'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
  isMine,
  onReply,
  isReplyTarget,
}: {
  msg: ChatMessage;
  isMine: boolean;
  onReply: () => void;
  isReplyTarget: boolean;
}) {
  const isSms = msg.source === 'sms';
  const isAdmin = !!msg.is_admin_message;
  const name = isSms
    ? maskExternal(msg.user_name || msg.sender_external_id || msg.sender_external_name)
    : msg.user_name || msg.sender_external_name || 'Anonymous';
  const when = new Date(msg.created_at);
  const localTime = !Number.isNaN(when.getTime())
    ? when.toLocaleTimeString('en-GB', {
        timeZone: 'Africa/Kampala',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '';

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] sm:max-w-[75%] rounded-xl px-3 py-2 border ${
          isMine
            ? 'bg-blue-600/40 border-blue-500/40'
            : isAdmin
              ? 'bg-amber-500/15 border-amber-500/30'
              : isSms
                ? 'bg-emerald-500/10 border-emerald-500/25'
                : 'bg-white/8 border-white/10'
        } ${isReplyTarget ? 'ring-2 ring-blue-400' : ''}`}
      >
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          {isSms && <Phone size={11} className="text-emerald-400" />}
          <span className={`text-xs font-semibold ${isMine ? 'text-blue-200' : isAdmin ? 'text-amber-300' : isSms ? 'text-emerald-300' : 'text-white/80'}`}>
            {name}
          </span>
          {isSms && (
            <span className="text-[10px] px-1.5 py-px rounded bg-emerald-500/25 text-emerald-300 uppercase">SMS</span>
          )}
          {isAdmin && !isSms && (
            <span className="text-[10px] px-1.5 py-px rounded bg-amber-500/25 text-amber-300 uppercase">Admin</span>
          )}
          {localTime && <span className="text-[10px] text-white/35">{localTime}</span>}
        </div>
        <p className="text-sm text-white/95 whitespace-pre-wrap break-words">{msg.message_content}</p>
        {!isMine && (
          <button
            onClick={onReply}
            className="mt-1 text-[11px] text-white/45 hover:text-white"
            title="Reply"
          >
            Reply
          </button>
        )}
      </div>
    </div>
  );
}
