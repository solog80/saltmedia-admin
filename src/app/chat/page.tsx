'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, Radio, Phone, MessageCircle, RefreshCw } from 'lucide-react';
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
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadShows = useCallback(async () => {
    try {
      const res = await fetch('/api/chat', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load lineup');
      setShows(data.shows || []);
      // Auto-select the active show if nothing selected yet.
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

  // Initial lineup load + auto-select active room.
  useEffect(() => {
    loadShows();
  }, [loadShows]);

  // Poll lineup every ~30s so "now active" stays fresh.
  useEffect(() => {
    const t = setInterval(loadShows, 30000);
    return () => clearInterval(t);
  }, [loadShows]);

  // Load + poll messages for the selected room.
  useEffect(() => {
    if (!selectedRoom) return;
    loadMessages(selectedRoom);
    const t = setInterval(() => loadMessages(selectedRoom), POLL_MS);
    return () => clearInterval(t);
  }, [selectedRoom, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  // EPG start/end times are stored in UTC (mesh matches them against the UTC
  // clock). Convert an "HH:MM" UTC schedule time to the local broadcast clock
  // (Africa/Kampala, UTC+3).
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

  return (
    <div className="h-screen flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <MessageSquare size={24} className="text-blue-300" />
          <div>
            <h1 className="text-xl font-bold text-white">Program Chat</h1>
            <p className="text-xs text-white/60">
              {selectedShow
                ? `${selectedShow.programName} • ${fmtClock(selectedShow.startTime)}–${fmtClock(selectedShow.endTime)}`
                : 'Select a program'}
            </p>
          </div>
        </div>
        <button
          onClick={loadShows}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white/80 text-sm"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && (
        <div className="mb-3 px-4 py-2 rounded bg-red-500/15 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-4 flex-1 min-h-0">
        {/* LEFT: program lineup */}
        <div className="w-72 flex-shrink-0 frosted-glass rounded-xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
            <Radio size={16} className="text-orange-400" />
            <span className="text-white font-semibold text-sm">Radio Programs</span>
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
              shows.map((s) => {
                const selected = s.roomId === selectedRoom;
                return (
                  <button
                    key={s.roomId}
                    onClick={() => setSelectedRoom(s.roomId)}
                    className={`w-full text-left p-2.5 rounded-lg border transition ${
                      selected
                        ? 'bg-blue-600/30 border-blue-500/50'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {s.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.image} alt="" className="h-9 w-12 rounded object-cover" />
                      ) : (
                        <div className="h-9 w-12 rounded bg-white/10 flex items-center justify-center">
                          <Radio size={14} className="text-white/30" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm text-white font-medium truncate">{s.programName}</div>
                        <div className="text-xs text-white/50">
                          {fmtClock(s.startTime)}–{fmtClock(s.endTime)}
                          {s.isActive && (
                            <span className="ml-2 inline-flex items-center gap-1 text-green-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                              LIVE
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: messages */}
        <div className="flex-1 frosted-glass rounded-xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle size={16} className="text-white/60" />
              <span className="text-white font-semibold text-sm">
                {selectedShow?.programName ?? 'Select a program'}
              </span>
            </div>
            <span className="text-xs text-white/40">
              {messages.length} message{messages.length === 1 ? '' : 's'} • auto-refresh
            </span>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
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
            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <div className="px-4 py-3 border-t border-white/10">
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
                className="flex items-center gap-1.5 px-4 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm"
              >
                <Send size={14} />
                {replyTarget?.source === 'sms' ? 'Send SMS' : 'Send'}
              </button>
            </div>
            <p className="text-[11px] text-white/35 mt-1.5">
              {replyTarget?.source === 'sms'
                ? 'This queues an SMS the TV-station gateway will send to the listener.'
                : 'Messages are delivered to the app chat for this program.'}
            </p>
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
        className={`max-w-[75%] rounded-xl px-3 py-2 border ${
          isMine
            ? 'bg-blue-600/40 border-blue-500/40'
            : isAdmin
              ? 'bg-amber-500/15 border-amber-500/30'
              : isSms
                ? 'bg-emerald-500/10 border-emerald-500/25'
                : 'bg-white/8 border-white/10'
        } ${isReplyTarget ? 'ring-2 ring-blue-400' : ''}`}
      >
        <div className="flex items-center gap-1.5 mb-0.5">
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
