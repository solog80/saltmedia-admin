import { NextRequest, NextResponse } from "next/server"

const API_BASE = process.env.API_BASE_URL || ""
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || ""

// Generic media library proxy. `scope` selects the library root in storage
// (e.g. "news", "epg-programs", "events", "notifications"). Mirrors the news
// image endpoints but is scope-aware so every surface can browse/reuse images.

function scopeOf(req: NextRequest): string {
  return req.nextUrl.searchParams.get("scope") || "news"
}

// Lists (GET) or deletes (DELETE) media-library objects under the scope.
export async function GET(req: NextRequest) {
  try {
    if (!API_BASE || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "mesh storage is not configured" }, { status: 501 })
    }
    const folder = req.nextUrl.searchParams.get("folder") || ""
    const offset = req.nextUrl.searchParams.get("offset") || "0"
    const qs = new URLSearchParams({ offset })
    qs.set("scope", scopeOf(req))
    if (folder) qs.set("folder", folder)

    const res = await fetch(`${API_BASE}/listImages?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      cache: "no-store",
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json({ error: data?.error || `List failed (${res.status})` }, { status: res.status })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error("Media library error", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!API_BASE || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "mesh storage is not configured" }, { status: 501 })
    }
    const body = await req.json().catch(() => ({}))
    if (!body?.path || typeof body.path !== "string") {
      return NextResponse.json({ error: "path is required" }, { status: 400 })
    }
    const res = await fetch(`${API_BASE}/deleteImage`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ scope: scopeOf(req), path: body.path }),
      cache: "no-store",
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json({ error: data?.error || `Delete failed (${res.status})` }, { status: res.status })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error("Delete media image error", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
