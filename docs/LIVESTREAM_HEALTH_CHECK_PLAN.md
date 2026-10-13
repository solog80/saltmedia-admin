# Live Stream Health Check & Viewer Gating Plan

A plan to stop viewers from hammering **dead** live streams, so a single stream dropping
(typically due to a field/network blip) no longer cascades into the rest of the edge.

---

## 🧩 Problem

The edge (`198.204.224.170` / `s221576.wholesaleinternet.net`, front `edge.saltmedia.ug`) is a
single OvenMediaEngine (OME) that **pulls** every stream from the origins over **OVT** and
re-publishes it (LLHLS/WebRTC/HLS).

When a stream's **source drops**:

1. The viewer's player keeps re-fetching the playlist (HLS reload loop).
2. Each fetch makes the edge **try to pull** the now-dead stream.
3. OME de-duplicates concurrent pulls of the same stream — every extra request **waits** on the
   in-progress pull (`Wait for the same stream that was previously requested to be created`),
   so each waiting request **occupies a worker**.
4. The worker pool fills → **other streams starve** → from the viewer's side, *everything* stalls.

Observed symptoms (2026-10-07):

- `tv2/live` dropping caused `tv1/stream` to stall (both on the edge).
- A stuck client looping the retired `app/stream2` at **256 req/min** (~1060 established
  connections) wedged the edge until a stopgap rule was added.
- Edge was **not** resource-bound: 16 cores, load ~1.2, ~15% CPU, 58 GiB RAM free — purely a
  **worker-pool starvation** problem.

---

## 🎯 Goal

**Do not send viewers to a stream that isn't live.** If it's offline, show an "offline" state and
keep the player detached — so the edge never receives the request flood in the first place.

---

## 🗺️ Liveness source

Use the **origin's** `.m3u8` HTTP status — it reflects the *source*, not "who's watching":

| Stream        | Origin               | Probe URL (origin)                                        |
| ------------- | -------------------- | --------------------------------------------------------- |
| `tv1/stream`  | origin-contabo `158.220.126.145` | `http://158.220.126.145:3333/tv1/stream/llhls.m3u8` |
| `tv2/live`    | origin2-salt2 `75.119.149.43`    | `http://75.119.149.43:3333/tv2/live/llhls.m3u8`     |
| `app/stream2` | retired (origin2)    | `http://75.119.149.43:3333/app/stream2/llhls.m3u8`        |

**`200` = live**, **`404` = offline**. Verified working:

```
origin2        tv2/live/llhls.m3u8     -> 200   (live)
origin-contabo tv1/stream/llhls.m3u8   -> 200   (live)
origin2        app/stream2/llhls.m3u8  -> 404   (offline ✅)
```

> **Edge vs origin:** probing the *edge* is unreliable for liveness — the edge lingers a `200`
> master for a dead stream, and its OME REST API only lists streams with active viewers. Always
> probe the **origin**.

---

## 🏗️ Architecture

```
  Browser / App player
        │  (before attach)  GET /api/stream-health
        ▼
  saltmedia-admin-app  (Next.js on Vercel)
        │  server-side probe (short timeout, cached ~5s)
        ▼
  ┌────────────────────────────┐        ┌────────────────────────────┐
  │ origin-contabo:3333        │        │ origin2-salt2:3333         │
  │  /tv1/stream/llhls.m3u8    │        │  /tv2/live/llhls.m3u8      │
  └────────────────────────────┘        └────────────────────────────┘
        │ 200 = live                                                   │
        │ 404 = offline                                                │
        ▼
  { "tv1": "live", "tv2": "live", "app": "offline" }
```

---

## 📋 Implementation

### 1. Environment variables

Add to `.env.local` (and Vercel project env). **Do not commit secrets.**

```env
OME_ORIGIN_CONTABO_URL=http://158.220.126.145:3333
OME_ORIGIN2_URL=http://75.119.149.43:3333

# Optional: edge OME REST API (for a "currently served" cross-check)
# OME_EDGE_URL=http://198.204.224.170:8091
# OME_API_TOKEN=<edge OME API AccessToken — see edge_conf/Server.xml>
```

### 2. Stream → origin map

Single source of truth for what we serve and where the source lives:

```ts
// src/lib/streams.ts
export type LiveStream = { key: string; app: string; stream: string; origin: string };

export const LIVE_STREAMS: LiveStream[] = [
  { key: "tv1", app: "tv1", stream: "stream", origin: process.env.OME_ORIGIN_CONTABO_URL! },
  { key: "tv2", app: "tv2", stream: "live",   origin: process.env.OME_ORIGIN2_URL! },
];
```

### 3. Health API route

