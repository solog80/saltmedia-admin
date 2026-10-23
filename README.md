# SaltMedia Admin App

A full-featured administration dashboard for the SaltMedia streaming platform. Manage content, users, advertisements, analytics, broadcasts, monetization, and programming across TV, Radio, and On-Demand channels.

## Tech Stack

- **Framework:** Next.js 15 (App Router, Turbopack)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4, shadcn/ui
- **Backend:** Firebase (Firestore, Auth, Functions, RTDB) + Supabase Mesh via the Dart BFF
- **State:** TanStack React Query v5, Zustand v5
- **Charts:** Recharts
- **Video:** HLS.js, tus-js-client (resumable uploads)

## Features

- **Dashboard** — Quick stats and module links
- **User Management** — CRUD with role-based access (admin/moderator)
- **On-Demand Videos** — Upload, edit, season/episode management, Bunny CDN integration
- **TV Channels** — Manage live channels with HLS player
- **Radio Stations** — Manage radio stations and streams
- **EPG** — Electronic Program Guide with scheduling
- **Analytics** — Impressions, watch-time, users, sessions, charts, top-content ranking
- **Events** — Platform event tracking
- **Hero Banners** — Promotional banners with scheduling
- **Monetization** — Payment tracking and metrics
- **Broadcasts** — **Live TV** health/config monitor and **Live Radio** producer studio (presenter cards, mute/unmute, Studio leg, Google/S3 avatars)
- **Ads** — Full ad campaign management (manual & VAST), frequency capping, analytics

## Getting Started

```bash
npm install
npm run dev
```

Set up a `.env.local` file with your Firebase configuration plus the BFF/mesh
keys documented in [BFF_INTEGRATION.md](./BFF_INTEGRATION.md).

## BFF Integration

Live Radio producer controls, broadcast configuration, custom avatars, and the
mobile presenter directory are documented in
[BFF_INTEGRATION.md](./BFF_INTEGRATION.md).

## Deployment

Deployed via Vercel.
