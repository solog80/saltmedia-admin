import { NextRequest, NextResponse } from "next/server"

// Bunny image storage. Only active when a storage zone + access key are configured.
const STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || ""
const STORAGE_ACCESS_KEY = process.env.BUNNY_STORAGE_ACCESS_KEY || ""
const CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME || ""

export async function POST(request: NextRequest) {
  try {
    if (!STORAGE_ZONE || !STORAGE_ACCESS_KEY) {
      return NextResponse.json({ error: "Bunny image storage is not configured" }, { status: 501 })
    }

    const formData = await request.formData()
    const file = formData.get("file")
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "file is required" }, { status: 400 })
    }

    const blob = file as unknown as Blob
    const filename = `${Date.now()}-${(file as { name?: string }).name || "image"}.${blob.type.split("/")[1] || "jpg"}`

    const url = `https://storage.bunnycdn.com/${STORAGE_ZONE}/${filename}`
    const uploadResponse = await fetch(url, {
      method: "PUT",
      headers: {
        AccessKey: STORAGE_ACCESS_KEY,
        "Content-Type": blob.type || "application/octet-stream",
      },
      body: blob,
      cache: "no-store",
    })

    if (!uploadResponse.ok) {
      return NextResponse.json({ error: `Bunny upload failed (${uploadResponse.status})` }, { status: uploadResponse.status })
    }

    const cdnBase = CDN_HOSTNAME || `${STORAGE_ZONE}.b-cdn.net`
    return NextResponse.json({ url: `https://${cdnBase}/${filename}` }, { status: 201 })
  } catch (e) {
    console.error("Bunny image upload error", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}