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
  return rows
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

    // Lineup: today's radio shows + which room currently has messages.
    const lineup = await getTodayLineup();
    const roomsRaw = await restFetch(
      `chat_rooms?select=id,program_name,is_active&kind=eq.radio&is_active=eq.true`
    );
    const activeRooms = JSON.parse(roomsRaw) as { id: string }[];

    const shows = lineup.map((s) => ({
      ...s,
      isActive: activeRooms.some((r) => r.id === s.roomId),
    }));

    // Prefer the first lineup show flagged active; fall back to the earliest today.
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
