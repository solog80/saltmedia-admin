# BFF Integration (Broadcasts / Live Radio)

The dashboard talks to the Dart BFF for all producer-side radio control and for
broadcast configuration. The BFF is the only component that talks to Asterisk
AMI and the mesh service role.

## Architecture

```
Browser (admin)
  │  Firebase session cookie (httpOnly `firebaseToken`)
  ▼
Next.js API routes (/api/radio/*, /api/broadcast_settings)
  │  verifySession() → role must be `admin`
  │  x-radio-key: $RADIO_CONTROL_KEY
  ▼
Dart BFF (https://edge.solofx.net)
  │  Asterisk AMI over the private tailnet
  ▼
Asterisk ConfBridge (presenters)
  ▲
  │  Firebase ID token (app users)
StationCast mobile app (/api/v1/bff/radio/presenters)
```

## Pages

| Route | Purpose |
|---|---|
| `/broadcast` | **Live TV** — device health, SRT/RTMP destinations, TV config |
| `/broadcast/radio` | **Live Radio** — producer studio: presenters, mute/unmute, Studio leg |
| `/radio/studio` | Redirects to `/broadcast/radio` |
| `/radio`, `/radio/logs`, `/radio/reports` | Stations, traffic logs, and reports (unchanged) |

Both broadcast pages share `src/app/broadcast/BroadcastTabs.tsx`.

## Dashboard API routes

| Route | Auth | Forwards to |
|---|---|---|
| `GET /api/radio/participants` | admin session | `GET /api/v1/bff/radio/participants` |
| `POST /api/radio/mute` | admin session | `POST /api/v1/bff/radio/mute` |
| `POST /api/radio/comrex` | admin session | `POST /api/v1/bff/radio/comrex` (Studio leg) |
| `POST /api/radio/avatar` | admin session | media library `/uploadImage` + mesh `broadcast_config` |
| `GET/POST /api/broadcast_settings` | admin session | mesh `broadcast_config` via service role |

The browser never receives `RADIO_CONTROL_KEY`, the mesh service key, or the
AMI secret.

## App-facing BFF endpoint

`GET /api/v1/bff/radio/presenters` accepts a **Firebase ID token** from the
StationCast app and returns the current presenters without credentials or
channels:

```json
{
  "success": true,
  "conference": "presenters",
  "presenters": [
    {
      "name": "Solomon Ato",
      "extension": "presenter1",
      "callerId": "2001",
      "muted": true,
      "avatarUrl": "https://lh3.googleusercontent.com/..."
    }
  ]
}
```

The app uses this for the swipe-up “Connected presenters” section. Firebase
ID tokens are verified by the BFF with the Identity Toolkit lookup API.

## Presenter identity and avatars

The dashboard enriches participants by mapping the SIP extension to the
Firebase UID from `broadcast_config.radio.extension` / `username`.

Avatar priority:

1. Firebase Auth Google `photoURL`
2. Dashboard custom S3 photo stored in `broadcast_config.radio.avatarUrl`
3. Mesh `public.users.profile_image_url`
4. Initials

Name priority:

1. Firebase Auth `displayName`
2. Mesh `users.name`
3. Dashboard line `radio.name`
4. SIP caller ID

Custom photos are uploaded with `POST /api/radio/avatar` to the media library
(`scope=radio-avatars`) and stored back on the same radio config. The dashboard
refreshes the directory immediately after an upload.

## Behaviour

- New presenters join ConfBridge **muted** (`presenters_user: startmuted=yes`).
- The Studio/Comrex leg uses `comrex_user` (`startmuted=no`).
- The dashboard auto-hangs duplicate calls for the same CallerID (keeps the
  newest).
- The app-facing directory is read-only and never hangs calls.
- Presenter cards show `CONNECTED` + `MUTED`/`ON AIR`, with a pulsing presence
  dot.
- Mute/Unmute is optimistic in the UI; the AMI command is the only awaited step.
- The directory/photo lookup is cached for ~30 seconds in the Next API.

## Environment (.env.local and Vercel)

```bash
# Next.js server-side
RADIO_BFF_URL=https://edge.solofx.net
RADIO_CONTROL_KEY=<same value as the BFF>
REST_BASE_URL=https://edge.solofx.net/rest/v1
SERVICE_ROLE_KEY=<mesh service role key>
API_BASE_URL=https://edge.solofx.net/api/v1

# Firebase Admin (session verification + user lookup)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

`RADIO_CONTROL_KEY` must match `RADIO_CONTROL_KEY` in the BFF service env.

## Local testing

1. Start the dashboard: `npm run dev`.
2. Log in as an **admin** (`/login`).
3. Ensure the BFF is reachable at `RADIO_BFF_URL`.
4. Open **Broadcasts → Live Radio**.
5. Join a presenter to the dev conference (`5062`); it appears as `CONNECTED`
   and `MUTED`, then use **Route (Unmute)**.

For the mobile directory, the StationCast device must be signed in with a
Firebase account that has a valid ID token.
