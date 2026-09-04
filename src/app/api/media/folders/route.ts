import { NextRequest, NextResponse } from "next/server"

const API_BASE = process.env.API_BASE_URL || ""
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || ""

// Creates a folder in a media-library scope (mesh storage).
export async function POST(request: NextRequest) {
  try {
    if (!API_BASE || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "mesh storage is not configured" }, { status: 501 })
    }
    const body = await request.json().catch(() => ({}))
    if (!body?.folder || typeof body.folder !== "string") {
      return NextResponse.json({ error: "folder is required" }, { status: 400 })
    }
    const scope = typeof body.scope === "string" && body.scope ? body.scope : "news"
    const res = await fetch(`${API_BASE}/createFolder`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ scope, folder: body.folder }),
      cache: "no-store",
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json({ error: data?.error || `Create failed (${res.status})` }, { status: res.status })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error("Create media folder error", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
