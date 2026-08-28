import { NextRequest, NextResponse } from "next/server"

const API_BASE = process.env.API_BASE_URL || ""
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || ""

// Deletes an image from the news media library (mesh storage).
export async function DELETE(request: NextRequest) {
  try {
    if (!API_BASE || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "mesh storage is not configured" }, { status: 501 })
    }
    const body = await request.json().catch(() => ({}))
    if (!body?.path || typeof body.path !== "string") {
      return NextResponse.json({ error: "path is required" }, { status: 400 })
    }
    const res = await fetch(`${API_BASE}/deleteNewsImage`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ path: body.path }),
      cache: "no-store",
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json({ error: data?.error || `Delete failed (${res.status})` }, { status: res.status })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error("Delete news image error", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Proxies the mesh media-library listing so the news editor can browse/reuse
// images that are already uploaded (organized under news/<folder>/).
export async function GET(req: NextRequest) {
  try {
    if (!API_BASE || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "mesh storage is not configured" }, { status: 501 })
    }
    const folder = req.nextUrl.searchParams.get("folder") || ""
    const offset = req.nextUrl.searchParams.get("offset") || "0"
    const qs = new URLSearchParams({ offset })
    if (folder) qs.set("folder", folder)

    const res = await fetch(`${API_BASE}/listNewsImages?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      cache: "no-store",
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json({ error: data?.error || `List failed (${res.status})` }, { status: res.status })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error("News media library error", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}