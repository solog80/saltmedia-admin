# Broadcast Mesh & NDI Bridge Integration Plan

This plan details the migration of **StationCast Broadcast Monitoring & Remote Control** from Firebase Firestore to the self-hosted **Supabase Mesh** (`https://edge.solofx.net`) and the integration of the **Go Multi-Stream NDI Bridge**.

---

## 🏗️ Architecture & Component Overview

```
 ┌───────────────────────────┐        PostgREST HTTP API          ┌────────────────────────────┐
 │  Mobile Broadcaster App   │ ─────────────────────────────────> │  Supabase Database Mesh    │
 │  (station_cast Flutter)   │   Telemetry & Snapshot Upserts     │   (https://edge.solofx.net)│
 └───────────────────────────┘                                    └─────────────┬──────────────┘
                                                                                │
                                                                 PostgREST REST API Read (Server)
                                                                                │
 ┌───────────────────────────┐        Direct HTTP Control API     ┌─────────────▼──────────────┐
 │  Go NDI Bridge App        │ <───────────────────────────────── │    Salt Media Admin App    │
 │  (http://localhost:7890)  │    Start/Stop/PLI/Add Channels     │  (src/app/broadcast/page)  │
 └───────────────────────────┘                                    └────────────────────────────┘
```

---

## 📋 1. Supabase Database Schema (`edge.solofx.net`)

Two primary tables replace the legacy Firebase `broadcasts` and `broadcastConfig` collections:

### A. Table `public.broadcast_telemetry`
Stores real-time status telemetry reported by mobile field broadcasters:

```sql
CREATE TABLE IF NOT EXISTS public.broadcast_telemetry (
  broadcaster_id TEXT PRIMARY KEY,
  broadcaster_name TEXT NOT NULL DEFAULT '',
  is_live BOOLEAN NOT NULL DEFAULT false,
  uptime INTEGER NOT NULL DEFAULT 0,
  bitrate BIGINT NOT NULL DEFAULT 0,
  rtt_ms REAL NOT NULL DEFAULT 0.0,
  packets_dropped INTEGER NOT NULL DEFAULT 0,
  return_feed_url TEXT NOT NULL DEFAULT '',
  stream_url TEXT NOT NULL DEFAULT '',
  snapshot TEXT, -- Base64 JPEG frame snapshot
  talkback_active BOOLEAN NOT NULL DEFAULT false,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS & set public anon/authenticated read access
ALTER TABLE public.broadcast_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read telemetry" ON public.broadcast_telemetry
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow service role write telemetry" ON public.broadcast_telemetry
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
```

### B. Table `public.broadcast_configs`
Stores remote device configurations set by MCR directors:

```sql
CREATE TABLE IF NOT EXISTS public.broadcast_configs (
  broadcaster_id TEXT PRIMARY KEY,
  broadcaster_name TEXT NOT NULL DEFAULT '',
  encoder_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  return_feed JSONB NOT NULL DEFAULT '{}'::jsonb,
  talkback JSONB NOT NULL DEFAULT '{}'::jsonb,
  destinations JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.broadcast_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read configs" ON public.broadcast_configs
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow service role write configs" ON public.broadcast_configs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
```

---

## ⚙️ 2. Admin App Integration (`saltmedia-admin-app`)

Matching the existing architecture used in **Chat**, **Ads**, **EPG**, and **Hero Banners**:

1. **Next.js Server API Routes (`src/app/api/broadcast/route.ts`)**:
   - Uses server-side `fetch()` with `REST_BASE_URL` (`https://edge.solofx.net/rest/v1`) and `SERVICE_ROLE_KEY`.
   - `GET /api/broadcast`: Queries active devices from `broadcast_telemetry`.
   - `POST /api/broadcast`: Upserts device configuration changes into `broadcast_configs`.

2. **Next.js NDI Bridge Proxy Route (`src/app/api/ndi-bridge/route.ts`)**:
   - Proxies status requests and control commands to NDI Bridge endpoints (`http://localhost:7890/api/...`).

3. **Admin UI (`src/app/broadcast/page.tsx`)**:
   - Replaces Firestore `onSnapshot` with `/api/broadcast` fetch polling.
   - **Device Monitor Grid**: Renders live video snapshots, bitrate, uptime, and talkback status.
   - **Remote Device Config Form**: Edits resolution, bitrate, return feed SRT parameters, talkback, and SRT/RTMP destination presets.
   - **NDI Bridge Manager Panel**: Dynamic grid of all active contributor stream channels (`field1`, `field2`, etc.) with controls for Force Keyframe (PLI), Start/Stop, and Add Channel.

---

## 📱 3. Mobile Broadcaster App (`station_cast`)

Update `broadcast_reporter.dart`:
- Replace Firestore `setDoc` calls with PostgREST HTTP calls to `https://edge.solofx.net/rest/v1/broadcast_telemetry`.
- Use HTTP `POST`/`PATCH` with header `Prefer: resolution=merge-duplicates` for atomic upserts.

---

## 🚀 4. Implementation Steps

1. **Apply Database Migration**: Run SQL schema on Supabase primary instance (`us1`).
2. **Create Next.js API Routes**: Add `src/app/api/broadcast/route.ts` and `src/app/api/ndi-bridge/route.ts`.
3. **Refactor Admin Page**: Update `src/app/broadcast/page.tsx` to use the new API endpoints.
4. **Update Flutter Reporter**: Update `broadcast_reporter.dart` in `station_cast` to sync telemetry to Supabase PostgREST endpoint.
