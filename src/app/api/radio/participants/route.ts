import { NextRequest, NextResponse } from 'next/server';
import { firebaseAdmin, verifySession } from '@/lib/firebaseAdmin';

const BFF_URL = process.env.RADIO_BFF_URL || 'https://edge.solofx.net';
const CONTROL_KEY = process.env.RADIO_CONTROL_KEY || '';
const REST_URL = (process.env.REST_BASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SERVICE_ROLE_KEY || '';

type MeshUser = {
  id: string;
  name?: string | null;
  profile_image_url?: string | null;
};

type AuthUser = {
  photoURL?: string | null;
  displayName?: string | null;
};

type RosterEntry = {
  extension: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  enabled: boolean;
  lineName?: string;
  registrarPort?: number;
};

type Roster = {
  at: number;
  endpointToUid: Map<string, string>;
  users: Map<string, MeshUser>;
  authUsers: Map<string, AuthUser>;
  customAvatars: Map<string, string>;
  entries: RosterEntry[];
};

let rosterCache: Roster | null = null;

function meshHeaders() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    Accept: 'application/json',
  };
}

/** `PJSIP/presenter1-00000020` -> `presenter1` */
function endpointOf(channel?: string): string | undefined {
  const match = /^PJSIP\/([^-]+)-/.exec(channel || '');
  return match?.[1];
}

async function loadRoster(force = false): Promise<Roster | null> {
  if (!force && rosterCache && Date.now() - rosterCache.at < 30_000) {
    return rosterCache;
  }
  if (!REST_URL || !SERVICE_KEY) return null;

  try {
    const cfgRes = await fetch(
      `${REST_URL}/broadcast_config?select=user_id,radio`,
      { headers: meshHeaders(), cache: 'no-store' },
    );
    if (!cfgRes.ok) return null;
    const rows = (await cfgRes.json()) as Array<{
      user_id: string;
      radio?: Record<string, unknown>;
    }>;

    const endpointToUid = new Map<string, string>();
    for (const row of rows) {
      const radio = row.radio || {};
      for (const candidate of [radio.extension, radio.username]) {
        if (typeof candidate === 'string' && candidate.trim()) {
          endpointToUid.set(candidate.trim().toLowerCase(), row.user_id);
        }
      }
    }

    const uids = [...new Set(endpointToUid.values())];
    const users = new Map<string, MeshUser>();
    if (uids.length > 0) {
      const filter = `in.(${uids.map((id) => encodeURIComponent(id)).join(',')})`;
      const usersRes = await fetch(
        `${REST_URL}/users?id=${filter}&select=id,name,profile_image_url`,
        { headers: meshHeaders(), cache: 'no-store' },
      );
      if (usersRes.ok) {
        const list = (await usersRes.json()) as MeshUser[];
        for (const user of list) users.set(user.id, user);
      }
    }

    // Google sign-in photoURL is the primary avatar source; the mesh users
    // row is a fallback when Firebase Auth has no photo.
    const authUsers = new Map<string, AuthUser>();
    if (uids.length > 0) {
      try {
        const result = await firebaseAdmin
          .auth()
          .getUsers(uids.map((uid) => ({ uid })));
        for (const u of result.users) {
          authUsers.set(u.uid, {
            photoURL: u.photoURL,
            displayName: u.displayName,
          });
        }
      } catch (e) {
        console.error('[radio/participants] firebase user lookup failed', e);
      }
    }

    const customAvatars = new Map<string, string>();
    for (const row of rows) {
      const radio = row.radio || {};
      if (typeof radio.avatarUrl !== 'string' || !radio.avatarUrl) continue;
      for (const candidate of [radio.extension, radio.username]) {
        if (typeof candidate === 'string' && candidate.trim()) {
          customAvatars.set(candidate.trim().toLowerCase(), radio.avatarUrl);
        }
      }
    }

    const entries = new Map<string, RosterEntry>();
    for (const row of rows) {
      const radio = row.radio || {};
      const extensionRaw =
        typeof radio.extension === 'string' && radio.extension.trim()
          ? radio.extension
          : typeof radio.username === 'string' && radio.username.trim()
            ? radio.username
            : '';
      if (!extensionRaw) continue;
      const extension = extensionRaw.trim();
      const user = users.get(row.user_id);
      const authUser = authUsers.get(row.user_id);
      const custom = customAvatars.get(extension.toLowerCase());
      entries.set(extension.toLowerCase(), {
        extension,
        userId: row.user_id,
        displayName:
          authUser?.displayName ||
          user?.name ||
          (typeof radio.name === 'string' ? radio.name : extension),
        avatarUrl:
          custom || authUser?.photoURL || user?.profile_image_url || undefined,
        enabled: radio.enabled !== false,
        lineName: typeof radio.name === 'string' ? radio.name : undefined,
        registrarPort:
          typeof radio.registrarPort === 'number'
            ? radio.registrarPort
            : undefined,
      });
    }

    rosterCache = {
      at: Date.now(),
      endpointToUid,
      users,
      authUsers,
      customAvatars,
      entries: [...entries.values()],
    };
    return rosterCache;
  } catch (e) {
    console.error('[radio/participants] roster lookup failed', e);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get('firebaseToken')?.value);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  if (!CONTROL_KEY) {
    return NextResponse.json(
      { error: 'RADIO_CONTROL_KEY is not configured' },
      { status: 500 },
    );
  }
  try {
    const res = await fetch(`${BFF_URL}/api/v1/bff/radio/participants`, {
      headers: { 'x-radio-key': CONTROL_KEY },
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    const fresh = req.nextUrl.searchParams.get('fresh') === '1';
    const roster = await loadRoster(fresh);
    if (Array.isArray(data?.participants)) {
      data.participants = data.participants.map((p: Record<string, unknown>) => {
        const extension = endpointOf(p.Channel as string | undefined);
        const uid = extension
          ? roster?.endpointToUid.get(extension.toLowerCase())
          : undefined;
        const user = uid ? roster?.users.get(uid) : undefined;
        const authUser = uid ? roster?.authUsers.get(uid) : undefined;
        const custom = extension
          ? roster?.customAvatars.get(extension.toLowerCase())
          : undefined;
        return {
          ...p,
          extension,
          userId: uid,
          displayName: authUser?.displayName || user?.name || undefined,
          avatarUrl:
            custom || authUser?.photoURL || user?.profile_image_url || undefined,
        };
      });
    }

    data.roster = roster?.entries ?? [];
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { error: `Radio control failed: ${e}` },
      { status: 502 },
    );
  }
}
