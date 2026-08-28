import { NextRequest, NextResponse } from "next/server"

const API_BASE = process.env.API_BASE_URL || ""
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || ""

// Uploads an image to the mesh storage (Supabase Storage via the Go mesh),
// which optimizes + converts it to WebP. The returned public URL is what gets
// stored on the Joomla article.
export async function POST(request: NextRequest) {
  try {
    if (!API_BASE || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "mesh storage is not configured" }, { status: 501 })
    }

    const formData = await request.formData()
    const file = formData.get("file")
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "file is required" }, { status: 400 })
    }

    const blob = file as unknown as Blob
    const buf = Buffer.from(await blob.arrayBuffer())
    const folder = typeof formData.get("folder") === "string" ? (formData.get("folder") as string) : ""

    const fd = new FormData()
    fd.append(
      "file",
      new Blob([new Uint8Array(buf)], { type: blob.type || "image/jpeg" }),
      (file as { name?: string }).name || "image",
    )
    if (folder) fd.append("folder", folder)

    const res = await fetch(`${API_BASE}/uploadNewsImage`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      body: fd,
      cache: "no-store",
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json({ error: data?.error || `Upload failed (${res.status})` }, { status: res.status })
    }
    return NextResponse.json({ url: data.url }, { status: 201 })
  } catch (e) {
    console.error("News image upload error", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}