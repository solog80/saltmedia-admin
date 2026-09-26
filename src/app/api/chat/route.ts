import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebaseAdmin';

const REST_BASE = process.env.REST_BASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

/**
 * Program Chat (radio) — reads chat messages (in-app + SMS) for the radio
 * program rooms, lists the program lineup, and lets a presenter reply.
 *
 * GET  /api/chat            -> { shows: [...], activeRoomId }
 * GET  /api/chat?roomId=xxx -> { messages: [...] }
 * POST /api/chat            -> reply (SMS -> sms_outbox; app/admin -> chat_messages)
 */

async function restFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${REST_BASE}/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `PostgREST ${res.status}`);
  }
  return text;
}

// Mirrors the mesh generateSlug so room ids match chat_rooms.id.
function roomSlug(programName: string): string {
  const slug = programName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug.length > 50 ? slug.slice(0, 50) : slug;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function getTodayLineup() {
  // Live_Radio programs that air today, earliest first.
  const today = DAY_NAMES[new Date().getUTCDay()];
  const raw = await restFetch(
    `epg_programs?select=program_name,start_time,end_time,days,image,thumbnail&station_id=eq.Live_Radio&order=start_time.asc`
  );
  const rows = JSON.parse(raw) as {
    program_name: string;
    start_time: string;
    end_time: string;
    days?: string;
    image?: string | null;
    thumbnail?: string | null;
  }[];
  const mapped = rows
    .filter((r) => {
      const days = String(r.days || '').split(',').map((d) => d.trim());
      return days.includes(today);
    })
    .map((r) => ({
      programName: r.program_name,
      roomId: roomSlug(r.program_name),
      startTime: r.start_time,
      endTime: r.end_time,
      image: r.image || r.thumbnail || null,
    }));

  // Same program can appear on multiple schedule rows (e.g. ENJIIRI across
  // day groups) — keep one per room, earliest airing wins.
  const byRoom = new Map<string, (typeof mapped)[number]>();
  for (const item of mapped) {
    const existing = byRoom.get(item.roomId);
    if (!existing || item.startTime < existing.startTime) {
      byRoom.set(item.roomId, item);
    }
  }
  return [...byRoom.values()].sort((a, b) => (a.startTime < b.startTime ? -1 : 1));
}

export async function GET(request: NextRequest) {
  try {
    const session = await verifySession(request.cookies.get('firebaseToken')?.value);
    if (!session || !['admin', 'moderator', 'editor'].includes(session.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const roomId = request.nextUrl.searchParams.get('roomId');

    if (roomId) {
      // Messages for a room — in-app + SMS, newest last.
      const raw = await restFetch(
        `chat_messages?select=id,room_id,user_id,user_name,message_content,is_admin_message,source,sender_external_id,sender_external_name,created_at&room_id=eq.${encodeURIComponent(roomId)}&order=created_at.asc&limit=500`
      );
      return NextResponse.json({ messages: JSON.parse(raw) });
    }

    // Lineup: active special events + active chat_rooms + today's radio shows.
    const nowIso = new Date().toISOString();
    let activeEvents: { id: string; title: string; image_url?: string }[] = [];
    try {
      const eventsRaw = await restFetch(
        `events?select=id,title,image_url,start_date,end_date,enable_chat&or=(enable_chat.is.null,enable_chat.eq.true)&start_date=lte.${encodeURIComponent(nowIso)}&end_date=gte.${encodeURIComponent(nowIso)}`
      );
      activeEvents = JSON.parse(eventsRaw);
    } catch (e) {
      console.warn('Failed to fetch active events for chat route:', e);
    }

    const roomsRaw = await restFetch(
      `chat_rooms?select=id,program_name,is_active&is_active=eq.true`
    );
    const activeRooms = JSON.parse(roomsRaw) as { id: string; program_name?: string }[];

    const lineup = await getTodayLineup();

    const shows: {
      programName: string;
      roomId: string;
      startTime: string;
      endTime: string;
      image: string | null;
      isActive: boolean;
    }[] = [];

    // 1. Add active special events
    for (const ev of activeEvents) {
      shows.push({
        programName: ev.title,
        roomId: ev.id,
        startTime: '00:00',
        endTime: '23:59',
        image: ev.image_url || null,
        isActive: true,
      });
      const slug = roomSlug(ev.title);
      if (slug && slug !== ev.id && !shows.some((s) => s.roomId === slug)) {
        shows.push({
          programName: ev.title,
          roomId: slug,
          startTime: '00:00',
          endTime: '23:59',
          image: ev.image_url || null,
          isActive: true,
        });
      }
    }

    // 2. Add active rooms from chat_rooms table
    for (const room of activeRooms) {
      if (!shows.some((s) => s.roomId === room.id)) {
        shows.push({
          programName: room.program_name || room.id,
          roomId: room.id,
          startTime: '00:00',
          endTime: '23:59',
          image: null,
          isActive: true,
        });
      }
    }

    // 3. Add regular radio lineup
    for (const s of lineup) {
      if (!shows.some((existing) => existing.roomId === s.roomId)) {
        shows.push({
          ...s,
          isActive: activeRooms.some((r) => r.id === s.roomId),
        });
      }
    }

    // Prefer the first active show; fall back to the earliest today.
    const activeRoomId =
      shows.find((s) => s.isActive)?.roomId ??
      shows[0]?.roomId ??
      null;

    return NextResponse.json({ shows, activeRoomId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession(request.cookies.get('firebaseToken')?.value);
    if (!session || !['admin', 'moderator', 'editor'].includes(session.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { roomId, targetNumber, content, replyToMessageId } = body;
    if (!roomId || !content?.trim()) {
      return NextResponse.json({ error: 'roomId and content are required' }, { status: 400 });
    }

    if (targetNumber) {
      // SMS reply — queue for the TV-station agent to send.
      await restFetch('sms_outbox', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify([
          {
            to_number: targetNumber,
            body: content.trim(),
            room_id: roomId,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]),
      });
      return NextResponse.json({ success: true, channel: 'sms', message: 'SMS queued' });
    }

    // In-app/admin reply — write a chat_messages row as an admin message so it
    // shows in the room for app readers too.
    const row = {
      id: crypto.randomUUID().replace(/-/g, ''),
      room_id: roomId,
      user_id: session.uid,
      user_name: session.email || 'Presenter',
      message_content: content.trim(),
      is_admin_message: true,
      is_lottie_emoji: false,
      is_expression: false,
      source: 'app',
      created_at: new Date().toISOString(),
    };
    await restFetch('chat_messages', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify([row]),
    });
    return NextResponse.json({ success: true, channel: 'app', message: 'Reply sent', replyToMessageId });
        } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