`src/app/api/stream-health/route.ts` — probes each stream's origin `.m3u8`, caches ~5 s.

```ts
import { NextResponse } from "next/server";
import { LIVE_STREAMS } from "@/lib/streams";

const CACHE_MS = 5_000;
let cache: { at: number; data: Record<string, string> } | null = null;

async function isLive(origin: string, app: string, stream: string): Promise<boolean> {
  const url = `${origin}/${app}/${stream}/llhls.m3u8`;
  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
      headers: { Range: "bytes=0-0" }, // 1-byte GET; keep it cheap
    });
    return res.ok; // 2xx = live
  } catch {
    return false; // timeout / network error = offline
  }
}

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return NextResponse.json(cache.data);
  }
  const entries = await Promise.all(
    LIVE_STREAMS.map(async (s) => [s.key, (await isLive(s.origin, s.app, s.stream)) ? "live" : "offline"] as const)
  );
  const data = Object.fromEntries(entries);
  cache = { at: Date.now(), data };
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
```

**Response:** `{ "tv1": "live", "tv2": "live" }` (an absent/offline key means do not start a player).

### 4. Client gating (player page)

Gate the player so an offline stream never loops:

```ts
const health = await fetch("/api/stream-health").then((r) => r.json());
if (health.tv2 !== "live") {
  showOfflineCard();          // do NOT attach hls.js / <video>
} else {
  attachPlayer("https://edge.saltmedia.ug/tv2/live/llhls.m3u8");
}
```

Also re-check periodically while playing (e.g. every 30 s) and detach on transition to `offline`,
so a mid-session drop stops the reload loop too.

### 5. (Optional) Edge gate

If you want the edge fully protected even without the app's cooperation, a small **Cloudflare
Worker** (for `stream.salttelelevision.com`) can call the same liveness logic and return a fast
`404/204` for offline streams — the request then never reaches OME. Same origin probe, no OME
pull. (Belt-and-braces; the app-level gate is the primary fix.)

---

## 🛡️ Edge-side mitigations (already applied)

These reduce the blast radius of any residual flood:

- **Worker pools raised** on the edge (`edge_conf/Server.xml`): `WorkerCount 4→8`,
  `AppWorkerCount 4→8`, `StreamWorkerCount 8→16`. The box (16 cores, ~15% used) has ample
  headroom. Backup: `Server.xml.bak.workers.*`.
- **`/app/` fast-fail rule** on the edge: `/app/*` points at a dead target so retired streams
  404 in <1 s **without** a blocking pull. Backup: `Server.xml.bak.appfail.*`.
- **Origins cleanup:** edge `<Origins>` now is `/tv2/ → origin2`, `/` catch-all → origin-contabo,
  `/app/ → fast-fail`. (The `app/stream` + `app/stream2` pull rules were removed.)

> OME's OriginMap does **not** "search both origins for a stream": the first `<Url>` is the
> primary and the rest are standby (for an *unreachable* primary, gated by `<Failback>`). A stream
> that only exists on the secondary needs its own `<Origin><Location>` rule. Hence the explicit
> `/tv2/` rule.

---

## ✅ Verification

1. `GET /api/stream-health` → `{ "tv1": "live", "tv2": "live" }`.
2. Stop a source (e.g. pause the `tv2` encoder). Within the cache window the endpoint flips
   `tv2 → "offline"`; the player page shows the offline card and **makes no player requests**.
3. On the edge, confirm no `Wait for the same stream that was previously requested to be created`
   build-up for that stream.

---

## 🚦 Rollout

1. Add env vars + `src/lib/streams.ts` + `src/app/api/stream-health/route.ts`.
2. Wire the player page(s) to gate on the health response.
3. Deploy to Vercel; verify against live + a deliberately stopped source.
4. (Optional) Add the CF Worker edge gate for `stream.salttelelevision.com`.
5. (Optional) Tighten OME `<Origins><Properties>`:
   `<UnusedStreamDeletionTimeout>` + `<NoInputFailoverTimeout>` to clean up ghosts faster.

---

## 📎 Reference — key endpoints

| What              | Value |
| ----------------- | ----- |
| Edge (CDN/origin relay) | `198.204.224.170` — LLHLS/WebRTC `:3333`, varnish `:8081`, OME API `:8091` |
| origin-contabo    | `158.220.126.145` — OME `:3333`, OVT `:9000`, SRT `:9999` |
| origin2-salt2     | `75.119.149.43` — OME `:3333`, OVT `:9000`, SRT `:9999` |
| Edge OME API      | `GET /v1/vhosts/default/apps/{app}/streams` (Basic auth, `OME_API_TOKEN`) |
| Edge playback     | `https://edge.saltmedia.ug/{app}/{stream}/llhls.m3u8` |
